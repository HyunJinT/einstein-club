
(function(){
  function showInitError(message){
    var el=document.getElementById('stepContent');
    if (!el || el.querySelector('.section-title')) return;
    var title=document.createElement('div');
    title.style='margin:18px 0;padding:17px;border:1px solid #e0b6b0;border-radius:10px;background:#fff6f5;color:#8c2727;white-space:pre-wrap';
    title.textContent='학생 입력 화면을 시작하지 못했습니다. 새로고침 후에도 해결되지 않으면 아래 오류를 담당 교사에게 알려주세요.\n'+String(message||'JavaScript 실행이 차단되었습니다.');
    el.replaceChildren(title);
  }
  window.__einsteinShowInitError=showInitError;
  window.addEventListener('error',function(e){showInitError(e.message||'스크립트 실행 오류');});
  window.addEventListener('unhandledrejection',function(e){showInitError(e.reason&&e.reason.message||'비동기 초기화 오류');});
  window.addEventListener('load',function(){setTimeout(function(){var el=document.getElementById('stepContent');if(el && !document.getElementById('studentWorkspace').hidden && !el.querySelector('.section-title'))showInitError('학생 입력 화면이 나타나지 않았습니다.');},1800);});
})();
