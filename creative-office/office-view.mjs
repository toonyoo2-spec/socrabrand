/** Presentational office. The caller must verify the owner's session on the server. */
export const OFFICE_MEMBERS = Object.freeze([
  { id: 'cd', role: 'CD', name: '크리에이티브 디렉터', specialty: '아이디어의 중심을 잡아요', color: 'peach', accessory: 'glasses' },
  { id: 'ad', role: 'AD', name: '아트디렉터 · 콘티', specialty: '장면과 미감을 설계해요', color: 'mint', accessory: 'beret' },
  { id: 'copy', role: 'COPY', name: '카피라이터', specialty: '말과 화면의 결을 다듬어요', color: 'lavender', accessory: 'glasses' },
  { id: 'ae', role: 'AE', name: '어카운트 이그제큐티브', specialty: '과제와 근거를 연결해요', color: 'butter', accessory: 'ribbon' },
  { id: 'director', role: 'DIRECTOR', name: '디렉터', specialty: '생각을 살아 있는 장면으로', color: 'blue', accessory: 'cap' },
  { id: 'kwan', role: 'KWAN', name: '콴 관점의 비판 검수', specialty: '좋은 선택을 더 단단하게', color: 'rose', accessory: 'crown' },
]);

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeColors = new Set(['peach', 'mint', 'lavender', 'butter', 'blue', 'rose']);
const safeAccessories = new Set(['glasses', 'beret', 'ribbon', 'cap', 'crown']);
const workLabels = { idle: '진행 작업 없음', running: '작업 중', processing: '처리 중', blocked: '확인 필요', failed: '오류 확인 필요', complete: '최근 작업 완료' };

function attendanceFor(attendance, id) {
  const entry = Array.isArray(attendance) ? attendance.find(row => (row.memberId ?? row.member_id ?? row.id) === id) : attendance?.[id];
  const value = typeof entry === 'string' ? entry : entry?.status;
  return { ...((entry && typeof entry === 'object') ? entry : {}), status: ['in', 'present', 'clocked_in'].includes(value) ? 'in' : ['out', 'absent', 'clocked_out'].includes(value) ? 'out' : 'unknown' };
}

function shortTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(date) : '';
}

const plant = '<span class="co-plant" aria-hidden="true"><i></i><i></i><i></i><b></b></span>';
const bookcase = '<div class="co-bookcase" aria-hidden="true"><div><i></i><i></i><i></i><i></i><i></i></div><div><i></i><i></i><i></i><span>✦</span></div></div>';

/**
 * renderOffice(root, options) -> { update(partialOptions), destroy() }
 * authorized must be true after owner verification; otherwise no supplied data is rendered.
 * attendance: { [memberId]: { status: 'in'|'out'|'unknown', checkedInAt?, checkedOutAt? } }.
 * members: optional overrides of OFFICE_MEMBERS; workStatus/workLabel are real backend observations.
 * onClockIn(id), onClockOut(id): async callbacks. Return { attendance } or call update yourself.
 * Optional: onRefresh(), onOpenReferences(), loading, error, connectionState, updatedAt,
 * learning: { observedCount, candidateCount, verifiedAudioCount } (no invented defaults).
 * This view never starts an agent, schedules learning, or treats attendance as processing.
 */
