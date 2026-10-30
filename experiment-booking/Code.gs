/**
 * 2026 은행고등학교 아인슈타인 동아리 방과후 실험 신청
 * 학생: 학번 + 이름만 입력 / 교사: 서버 보관 PIN으로 인증
 * 저장소: 설치 시 자동 생성되는 Google 스프레드시트
 * 날짜별 마감: 실험 전날 23:59:59, 한국 시간
 * 배포: Google Apps Script 웹 앱 (소유자 계정으로 실행)
 *
 * 학생 식별 정보만 입력하므로 본인 인증은 되지 않습니다.
 * 학생에게 다른 사람의 신청 내용을 조회/변경하는 기능을 제공하지 않습니다.
 */
const APP_TZ = 'Asia/Seoul';
const ALLOWED_SLOTS = [
  ['2026-11-02','11월 2일(월) 방과후'],
  ['2026-11-04','11월 4일(수) 방과후'],
  ['2026-11-05','11월 5일(목) 방과후'],
  ['2026-11-06','11월 6일(금) 방과후'],
  ['2026-11-09','11월 9일(월) 방과후'],
  ['2026-11-10','11월 10일(화) 방과후']
];
const APPLICATION_HEADERS = ['신청ID','실험날짜','대표학번','대표이름','참석학생(JSON)',
  '실험계획(JSON)','구입할준비물(JSON)','과학실보유준비물(JSON)',
  '교사확인상태','교사메모','신청시각','최종수정시각'];
const SLOT_HEADERS = ['실험일자','표시명','신청가능','안내사항'];
const IDX = {id:0,date:1,repId:2,repName:3,members:4,plan:5,buy:6,stock:7,
  decision:8,note:9,created:10,updated:11};

/**
 * 교사용 PIN은 PUBLIC 코드에 기록하지 않습니다.
 * Apps Script > 프로젝트 설정 > 스크립트 속성에 LAB_ADMIN_INITIAL_PIN을 추가한 뒤
 * 처음 설치면 setupApp_(), 이미 설치된 프로젝트면 configureAdminPin_()을
 * Apps Script 편집기에서 직접 실행하세요.
 * 이 함수들은 이름이 _로 끝나 브라우저에서 호출할 수 없습니다.
 */
function configureAdminPin_() {
  const props=PropertiesService.getScriptProperties();
  const pin=String(props.getProperty('LAB_ADMIN_INITIAL_PIN')||'');
  if(!/^\d{4}$/.test(pin))throw new Error('프로젝트 설정 > 스크립트 속성에 LAB_ADMIN_INITIAL_PIN (숫자 4자리)을 먼저 입력하세요.');
  const salt=Utilities.getUuid();
  props.setProperties({LAB_ADMIN_SALT:salt,LAB_ADMIN_HASH:hash_(salt+':'+pin)});
  props.deleteProperty('LAB_ADMIN_INITIAL_PIN');
  props.deleteProperty('LAB_ADMIN_AUTH_FAILS');
  props.deleteProperty('LAB_ADMIN_AUTH_WINDOW');
  return '교사 PIN 설정 완료. 초기 입력 속성은 삭제되었습니다.';
}

/** 최초 설치 1회: 관리용 시트 생성 및 PIN 설정 */
function setupApp_() {
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('LAB_DB_ID'))throw new Error('이미 설치된 상태입니다. 기존 저장 데이터를 유지합니다.');
  if(!/^\d{4}$/.test(String(props.getProperty('LAB_ADMIN_INITIAL_PIN')||'')))
    throw new Error('스크립트 속성 LAB_ADMIN_INITIAL_PIN에 4자리 PIN을 먼저 저장하세요.');
  const ss=SpreadsheetApp.create('2026 아인슈타인 동아리 방과후 실험 신청 관리');
  ss.setSpreadsheetTimeZone(APP_TZ);
  const sh=ss.getSheets()[0];
  sh.setName('신청목록');
  sh.getRange(1,1,1,APPLICATION_HEADERS.length).setValues([APPLICATION_HEADERS]);
  sh.getRange('B:D').setNumberFormat('@');
  sh.getRange(1,1,1,APPLICATION_HEADERS.length).setBackground('#193956').setFontColor('white').setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setColumnWidths(1,4,135);
  sh.setColumnWidths(5,4,350);
  const slots=ss.insertSheet('예약일정');
  slots.getRange('A:A').setNumberFormat('@');
  slots.getRange(1,1,1,4).setValues([SLOT_HEADERS]);
  slots.getRange(2,3,ALLOWED_SLOTS.length,1).insertCheckboxes();
  slots.getRange(2,1,ALLOWED_SLOTS.length,4).setValues(ALLOWED_SLOTS.map(s=>[s[0],s[1],true,'']));
  slots.getRange(1,1,1,4).setBackground('#193956').setFontColor('white').setFontWeight('bold');
  slots.setColumnWidth(2,240);slots.setColumnWidth(4,400);slots.setFrozenRows(1);
  props.setProperty('LAB_DB_ID',ss.getId());
  configureAdminPin_();
  Logger.log('관리 스프레드시트: '+ss.getUrl());
  Logger.log('웹 앱은 학생용/교사용이 동일한 주소입니다.');
  return ss.getUrl();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('아인슈타인 | 방과후 실험 신청')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}

