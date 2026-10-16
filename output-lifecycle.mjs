// Only this application's explicitly staged outputs can ever be trashed.
const DRIVE='https://www.googleapis.com/drive/v3',FOLDER='application/vnd.google-apps.folder';
const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
export function createOutputLifecycle({generator,request,readRevision,storage=globalThis.localStorage,now=()=>Date.now(),uuid=()=>crypto.randomUUID(),listen=globalThis.addEventListener?.bind(globalThis)}){
 const owner=uuid(),active=new Set();let key='socra:pending-outputs:'+generator,timer;
 function setAccount(account){const next='socra:pending-outputs:'+generator+':'+String(account||'unknown');if(next===key)return;if(active.size)throw Error('저장 중에는 계정을 변경할 수 없습니다.');key=next;}
 function entries(){try{const value=JSON.parse(storage?.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
 function put(run){const all=entries();all[run.runId]=run;try{storage?.setItem(key,JSON.stringify(all));}catch{}}
 function drop(run){const all=entries();delete all[run.runId];try{storage?.setItem(key,JSON.stringify(all));}catch{}active.delete(run.runId);if(!active.size){clearInterval(timer);timer=null;}}
 function heartbeat(){for(const id of active){const run=entries()[id];if(run){run.leaseUntil=now()+180000;put(run);}}}
 listen?.('pagehide',()=>{for(const id of active){const run=entries()[id];if(run){run.abandoned=true;run.leaseUntil=0;put(run);}}});
 async function list(q){let files=[],pageToken;do{const params=new URLSearchParams({q:q+' and trashed=false',fields:'nextPageToken,files(id,name,mimeType,parents,version,appProperties,webViewLink)',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});if(pageToken)params.set('pageToken',pageToken);const {data}=await request(DRIVE+'/files?'+params);files.push(...(data.files||[]));pageToken=data.nextPageToken;}while(pageToken);return files;}
 async function prepare(destination,title,mimeType,extra={}){
  const folders=await list(`'${esc(destination.id)}' in parents and mimeType='${FOLDER}' and appProperties has { key='generator' and value='${esc(generator)}' } and appProperties has { key='outputState' and value='staging-folder' }`);
  const folder=folders[0]||(await request(DRIVE+'/files?supportsAllDrives=true&fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'생성 중 · 임시',mimeType:FOLDER,parents:[destination.id],appProperties:{generator,outputState:'staging-folder'}})})).data;
  const run={runId:uuid(),owner,destinationId:destination.id,stagingId:folder.id,title,mimeType,leaseUntil:now()+180000};put(run);active.add(run.runId);if(!timer){timer=setInterval(heartbeat,30000);timer.unref?.();}
  return {run,metadata:{name:'[생성 중] '+title,mimeType,parents:[folder.id],appProperties:{...extra,generator,validation:'pending',outputState:'pending',runId:run.runId,destinationId:destination.id}}};
 }
 function track(run,file){run.fileId=file.id;run.createdVersion=file.version?String(file.version):null;put(run);}
 function revision(run,value){if(value){run.expectedRevision=String(value);put(run);}}
 async function publish(run,validation='passed'){
  if(storage&&(!entries()[run.runId]||entries()[run.runId].abandoned))throw Error('페이지 이동으로 중단된 임시 결과입니다. 다시 저장해 주세요.');
  const params=new URLSearchParams({supportsAllDrives:'true',addParents:run.destinationId,removeParents:run.stagingId,fields:'id,name,mimeType,parents,webViewLink,appProperties'});
  const {data}=await request(DRIVE+'/files/'+encodeURIComponent(run.fileId)+'?'+params,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:run.title,appProperties:{validation,outputState:'complete',verifiedRevision:run.expectedRevision||''}})});if(data.name!==run.title||!data.parents?.includes(run.destinationId)||data.parents?.includes(run.stagingId)||data.appProperties?.outputState!=='complete')throw Error('정식 결과 위치·완료 상태를 확인하지 못했습니다.');drop(run);return data;
 }
 async function discard(run){
  if(!run.fileId){const found=await list(`appProperties has { key='runId' and value='${esc(run.runId)}' } and appProperties has { key='generator' and value='${esc(generator)}' }`);if(found.length!==1)return {state:'protected',id:run.stagingId,url:'https://drive.google.com/drive/folders/'+run.stagingId,reason:'생성 결과를 확실하게 식별할 수 없음'};run.fileId=found[0].id;put(run);}
  const {data:file,etag}=await request(DRIVE+'/files/'+encodeURIComponent(run.fileId)+'?supportsAllDrives=true&fields=id,name,trashed,mimeType,parents,version,appProperties,webViewLink');
  const props=file.appProperties||{};
  if(file.trashed){drop(run);return {state:'cleaned',id:file.id};}
  if(props.outputState==='complete'||['passed','complete'].includes(props.validation)){drop(run);return {state:'complete',id:file.id};}
  if(props.generator!==generator||props.outputState!=='pending'||props.runId!==run.runId||!file.parents?.includes(run.stagingId))return {state:'protected',id:file.id,reason:'임시 파일 소유·경로를 확인할 수 없음'};
  if(!etag)return {state:'protected',id:file.id,reason:'동시 수정 여부를 확인할 수 없음'};
  let unchanged=false;
  if(run.expectedRevision&&readRevision)unchanged=await readRevision(file.id)===run.expectedRevision;
  else unchanged=Boolean(run.createdVersion&&file.version&&String(file.version)===run.createdVersion);
  if(!unchanged)return {state:'protected',id:file.id,url:file.webViewLink,reason:'수정되었거나 수정 여부를 확인할 수 없음'};
  try{await request(DRIVE+'/files/'+encodeURIComponent(file.id)+'?supportsAllDrives=true',{method:'PATCH',headers:{'Content-Type':'application/json','If-Match':etag},body:JSON.stringify({trashed:true})});drop(run);return {state:'cleaned',id:file.id};}
  catch(error){if(error.status===412)return {state:'protected',id:file.id,reason:'점검 이후 수정됨'};throw error;}
 }
 async function failed(run){active.delete(run.runId);run.abandoned=true;run.leaseUntil=0;put(run);try{return await discard(run);}catch(error){return {state:'protected',id:run.fileId,reason:error.message};}finally{if(!active.size){clearInterval(timer);timer=null;}}}
 async function cleanup(){const results=[];for(const run of Object.values(entries())){if(active.has(run.runId)||(!run.abandoned&&run.leaseUntil>now()))continue;try{results.push(await discard(run));}catch(error){results.push({state:'protected',id:run.fileId,reason:error.message});}}return results;}
 return {setAccount,prepare,track,revision,publish,failed,cleanup};
}
