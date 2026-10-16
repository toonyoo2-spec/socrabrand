import {createOfficeClient,ROLES,kstDate} from './client.mjs';
import {renderOffice,OFFICE_MEMBERS} from './office-view.mjs?v=20261017-title';
const root=document.querySelector('#office-root');
const url='https://eoljasmgogdcvnytaoax.supabase.co';
// The public anon key identifies the project. Authorization comes from the JWT and server-side owner/RLS checks.
const anonKey='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbGphc21nb2dkY3ZueXRhb2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzIwMDEsImV4cCI6MjEwMTQ0ODAwMX0.G8wiFPCgvzoDwGlk__SDkn8SxP6lDMHY6g6pt61-a5o';
const getToken=()=>localStorage.getItem('socra_admin_token');
const client=createOfficeClient({url,anonKey,getToken});let snapshot=null,epoch=0,dispose;
function lock(message){epoch++;client.invalidate();snapshot=null;dispose?.destroy();root.replaceChildren();const box=document.createElement('section');box.className='office-gate';const h=document.createElement('h1');h.textContent='KWAN의 작은 사무실';const p=document.createElement('p');p.textContent=message;const a=document.createElement('a');a.href='./';a.textContent='Socrabrand 로그인으로';box.append(h,p,a);root.append(box);}
function currentAttendance(){if(!snapshot||snapshot.value.attendance_date!==kstDate())return {};return Object.fromEntries(Object.entries(snapshot.value.attendance||{}).map(([code,item])=>[code.toLowerCase(),{status:item.state,checkedInAt:item.state==='in'?item.at:undefined,checkedOutAt:item.state==='out'?item.at:undefined}]));}
async function attendance(id,state){snapshot=await client.setAttendance(snapshot,[id.toUpperCase()],state);return {attendance:currentAttendance()};}
function draw(){dispose?.destroy();root.replaceChildren();const mount=document.createElement('div');root.append(mount);const value=snapshot.value;
 dispose=renderOffice(mount,{authorized:true,members:OFFICE_MEMBERS,attendance:currentAttendance(),learning:{observedCount:value.learning?.observed_count,candidateCount:value.learning?.candidate_count,verifiedAudioCount:value.learning?.direct_audio_count},onClockIn:id=>attendance(id,'in'),onClockOut:id=>attendance(id,'out'),onRefresh:load,onOpenReferences:()=>document.querySelector('#recent-cases')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}),updatedAt:snapshot.updated_at,connectionState:'소유자 권한 확인됨'});
 const details=document.createElement('section');details.id='recent-cases';details.className='office-learning-records';details.style.cssText='max-width:1200px;margin:0 auto;padding:24px;';const heading=document.createElement('h2');heading.textContent='최근 직접 확인한 레퍼런스';details.append(heading);
 for(const card of value.learning?.recent_cases||[]){const article=document.createElement('article');article.style.cssText='padding:14px 0;border-bottom:1px solid #dce4dc';const link=document.createElement('a');link.textContent=card.title;try{const parsed=new URL(card.url);if(parsed.protocol==='https:')link.href=parsed.href;}catch{}link.target='_blank';link.rel='noopener noreferrer';const p=document.createElement('p');p.textContent=`${card.category==='advertising'?'광고':'브랜디드'} · 화면 ${card.frames}시점 확인 · 전편·음향 검증 대기`;article.append(link,p);details.append(article);}
 const status=document.createElement('p');status.textContent=value.api_status?.message||'분석 연결 상태 미확인';details.append(status);root.append(details);
}
async function load(){const version=++epoch;try{const result=await client.load();if(version!==epoch)return;snapshot=result;draw();}catch(e){if(version===epoch)lock(e.message);}}
window.addEventListener('storage',e=>{if(['socra_admin_token','socra_user_id'].includes(e.key)){client.invalidate();if(getToken())load();else lock('로그아웃되어 사무실을 잠갔어요.');}});
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='socra:office-lock')lock('로그아웃되어 사무실을 잠갔어요.');});
load();
