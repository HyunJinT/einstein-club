/**
 * Einstein Club Booking API for GitHub Pages.
 * Deploy as Cloudflare Worker, bind a D1 database as DB,
 * set ADMIN_PIN as a Cloudflare Secret. Do not put PIN in GitHub.
 */
const WEB_ORIGIN='https://hyunjint.github.io';
const SLOTS=[
  ['2026-11-02','11월 2일(월) 방과후'],
  ['2026-11-04','11월 4일(수) 방과후'],
  ['2026-11-05','11월 5일(목) 방과후'],
  ['2026-11-06','11월 6일(금) 방과후'],
  ['2026-11-09','11월 9일(월) 방과후'],
  ['2026-11-10','11월 10일(화) 방과후']
];
const DECISIONS=['WAITING','APPROVED','NEEDS_EDIT','REJECTED'];
const BUY_STATES=['NEEDED','ORDERED','PURCHASED'];

function nowKST(){
  return new Intl.DateTimeFormat('sv-SE',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).format(new Date());
}
function prevDay(date){
  const shifted=new Date(Date.parse(date+'T00:00:00+09:00')-86400000);
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(shifted);
}
function str(value,max=1500){return String(value==null?'':value).trim().slice(0,max);}
function checkDate(date){
  const text=String(date||'');
  if(!SLOTS.some(s=>s[0]===text))throw Error('지정된 실험 날짜가 아닙니다.');
  return text;
}
function person(obj,label){
  const id=str(obj?.id,10),name=str(obj?.name,50);
  if(!/^\d{5}$/.test(id)||!name||/^[=+@\-]/.test(name))throw Error(label+' 학번 5자리와 이름을 확인하세요.');
  return {id,name};
}
function int(value,min,max,label){
  if(value===null||value===undefined||value===''||!Number.isSafeInteger(Number(value))||Number(value)<min||Number(value)>max)
    throw Error(label+'은(는) '+min+'~'+max+' 사이의 정수여야 합니다.');
  return Number(value);
}
function parseJSON(text,def){try{return JSON.parse(String(text||''))}catch{return def}}
function validate(raw){
  if(!raw||typeof raw!=='object')throw Error('신청서 내용이 비어 있습니다.');
  const date=checkDate(raw.date),rep=person(raw.rep,'대표학생');
  if(!Array.isArray(raw.members)||raw.members.length>32)throw Error('모둠원은 최대 32명입니다.');
  const ids=new Set([rep.id]);
  const members=raw.members.map((m,i)=>{
    const entry=person(m,'모둠원 '+(i+1));
    if(ids.has(entry.id))throw Error('모둠원 학번이 중복됩니다: '+entry.id);
    ids.add(entry.id);return entry;
  });
  const p=raw.plan||{};
  const plan={title:str(p.title,200),purpose:str(p.purpose,1800),method:str(p.method,4000),safety:str(p.safety,1600)};
  if(!plan.title||!plan.purpose||!plan.method)throw Error('실험 주제, 목적, 방법을 모두 작성하세요.');
  if(!Array.isArray(raw.buy)||raw.buy.length>50)throw Error('구입할 준비물은 최대 50개입니다.');
  const buy=raw.buy.map((v,i)=>{
    const name=str(v.name,180),type=str(v.type,180),link=str(v.link,1200);
    const qty=int(v.qty,1,1000000,'구매 수량'),price=int(v.price,0,1000000000,'구매 단가');
    if(!name||!type)throw Error('구입 준비물 '+(i+1)+'의 품목명·종류를 입력하세요.');
    if(!/^https:\/\/(?:[a-z0-9-]+\.)*gmarket\.co\.kr(?:[/?#]|$)/i.test(link))
      throw Error('구입 준비물 '+(i+1)+'의 G마켓 링크를 확인하세요.');
    return {id:crypto.randomUUID(),name,type,qty,price,link,status:'NEEDED'};
  });
  if(!Array.isArray(raw.stock)||raw.stock.length>50)throw Error('과학실 구비 준비물은 최대 50개입니다.');
  const stock=raw.stock.map((v,i)=>{
    const name=str(v.name,180),type=str(v.type,180),qty=int(v.qty,1,1000000,'구비 수량');
    if(!name)throw Error('과학실 구비 준비물 '+(i+1)+'의 품목명을 입력하세요.');
    return {name,type,qty};
  });
  return {date,rep,members,plan,buy,stock};
}
async function digest(text){
  const bytes=new TextEncoder().encode(text),hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function safeEq(a,b){
  const x=new TextEncoder().encode(String(a||'')),y=new TextEncoder().encode(String(b||''));
  let mismatch=x.length^y.length;
  for(let i=0;i<Math.max(x.length,y.length);i++)mismatch|=(x[i]||0)^(y[i]||0);
  return mismatch===0;
}
async function initialize(env){
  if(!env.DB)throw Error('Cloudflare D1 바인딩(DB)이 아직 연결되지 않았습니다.');
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS applications(
      id TEXT PRIMARY KEY,date TEXT NOT NULL,rep_id TEXT NOT NULL,rep_name TEXT NOT NULL,
      members_json TEXT NOT NULL,plan_json TEXT NOT NULL,buy_json TEXT NOT NULL,stock_json TEXT NOT NULL,
      decision TEXT NOT NULL DEFAULT 'WAITING',note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
      UNIQUE(date,rep_id))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS slot_overrides(
      date TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 1,note TEXT NOT NULL DEFAULT '')`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS teacher_sessions(
      token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS login_throttle(
      id INTEGER PRIMARY KEY CHECK(id=1),attempts INTEGER NOT NULL,window_start INTEGER NOT NULL)`)
  ]);
}
async function slots(env){
  const {results=[]}=await env.DB.prepare('SELECT date,enabled,note FROM slot_overrides').all();
  const changes=new Map(results.map(r=>[r.date,r]));
  const at=nowKST();
  return SLOTS.map(([date,label])=>{
    const change=changes.get(date),enabled=change?!!change.enabled:true;
    return {date,label,enabled,note:change?.note||'',deadline:prevDay(date)+' 23:59',open:enabled&&at<date+' 00:00:00'};
  });
}
async function publicConfig(env){return {now:nowKST(),slots:await slots(env)}}
async function teacherData(env){
  const {results=[]}=await env.DB.prepare('SELECT * FROM applications ORDER BY date,created_at').all();
  return {now:nowKST(),slots:await slots(env),records:results.map(r=>({
    id:r.id,date:r.date,rep:{id:r.rep_id,name:r.rep_name},
    members:parseJSON(r.members_json,[]),plan:parseJSON(r.plan_json,{}),
    buy:parseJSON(r.buy_json,[]),stock:parseJSON(r.stock_json,[]),
    decision:r.decision,note:r.note,created:r.created_at,updated:r.updated_at
  }))};
}
async function requireTeacher(env,token){
  if(!/^[a-f0-9]{64}$/.test(String(token||'')))throw Error('교사용 로그인 시간이 지났습니다. 다시 로그인하세요.');
  const item=await env.DB.prepare('SELECT expires_at FROM teacher_sessions WHERE token_hash=?').bind(await digest(token)).first();
  if(!item||item.expires_at<Date.now())throw Error('교사용 로그인 시간이 지났습니다. 다시 로그인하세요.');
}
async function teacherLogin(env,pin){
  if(!/^\d{4}$/.test(String(env.ADMIN_PIN||'')))throw Error('Cloudflare Secret ADMIN_PIN을 먼저 설정하세요.');
  const now=Date.now(),state=await env.DB.prepare('SELECT * FROM login_throttle WHERE id=1').first();
  let attempts=state&&now-state.window_start<1200000?state.attempts:0;
  const since=attempts?state.window_start:now;
  if(attempts>=5)throw Error('로그인 횟수 초과: 20분 뒤 다시 시도하세요.');
  if(!safeEq(String(pin||''),String(env.ADMIN_PIN))){
    attempts++;
    await env.DB.prepare('INSERT INTO login_throttle(id,attempts,window_start) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET attempts=excluded.attempts,window_start=excluded.window_start').bind(attempts,since).run();
    throw Error(attempts>=5?'로그인 횟수 초과: 20분 뒤 다시 시도하세요.':'교사용 비밀번호가 일치하지 않습니다.');
  }
  await env.DB.prepare('DELETE FROM login_throttle WHERE id=1').run();
  const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
  await env.DB.prepare('INSERT INTO teacher_sessions(token_hash,expires_at) VALUES(?,?)').bind(await digest(token),now+1800000).run();
  return {session:token,data:await teacherData(env)};
}
async function runMethod(env,method,args){
  const [a,b,c,d,e]=args;
  if(method==='publicConfig')return publicConfig(env);
  if(method==='submitApplication'){
    const item=validate(a);
    const selected=(await slots(env)).find(x=>x.date===item.date);
    if(!selected?.open)throw Error('신청 마감: 실험 전날 23:59까지 신청 가능합니다.');
    const at=nowKST(),id=crypto.randomUUID();
    try{
      await env.DB.prepare(`INSERT INTO applications(
        id,date,rep_id,rep_name,members_json,plan_json,buy_json,stock_json,decision,note,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
          id,item.date,item.rep.id,item.rep.name,JSON.stringify(item.members),
          JSON.stringify(item.plan),JSON.stringify(item.buy),JSON.stringify(item.stock),
          'WAITING','',at,at).run();
    }catch(error){
      if(/UNIQUE constraint failed/i.test(String(error)))throw Error('해당 날짜에 같은 대표 학번으로 이미 신청했습니다. 수정은 담당 교사에게 문의하세요.');
      throw error;
    }
    return {ok:true,date:item.date,rep:item.rep,submittedAt:at,message:'신청이 접수되었습니다. 담당 교사의 확인을 기다려주세요.'};
  }
  if(method==='teacherLogin')return teacherLogin(env,a);
  if(method==='teacherLogout'){
    if(/^[a-f0-9]{64}$/.test(String(a||'')))
      await env.DB.prepare('DELETE FROM teacher_sessions WHERE token_hash=?').bind(await digest(a)).run();
    return {ok:true};
  }
  if(method==='teacherRefresh'){await requireTeacher(env,a);return teacherData(env)}
  if(method==='teacherSetSlot'){
    await requireTeacher(env,a);const date=checkDate(b);
    await env.DB.prepare('INSERT INTO slot_overrides(date,enabled,note) VALUES(?,?,?) ON CONFLICT(date) DO UPDATE SET enabled=excluded.enabled,note=excluded.note')
      .bind(date,c?1:0,str(d,500)).run();
    return teacherData(env);
  }
  if(method==='teacherUpdateApplication'){
    await requireTeacher(env,a);
    if(!DECISIONS.includes(c))throw Error('올바르지 않은 승인 상태입니다.');
    const rec=await env.DB.prepare('SELECT buy_json FROM applications WHERE id=?').bind(String(b||'')).first();
    if(!rec)throw Error('신청서를 찾지 못했습니다.');
    const buy=parseJSON(rec.buy_json,[]);
    const mapping=new Map((Array.isArray(e)?e:[]).filter(x=>x&&BUY_STATES.includes(x.status)).map(x=>[String(x.id),x.status]));
    buy.forEach(x=>{if(mapping.has(x.id))x.status=mapping.get(x.id)});
    await env.DB.prepare('UPDATE applications SET decision=?,note=?,buy_json=?,updated_at=? WHERE id=?')
      .bind(c,str(d,1500),JSON.stringify(buy),nowKST(),String(b)).run();
    return teacherData(env);
  }
  throw Error('지원하지 않는 요청입니다.');
}
const cors={
  'Access-Control-Allow-Origin':WEB_ORIGIN,
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Max-Age':'600',
  'Vary':'Origin'
};
function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    ...cors,'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
  }});
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/health'&&request.method==='GET')
      return json({ok:true,message:'아인슈타인 신청 API 정상'});
    if(request.headers.get('Origin')!==WEB_ORIGIN)
      return json({ok:false,error:'허용되지 않은 사이트에서의 요청입니다.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(url.pathname!=='/api'||request.method!=='POST')return json({ok:false,error:'올바른 경로가 아닙니다.'},404);
    try{
      const raw=await request.text();
      if(raw.length>120000)return json({ok:false,error:'입력 내용이 너무 깁니다.'},413);
      const payload=JSON.parse(raw);
      if(!payload||typeof payload.method!=='string'||!Array.isArray(payload.args)||payload.args.length>6)
        throw Error('잘못된 요청입니다.');
      await initialize(env);
      const result=await runMethod(env,payload.method,payload.args);
      return json({ok:true,data:result});
    }catch(err){
      // Do not expose DB stack traces, SQL, or secret values.
      const msg=String(err?.message||'서버 오류');
      const known=/신청|학번|모둠원|실험|준비물|구입|G마켓|대표학생|로그인|비밀번호|설정|바인딩|날짜|수량|단가|마감|지원하지|요청|중복|시간|승인|찾지 못|올바르지|제한|비어|과학실/.test(msg);
      return json({ok:false,error:known?msg:'신청 서버 오류가 발생했습니다. 관리자에게 문의하세요.'},400);
    }
  }
};
