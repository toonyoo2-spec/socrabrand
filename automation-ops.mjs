// Private records are fetched only after server-side owner authorization.
const API = 'https://eoljasmgogdcvnytaoax.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbGphc21nb2dkY3ZueXRhb2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzIwMDEsImV4cCI6MjEwMTQ0ODAwMX0.G8wiFPCgvzoDwGlk__SDkn8SxP6lDMHY6g6pt61-a5o';
const TOKEN_KEY = 'socra_admin_token';
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export class AccessError extends Error {}

export function validateSnapshot(row) {
  const data = row?.payload;
  if (!data || !Array.isArray(data.items) || !Array.isArray(data.flows) || !Array.isArray(data.hosts) || !Number.isFinite(Date.parse(row.checked_at))) throw Error('운영 기록 형식을 확인할 수 없습니다');
  const ids = new Set();
  for (const item of data.items) {
    if (typeof item.id !== 'string' || ids.has(item.id) || typeof item.name !== 'string' || typeof item.active !== 'boolean' || !Array.isArray(item.days) || !item.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6) || !Number.isFinite(item.order)) throw Error('자동화 목록 형식을 확인할 수 없습니다');
    ids.add(item.id);
  }
  for (const flow of data.flows) {
    if (!Array.isArray(flow.steps) || flow.steps.some(s => s.job && !ids.has(s.job))) throw Error('업무 흐름의 연결을 확인할 수 없습니다');
  }
  return { ...data, checkedAt: row.checked_at };
}