/** 공개 일정은 개인정보를 포함하지 않습니다. */
function publicConfig() {
  const current=now_();
  return {now:current, slots:slots_().map(s=>({
    date:s.date,label:s.label,enabled:s.enabled,note:s.note,
    deadline:prevDay_(s.date)+' 23:59',open:s.enabled && current < s.date+' 00:00:00'
  }))};
}

/** 학생 제출: 매 날짜별 대표 학번당 1개 신청. 수정/조회는 교사만 가능. */
function submitApplication(raw) {
  const payload=validated_(raw);
  return lock_(()=>{
    ensureOpen_(payload.date);
    const sh=db_().getSheetByName('신청목록');
    const found=rows_(sh).some(r=>String(r[IDX.date])===payload.date && String(r[IDX.repId])===payload.rep.id);
    if(found) throw new Error('이 날짜에 해당 대표 학번으로 제출된 신청서가 있습니다. 수정이 필요하면 담당 교사에게 문의하세요.');
    const at=now_(),id=Utilities.getUuid();
    sh.appendRow([id,payload.date,payload.rep.id,payload.rep.name,
      JSON.stringify(payload.members),JSON.stringify(payload.plan),
      JSON.stringify(payload.buy),JSON.stringify(payload.stock),
      'WAITING','',at,at]);
    SpreadsheetApp.flush();
    return {ok:true,date:payload.date,rep:payload.rep,submittedAt:at,
      message:'실험 신청이 접수되었습니다. 담당 교사의 확인 후 진행해 주세요.'};
  });
}

/** 최초 로그인 PIN만 전송. 이후에는 30분간 유효한 임시 토큰만 사용합니다. */
function teacherLogin(pin) {
  verifyAdminPin_(pin);
  const session=Utilities.getUuid()+Utilities.getUuid();
  CacheService.getScriptCache().put('LAB_TEACHER_SESSION_'+session,'authorized',1800);
  return {session:session,data:teacherData_()};
}
function teacherRefresh(session) {requireTeacherSession_(session);return teacherData_();}
function teacherLogout(session) {
  if(/^[a-f0-9-]{72}$/i.test(String(session||'')))
    CacheService.getScriptCache().remove('LAB_TEACHER_SESSION_'+session);
  return {ok:true};
}
function teacherSetSlot(session,date,enabled,note) {
  requireTeacherSession_(session);requireDate_(date);
  return lock_(()=>{
    const sh=db_().getSheetByName('예약일정');
    const vals=sh.getRange(2,1,ALLOWED_SLOTS.length,4).getDisplayValues();
    const i=vals.findIndex(x=>x[0]===date);
    if(i<0)throw new Error('예약 날짜를 찾지 못했습니다.');
    sh.getRange(i+2,3,1,2).setValues([[Boolean(enabled),str_(note,500)]]);
    return teacherData_();
  });
}
function teacherUpdateApplication(session,id,decision,note,statusChanges) {
  requireTeacherSession_(session);
  if(!['WAITING','APPROVED','NEEDS_EDIT','REJECTED'].includes(decision)) throw new Error('승인 상태가 올바르지 않습니다.');
  return lock_(()=>{
    const sh=db_().getSheetByName('신청목록'),all=rows_(sh);
    const i=all.findIndex(r=>String(r[IDX.id])===String(id));
    if(i<0)throw new Error('신청서를 찾을 수 없습니다.');
    const record=all[i];
    const buys=json_(record[IDX.buy],[]);
    const map={};
    (Array.isArray(statusChanges)?statusChanges:[]).forEach(x=>{
      if(x && ['NEEDED','ORDERED','PURCHASED'].includes(x.status))map[String(x.id)]=x.status;
    });
    buys.forEach(x=>{if(Object.prototype.hasOwnProperty.call(map,x.id))x.status=map[x.id];});
    record[IDX.buy]=JSON.stringify(buys);
    record[IDX.decision]=decision;
    record[IDX.note]=str_(note,1500);
    record[IDX.updated]=now_();
    sh.getRange(i+2,1,1,APPLICATION_HEADERS.length).setValues([record]);
    return teacherData_();
  });
}

