export const CONFIG_KEY='creative_six_office_v1';
export const ROLES=[
 {code:'CD',name:'크리에이티브 디렉터',role:'브랜드 고유 아이디어',color:'#f2b69b'},
 {code:'AD',name:'아트 디렉터',role:'아트 · 콘티 · 공간',color:'#9dc8bb'},
 {code:'COPY',name:'카피라이터',role:'카피 · 질문 · 말맛',color:'#dfb9da'},
 {code:'AE',name:'어카운트 플래너',role:'브리프 · 타깃 · 근거',color:'#b5c8e6'},
 {code:'DIRECTOR',name:'디렉터',role:'숏폼 · 롱폼 · 연출',color:'#e8cd8f'},
 {code:'KWAN',name:'KWAN',role:'건설적 비판 · 최종 검수',color:'#b6cda4'}];
export function kstDate(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function createOfficeClient({url,anonKey,getToken,fetchImpl=fetch}){
 let generation=0;
 const invalidate=()=>{generation++;};
 async function request(path,options={}){
  const token=getToken(),version=generation;if(!token)throw new Error('로그인이 필요해요.');
  const response=await fetchImpl(`${url}/rest/v1/${path}`,{...options,headers:{apikey:anonKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers}});
  if(version!==generation||token!==getToken())throw new Error('로그인 상태가 바뀌었어요. 다시 열어주세요.');
  if(!response.ok)throw new Error(response.status===401||response.status===403?'접근 권한을 확인할 수 없어요.':'저장소에 연결하지 못했어요. 잠시 후 다시 시도해주세요.');
  return response.json();
 }
 async function requireOwner(){const allowed=await request('rpc/is_agency_owner',{method:'POST',body:'{}'});if(allowed!==true)throw new Error('KWAN 전용 사무실이에요.');return true;}
 async function load(){await requireOwner();const rows=await request(`agency_config?key=eq.${CONFIG_KEY}&select=value,updated_at`);if(rows.length!==1)throw new Error('사무실 저장소 준비가 필요해요.');return rows[0];}
 async function setAttendance(snapshot,codes,state,now=new Date()){
  if(!['in','out'].includes(state)||!codes.length||codes.some(c=>!ROLES.some(r=>r.code===c)))throw new Error('출퇴근 대상을 확인해주세요.');
  await requireOwner();
  const value=structuredClone(snapshot.value),date=kstDate(now);
  if(value.attendance_date!==date){value.attendance={};value.attendance_date=date;}
  const at=now.toISOString();for(const code of codes)value.attendance[code]={state,at,source:'kwan_manual'};
  value.attendance_events=[...(value.attendance_events||[]),{at,codes,state,source:'kwan_manual'}].slice(-120);
  const stamp=new Date(Math.max(now.getTime(),Date.parse(snapshot.updated_at)+1)).toISOString();
  const rows=await request(`agency_config?key=eq.${CONFIG_KEY}&updated_at=eq.${encodeURIComponent(snapshot.updated_at)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({value,updated_at:stamp})});
  if(rows.length!==1)throw new Error('다른 화면에서 변경됐어요. 새로고침한 뒤 다시 눌러주세요.');
  return rows[0];
 }
 return {requireOwner,load,setAttendance,invalidate};
}
