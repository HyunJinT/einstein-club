(function(){
'use strict';
const $=id=>document.getElementById(id);
const pdfButton=$('savePdf'),serverButton=$('uploadPosterServer'),poster=$('posterCanvas');
if(!pdfButton||!serverButton||!poster)return;
const ENDPOINT='https://script.google.com/macros/s/AKfycbwcgV5NXm75aETWnzJpGCtLfihfb4i4mQGfB_0Ext5s4Zq2quWzHoRl8TqIv38LVGMWuA/exec';
const MAX_FILE=15*1024*1024;
const V16_CHUNK_CHARS=360000;
let working=false;
function safeName(s){return String(s||'아인슈타인_연구포스터').trim().replace(/[\\/:*?"<>|]/g,'_').slice(0,52)||'연구포스터';}
function value(k){return document.querySelector('[data-key="'+k+'"]')?.value?.trim()||'';}
function pause(ms){return new Promise(r=>setTimeout(r,ms));}
function loading(on,msg){
 working=on;pdfButton.disabled=serverButton.disabled=on;
 if(!pdfButton.dataset.originalLabel)pdfButton.dataset.originalLabel=pdfButton.textContent;
 if(!serverButton.dataset.originalLabel)serverButton.dataset.originalLabel=serverButton.textContent;
 pdfButton.textContent=on?'PDF 제작 중…':pdfButton.dataset.originalLabel;
 serverButton.textContent=on?(msg||'서버 업로드 준비 중…'):serverButton.dataset.originalLabel;
}
function progress(message,isError){
 const target=$('einsteinPosterUploadStatus');if(target){target.textContent=message;target.style.color=isError?'#a2393b':'#27645c';}
}
async function makePdf(){
 const api=window.__einsteinPosterV3;
 if(!api){throw Error('포스터 제작 모듈이 아직 준비되지 않았습니다. 새로고침해 주세요.');}
 if(!api.exportReady())return null;
 if(typeof window.html2canvas!=='function'||!window.jspdf?.jsPDF)throw Error('PDF 생성 도구를 불러오지 못했습니다. 인터넷 연결을 확인하세요.');
 await document.fonts?.ready;
 api.reflow();
 await pause(100);
 const mem=Number(navigator.deviceMemory||8);
 // A1 portrait at 6x is ~203 dpi. Lower-memory phones use 4x to avoid crashing.
 const scale=mem>0&&mem<=4?4:6;
 const canvas=await window.html2canvas(poster,{
  scale,backgroundColor:'#FFFFFF',useCORS:true,allowTaint:false,logging:false,
  width:792,height:1120,windowWidth:1200,windowHeight:1350,
  onclone:doc=>{
   const p=doc.getElementById('posterCanvas');if(!p)return;
   p.style.setProperty('transform','none','important');
   p.style.setProperty('position','fixed','important');
   p.style.setProperty('left','0px','important');
   p.style.setProperty('top','0px','important');
   p.style.setProperty('width','792px','important');
   p.style.setProperty('height','1120px','important');
   p.style.setProperty('overflow','hidden','important');
   const wrapper=p.parentElement;if(wrapper){wrapper.style.width='792px';wrapper.style.height='1120px';wrapper.style.overflow='visible';}
  }
 });
 if(canvas.width<2300||canvas.height<3300)throw Error('렌더링 해상도가 충분하지 않습니다.');
 const jpeg=canvas.toDataURL('image/jpeg',.89);
 canvas.width=1;canvas.height=1;
 const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:[594,841],compress:true,putOnlyUsedFonts:true});
 pdf.addImage(jpeg,'JPEG',0,0,594,841,undefined,'FAST');
 pdf.setProperties({title:value('title')||'2026 아인슈타인 연구포스터',subject:'2026 은행고등학교 아인슈타인 동아리 소논문형 연구포스터',author:value('researchers')||'아인슈타인 동아리'});
 const blob=pdf.output('blob');
 if(blob.size>MAX_FILE)throw Error('PDF 파일이 15MB를 초과했습니다. 사진 크기를 줄이고 다시 시도하세요.');
 return blob;
}
function download(blob,name){
 const a=document.createElement('a'),url=URL.createObjectURL(blob);
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function blobBase64(blob){return new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(String(rd.result).split(',')[1]||'');rd.onerror=()=>reject(Error('파일 읽기 실패'));rd.readAsDataURL(blob);});}
function getScientists(){
 const lines=value('researchers').replace(/[，、;]/g,',').split(/[,\\n]+/).map(x=>x.trim()).filter(Boolean);
 const results=[];
 for(const line of lines){
  const m=line.match(/^([0-9]{5})\s+([^\s,]{2,20})$/);
  if(!m)throw Error('연구자는 학번과 이름을 정확히 입력해 주세요. 예: 20111 홍길동, 20112 김영희');
  if(results.some(x=>x.studentId===m[1]))throw Error('연구자 명단에 같은 학번이 두 번 들어갔습니다: '+m[1]);
  results.push({studentId:m[1],name:m[2]});
 }
 if(!results.length||results.length>15)throw Error('연구자는 1~15명까지 입력하세요.');
 return results;
}
function getLogin(){
 return new Promise(resolve=>{
  const cover=document.createElement('div');cover.className='eins-upload-modal';
  cover.style.cssText='position:fixed;inset:0;background:#071824b8;display:grid;place-items:center;z-index:9999;padding:20px';
  const box=document.createElement('form');box.style.cssText='background:white;border-radius:16px;padding:22px;max-width:430px;width:100%;box-shadow:0 18px 55px #0003;display:grid;gap:11px;color:#21435c;font-size:13px';
  box.innerHTML='<h2 style="margin:0;font-size:19px;color:#143e57">모둠 포스터 서버 등록</h2><p style="margin:0;line-height:1.65;color:#537185">연구자 중 <strong>모둠 대표 1명</strong>의 학번과 활동 기록 앱 비밀번호로 인증합니다. PDF는 학교 Google Drive에 등록되며, 다른 연구자들은 로그인 후 본인 포스터인지 확인합니다.</p><label>대표 학생 학번<input name="studentId" inputmode="numeric" maxlength="5" autocomplete="username" required pattern="[0-9]{5}" placeholder="학번 5자리" style="width:100%;padding:11px;border:1px solid #c3d7e1;border-radius:9px;margin-top:5px"></label><label>활동 기록 앱 비밀번호<input name="password" type="password" autocomplete="current-password" required placeholder="학생이 설정한 비밀번호" style="width:100%;padding:11px;border:1px solid #c3d7e1;border-radius:9px;margin-top:5px"></label><p style="font-size:11px;margin:0;color:#6c8392">비밀번호는 서버 인증에만 사용하고 브라우저에 저장하지 않습니다.</p><div style="display:flex;justify-content:flex-end;gap:9px"><button type="button" id="einsUploadCancel" style="background:#eaf1f5;color:#315165;border:0;border-radius:8px;padding:10px 15px">취소</button><button type="submit" style="background:#177b83;color:white;border:0;border-radius:8px;padding:10px 15px">인증하고 업로드</button></div>';
  cover.append(box);document.body.append(cover);
  box.querySelector('#einsUploadCancel').onclick=()=>{cover.remove();resolve(null);};
  box.onsubmit=e=>{e.preventDefault();if(!box.reportValidity())return;const ans={studentId:box.elements.studentId.value.trim(),password:box.elements.password.value};box.elements.password.value='';cover.remove();resolve(ans);};
  box.elements.studentId.focus();
 });
}
async function postToGas(data,action='uploadEinsteinPosterV15'){
 return new Promise((resolve,reject)=>{
  const nonce=(crypto?.randomUUID?.()||String(Date.now())+Math.random().toString(16).slice(2));
  const iframe=document.createElement('iframe');const target='einsteinPosterResponse_'+nonce.replace(/[^A-Za-z0-9]/g,'');
  iframe.name=target;iframe.style.display='none';iframe.title='학교 포스터 업로드 응답';
  document.body.append(iframe);
  const form=document.createElement('form');form.method='POST';form.action=ENDPOINT;form.target=target;form.acceptCharset='UTF-8';form.style.display='none';
  let settled=false;
  const cleanup=()=>{window.removeEventListener('message',receive);clearTimeout(timeout);form.remove();iframe.remove();};
  const receive=e=>{
   if(e.source!==iframe.contentWindow)return;
   if(!['https://script.googleusercontent.com','https://script.google.com','null'].includes(e.origin))return; // iframe nonce + source must also match
   const p=e.data;if(!p||p.kind!=='einsteinPosterUploadV15'||p.nonce!==nonce)return;
   if(settled)return;settled=true;cleanup();
   if(p.ok)resolve(p);else reject(Error(p.error||'학교 서버 업로드가 거부되었습니다.'));
  };
  const timeouts={pingEinsteinPosterV15:14000,beginEinsteinPosterV16:35000,chunkEinsteinPosterV16:55000,finishEinsteinPosterV16:100000,statusEinsteinPosterV16:28000};
  const timeout=setTimeout(()=>{if(!settled){settled=true;cleanup();reject(Error('서버 응답 시간 초과 ('+action+')'));}},timeouts[action]||45000);
  window.addEventListener('message',receive);
  const payload={action,nonce,...data};
  for(const [key,v] of Object.entries(payload)){
   const field=document.createElement('input');field.type='hidden';field.name=key;field.value=String(v);form.appendChild(field);
  }
  document.body.append(form);form.submit();
 });
}
pdfButton.addEventListener('click',async e=>{
 e.preventDefault();e.stopImmediatePropagation();
 if(working)return;
 loading(true);
 try{const blob=await makePdf();if(!blob)return;download(blob,safeName(value('title'))+'_A1_세로형.pdf');progress('고화질 PDF를 저장했습니다. 이 작업만으로는 학교 서버에 등록되지 않습니다.');}
 catch(err){console.error(err);progress('PDF 생성 실패: '+err.message,true);alert('PDF 생성 실패: '+err.message);}
 finally{loading(false);}
},true);
const status=document.createElement('div');status.id='einsteinPosterUploadStatus';status.style.cssText='font-size:12px;line-height:1.6;padding:7px 1px;color:#446a7b';serverButton.closest('.editor-actions')?.after(status);
serverButton.addEventListener('click',async e=>{
 e.preventDefault();e.stopImmediatePropagation();
 if(working)return;
 const api=window.__einsteinPosterV3;if(!api||!api.exportReady())return;
 let team;
 try{team=getScientists();}catch(err){alert(err.message);return;}
 const login=await getLogin();if(!login)return;
 if(!team.some(x=>x.studentId===login.studentId)){alert('로그인할 대표 학생의 학번이 포스터 연구자 명단에 없습니다.');return;}
 loading(true,'학교 서버 연결 확인 중…');
 try{
  progress('학교 서버의 포스터 업로드 기능을 확인 중입니다…');
  await postToGas({},'pingEinsteinPosterV15');
  serverButton.textContent='고화질 PDF 생성 중…';
  progress('A1 세로형 포스터를 PDF로 제작 중입니다…');
  const blob=await makePdf();if(!blob)return;
  if(!window.crypto?.subtle)throw Error('HTTPS 연결에서만 안전하게 PDF 파일을 전송할 수 있습니다.');
  const pdfBytes=await blob.arrayBuffer();
  const hashBytes=new Uint8Array(await crypto.subtle.digest('SHA-256',pdfBytes));
  const pdfHash=[...hashBytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  const b64=await blobBase64(blob);
  const partCount=Math.ceil(b64.length/V16_CHUNK_CHARS);
  if(partCount<1||partCount>65)throw Error('PDF 용량이 너무 큽니다. 사진 파일 크기를 줄여주세요.');
  progress('연구자 확인 및 전송 준비 중…');
  const begin=await postToGas({studentId:login.studentId,password:login.password,
    title:value('title'),researchers:JSON.stringify(team),pdfHash,totalSize:blob.size,partCount},'beginEinsteinPosterV16');
  login.password='';
  if(begin.existing&&begin.posterId){
    progress('✅ 이미 등록된 포스터입니다. 중복 업로드가 필요하지 않습니다. 포스터 번호: '+begin.posterId);
    alert('이미 등록된 동일한 포스터를 찾았습니다. 학생 앱에서 확인하세요.');
    return;
  }
  if(!begin.uploadId||!begin.token)throw Error('서버로부터 분할 업로드 인증정보를 받지 못했습니다.');
  const auth={uploadId:begin.uploadId,token:begin.token};
  for(let i=0;i<partCount;i++){
    serverButton.textContent='PDF 전송 '+(i+1)+'/'+partCount;
    progress('PDF를 나누어 안전하게 전송 중… '+(i+1)+' / '+partCount);
    const part=b64.slice(i*V16_CHUNK_CHARS,(i+1)*V16_CHUNK_CHARS);
    let ok=false,lastError;
    for(let attempt=0;attempt<2&&!ok;attempt++){
      try{const ack=await postToGas({...auth,index:i,part},'chunkEinsteinPosterV16');ok=!!ack?.ok;}
      catch(err){lastError=err;}
    }
    if(!ok)throw Error('PDF '+(i+1)+'번째 조각 업로드 실패: '+(lastError?.message||'서버 응답 없음'));
  }
  serverButton.textContent='서버 저장 확인 중…';
  progress('PDF 파일 조립 및 연구자별 등록을 확인 중입니다…');
  let result;
  try{result=await postToGas(auth,'finishEinsteinPosterV16');}
  catch(err){
    const status=await postToGas(auth,'statusEinsteinPosterV16');
    if(status.complete&&status.posterId)result={ok:true,posterId:status.posterId};
    else throw err;
  }
  if(!result?.posterId)throw Error('서버가 포스터 등록번호를 반환하지 않았습니다.');
  progress('✅ 서버 등록 완료! 포스터 번호: '+result.posterId+' · 연구자 '+team.map(m=>m.studentId).join(', ')+'에게 연결되었습니다.');
  alert('학교 서버에 고화질 PDF가 등록됐습니다. 연구자 '+team.length+'명이 학생용 앱에서 확인할 수 있습니다.');
 }catch(err){console.error(err);progress('서버 업로드 실패: '+err.message,true);alert('서버 업로드가 완료되지 않았습니다.\n'+err.message+'\nApps Script 포스터 업로드 기능 배포 여부를 확인하세요.');}
 finally{login.password='';loading(false);}
},true);
})();