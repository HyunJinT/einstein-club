(function(){
'use strict';
const byId=id=>document.getElementById(id);
let student=null,busy=false,persistentArea=null;
function call(name,...args){
 return new Promise((resolve,reject)=>{
  if(typeof google==='undefined'||!google.script?.run){reject(Error('학생용 Apps Script에서 접속해 주세요.'));return;}
  const req=google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(Error(e?.message||String(e))));
  if(typeof req[name]!=='function'){
    reject(Error(name==='confirmAndAttachEinsteinPosterV18'
      ? '자동 첨부 서버 기능(V18)이 현재 웹앱 배포에 없습니다. Apps Script에서 EinsteinSharedPosterLinkV18.gs 파일을 추가하고 기존 배포를 새 버전으로 업데이트해 주세요.'
      : '서버에 필요한 함수('+name+')가 배포되지 않았습니다. 담당 교사에게 알려주세요.'));
    return;
  }
  try{req[name](...args);}catch(e){reject(Error(e?.message||String(e)));}
 });
}
function box(){
 const mount=byId('einsteinSharedPosterMount');
 if(!persistentArea){
  persistentArea=document.createElement('section');
  persistentArea.id='einsteinLinkedPostersV15';
  persistentArea.style.cssText='border:1px solid #bcdedd;background:#f4fbfb;border-radius:13px;padding:16px;margin:11px 0 19px;box-shadow:0 3px 9px #1442590c';
 }
 if(mount){
  if(persistentArea.parentElement!==mount)mount.appendChild(persistentArea);
 }else{
  const hero=document.querySelector('#studentWorkspace .status-area')||byId('studentWorkspace');
  if(!hero)return null;
  if(!persistentArea.isConnected||persistentArea.parentElement!==hero.parentElement)hero.before(persistentArea);
 }
 return persistentArea;
}
function escapeText(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function note(message){const el=box();if(el){el.style.display='block';el.innerHTML='<strong>모둠 연구포스터</strong><div style="font-size:12px;color:#597484;margin-top:8px">'+escapeText(message)+'</div>';}}
async function refresh(){
 if(!student||busy)return;
 const el=box();if(!el)return;
 busy=true;el.style.display='block';el.innerHTML='<strong>🔬 서버에 자동 등록된 모둠 포스터</strong><p style="font-size:12px;color:#55707c">등록된 포스터 확인 중…</p>';try{
  const list=await call('listEinsteinSharedPostersV15',student.studentId,student.code);
  if(!Array.isArray(list))throw Error('서버에서 올바른 포스터 목록을 받지 못했습니다.');
  window.dispatchEvent(new CustomEvent('einstein:shared-posters-updated',{detail:list}));
  if(!list.length){el.innerHTML='<strong>🔬 서버에 자동 등록된 모둠 포스터</strong><p style="font-size:12px;line-height:1.7;color:#55707c">아직 연결된 포스터가 없습니다. 대표가 서버 등록을 마쳤다면 잠시 후 다시 확인해 주세요.</p><button type="button" data-poster-refresh style="padding:7px 10px;border:1px solid #bbdcdc;border-radius:8px;background:#fff;color:#296b70">다시 확인</button>';return;}
  el.style.display='block';
  el.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><strong>🔬 내 모둠 연구포스터</strong><button type="button" data-poster-refresh style="padding:7px 10px;border:1px solid #bbdcdc;border-radius:8px;background:#fff;color:#296b70">다시 확인</button></div><p style="font-size:12px;color:#55707c">모둠 대표가 서버에 등록한 포스터입니다. PDF를 확인한 다음 내 제출 서류에 포함하세요. <strong>모든 자료 최종 제출하기</strong>까지 완료해야 최종 접수됩니다.</p>'+list.map(x=>'<div style="background:white;border:1px solid #d5e6ea;border-radius:11px;padding:12px;margin:9px 0" data-poster-id="'+escapeText(x.posterId)+'"><strong>'+escapeText(x.title)+'</strong><p style="font-size:12px;color:#5d7582;line-height:1.6;margin:6px 0">연구자: '+x.members.map(m=>escapeText(m.studentId)+' '+escapeText(m.name)).join(', ')+'</p><p style="font-size:11px;color:#5d7582;margin:6px 0">확인 상태: '+(x.confirmed?'✅ 내 포스터 확인 완료 · 최종 제출/첨부 여부는 아래 목록 확인':x.rejected?'❌ 내 포스터가 아님':'⏳ 확인 전')+'</p><div style="display:flex;gap:7px;flex-wrap:wrap"><button type="button" data-poster-open="'+escapeText(x.posterId)+'" style="background:#286980;color:white;border:0;border-radius:8px;padding:9px 11px">PDF 열어보기</button><button type="button" data-poster-yes="'+escapeText(x.posterId)+'" style="background:#17837c;color:white;border:0;border-radius:8px;padding:9px 11px">'+(x.confirmed?'📎 내 제출 서류에 포함하기':'내 포스터가 맞아요 · 제출서류에 포함')+'</button><button type="button" data-poster-no="'+escapeText(x.posterId)+'" style="background:#eff3f5;color:#546777;border:1px solid #ccdbe3;border-radius:8px;padding:9px 11px">제 것이 아니에요</button></div></div>').join('');
 }catch(err){
  note('포스터 조회 오류: '+err.message+' · 기존 개인 보고서 및 활동기록에는 영향이 없습니다.');
 }finally{busy=false;}
}
function bytesFromBase64(base64){const binary=atob(base64),out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}
async function openPdf(id,button){
 let tab=window.open('','_blank');
 if(tab){tab.document.title='아인슈타인 연구포스터 열기';tab.document.body.textContent='인증된 PDF 파일을 불러오는 중입니다…';}
 const parts=[],totalMax=15*1048576;
 button.disabled=true;
 try{
  let position=0,total=1,loops=0;
  while(position<total){
   if(++loops>130)throw Error('파일 읽기 요청이 너무 많습니다.');
   const r=await call('readEinsteinSharedPosterChunkV15',student.studentId,student.code,id,position);
   if(!r||!r.base64||r.next<=position||r.total>totalMax)throw Error('PDF 파일 데이터가 손상되었습니다.');
   parts.push(bytesFromBase64(r.base64));position=r.next;total=r.total;
   if(tab&&!tab.closed)tab.document.body.textContent='연구포스터 PDF 다운로드 중… '+Math.round(100*position/total)+'%';
  }
  const blob=new Blob(parts,{type:'application/pdf'}),url=URL.createObjectURL(blob);
  if(tab&&!tab.closed)tab.location.href=url;
  else{const a=document.createElement('a');a.href=url;a.download='아인슈타인_연구포스터.pdf';a.click();}
  setTimeout(()=>URL.revokeObjectURL(url),120000);
 }catch(e){if(tab&&!tab.closed)tab.document.body.textContent='PDF 열기 실패: '+e.message;alert('PDF 열기 실패: '+e.message);}
 finally{button.disabled=false;}
}
document.addEventListener('click',async e=>{
 const root=byId('einsteinLinkedPostersV15'),b=e.target.closest('[data-poster-refresh],[data-poster-open],[data-poster-yes],[data-poster-no]');
 if(!root||!b||!root.contains(b)||!student)return;
 if(b.hasAttribute('data-poster-refresh')){await refresh();return;}
 if(b.dataset.posterOpen){await openPdf(b.dataset.posterOpen,b);return;}
 const id=b.dataset.posterYes||b.dataset.posterNo;
 if(!id)return;
 const value=b.hasAttribute('data-poster-yes');
 // 학생 포스터 확인 시에는 큰 브라우저 팝업을 사용하지 않습니다.
 // 최종 제출 과정에서만 자동 첨부 서버 미배포 안내를 보여 줍니다.
 b.disabled=true;
 try{
  let result,attached=false,legacyOnly=false;
  try{
   result=await call('confirmAndAttachEinsteinPosterV18',student.studentId,student.code,id,value);
   attached=!!result?.ok;
  }catch(err){
   // V18이 실제 웹앱에 배포되지 않았을 때에는 V15 본인 확인만 수행하고 첨부 완료로 표시하지 않음.
   if(!/Script function not found|not found|찾을 수 없|is not a function|배포되지|confirmAndAttachEinsteinPosterV18/i.test(String(err?.message||err)))throw err;
   result=await call('confirmEinsteinSharedPosterV15',student.studentId,student.code,id,value);
   legacyOnly=true;
  }
  if(!result?.ok)throw Error('포스터 확인 상태를 서버에 저장하지 못했습니다.');
  if(attached)window.dispatchEvent(new CustomEvent('einstein:shared-poster-synced',{detail:result}));
  await refresh();
  const el=byId('einsteinLinkedPostersV15');
  if(el){
   const t=document.createElement('p');
   t.setAttribute('role','status');
   t.style.cssText='color:#187268;font-size:12px;font-weight:700;line-height:1.6;margin:8px 0';
   t.textContent=value
     ? (attached&&result.attachedToSubmission
        ? '✅ 기존 제출 서류에 포스터 연결 완료 · 아래 📎 제출된 첨부파일을 확인하세요.'
        : legacyOnly
          ? '✅ 내 포스터 확인 완료 · 자동 연결 서버(V18)가 미배포되어 첨부 완료 전입니다. 최종 제출 단계에서 안내됩니다.'
          : '✅ 내 포스터 확인 완료 · 📎 최종 제출 예정 파일에 표시됩니다. 모든 자료 최종 제출하기를 눌러 접수하세요.')
     : '✅ 내 포스터가 아니라고 표시했습니다. 기존 첨부파일이 있다면 수정 제출 시에도 제외 여부를 확인하세요.';
   el.prepend(t);
  }
 }
 catch(err){
  // 일반 확인 단계에서는 상단 alert 대신 포스터 영역 안에만 오류 표시
  const el=byId('einsteinLinkedPostersV15');
  if(el){
   const t=document.createElement('p');
   t.setAttribute('role','alert');
   t.style.cssText='color:#9b401d;font-size:12px;font-weight:700;line-height:1.6;margin:8px 0';
   t.textContent='포스터 확인 상태를 저장하지 못했습니다: '+err.message;
   el.prepend(t);
  }
 }
 finally{b.disabled=false;}
});
window.addEventListener('einstein:step-rendered',()=>{if(!student)return;box();if(byId('einsteinSharedPosterMount'))refresh();});
window.addEventListener('einstein:verified',e=>{
 student=e.detail;if(!student?.studentId||!student.code)return;refresh();
});
})();