(function(){
const b=document.getElementById('savePptx');if(!b)return;
const field=k=>document.querySelector('[data-key="'+k+'"]')?.value||'';
function card(s,p,title,text,x,y,w,h,fs=19){
 s.addShape(p.ShapeType.roundRect,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'D8E5EA'}});
 s.addText(title,{x:x+.3,y:y+.18,w:w-.6,h:.45,margin:0,fontSize:20,bold:true,color:'137581',fontFace:'Malgun Gothic'});
 if(text){const density=String(text).length/(w*Math.max(1.5,h-.85));const adaptive=Math.max(15,Math.min(26,Math.min(fs+6,27-density*1.2)));s.addText(text,{x:x+.3,y:y+.78,w:w-.6,h:h-.9,fontSize:adaptive,margin:.06,color:'345366',valign:'top',fit:'shrink',fontFace:'Malgun Gothic'});}
}
function photos(s,p,title,arr,x,y,w,h){
 card(s,p,title,'',x,y,w,h);
 if(!arr.length)return;
 const space=.13,ww=(w-.60-space*(arr.length-1))/arr.length;
 arr.forEach((z,i)=>{
  const xx=x+.30+i*(ww+space),cap=z.caption||'';
  try{s.addImage({data:z.data,x:xx+.02,y:y+.89,w:ww-.04,h:h-1.14-(cap?.31:0),sizingContain:true});}catch(e){}
  if(cap)s.addText(cap,{x:xx,y:y+h-.36,w:ww,h:.26,fontSize:10,margin:0,fit:'shrink',align:'center',color:'477A86'});
 });
}
function graph(s,p,x,y,w,h){
 card(s,p,'05 연구 결과 그래프','',x,y,w,h);
 const options=window.__einsteinPosterGraphV4;
 const type=options&&options.getType()==='line'?'line':'bar';
 s.addText((field('graphTitle')||'연구 결과 그래프')+' · '+field('graphUnit'),{x:x+.4,y:y+.83,w:w-.8,h:.35,fontSize:15,color:'466A79',margin:0,fit:'shrink'});
 const rows=field('graphData').split(/\r?\n/).map(v=>v.split(/[,，\t]/)).filter(v=>v.length>1&&v[0].trim()&&String(v[1]).trim()!==''&&Number.isFinite(+v[1])).slice(0,9);
 if(!rows.length)return;
 const low=Math.min(0,...rows.map(v=>+v[1])),high=Math.max(1,...rows.map(v=>+v[1]))*1.1,range=Math.max(.001,high-low);
 const lx=x+.83,top=y+1.55,W=w-1.42,H=h-2.53,bw=W/rows.length,base=top+H,zero=base-(0-low)*H/range;
 const vertices=[];
 const xValues=rows.map(v=>{const m=v[0].trim().match(/^[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null;});
 const proportional=type==='line'&&xValues.every(Number.isFinite)&&Math.max(...xValues)>Math.min(...xValues);
 const xMin=proportional?Math.min(...xValues):0,xSpan=proportional?Math.max(...xValues)-xMin:1;
 rows.forEach((v,i)=>{
  const yy=base-(+v[1]-low)*H/range,xx=proportional?lx+.2+(xValues[i]-xMin)/xSpan*(W-.4):lx+bw*(i+.5);
  vertices.push([xx,yy]);
  if(type==='bar')s.addShape(p.ShapeType.rect,{x:xx-bw*.26,y:Math.min(yy,zero),w:bw*.52,h:Math.max(.02,Math.abs(yy-zero)),fill:{color:i%2?'54B0AA':'25818A'},line:{color:'25818A',transparency:100}});
  s.addText(String(+v[1]),{x:xx-.28,y:Math.max(top,yy-.25),w:.56,h:.21,fontSize:10,color:'2A6571',align:'center',margin:0});
  s.addText(v[0].slice(0,10),{x:xx-bw*.5,y:base+.09,w:bw,h:.30,fontSize:10,align:'center',margin:0,fit:'shrink'});
 });
 if(type==='line'){
  for(let i=1;i<vertices.length;i++){
   const p0=vertices[i-1],p1=vertices[i];
   s.addShape(p.ShapeType.line,{x:p0[0],y:Math.min(p0[1],p1[1]),w:p1[0]-p0[0],h:Math.max(.01,Math.abs(p1[1]-p0[1])),flipV:p1[1]<p0[1],line:{color:'25818A',width:2}});
  }
  vertices.forEach(v=>s.addShape(p.ShapeType.ellipse,{x:v[0]-.055,y:v[1]-.055,w:.11,h:.11,fill:{color:'25818A'},line:{color:'FFFFFF',width:1}}));
 }
}
b.onclick=async()=>{
 const api=window.__einsteinPosterV3;
 if(!api||!api.exportReady())return;
 const P=window.pptxgen||window.PptxGenJS;
 if(!P){alert('PPTX 제작 모듈을 불러오지 못했습니다. 인터넷을 확인하세요.');return;}
 b.disabled=true;
 try{
  const p=new P();p.defineLayout({name:'A1_PORTRAIT',width:23.39,height:33.11});p.layout='A1';p.author='은행고등학교 아인슈타인 동아리';
  const s=p.addSlide();s.background={color:'F7FAFC'};
  s.addShape(p.ShapeType.rect,{x:0,y:0,w:23.39,h:3.75,fill:{color:'17324C'},line:{color:'17324C',transparency:100}});
  s.addText('2026 은행고등학교 아인슈타인 동아리',{x:.66,y:.46,w:22.1,h:.55,fontSize:22,bold:true,color:'9BDBDB',margin:0,fontFace:'Malgun Gothic'});
  s.addText('연구제목: '+field('title'),{x:.66,y:1.24,w:22.1,h:1.05,fontSize:42,bold:true,color:'FFFFFF',margin:0,fit:'shrink',fontFace:'Malgun Gothic'});
  s.addText('연구자: '+field('researchers').replace(/\n/g,', ')+(field('group')?' | 모둠: '+field('group'):''),{x:.66,y:2.55,w:22.1,h:.66,fontSize:22,color:'E2F0F0',margin:0,fit:'shrink',fontFace:'Malgun Gothic'});
  card(s,p,'01 연구 배경·필요성',field('background'),.63,4.04,10.85,3.63);
  card(s,p,'02 연구질문·가설','질문: '+field('question')+'\n가설: '+field('hypothesis'),.63,7.95,10.85,3.06);
  card(s,p,'03 재료 및 연구 방법','변인: '+field('variables')+'\n재료: '+field('materials')+'\n절차: '+field('method'),.63,11.28,10.85,6.13);
  photos(s,p,'실험 과정 사진',api.photos.method||[],.63,17.7,10.85,3.96);
  card(s,p,'04 연구 개요·주요 결과',field('abstract')+'\n'+field('results'),11.86,4.04,10.9,4.15);
  graph(s,p,11.86,8.46,10.9,6.99);
  photos(s,p,'실험 결과·관찰 사진',api.photos.result||[],11.86,15.72,10.9,5.94);
  card(s,p,'06 결과 분석·논의',field('discussion'),.63,22.0,10.85,4.55);
  card(s,p,'07 연구 한계 및 개선',field('limitations'),11.86,22.0,10.9,4.55);
  card(s,p,'08 결론',field('conclusion'),.63,26.83,10.85,4.55);
  card(s,p,'09 후속 탐구',field('followup'),11.86,26.83,10.9,4.55);
  s.addShape(p.ShapeType.rect,{x:0,y:31.72,w:23.39,h:1.39,fill:{color:'E6F3F5'},line:{color:'E6F3F5',transparency:100}});
  s.addText('참고문헌 · 연구자 기여',{x:.55,y:31.9,w:4.95,h:.40,fontSize:16,bold:true,color:'287581',margin:0});
  s.addText(field('references')+' | '+field('contributions'),{x:5.5,y:31.81,w:17.35,h:1.05,fontSize:13,color:'527586',margin:0,fit:'shrink'});
  await p.writeFile({fileName:(field('title')||'아인슈타인_연구포스터').slice(0,40)+'_A1.pptx'});
 }catch(e){alert('PPTX 다운로드 실패: '+e.message);}finally{b.disabled=false;}
};
})();