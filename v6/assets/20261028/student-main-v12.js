
(function(){'use strict';
const STEPS=['학생 정보','연구주제와 실험 기록','역할과 공동체 기여','성장과 후속 탐구','검토 및 앱에서 제출'];
const PROJECT_ROLES=['실험 주제 제안 및 선정','실험 계획 및 방법 설계','가설·변인 설정','이론 조사 및 자료 탐색','실험 준비 및 기구 관리','실험 수행 및 관찰','실험 데이터 기록 및 분석','결과 해석 및 오차 분석','실험보고서·발표자료 작성','발표 및 탐구 결과 공유','모둠원과 의견 조율','기타 역할'];
const EVIDENCES=[['problem','문제해결·개선','어떤 문제가 있었고, 원인을 어떻게 판단했으며, 직접 어떤 개선을 시도했나요?'],['self','자기주도적 시도','누가 지시하기 전에 스스로 조사하거나 제안하거나 실행한 일을 구체적으로 적어주세요.'],['data','자료 분석·근거 중심 사고','어떤 수치·표·그래프·관찰 기록을 어떻게 분석하고 결론을 내렸나요?'],['cooperate','협력·소통','다른 구성원과 어떤 상황에서 어떻게 협력하고 어떤 기여를 했나요?'],['responsibility','책임감·꾸준함','담당 업무를 끝까지 수행한 사례와 그로 인해 달라진 결과를 적어주세요.'],['curiosity','과학적 호기심·후속 탐구','새로운 의문이 생긴 계기와 실제로 알아본 내용을 적어주세요.']];
const STORAGE_KEY='einstein_2026_draft_v1', FORM_KEY='einstein_2026_formurl_v1';
const safeGet=k=>{try{return localStorage.getItem(k)}catch{return null}};
const safeSet=(k,v)=>{try{localStorage.setItem(k,v);return true}catch{return false}};
const safeRemove=k=>{try{localStorage.removeItem(k)}catch{}};
let seq=1, step=0, state=fresh(), activeProjectId=1, isSaved=false, toastTimer=null, checklist={pdf:false,original:false};
const IN_GAS=typeof google !== 'undefined' && !!(google.script && google.script.run);
let accessCode='', uploadFiles={report:[],poster:[]}, submitBusy=false, submitReceipt=null;
let verifiedStudent=null;
let serverRevision=0,saveTimer=null,saveInFlight=false,saveAgain=false,changeCounter=0,saveError=false;
let lastReceipt='',lastFiles=[],serverEditAllowed=true,lastServerSavedAt='',editingAfterSubmit=false;
let confirmedSharedPosterIds=[];
function statusText(message,isError){
 const el=$('serverSaveStatus');if(!el)return;
 el.textContent=message;el.style.color=isError?'#a53435':'#24646c';
 el.style.background=isError?'#fff3f2':'#f3fcfb';
}
function scheduleServerSave(){
 if(!verifiedStudent||!serverEditAllowed||submitBusy)return;
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveToServer(false),2600);
 statusText('변경 내용이 있습니다 · 잠시 후 서버에 자동저장합니다…');
}
async function saveToServer(manual){
 if(!verifiedStudent||!accessCode||!serverEditAllowed)return false;
 if(saveInFlight){saveAgain=true;return false;}
 clearTimeout(saveTimer);
 saveInFlight=true;saveAgain=false;
 const snapshot=JSON.parse(JSON.stringify(state)),seq=changeCounter;
 statusText('Google 서버에 저장 중…');
 try{
  const result=await gasCall('saveEinsteinDraftV10',accessCode,snapshot,serverRevision);
  serverRevision=result.revision;lastServerSavedAt=result.savedAt;saveError=false;
  if(seq===changeCounter){isSaved=true;statusText('✓ 서버 저장 완료 · '+result.savedAt+' · 다른 컴퓨터에서 이어쓰기 가능');}
  else{saveAgain=true;statusText('추가 변경 내용을 저장할 예정입니다…');}
  if(manual)notify('서버에 저장 완료되었습니다. 다른 컴퓨터에서 동일 코드로 이어 작성할 수 있습니다.');
  return true;
 }catch(e){
  saveError=true;statusText('서버 저장 실패: '+e.message+' · 백업 파일을 보관하세요.',true);
  if(manual)notify('서버 저장 실패: '+e.message);
  // If a different device has saved a newer revision, never overwrite it automatically.
  if(/다른 창이나 컴퓨터/.test(e.message))serverEditAllowed=false;
  return false;
 }finally{
  saveInFlight=false;if(saveAgain&&serverEditAllowed){saveAgain=false;scheduleServerSave();}
  renderNav();
 }
}
async function refreshServerDraft(){
 if(!verifiedStudent||!accessCode)return;
 if(!window.confirm('현재 화면의 작성 내용을 서버에 저장된 마지막 기록으로 교체할까요? 저장하지 않은 변경사항은 사라집니다.'))return;
 try{
  const v=await gasCall('lookupEinsteinStudentByCode',accessCode);
  if(v.draft){state=cloneFromStorage(v.draft);state.studentId=verifiedStudent.studentId;state.name=verifiedStudent.name;state.position=verifiedStudent.leader?'모둠 조장':state.position;}
  serverRevision=Number(v.revision)||0;serverEditAllowed=!!v.canEdit;
  lastReceipt=v.receipt||'';lastFiles=Array.isArray(v.submittedFiles)?v.submittedFiles:[];
  lastServerSavedAt=v.savedAt||'';changeCounter++;editingAfterSubmit=!!(v.submitted&&state.editingSubmissionDraft);step=(v.submitted&&!editingAfterSubmit)?4:Math.min(4,Math.max(0,Number(state.resumeStep)||0));activeProjectId=state.projects.some(p=>p.id===Number(state.resumeProjectId))?Number(state.resumeProjectId):state.projects[0].id;editingAfterSubmit=false;submitReceipt=null;render();restoreLastEditedField();
  statusText(v.savedAt?'✓ 서버 기록 불러옴 · '+v.savedAt:'서버에 저장된 작성 기록이 없습니다.');
 }catch(e){statusText('서버 기록 조회 실패: '+e.message,true);}
}
window.addEventListener('einstein:verified',function(e){
 const v=e.detail;
 verifiedStudent={studentId:v.studentId,name:v.name,leader:v.leader};
 accessCode=v.code; serverRevision=Number(v.revision)||0;
 lastReceipt=v.receipt||'';lastFiles=Array.isArray(v.submittedFiles)?v.submittedFiles:[];
 serverEditAllowed=!!v.canEdit;lastServerSavedAt=v.savedAt||'';
 state=v.draft?cloneFromStorage(v.draft):fresh();
 state.studentId=v.studentId;state.name=v.name;
 if(v.leader)state.position='모둠 조장';
 editingAfterSubmit=!!(v.submitted&&state.editingSubmissionDraft);step=(v.submitted&&!editingAfterSubmit)?4:Math.min(4,Math.max(0,Number(state.resumeStep)||0));activeProjectId=state.projects.some(p=>p.id===Number(state.resumeProjectId))?Number(state.resumeProjectId):state.projects[0].id;isSaved=!!v.draft;submitReceipt=null;
 render();restoreLastEditedField();
 statusText(serverEditAllowed?(v.draft?'✓ 서버에 저장된 이전 작성 내용을 불러왔습니다'+(v.savedAt?' · '+v.savedAt:''):'처음 작성하는 학생입니다. 입력 후 약 3초면 서버에 자동저장됩니다.'):'제출 기한이 지나 읽기만 가능합니다.',!serverEditAllowed);
});


function restoreLastEditedField(){
 const f=state.resumeField;
 if(!f||!verifiedStudent||(lastReceipt&&!editingAfterSubmit))return;
 setTimeout(()=>{
  const matches=[...document.querySelectorAll('input[data-field],textarea[data-field],textarea[data-role-note],textarea[data-evidence-note],select[data-field]')];
  const el=matches.find(x=>String(x.dataset.field||'')===String(f.field||'')&&
    String(x.dataset.project||'')===String(f.project||'')&&
    String(x.dataset.roleNote||'')===String(f.roleNote||'')&&
    String(x.dataset.evidenceNote||'')===String(f.evidenceNote||'')&&
    String(x.dataset.role||'')===String(f.role||''));
  if(el)el.scrollIntoView({block:'center',behavior:'auto'});
 },120);
}

function makeProject(){return {id:seq++,title:'',mode:'모둠 탐구',team:'',question:'',motivation:'',hypothesis:'',design:'',results:'',analysis:'',challenge:'',nextTry:'',summary:'',themeLink:'',roles:[],roleNotes:{}};}
function fresh(){return {resumeStep:0,resumeProjectId:1,resumeField:null,editingSubmissionDraft:false,excludedFileUrls:[],year:'2026',studentId:'',name:'',careerGoal:'',position:'직책 없음',positionWork:'',researchTheme:'',researchQuestion:'',themeConnection:'',projects:[makeProject()],evidence:[],evidenceNotes:{},growthConcept:'',growthChange:'',followup:'',futurePlan:'',otherContribution:'',teacherNote:'',confirmed:false};}
const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;const txt=(field,placeholder='',rows=3,extra='')=>`<textarea class="text-area ${rows===2?'short':''}" rows="${rows}" placeholder="${esc(placeholder)}" ${extra}>${esc(field)}</textarea>`;
const field=(label,body,{required=false,hint='',full=false}={})=>`<div class="field ${full?'full':''}"><label class="question-label">${label}${required?'<span class="req"> *</span>':''}</label>${hint?`<p class="hint">${hint}</p>`:''}${body}</div>`;
function notify(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3100);}
function completion(){let ticks=[!!(/^\d{5}$/.test(state.studentId)&&state.name.trim()&&state.careerGoal.trim()),!!(state.researchTheme.trim()&&state.researchQuestion.trim()&&state.projects.length&&state.projects.every(p=>p.title.trim()&&p.summary.trim()&&p.roles.length&&p.roles.every(r=>(p.roleNotes[r]||'').trim()))),!!(state.evidence.length&&state.evidence.every(k=>(state.evidenceNotes[k]||'').trim())),!!(state.growthConcept.trim()&&state.growthChange.trim()),!!state.confirmed];return Math.round(ticks.filter(Boolean).length/5*100);}
function renderNav(){const err=errors();$('navSteps').innerHTML=STEPS.map((s,i)=>`<button type="button" class="nav-step ${step===i?'active':''} ${i<step&&!err.some(e=>e.step===i)?'done':''}" data-go="${i}"><span class="n">${i<step&&!err.some(e=>e.step===i)?'✓':i+1}</span><span>${esc(s)}</span></button>`).join('');$('stepTitle').textContent=STEPS[step];$('progressText').textContent=`${step+1} / 5단계`;$('progressFill').style.width=`${(step+1)*20}%`;$('completionText').innerHTML=`${isSaved?'임시저장됨':'이 기기에서 작성 중'} · <strong>${completion()}%</strong> 작성`;}
const footer=(prev,nextLabel='다음 단계 →')=>`<div class="section-actions"><button class="btn" data-go="${prev}">${prev<0?'처음으로':'← 이전 단계'}</button>${step<4?`<button class="btn primary" data-go="${step+1}">${nextLabel}</button>`:''}</div>`;
function title(n,h,desc){return `<div class="section-title"><div class="step-number">${n}</div><div><h2>${h}</h2><p>${desc}</p></div></div>`;}
function step0(){return `<section class="content-card">${title('01','나의 기록 시작하기','기본 정보는 PDF의 제목 및 파일명에 사용됩니다.')}
<div class="info-box">동아리활동 특기사항을 작성하기 위한 참고자료입니다. 과장된 표현보다 실제로 한 행동과 확인 가능한 탐구 결과를 작성하세요.</div>
<div class="fields">${field('학번',`<input class="text-input" data-field="studentId" maxlength="5" readonly aria-readonly="true" inputmode="numeric" placeholder="예: 20000" value="${attr(state.studentId)}"/>`,{required:true,hint:'숫자 5자리로 입력하세요.'})}${field('이름',`<input class="text-input" data-field="name" maxlength="20" readonly aria-readonly="true" placeholder="이름" value="${attr(state.name)}"/>`,{required:true})}</div>
<div class="career-field">${field('희망 진로 분야',`<input class="text-input" data-field="careerGoal" maxlength="150" value="${attr(state.careerGoal)}" placeholder="예: 의생명·바이오 / 화학·소재 / 기계·전자공학 / 미정"/>`,{required:true,hint:'현재 관심 있는 분야를 자유롭게 작성하세요. 정하지 않았다면 ‘미정’ 또는 ‘탐색 중’이라고 입력하세요.'})}</div>
<div class="mini-rule"></div><h3 style="font-size:16px;margin:0 0 9px">작성 안내</h3><div class="highlight-box"><strong>좋은 답변의 기준</strong><br>① 무엇을 했는지 ② 왜 그렇게 했는지 ③ 어떤 관찰·자료를 얻었는지 ④ 그로부터 어떻게 생각이 달라졌는지를 구체적으로 작성하면 좋습니다.</div>
<div class="privacy"><strong>개인정보·임시저장 주의</strong><br>입력 내용은 잠시 후 Google 서버에 자동저장됩니다. 상태에 '서버 저장 완료'가 나타났는지 확인하세요. 코드만으로 다른 컴퓨터에서 이어 쓸 수 있습니다. 최종 제출은 별도 버튼을 눌러 접수번호를 받아야 합니다. 공용 컴퓨터에서는 사용 후 창을 닫으세요.</div>${footer(-1)}</section>`;}
function projectTemplate(p,index){return `<section class="subcard" data-project-card="${p.id}"><div class="subcard-head"><h3><span class="num">실험 ${index+1}</span>개별 실험·탐구 기록</h3><div class="card-tools">${state.projects.length>1?`<button type="button" class="btn danger" data-remove-project="${p.id}">삭제</button>`:''}</div></div>
<div class="fields">${field('실험·탐구 제목',`<input class="text-input" data-project="${p.id}" data-field="title" value="${attr(p.title)}" placeholder="예: 온도에 따른 효소 활성 비교"/>`,{required:true})}${field('탐구 형태',`<select class="select" data-project="${p.id}" data-field="mode">${['모둠 탐구','개별 탐구','모둠+개별 탐구'].map(x=>`<option ${p.mode===x?'selected':''}>${x}</option>`).join('')}</select>`,{required:true})}${field('모둠명 또는 협력 학생 (선택)',`<input class="text-input" data-project="${p.id}" data-field="team" value="${attr(p.team)}" placeholder="예: 3모둠 / 개별탐구면 생략"/>`)}</div>
${field('이 실험에서 실제로 수행한 역할을 모두 선택하세요.',`<div class="role-list">${PROJECT_ROLES.map(r=>`<div class="role-choice ${p.roles.includes(r)?'selected':''}"><label class="role-item"><input type="checkbox" data-project-role="${p.id}" value="${attr(r)}" ${p.roles.includes(r)?'checked':''}/><span>${esc(r)}</span></label><div class="role-inline-editor" data-role-editor="${p.id}" data-role="${attr(r)}" ${p.roles.includes(r)?'':'hidden'}><div class="role-detail-title">↳ 내가 실제로 수행한 일 <span class="req">*</span></div>${txt(p.roleNotes[r]||'', '내가 무엇을, 어떻게 수행했는지 구체적으로 적으세요.',2,`data-role-note="${p.id}" data-role="${attr(r)}"`)}</div></div>`).join('')}</div>`,{required:true,hint:'선택한 항목 바로 아래에 설명칸이 열립니다. 실제 맡은 역할만 선택해 주세요.'})}
${field('이 실험에서 얻은 핵심 결과나 배움을 적어주세요.',txt(p.summary,'실제 관찰·측정 결과와 그 의미를 중심으로 작성해 주세요. 여러 실험을 했다면 각각 구분하여 작성합니다.',3,`data-project="${p.id}" data-field="summary"`),{required:true})}
${field('이 실험은 위의 큰 연구주제·질문과 어떻게 연결되나요? (선택)',txt(p.themeLink,'예: 큰 질문의 어떤 측면을 이 실험에서 확인했나요? 실제로 관련이 있는 경우에만 작성하세요.',2,`data-project="${p.id}" data-field="themeLink"`),{hint:'서로 다른 분야의 실험을 무리하게 연결할 필요는 없습니다.'})}
<details class="more-research" ${[p.question,p.motivation,p.hypothesis,p.design,p.results,p.analysis,p.challenge,p.nextTry].some(x=>String(x||'').trim())?'open':''}><summary>＋ 이 실험의 탐구 과정을 더 자세히 기록하기 (선택)</summary><p class="hint">가설, 실험 설계, 측정 결과, 오차 분석 등 실제 작성할 내용이 있는 항목만 채워 주세요.</p>
${field('이 실험에서 확인하고 싶었던 구체적인 질문',txt(p.question,'예: 과산화수소의 농도에 따라 효소 반응 속도가 달라질까?',3,`data-project="${p.id}" data-field="question"`))}
${field('그 질문에 관심을 갖게 된 계기',txt(p.motivation,'관찰한 현상이나 수업에서 배운 개념 등을 연결해 주세요.',3,`data-project="${p.id}" data-field="motivation"`))}
${field('검증하고자 했던 가설',txt(p.hypothesis,'가설을 세운 경우에만 과학적 근거와 함께 작성하세요.',2,`data-project="${p.id}" data-field="hypothesis"`))}
${field('실험 설계와 조건',txt(p.design,'조작·종속·통제변인, 비교 조건과 측정 방법 등',3,`data-project="${p.id}" data-field="design"`))}
${field('관찰·측정 결과',txt(p.results,'측정값, 횟수, 단위, 그래프 경향 등 구체적인 근거',3,`data-project="${p.id}" data-field="results"`))}
${field('결과에 대한 과학적 해석',txt(p.analysis,'과학 개념과 자료를 연결하여 작성하세요.',3,`data-project="${p.id}" data-field="analysis"`))}
${field('실험의 한계·어려움·예상 밖 결과',txt(p.challenge,'실제로 경험한 어려움과 발생 상황을 적어 주세요.',3,`data-project="${p.id}" data-field="challenge"`))}
${field('문제 분석·개선 과정 또는 개선 제안',txt(p.nextTry,'실제로 수행한 개선과 앞으로 해 보고 싶은 제안을 구분해 주세요.',3,`data-project="${p.id}" data-field="nextTry"`))}
</details></section>`;}
function experimentHub(){return `<div class="experiment-hub" aria-label="실험별 기록 관리"><div class="experiment-hub-head"><h3>나의 실험 목록 <span class="experiment-count">${state.projects.length}개</span></h3><button type="button" class="btn" data-add-project="true" ${state.projects.length>=20?'disabled':''}>＋ 새 실험 추가하기</button></div><p class="experiment-hub-note">실험을 추가하려면 위 버튼을 누르세요. 아래 실험 이름을 선택하면 해당 실험의 작성 화면으로 바뀝니다. 작성 내용은 서로 섞이지 않습니다.</p><div class="experiment-tabs" role="group" aria-label="작성할 실험 선택">${state.projects.map((p,i)=>{const ok=!!(p.title.trim()&&p.summary.trim()&&p.roles.length&&p.roles.every(r=>(p.roleNotes[r]||'').trim()));return `<button type="button" class="experiment-tab" data-select-project="${p.id}" aria-pressed="${(state.projects.some(x=>x.id===activeProjectId)?activeProjectId:state.projects[0].id)===p.id}" title="${attr(p.title||`실험 ${i+1}`)}"><strong>${esc('실험 '+(i+1))}${p.title?' · '+esc(p.title):''}</strong><span class="tab-sub">${ok?'✓ 필수 내용 완료':'● 작성 중 / 미작성'}</span></button>`;}).join('')}</div><div class="experiment-current">현재 편집: <strong>실험 ${Math.max(1,state.projects.findIndex(p=>p.id===activeProjectId)+1)} / ${state.projects.length}</strong> · 다른 실험으로 이동해도 입력 내용은 유지됩니다.</div></div>`;}
function step1(){return `<section class="content-card">${title('02','통합 연구주제와 실험 기록','먼저 여러 실험을 관통하는 큰 연구주제·질문을 정리하고, 그 아래 개별 실험을 기록하세요.')}
<div class="theme-panel"><div class="theme-heading">◎ 1년간의 큰 연구 방향</div><p class="theme-caption">특정 실험 하나를 '대표 실험'으로 고르는 대신, 여러 활동에서 공통으로 탐색한 상위 주제와 질문을 기록합니다.</p>
${field('동아리 활동을 아우르는 큰 연구주제',`<input class="text-input" data-field="researchTheme" value="${attr(state.researchTheme)}" placeholder="예: 생명체의 물질대사를 변화시키는 환경 조건"/>`,{required:true,hint:'실험 제목을 나열하지 말고, 여러 탐구의 공통 관심사를 한 문장 또는 구로 표현해 주세요.'})}
${field('위 연구주제를 관통하는 중심 연구질문',txt(state.researchQuestion,'예: 외부 환경의 변화는 생명체의 물질대사와 효소 작용에 어떤 영향을 미칠까?',3,'data-field="researchQuestion"'),{required:true,hint:'각 실험이 서로 다른 방식으로 접근하는 큰 질문을 의문문으로 작성해 보세요.'})}
${field('여러 실험이 이 주제로 이어지는 이유나 탐구의 흐름 (선택)',txt(state.themeConnection,'예: 첫 번째 실험에서는 효소의 반응 조건을, 두 번째 실험에서는 미생물의 대사 반응을 비교했다.',3,'data-field="themeConnection"'),{hint:'실제로 관련 있는 실험들을 중심으로 연결하세요. 성격이 다른 활동을 억지로 엮을 필요는 없습니다.'})}</div>
<div class="info-box">실험은 <b>1개만 작성해도 되고</b>, 1년 동안 참여한 모둠·개별 실험을 원하는 만큼 추가할 수 있습니다. <b>각 실험별로 제목·역할·결과를 따로 저장</b>하며, 마지막 PDF에는 기록한 모든 실험이 순서대로 포함됩니다.</div>
${experimentHub()}
<div id="projectList" class="experiment-edit">${projectTemplate(state.projects.find(p=>p.id===activeProjectId)||state.projects[0], state.projects.findIndex(p=>p.id===activeProjectId) < 0 ? 0 : state.projects.findIndex(p=>p.id===activeProjectId))}</div>
<div class="experiment-bottom"><button type="button" class="btn" data-add-project="true" ${state.projects.length>=20?'disabled':''}>＋ 다른 실험도 추가하기</button><span class="hint">현재 ${state.projects.length}개 기록 중 · 최대 20개</span></div>${footer(0)}</section>`;}
function step2(){const ev=EVIDENCES.map(([k,t,desc])=>`<div class="evidence-choice ${state.evidence.includes(k)?'selected':''}"><label class="evidence-item"><input type="checkbox" data-evidence="${k}" ${state.evidence.includes(k)?'checked':''}/><span>${esc(t)}</span></label><div class="evidence-inline-editor" data-evidence-editor="${k}" ${state.evidence.includes(k)?'':'hidden'}><div class="role-detail-title">↳ ${esc(t)} · 확인 가능한 실제 사례 <span class="req">*</span></div><p class="hint">${esc(desc)}</p>${txt(state.evidenceNotes[k]||'','자신의 행동과 그 결과가 드러나도록 적어주세요.',3,`data-evidence-note="${k}"`)}</div></div>`).join('');return `<section class="content-card">${title('03','역할과 공동체 기여','직책이나 스스로 평가한 역량보다 실제로 드러난 행동을 기록합니다.')}
<div class="fields">${field('동아리에서 맡은 직책',`<select class="select" data-field="position">${['직책 없음','회장','부회장','모둠 조장','기타'].map(s=>`<option ${state.position===s?'selected':''}>${s}</option>`).join('')}</select>`,{hint:'직책 자체가 역량을 증명하는 것은 아닙니다.'})}</div>
${state.position!=='직책 없음'?field('그 직책에서 실제로 한 일을 작성하세요.',txt(state.positionWork,'직책을 수행하며 실제 담당했던 일만 구체적으로 적어주세요. 특별한 사례가 없다면 그 사실을 솔직히 적어도 됩니다.',3,`data-field="positionWork"`)):''}
<div class="mini-rule"></div>${field('올해 실제 경험한 활동의 특성을 선택하세요. (최대 3개)',`<div class="evidence-grid">${ev}</div>`,{required:true,hint:'자신에게 나타났다고 생각하는 역량을 고르는 것이 아니라, 구체적인 사례가 있는 항목만 선택하세요.'})}
<div class="mini-rule"></div>${field('모둠 외의 동아리 활동에서 기여한 일이나 협력 경험 (선택)',txt(state.otherContribution,'활동 준비·정리, 친구의 탐구 지원, 자료 공유, 발표회 참여 등 확인 가능한 사례를 작성하세요.',3,`data-field="otherContribution"`),{hint:'개별 탐구만 진행했다면 비워도 됩니다. 갈등이나 리더십 사례를 만들어 쓸 필요는 없습니다.'})}${footer(1)}</section>`;}
function step3(){return `<section class="content-card">${title('04','성장과 후속 탐구','실험 전후 달라진 과학적 이해와 탐구 방법을 돌아봅니다.')}
${field('새롭게 이해하거나 생각이 바뀐 과학적 개념은 무엇인가요?',txt(state.growthConcept,'실험 결과와 연결하여 개념을 구체적으로 설명하세요. 예: 단순 암기가 아니라 결과를 통해 무엇을 다시 이해했는가?',4,`data-field="growthConcept"`),{required:true})}
${field('1년 동안 자신의 탐구 방식이나 태도가 어떻게 달라졌나요?',txt(state.growthChange,'처음에는 어떻게 탐구했으며, 어떤 경험을 거쳐 어떤 방식으로 달라졌는지 사례를 들어 적어주세요.',4,`data-field="growthChange"`),{required:true})}
${field('새롭게 생긴 질문이나 더 알아보고 싶은 주제 (선택)',txt(state.followup,'실험에서 새롭게 생긴 의문 또는 확인하지 못한 점을 질문 형태로 적어보세요.',3,`data-field="followup"`))}
${field('그 질문을 확인하려면 어떤 후속 탐구를 계획할 수 있나요? (선택)',txt(state.futurePlan,'실제로 수행한 후속 탐구와 앞으로 해 보고 싶은 계획은 구분하여 적어주세요.',3,`data-field="futurePlan"`))}
${field('교사가 놓치지 않았으면 하는 실제 활동이나 기록 (선택)',txt(state.teacherNote,'앞서 작성하지 못한 활동만 구체적인 근거와 함께 적어주세요.',3,`data-field="teacherNote"`))}
<div class="highlight-box"><strong>작성 팁</strong><br>“탐구역량이 향상되었다”보다 “예상과 다른 측정값을 얻은 뒤 반복 측정을 실시하고 통제변인을 다시 검토했다”처럼 확인 가능한 행동을 쓰는 편이 좋습니다.</div>${footer(2,'검토 화면으로 →')}</section>`;}
function paragraph(label,value){if(!String(value||'').trim())return '';return `<div class="paper-line"><strong>${esc(label)}</strong><p>${esc(value)}</p></div>`;}
function paperHTML(){let output=`<div class="paper"><div class="paper-head"><small>2026학년도 과학동아리 아인슈타인</small><h2>동아리 활동 기록 및 자기 성찰</h2><small>학번 ${esc(state.studentId||'미입력')} · 이름 ${esc(state.name||'미입력')} · 작성일 ${new Date().toLocaleDateString('ko-KR')}</small><div class="paper-profile"><b>희망 진로 분야</b> · ${esc(state.careerGoal.trim()||'미정')}</div></div>`;
output+=`<section class="paper-section"><h3>00. 학생 기본 정보</h3>`+paragraph('학번',state.studentId)+paragraph('이름',state.name)+paragraph('희망 진로 분야',state.careerGoal)+'</section>';
output+=`<section class="paper-section"><h3>01. 동아리 통합 연구주제와 중심 질문</h3>`+paragraph('1년간의 큰 연구주제',state.researchTheme)+paragraph('중심 연구질문',state.researchQuestion)+paragraph('여러 실험의 연결과 탐구 흐름',state.themeConnection)+'</section>';
output+=`<section class="paper-section"><h3>02. 참여한 개별 실험·탐구활동</h3>`;
state.projects.forEach((p,i)=>{output+=`<div class="paper-subhead">${i+1}. ${esc(p.title||'제목 미입력')}</div>`;output+=paragraph('탐구 형태',p.mode+(p.team?' / 모둠: '+p.team:''));output+=paragraph('주요 결과 및 배움',p.summary)+paragraph('큰 연구주제와의 연결',p.themeLink)+paragraph('이 실험의 구체적 연구질문',p.question)+paragraph('탐구 동기',p.motivation)+paragraph('가설',p.hypothesis)+paragraph('실험 설계 및 조건',p.design)+paragraph('관찰·측정 결과',p.results)+paragraph('결과 해석 및 과학적 근거',p.analysis)+paragraph('실험의 한계·어려움',p.challenge)+paragraph('분석·개선 과정',p.nextTry);output+=`<div class="paper-line"><strong>실제 수행한 역할 및 기여</strong>${p.roles.length?p.roles.map(r=>`<p>• <b>${esc(r)}</b> — ${esc(p.roleNotes[r]||'설명 미작성')}</p>`).join(''):'<p>선택한 역할 없음</p>'}</div>`;});output+='</section>';
output+=`<section class="paper-section"><h3>03. 동아리 내 역할과 공동체 기여</h3>`+paragraph('맡은 직책',state.position)+paragraph('직책에서 수행한 일',state.positionWork);for(const k of state.evidence){const item=EVIDENCES.find(x=>x[0]===k);output+=paragraph(item?item[1]:k,state.evidenceNotes[k]);}output+=paragraph('추가적인 협력과 기여',state.otherContribution)+'</section>';
output+=`<section class="paper-section"><h3>04. 과학적 성장과 탐구의 확장</h3>`+paragraph('새롭게 이해한 과학 개념',state.growthConcept)+paragraph('탐구 방식과 태도의 변화',state.growthChange)+paragraph('새롭게 생긴 탐구 질문',state.followup)+paragraph('후속 탐구 계획',state.futurePlan)+paragraph('추가 활동·기록',state.teacherNote)+'</section>';
return output+`<div style="font-size:10px;color:#789; margin-top:24px;padding-top:10px;border-top:1px solid #d7e2e8">본 기록은 학생이 직접 작성한 자기 성찰 자료입니다. 학교생활기록부 기재 여부와 내용은 제출 자료 및 교사의 관찰·확인을 거쳐 결정됩니다.</div></div>`;}
function errors(){
 const arr=[];
 const add=(st,msg,field='',projectId=null,role='',kind='')=>arr.push({step:st,msg,field,projectId,role,kind});
 if(!/^\d{5}$/.test(state.studentId))add(0,'학번을 숫자 5자리로 입력하세요.','studentId');
 if(!state.name.trim())add(0,'이름을 입력하세요.','name');
 if(!state.careerGoal.trim())add(0,'희망 진로 분야를 입력하세요. 정하지 않았다면 ‘미정’이라고 적어주세요.','careerGoal');
 if(!state.researchTheme.trim())add(1,'여러 실험을 아우르는 큰 연구주제를 입력하세요.','researchTheme');
 if(!state.researchQuestion.trim())add(1,'통합 연구주제를 관통하는 중심 연구질문을 입력하세요.','researchQuestion');
 state.projects.forEach((p,i)=>{
  const pre=`실험 ${i+1}`;
  if(!p.title.trim())add(1,`${pre}: 탐구 제목을 입력하세요.`,'title',p.id);
  if(!p.summary.trim())add(1,`${pre}: 핵심 결과나 배움을 작성하세요.`,'summary',p.id);
  if(!p.roles.length)add(1,`${pre}: 실제 수행한 역할을 1개 이상 선택하세요.`,'',p.id,'','roles');
  p.roles.forEach(r=>{if(!(p.roleNotes[r]||'').trim())add(1,`${pre}: ‘${r}’에 대한 구체적인 설명을 입력하세요.`,'',p.id,r,'roleNote');});
 });
 if(!state.evidence.length)add(2,'실제 사례가 있는 역량·활동 특성을 1개 이상 선택하세요.','','','','evidence');
 state.evidence.forEach(k=>{if(!(state.evidenceNotes[k]||'').trim()){
  const t=EVIDENCES.find(e=>e[0]===k)?.[1]||k;
  add(2,`‘${t}’의 구체적인 사례를 입력하세요.`,'','','','evidenceNote:'+k);
 }});
 if(!state.growthConcept.trim())add(3,'새롭게 이해한 과학 개념을 작성하세요.','growthConcept');
 if(!state.growthChange.trim())add(3,'탐구 태도 또는 방법의 변화를 작성하세요.','growthChange');
 return arr;
}
function missingInput(err){
 if(err.kind==='roles')return document.querySelector(`input[data-project-role="${err.projectId}"]`);
 if(err.kind==='roleNote')return Array.from(document.querySelectorAll(`textarea[data-role-note="${err.projectId}"]`)).find(el=>el.dataset.role===err.role)||null;
 if(err.kind==='evidence')return document.querySelector('input[data-evidence]');
 if(err.kind.startsWith('evidenceNote:'))return document.querySelector(`textarea[data-evidence-note="${err.kind.slice(13)}"]`);
 if(err.projectId!==null)return document.querySelector(`[data-project="${err.projectId}"][data-field="${err.field}"]`);
 if(err.field)return document.querySelector(`[data-field="${err.field}"]`);
 return null;
}
function showMissingOnStep(s,items){
 const here=items.filter(e=>e.step===s),host=$('stepContent');
 if(!here.length)return;
 const old=$('stepValidation');if(old)old.remove();
 const panel=document.createElement('div');panel.id='stepValidation';panel.className='error-list step-validation';
 panel.setAttribute('role','alert');
 panel.innerHTML=`<h3>필수 입력 ${here.length}곳이 남아 있어 다음 단계로 이동할 수 없습니다.</h3><p class="hint">아래 항목을 작성한 뒤 다시 [다음 단계]를 눌러주세요.</p><ul>${here.map(e=>`<li>${esc(e.msg)}</li>`).join('')}</ul>`;
 host.prepend(panel);
 const input=missingInput(here[0]);
 if(input){input.closest('.field, .evidence-inline-editor, .evidence-choice, .role-inline-editor, .role-choice, .theme-panel')?.classList.add('missing-required');}
 if(input){try{input.focus({preventScroll:true});input.scrollIntoView({behavior:'smooth',block:'center'});}catch{panel.scrollIntoView({behavior:'smooth',block:'start'});}}
 else panel.scrollIntoView({behavior:'smooth',block:'start'});
 notify(`필수 입력 ${here.length}곳을 모두 작성해야 다음 단계로 이동합니다.`);
}
function renderErrors(){const e=errors();return e.length?`<div class="error-list"><h3>작성 내용 ${e.length}곳을 확인해 주세요</h3>${e.map(x=>`<button data-go="${x.step}">• ${esc(x.msg)} → 해당 단계로 이동</button>`).join('')}</div>`:`<div class="highlight-box">✓ 필수 작성 항목이 모두 채워졌습니다. 아래 내용이 정확한지 확인한 뒤 PDF로 저장하세요.</div>`;}
function step4(){const formUrl=DEFAULT_FORM_URL||safeGet(FORM_KEY)||'';return `<section class="content-card">${title('05','최종 검토 및 PDF 저장','학생이 입력한 내용이 A4 보고서 형식으로 정리됩니다.')}
${renderErrors()}
<div class="field"><label class="question-label">보고서 미리보기</label><p class="hint">PDF에는 학번·이름·희망 진로와 각 실험, 역할별 설명, 선택 문항까지 작성한 모든 답변이 함께 담깁니다. 내용이 길면 페이지가 자동으로 추가됩니다. 인쇄용 PDF는 텍스트 선택·복사가 가능합니다.</p><div class="review-preview" id="reviewPreview">${paperHTML()}</div></div>
<div class="mini-rule"></div><label class="switch"><input type="checkbox" id="confirmCheck" ${state.confirmed?'checked':''}/><span>위 기록이 실제 동아리활동에 근거한 내용이며, 제출 전 누락·오탈자·과장된 표현을 확인했습니다. <span class="req">*</span></span></label>
<div class="section-actions"><button class="btn" data-go="3">← 수정하러 가기</button><div class="footer-actions"><button class="btn" id="printPdfBtn">▤ 인쇄용 PDF (텍스트 복사 가능)</button><button class="btn primary" id="downloadPdfBtn">↓ PDF 파일 바로 저장</button></div></div>
<div class="info-box" style="margin-top:17px"><b>PDF 방식 안내:</b> ‘PDF 파일 바로 저장’은 버튼 한 번으로 다운로드되는 이미지형 PDF입니다. 교사가 PDF 안의 문장을 복사해야 한다면 ‘인쇄용 PDF’를 눌러 브라우저 인쇄 창에서 <b>PDF로 저장</b>을 선택하세요. 두 방식 모두 인터넷 없이 작동합니다.</div>
</section>
${submitPanel()}
<section class="content-card"><button class="btn danger" id="resetBtn">작성내용 모두 삭제</button></section>`;}

