(function(){
'use strict';
const $=id=>document.getElementById(id),auth=$('authForm'),code=$('teacherCode'),login=$('login');
if(!auth||!code||!login||$('einsteinTrustedLogin'))return;
const KEY='einstein_teacher_trusted_browser_v11';
const panel=document.createElement('div');panel.id='einsteinTrustedLogin';
panel.style.cssText='border:1px solid #c9dce5;border-radius:13px;padding:17px;margin:13px 0 18px;background:#f5fafc;color:#264d62;';
panel.innerHTML='<h3 style="margin:0 0 5px;color:#174761;font-size:17px">개인 PC · 숫자 PIN 간편 로그인</h3><p class="hint" id="trustedGuide" style="line-height:1.65">개인 PC를 처음 한 번 등록하면 다음부터 숫자 PIN만 입력할 수 있습니다.</p><div id="trustedEnter" hidden><label for="trustedTeacherPin">간편 비밀번호</label><input id="trustedTeacherPin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="개인 PC에 설정한 PIN"/><button type="button" id="trustedTeacherGo">PIN으로 바로 로그인</button><button type="button" id="trustedMasterMode" style="background:#687f8b">64자리 코드 로그인</button><button type="button" id="trustedRemove" style="background:#728a96">이 PC 등록 해제</button></div><div id="trustedRegister" hidden><p class="hint">처음 등록하는 개인 PC에서만 기존 64자리 교사 접근코드를 위 칸에 입력하고, 아래에서 PIN을 설정하세요.</p><label for="trustedNewPin">간편 비밀번호 설정 (숫자 4~12자리)</label><input id="trustedNewPin" type="password" inputmode="numeric" maxlength="12" autocomplete="new-password" placeholder="예: 본인이 정한 숫자 PIN"/><button type="button" id="trustedRegisterGo">이 PC 등록 후 로그인</button></div><p id="trustedFeedback" role="status" style="font-size:12px;line-height:1.7;color:#7e4445;white-space:pre-wrap;margin:7px 0 0"></p>';
auth.insertBefore(panel,$('alert'));
const label=document.querySelector('label[for="teacherCode"]');
const intro=auth.querySelector('p.hint');
const remembered=()=>{try{return localStorage.getItem(KEY)||'';}catch(e){return '';}};
function feedback(s){$('trustedFeedback').textContent=s||'';}
function call(fn,...args){return new Promise((resolve,reject)=>{
 if(typeof google==='undefined'||!google.script?.run){reject(Error('Apps Script 교사용 주소에서 실행해 주세요.'));return;}
 const runner=google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(Error(e?.message||String(e))));
 runner[fn](...args);
});}
function show(master){
 const registered=!!remembered();
 $('trustedEnter').hidden=!registered;
 $('trustedRegister').hidden=registered;
 const conceal=registered&&!master;
 for(const el of [code,login,label,intro])if(el)el.style.display=conceal?'none':'';
 $('trustedGuide').textContent=registered?'이 개인 PC는 등록되어 있습니다. 숫자 PIN만 입력하면 됩니다.':'개인 PC를 처음 한 번 등록하면 이후에는 숫자 PIN만 입력합니다. 등록하지 않은 기기는 64자리 접근코드가 필요합니다.';
 if(conceal)setTimeout(()=>$('trustedTeacherPin')?.focus(),40);
}
$('trustedMasterMode').onclick=()=>{show(true);feedback('64자리 접근코드로도 로그인할 수 있습니다.');};
$('trustedRemove').onclick=()=>{
 if(!confirm('이 PC의 간편 로그인 등록을 제거할까요?'))return;
 try{localStorage.removeItem(KEY);}catch(e){}
 show(false);feedback('브라우저 등록 정보를 지웠습니다. 다시 등록하려면 64자리 접근코드가 필요합니다.');
};
$('trustedRegisterGo').onclick=async()=>{
 const pin=$('trustedNewPin').value.trim(),master=code.value.trim();
 if(!/^[0-9a-fA-F]{64}$/.test(master)){feedback('위쪽 교사 접근코드 칸에 기존 64자리 코드를 입력하세요.');return;}
 if(!/^\d{4,12}$/.test(pin)){feedback('PIN은 숫자 4~12자리로 설정하세요.');return;}
 const b=$('trustedRegisterGo');b.disabled=true;feedback('이 개인 PC를 인증하고 등록 중입니다…');
 try{
  const result=await call('registerEinsteinTrustedDevice',master,pin);
  if(!result?.deviceToken)throw Error('등록 기기 인증정보를 받지 못했습니다.');
  localStorage.setItem(KEY,result.deviceToken);
  $('trustedNewPin').value='';
  $('rememberSession').checked=false;
  feedback('기기 등록 완료. 로그인하고 있습니다.');
  show(false);
  login.click();
 }catch(e){feedback('등록 실패: '+e.message+' (교사용 Code.gs에 PIN 로그인 기능이 배포되어 있는지 확인해 주세요.)');}
 finally{b.disabled=false;}
};
$('trustedTeacherGo').onclick=async()=>{
 const pin=$('trustedTeacherPin').value.trim(),device=remembered();
 if(!device||!pin){feedback('등록된 개인 PC의 PIN을 입력하세요.');return;}
 const b=$('trustedTeacherGo');b.disabled=true;feedback('등록 기기와 PIN 확인 중…');
 try{
  const result=await call('loginEinsteinWithPin',device,pin);
  if(!result?.session)throw Error('인증 세션이 발급되지 않았습니다.');
  $('trustedTeacherPin').value='';
  code.value=result.session;
  $('rememberSession').checked=true;
  feedback('인증 완료. 교사용 화면을 여는 중입니다…');
  login.click();
 }catch(e){feedback('PIN 로그인 실패: '+e.message+'. 64자리 코드로 로그인하려면 아래 전환 버튼을 누르세요.');}
 finally{b.disabled=false;}
};
$('trustedTeacherPin').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('trustedTeacherGo').click();}});
show(false);
})();