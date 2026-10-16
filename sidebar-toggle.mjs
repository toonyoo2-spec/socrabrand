const app=document.getElementById('appContainer'),nav=app?.querySelector('.nav-bar-wrapper');
if(app&&nav){
 app.classList.add('top-navigation');
 const key='socra:archive-index:expanded';let expanded=false;try{expanded=localStorage.getItem(key)==='true';}catch{}
 const button=document.createElement('button');button.type='button';button.id='archive-index-toggle';
 const contents=nav.querySelector('.nav-bar-container');if(contents){contents.id='archive-index-contents';button.setAttribute('aria-controls',contents.id);nav.prepend(button);
 function render(){contents.hidden=!expanded;button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'날짜 · 프로젝트 목차 접기':'날짜 · 프로젝트 목차 보기';}
 button.onclick=()=>{expanded=!expanded;render();try{localStorage.setItem(key,String(expanded));}catch{}};render();}
 const menu=app.querySelector('.main-menu-wrapper');
 const oldLogout=document.getElementById('logoutBtn');if(menu&&oldLogout){const logout=document.createElement('button');logout.id='site-logout';logout.type='button';logout.textContent='로그아웃';logout.onclick=e=>oldLogout.onclick?.call(oldLogout,e);const separator=oldLogout.previousSibling;if(separator?.nodeType===3&&/^[\s\u00a0]*·[\s\u00a0]*$/.test(separator.textContent))separator.remove();oldLogout.remove();const small=matchMedia('(max-width:1023px)'),place=()=>{(small.matches?app.querySelector('header'):menu).append(logout);};small.addEventListener('change',place);place();}
 const closeLx=()=>{const trigger=document.getElementById('lectureTab'),submenu=document.getElementById('lxSubmenu');if(trigger&&submenu){trigger.setAttribute('aria-expanded','false');submenu.hidden=true;}};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLx();});app.querySelectorAll('.main-menu-container>a').forEach(link=>link.addEventListener('click',closeLx));
 menu?.setAttribute('role','navigation');menu?.setAttribute('aria-label','주요 카테고리');
}