function excludedSubmittedUrls(){return Array.isArray(state.excludedFileUrls)?state.excludedFileUrls:[];}
function submittedFileCards(kind){
 if(!lastFiles.length)return '<p class="hint">아직 제출된 첨부파일이 없습니다.</p>';
 const excluded=excludedSubmittedUrls();
 return lastFiles.filter(f=>!kind||f.kind===kind).map((f,i)=>{
  const gone=excluded.includes(f.url);
  return '<div class="existing-upload '+(gone?'excluded':'')+'"><button type="button" class="existing-file-open" data-view-upload="'+attr(f.url)+'" '+(gone?'disabled':'')+' title="파일 열어보기">📎 '+esc(f.kind==='poster'?'[포스터] ':'[보고서] ')+esc(f.name)+'</button><span class="hint">'+(Number(f.size||0)/1048576).toFixed(1)+' MB</span><button class="existing-file-remove" type="button" data-toggle-upload="'+attr(f.url)+'" title="'+(gone?'제외 취소':'수정 제출에서 제외')+'">'+(gone?'↶ 되돌리기':'×')+'</button>'+(gone?'<span class="hint">다음 수정 제출에서 제외 예정 · 이전 제출 이력에는 보관</span>':'')+'</div>';
 }).join('');
}


async function openSubmittedUpload(url){
 const item=lastFiles.find(f=>f.url===url);
 if(!item||excludedSubmittedUrls().includes(url)){notify('현재 제출 파일 목록에서 찾을 수 없습니다.');return;}
 const previewable=/\.(pdf|png|jpe?g)$/i.test(item.name);
 const win=previewable?window.open('about:blank','_blank'):null;
 if(win){try{win.document.title='첨부파일 불러오는 중';win.document.body.textContent='보안 서버에서 파일을 불러오고 있습니다…';}catch(e){}}
 const previous=$('serverSaveStatus')?.textContent||'';
 try{
  let offset=0,total=0,mime='application/octet-stream',chunks=[],filename=item.name;
  for(let i=0;i<90;i++){
   const result=await gasCall('readEinsteinFileChunkV12',accessCode,url,offset);
   if(!result||!result.bytesBase64)throw Error('파일 데이터가 비어 있습니다.');
   mime=result.mime||mime;filename=result.name||filename;total=Number(result.size)||0;
   const data=atob(result.bytesBase64),part=new Uint8Array(data.length);
   for(let k=0;k<data.length;k++)part[k]=data.charCodeAt(k);
   chunks.push(part);
   offset=Number(result.nextOffset);
   statusText('파일 확인 중… '+Math.round(100*offset/Math.max(1,total))+'%');
   if(offset>=total)break;
   if(i===89)throw Error('파일 다운로드가 완료되지 않았습니다.');
  }
  const blob=new Blob(chunks,{type:mime}),blobUrl=URL.createObjectURL(blob);
  if(previewable&&win){win.location.replace(blobUrl);}
  else{
   if(win)win.close();
   const a=document.createElement('a');a.href=blobUrl;a.download=filename;
   document.body.appendChild(a);a.click();a.remove();
  }
  setTimeout(()=>URL.revokeObjectURL(blobUrl),120000);
  statusText(previous||'✓ 첨부파일 확인 완료');
 }catch(err){
  if(win){try{win.document.body.textContent='파일을 열지 못했습니다: '+err.message;}catch(e){}}
  statusText('첨부파일 확인 실패: '+err.message,true);
  notify('파일 확인 실패: '+err.message);
 }
}

