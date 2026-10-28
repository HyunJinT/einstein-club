(function(){
'use strict';
const poster=document.getElementById('posterCanvas'),shell=document.getElementById('posterShell');
const original=document.querySelector('textarea[data-key="graphData"]');
if(!poster||!shell||!original)return;
const MAX_ROWS=9,KEY='einstein_poster_graph_options_v4';
const $=id=>document.getElementById(id);
let options={type:'bar',xAxis:'실험 조건'},rows=[],setting=false;
try{const old=JSON.parse(localStorage.getItem(KEY)||'{}');if(old&&typeof old==='object')options=Object.assign(options,old);}catch(e){}
function resize(){
 const width=shell.getBoundingClientRect().width;
 if(!width)return;
 shell.style.height=(width*1120/792)+'px';
 poster.style.setProperty('--scale',String(width/792));
}
function parseData(s){
 return String(s||'').split(/\r?\n/).map(v=>v.split(/[,，\t]/)).filter(a=>a.length>=2&&a[0].trim()).slice(0,MAX_ROWS).map(a=>({condition:a[0].trim(),value:a[1].trim()}));
}
rows=parseData(original.value);
if(!rows.length)rows=[{condition:'',value:''},{condition:'',value:''},{condition:'',value:''}];
function make(tag,props,children){
 const el=document.createElement(tag);
 for(const [k,v] of Object.entries(props||{})){if(k==='text')el.textContent=v;else if(k==='class')el.className=v;else el.setAttribute(k,v);}
 for(const c of children||[])el.appendChild(c);
 return el;
}
const container=make('section',{class:'poster-graph-table','aria-label':'표로 그래프 작성하기'});
container.innerHTML="<div class=\"poster-graph-head\"><strong>📊 조작 변인(X축)과 종속 변인(Y축)을 표에 입력하세요</strong><label>그래프 종류 <select id=\"posterGraphType\"><option value=\"bar\">막대그래프 · 범주별 비교</option><option value=\"line\">꺾은선그래프 · 연속된 변화</option></select></label></div><div class=\"poster-graph-help\">① 위 입력칸에서 <b>조작 변인·종속 변인의 이름과 단위</b>를 각각 입력하세요.<br>② 왼쪽 칸에는 <b>조작 변인의 값(X)</b>, 오른쪽 칸에는 <b>종속 변인의 측정값(Y)</b>을 입력하세요. 단위는 각 축에 한 번만 입력하면 됩니다.</div><table><thead><tr><th scope=\"col\" style=\"width:48%\">조작 변인(X축) 값</th><th scope=\"col\">종속 변인(Y축) 측정값</th><th scope=\"col\" style=\"width:43px\">삭제</th></tr></thead><tbody id=\"posterGraphRows\"></tbody></table><button type=\"button\" class=\"add-graph-row\" id=\"posterAddGraphRow\">+ 실험 조건 추가</button><details style=\"margin-top:12px\"><summary style=\"font-size:12px;font-weight:700;cursor:pointer\">표 입력 예시 · 가상 데이터</summary><div class=\"mini-table-example\">X축: 과산화수소 농도 / 단위: %<br>Y축: 효모 생존율 / 단위: %<br><b>조작 변인 값</b> 0 → <b>종속 변인 값</b> 95<br><b>조작 변인 값</b> 0.5 → <b>종속 변인 값</b> 72<br><b>조작 변인 값</b> 1.0 → <b>종속 변인 값</b> 38<br>수치는 입력법을 보여주는 가상의 예시이며 실제 실험 결과가 아닙니다.</div></details><p class=\"poster-graph-help\">꺾은선그래프는 연속적으로 변하는 조작 변인에 사용하세요. 수치 조건은 작은 값부터 큰 값 순서로 입력하세요.</p>";
const field=original.closest('.field');if(field){field.appendChild(container);field.style.position='relative';original.style.display='none';}
$('posterGraphType').dataset.key='graphType';
$('posterGraphType').value=options.type==='line'?'line':'bar';
const axisInput=k=>document.querySelector('[data-key="'+k+'"]');
const xName=axisInput('graphXLabel'),xUnit=axisInput('graphXUnit'),yName=axisInput('graphYLabel'),yUnit=axisInput('graphUnit');
if(xName&&!xName.value&&options.xAxis&&options.xAxis!=='실험 조건'){xName.value=options.xAxis;xName.dispatchEvent(new Event('input',{bubbles:true}));}
if(yName&&yUnit&&!yName.value){
 const m=(yUnit.value||'').match(/^(.{2,30})\s*\((.{1,12})\)$/);
 if(m){yName.value=m[1].trim();yUnit.value=m[2].trim();yName.dispatchEvent(new Event('input',{bubbles:true}));yUnit.dispatchEvent(new Event('input',{bubbles:true}));}
}
function rowsUI(){
 const body=$('posterGraphRows');body.replaceChildren();
 rows.forEach((entry,i)=>{
  const tr=make('tr',{'data-row':i});
  const left=make('td'),right=make('td'),controls=make('td');
  const name=make('input',{type:'text','aria-label':(i+1)+'번째 조작 변인 값',placeholder:'예: 0.5',maxlength:'30','data-col':'condition'});name.value=entry.condition;left.appendChild(name);
  const val=make('input',{type:'number',step:'any','aria-label':(i+1)+'번째 종속 변인 값',placeholder:'예: 72','data-col':'value'});val.value=entry.value;right.appendChild(val);
  const del=make('button',{type:'button',class:'remove-graph-row','data-delete':i,title:(i+1)+'번째 행 삭제','aria-label':(i+1)+'번째 행 삭제',text:'×'});controls.appendChild(del);
  tr.append(left,right,controls);body.appendChild(tr);
 });
 $('posterAddGraphRow').disabled=rows.length>=MAX_ROWS;
}
function saveOptions(){try{localStorage.setItem(KEY,JSON.stringify(options));}catch(e){}}
function sync(){
 const lines=rows.filter(r=>r.condition.trim()||r.value.trim()).map(r=>[r.condition.trim().replace(/[,，\t\n]/g,' '),r.value.trim()].join(', '));
 setting=true;original.value=lines.join('\n');original.dispatchEvent(new Event('input',{bubbles:true}));setting=false;
 saveOptions();
 requestAnimationFrame(draw);
}
$('posterGraphRows').addEventListener('input',e=>{
 const tr=e.target.closest('[data-row]'),col=e.target.dataset.col;
 if(!tr||!['condition','value'].includes(col))return;
 rows[+tr.dataset.row][col]=e.target.value;sync();
});
$('posterGraphRows').addEventListener('click',e=>{
 const b=e.target.closest('[data-delete]');if(!b)return;
 rows.splice(+b.dataset.delete,1);if(!rows.length)rows=[{condition:'',value:''}];
 rowsUI();sync();
});
$('posterAddGraphRow').addEventListener('click',()=>{
 if(rows.length>=MAX_ROWS)return;
 rows.push({condition:'',value:''});rowsUI();
 const last=$('posterGraphRows').lastElementChild;last?.querySelector('input')?.focus();
});
function onType(e){options.type=e.target.value==='line'?'line':'bar';saveOptions();draw();}
$('posterGraphType').addEventListener('change',onType);
$('posterGraphType').addEventListener('input',onType);
for(const el of [xName,xUnit,yName,yUnit])if(el)el.addEventListener('input',()=>{if(el===xName){options.xAxis=xName.value.slice(0,28);saveOptions();}draw();});
original.addEventListener('input',()=>{
 if(setting)return;
 const incoming=parseData(original.value);
 rows=incoming.length?incoming:[{condition:'',value:''},{condition:'',value:''},{condition:'',value:''}];
 rowsUI();requestAnimationFrame(draw);
});
function svgEl(tag,attrs,content){
 const ns='http://www.w3.org/2000/svg',el=document.createElementNS(ns,tag);
 for(const [k,v] of Object.entries(attrs||{}))el.setAttribute(k,String(v));
 if(content!=null)el.textContent=String(content);
 return el;
}
function draw(){
 const area=$('pChart');if(!area)return;
 const points=rows.filter(r=>r.condition.trim()&&r.value.trim()&&Number.isFinite(+r.value)).slice(0,MAX_ROWS);
 if(!points.length){area.textContent='표에 조작 변인 값과 종속 변인 측정값을 입력하면 그래프가 표시됩니다.';area.style.fontSize='11px';area.style.color='#8098a8';return;}
 const svg=svgEl('svg',{viewBox:'0 0 365 172',role:'img','aria-label':'학생 입력 수치로 만든 '+(options.type==='line'?'꺾은선그래프':'막대그래프')});
 const values=points.map(r=>+r.value),minimum=Math.min(0,...values),maximum=Math.max(1,...values),limit=maximum===minimum?maximum+1:maximum*1.1,range=Math.max(.00001,limit-minimum);
 const L=49,T=24,W=285,H=105;
 const y=v=>T+H-(v-minimum)*H/range;
 const grid=svgEl('g');for(let k=0;k<5;k++){
  const tick=minimum+(limit-minimum)*k/4,yy=y(tick);
  grid.appendChild(svgEl('line',{x1:L,y1:yy,x2:L+W,y2:yy,stroke:'#dfe8ed','stroke-dasharray':'3 4'}));
  const label=svgEl('text',{x:L-6,y:yy+3,'text-anchor':'end','font-size':8,fill:'#627e8f'},Math.round(tick*100)/100);grid.appendChild(label);
 }
 svg.appendChild(grid);
 svg.appendChild(svgEl('line',{x1:L,y1:T,x2:L,y2:T+H,stroke:'#6d8fa1','stroke-width':1}));
 svg.appendChild(svgEl('line',{x1:L,y1:T+H,x2:L+W,y2:T+H,stroke:'#6d8fa1','stroke-width':1}));
 const span=W/points.length,coords=[];
 const numericX=points.map(p=>{const m=p.condition.trim().match(/^[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null;});
 const useNumericX=options.type==='line'&&numericX.every(Number.isFinite)&&Math.max(...numericX)>Math.min(...numericX);
 const xMin=useNumericX?Math.min(...numericX):0,xRange=useNumericX?Math.max(...numericX)-xMin:1;
 points.forEach((d,i)=>{
  const xx=useNumericX?L+11+(numericX[i]-xMin)/xRange*(W-22):L+span*(i+.5),yy=y(+d.value);coords.push([xx,yy]);
  if(options.type==='bar'){
   const w=span*.52;
   svg.appendChild(svgEl('rect',{x:xx-w/2,y:Math.min(yy,y(0)),width:w,height:Math.max(1,Math.abs(yy-y(0))),rx:2,fill:i%2?'#60b5ad':'#27818b'}));
  }
  svg.appendChild(svgEl('text',{x:xx,y:Math.max(T+8,yy-5),'text-anchor':'middle','font-size':8,fill:'#215c6b'},+d.value));
  svg.appendChild(svgEl('text',{x:xx,y:145,'text-anchor':'middle','font-size':8,fill:'#456879'},d.condition.slice(0,9)));
 });
 if(options.type==='line'){
  const d=coords.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  svg.appendChild(svgEl('path',{d,fill:'none',stroke:'#218d96','stroke-width':2.5,'stroke-linejoin':'round'}));
  coords.forEach(([cx,cy])=>svg.appendChild(svgEl('circle',{cx,cy,r:3.3,fill:'#218d96',stroke:'#fff','stroke-width':1})));
 }
 area.replaceChildren(svg);
 const xLabel=(xName?.value.trim()||'조작 변인')+(xUnit?.value.trim()?' ('+xUnit.value.trim()+')':'');
 const yLabel=(yName?.value.trim()||'종속 변인')+(yUnit?.value.trim()?' ('+yUnit.value.trim()+')':'');
 svg.appendChild(svgEl('text',{x:185,y:166,'text-anchor':'middle','font-size':8,fill:'#557789'},xLabel.slice(0,43)));
 svg.appendChild(svgEl('text',{x:185,y:13,'text-anchor':'middle','font-size':8,fill:'#557789'},yLabel.slice(0,43)));
 svg.setAttribute('data-einstein-graph-v4','1');
 const title=$('pGraphTitle');if(title&&!document.querySelector('[data-key="graphTitle"]')?.value.trim())title.textContent='연구 결과 그래프';
 const unit=$('pGraphUnit');if(unit)unit.textContent=yLabel;
}
const observedChart=$('pChart');
if(observedChart){
 const graphObserver=new MutationObserver(()=>{
  if(rows.some(r=>r.condition.trim()&&r.value.trim()&&Number.isFinite(+r.value))&&!observedChart.querySelector('svg[data-einstein-graph-v4]'))requestAnimationFrame(draw);
 });
 graphObserver.observe(observedChart,{childList:true});
}
const graphField=original.closest('.field');
if(graphField){
 const label=graphField.querySelector('label');if(label)label.textContent='조작 변인(X) · 종속 변인(Y) 데이터';
 const note=graphField.querySelector('.hint');if(note)note.textContent='조작 변인(X축) 값과 종속 변인(Y축) 측정값을 표에 입력하세요.';
}
const introText=document.querySelector('.intro p');
if(introText)introText.textContent='왼쪽에 연구 내용을 입력하면 오른쪽 A1 세로형 포스터가 자동으로 바뀝니다. 데이터는 표로 입력하여 그래프를 만들 수 있습니다. 완성 후 PDF 또는 PPTX로 저장하세요.';
const topTitle=document.querySelector('.appbar .right');
if(topTitle)topTitle.textContent='A1 세로 · 2단 연구포스터';
const previewMeta=document.querySelector('.preview-head .print-meta');
if(previewMeta)previewMeta.textContent='A1 · 세로형 · 594 × 841 mm';
function viewFix(){const width=shell.getBoundingClientRect().width;if(width>0){shell.style.height=(width*1120/792)+'px';poster.style.setProperty('--scale',String(width/792));}}
window.addEventListener('resize',()=>requestAnimationFrame(viewFix));
const nativeInput=document.querySelector('[data-key="graphTitle"]');
if(nativeInput)nativeInput.addEventListener('input',()=>requestAnimationFrame(draw));
const prevPdf=$('savePdf')?.onclick;
if($('savePdf'))$('savePdf').onclick=function(e){viewFix();draw();if(prevPdf)prevPdf.call(this,e);};
const prevBackup=$('saveJson')?.onclick;
if($('saveJson'))$('saveJson').onclick=function(e){saveOptions();if(prevBackup)prevBackup.call(this,e);};
rowsUI();viewFix();setTimeout(()=>{viewFix();draw();},200);
window.__einsteinPosterGraphV4={getType:()=>options.type,getXAxis:()=>options.xAxis,getRows:()=>rows.filter(r=>r.condition.trim()&&Number.isFinite(+r.value))};
})();