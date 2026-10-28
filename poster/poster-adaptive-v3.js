(function(){
'use strict';
const $=id=>document.getElementById(id);
const poster=$('posterCanvas'), pdf=$('savePdf'), pptx=$('savePptx');
if(!poster||!pdf||!pptx)return;
const K='einstein_poster_photos_v3',MAX=3;
const limits={title:48,researchers:105,group:20,abstract:110,background:105,question:90,hypothesis:125,variables:95,materials:75,method:190,results:155,graphTitle:24,graphData:500,graphXLabel:28,graphXUnit:12,graphYLabel:28,graphUnit:12,discussion:215,limitations:95,conclusion:175,followup:100,references:48,contributions:48};

const sharedGroups=[
 {fields:['question','hypothesis'],budget:165},
 {fields:['variables','materials','method'],budget:215},
 {fields:['abstract','results'],budget:175},
 {fields:['discussion','limitations'],budget:255},
 {fields:['conclusion','followup'],budget:225}
];
function getFieldValue(k){return document.querySelector('[data-key="'+k+'"]')?.value||'';}
function effectiveCap(k){
 let max=limits[k]||0;
 for(const g of sharedGroups){
  if(g.fields.includes(k)){
   const others=g.fields.filter(x=>x!==k).reduce((sum,x)=>sum+getFieldValue(x).length,0);
   max=Math.min(max,Math.max(0,g.budget-others));
  }
 }
 return max;
}
function sharedOverflow(){
 return sharedGroups.filter(g=>g.fields.reduce((n,k)=>n+getFieldValue(k).length,0)>g.budget);
}
function recalculateCaps(){
 for(const el of document.querySelectorAll('[data-key]')){
  const k=el.dataset.key;if(!(k in limits))continue;
  const max=effectiveCap(k);
  el.maxLength=Math.max(max,el.value.length);
  const count=el.nextElementSibling?.classList.contains('poster-character-status')?el.nextElementSibling:null;
  if(count){
   count.textContent=el.value.length+' / '+max+'자'+(sharedGroups.some(g=>g.fields.includes(k))?' · 다른 칸을 비우면 늘어남':'');
   count.classList.toggle('near-limit',el.value.length>=max||el.value.length>=limits[k]*.90);
  }
 }
}
window.__einsteinPosterCapsV7={limits,sharedGroups,effectiveCap,sharedOverflow,recalculateCaps};

const photos={method:[],result:[]};
try{const z=JSON.parse(localStorage.getItem(K)||'{}');for(const k of ['method','result'])if(Array.isArray(z[k]))photos[k]=z[k].slice(0,MAX);}catch(e){}
let busy=false,lastWarning='',paintQueued=false,sequence=0;
function pickPhotos(k){return photos[k]||[];}
function collect(){let x={};document.querySelectorAll('[data-key]').forEach(el=>x[el.dataset.key]=el.value||'');return x;}
function persist(){try{localStorage.setItem(K,JSON.stringify(photos));}catch(e){alert('사진 임시저장 공간이 부족합니다. 작업 백업 파일을 저장해 주세요.');}}
function toast(m){const e=$('posterFitStatus');if(e){e.textContent=m;e.classList.add('problem');}}
const sizeLabel=document.querySelector('.preview-head .print-meta');
if(sizeLabel)sizeLabel.textContent='A1 세로 · 모든 모둠 동일 · 594×841mm';
const appRight=document.querySelector('.appbar .right');if(appRight)appRight.textContent='A1 세로 · 글자 수 자동 조절';
const editor=document.querySelector('.intro');
if(editor){const n=document.createElement('div');n.className='poster-fit-message';n.innerHTML='<strong>포스터는 A1 세로 1장으로 고정됩니다.</strong> 입력이 적으면 글자가 커지고, 많으면 읽기 쉬운 범위까지 자동으로 작아집니다. 사진은 실험 과정·실험 결과에 각각 최대 3장까지 넣을 수 있습니다.';editor.after(n);}
const cards=poster.querySelectorAll('.poster-column');
function setHeight(el,n){if(!el)return;const h=n+'px',f='0 0 '+n+'px';if(el.style.getPropertyValue('height')!==h||el.style.getPropertyPriority('height')!=='important')el.style.setProperty('height',h,'important');if(el.style.getPropertyValue('flex')!==f||el.style.getPropertyPriority('flex')!=='important')el.style.setProperty('flex',f,'important');}
if(cards.length===3){[[112,165,180],[150,226],[]].forEach((a,i)=>a.forEach((v,j)=>setHeight(cards[i].children[j],v)));}
const css=document.createElement('style');css.textContent='.poster-title{white-space:normal!important;max-height:64px;line-height:1.12;overflow:hidden}.poster-researchers{white-space:normal;max-height:38px;overflow:hidden}.poster-section .body{line-height:1.48;overflow:hidden}.poster-photo-grid{padding:3px}.poster-photo-item small{font-size:9px}.photo-box{overflow:hidden}.poster-fit-message strong{font-weight:850}';document.head.appendChild(css);
for(const el of document.querySelectorAll('[data-key]')){
 const cap=limits[el.dataset.key];if(!cap)continue;
 el.maxLength=Math.max(cap,el.value.length);
 const count=document.createElement('div');count.className='poster-character-status';
 el.after(count);
 const upd=()=>{recalculateCaps();schedule();};
 el.addEventListener('input',(ev)=>{
   if(ev.isComposing)return;
   // Prevent extra hard line breaks from consuming all poster height.
   const maxBreaks=el.dataset.key==='method'?2:
     ['researchers','references','contributions','variables'].includes(el.dataset.key)?1:0;
   const oldText=el.value;
   let count=0;
   const next=oldText.replace(/\r\n?/g,'\n').replace(/\n/g,()=>count++<maxBreaks?'\n':' ');
   if(next!==oldText){
     const at=el.selectionStart||next.length;
     el.value=next;
     try{el.setSelectionRange(Math.min(at,next.length),Math.min(at,next.length));}catch(err){}
   }
   upd();
 },true);upd();
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
  const signature=arr.map(p=>p.data.length+':'+p.data.slice(-100)+':'+p.caption).join('|');
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

function setGridRows(node,visible,cssClass){
 const current=[...node.children];
 if(current.length!==visible.length||current.some((e,i)=>e.dataset.itemKey!==visible[i].key)){
  const frag=document.createDocumentFragment();
  for(const x of visible){
   const part=document.createElement('div');part.className=cssClass;part.dataset.itemKey=x.key;
   const strong=document.createElement('strong');strong.textContent=x.label+' · ';
   const value=document.createElement('span');value.textContent=x.value;part.append(strong,value);frag.appendChild(part);
  }
  node.replaceChildren(frag);
 }else{
  for(let i=0;i<visible.length;i++){
   const text=current[i].lastElementChild;
   if(text.textContent!==visible[i].value)text.textContent=visible[i].value;
  }
 }
 const weights=visible.map(x=>Math.max(1.5,1+Math.ceil((x.value.length+x.label.length)/33)));
 const cols=weights.map(w=>'minmax(0,'+w+'fr)').join(' ');
 if(node.style.gridTemplateRows!==cols)node.style.gridTemplateRows=cols;
}
function renderCompositeSections(){
 const groups=[
  {id:'pQuestionHypothesis',cls:'poster-composite-part',items:[
   {key:'question',label:'연구질문',value:getFieldValue('question').trim()},
   {key:'hypothesis',label:'가설 및 근거',value:getFieldValue('hypothesis').trim()}
  ]},
  {id:'pSummary',cls:'poster-summary-part',items:[
   {key:'abstract',label:'연구 개요',value:getFieldValue('abstract').trim()},
   {key:'results',label:'주요 결과',value:getFieldValue('results').trim()}
  ]},
  {id:'pMethods',cls:'poster-method-part',items:[
   {key:'variables',label:'변인',value:getFieldValue('variables').trim()},
   {key:'materials',label:'재료',value:getFieldValue('materials').trim()},
   {key:'method',label:'실험 절차',value:getFieldValue('method').trim()}
  ]}
 ];
 for(const g of groups){
  const node=$(g.id);if(!node)continue;
  const visible=g.items.filter(item=>item.value.length);
  if(!visible.length)visible.push({key:'empty',label:'',value:'내용을 입력하세요.'});
  setGridRows(node,visible,g.cls);
 }
}
function optionalSectionLayout(){
 const column1=poster.querySelector('.poster-column:nth-child(1)');
 const column2=poster.querySelector('.poster-column:nth-child(2)');
 const column3=poster.querySelector('.poster-column:nth-child(3)');
 if(!column1||!column2||!column3)return;
 function display(el,on){
  if(!el)return;
  const d=on?'':'none';
  if(el.style.display!==d)el.style.display=d;
 }
 const methodPhotos=photos.method.length>0,resultPhotos=photos.result.length>0;
 const graphData=getFieldValue('graphData');
 const hasGraph=graphData.split(/\r?\n/).some(line=>{
  const parts=line.split(/[,，\t]/);
  return parts.length>=2&&parts[0].trim()&&parts[1].trim()&&Number.isFinite(Number(parts[1]));
 });
 const methodPhoto=column1.children[3],resultPhoto=column2.children[2],graph=column2.children[1];
 display(methodPhoto,methodPhotos);
 display(resultPhoto,resultPhotos);
 display(graph,hasGraph);
 const methodHeading=column1.children[2]?.querySelector('h3');
 if(methodHeading){
  const title=(getFieldValue('variables').trim()||getFieldValue('materials').trim())?'03 재료 및 연구 방법':'03 연구 방법';
  if(methodHeading.textContent!==title)methodHeading.textContent=title;
 }
 const summaryHeading=column2.children[0]?.querySelector('h3');
 if(summaryHeading){
  const title=getFieldValue('abstract').trim()?'04 연구 개요·주요 결과':'04 연구 결과';
  if(summaryHeading.textContent!==title)summaryHeading.textContent=title;
 }
 setHeight(column1.children[2],methodPhotos?180:290);
 if(!hasGraph&&!resultPhotos){
  setHeight(column2.children[0],565);
 }else if(!hasGraph){
  setHeight(column2.children[0],210);
 }else{
  setHeight(column2.children[0],resultPhotos?150:178);
  setHeight(graph,resultPhotos?226:390);
 }
 // The question, analysis and conclusion are required. Optional cards vanish.
 display(column3.children[1],!!getFieldValue('limitations').trim());
 display(column3.children[3],!!getFieldValue('followup').trim());
 const visible=[...column3.children].filter(el=>el.style.display!=='none');
 const rows=visible.length>2?'repeat(2,minmax(0,1fr))':'minmax(0,1fr)';
 if(column3.style.gridTemplateRows!==rows)column3.style.gridTemplateRows=rows;
 visible.forEach((el,i)=>{
   const span=visible.length%2===1&&i===visible.length-1?'span 2':'auto';
   if(el.style.gridColumn!==span)el.style.gridColumn=span;
 });
 const footer=poster.querySelector('.poster-bottom');
 const hasCredits=!!(getFieldValue('references').trim()||getFieldValue('contributions').trim());
 display(footer,hasCredits);
 // Keep all posters the same 594×841mm, reclaim only the optional footer space.
 const grid=poster.querySelector('.poster-grid');
 const height=hasCredits?'930px':'990px';
 if(grid&&grid.style.height!==height)grid.style.height=height;
}
function fitComposite(){
 const bad=[];
 const box=$('pQuestionHypothesis');
 if(box){
   const parts=[...box.querySelectorAll('.poster-composite-part')];
   for(const part of parts){if(part.getClientRects().length&& !fitOne(part,12,8))bad.push('연구질문·가설');}
 }
 const summary=$('pSummary');
 if(summary){for(const part of summary.querySelectorAll('.poster-summary-part')){if(part.getClientRects().length&& !fitOne(part,12,8.5))bad.push('연구 개요·주요 결과');}}
 const methods=$('pMethods');
 if(methods){
   const parts=[...methods.querySelectorAll('.poster-method-part')];
   for(const part of parts){if(part.getClientRects().length&& !fitOne(part,12,8.5))bad.push('실험 방법');}
 }
 return bad;
}
function analyze(){
 let bad=[];
 for(const el of poster.querySelectorAll('.poster-section .body:not(#pQuestionHypothesis):not(#pMethods):not(#pSummary)')){
  if(!el.getClientRects().length)continue;
  if(!fitOne(el,14,8.5)){const title=el.closest('.poster-section')?.querySelector('h3')?.textContent||'본문';bad.push(title);}
 }
 bad.push(...fitComposite());
 if(!fitOne($('pTitle'),28,17))bad.push('연구 제목');
 if(!fitOne($('pAuthors'),13,10))bad.push('연구자');
 if(!fitOne($('pFooter'),11,8.5))bad.push('참고문헌·연구자 기여');
 return [...new Set(bad)];
}
function reflow(){
 if(busy)return;busy=true;try{
  renderPhotos();renderCompositeSections();optionalSectionLayout();const bad=analyze();lastWarning=bad.join(' · ');
  const status=$('posterFitStatus');
  if(status){
   status.classList.toggle('problem',!!bad.length);
   status.textContent=bad.length?'⚠ 내용이 너무 많아 잘릴 수 있는 항목: '+bad.join(' · ')+'. 해당 내용을 줄이세요. 이 상태에서는 출력할 수 없습니다.':'✓ A1 세로 1장으로 정리되었습니다. 각 항목의 글자 크기를 내용량에 맞춰 자동 조절했습니다.';
  }
 }finally{busy=false;}
}
function schedule(){if(paintQueued)return;paintQueued=true;requestAnimationFrame(()=>{paintQueued=false;reflow();});}
recalculateCaps();
const observer=new MutationObserver(schedule);observer.observe(poster,{subtree:true,childList:true,characterData:true});
window.addEventListener('resize',schedule);
for(const kind of ['method','result'])renderPhotoList(kind);
function exportReady(){reflow();recalculateCaps();const capsExceeded=Object.entries(limits).filter(([key,cap])=>getFieldValue(key).length>cap).map(([key])=>key);const groupExceeded=sharedOverflow();if(groupExceeded.length){alert('항목 간 공유 분량을 초과했습니다: '+groupExceeded.map(g=>g.fields.join(' + ')).join(', ')+'\n선택 입력 부분을 조금 줄여 주세요.');return false;}if(capsExceeded.length){alert('이전에 저장한 글 중 현재 입력 제한을 초과한 항목이 있습니다: '+capsExceeded.join(', ')+'\n먼저 내용을 간추려 주세요. 기존 문장은 자동 삭제하지 않았습니다.');return false;}if(lastWarning){alert('A1 포스터에 모든 내용을 넣으려면 다음 항목을 줄이세요:\n'+lastWarning+'\n입력한 글은 삭제되지 않습니다.');return false;}return true;}
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