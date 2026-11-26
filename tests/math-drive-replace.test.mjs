// Saving a regenerated deck: an edited or hand-made deck is replaced by a new file and moved to
// the trash only after the new file is stored; an untouched deck is overwritten in place.
import test from 'node:test';
import assert from 'node:assert/strict';

const folder = {id:'folder1', canAddChildren:true};
const name = '[RA 수학] 중1-1 실력 탄탄_01강 (한태인)';
const connection = {headers:{Authorization:'Bearer t'}};

function drive(files) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url), method = init.method ?? 'GET';
    calls.push(method + ' ' + u.pathname + (init.body && typeof init.body === 'string' ? ' ' + init.body : ''));
    const json = body => ({ok:true, status:200, headers:{get:()=>null}, json:async()=>body});
    if (u.pathname.startsWith('/upload/drive/v3/files') && u.searchParams.get('uploadType') === 'resumable')
      return {ok:true, status:200, headers:{get:h=>h==='location' ? 'https://www.googleapis.com/upload/drive/v3/files?upload_id=1' : null}};
    if (method === 'PUT') return json({id:'new1', mimeType:'application/vnd.google-apps.presentation'});
    if (method === 'PATCH') return json({});
    if (u.pathname.endsWith('/files')) return json({files});
    return {ok:false, status:404, headers:{get:()=>null}, json:async()=>({})};
  };
  return calls;
}

test('an edited deck is replaced by a new file, then trashed', async () => {
  const {saveSlidesToStaffDrive} = await import('../math-automation/google-drive.mjs?' + Math.random());
  const calls = drive([{id:'old1', name, mimeType:'application/vnd.google-apps.presentation',
    appProperties:{socraMathSubmission:'s1', socraMathLayout:'lx-lora-v4-han-rpm-1', socraMathSavedAt:'2026-11-24T01:48:00Z'},
    modifiedTime:'2026-11-26T00:39:00Z'}]);
  await saveSlidesToStaffDrive(connection, new Blob(['x']), name, 's1', folder, async()=>{}, 'lx-lora-v5-han-rpm-1', {submission:'s1'});
  const post = calls.findIndex(c => c.startsWith('POST /upload/drive/v3/files')), put = calls.findIndex(c => c.startsWith('PUT'));
  const trash = calls.findIndex(c => c.includes('/files/old1') && c.includes('"trashed":true'));
  assert.ok(post >= 0, '새 파일을 만들지 않았습니다: ' + calls.join(' | '));
  assert.ok(trash > put, '새 파일 저장 뒤에 이전 파일을 휴지통으로 보내야 합니다: ' + calls.join(' | '));
});

test('an untouched deck is overwritten in place and nothing is trashed', async () => {
  const {saveSlidesToStaffDrive} = await import('../math-automation/google-drive.mjs?' + Math.random());
  const calls = drive([{id:'old2', name, mimeType:'application/vnd.google-apps.presentation',
    appProperties:{socraMathSubmission:'s1', socraMathLayout:'lx-lora-v4-han-rpm-1', socraMathSavedAt:'2026-11-24T01:48:00Z'},
    modifiedTime:'2026-11-24T01:49:00Z'}]);
  await saveSlidesToStaffDrive(connection, new Blob(['x']), name, 's1', folder, async()=>{}, 'lx-lora-v5-han-rpm-1', {submission:'s1'});
  assert.ok(calls.some(c => c.startsWith('PATCH /upload/drive/v3/files/old2')), calls.join(' | '));
  assert.ok(!calls.some(c => c.includes('"trashed":true')), calls.join(' | '));
});

test('a hand-made deck with the same name is trashed after the new file is saved', async () => {
  const {saveSlidesToStaffDrive} = await import('../math-automation/google-drive.mjs?' + Math.random());
  const calls = drive([{id:'hand1', name, mimeType:'application/vnd.google-apps.presentation', modifiedTime:'2026-11-26T00:00:00Z'}]);
  await saveSlidesToStaffDrive(connection, new Blob(['x']), name, 's1', folder, async()=>{}, 'lx-lora-v5-han-rpm-1', null);
  const put = calls.findIndex(c => c.startsWith('PUT')), trash = calls.findIndex(c => c.includes('/files/hand1') && c.includes('"trashed":true'));
  assert.ok(put >= 0 && trash > put, calls.join(' | '));
});
