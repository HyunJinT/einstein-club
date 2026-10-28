(function(){
const b=document.getElementById('savePptx');if(!b)return;
const field=k=>document.querySelector('[data-key="'+k+'"]')?.value||'';
function card(s,p,title,text,x,y,w,h,fs=19){
 s.addShape(p.ShapeType.roundRect,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'D8E5EA'}});
 s.addText(title,{x:x+.3,y:y+.18,w:w-.6,h:.45,margin:0,fontSize:20,bold:true,color:'137581',fontFace:'Malgun Gothic'});
 if(text)s.addText(text,{x:x+.3,y:y+.78,w:w-.6,h:h-.9,fontSize:fs,margin:.06,color:'345366',valign:'top',fit:'shrink',fontFace:'Malgun Gothic'});
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
 s.addText(field('graphTitle')+' '+field('graphUnit'),{x:x+.4,y:y+.83,w:w-.8,h:.35,fontSize:15,color:'466A79',margin:0,fit:'shrink'});
 const rows=field('graphData').split(/\r?\n/).map(v=>v.split(/[,，\t]/)).filter(v=>v.length>1&&v[0].trim()&&Number.isFinite(+v[1])).slice(0,9);
 if(!rows.length)return;
 const hi=Math.max(1,...rows.map(v=>+v[1]))*1.08,lo=Math.min(0,...rows.map(v=>+v[1])),rg=hi-lo;
 const lx=x+.85,top=y+1.56,W=w-1.45,H=h-2.44,bw=W/rows.length,zero=top+H-(0-lo)*H/rg;
 rows.forEach((v,i)=>{
  const yy=top+H-(+v[1]-lo)*H/rg,xx=lx+i*bw+bw*.19;
  s.addShape(p.ShapeType.rect,{x:xx,y:Math.min(yy,zero),w:bw*.60,h:Math.max(.02,Math.abs(yy-zero)),fill:{color:i%2?'54B0AA':'25818A'},line:{color:'25818A',transparency:100}});
  s.addText(v[0].slice(0,10),{x:lx+i*bw,y:top+H+.10,w:bw,h:.32,fontSize:10,align:'center',margin:0,fit:'shrink'});
 });
}
b.onclick=async()=>{
 const api=window.__einsteinPosterV3;
 if(!api||!api.exportReady())return;
 const P=window.pptxgen||window.PptxGenJS;
 if(!P){alert('PPTX 제작 모듈을 불러오지 못했습니다. 인터넷을 확인하세요.');return;}
 b.disabled=true;
 try{
  const p=new P();p.defineLayout({name:'A1',width:33.11,height:23.39});p.layout='A1';p.author='은행고등학교 아인슈타인 동아리';
  const s=p.addSlide();s.background={color:'F7FAFC'};
  s.addShape(p.ShapeType.rect,{x:0,y:0,w:33.11,h:3.45,fill:{color:'17324C'},line:{color:'17324C',transparency:100}});
  s.addText('2026 은행고등학교 아인슈타인 동아리',{x:.85,y:.46,w:31,h:.55,fontSize:22,bold:true,color:'9BDBDB',margin:0,fontFace:'Malgun Gothic'});
  s.addText('연구제목: '+field('title'),{x:.85,y:1.25,w:31,h:1,fontSize:50,bold:true,color:'FFFFFF',margin:0,fit:'shrink',fontFace:'Malgun Gothic'});
  s.addText('연구자: '+field('researchers').replace(/\n/g,', ')+(field('group')?' | 모둠: '+field('group'):''),{x:.85,y:2.50,w:31,h:.58,fontSize:22,color:'E2F0F0',margin:0,fit:'shrink',fontFace:'Malgun Gothic'});
  card(s,p,'01 연구 배경·필요성',field('background'),.65,3.79,10,3.75);
  card(s,p,'02 연구질문·가설','질문: '+field('question')+'\n가설: '+field('hypothesis'),.65,7.87,10,3.30);
  card(s,p,'03 재료 및 연구 방법','변인: '+field('variables')+'\n재료: '+field('materials')+'\n절차: '+field('method'),.65,11.50,10,6.58);
  photos(s,p,'실험 과정 사진',api.photos.method||[],.65,18.4,10,3.85);
  card(s,p,'04 연구 개요·주요 결과',field('abstract')+'\n'+field('results'),11.04,3.79,11.65,4.50);
  graph(s,p,11.04,8.64,11.65,7.36);
  photos(s,p,'실험 결과·관찰 사진',api.photos.result||[],11.04,16.35,11.65,5.9);
  card(s,p,'06 결과 분석·논의',field('discussion'),23.1,3.79,9.36,6.08);
  card(s,p,'07 연구 한계 및 개선',field('limitations'),23.1,10.25,9.36,4.09);
  card(s,p,'08 결론',field('conclusion'),23.1,14.72,9.36,3.61);
  card(s,p,'09 후속 탐구',field('followup'),23.1,18.68,9.36,3.57);
  s.addShape(p.ShapeType.rect,{x:0,y:22.52,w:33.11,h:.87,fill:{color:'E6F3F5'},line:{color:'E6F3F5',transparency:100}});
  s.addText('참고문헌 · 연구자 기여',{x:.7,y:22.67,w:5.2,h:.35,fontSize:16,bold:true,color:'287581',margin:0});
  s.addText(field('references')+' | '+field('contributions'),{x:6,y:22.62,w:26.1,h:.52,fontSize:13,color:'527586',margin:0,fit:'shrink'});
  await p.writeFile({fileName:(field('title')||'아인슈타인_연구포스터').slice(0,40)+'_A1.pptx'});
 }catch(e){alert('PPTX 다운로드 실패: '+e.message);}finally{b.disabled=false;}
};
})();