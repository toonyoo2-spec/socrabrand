import {discoverFiles} from './discovery.mjs?v=20261016-groups-7';
import {slideText,sheetRequests} from './core.mjs?v=20261016-discovery-1';
import {createSharedGoogleSession} from '../google-session.mjs?v=20261016-shared-1';
import {driveBrowseQuery} from '../drive-browser.mjs?v=20261016-paths-1';
import {pairFiles} from './request.mjs?v=20261016-groups-7';
let token='',expiry=0,clientId='';
const session=createSharedGoogleSession();
function clearSession(){token='';expiry=0;session.clear();}
export async function restoreGoogle(){const saved=session.read(clientId);if(!saved){token='';expiry=0;return null;}token=saved.token;expiry=saved.expiresAt;try{return await api('https://www.googleapis.com/oauth2/v3/userinfo');}catch(e){if(!connected())return null;throw e;}}
const DRIVE='https://www.googleapis.com/drive/v3',FOLDER='application/vnd.google-apps.folder';
export async function setupGoogle(){const r=await fetch('./lesson-notes/config.json',{cache:'no-store'});if(!r.ok)throw Error('Google 연결 설정을 읽지 못했습니다.');clientId=(await r.json()).googleClientId;if(!clientId)throw Error('Google 연결 설정이 비어 있습니다.');}
export function connected(){return token&&Date.now()<expiry;}
export function disconnect(){if(token&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(token,()=>{});clearSession();}
export function connect(){return new Promise((resolve,reject)=>{if(!clientId||!window.google?.accounts?.oauth2)return reject(Error('Google 로그인 준비 중입니다. 잠시 후 다시 눌러 주세요.'));google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'openid email profile https://www.googleapis.com/auth/drive',callback:async r=>{if(r.error)return reject(Error('Google 연결을 완료하지 못했습니다.'));token=r.access_token;expiry=Date.now()+Number(r.expires_in)*1000-60000;try{const user=await api('https://www.googleapis.com/oauth2/v3/userinfo');session.save(clientId,token,expiry);resolve(user);}catch(e){clearSession();reject(e);}},error_callback:()=>reject(Error('로그인 팝업을 닫았거나 열지 못했습니다. 다시 연결해 주세요.'))}).requestAccessToken({prompt:'select_account'});});}
export async function api(url,options={}){if(!connected())throw Error('Google 계정을 연결해 주세요.');const r=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(60000)});const data=await r.json();if(!r.ok){if(r.status===401){clearSession();throw Error('연결이 만료되었습니다. Google 계정을 다시 연결해 주세요.');}throw Error(data.error?.message||'Google 요청을 처리하지 못했습니다.');}return data;}
const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
export function idFrom(value,type='folder'){const s=String(value).trim();if(/^[\w-]{15,}$/.test(s))return s;const u=new URL(s);const re=type==='folder'?/\/(?:drive\/)?(?:u\/\d+\/)?folders\/([\w-]+)/:/\/presentation\/d\/([\w-]+)/;const m=u.pathname.match(re);if(u.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(u.hostname)||!m)throw Error(type==='folder'?'Drive 폴더 링크를 입력해 주세요.':'Google Slides PPT 링크를 입력해 주세요.');return m[1];}
export function fileInfo(id){return api(`${DRIVE}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink,capabilities(canAddChildren)`);}
async function list(q){let files=[],pageToken;do{const p=new URLSearchParams({q:q+' and trashed=false',fields:'nextPageToken,files(id,name,mimeType,parents,webViewLink,capabilities(canAddChildren))',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true',orderBy:'name_natural'});if(pageToken)p.set('pageToken',pageToken);const x=await api(DRIVE+'/files?'+p);files.push(...x.files);pageToken=x.nextPageToken;}while(pageToken);return files;}
export async function loadPlan(input,mode='folder',audioInput='',onProgress=()=>{}){
  onProgress('프롬프트 폴더 정보 확인 중');
  if(mode==='presentation'){
    const f=await fileInfo(idFrom(input,'presentation'));
    if(f.mimeType!=='application/vnd.google-apps.presentation')throw Error('Google Slides 형식의 PPT를 선택해 주세요.');
    if(!f.parents?.length)throw Error('PPT가 들어 있는 폴더를 확인할 수 없습니다.');
    const plan=await loadPlan(f.parents[0],'folder',audioInput,onProgress);
    plan.files=plan.files.filter(x=>x.id===f.id);return plan;
  }
  const source=await fileInfo(idFrom(input));
  if(source.mimeType!==FOLDER)throw Error('PPT가 실제로 들어 있는 폴더 링크를 입력해 주세요.');
  const combinedRoot=!audioInput.trim();
  if(!combinedRoot&&source.parents?.length!==1)throw Error('프롬프트 폴더의 상위 폴더를 하나로 확인할 수 없습니다. 저장 위치를 확인해 주세요.');
  const course=combinedRoot?source:await fileInfo(source.parents[0]);
  const pptScan=await discoverFiles(source,id=>list(`'${esc(id)}' in parents`),'ppt',{onProgress:p=>onProgress(`PPT 하위 폴더 ${p.foldersScanned}개 탐색 · PPT ${p.files}개 발견`)});const files=pptScan.files;
  if(!files.length)throw Error('선택한 폴더에 Google Slides PPT가 없습니다. PPT를 포함하는 상위 폴더를 선택해 주세요.');
  if(files.length>100)throw Error('한 번에 100개 이하의 PPT를 선택해 주세요.');
  onProgress('오디오 폴더 정보 확인 중');
  const audioFolder=audioInput.trim()?await fileInfo(idFrom(audioInput)):source;
  if(audioFolder.mimeType!==FOLDER)throw Error('MP3·WAV가 들어 있는 오디오 폴더를 선택해 주세요.');
  const audioScan=await discoverFiles(audioFolder,id=>list(`'${esc(id)}' in parents`),'audio',{onProgress:p=>onProgress(`오디오 하위 폴더 ${p.foldersScanned}개 탐색 · 음원 ${p.files}개 발견`)});const audios=audioScan.files;
  const audioWarning=audios.length?'':'선택한 오디오 폴더에 MP3·WAV 파일이 없습니다.';
  let analyzed=0;onProgress(`PPT 표현 분석 0/${files.length}개`);
  for(let i=0;i<files.length;i+=4)await Promise.all(files.slice(i,i+4).map(async f=>{const deck=await readSlides(f.id);f.slides=deck.slides.map((s,j)=>({number:j+1,text:slideText(s)}));onProgress(`PPT 표현 분석 ${++analyzed}/${files.length}개`);}));
  return {files:pairFiles(files,audios).sort((a,b)=>(a.groupLabel||'').localeCompare(b.groupLabel||'','ko')||(a.lectureNumber??Infinity)-(b.lectureNumber??Infinity)||(a.expression??0)-(b.expression??0)),course,source,combinedRoot,audioFolder,audios,audioWarning,discovery:{pptFolders:pptScan.foldersScanned,audioFolders:audioScan.foldersScanned}};
}
export function readSlides(id){return api('https://slides.googleapis.com/v1/presentations/'+encodeURIComponent(id));}
export async function destination(plan,input,file){if(input.trim()){const f=await fileInfo(idFrom(input));if(f.mimeType!==FOLDER||!f.capabilities?.canAddChildren)throw Error('저장할 폴더의 편집 권한을 확인해 주세요.');return f;}
if(!plan?.source?.id||!plan?.course?.id)throw Error('프롬프트 폴더와 오디오 폴더를 다시 연결해 주세요.');
const source=await fileInfo(plan.source.id);
if(!plan.combinedRoot&&(source.parents?.length!==1||source.parents[0]!==plan.course.id))throw Error('프롬프트 폴더의 상위 경로가 변경되었습니다. 다시 연결한 뒤 저장해 주세요.');
const parent=await fileInfo(plan.course.id);
const folders=await list(`'${esc(parent.id)}' in parents and mimeType='${FOLDER}' and name='편집스크립트'`);if(folders.length>1)throw Error('편집스크립트 폴더가 여러 개입니다. 저장 폴더를 직접 지정해 주세요.');if(folders.length){if(!folders[0].capabilities?.canAddChildren)throw Error('편집스크립트 폴더에 저장 권한이 없습니다.');return folders[0];}if(!parent.capabilities?.canAddChildren)throw Error('상위 폴더에 저장 권한이 없습니다. 저장할 폴더를 지정해 주세요.');return api(DRIVE+'/files?supportsAllDrives=true&fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'편집스크립트',mimeType:FOLDER,parents:[parent.id]})});}
export async function saveSheet({rows,title,folder,source,requests}){const name=title+' · 편집스크립트';const prior=await list(`'${esc(folder.id)}' in parents and name='${esc(name)}' and mimeType='application/vnd.google-apps.spreadsheet'`);if(prior.length)return {duplicate:true,file:prior[0]};
const f=await api(DRIVE+'/files?supportsAllDrives=true&fields=id,name,webViewLink',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.spreadsheet',parents:[folder.id],appProperties:{generator:'socra-editing-script',sourcePresentationId:source,validation:'pending'}})});
try{const meta=await api(`https://sheets.googleapis.com/v4/spreadsheets/${f.id}?fields=spreadsheetId,sheets.properties`);const sid=meta.sheets[0].properties.sheetId;await api(`https://sheets.googleapis.com/v4/spreadsheets/${f.id}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:requests(sid)})});const actual=await api(`https://sheets.googleapis.com/v4/spreadsheets/${f.id}/values/A1:E${rows.length+1}`);const expected=rows.map(r=>r.values.map(c=>c.userEnteredValue.stringValue));if(!Array.isArray(actual.values)||actual.values.length!==expected.length||expected.some((r,i)=>r.some((v,j)=>v!== (actual.values[i]?.[j]||''))))throw Error('시트 내용 검증이 일치하지 않습니다.');await api(`${DRIVE}/files/${f.id}?supportsAllDrives=true`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({appProperties:{validation:'complete'}})});return {file:f};}catch(e){throw Error(`시트를 만들었지만 검증을 완료하지 못했습니다. https://docs.google.com/spreadsheets/d/${f.id}/edit · ${e.message}`);}}

export function browseDrive(options){return list(driveBrowseQuery(options,esc));}

export async function loadSelectedPlan(files,audioInput,onProgress=()=>{}){if(!files.length)throw Error('PPT를 선택해 주세요.');const details=await Promise.all(files.map(f=>fileInfo(f.id)));const parents=new Set(details.map(f=>f.parents?.[0]));if(parents.size!==1||parents.has(undefined))throw Error('편집스크립트는 같은 프롬프트 폴더 안의 파일을 함께 선택해 주세요.');const plan=await loadPlan('https://drive.google.com/drive/folders/'+details[0].parents[0],'folder',audioInput,onProgress);const ids=new Set(files.map(f=>f.id));plan.files=plan.files.filter(f=>ids.has(f.id));if(new Set(plan.files.map(f=>f.id)).size!==files.length)throw Error('선택한 PPT를 모두 찾지 못했습니다. Google Slides 파일인지 확인해 주세요.');return plan;}

// Resolve the actual ancestors for both pasted links and selected files.
export async function folderTrail(folder){const trail=[],seen=new Set();let current=folder;for(let i=0;current&&i<40;i++){if(seen.has(current.id))break;seen.add(current.id);trail.unshift(current);if(current.parents?.length!==1)break;try{current=await fileInfo(current.parents[0]);}catch{break;}}return trail;}
export async function audioBrowseStart(input,mode='folder',selected=[]){let folder;if(selected.length||mode==='presentation'){const file=await fileInfo(selected[0]?.id||idFrom(input,'presentation'));if(file.parents?.length!==1)throw Error('프롬프트 폴더 위치를 확인할 수 없습니다.');folder=await fileInfo(file.parents[0]);}else folder=await fileInfo(idFrom(input));if(folder.mimeType!==FOLDER||folder.parents?.length!==1)throw Error('프롬프트 폴더의 상위 위치를 확인할 수 없습니다.');const parent=await fileInfo(folder.parents[0]);return {folder:parent,trail:await folderTrail(parent)};}
export async function saveLecture({parts,title,folder,source}){
 if(!parts.length||parts.some(p=>!p.rows?.length))throw Error('현재 강의의 모든 표현에 전사·검수 결과를 준비해 주세요.');
 const prior=await list(`'${esc(folder.id)}' in parents and name='${esc(title+' · 편집스크립트')}' and mimeType='application/vnd.google-apps.spreadsheet'`);
 if(prior.length)return {duplicate:true,file:prior[0]};
 const f=await api(DRIVE+'/files?supportsAllDrives=true&fields=id,name,webViewLink',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:title+' · 편집스크립트',mimeType:'application/vnd.google-apps.spreadsheet',parents:[folder.id],appProperties:{generator:'socra-editing-script',sourcePresentationId:source,validation:'pending'}})});
 try{const meta=await api(`https://sheets.googleapis.com/v4/spreadsheets/${f.id}?fields=spreadsheetId,sheets.properties`);const first=meta.sheets[0].properties.sheetId;const requests=[],checks=[];
 for(let i=0;i<parts.length;i++){const p=parts[i],sid=i===0?first:Math.max(first+1,1000)+i;const sheetTitle=p.tabName||'편집스크립트';if(i)requests.push({addSheet:{properties:{sheetId:sid,title:sheetTitle}}});
 const data=sheetRequests(p.rows,p.name,{lecture:p.lectureNumber?`${p.lectureNumber}강`:title,audioName:p.audio.name,presentationUrl:`https://docs.google.com/presentation/d/${source}/edit`,videoUrl:`https://drive.google.com/file/d/${p.audio.id}/view`});
 data.rows[2].values[3].userEnteredValue.stringValue=`PPT ${p.slideStart||1}~${p.slideEnd||p.slides?.at(-1)?.number||'?'}쪽 / RT는 이 탭 오디오 00:00 기준`;
 requests.push({updateSheetProperties:{properties:{sheetId:sid,title:sheetTitle,gridProperties:{frozenRowCount:6,frozenColumnCount:1,columnCount:5,rowCount:Math.max(1000,data.rows.length)}},fields:'title,gridProperties'}},{updateCells:{range:{sheetId:sid,startRowIndex:0,startColumnIndex:0},rows:data.rows,fields:'userEnteredValue'}},{repeatCell:{range:{sheetId:sid,startRowIndex:0,endRowIndex:data.rows.length,startColumnIndex:0,endColumnIndex:5},cell:{userEnteredFormat:{wrapStrategy:'WRAP',verticalAlignment:'TOP'}},fields:'userEnteredFormat'}},{repeatCell:{range:{sheetId:sid,startRowIndex:5,endRowIndex:6,startColumnIndex:0,endColumnIndex:5},cell:{userEnteredFormat:{textFormat:{bold:true},backgroundColor:{red:.87,green:.95,blue:.9}}},fields:'userEnteredFormat'}},...[180,220,170,700,800].map((pixelSize,j)=>({updateDimensionProperties:{range:{sheetId:sid,dimension:'COLUMNS',startIndex:j,endIndex:j+1},properties:{pixelSize},fields:'pixelSize'}})),...p.rows.map((r,j)=>({updateCells:{range:{sheetId:sid,startRowIndex:j+6,endRowIndex:j+7,startColumnIndex:3,endColumnIndex:4},rows:[{values:[{note:`PPT ${r.slide||'대응 확인'}쪽\n${(r.flags||[]).join('\n')}`,userEnteredFormat:{textFormat:{strikethrough:r.status==='미사용'}}}]}],fields:'note,userEnteredFormat.textFormat.strikethrough'}})));
 checks.push({sheetTitle,data});}
 await api(`https://sheets.googleapis.com/v4/spreadsheets/${f.id}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests})});
 for(const {sheetTitle,data} of checks){const range="'"+sheetTitle.replace(/'/g,"''")+"'!A1:E"+data.rows.length;const actual=await api(`https://sheets.googleapis.com/v4/spreadsheets/${f.id}/values/${encodeURIComponent(range)}`);const expected=data.rows.map(r=>r.values.map(c=>c.userEnteredValue.stringValue));if(actual.values?.length!==expected.length||expected.some((r,i)=>r.some((v,j)=>v!==(actual.values[i]?.[j]||''))))throw Error(sheetTitle+' 탭의 내용 검증이 일치하지 않습니다.');}
 await api(`${DRIVE}/files/${f.id}?supportsAllDrives=true`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({appProperties:{validation:'complete'}})});return {file:f};
 }catch(e){throw Error(`생성 문서 검증 미완료: https://docs.google.com/spreadsheets/d/${f.id}/edit · ${e.message}`);}
}