function teacherData_() {
  return {slots:publicConfig().slots,now:now_(),records:rows_(db_().getSheetByName('신청목록')).map(r=>({
    id:String(r[IDX.id]),date:String(r[IDX.date]),rep:{id:String(r[IDX.repId]),name:String(r[IDX.repName])},
    members:json_(r[IDX.members],[]),plan:json_(r[IDX.plan],{}),
    buy:json_(r[IDX.buy],[]),stock:json_(r[IDX.stock],[]),
    decision:String(r[IDX.decision]||'WAITING'),note:String(r[IDX.note]||''),
    created:String(r[IDX.created]||''),updated:String(r[IDX.updated]||'')
  }))};
}

function validated_(raw) {
  if(!raw || typeof raw!=='object')throw new Error('신청서 데이터가 올바르지 않습니다.');
  const date=requireDate_(raw.date),rep=person_(raw.rep,'대표학생');
  const rawMembers=Array.isArray(raw.members)?raw.members:[];
  if(rawMembers.length>32)throw new Error('모둠원은 최대 32명까지 입력할 수 있습니다.');
  const ids=new Set([rep.id]);
  const members=rawMembers.map((x,i)=>{
    const m=person_(x,'모둠원 '+(i+1));
    if(ids.has(m.id))throw new Error('중복 학번이 있습니다: '+m.id);
    ids.add(m.id);return m;
  });
  const p=raw.plan||{};
  const plan={title:str_(p.title,200),purpose:str_(p.purpose,1800),
    method:str_(p.method,4000),safety:str_(p.safety,1600)};
  if(!plan.title||!plan.purpose||!plan.method)throw new Error('실험 주제, 탐구 목적, 실험 방법을 모두 입력하세요.');
  if(!Array.isArray(raw.buy)||raw.buy.length>50)throw new Error('구입 준비물은 최대 50개까지입니다.');
  const buy=raw.buy.map((s,i)=>{
    const name=str_(s.name,180),type=str_(s.type,180);
    const qty=int_(s.qty,'구입 준비물 '+(i+1)+' 수량',1,1000000);
    const price=int_(s.price,'구입 준비물 '+(i+1)+' 단가',0,1000000000);
    const link=str_(s.link,1200);
    if(!name||!type)throw new Error('구입 준비물 '+(i+1)+'의 품목명과 종류·규격을 모두 입력하세요.');
    if(!/^https:\/\/(?:[a-z0-9-]+\.)*gmarket\.co\.kr(?:[\/#?]|$)/i.test(link))
      throw new Error('구입 준비물 '+(i+1)+'의 G마켓 상품 링크를 확인하세요.');
    return {id:Utilities.getUuid(),name,type,qty,price,link,status:'NEEDED'};
  });
  if(!Array.isArray(raw.stock)||raw.stock.length>50)throw new Error('과학실 구비 준비물은 최대 50개까지입니다.');
  const stock=raw.stock.map((s,i)=>{
    const name=str_(s.name,180),type=str_(s.type,180);
    const qty=int_(s.qty,'과학실 구비 준비물 '+(i+1)+' 수량',1,1000000);
    if(!name)throw new Error('과학실 구비 준비물 '+(i+1)+'의 품목명을 입력하세요.');
    return {name,type,qty};
  });
  return {date,rep,members,plan,buy,stock};
}

function person_(v,label) {
  const id=str_(v&&v.id,10),name=str_(v&&v.name,50);
  if(!/^\d{5}$/.test(id))throw new Error(label+' 학번은 숫자 5자리로 입력하세요.');
  if(!name)throw new Error(label+' 이름을 입력하세요.');
  if(/^[=+@\-]/.test(name))throw new Error(label+' 이름 입력값을 확인하세요.');
  return {id,name};
}
function int_(n,label,min,max) {
  if(n===''||n===null||n===undefined||!Number.isSafeInteger(Number(n))||Number(n)<min||Number(n)>max)
    throw new Error(label+'은(는) '+min+' 이상 '+max+' 이하의 정수로 입력하세요.');
  return Number(n);
}
function str_(v,max) {return String(v===undefined||v===null?'':v).trim().slice(0,max);}
function requireDate_(v) {
  const d=String(v||'');
  if(!ALLOWED_SLOTS.some(x=>x[0]===d))throw new Error('선택한 날짜는 신청 가능 날짜가 아닙니다.');
  return d;
}
function ensureOpen_(date) {
  const slot=slots_().find(x=>x.date===date);
  if(!slot||!slot.enabled)throw new Error('신청을 받지 않는 날짜입니다.');
  // 실험 당일 00:00:00부터 마감, 전날 23:59:59까지 접수.
  if(now_()>=date+' 00:00:00')throw new Error('신청 마감: 실험 전날 23시 59분까지 접수 가능합니다.');
}
function slots_() {
  const sh=db_().getSheetByName('예약일정');
  const rows=sh.getRange(2,1,ALLOWED_SLOTS.length,4).getValues();
  return ALLOWED_SLOTS.map((x,i)=>({date:x[0],label:x[1],enabled:rows[i][2]===true,note:String(rows[i][3]||'')}));
}
function db_() {
  const id=PropertiesService.getScriptProperties().getProperty('LAB_DB_ID');
  if(!id)throw new Error('관리자가 아직 설치를 완료하지 않았습니다.');
  return SpreadsheetApp.openById(id);
}
function rows_(sh) {
  const last=sh.getLastRow();
  return last>1?sh.getRange(2,1,last-1,APPLICATION_HEADERS.length).getValues():[];
}
/** PIN 전체 공유 실패 카운터: 5회 실패 시 20분 제한. 비밀 값은 코드에 없음. */
function verifyAdminPin_(pin) {
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props=PropertiesService.getScriptProperties();
    const salt=props.getProperty('LAB_ADMIN_SALT');
    const saved=props.getProperty('LAB_ADMIN_HASH');
    if(!salt||!saved)throw new Error('관리자 PIN 설정이 필요합니다.');
    const now=Date.now();
    let windowStart=Number(props.getProperty('LAB_ADMIN_AUTH_WINDOW')||0);
    let fails=Number(props.getProperty('LAB_ADMIN_AUTH_FAILS')||0);
    if(!windowStart||now-windowStart>1200000) {windowStart=now;fails=0;}
    if(fails>=5)throw new Error('로그인 시도 횟수를 초과했습니다. 20분 뒤 다시 시도하세요.');
    const candidate=String(pin||'');
    if(!/^\d{4}$/.test(candidate)||hash_(salt+':'+candidate)!==saved) {
      props.setProperties({LAB_ADMIN_AUTH_WINDOW:String(windowStart),LAB_ADMIN_AUTH_FAILS:String(fails+1)});
      throw new Error(fails+1>=5?'로그인 시도 횟수를 초과했습니다. 20분 뒤 다시 시도하세요.':'교사용 비밀번호가 일치하지 않습니다.');
    }
    props.deleteProperty('LAB_ADMIN_AUTH_WINDOW');
    props.deleteProperty('LAB_ADMIN_AUTH_FAILS');
  } finally {lock.releaseLock();}
}
function requireTeacherSession_(session) {
  const token=String(session||'');
  if(!/^[a-f0-9-]{72}$/i.test(token) ||
     CacheService.getScriptCache().get('LAB_TEACHER_SESSION_'+token)!=='authorized')
    throw new Error('교사용 로그인 유효시간이 지났습니다. 다시 로그인하세요.');
}

function hash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8)
    .map(x=>('0'+(x<0?x+256:x).toString(16)).slice(-2)).join('');
}
function now_() {return Utilities.formatDate(new Date(),APP_TZ,'yyyy-MM-dd HH:mm:ss');}
function prevDay_(date) {
  const dt=new Date(date+'T00:00:00+09:00');dt.setUTCDate(dt.getUTCDate()-1);
  return Utilities.formatDate(dt,APP_TZ,'yyyy-MM-dd');
}
function json_(value,fallback) {try{return JSON.parse(String(value||''));}catch(e){return fallback;}}
function lock_(fn) {const lk=LockService.getScriptLock();lk.waitLock(20000);try{return fn();}finally{lk.releaseLock();}}
