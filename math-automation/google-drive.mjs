const scope = 'https://www.googleapis.com/auth/drive';
const pptxMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const slidesMime = 'application/vnd.google-apps.presentation';
const folderMime = 'application/vnd.google-apps.folder';
const projectionLayout = 'badge-projection-5';
const driveApi = 'https://www.googleapis.com/drive/v3/';
let ready;

export function prepareGoogleDrive() {
  ready ??= Promise.all([
    fetch(new URL('../lesson-notes/config.json', import.meta.url)).then(response => {
      if (!response.ok) throw Error('Google 연결 설정을 읽을 수 없습니다.');
      return response.json();
    }),
    new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) return resolve();
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;
      script.onerror = () => reject(Error('Google 연결을 준비하지 못했습니다.'));
      document.head.append(script);
    }),
  ]).then(([config]) => config.googleClientId).catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}

function checkGoogleResponse(response, message) {
  if (!response.ok) throw Error(message);
  return response.json();
}

export async function connectStaffGoogle(requiredScope) {
  const clientId = await prepareGoogleDrive();
  const token = await new Promise((resolve, reject) => {
    window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email ' + requiredScope,
      include_granted_scopes: false,
      hd: 'socra.ai',
      callback: result => {
        if (!result.access_token || !requiredScope.split(' ').every(item => String(result.scope).split(' ').includes(item))) {
          reject(Error('이 작업에 필요한 Google 권한을 확인해 주세요.'));
          return;
        }
        resolve(result.access_token);
      },
      error_callback: () => reject(Error('Google 계정 선택을 취소했습니다.')),
    }).requestAccessToken({ prompt: 'select_account' });
  });
  const headers = { Authorization: 'Bearer ' + token };
  const profile = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers, cache: 'no-store' })
    .then(r => checkGoogleResponse(r, 'Google 계정 정보를 확인하지 못했습니다.'));
  if (profile.email_verified !== true || !/^[^@]+@socra\.ai$/i.test(profile.email)) {
    throw Error('회사 Google 계정(@socra.ai)으로 연결해 주세요.');
  }
  return { headers, email: profile.email };
}

export function connectStaffDrive() {
  return connectStaffGoogle(scope);
}

async function drivePages(connection, resource, params, key) {
  const items = [];
  const query = new URLSearchParams(params);
  for (;;) {
    const response = await fetch(driveApi + resource + '?' + query, { headers:connection.headers, cache:'no-store' });
    const page = await checkGoogleResponse(response, 'Google Drive 폴더를 불러오지 못했습니다.');
    items.push(...(page[key] ?? []));
    if (!page.nextPageToken) return items;
    query.set('pageToken', page.nextPageToken);
  }
}

export async function listSharedDrives(connection) {
  const drives = await drivePages(connection, 'drives', {
    pageSize:'100', fields:'nextPageToken,drives(id,name,capabilities(canAddChildren))',
  }, 'drives');
  return drives.map(drive => ({ ...drive, driveId:drive.id, canAddChildren:drive.capabilities?.canAddChildren !== false }));
}

function fileId(id) {
  if (!/^[A-Za-z0-9_-]+$/.test(id ?? '')) throw Error('선택한 Google Drive 폴더를 확인해 주세요.');
  return id;
}

function folderQuery(folder) {
  return folder.driveId
    ? { supportsAllDrives:'true', includeItemsFromAllDrives:'true', corpora:'drive', driveId:fileId(folder.driveId) }
    : { supportsAllDrives:'true', corpora:'user' };
}

export async function listDriveFolders(connection, folder) {
  const files = await drivePages(connection, 'files', {
    ...folderQuery(folder), q:"trashed = false and '" + fileId(folder.id) + "' in parents and mimeType = '" + folderMime + "'",
    orderBy:'name_natural', pageSize:'100', fields:'nextPageToken,files(id,name,driveId,capabilities(canAddChildren))',
  }, 'files');
  return files.map(file => ({ ...file, canAddChildren:file.capabilities?.canAddChildren === true }));
}

export function folderDestination(input) {
  let url;
  try { url = new URL(input.trim()); } catch { /* Invalid folder link. */ }
  const id = url?.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)\/?$/)?.[1];
  const key = url?.searchParams.get('resourcekey') || '';
  if (!id || url.origin !== 'https://drive.google.com' || url.username || url.password || (key && !/^[A-Za-z0-9_-]+$/.test(key))) {
    throw Error('슬라이드를 저장할 Google Drive 폴더 주소를 입력해 주세요.');
  }
  return { id, key, url:'https://drive.google.com/drive/folders/' + id + (key ? '?resourcekey=' + key : '') };
}

export async function openDestinationFolder(connection, destination) {
  const headers = { ...connection.headers };
  if (destination.key) headers['X-Goog-Drive-Resource-Keys'] = destination.id + '/' + destination.key;
  const folder = await fetch(driveApi + 'files/' + destination.id + '?supportsAllDrives=true&fields=id,mimeType,driveId,trashed,capabilities(canAddChildren)', { headers, cache:'no-store' })
    .then(r => checkGoogleResponse(r, '연결한 Google 계정으로 저장 폴더를 열 수 없습니다.'));
  if (folder.trashed || folder.mimeType !== folderMime || !folder.capabilities?.canAddChildren) throw Error('연결한 Google 계정에 이 폴더의 저장 권한이 없습니다.');
  return { ...folder, resourceKey:destination.key, canAddChildren:true };
}

function slidesEditUrl(file) {
  if (file.mimeType !== slidesMime || !/^[A-Za-z0-9_-]+$/.test(file.id ?? '')) {
    throw Error('Google 프레젠테이션으로 저장됐는지 확인하지 못했습니다.');
  }
  return 'https://docs.google.com/presentation/d/' + file.id + '/edit';
}

