
(function(){
 'use strict';
 var q=function(id){return document.getElementById(id);};
 var button=q('studentLoginBtn'),input=q('studentLoginCode'),output=q('studentLoginFeedback'),showCode=q('studentShowCode');
 var loginAttempt=0, loginTimer=null, loginStart=0;
 if(showCode){showCode.addEventListener('click',function(){var visible=input.type==='password';input.type=visible?'text':'password';showCode.textContent=visible?'🙈 숨기기':'👁 보기';showCode.setAttribute('aria-pressed',String(visible));showCode.setAttribute('aria-label',visible?'제출코드 숨기기':'제출코드 보기');input.focus();});}
 if(!button||!input||!output)return;
 // 2026-12-07 00:00:00 KST = 2026-12-06 15:00:00 UTC.
 var DEADLINE_MS=Date.UTC(2026,11,6,15,0,0);
 var CLOSED_MESSAGE='제출기한이 지났습니다.\n문의: 3층 융합과학부 초미녀현진쌤';
 function showDeadline(){
  if(Date.now()<DEADLINE_MS)return false;
  loginAttempt++;clearTimeout(loginTimer);
  var loginGate=q('studentLoginGate'),notice=q('studentDeadlineNotice'),workspace=q('studentWorkspace');
  if(loginGate)loginGate.hidden=true;
  if(workspace)workspace.hidden=true;
  if(notice)notice.hidden=false;
  document.body.classList.add('einstein-deadline-closed');
  return true;
 }
 if(showDeadline())return;
 // Check again while the page stays open across midnight.
 var closingCheck=setInterval(function(){if(showDeadline())clearInterval(closingCheck);},15000);
 function feedback(t){output.textContent=String(t||'');}
 function unlock(profile,token){
  if(!profile || !/^\d{5}$/.test(String(profile.studentId)) || !String(profile.name||'').trim())throw Error('서버의 학생 정보가 올바르지 않습니다.');
  window.__einsteinStudentIdentity={...profile,studentId:String(profile.studentId),name:String(profile.name),leader:!!profile.leader,code:token};
  q('studentLoginGate').hidden=true;
  q('studentWorkspace').hidden=false;
  document.body.classList.add('einstein-auth');
  q('studentIdentity').textContent='인증 완료 · '+profile.studentId+' '+profile.name+(profile.leader?' · 모둠 조장':'');
  window.dispatchEvent(new CustomEvent('einstein:verified',{detail:window.__einsteinStudentIdentity}));
 }
 function login(){
  if(showDeadline())return;
  var token=input.value.trim().toUpperCase();
  if(!/^E[0-9A-F]{13}$/.test(token)){feedback('학생 개별 제출코드를 정확히 입력해 주세요.');return;}
  if(typeof google==='undefined'||!google.script||!google.script.run){feedback('이 페이지는 화면 미리보기입니다. 담당 교사가 안내한 Apps Script 제출 주소를 이용해 주세요.');return;}
  if(button.disabled)return;
  var attempt=++loginAttempt;
  loginStart=Date.now();
  button.disabled=true;button.textContent='인증 중…';
  feedback('서버에서 학생 정보를 확인하고 있습니다. 잠시 기다려 주세요.');
  clearTimeout(loginTimer);
  loginTimer=setTimeout(function(){
   if(attempt!==loginAttempt)return;
   loginAttempt++;
   button.disabled=false;button.textContent='다시 확인하기';
   feedback('서버 응답이 지연되고 있습니다. 인터넷 연결과 Apps Script 최신 버전 배포 여부를 확인하고 다시 시도해 주세요. 여러 번 누르지 마세요.');
  },25000);
  function done(){
   if(attempt!==loginAttempt)return false;
   clearTimeout(loginTimer);button.disabled=false;button.textContent='코드 확인 · 시작';return true;
  }
  try{
   google.script.run.withSuccessHandler(function(profile){
    if(showDeadline())return;
    if(!done())return;
    try{unlock(profile,token);}catch(e){feedback(e.message);}
   }).withFailureHandler(function(err){
    if(!done())return;
    feedback('인증 실패: '+(err&&err.message?err.message:'코드 확인에 실패했습니다.')+' · 관리자에게 오류 화면을 알려주세요.');
   }).lookupEinsteinStudentByCode(token);
  }catch(e){done();feedback('로그인 요청 실패: '+(e.message||String(e)));}

 }
 button.addEventListener('click',login);
 input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();login();}});
})();
