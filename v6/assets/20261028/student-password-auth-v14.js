(function(){
'use strict';
var byId=function(id){return document.getElementById(id);};
var gate=byId('studentLoginGate'),workspace=byId('studentWorkspace'),feedbackBox=byId('studentLoginFeedback');
if(!gate||!workspace||!feedbackBox)return;
var deadline=Date.UTC(2026,11,6,15,0,0);
var attempt=0,busy=false,timer=null;
var verifiedAccessCode='';
var rememberedIdKey='einstein_student_last_id_v14';
function feedback(t){feedbackBox.textContent=String(t||'');}
function showDeadline(){
 if(Date.now()<deadline)return false;
 attempt++;busy=false;clearTimeout(timer);
 gate.hidden=true;workspace.hidden=true;
 var notice=byId('studentDeadlineNotice');if(notice)notice.hidden=false;
 document.body.classList.add('einstein-deadline-closed');
 return true;
}
if(showDeadline())return;
setInterval(function(){showDeadline();},15000);
function getSavedId(){try{return localStorage.getItem(rememberedIdKey)||'';}catch(e){return '';}}
function setSavedId(s){try{localStorage.setItem(rememberedIdKey,s);}catch(e){}}
byId('studentLoginId').value=getSavedId();
function rpc(name,args,ok,fail){
 if(typeof google==='undefined'||!google.script||!google.script.run){fail(Error('Apps Script 학생용 주소에서 접속해 주세요.'));return;}
 try{var runner=google.script.run.withSuccessHandler(ok).withFailureHandler(fail);runner[name].apply(runner,args);}
 catch(e){fail(e);}
}
function request(name,args,onSuccess){
 if(showDeadline()||busy)return;
 busy=true;feedback('서버에서 확인 중입니다…');
 var id=++attempt;
 clearTimeout(timer);
 timer=setTimeout(function(){
  if(id!==attempt)return;
  attempt++;busy=false;
  feedback('서버 응답이 지연되고 있습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.');
 },30000);
 function finish(){if(id!==attempt||showDeadline())return false;clearTimeout(timer);busy=false;return true;}
 rpc(name,args,function(result){
  if(!finish())return;
  try{onSuccess(result);}catch(e){feedback('처리 오류: '+e.message);}
 },function(err){
  if(!finish())return;
  feedback('확인 실패: '+((err&&err.message)||String(err)));
 });
}
function togglePassword(inputId,buttonId){
 var field=byId(inputId),btn=byId(buttonId);
 if(!field||!btn)return;
 btn.addEventListener('click',function(){
  var show=field.type==='password';
  field.type=show?'text':'password';
  btn.textContent=show?'숨기기':'보기';
  field.focus();
 });
}
togglePassword('studentLoginCode','studentShowCode');
togglePassword('studentNewPassword','studentShowNewPassword');
togglePassword('studentLoginPassword','studentShowLoginPassword');
function selectMode(mode){
 if(showDeadline())return;
 var returning=mode==='return';
 byId('studentFirstLogin').hidden=returning;
 byId('studentReturningLogin').hidden=!returning;
 byId('studentFirstTab').classList.toggle('active',!returning);
 byId('studentReturnTab').classList.toggle('active',returning);
 byId('studentFirstTab').setAttribute('aria-pressed',String(!returning));
 byId('studentReturnTab').setAttribute('aria-pressed',String(returning));
 feedback('');
 if(returning)byId('studentLoginId').focus();
}
byId('studentFirstTab').addEventListener('click',function(){selectMode('first');});
byId('studentReturnTab').addEventListener('click',function(){selectMode('return');});
function unlock(profile,session){
 if(!profile||!/^U[0-9A-F]{64}$/.test(String(session||''))||! /^\d{5}$/.test(String(profile.studentId||''))||!String(profile.name||'').trim()){
  throw Error('인증 정보가 올바르지 않습니다. 다시 로그인하세요.');
 }
 setSavedId(String(profile.studentId));
 // Never save password or student session token in localStorage.
 window.__einsteinStudentIdentity=Object.assign({},profile,{
  studentId:String(profile.studentId),name:String(profile.name),leader:!!profile.leader,code:session
 });
 byId('studentLoginCode').value='';
 byId('studentNewPassword').value='';
 byId('studentConfirmPassword').value='';
 byId('studentLoginPassword').value='';
 gate.hidden=true;workspace.hidden=false;
 document.body.classList.add('einstein-auth');
 byId('studentIdentity').textContent='인증 완료 · '+profile.studentId+' '+profile.name+
   (profile.leader?' · 모둠 조장':'');
 window.dispatchEvent(new CustomEvent('einstein:verified',{detail:window.__einsteinStudentIdentity}));
}
byId('studentLoginBtn').addEventListener('click',function(){
 var code=byId('studentLoginCode').value.trim().toUpperCase();
 if(!/^E[0-9A-F]{13}$/.test(code)){feedback('개별 제출코드를 정확하게 입력하세요.');return;}
 request('beginEinsteinStudentPasswordSetupV14',[code],function(profile){
  if(profile.hasPassword){
   byId('studentLoginId').value=profile.studentId;
   setSavedId(profile.studentId);
   selectMode('return');
   feedback('이미 비밀번호가 설정된 학생입니다. 학번과 비밀번호로 로그인하세요. 분실했다면 교사에게 초기화를 요청하세요.');
   return;
  }
  verifiedAccessCode=code;
  byId('studentPasswordSetup').hidden=false;
  byId('studentVerifiedName').textContent='본인 확인 완료 · '+profile.studentId+' '+profile.name;
  feedback('본인 확인이 완료됐습니다. 아래에서 비밀번호를 설정하세요.');
  byId('studentNewPassword').focus();
 });
});
byId('studentLoginCode').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();byId('studentLoginBtn').click();}});
byId('studentSetPasswordBtn').addEventListener('click',function(){
 var p=byId('studentNewPassword').value,q=byId('studentConfirmPassword').value;
 if(!verifiedAccessCode){feedback('먼저 학생 개별 제출코드로 본인 확인을 해주세요.');return;}
 if(p.length<8||p.length>64||!/[0-9]/.test(p)||!/[A-Za-z가-힣]/.test(p)||/\s/.test(p)){feedback('비밀번호는 공백 없이 문자와 숫자를 포함해 8~64자로 설정하세요.');return;}
 if(p!==q){feedback('두 비밀번호가 일치하지 않습니다.');return;}
 request('setEinsteinStudentPasswordV14',[verifiedAccessCode,p],function(result){
  verifiedAccessCode='';
  unlock(result.profile,result.session);
 });
});
byId('studentConfirmPassword').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();byId('studentSetPasswordBtn').click();}});
byId('studentPasswordLoginBtn').addEventListener('click',function(){
 var id=byId('studentLoginId').value.trim(),pw=byId('studentLoginPassword').value;
 if(!/^\d{5}$/.test(id)){feedback('학번 5자리를 입력하세요.');return;}
 if(!pw){feedback('비밀번호를 입력하세요.');return;}
 request('loginEinsteinStudentPasswordV14',[id,pw],function(result){unlock(result.profile,result.session);});
});
byId('studentLoginPassword').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();byId('studentPasswordLoginBtn').click();}});
})();