export function createSnapshotClient({ getToken, fetchImpl = fetch, url = API, anonKey = ANON }) {
  let generation = 0;
  return {
    invalidate() { generation++; },
    async load() {
      const token = getToken(), version = ++generation;
      const current = () => { if (version !== generation || !token || token !== getToken()) throw new AccessError('로그인 상태가 바뀌었습니다'); };
      current();
      const headers = { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const owner = await fetchImpl(`${url}/rest/v1/rpc/is_agency_owner`, { method: 'POST', headers, body: '{}', cache: 'no-store' });
      current();
      if (owner.status === 401 || owner.status === 403) throw new AccessError('로그인 상태를 확인해 주세요');
      if (!owner.ok) throw Error('접근 권한 확인에 실패했습니다');
      const allowed = await owner.json();
      current();
      if (allowed !== true) throw new AccessError('KWAN 전용 화면입니다');
      const response = await fetchImpl(`${url}/rest/v1/automation_ops_snapshots?id=eq.current&select=payload,checked_at&limit=1`, { headers, cache: 'no-store' });
      current();
      if (response.status === 401 || response.status === 403) throw new AccessError('로그인 상태를 확인해 주세요');
      if (!response.ok) throw Error('운영 기록을 불러오지 못했습니다');
      const rows = await response.json();
      current();
      if (!Array.isArray(rows) || rows.length !== 1) throw Error('저장된 운영 기록을 확인할 수 없습니다');
      return validateSnapshot(rows[0]);
    }
  };
}

export function jobsForDay(items, day) {
  return items.filter(x => x.active && x.days.includes(day)).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko'));
}

export function snapshotHealth(data, now = Date.now()) {
  if (!data.sync) return '마지막 수동 검수 기록입니다';
  const age = now - Date.parse(data.sync.attempted_at);
  if (!Number.isFinite(age) || age > 15 * 60 * 1000) return '동기화 지연 · 마지막 확인값입니다 · Mac 실행기 연결 확인 필요';
  const failed = data.sync.sources.filter(s => s.status !== 'ok');
  if (failed.length) return `${failed.map(s => s.engine).join(' · ')} 조회 실패 · 해당 목록은 이전 확인값입니다`;
  return '예약 설정 5분마다 자동 동기화 · 실제 업무 완료 여부는 결과 채팅에서 확인';
}

function itemState(item) {
  if (item.sync_state === 'stale') return '이전 확인값';
  if (item.removed) return '예약 목록에서 제거됨';
  return (item.active ? '활성' : '중지') + (item.sync_state === 'manual' ? ' · 수동 확인' : '');
}

export function safeResultURL(value) {
  try {
    const u = new URL(value);
    const hosts = ['claude.ai', 'app.notion.com', 'www.notion.so', 'notion.so', 'www.socrabrand.cloud', 'socrabrand.cloud'];
    return u.protocol === 'https:' && !u.username && !u.password && hosts.includes(u.hostname) ? u.href : null;
  } catch { return null; }
}

export function mountAutomationOps(doc = document, win = window) {
  const tabs = doc.querySelector('.tabs');
  if (!tabs || doc.getElementById('ops-tab')) return;
  const el = (tag, text = '', cls = '') => { const e = doc.createElement(tag); e.textContent = text; e.className = cls; return e; };
  const button = (text, fn, cls = 'ops-button') => { const e = el('button', text, cls); e.type = 'button'; e.addEventListener('click', fn); return e; };
  const getToken = () => { try { return win.localStorage.getItem(TOKEN_KEY); } catch { return null; } };
  const client = createSnapshotClient({ getToken, fetchImpl: win.fetch.bind(win) });
  const tab = button('운영 현황', () => openOps());
  tab.id = 'ops-tab'; tab.hidden = true; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', 'false'); tab.setAttribute('aria-controls', 'ops-panel');
  tabs.prepend(tab);
  const panel = el('section', '', 'ops-panel'); panel.id = 'ops-panel'; panel.hidden = true; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'ops-tab');
  doc.querySelector('.toolbar').after(panel);
  const legacy = [...doc.querySelectorAll('#caption,#viewport,body > footer,body > header .stamp,.controls')];
  let data = null, loadedToken = null, request = 0, view = 'day', flowID = null, selectedID = null, showing = false;
  let day = (new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getDay() + 6) % 7;
  function layout(on) {
    showing = on; panel.hidden = !on; legacy.forEach(e => { e.hidden = on; });
    tab.setAttribute('aria-selected', String(on));
    if (on) tabs.querySelectorAll('[data-map]').forEach(e => e.setAttribute('aria-selected', 'false'));
    else { if (!tabs.querySelector('[data-map][aria-selected="true"]')) { const fallback = tabs.querySelector('[data-map="all"]'); fallback?.setAttribute('aria-selected', 'true'); fallback?.click(); } win.dispatchEvent(new Event('resize')); }
  }
  function clearPrivate() {
    request++; client.invalidate(); data = null; loadedToken = null; selectedID = null;
    panel.replaceChildren(); tab.hidden = true; layout(false);
  }
  function detail(item, target) {
    target.replaceChildren(); if (!item) return;
    target.append(el('p', `${item.engine} · ${itemState(item)}`, 'ops-eyebrow'), el('h3', item.name));
    const list = el('dl');
    const audit = data?.audit_at ? new Date(data.audit_at).toLocaleDateString('ko-KR', {timeZone:'Asia/Seoul'}) : '기존';
    for (const [label, value] of [['실제 예약 설정', item.schedule], ['어떤 일을 하나요', item.result], ['결과가 남는 곳', item.output], [`업무 검수 메모 · ${audit}`, item.verification], ['내가 할 일', item.action]]) {
      list.append(el('dt', label), el('dd', value || '기록 없음'));
    }
    if (item.business_note) list.append(el('dt', '업무 실행 기준'), el('dd', item.business_note));
    if (item.next) list.append(el('dt', '서버의 다음 실행 예정'), el('dd', new Date(item.next).toLocaleString('ko-KR', {timeZone:'Asia/Seoul'})));
    if (item.sync_state === 'stale') list.append(el('dt', '조회 상태'), el('dd', '이번 조회에 실패해 이전 설정을 보존했습니다'));
    target.append(list);
    const href = safeResultURL(item.url);
    if (href) { const a = el('a', href.includes('/scheduled-task/') ? 'Claude 예약 열기 ↗' : '결과 열기 ↗', 'ops-link'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; target.append(a); }
  }
  function render() {
    if (!data || loadedToken !== getToken()) { clearPrivate(); return; }
    panel.replaceChildren();
    const head = el('div', '', 'ops-heading');
    const intro = el('div'); intro.append(el('p', 'KWAN ONLY', 'ops-eyebrow'), el('h2', '자동화 운영 현황'));
    const stamp = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(data.checkedAt));
    intro.append(el('p', `${stamp} ${data.sync ? '예약 설정 조회' : '검수 기준'} · 한국 시간`, 'ops-muted'));
    head.append(intro, button('기록 다시 불러오기', () => openOps())); panel.append(head);
    const stats = el('div', '', 'ops-stats');
    const currentItems = data.items.filter(x => !x.removed);
    const activeCount = currentItems.filter(x => x.active).length;
    for (const [n, label] of [[currentItems.length, '현재 자동화'], [activeCount, '활성'], [currentItems.length - activeCount, '중지']]) { const c = el('div'); c.append(el('strong', String(n)), el('span', label)); stats.append(c); }
    const health = el('p', snapshotHealth(data), 'ops-note'); health.id = 'ops-sync-status';
    panel.append(stats, health);
    if (data.sync?.manual_source_note) panel.append(el('p', data.sync.manual_source_note, 'ops-muted'));
    const nav = el('div', '', 'ops-nav'); nav.setAttribute('aria-label', '운영 현황 보기');
    for (const [key, label] of [['day', '요일별 일정'], ['flow', '업무 흐름'], ['all', '전체 목록']]) { const b = button(label, () => { view = key; selectedID = null; render(); }); b.setAttribute('aria-pressed', String(view === key)); nav.append(b); }
    panel.append(nav);
    const grid = el('div', '', 'ops-grid'); const content = el('div', '', 'ops-content'); const aside = el('aside', '', 'ops-detail'); aside.setAttribute('aria-live', 'polite');
    const select = (item, scroll = false) => { selectedID = item.id; content.querySelectorAll('[data-job]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.job === item.id))); detail(item, aside); if (scroll && win.matchMedia?.('(max-width:720px)').matches) aside.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); };
    const jobCard = (item, prefix = '') => {
      const b = button('', () => select(item, true), 'ops-job'); b.dataset.job = item.id; b.setAttribute('aria-pressed', String(selectedID === item.id));
      b.append(el('span', prefix || item.time || item.schedule, 'ops-time'), el('strong', item.name), el('span', `${item.engine} · ${itemState(item)}`, 'ops-badge'), el('span', item.brief || item.result, 'ops-summary')); return b;
    };
    let visible = [];
    if (view === 'day') {
      const picker = el('div', '', 'ops-days'); picker.setAttribute('aria-label', '요일 선택');
      DAYS.forEach((name, index) => { const b = button(name, () => { day = index; selectedID = null; render(); }); b.setAttribute('aria-label', `${name}요일`); b.setAttribute('aria-pressed', String(day === index)); picker.append(b); });
      content.append(picker); visible = jobsForDay(data.items, day);
      content.append(el('h3', `${DAYS[day]}요일 · ${visible.length}개`), el('p', '활성 예약 기준 · 여러 번 실행되는 작업은 한 카드에 함께 표시', 'ops-muted'));
      const list = el('div', '', 'ops-jobs'); visible.forEach(x => list.append(jobCard(x))); content.append(list);
      if (!visible.length) content.append(el('p', '이 요일에 등록된 활성 자동화가 없습니다', 'ops-empty'));
      if (data.items.some(x => x.active && x.schedule_known === false)) content.append(el('p', '요일로 풀어 표시할 수 없는 반복 규칙은 전체 목록에서 원본 일정을 확인해 주세요', 'ops-note'));
    } else if (view === 'flow') {
      const picker = el('div', '', 'ops-flow-picker');
      const flow = data.flows.find(f => f.id === flowID) || data.flows[0]; flowID = flow?.id;
      data.flows.forEach(f => { const b = button(f.name, () => { flowID = f.id; selectedID = null; render(); }); b.setAttribute('aria-pressed', String(flowID === f.id)); picker.append(b); });
      content.append(picker, el('p', '노드를 누르면 해당 자동화의 일정·결과·내가 할 일을 볼 수 있습니다', 'ops-muted'));
      const chain = el('ol', '', 'ops-chain');
      flow?.steps.forEach((step, i) => {
        const li = el('li'); const item = data.items.find(x => x.id === step.job);
        if (item) { visible.push(item); const b = jobCard(item, `${String(i + 1).padStart(2, '0')} · ${item.schedule}`); b.querySelector('.ops-summary').textContent = step.text; li.append(b); }
        else { const box = el('div', '', 'ops-human'); box.append(el('span', `${String(i + 1).padStart(2, '0')}`, 'ops-time'), el('strong', step.title), el('p', step.text)); li.append(box); }
        chain.append(li);
      }); content.append(chain);
    } else {
      const list = el('div', '', 'ops-jobs'); visible = [...data.items].sort((a, b) => Number(b.active) - Number(a.active) || a.order - b.order);
      content.append(el('h3', '활성·중지 자동화 전체'), el('p', '설정 변경이나 재개 없이 확인한 목록입니다', 'ops-muted'));
      visible.forEach(x => list.append(jobCard(x, x.schedule))); content.append(list);
    }
    const selected = visible.find(x => x.id === selectedID) || visible[0]; if (selected) { selectedID = selected.id; select(selected); } else aside.append(el('p', '선택할 자동화가 없습니다', 'ops-muted'));
    grid.append(content, aside); panel.append(grid);
    const hosts = el('details', '', 'ops-hosts'); hosts.append(el('summary', 'Mac 실행기·도우미 · 구성 검수 기록'));
    data.hosts.forEach(h => { const row = el('div'); row.append(el('strong', h.name), el('p', h.state)); hosts.append(row); }); panel.append(hosts);
  }
  let refreshing = false;
  async function openOps(initial = false, quiet = false) {
    if (quiet && refreshing) return;
    refreshing = true;
    const run = ++request; const token = getToken();
    if (!quiet) { data = null; loadedToken = null; panel.replaceChildren(el('p', '접근 권한과 운영 기록을 확인하고 있습니다', 'ops-empty')); }
    if (!initial) layout(true);
    try {
      const snapshot = await client.load();
      if (run !== request || token !== getToken()) return;
      if (quiet && data?.checkedAt === snapshot.checkedAt) { const status = doc.getElementById('ops-sync-status'); if (status) status.textContent = snapshotHealth(snapshot); return; }
      data = snapshot; loadedToken = token; tab.hidden = false; layout(true); render();
    } catch (error) {
      if (run !== request) return;
      if (error instanceof AccessError) { clearPrivate(); return; }
      // The error contains no private payload; retain a retry control for a verified owner's open tab.
      if (quiet) { const status = doc.getElementById('ops-sync-status'); if (status) status.textContent = '연결 확인 실패 · 화면은 마지막으로 불러온 기록입니다'; }
      else if (!initial) { panel.replaceChildren(el('p', error.message, 'ops-empty'), button('다시 확인', () => openOps())); }
    } finally { refreshing = false; }
  }
  tabs.addEventListener('click', e => { if (e.target.closest('[data-map]')) { request++; client.invalidate(); layout(false); } });
  win.addEventListener('storage', e => { if (e.key === TOKEN_KEY || e.key === null) { clearPrivate(); if (getToken()) openOps(true); } });
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) { const wasShowing = showing; clearPrivate(); showing = wasShowing; }
    else if (getToken() && (!data || loadedToken !== getToken())) openOps(true);
  });
  win.addEventListener('pagehide', clearPrivate);
  win.addEventListener('pageshow', e => { if (e.persisted && getToken()) openOps(true); });
  // Lightweight owner-only data read; this does not invoke any model or run an automation.
  win.setInterval?.(() => { if (!doc.hidden && showing && getToken()) openOps(false, true); }, 60000);
  if (getToken()) openOps(true);
  return { clearPrivate };
}

if (typeof document !== 'undefined') mountAutomationOps();
