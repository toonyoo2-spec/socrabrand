const app=document.getElementById('appContainer'),nav=app?.querySelector('.nav-bar-wrapper');
if(app&&nav){
 app.classList.add('top-navigation');
 const key='socra:archive-index:expanded';let expanded=false;try{expanded=localStorage.getItem(key)==='true';}catch{}
 const button=document.createElement('button');button.type='button';button.id='archive-index-toggle';
 const contents=nav.querySelector('.nav-bar-container');if(contents){contents.id='archive-index-contents';button.setAttribute('aria-controls',contents.id);nav.prepend(button);
 function render(){contents.hidden=!expanded;button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'날짜 · 프로젝트 목차 접기':'날짜 · 프로젝트 목차 보기';}
 button.onclick=()=>{expanded=!expanded;render();try{localStorage.setItem(key,String(expanded));}catch{}};render();}
 const menu=app.querySelector('.main-menu-wrapper');menu?.setAttribute('role','navigation');menu?.setAttribute('aria-label','주요 카테고리');
}
