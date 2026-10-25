import {createOwnerClient} from './owner-client.mjs';
import {renderOffice,OFFICE_MEMBERS} from './office-view.mjs?v=20261025-agency10';
import {EXISTING_CHAT} from './roster.mjs';
const root=document.querySelector('#office-root');
const url='https://eoljasmgogdcvnytaoax.supabase.co';
const anonKey='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbGphc21nb2dkY3ZueXRhb2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzIwMDEsImV4cCI6MjEwMTQ0ODAwMX0.G8wiFPCgvzoDwGlk__SDkn8SxP6lDMHY6g6pt61-a5o';
const getToken=()=>localStorage.getItem('socra_admin_token');
const client=createOwnerClient({url,anonKey,getToken});let epoch=0,dispose,requestDraft='';
function lock(message){requestDraft='';epoch++;client.invalidate();dispose?.destroy();root.replaceChildren();const section=document.createElement('section');section.className='office-gate';const h=document.createElement('h1');h.textContent='KWAN 전용 에이전시';const p=document.createElement('p');p.textContent=message;const a=document.createElement('a');a.href='./';a.textContent='Socrabrand 로그인으로';section.append(h,p,a);root.append(section);}
function requestPanel(){
 const section=document.createElement('section');section.className='co-chat-request';section.innerHTML='<h2>Grace에게 요청하기</h2><p>요청을 복사해 기존 Codex 채팅에 붙여 넣고 보내세요. 이 화면은 자동 전송하거나 응답을 표시하지 않습니다.</p><label for="agency-request">요청</label><textarea id="agency-request" rows="5" placeholder="작업할 내용과 원하는 결과를 적어주세요"></textarea><div class="co-request-actions"><button type="button" data-copy>요청 복사</button><a data-open-chat>이 Codex 채팅 열기 ↗</a></div><p data-status role="status" aria-live="polite"></p>';
 const text=section.querySelector('textarea'),status=section.querySelector('[data-status]');text.value=requestDraft;text.addEventListener('input',()=>{requestDraft=text.value;});const openChat=section.querySelector('[data-open-chat]');if(window.parent!==window){const guide=document.createElement('span');guide.textContent='요청 복사 후 사이트 상단의 ‘이 Codex 채팅 열기’를 눌러주세요.';guide.style.cssText='font-size:12px;line-height:1.6;color:#71675e';openChat.replaceWith(guide);}else{openChat.href=EXISTING_CHAT.url;}
 section.querySelector('[data-copy]').addEventListener('click',async()=>{if(!text.value.trim()){status.textContent='요청을 먼저 적어주세요.';return;}try{await navigator.clipboard.writeText(text.value);status.textContent=window.parent!==window?'복사했습니다. 사이트 상단의 채팅 열기를 누르고, 붙여 넣은 뒤 보내세요.':'복사했습니다. 채팅을 열어 붙여 넣은 뒤 보내세요.';}catch{text.select();status.textContent='자동 복사가 차단됐습니다. 선택된 요청을 직접 복사해주세요.';}});return section;
}
async function load(){const version=++epoch;try{await client.requireOwner();if(version!==epoch)return;dispose?.destroy();root.replaceChildren();const mount=document.createElement('div');root.append(mount);dispose=renderOffice(mount,{authorized:true,profileOnly:true,members:OFFICE_MEMBERS,onRefresh:load,connectionState:'소유자 확인 · 실행 상태는 Codex에서 확인'});mount.querySelector('.co-header').after(requestPanel());}catch(e){if(version===epoch)lock(e.message);}}
window.addEventListener('storage',e=>{if(['socra_admin_token','socra_user_id'].includes(e.key)){client.invalidate();if(getToken())load();else lock('로그아웃되어 에이전시를 잠갔습니다.');}});
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='socra:office-lock')lock('로그아웃되어 에이전시를 잠갔습니다.');});
load();
