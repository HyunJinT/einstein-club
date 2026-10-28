(function(){
'use strict';
const $=id=>document.getElementById(id);
const poster=$('posterCanvas'), pdf=$('savePdf'), pptx=$('savePptx');
if(!poster||!pdf||!pptx)return;
const K='einstein_poster_photos_v3',MAX=3;
const limits={title:75,researchers:200,group:45,abstract:140,background:220,question:75,hypothesis:90,variables:105,materials:90,method:340,results:190,graphTitle:85,graphData:460,graphUnit:35,discussion:300,limitations:170,conclusion:180,followup:180,references:170,contributions:180};
const photos={method:[],result:[]};
try{const z=JSON.parse(localStorage.getItem(K)||'{}');for(const k of ['method','result'])if(Array.isArray(z[k]))photos[k]=z[k].slice(0,MAX);}catch(e){}
let busy=false,lastWarning='',paintQueued=false,sequence=0;
function pickPhotos(k){return photos[k]||[];}
function collect(){let x={};document.querySelectorAll('[data-key]').forEach(el=>x[el.dataset.key]=el.value||'');return x;}
function persist(){try{localStorage.setItem(K,JSON.stringify(photos));}catch(e){alert('사진 임시저장 공간이 부족합니다. 작업 백업 파일을 저장해 주세요.');}}
function toast(m){const e=$('posterFitStatus');if(e){e.textContent=m;e.classList.add('problem');}}
const sizeLabel=document.querySelector('.preview-head .print-meta');
if(sizeLabel)sizeLabel.textContent='A1 가로 · 모든 모둠 동일 · 841×594mm';
const appRight=document.querySelector('.appbar .right');if(appRight)appRight.textContent='A1 가로 · 내용량에 따른 글자 자동 조절';
const editor=document.querySelector('.intro');
if(editor){const n=document.createElement('div');n.className='poster-fit-message';n.innerHTML='<strong>포스터는 A1 가로 1장으로 고정됩니다.</strong> 입력이 적으면 글자가 커지고, 많으면 읽기 쉬운 범위까지 자동으로 작아집니다. 사진은 실험 과정·실험 결과에 각각 최대 3장까지 넣을 수 있습니다.';editor.after(n);}
const cards=poster.querySelectorAll('.poster-column');
function setHeight(el,n){if(!el)return;el.style.setProperty('height',n+'px','important');el.style.setProperty('flex','0 0 '+n+'px','important');}
if(cards.length===3){[[125,108,218],[147,225],[]].forEach((a,i)=>a.forEach((v,j)=>setHeight(cards[i].children[j],v)));}
const css=document.createElement('style');css.textContent='.poster-title{white-space:normal!important;max-height:64px;line-height:1.12;overflow:hidden}.poster-researchers{white-space:normal;max-height:38px;overflow:hidden}.poster-section .body{line-height:1.48;overflow:hidden}.poster-photo-grid{padding:3px}.poster-photo-item small{font-size:9px}.photo-box{overflow:hidden}.poster-fit-message strong{font-weight:850}';document.head.appendChild(css);
for(const el of document.querySelectorAll('[data-key]')){
 const cap=limits[el.dataset.key];if(!cap)continue;
 el.maxLength=cap;
 const count=document.createElement('div');count.className='poster-character-status';
 el.after(count);
 const upd=()=>{const n=el.value.length;count.textContent=n+' / '+cap+'자 (포스터용 요약)';count.classList.toggle('near-limit',n>=cap*.88);schedule();};
 el.addEventListener('input',upd);upd();
}
const imageInputs=[['method','methodImage','methodPhoto','methodPhotoList'],['result','resultImage','resultPhoto','resultPhotoList']];
for(const [kind,id,,listId] of imageInputs){
 const input=$(id);if(!input)continue;
 input.multiple=true;input.accept='image/png,image/jpeg,image/webp';
 let list=$(listId);if(!list){list=document.createElement('div');list.className='photo-editor-list';list.id=listId;input.after(list);}
 const title=input.closest('.field')?.querySelector('label');if(title)title.textContent=(kind==='method'?'실험 과정 사진':'실험 결과·관찰 사진')+' (최대 3장)';
 const hint=document.createElement('p');hint.className='hint';hint.textContent='사진을 추가하면 자동 배열됩니다. 위·아래 버튼으로 순서를 바꾸고 30자 이내 설명을 적으세요. 사진 1장당 최대 3MB(자동 압축).';list.before(hint);
 input.addEventListener('change',async e=>{
  e.preventDefault();e.stopImmediatePropagation();
  const current=pickPhotos(kind),files=[...input.files||[]],available=Math.max(0,MAX-current.length);
  if(files.length>available){alert('이 구역은 사진을 최대 '+MAX+'장까지 넣을 수 있습니다. 현재 추가 가능한 수: '+available+'장');}
  for(const file of files.slice(0,available)){
   if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>3*1024*1024){alert('PNG/JPG/WebP 이미지이며 원본 3MB 이하여야 합니다: '+file.name);continue;}
   try{current.push({data:await compress(file),caption:''});}catch(err){alert('사진을 열 수 없습니다: '+file.name);}
  }
  input.value='';persist();renderPhotoList(kind);schedule();
 },true);
 list.addEventListener('input',e=>{const cap=e.target.closest('[data-photo-caption]');if(!cap)return;const p=pickPhotos(kind)[Number(cap.dataset.photoCaption)];if(p){p.caption=cap.value.slice(0,30);persist();schedule();}});
 list.addEventListener('click',e=>{
  const b=e.target.closest('[data-photo-action]');if(!b)return;
  const ix=Number(b.dataset.photoIndex),arr=pickPhotos(kind),act=b.dataset.photoAction;
  if(ix<0||ix>=arr.length)return;
  if(act==='remove')arr.splice(ix,1);
  if(act==='up'&&ix>0)[arr[ix-1],arr[ix]]=[arr[ix],arr[ix-1]];
  if(act==='down'&&ix<arr.length-1)[arr[ix],arr[ix+1]]=[arr[ix+1],arr[ix]];
  persist();renderPhotoList(kind);schedule();
 });
}
function compress(file){
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{
   const scale=Math.min(1,1050/img.width,800/img.height),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
   const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   let data=canvas.toDataURL('image/jpeg',.78);if(data.length>480000)data=canvas.toDataURL('image/jpeg',.60);
   URL.revokeObjectURL(url);resolve(data);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('잘못된 이미지 형식'));};img.src=url;
 });
}
function escapeText(t){return String(t||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function renderPhotoList(kind){
 const row= imageInputs.find(x=>x[0]===kind);const list=$(row?.[3]||'');if(!list)return;
 list.innerHTML=pickPhotos(kind).map((p,i)=>'<div class="photo-editor-row"><img src="'+p.data+'" alt="첨부된 '+(i+1)+'번째 사진"><input data-photo-caption="'+i+'" maxlength="30" placeholder="사진 '+(i+1)+' 설명 (선택)" value="'+escapeText(p.caption)+'"><button type="button" data-photo-action="up" data-photo-index="'+i+'" title="앞으로 이동" '+(i===0?'disabled':'')+'>↑</button><button type="button" data-photo-action="down" data-photo-index="'+i+'" title="뒤로 이동" '+(i===pickPhotos(kind).length-1?'disabled':'')+'>↓</button><button type="button" data-photo-action="remove" data-photo-index="'+i+'" title="삭제">×</button></div>').join('');
}
function renderPhotos(){
 for(const [kind,,boxId] of imageInputs){
  const box=$(boxId),arr=pickPhotos(kind);if(!box)continue;
  const signature=arr.map(p=>p.data.slice(0,45)+p.caption).join('|');
  // Replace the older single-photo rendering when its contents change.
  if(arr.length){
   if(box.dataset.photosV3!==signature||!box.querySelector('.poster-photo-grid')){
    const grid=document.createElement('div');grid.className='poster-photo-grid';grid.style.setProperty('--picture-count',String(arr.length));
    for(const p of arr){
     const item=document.createElement('div');item.className='poster-photo-item';
     const img=document.createElement('img');img.src=p.data;img.alt=p.caption||'실험 사진';item.appendChild(img);
     if(p.caption){const caption=document.createElement('small');caption.textContent=p.caption;item.appendChild(caption);}
     grid.appendChild(item);
    }
    box.replaceChildren(grid);box.dataset.photosV3=signature;
   }
  }else{
   if(box.querySelector('.poster-photo-grid')){const text=document.createElement('span');text.textContent=(kind==='method'?'실험 과정 사진':'관찰·측정 사진')+' (선택)';box.replaceChildren(text);}
   box.dataset.photosV3='';
  }
 }
}
function fitOne(el,max,min){
 if(!el)return true;
 let size=max;el.style.fontSize=size+'px';
 while(size>min&&el.scrollHeight>el.clientHeight+1){size=Math.max(min,size-.5);el.style.fontSize=size+'px';}
 return el.scrollHeight<=el.clientHeight+1;
}
function analyze(){
 let bad=[];
 for(const el of poster.querySelectorAll('.poster-section .body')){
  if(!fitOne(el,14,9.5)){const title=el.closest('.poster-section')?.querySelector('h3')?.textContent||'본문';bad.push(title);}
 }
 if(!fitOne($('pTitle'),28,17))bad.push('연구 제목');
 if(!fitOne($('pAuthors'),13,10))bad.push('연구자');
 if(!fitOne($('pFooter'),11,8.5))bad.push('참고문헌·연구자 기여');
 return [...new Set(bad)];
}
function reflow(){
 if(busy)return;busy=true;try{
  renderPhotos();const bad=analyze();lastWarning=bad.join(' · ');
  const status=$('posterFitStatus');
  if(status){
   status.classList.toggle('problem',!!bad.length);
   status.textContent=bad.length?'⚠ 내용이 너무 많아 잘릴 수 있는 항목: '+bad.join(' · ')+'. 해당 내용을 줄이세요. 이 상태에서는 출력할 수 없습니다.':'✓ A1 가로 1장으로 정리되었습니다. 각 항목의 글자 크기를 내용량에 맞춰 자동 조절했습니다.';
  }
 }finally{busy=false;}
}
function schedule(){if(paintQueued)return;paintQueued=true;requestAnimationFrame(()=>{paintQueued=false;reflow();});}
const observer=new MutationObserver(schedule);observer.observe(poster,{subtree:true,childList:true,characterData:true});
window.addEventListener('resize',schedule);
for(const kind of ['method','result'])renderPhotoList(kind);
function exportReady(){reflow();if(lastWarning){alert('A1 포스터에 모든 내용을 넣으려면 다음 항목을 줄이세요:\n'+lastWarning+'\n입력한 글은 삭제되지 않습니다.');return false;}return true;}
pdf.onclick=()=>{if(exportReady())setTimeout(()=>window.print(),80);};
function download(name,body,type){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([body],{type}));a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),18000);}
const save=$('saveJson');if(save)save.onclick=()=>{
 const pack={format:'einstein-poster-v1',savedAt:new Date().toISOString(),model:collect(),images:{},photosV3:photos};
 const file=(collect().title||'아인슈타인_연구포스터').replace(/[\\/:*?"<>|]/g,'_').slice(0,42);
 download(file+'_작업백업.json',JSON.stringify(pack,null,2),'application/json');
};
const importEl=$('loadJsonFile');if(importEl)importEl.addEventListener('change',async e=>{
 e.preventDefault();e.stopImmediatePropagation();
 try{
  const file=e.target.files?.[0];if(!file)return;
  const obj=JSON.parse(await file.text());if(obj.format!=='einstein-poster-v1')throw Error('이 앱의 작업 백업 파일이 아닙니다.');
  document.querySelectorAll('[data-key]').forEach(el=>{el.value=(obj.model||{})[el.dataset.key]||'';el.dispatchEvent(new Event('input',{bubbles:true}));});
  for(const kind of ['method','result']){
   const list=obj.photosV3?.[kind];
   photos[kind]=Array.isArray(list)?list.slice(0,MAX).map(x=>({data:x.data,caption:x.caption||''})):[];
   const old=(obj.images||{})[kind+'Image'];if(!photos[kind].length&&typeof old==='string'&&old.startsWith('data:image/'))photos[kind]=[{data:old,caption:''}];
   renderPhotoList(kind);
  }
  persist();schedule();
 }catch(err){alert('작업 불러오기 실패: '+err.message);}finally{importEl.value='';}
},true);
window.__einsteinPosterV3={collect,photos,reflow,exportReady,download};
schedule();
})();