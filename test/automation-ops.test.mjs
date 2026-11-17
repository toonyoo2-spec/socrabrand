import test from 'node:test';
import assert from 'node:assert/strict';
import { AccessError, createSnapshotClient, validateSnapshot, jobsForDay, safeResultURL, mountAutomationOps } from '../automation-ops.mjs';

const item = (id, active = true, days = [0], order = 600) => ({ id, name: id, active, days, order, engine: 'Codex', time: '10:00', schedule: '월 10:00', result: '작업 결과', output: '고정 채팅', verification: '확인 범위', action: '내가 할 일' });
const row = () => ({ checked_at: '2026-11-17T05:01:00Z', payload: { items: [item('first'), item('early', true, [0], 500), item('paused', false)], flows: [{ id: 'flow', name: '흐름', steps: [{ title: '내가 승인', text: '확인 후 진행' }, { job: 'first', text: '실행' }] }], hosts: [{ name: '실행기', state: '확인된 상태' }] } });
const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

test('no token makes no network request', async () => {
  const client = createSnapshotClient({ getToken: () => null, fetchImpl: () => { assert.fail('network called'); } });
  await assert.rejects(client.load(), AccessError);
});
test('nonowner cannot request snapshot even with a token', async () => {
  let calls = 0;
  const client = createSnapshotClient({ getToken: () => 'test', fetchImpl: async () => { calls++; return response(false); } });
  await assert.rejects(client.load(), AccessError); assert.equal(calls, 1);
});
test('owner loads valid snapshot with uncached authenticated requests', async () => {
  const calls = [];
  const client = createSnapshotClient({ getToken: () => 'test', fetchImpl: async (url, options) => { calls.push({ url, options }); return response(calls.length === 1 ? true : [row()]); } });
  assert.equal((await client.load()).items.length, 3);
  assert.equal(calls.length, 2); assert.match(calls[1].url, /automation_ops_snapshots/);
  calls.forEach(({ options }) => { assert.equal(options.cache, 'no-store'); assert.equal(options.headers.Authorization, 'Bearer test'); });
});
test('auth and data endpoint failures never return private data', async () => {
  for (const failAt of [1, 2]) {
    let n = 0;
    const client = createSnapshotClient({ getToken: () => 'test', fetchImpl: async () => ++n === failAt ? response({}, 401) : response(true) });
    await assert.rejects(client.load(), AccessError);
  }
});
test('token change during owner check stops data request', async () => {
  let token = 'first', calls = 0;
  const client = createSnapshotClient({ getToken: () => token, fetchImpl: async () => { calls++; token = 'second'; return response(true); } });
  await assert.rejects(client.load(), AccessError); assert.equal(calls, 1);
});
test('token change while parsing payload discards result', async () => {
  let token = 'first', calls = 0;
  const client = createSnapshotClient({ getToken: () => token, fetchImpl: async () => ++calls === 1 ? response(true) : { ok: true, status: 200, json: async () => { token = null; return [row()]; } } });
  await assert.rejects(client.load(), AccessError);
});
test('invalidation during request prevents stale data from returning', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const client = createSnapshotClient({ getToken: () => 'test', fetchImpl: () => pending });
  const load = client.load(); client.invalidate(); release(response(true));
  await assert.rejects(load, AccessError);
});
test('malformed payload and broken flow references fail visibly', () => {
  for (const mutate of [r => r.checked_at = 'bad', r => r.payload.items.push(item('first')), r => r.payload.items[0].days = [7], r => r.payload.flows[0].steps.push({ job: 'missing' })]) {
    const bad = row(); mutate(bad); assert.throws(() => validateSnapshot(bad));
  }
});
test('day list is sorted, excludes paused entries, does not mutate source', () => {
  const items = row().payload.items; assert.deepEqual(jobsForDay(items, 0).map(x => x.id), ['early', 'first']);
  assert.deepEqual(jobsForDay(items, 6), []); assert.equal(items[0].id, 'first');
});
test('result links reject script, credentials and unapproved destinations', () => {
  for (const url of ['javascript:alert(1)', 'https://claude.ai.evil.example/x', 'https://user:pass@claude.ai/x', 'http://claude.ai/x', '//claude.ai/x', null]) assert.equal(safeResultURL(url), null);
  assert.equal(safeResultURL('https://claude.ai/chat/test'), 'https://claude.ai/chat/test');
});

// Optional DOM adapter, isolated in the task work folder; no browser session or credentials used.
const domModule = process.env.OPS_DOM_MODULE;
test('DOM navigation, nonowner hiding and logout clearing', { skip: !domModule }, async () => {
  const { parseHTML } = await import(domModule);
  const { document } = parseHTML('<html><body><header><div class="stamp"></div></header><nav class="toolbar"><div class="tabs"><button data-map="all" aria-selected="true">기존 지도</button></div><div class="controls"></div></nav><p id="caption"></p><main id="viewport"></main><footer></footer></body></html>');
  const win = new EventTarget(); let token = 'test', allowed = true;
  win.localStorage = { getItem: () => token };
  win.fetch = async url => response(url.includes('/rpc/') ? allowed : [row()]);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const clickText = text => { const b = [...document.querySelectorAll('button')].find(b => b.textContent === text); assert.ok(b, text); b.click(); };
  mountAutomationOps(document, win); await flush();
  assert.equal(document.querySelector('#ops-tab').hidden, false);
  assert.equal(document.querySelector('#viewport').hidden, true);
  assert.match(document.querySelector('#ops-panel').textContent, /자동화 운영 현황/);
  clickText('월'); assert.equal(document.querySelectorAll('.ops-job').length, 2);
  clickText('전체 목록'); assert.equal(document.querySelectorAll('.ops-job').length, 3);
  clickText('업무 흐름'); assert.equal(document.querySelectorAll('.ops-chain li').length, 2);
  document.querySelector('.ops-job').click(); assert.match(document.querySelector('.ops-detail').textContent, /first/);
  clickText('기존 지도'); assert.equal(document.querySelector('#ops-panel').hidden, true); assert.equal(document.querySelector('#viewport').hidden, false);
  clickText('운영 현황'); await flush(); assert.equal(document.querySelector('#ops-panel').hidden, false);
  token = null; const changed = new Event('storage'); changed.key = 'socra_admin_token'; win.dispatchEvent(changed);
  assert.equal(document.querySelector('#ops-tab').hidden, true); assert.equal(document.querySelector('#ops-panel').textContent, '');
  token = 'nonowner'; allowed = false; win.dispatchEvent(changed); await flush();
  assert.equal(document.querySelector('#ops-tab').hidden, true); assert.equal(document.querySelector('#ops-panel').textContent, '');
});
