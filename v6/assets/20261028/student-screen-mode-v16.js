(function(){
 'use strict';
 var control=document.getElementById('studentScreenMode');
 if(!control)return;
 var key='einstein_student_screen_mode_v16';
 var allowed={auto:1,phone:1,tablet:1,desktop:1};
 function apply(mode){
  if(!allowed[mode])mode='auto';
  document.body.classList.remove('student-view-phone','student-view-tablet','student-view-desktop');
  if(mode!=='auto')document.body.classList.add('student-view-'+mode);
  control.value=mode;
  try{localStorage.setItem(key,mode);}catch(e){}
 }
 var initial='auto';
 try{initial=localStorage.getItem(key)||'auto';}catch(e){}
 apply(initial);
 control.addEventListener('change',function(){apply(control.value);});
})();