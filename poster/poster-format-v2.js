(function(){
function style(url){var c=document.createElement('link');c.rel='stylesheet';c.href=url;document.head.appendChild(c);}
function script(url,after){var s=document.createElement('script');s.src=url;s.onload=function(){if(after)after();};s.onerror=function(){console.warn('포스터 기능 로드 실패:',url);};document.body.appendChild(s);}
style('./poster-fixed-a1-v3.css?v=6');
style('./poster-portrait-v4.css?v=6');
var frame=document.querySelector('.poster-frame');
if(frame){var note=document.createElement('div');note.className='poster-fit-message';note.id='posterFitStatus';note.textContent='A1 세로형 1장 · 글자 크기는 입력량에 맞춰 자동 조절됩니다.';frame.before(note);}
script('./poster-adaptive-v3.js?v=6',function(){
 script('./poster-table-v4.js?v=6',function(){
  script('./poster-pptx-portrait-v4.js?v=6');
 });
});
})();