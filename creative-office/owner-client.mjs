// Owner authorization only. No config/attendance/chat reads or writes.
export function createOwnerClient({url,anonKey,getToken,fetchImpl=fetch}){
 let generation=0;
 const invalidate=()=>{generation++;};
 async function requireOwner(){
  const token=getToken(),version=generation;if(!token)throw Error('로그인이 필요합니다.');
  const r=await fetchImpl(`${url}/rest/v1/rpc/is_agency_owner`,{method:'POST',headers:{apikey:anonKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});
  if(version!==generation||token!==getToken())throw Error('로그인 상태가 바뀌었습니다.');
  if(!r.ok)throw Error('접근 권한을 확인할 수 없습니다.');
  if(await r.json()!==true)throw Error('KWAN 전용 에이전시입니다.');
  if(version!==generation||token!==getToken())throw Error('로그인 상태가 바뀌었습니다.');
  return true;
 }
 return {requireOwner,invalidate};
}
