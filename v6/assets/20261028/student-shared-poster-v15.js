(function(){
'use strict';
const byId=id=>document.getElementById(id);
let student=null,busy=false;
function call(name,...args){
 return new Promise((resolve,reject)=>{
  if(typeof google==='undefined'||!google.script?.run){reject(Error('학생용 Apps Script에서 접속해 주세요.'));return;}
  const req=google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(Error(e?.message||String(e))));
  req[name](...args);
 });
}
function box(){
 let area=byId('einsteinLinkedPostersV15');
 if(area)return area;
 const hero=document.querySelector('#studentWorkspace .status-area')||byId('studentWorkspace');
 if(!hero)return null;
 area=document.createElement('section');
 area.id='einsteinLinkedPostersV15';
 area.style.cssText='border:1px solid #bcdedd;background:#f4fbfb;border-radius:13px;padding:16px;margin:11px 0 19px;display:none;box-shadow:0 3px 9px #1442590c';
 hero.before(area);
 return area;
}
function escapeText(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function note(message){const el=box();if(el){el.style.display='block';el.innerHTML='<strong>모둠 연구포스터</strong><div style="font-size:12px;color:#597484;margin-top:8px">'+escapeText(message)+'</div>';}}
async function refresh(){
 if(!student||busy)return;
 const el=box();if(!el)return;
 busy=true;try{
  const list=await call('listEinsteinSharedPostersV15',student.studentId,student.code);
  if(!list.length){el.style.display='none';return;}
  el.style.display='block';
  el.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><strong>🔬 내 모둠 연구포스터</strong><button type="button" data-poster-refresh style="padding:7px 10px;border:1px solid #bbdcdc;border-radius:8px;background:#fff;color:#296b70">다시 확인</button></div><p style="font-size:12px;color:#55707c">모둠 대표가 등록한 포스터입니다. 파일을 읽고 내 포스터가 맞는지 선택하세요. 개인 최종보고서 제출은 별도로 해야 합니다.</p>'+list.map(x=>'<div style="background:white;border:1px solid #d5e6ea;border-radius:11px;padding:12px;margin:9px 0" data-poster-id="'+escapeText(x.posterId)+'"><strong>'+escapeText(x.title)+'</strong><p style="font-size:12px;color:#5d7582;line-height:1.6;margin:6px 0">연구자: '+x.members.map(m=>escapeText(m.studentId)+' '+escapeText(m.name)).join(', ')+'</p><p style="font-size:11px;color:#5d7582;margin:6px 0">확인 상태: '+(x.confirmed?'✅ 내 포스터 확인 완료':x.rejected?'❌ 잘못 연결됨':'확인 전')+'</p><div style="display:flex;gap:7px;flex-wrap:wrap"><button type="button" data-poster-open="'+escapeText(x.posterId)+'" style="background:#286980;color:white;border:0;border-radius:8px;padding:9px 11px">PDF 열어보기</button><button type="button" data-poster-yes="'+escapeText(x.posterId)+'" style="background:#17837c;color:white;border:0;border-radius:8px;padding:9px 11px">내 포스터가 맞아요</button><button type="button" data-poster-no="'+escapeText(x.posterId)+'" style="background:#eff3f5;color:#546777;border:1px solid #ccdbe3;border-radius:8px;padding:9px 11px">제 것이 아니에요</button></div></div>').join('');
 }catch(err){
  // Keep the old student app usable until the optional backend extension is deployed.
  if(/Script function not found|not found|Unexpected error|예기치 않은 오류/i.test(err.message)){el.style.display='none';return;}
  note('포스터 연결 조회 실패: '+err.message);
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
 const value=!!b.dataset.posterYes;
 if(!confirm(value?'이 연구포스터가 내 모둠의 연구 결과물이 맞습니까?':'내 포스터가 아니라는 내용을 교사에게 표시할까요?'))return;
 b.disabled=true;
 try{await call('confirmEinsteinSharedPosterV15',student.studentId,student.code,id,value);await refresh();}
 catch(err){alert('포스터 확인 실패: '+err.message);}
 finally{b.disabled=false;}
});
window.addEventListener('einstein:verified',e=>{
 student=e.detail;if(!student?.studentId||!student.code)return;refresh();
});
})();