window.addEventListener('einstein:shared-posters-updated',function(e){
 const ids=(Array.isArray(e.detail)?e.detail:[]).filter(x=>x&&x.confirmed).map(x=>String(x.posterId)).sort();
 if(ids.join('|')===confirmedSharedPosterIds.join('|'))return;
 confirmedSharedPosterIds=ids;
 if(verifiedStudent&&step===4&&!submitBusy)render();
});
window.addEventListener('einstein:shared-poster-synced',function(e){
 const result=e.detail;
 if(result&&Array.isArray(result.submittedFiles)){
  lastFiles=result.submittedFiles;
  if(verifiedStudent&&step===4&&!submitBusy)render();
 }
});
function submitPanel(){
 const leader=state.position==='모둠 조장';
 const fileList=(kind)=>uploadFiles[kind].map((f,i)=>`<div class="submission-file"><span>📎 ${esc(f.name)}</span><span>${(f.size/1048576).toFixed(1)} MB</span><button type="button" class="existing-file-remove" data-remove-new="${kind}:${i}" title="추가 파일 빼기">×</button></div>`).join('')||'<div class="hint">추가로 직접 선택한 파일이 없습니다.</div>';
 if(submitReceipt || (lastReceipt&&!editingAfterSubmit)){
  const receipt=submitReceipt||{};
  const reports=lastFiles.filter(f=>f.kind==='report').length;
  const posters=lastFiles.filter(f=>f.kind==='poster').length;
  return '<section class="content-card" id="appSubmitPanel"><div class="highlight-box"><strong>✓ 서버 접수 완료</strong><br>접수번호: <code>'+esc(receipt.receipt||lastReceipt)+'</code><br>보고서 '+reports+'개 / 포스터 '+posters+'개'+(receipt.at?'<br>접수 시각: '+esc(receipt.at):'')+'</div><div id="einsteinSharedPosterMount" style="margin:14px 0"></div><h3>제출된 첨부파일 확인</h3><p class="hint">파일명을 누르면 본인 인증 후 열거나 내려받습니다. 파일을 변경하거나 제외하려면 먼저 수정 버튼을 눌러 주세요.</p>'+submittedFileCards()+'<p class="hint">마감 전까지 수정하여 다시 제출할 수 있으며, 이전 제출본은 교사 이력에 보관됩니다.</p><button type="button" id="editAfterSubmitBtn" class="btn">수정 후 다시 제출하기</button></section>';
 }
 return `<section class="content-card" id="appSubmitPanel">
 ${title('05-B',lastReceipt?'수정본 다시 제출하기':'앱에서 바로 최종 제출하기','개인 보고서와 모둠 포스터를 별도 구글폼 없이 제출합니다.')}
 ${IN_GAS?'<div class="highlight-box">✓ 제출 서버가 연결되어 있습니다. 저장 완료 응답이 나와야 실제 접수된 것입니다.</div>':'<div class="error-list"><h3>시범판: 아직 제출 서버가 연결되지 않았습니다.</h3>이 화면에서는 내용을 작성하고 파일을 선택해 볼 수 있지만 실제 접수는 되지 않습니다. 교사가 Google Apps Script 배포를 완료하면 활성화됩니다.</div>'}
 <div class="privacy"><strong>제출 인증</strong><br>교사가 학생별로 발급한 전용 제출코드를 입력하세요. 코드가 없으면 개인정보가 포함된 자료를 전송하지 않습니다.</div>
 <div class="highlight-box">✓ 인증된 학생: <strong>${esc(state.studentId)} ${esc(state.name)}</strong><br>첫 화면에서 인증한 코드로 제출합니다.${lastReceipt?`<br>기존 접수번호: <code>${esc(lastReceipt)}</code> · 이번에는 수정본을 제출합니다.`:""}</div>

 ${field('개인 최종보고서',`<input type="file" id="reportFiles" class="text-input" multiple accept=".pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg"/><div id="selectedReports">${fileList('report')}</div>${lastFiles.some(f=>f.kind==='report')?`<div class="existing-upload-group"><strong>이미 제출한 보고서</strong><p class="hint">파일을 열어 확인하거나 ×로 다음 수정 제출에서 제외할 수 있습니다.</p>${submittedFileCards('report')}</div>`:'' }`,{required:true,hint:'학생 개인별 1개 이상, 최대 10개 / 파일당 15MB 이하. PDF 활동 기록은 선택적으로 함께 첨부할 수 있습니다.'})}
 ${field('모둠별 탐구포스터',`<div id="einsteinSharedPosterMount" style="margin:14px 0"></div><div class="info-box" style="margin:0 0 12px;padding:12px;background:#f3faf9;border:1px solid #cde7e5;border-radius:10px"><strong>소논문형 연구포스터 제작 도우미</strong><p class="hint" style="margin:6px 0">대표 학생이 포스터를 서버에 등록했다면 아래 ‘내 포스터가 맞아요’를 누르세요. 모둠별 탐구포스터에 자동 첨부되므로 파일을 다시 선택할 필요가 없습니다.</p><a href="https://hyunjint.github.io/einstein-club/poster/" target="_blank" rel="noopener noreferrer" style="display:inline-block;font-weight:750;color:#137a87;text-decoration:underline;padding:7px 0">↗ 아인슈타인 포스터 제작 앱 열기</a></div>
${confirmedSharedPosterIds.length&&!lastFiles.some(f=>f.kind==='poster')?`<div class="highlight-box" style="margin:8px 0;background:#fff8e8;border:1px solid #efd8a6">확인한 모둠 포스터 ${confirmedSharedPosterIds.length}개가 있습니다. 아직 '제출된 첨부파일'에 표시되지 않는다면 위에서 <strong>모둠별 탐구포스터에 다시 연결</strong>을 눌러주세요. 서버 등록 완료 응답이 있어야 첨부가 확정됩니다.</div>`:''}
${lastFiles.some(f=>f.kind==='poster')?`<div class="existing-upload-group"><strong>✅ 실제 서버 제출 목록에 등록된 포스터</strong>${submittedFileCards('poster')}</div>`:''}
<details class="manual-poster-upload" style="margin-top:11px;border:1px solid #d8e7ec;border-radius:10px;padding:10px 12px" ${uploadFiles.poster.length?'open':''}><summary style="cursor:pointer;font-weight:700;color:#236979">＋ 다른 포스터를 직접 첨부하기 (선택)</summary><p class="hint">이미 제작 앱에서 등록·연결된 포스터는 다시 선택할 필요가 없습니다.</p><input type="file" id="posterFiles" class="text-input" multiple accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg"/><div id="selectedPosters">${fileList('poster')}</div></details>`,{required:leader,hint:leader?'조장 필수: 포스터 1개 이상, 최대 5개까지 보관할 수 있습니다.':'조장이 아니면 선택 제출할 수 있습니다.'})}
 <div class="hint">한 번에 최대 40MB까지 제출하도록 제한했습니다. 큰 파일은 PDF로 압축하여 제출하세요. 학교 계정·교사 관리 환경에서만 사용하세요.</div>
 <div class="section-actions"><button class="btn primary" id="submitAppBtn" ${!IN_GAS||submitBusy?'disabled':''}>${submitBusy?'서버에 제출 중…':'✓ 모든 자료 최종 제출하기'}</button></div>
 <div id="submitProgress" class="hint" role="status" aria-live="polite"></div>
 </section>`;
}
function setSubmitProgress(msg){const el=$('submitProgress');if(el)el.textContent=msg;notify(msg);}
function gasCall(name,...args){return new Promise((resolve,reject)=>{
 if(!IN_GAS){reject(Error('제출 서버가 연결되지 않았습니다.'));return;}
 google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(Error(e&&e.message?e.message:String(e))))[name](...args);
 });}
function gasFormCall(form){return new Promise((resolve,reject)=>{
 if(!IN_GAS){reject(Error('제출 서버가 연결되지 않았습니다.'));return;}
 google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(Error(e&&e.message?e.message:String(e)))).uploadEinsteinFileV12(form);
 });}
async function uploadOneFile(sid,kind,file){
 const form=document.createElement('form');form.style.display='none';form.method='post';form.enctype='multipart/form-data';
 for(const [key,val] of [['submissionId',sid],['studentId',state.studentId],['accessCode',accessCode],['kind',kind]]){
  const input=document.createElement('input');input.type='hidden';input.name=key;input.value=String(val);form.appendChild(input);
 }
 const input=document.createElement('input');input.type='file';input.name='file';
 const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;form.appendChild(input);
 document.body.appendChild(form);
 try{return await gasFormCall(form);}finally{form.remove();}
}
async function submitApp(){
 if(submitBusy)return;
 if(!IN_GAS){notify('서버 연결 전입니다. 실제 접수는 불가능합니다.');return;}
 if(!validForPdf())return;
 if(!accessCode.trim()){notify('교사가 발급한 제출코드를 입력하세요.');$('submitAccessCode')?.focus();return;}
 if(uploadFiles.report.length<1&&!lastFiles.some(f=>f.kind==='report'&&!excludedSubmittedUrls().includes(f.url))){notify('개인 최종보고서를 1개 이상 첨부하세요.');return;}
 if(state.position==='모둠 조장'&&uploadFiles.poster.length<1&&confirmedSharedPosterIds.length<1&&!lastFiles.some(f=>f.kind==='poster'&&!excludedSubmittedUrls().includes(f.url))){notify('조장은 탐구포스터 1개를 첨부해야 합니다.');return;}
 const all=[...uploadFiles.report,...uploadFiles.poster];
 const kept=lastFiles.filter(f=>!excludedSubmittedUrls().includes(f.url));
 if(kept.filter(f=>f.kind==='report').length+uploadFiles.report.length>10 || kept.filter(f=>f.kind==='poster').length+uploadFiles.poster.length>5 || kept.reduce((sum,f)=>sum+Number(f.size||0),0)+all.reduce((sum,f)=>sum+f.size,0)>40*1048576){notify('기존 파일과 새 파일의 합계 제한을 초과했습니다. 보고서 10개, 포스터 5개, 총 40MB까지 가능합니다.');return;}
 if(uploadFiles.report.length>10 || uploadFiles.poster.length>5 || all.some(f=>f.size>15*1048576||f.size===0) || all.reduce((a,f)=>a+f.size,0)>40*1048576){notify('파일 개수/크기 제한(각 15MB, 전체 40MB)을 확인하세요.');return;}
 if(!window.confirm(lastReceipt?'수정한 내용으로 다시 제출하시겠습니까? 기존 제출본은 이력으로 보관됩니다.':'작성한 내용과 첨부파일을 교사에게 최종 제출하시겠습니까?'))return;
 submitBusy=true;render();
 try{
  setSubmitProgress('작성 내용을 먼저 서버에 저장하는 중…');
  clearTimeout(saveTimer);
  while(saveInFlight)await new Promise(r=>setTimeout(r,110));
  if(!(await saveToServer(false)))throw Error('서버 자동저장에 실패했습니다. 접수 전에 저장을 확인하세요.');
  setSubmitProgress('제출 코드를 확인하고 기록을 전송하고 있습니다…');
  const request={student:state,accessCode,newReportCount:uploadFiles.report.length,newPosterCount:uploadFiles.poster.length,excludeUrls:excludedSubmittedUrls()};
   let start;
   try{start=await gasCall('beginEinsteinSubmissionV18',request);}
   catch(e){
     if(/Script function not found|not found|찾을 수 없|is not a function/i.test(String(e.message))&&!confirmedSharedPosterIds.length){
       start=await gasCall('beginEinsteinSubmissionV12',request);
     }else throw e;
   }
  if(!start||!start.submissionId)throw Error('접수 세션을 발급받지 못했습니다.');
  let done=0;
  for(const kind of ['report','poster'])for(const file of uploadFiles[kind]){
   setSubmitProgress(`파일 업로드 ${++done}/${all.length}: ${file.name}`);
   await uploadOneFile(start.submissionId,kind,file);
  }
  setSubmitProgress('업로드 목록을 확인하고 최종 접수 중…');
  const result=await gasCall('finalizeEinsteinSubmissionV12',start.submissionId,state.studentId,accessCode);
  if(!result||!result.ok)throw Error('제출 확인 응답이 없습니다.');
  submitReceipt=result;editingAfterSubmit=false;state.editingSubmissionDraft=false;state.excludedFileUrls=[];changeCounter++;
  lastReceipt=result.receipt;
  lastFiles=Array.isArray(result.files)?result.files:lastFiles;
  uploadFiles={report:[],poster:[]};
  // Server maintains earlier file links; relogin will refresh metadata.
  safeRemove(STORAGE_KEY);
  render();notify('접수되었습니다. 마감 전까지 수정해 다시 제출할 수 있습니다.');
 }catch(e){console.error(e);setSubmitProgress('제출 실패: '+e.message+' · 실패했을 때는 바로 다시 제출하지 말고 담당 교사에게 접수 상태를 확인하세요.');}
 finally{submitBusy=false;if(submitReceipt)scheduleServerSave();const b=$('submitAppBtn');if(b)b.disabled=false;}
}
function render(){clearTimeout(navRefreshTimer);if(!state.projects.some(p=>p.id===activeProjectId))activeProjectId=state.projects[0].id;renderNav();$('stepContent').innerHTML=[step0,step1,step2,step3,step4][step]();window.dispatchEvent(new Event('einstein:step-rendered'));}
function go(n){
 n=Math.max(0,Math.min(4,Number(n)||0));
 if(n>step){
  const missing=errors();
  const first=missing.find(e=>e.step<n);
  if(first){
   step=first.step;
   if(first.projectId!==null)activeProjectId=first.projectId;
   render();
   showMissingOnStep(step,missing);
   return;
  }
 }
 step=n;
 state.resumeStep=n;state.resumeProjectId=activeProjectId;state.resumeField=null;
 dirty(false);
 render();
 window.scrollTo({top:0,behavior:'smooth'});
}
let navRefreshTimer=null;
function dirty(resetConfirm=true){
 changeCounter++;scheduleServerSave();isSaved=false;
 if(resetConfirm){state.confirmed=false;checklist.pdf=false;}
 clearTimeout(navRefreshTimer);
 navRefreshTimer=setTimeout(function(){navRefreshTimer=null;renderNav();},180);
}
function getProject(id){return state.projects.find(x=>x.id===Number(id));}
function handleInput(e){const t=e.target;if(t.dataset?.field==='studentId'||t.dataset?.field==='name')return;if(!t.dataset)return;state.resumeStep=step;state.resumeField={field:t.dataset.field||'',project:t.dataset.project||'',roleNote:t.dataset.roleNote||'',evidenceNote:t.dataset.evidenceNote||'',role:t.dataset.role||''};if(t.dataset.project&&t.dataset.field){const p=getProject(t.dataset.project);if(p){p[t.dataset.field]=t.value;dirty();}return;}if(t.dataset.roleNote){const p=getProject(t.dataset.roleNote);if(p){p.roleNotes[t.dataset.role]=t.value;dirty();}return;}if(t.dataset.evidenceNote){state.evidenceNotes[t.dataset.evidenceNote]=t.value;dirty();return;}if(t.dataset.field&&Object.prototype.hasOwnProperty.call(state,t.dataset.field)){state[t.dataset.field]=t.value;dirty();}}
function handleChange(e){const t=e.target;if(t.id==='reportFiles'||t.id==='posterFiles'){const kind=t.id==='reportFiles'?'report':'poster';uploadFiles[kind]=Array.from(t.files||[]);const holder=$(kind==='report'?'selectedReports':'selectedPosters');if(holder)holder.textContent=uploadFiles[kind].map(f=>f.name).join(' / ')||'선택한 파일이 없습니다.';return;}if(t.dataset?.projectRole){const p=getProject(t.dataset.projectRole),r=t.value;if(p){p.roles=t.checked?[...new Set([...p.roles,r])]:p.roles.filter(x=>x!==r);const choice=t.closest('.role-choice'),editor=choice?.querySelector('.role-inline-editor');if(choice)choice.classList.toggle('selected',t.checked);if(editor)editor.hidden=!t.checked;}dirty();return;}if(t.dataset?.evidence){const k=t.dataset.evidence;if(t.checked&&state.evidence.length>=3){t.checked=false;notify('실제 경험이 있는 항목을 최대 3개까지만 선택해 주세요.');return;}state.evidence=t.checked?[...state.evidence,k]:state.evidence.filter(x=>x!==k);const choice=t.closest('.evidence-choice'),editor=choice?.querySelector('.evidence-inline-editor');if(choice)choice.classList.toggle('selected',t.checked);if(editor)editor.hidden=!t.checked;dirty();return;}if(t.id==='confirmCheck'){state.confirmed=t.checked;dirty(false);}if(t.id==='pdfReady'){checklist.pdf=t.checked;}if(t.id==='originalReady'){checklist.original=t.checked;}if(t.dataset?.field==='position'){state.position=t.value;render();dirty();}}
function cloneFromStorage(o){if(!o||typeof o!=='object'||!Array.isArray(o.projects)||!o.projects.length||o.projects.length>30)throw Error('유효한 아인슈타인 백업 파일이 아닙니다.');let base=fresh();const out={...base,...o};out.careerGoal=typeof out.careerGoal==='string'?out.careerGoal:'';out.researchTheme=typeof out.researchTheme==='string'?out.researchTheme:'';out.researchQuestion=typeof out.researchQuestion==='string'?out.researchQuestion:'';out.themeConnection=typeof out.themeConnection==='string'?out.themeConnection:'';out.projects=o.projects.map((p,i)=>{const merged={...makeProject(),...p,roles:Array.isArray(p.roles)?p.roles.filter(r=>PROJECT_ROLES.includes(r)):[],roleNotes:p.roleNotes&&typeof p.roleNotes==='object'?p.roleNotes:{}};if(!merged.summary&&p.primary)merged.summary=[p.results,p.analysis].filter(Boolean).join(' / ');merged.id=i+1;delete merged.primary;return merged;});seq=out.projects.length+1;out.evidence=Array.isArray(o.evidence)?o.evidence.filter(k=>EVIDENCES.some(e=>e[0]===k)).slice(0,3):[];out.evidenceNotes=o.evidenceNotes&&typeof o.evidenceNotes==='object'?o.evidenceNotes:{};out.confirmed=!!o.confirmed;return out;}
function saveDraft(){saveToServer(true);}
function loadDraft(){refreshServerDraft();}
function downloadBlob(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function fileStem(){return `${state.studentId||'학번'}_${(state.name||'이름').replace(/[\\/:*?"<>|\s]/g,'')}_아인슈타인_활동기록_2026`;}
function backup(){const b=new Blob([JSON.stringify({...state,backupVersion:1},null,2)],{type:'application/json;charset=utf-8'});downloadBlob(b,fileStem()+'.json');notify('백업 파일을 저장했습니다. 이 파일에는 작성한 개인정보가 포함되어 있습니다.');}
async function importJSON(file){if(!file)return;if(file.size>2e6){notify('백업 파일이 너무 큽니다.');return;}try{const obj=JSON.parse(await file.text());if(!confirm('불러온 파일로 현재 작성 내용을 덮어쓸까요?'))return;const loaded=cloneFromStorage(obj);if(!verifiedStudent||loaded.studentId!==verifiedStudent.studentId||loaded.name!==verifiedStudent.name)throw Error('백업 파일의 학번·이름이 로그인 정보와 다릅니다.');state=loaded;activeProjectId=state.projects[0].id;dirty();go(0);notify('백업 파일을 불러왔습니다.');}catch{notify('백업 파일 형식이 올바르지 않습니다.');}}
function validForPdf(){
 const e=errors();
 if(e.length){
  const first=e[0];step=first.step;
  if(first.projectId!==null)activeProjectId=first.projectId;
  render();showMissingOnStep(step,e);return false;
 }
 if(!state.confirmed){notify('실제 활동에 근거한 작성 내용인지 확인 항목에 체크해 주세요.');$('confirmCheck')?.focus();return false;}
 return true;
}
function printPdf(){if(!validForPdf())return;$('printRoot').innerHTML=paperHTML();window.print();notify('인쇄 창에서 대상을 “PDF로 저장”으로 선택하세요.');}
function saveFormUrl(){const v=$('formURL')?.value.trim()||'';if(v&&!/^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/i.test(v)){notify('구글폼 주소(https://docs.google.com/forms/ 또는 forms.gle)를 입력하세요.');return;}try{if(v){if(!safeSet(FORM_KEY,v))throw Error('localStorage unavailable');}else safeRemove(FORM_KEY);render();notify(v?'제출 링크가 이 브라우저에 저장되었습니다.':'저장된 제출 링크를 지웠습니다.');}catch{notify('브라우저에 주소를 저장할 수 없습니다.');}}
const DEFAULT_FORM_URL='https://forms.gle/NQSxPb4DzJkCVMiy8';
function formOpen(){const url=DEFAULT_FORM_URL||safeGet(FORM_KEY);if(!url){notify('제출 구글폼 주소를 먼저 설정해 주세요.');return;}if(!checklist.pdf){notify('먼저 활동 기록 PDF를 저장하고 ① PDF 저장 확인에 체크해 주세요.');return;}try{const u=new URL(url);if(u.protocol!=='https:'||!['docs.google.com','forms.gle'].includes(u.hostname))throw Error();window.open(u.href,'_blank','noopener,noreferrer');notify('새 창이 열리지 않으면 아래의 제출 주소 링크를 눌러 주세요.');}catch{notify('구글폼 주소가 올바르지 않습니다.');}}
// PDF output: fully offline, direct download, page images to avoid Korean font dependencies.
// Alternate native printing offers selectable/searchable text.
async function directPdf(){if(!validForPdf())return;const btn=$('downloadPdfBtn');btn.disabled=true;btn.textContent='PDF 생성 중…';try{await new Promise(r=>setTimeout(r,40));const pages=drawPDFPages();const bytes=await buildPDF(pages);downloadBlob(new Blob([bytes],{type:'application/pdf'}),fileStem()+'.pdf');checklist.pdf=true;notify(`PDF ${pages.length}쪽을 저장했습니다. 파일을 준비한 뒤 앱 안에서 최종 제출해 주세요.`);render();}catch(e){console.error(e);notify('PDF 생성에 실패했습니다. 인쇄용 PDF 버튼을 이용하세요.');if(btn.isConnected){btn.disabled=false;btn.textContent='↓ PDF 파일 바로 저장';}}}
function drawPDFPages(){const W=595,H=842,scale=2.25,margin=47,contentW=W-2*margin;const canvases=[];let canvas,ctx,y=0,pg=0;const col={ink:'#26384a',muted:'#667e91',blue:'#2b7794',line:'#d8e5eb',light:'#eaf4f7',teal:'#168a85'};
function newPage(){canvas=document.createElement('canvas');canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);ctx=canvas.getContext('2d',{alpha:false});ctx.scale(scale,scale);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);pg++;canvases.push(canvas);ctx.fillStyle=col.teal;ctx.fillRect(margin,34,32,3);ctx.font='bold 9px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';ctx.fillStyle=col.muted;ctx.fillText('EINSTEIN SCIENCE CLUB · 2026',margin,27);ctx.strokeStyle=col.line;ctx.beginPath();ctx.moveTo(margin,804);ctx.lineTo(W-margin,804);ctx.stroke();y=61;}
function ensure(h){if(y+h>783)newPage();}
function font(size,bold){ctx.font=`${bold?'bold ':''}${size}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;}
function lines(value,maxWidth,size,bold=false){font(size,bold);const result=[];for(const para of String(value||'').replace(/\r/g,'').split('\n')){if(!para){result.push('');continue;}let line='';for(const ch of para){if(ctx.measureText(line+ch).width>maxWidth&&line){result.push(line);line=ch;}else line+=ch;}result.push(line);}return result;}
function line(s,size=10.3,bold=false,color=col.ink,dy=17){font(size,bold);ctx.fillStyle=color;const rows=lines(s,contentW,size,bold);for(const row of rows){ensure(dy);ctx.fillText(row,margin,y);y+=dy;}}
function major(s){ensure(55);y+=13;ctx.fillStyle=col.light;ctx.fillRect(margin,y-12,contentW,29);font(12,true);ctx.fillStyle=col.blue;ctx.fillText(s,margin+11,y+7);y+=31;}
function sub(s){ensure(34);y+=9;ctx.fillStyle=col.teal;ctx.fillRect(margin,y-9,3,19);font(11.1,true);ctx.fillStyle=col.ink;const l=lines(s,contentW-13,11.1,true);for(const r of l){ensure(18);ctx.fillText(r,margin+11,y+4);y+=18;}y+=5;}
function q(label,value){if(!String(value||'').trim())return;ensure(40);font(10.2,true);const ls=lines(label,contentW,10.2,true);for(const l of ls){ensure(16);ctx.fillStyle=col.blue;ctx.fillText(l,margin,y);y+=16;}ctx.fillStyle=col.ink;const rows=lines(value,contentW,10.7,false);for(const r of rows){ensure(17);font(10.7,false);ctx.fillStyle=col.ink;ctx.fillText(r,margin,y);y+=17;}y+=10;}
newPage();ensure(90);font(9,true);ctx.fillStyle=col.teal;ctx.fillText('ANNUAL SCIENCE RESEARCH RECORD',margin,y);y+=33;font(19,true);ctx.fillStyle=col.ink;ctx.fillText('아인슈타인 동아리 활동 기록',margin,y);y+=26;font(10.2,false);ctx.fillStyle=col.muted;ctx.fillText('2026학년도 학생 활동 기록 · 전체 응답',margin,y);y+=18;major('00   학생 기본 정보');q('학번',state.studentId);q('이름',state.name);q('희망 진로 분야',state.careerGoal);
major('01   동아리 통합 연구주제와 중심 질문');q('1년간의 큰 연구주제',state.researchTheme);q('중심 연구질문',state.researchQuestion);q('여러 실험의 연결과 탐구 흐름',state.themeConnection);
major('02   참여한 개별 실험·탐구활동');state.projects.forEach((p,i)=>{sub(`${i+1}. ${p.title||'(제목 없음)'}`);q('탐구 형태',p.mode+(p.team?' · '+p.team:''));q('주요 결과 및 배움',p.summary);q('큰 연구주제와의 연결',p.themeLink);q('이 실험의 구체적인 질문',p.question);q('탐구 동기',p.motivation);q('가설',p.hypothesis);q('실험 설계 및 조건',p.design);q('관찰·측정 결과',p.results);q('과학적 결과 해석',p.analysis);q('실험의 한계와 어려움',p.challenge);q('문제 분석 및 개선',p.nextTry);p.roles.forEach((r,i)=>q(i===0?'담당 역할과 구체적 기여':'추가 수행 역할',`${r}: ${p.roleNotes[r]||''}`));});major('03   동아리 내 역할과 공동체 기여');q('동아리 직책',state.position);q('직책 관련 실제 활동',state.positionWork);state.evidence.forEach(k=>q(EVIDENCES.find(x=>x[0]===k)?.[1]||k,state.evidenceNotes[k]));q('기타 공동체 기여',state.otherContribution);major('04   과학적 성장과 탐구의 확장');q('새롭게 이해한 과학 개념',state.growthConcept);q('탐구 태도·방법의 변화',state.growthChange);q('새롭게 생긴 의문',state.followup);q('후속 탐구 계획',state.futurePlan);q('추가 활동 및 기록',state.teacherNote);
for(let i=0;i<canvases.length;i++){const c=canvases[i].getContext('2d');c.setTransform(scale,0,0,scale,0,0);font(8);c.fillStyle=col.muted;c.font='8px "Malgun Gothic", sans-serif';c.fillText('학생 자기 성찰 자료 · 교사 확인 후 생활기록부 작성 참고',margin,816);c.textAlign='right';c.fillText(`${i+1} / ${canvases.length}`,W-margin,816);c.textAlign='left';}return canvases;}
async function buildPDF(canvases){const encoder=new TextEncoder();const pieces=[];let len=0;const offsets=[0];function put(b){let u=typeof b==='string'?encoder.encode(b):b;pieces.push(u);len+=u.length;}
function obj(n,body){offsets[n]=len;put(`${n} 0 obj\n${body}\nendobj\n`);}
put('%PDF-1.4\n%\xC2\xA5\xC2\xB1\n');const pageNums=canvases.map((_,i)=>3+i*3);
obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,`<< /Type /Pages /Kids [${pageNums.map(n=>n+' 0 R').join(' ')}] /Count ${canvases.length} >>`);
for(let i=0;i<canvases.length;i++){const pn=3+i*3,cn=pn+1,im=pn+2;const c=canvases[i];const d=c.toDataURL('image/jpeg',.87).split(',')[1];const binary=atob(d),raw=new Uint8Array(binary.length);for(let j=0;j<binary.length;j++)raw[j]=binary.charCodeAt(j);
obj(pn,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${cn} 0 R >>`);
const command='q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n';obj(cn,`<< /Length ${encoder.encode(command).length} >>\nstream\n${command}endstream`);
offsets[im]=len;put(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${raw.length} >>\nstream\n`);put(raw);put('\nendstream\nendobj\n');}
const xref=len;put(`xref\n0 ${3+canvases.length*3}\n0000000000 65535 f \n`);for(let i=1;i<3+canvases.length*3;i++)put(String(offsets[i]).padStart(10,'0')+' 00000 n \n');put(`trailer\n<< /Size ${3+canvases.length*3} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);const out=new Uint8Array(len);let at=0;for(const p of pieces){out.set(p,at);at+=p.length;}return out;}
try { render(); } catch (e) { if(window.__einsteinShowInitError) window.__einsteinShowInitError(e.message||String(e)); throw e; }
$('stepContent').addEventListener('input',handleInput);$('stepContent').addEventListener('change',handleChange);
$('app').addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.dataset.go!==undefined){go(+t.dataset.go);return;}if(t.dataset.addProject!==undefined){if(state.projects.length>=20){notify('실험은 최대 20개까지 추가할 수 있습니다.');return;}const p=makeProject();state.projects.push(p);activeProjectId=p.id;dirty();render();notify(`실험 ${state.projects.length}번을 추가했습니다. 이 실험의 내용을 작성하세요.`);setTimeout(()=>{const h=$('projectList');h?.scrollIntoView({behavior:'smooth',block:'start'});h?.querySelector('[data-field="title"]')?.focus({preventScroll:true});},40);return;}if(t.dataset.selectProject!==undefined){const id=Number(t.dataset.selectProject);if(!getProject(id))return;activeProjectId=id;state.resumeProjectId=id;dirty(false);render();$('projectList')?.scrollIntoView({behavior:'smooth',block:'start'});return;}if(t.dataset.removeProject){if(state.projects.length===1){notify('최소 한 개의 실험은 필요합니다.');return;}if(!confirm('해당 실험의 모든 기록을 삭제하시겠습니까?'))return;const old=getProject(t.dataset.removeProject);const oldIndex=state.projects.indexOf(old);state.projects=state.projects.filter(x=>x!==old);if(activeProjectId===old.id)activeProjectId=state.projects[Math.min(oldIndex,state.projects.length-1)].id;dirty();render();notify('실험 기록을 삭제했습니다.');return;}if(t.dataset.removeNew!==undefined){const [kind,ix]=t.dataset.removeNew.split(':');if(uploadFiles[kind]){uploadFiles[kind].splice(Number(ix),1);render();}return;}
if(t.dataset.toggleUpload!==undefined){
 const url=t.dataset.toggleUpload;
 const ex=new Set(excludedSubmittedUrls());
 if(ex.has(url))ex.delete(url);else ex.add(url);
 state.excludedFileUrls=[...ex];dirty(false);render();return;
}
if(t.dataset.viewUpload!==undefined){openSubmittedUpload(t.dataset.viewUpload);return;}
if(t.id==='editAfterSubmitBtn'){submitReceipt=null;editingAfterSubmit=true;state.editingSubmissionDraft=true;state.resumeStep=4;dirty(false);render();return;}if(t.id==='draftSaveBtn'){saveDraft();return;}if(t.id==='draftLoadBtn'){loadDraft();return;}if(t.id==='backupBtn'){backup();return;}if(t.id==='downloadPdfBtn'){directPdf();return;}if(t.id==='submitAppBtn'){submitApp();return;}if(t.id==='printPdfBtn'){printPdf();return;}if(t.id==='saveFormURL'){saveFormUrl();return;}if(t.id==='openFormBtn'){formOpen();return;}if(t.id==='resetBtn'){if(!confirm('이 기기의 현재 작성 내용과 임시저장을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.'))return;safeRemove(STORAGE_KEY);state=fresh();if(verifiedStudent){state.studentId=verifiedStudent.studentId;state.name=verifiedStudent.name;state.position=verifiedStudent.leader?'모둠 조장':'직책 없음';}activeProjectId=state.projects[0].id;checklist={pdf:false,original:false};isSaved=false;dirty();go(0);notify('현재 기록을 비웠습니다. 서버에도 빈 초안으로 자동저장합니다.');return;}});
$('jsonImport').addEventListener('change',e=>{importJSON(e.target.files?.[0]);e.target.value='';});
// Backup-file restore entry is available from the keyboard/accessibility button, and both draft toolbar actions.
const restore=document.createElement('button');restore.type='button';restore.className='btn';restore.textContent='백업 불러오기';restore.title='JSON 백업 파일에서 복원';restore.addEventListener('click',()=>$('jsonImport').click());$('backupBtn').after(restore);
// Ctrl/Cmd+S uses manual browser-local draft save.
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveDraft();}});
render();
})();