export function renderOffice(root, options = {}) {
  if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('오피스를 표시할 DOM 요소가 필요합니다.');
  let state = { authorized: false, members: OFFICE_MEMBERS, attendance: {}, ...options };
  let alive = true;
  let notice = '';
  let localError = '';
  const pending = new Set();
  const controller = new AbortController();
  root.classList.add('creative-office');

  function draw() {
    if (!alive) return;
    if (state.authorized !== true) {
      root.innerHTML = '<section class="co-locked" aria-labelledby="co-lock-title"><div class="co-lock-icon" aria-hidden="true">✦</div><p class="co-eyebrow">KWAN’S PRIVATE OFFICE</p><h1 id="co-lock-title">콴의 크리에이티브 오피스</h1><p>접근 권한을 확인한 뒤 사무실을 열어요.</p><p class="co-small">KWAN 전용 공간</p></section>';
      return;
    }
    const supplied = Array.isArray(state.members) ? state.members : OFFICE_MEMBERS;
    // Six fixed roles, with caller-provided factual metadata layered over each role.
    const members = OFFICE_MEMBERS.map(base => ({ ...base, ...supplied.find(m => m.id === base.id), id: base.id }));
    const entries = members.map(m => attendanceFor(state.attendance, m.id));
    const inCount = entries.filter(a => a.status === 'in').length;
    const unknownCount = entries.filter(a => a.status === 'unknown').length;
    const learning = state.learning ?? {};
    const count = value => Number.isInteger(value) && value >= 0 ? value.toLocaleString('ko-KR') : '—';
    const cards = members.map((member, index) => {
      const attendance = entries[index];
      const present = attendance.status === 'in';
      const unknown = attendance.status === 'unknown';
      const busy = pending.has(member.id);
      const color = safeColors.has(member.color) ? member.color : OFFICE_MEMBERS[index].color;
      const accessory = safeAccessories.has(member.accessory) ? member.accessory : '';
      const label = present ? '출근' : unknown ? '상태 미확인' : '퇴근';
      const action = present ? 'clock-out' : 'clock-in';
      const canAct = !state.loading && !busy && typeof (present ? state.onClockOut : state.onClockIn) === 'function';
      const time = shortTime(present ? attendance.checkedInAt ?? attendance.clocked_in_at : attendance.checkedOutAt ?? attendance.clocked_out_at);
      const workLabel = member.workLabel || workLabels[member.workStatus] || '처리 상태 미확인';
      return `<article class="co-member co-color-${color} ${present ? 'is-in' : unknown ? 'is-unknown' : 'is-out'}" aria-labelledby="co-role-${member.id}" aria-busy="${busy}">
        <div class="co-member-top"><span class="co-role" id="co-role-${member.id}">${esc(member.role)}</span><span class="co-attendance"><i></i>${label}${time ? `<span class="co-time">${time}</span>` : ''}</span></div>
        <div class="co-vignette" aria-hidden="true"><span class="co-note">${index === 1 ? 'DRAW' : index === 2 ? 'WRITE' : index === 5 ? 'WHY?' : 'THINK'}</span><span class="co-chair"></span><span class="co-character co-${accessory}"><span class="co-hair"></span><span class="co-face"><i></i><i></i><b></b></span><span class="co-body"></span><span class="co-arms"></span><span class="co-accessory"></span></span><span class="co-desk"><span class="co-monitor"><i></i></span><span class="co-keyboard"></span><span class="co-cup"></span><span class="co-paper"></span><span class="co-pencil"></span></span>${!present ? '<span class="co-away-tag">'+(unknown ? '확인 대기' : '잠시 비운 자리')+'</span>' : ''}</div>
        <h2>${esc(member.name)}</h2><p class="co-specialty">${esc(member.specialty)}</p><div class="co-work"><span>처리 상태</span><strong>${esc(workLabel)}</strong></div>
        <button class="co-clock-button" type="button" data-action="${action}" data-member="${member.id}" ${canAct ? '' : 'disabled'} aria-label="${esc(member.role)} ${present ? '퇴근' : '출근'} 기록">${busy ? '<span class="co-spinner" aria-hidden="true"></span>기록 중…' : present ? '퇴근 기록' : '출근 기록'}<span aria-hidden="true">${present ? '↗' : '↘'}</span></button>
      </article>`;
    }).join('');
    root.innerHTML = `<div class="co-shell">
      <header class="co-header"><div><p class="co-eyebrow"><span aria-hidden="true">✦</span> KWAN’S PRIVATE OFFICE</p><h1>에이전트 오피스<span aria-hidden="true">.</span></h1><p class="co-intro">다섯 전문가의 제안과 콴 관점의 마지막 점검이 만나는 곳.</p></div><div class="co-header-actions"><span class="co-owner-badge"><span aria-hidden="true">⌂</span> KWAN ONLY</span><button type="button" class="co-refresh" data-action="refresh" ${state.loading || pending.has('refresh') || !state.onRefresh ? 'disabled' : ''} aria-label="오피스 상태 새로고침">${state.loading || pending.has('refresh') ? '확인 중…' : '↻ 새로고침'}</button></div></header>
      <section class="co-room" aria-label="크리에이티브 6인 사무실"><div class="co-back-wall"><div class="co-room-sign">CREATIVE SIX<span>좋은 질문은 언제나 환영</span></div><div class="co-window" aria-hidden="true"><i></i><i></i><i></i><i></i><span class="co-sun"></span></div><div class="co-learning-corner">${bookcase}<span>레퍼런스 서가</span></div><div class="co-door" aria-hidden="true"><span>KWAN</span><i></i></div>${plant}</div>
      <div class="co-room-bar"><div><span class="co-live-dot"></span><strong>출근 기록 ${inCount}/6</strong>${unknownCount ? `<span>미확인 ${unknownCount}명</span>` : ''}</div><span>출퇴근 기록과 작업 실행은 별개예요</span></div><div class="co-desks">${cards}</div><div class="co-room-footer"><span aria-hidden="true">☕</span><span>무엇을 했는지보다, 무엇을 확인했는지.</span><span class="co-floor-mat" aria-hidden="true">WELCOME, KWAN</span></div></section>
      <section class="co-library" aria-labelledby="co-library-title"><div class="co-library-heading"><span class="co-library-icon" aria-hidden="true">▤</span><div><p class="co-eyebrow">OUR REFERENCE SHELF</p><h2 id="co-library-title">확인한 만큼 쌓이는 감각</h2><p>후보 발견, 영상 관찰, 음향 검증을 따로 기록해요.</p></div></div><div class="co-metrics"><div><strong>${count(learning.observedCount)}</strong><span>관찰 카드</span></div><div><strong>${count(learning.candidateCount)}</strong><span>분석·문헌 후보</span></div><div><strong>${count(learning.verifiedAudioCount)}</strong><span>직접 음향 검증</span></div></div>${typeof state.onOpenReferences === 'function' ? '<button type="button" class="co-library-link" data-action="references">근거 보기 <span aria-hidden="true">↗</span></button>' : ''}</section>
      <div class="co-feedback" role="status" aria-live="polite">${esc(notice || (state.loading ? '실제 기록을 불러오고 있어요.' : '출퇴근 버튼은 기록만 바꿔요. 에이전트 작업이나 학습을 시작하지 않아요.'))}</div>${localError || state.error ? `<p class="co-error" role="alert">${esc(localError || state.error)}</p>` : ''}<footer class="co-footer"><span>KWAN Creative Six · 비공개 공간</span><span>${state.updatedAt ? `마지막 확인 ${esc(shortTime(state.updatedAt))}` : '마지막 확인 시각 없음'}${state.connectionState ? ` · ${esc(state.connectionState)}` : ''}</span></footer>
    </div>`;
  }

  async function handleClick(event) {
    const button = event.target.closest?.('button[data-action]');
    if (!button || !root.contains(button) || button.disabled || state.authorized !== true) return;
    const action = button.dataset.action;
    const id = button.dataset.member;
    const key = id || action;
    const handler = action === 'clock-in' ? state.onClockIn : action === 'clock-out' ? state.onClockOut : action === 'refresh' ? state.onRefresh : state.onOpenReferences;
    if (typeof handler !== 'function' || pending.has(key)) return;
    pending.add(key); localError = ''; notice = ''; draw();
    try {
      const result = await handler(id);
      if (!alive || state.authorized !== true) return;
      // Only explicit data returned by the caller may change attendance.
      if (result && typeof result === 'object' && result.attendance) state = { ...state, attendance: result.attendance };
      notice = action === 'refresh' ? '기록을 다시 확인했어요.' : action === 'references' ? '' : '기록 요청을 처리했어요. 표시 상태는 확인된 기록을 따라요.';
    } catch (error) {
      if (alive && state.authorized === true) localError = error?.userMessage || error?.message || '요청을 처리하지 못했어요. 기록은 임의로 바꾸지 않았어요. 다시 확인해 주세요.';
    } finally {
      pending.delete(key); draw();
      if (alive) root.querySelector(id ? `button[data-member="${id}"]` : `button[data-action="${action}"]`)?.focus({ preventScroll: true });
    }
  }

  root.addEventListener('click', handleClick, { signal: controller.signal });
  draw();
  return {
    update(next = {}) { if (!alive) return; state = { ...state, ...next }; if (next.authorized === false) { notice = ''; localError = ''; } draw(); },
    destroy() { alive = false; controller.abort(); root.replaceChildren(); root.classList.remove('creative-office'); },
  };
}
