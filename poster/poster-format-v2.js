(function(){
'use strict';
function initFormat(){
 const poster=document.getElementById('posterCanvas'),shell=document.getElementById('posterShell'),
 frame=document.querySelector('.poster-frame'),preview=document.querySelector('.preview-head'),
 pdfBtn=document.getElementById('savePdf'),pptxBtn=document.getElementById('savePptx');
 if(!poster||!shell||!frame||!preview||!pdfBtn||!pptxBtn)return;
 let mode='auto',expanded=false,busy=false,tick=null;
 const controls=document.createElement('div');controls.className='format-controls';
 controls.innerHTML='<label for="posterSizeMode">포스터 크기</label><select id="posterSizeMode"><option value="auto">자동 추천 (기본 A1 · 부족하면 A0)</option><option value="a1">A1 가로 · 841 × 594mm</option><option value="a0">A0 세로 확장 · 841 × 1189mm</option></select><span class="format-description">글이 많으면 A0 확장형을 이용하세요. PDF와 PPTX 모두 선택한 크기로 저장됩니다.</span>';
 preview.after(controls);
 const warn=document.createElement('div');warn.className='overflow-notice';warn.hidden=true;warn.setAttribute('role','status');controls.after(warn);
 const printStyle=document.createElement('style');printStyle.id='einstein-poster-dynamic-paper';document.head.appendChild(printStyle);
 const select=controls.querySelector('select'),meta=preview.querySelector('.print-meta');
 try{const saved=localStorage.getItem('einstein_poster_format_v2');if(['auto','a1','a0'].includes(saved))mode=saved;}catch(e){}
 select.value=mode;
 function currentOverflows(){
  const out=[];
  const names=Array.from(poster.querySelectorAll('.poster-section'));
  for(const el of names){
   const body=el.querySelector('.body');
   if(body&&body.scrollHeight>body.clientHeight+3)out.push((el.querySelector('h3')?.textContent||'본문').trim());
   const graph=el.querySelector('.poster-chart');
   if(graph&&graph.scrollHeight>graph.clientHeight+3)out.push('결과 그래프');
  }
  const title=document.getElementById('pTitle');
  if(title&&title.scrollWidth>title.clientWidth+2)out.push('연구 제목');
  const authors=document.getElementById('pAuthors');
  if(authors&&authors.scrollWidth>authors.clientWidth+2)out.push('연구자');
  const footer=document.getElementById('pFooter');
  if(footer&&footer.scrollHeight>footer.clientHeight+2)out.push('참고문헌·기여');
  return [...new Set(out)];
 }
 function setExpanded(on){
  expanded=!!on;poster.classList.toggle('expanded-a0',expanded);
  const width=shell.getBoundingClientRect().width;
  if(width>0)shell.style.height=(width*(expanded?1584:792)/1120)+'px';
  if(meta)meta.textContent=expanded?'A0 · 세로 확장 · 841 × 1189mm':'A1 · 가로 · 841 × 594mm';
  document.querySelector('.appbar .right')?.replaceChildren(document.createTextNode(expanded?'A0 세로 확장 · 3단 연구포스터':'A1 가로 · 3단 연구포스터'));
  printStyle.textContent=expanded?
   '@page{size:841mm 1189mm;margin:0}@media print{html,body{height:1188mm!important;min-height:1188mm!important;max-height:1188mm!important;overflow:hidden!important} .poster-shell{height:1188mm!important;min-height:1188mm!important;max-height:1188mm!important;overflow:hidden!important} .poster{height:1584px!important}}'
   :'@page{size:841mm 594mm;margin:0}';
 }
 function recalc(){
  if(busy)return;
  busy=true;
  try{
   if(mode==='auto'){
    setExpanded(false);
    const shortOverflows=currentOverflows();
    if(shortOverflows.length)setExpanded(true);
   }else setExpanded(mode==='a0');
   const remains=currentOverflows();
   if(remains.length){
    warn.hidden=false;
    warn.textContent=(expanded?'확장형에서도 일부 내용이 지정 영역을 넘습니다: ':'일부 내용이 A1 영역을 넘습니다: ')+remains.join(' · ')+'. 내용을 줄이거나 표·사진을 간결하게 정리한 뒤 저장하세요. 텍스트는 자동으로 축소되지 않으며 초과 영역은 잘릴 수 있습니다.';
   }else if(mode==='auto'&&expanded){
    warn.hidden=false;
    warn.textContent='기본 A1에 내용이 넘쳐 자동으로 A0 세로 확장형으로 전환했습니다. 출력도 A0 세로 1장입니다.';
   }else warn.hidden=true;
  }finally{busy=false;}
 }
 function schedule(){clearTimeout(tick);tick=setTimeout(recalc,90);}
 select.addEventListener('change',()=>{mode=select.value;try{localStorage.setItem('einstein_poster_format_v2',mode);}catch(e){}recalc();});
 window.addEventListener('resize',()=>setTimeout(()=>{setExpanded(expanded);schedule();},0));
 const observer=new MutationObserver(schedule);
 observer.observe(poster,{subtree:true,childList:true,characterData:true});
 const originalPdf=pdfBtn.onclick;
 pdfBtn.onclick=function(e){recalc();const problems=currentOverflows();if(problems.length&&!confirm('일부 내용이 포스터 영역을 넘쳐 잘릴 수 있습니다.\n'+problems.join(', ')+'\n그래도 PDF 저장을 진행할까요?'))return;if(originalPdf)originalPdf.call(this,e);};
 const originalPptx=pptxBtn.onclick;
 pptxBtn.onclick=function(e){recalc();const problems=currentOverflows();if(problems.length&&!confirm('포스터 일부 영역에 내용이 많습니다.\n'+problems.join(', ')+'\nPPTX에는 글씨 자동 축소가 적용될 수 있습니다. 계속할까요?'))return;if(expanded)saveA0Pptx();else if(originalPptx)originalPptx.call(this,e);};
 function read(k){return document.querySelector('[data-key="'+k+'"]')?.value.trim()||'';}
 function textCard(slide,pptx,title,text,x,y,w,h,fontSize=20){
  slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:.16,line:{color:'D9E6EC',width:1},fill:{color:'FFFFFF'}});
  slide.addShape(pptx.ShapeType.rect,{x:x+.22,y:y+.24,w:.07,h:.46,line:{color:'159B9D',transparency:100},fill:{color:'159B9D'}});
  slide.addText(title,{x:x+.40,y:y+.19,w:w-.64,h:.56,fontFace:'Malgun Gothic',fontSize:22,bold:true,color:'167480',margin:0,breakLine:false});
  if(text)slide.addText(text,{x:x+.28,y:y+.93,w:w-.56,h:h-1.10,fontFace:'Malgun Gothic',fontSize,color:'344F61',margin:.12,valign:'top',breakLine:false,fit:'shrink'});
 }
 function photoCard(slide,pptx,title,source,x,y,w,h){
  textCard(slide,pptx,title,'',x,y,w,h,19);
  const im=source?.querySelector('img');
  if(im?.src?.startsWith('data:image/')){
   try{slide.addImage({data:im.src,x:x+.36,y:y+1,w:w-.72,h:h-1.32,sizingContain:true});}
   catch(e){slide.addText('사진 파일을 추가하세요.',{x:x+.4,y:y+1.6,w:w-.8,h:.6,fontSize:14,color:'8D9FAD',align:'center'});}
  }else slide.addText('실험 사진 (선택)',{x:x+.4,y:y+1.6,w:w-.8,h:.6,fontSize:15,color:'8D9FAD',align:'center'});
 }
 function graphCard(slide,pptx,x,y,w,h){
  textCard(slide,pptx,'05 연구 결과 그래프','',x,y,w,h);
  const label=read('graphTitle')||'그래프 제목',unit=read('graphUnit');
  slide.addText(label+(unit?' · '+unit:''),{x:x+.36,y:y+1.03,w:w-.72,h:.43,fontFace:'Malgun Gothic',fontSize:17,color:'446E7D',bold:true,margin:0,fit:'shrink'});
  const data=read('graphData').split(/\r?\n/).map(v=>v.split(/[,，\t]/)).filter(a=>a.length>=2&&a[0].trim()&&Number.isFinite(Number(a[1].trim()))).slice(0,9).map(a=>({label:a[0].trim().slice(0,14),value:Number(a[1].trim())}));
  if(!data.length){slide.addText('실제 측정 데이터를 입력하세요.',{x:x+.4,y:y+4,w:w-.8,h:.7,fontSize:17,color:'8D9EAA',align:'center'});return;}
  const left=x+.95,top=y+2.2,gh=h-3.65,gw=w-1.55;
  const lo=Math.min(0,...data.map(d=>d.value)),hi=Math.max(1,...data.map(d=>d.value))*1.1,range=Math.max(.0001,hi-lo),zero=top+gh-(0-lo)*gh/range,bw=gw/data.length;
  for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4,pos=top+gh-(v-lo)*gh/range;slide.addShape(pptx.ShapeType.line,{x:left,y:pos,w:gw,h:0,line:{color:'DDE8EC',width:.75,dash:'dash'}});slide.addText(String(Math.round(v*10)/10),{x:left-.58,y:pos-.13,w:.49,h:.26,fontSize:11,color:'7893A0',margin:0,align:'right'});}
  data.forEach((d,i)=>{const px=left+bw*i+bw*.18,bww=bw*.60,pos=top+gh-(d.value-lo)*gh/range;
   slide.addShape(pptx.ShapeType.rect,{x:px,y:Math.min(pos,zero),w:bww,h:Math.max(.02,Math.abs(zero-pos)),line:{color:'25838D',transparency:100},fill:{color:i%2?'54ADAA':'247C89'}});
   slide.addText(String(d.value),{x:px-.06,y:Math.max(top-.02,Math.min(pos,zero)-.31),w:bww+.12,h:.26,fontSize:12,color:'235B6A',align:'center',margin:0});
   slide.addText(d.label.slice(0,11),{x:left+bw*i,y:top+gh+.16,w:bw,h:.42,fontSize:12,color:'365B6D',align:'center',margin:0,fit:'shrink'});
  });
 }
 async function saveA0Pptx(){
  const PPT=window.pptxgen||window.PptxGenJS;
  if(!PPT){alert('PPTX 라이브러리가 아직 로드되지 않았습니다. 인터넷 연결을 확인하고 다시 시도하세요.');return;}
  const btn=pptxBtn;btn.disabled=true;btn.textContent='A0 PPTX 제작 중…';
  try{
   const pptx=new PPT();pptx.defineLayout({name:'A0PORTRAIT',width:33.11,height:46.78});pptx.layout='A0PORTRAIT';pptx.author='은행고등학교 아인슈타인 동아리';pptx.subject='2026 소논문형 연구포스터 A0 확장';pptx.title=read('title')||'아인슈타인 연구포스터';
   const slide=pptx.addSlide();slide.background={color:'F7FAFC'};
   slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:33.11,h:3.47,line:{color:'17324C',transparency:100},fill:{color:'17324C'}});
   slide.addText('2026 은행고등학교 아인슈타인 동아리',{x:.85,y:.48,w:31.4,h:.56,fontFace:'Malgun Gothic',fontSize:22,bold:true,color:'9EDBDA',margin:0,charSpacing:2});
   slide.addText('연구제목: '+(read('title')||'[연구 제목을 입력하세요]'),{x:.85,y:1.21,w:31.3,h:1.05,fontFace:'Malgun Gothic',fontSize:51,bold:true,color:'FFFFFF',margin:0,fit:'shrink'});
   slide.addText('연구자: '+(read('researchers')||'[학번 이름, 학번 이름]').replace(/\n/g,', ')+(read('group')?'  |  모둠: '+read('group'):''),{x:.85,y:2.49,w:31.3,h:.62,fontFace:'Malgun Gothic',fontSize:23,color:'DDEEF0',margin:0,fit:'shrink'});
   const x=[.65,11.03,23.08],w=[10.00,11.70,9.38];
   textCard(slide,pptx,'01 연구 배경·필요성',read('background'),x[0],3.85,w[0],10.45,21);
   textCard(slide,pptx,'02 연구질문·가설',['연구질문: '+read('question'),'가설: '+read('hypothesis')].filter(v=>v.length>5).join('\n\n'),x[0],14.59,w[0],7.5,20);
   textCard(slide,pptx,'03 재료 및 연구 방법',['변인: '+read('variables'),'재료: '+read('materials'),'실험 절차: '+read('method')].filter(v=>v.length>5).join('\n\n'),x[0],22.42,w[0],15.18,20);
   photoCard(slide,pptx,'실험 과정 사진',document.getElementById('methodPhoto'),x[0],37.94,w[0],7.60);
   textCard(slide,pptx,'04 연구 개요·주요 결과',[read('abstract'),read('results')].filter(Boolean).join('\n\n'),x[1],3.85,w[1],14.03,21);
   graphCard(slide,pptx,x[1],18.18,w[1],13.39);
   photoCard(slide,pptx,'관찰·측정 사진',document.getElementById('resultPhoto'),x[1],31.91,w[1],13.63);
   textCard(slide,pptx,'06 결과 분석·논의',read('discussion'),x[2],3.85,w[2],12.31,21);
   textCard(slide,pptx,'07 연구 한계 및 개선',read('limitations'),x[2],16.48,w[2],9.45,20);
   textCard(slide,pptx,'08 결론',read('conclusion'),x[2],26.26,w[2],9.48,21);
   textCard(slide,pptx,'09 후속 탐구',read('followup'),x[2],36.06,w[2],9.48,20);
   slide.addShape(pptx.ShapeType.rect,{x:0,y:45.84,w:33.11,h:.94,line:{color:'E6F3F5',transparency:100},fill:{color:'E6F3F5'}});
   slide.addText('참고문헌 · 연구자 기여',{x:.7,y:46.1,w:5.2,h:.35,fontFace:'Malgun Gothic',fontSize:16,bold:true,color:'287581',margin:0});
   slide.addText([read('references')?'참고문헌: '+read('references'):'',read('contributions')?'연구 기여: '+read('contributions'):''].filter(Boolean).join('    |    ')||'참고문헌과 실제 연구 기여 내용 입력',{x:5.9,y:46.01,w:26.5,h:.52,fontFace:'Malgun Gothic',fontSize:13,color:'526F7F',margin:0,fit:'shrink'});
   const filename=(read('title')||'아인슈타인_연구포스터').replace(/[\/\\:*?"<>|]/g,'_').slice(0,42)||'연구포스터';
   await pptx.writeFile({fileName:filename+'_A0확장형.pptx'});
  }catch(e){console.error(e);alert('A0 PPTX 저장 오류: '+e.message);}finally{btn.disabled=false;btn.textContent='▧ PPTX 다운로드';}
 }
 recalc();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initFormat,{once:true});else initFormat();
})();