const savedSlideIds = new Map();
function savedId(key) {
  try { return savedSlideIds.get(key) || globalThis.sessionStorage?.getItem(key); }
  catch { return savedSlideIds.get(key); }
}
function rememberId(key, file) {
  const url = slidesEditUrl(file);
  savedSlideIds.set(key,file.id);
  try { globalThis.sessionStorage?.setItem(key,file.id); } catch { /* In-memory fallback. */ }
  return url;
}

export async function saveSlidesToStaffDrive(connection, blob, name, submission, folder, beforeWrite = async () => {}, layout = projectionLayout, priorReceipt) {
  const parent = fileId(folder.id);
  const headers={...connection.headers};
  if (folder.resourceKey) headers['X-Goog-Drive-Resource-Keys']=parent+'/'+folder.resourceKey;
  if (!folder.canAddChildren) throw Error('이 폴더에는 파일을 저장할 수 없습니다.');
  const key = 'socra-slide/' + parent + '/' + fileId(submission);
  const candidates = [{id:savedId(key),submission}, priorReceipt].filter(candidate=>candidate?.id);
  let confirmed;
  for (const hint of candidates) {
    const response = await fetch(driveApi+'files/'+fileId(hint.id)+'?supportsAllDrives=true&fields=id,parents,mimeType,trashed,appProperties',{headers,cache:'no-store'});
    if (response.status===404) continue;
    const file = await checkGoogleResponse(response,'기존 슬라이드의 저장 위치를 확인하지 못했습니다.');
    if (file.trashed || file.mimeType!==slidesMime || !file.parents?.includes(parent) || file.appProperties?.socraMathSubmission!==hint.submission) continue;
    if (hint.submission===submission && file.appProperties.socraMathLayout===layout) return rememberId(key,file);
    confirmed=file;
    break;
  }
  const submissionFilter = sid => "appProperties has { key='socraMathSubmission' and value='" + fileId(sid) + "' }";
  const searchIds = [...new Set([submission,priorReceipt?.submission].filter(Boolean))];
  const lookup = new URLSearchParams({
    ...folderQuery(folder),
    q: "trashed = false and '" + parent + "' in parents and mimeType = '" + slidesMime +
      "' and (" + searchIds.map(submissionFilter).join(' or ') + ")",
    fields: 'nextPageToken,files(id,mimeType,appProperties)', pageSize: '100',
  });
  const { files } = await fetch(driveApi + 'files?' + lookup, { headers, cache: 'no-store' })
    .then(response => checkGoogleResponse(response, '내 드라이브에서 저장 여부를 확인하지 못했습니다.'));
  const current = files.find(file => file.appProperties?.socraMathSubmission === submission && file.appProperties?.socraMathLayout === layout);
  if (current) return rememberId(key,current);
  const predecessors = {
    'han-quiz-ppt-3':['han-lesson-intro-2','han-lesson-intro-1','han-lesson-only-1'],
    'beam-lesson-intro-3':['beam-lesson-intro-2','beam-lesson-intro-1'],
    'han-lesson-intro-1':['han-lesson-only-1'],
  };
  const family = layout.split('@')[0];
  const knownLayouts = [...(predecessors[family] ?? []), family, projectionLayout];
  if (family.startsWith('lx-gothic-v2-')) knownLayouts.push(family.replace('lx-gothic-v2-','lx-sample-v1-'));
  if (family.startsWith('lx-') || family==='han-gothic-v4') knownLayouts.push('han-quiz-ppt-3','beam-lesson-intro-3',...Object.values(predecessors).flat());
  const previous = files.filter(file => knownLayouts.includes(file.appProperties?.socraMathLayout?.split('@')[0]) || (priorReceipt?.submission && file.appProperties?.socraMathSubmission===priorReceipt.submission));
  if (previous.length > 1) throw Error('같은 제출본의 이전 슬라이드가 두 개 이상 있습니다. 저장 폴더를 확인해 주세요.');
  const existing = previous[0] ?? confirmed;
  if (typeof blob === 'function') blob = await blob();
  await beforeWrite();
  const path = 'https://www.googleapis.com/upload/drive/v3/files' + (existing ? '/' + fileId(existing.id) : '');
  const start = await fetch(path + '?uploadType=resumable&supportsAllDrives=true&fields=id,mimeType', {
    method: existing ? 'PATCH' : 'POST',
    headers: { ...headers, 'Content-Type': 'application/json',
      'X-Upload-Content-Type': pptxMime, 'X-Upload-Content-Length': String(blob.size) },
    body: JSON.stringify({ name, mimeType: slidesMime, ...(existing ? {} : { parents:[parent] }),
      appProperties: { socraMathSubmission: submission, socraMathLayout: layout } }),
  });
  if (!start.ok) throw Error('Google Drive에서 저장을 시작하지 못했습니다.');
  const session = start.headers.get('location');
  if (!session) throw Error('Google Drive 저장 주소를 받지 못했습니다.');
  const location = new URL(session);
  if (location.origin !== 'https://www.googleapis.com' || !location.pathname.startsWith('/upload/drive/')) {
    throw Error('Google Drive 저장 주소가 올바르지 않습니다.');
  }
  await beforeWrite();
  const uploaded = await fetch(location.href, {
    method: 'PUT', headers: { ...headers, 'Content-Type': pptxMime }, body: blob,
  }).then(response => checkGoogleResponse(response, '내 Google Drive에 프레젠테이션을 저장하지 못했습니다.'));
  return rememberId(key,uploaded);
}
