export const channels = { sheet: 'Google 시트', slides: '슬라이드' };
export function workDay() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type).value;
  return [value('year'), value('month'), value('day')].join('-');
}

export function transferStatus(row, channel) {
  const last = row.receipts[channel]?.completed_id;
  const plan = row.plans[channel];
  if (!row.submission) return { text:'제출 전', available:false };
  const active = new Date(row.receipts[channel]?.claim_until).getTime() > Date.now();
  if (active) return { text:'반영 중', available:false };
  if (last && plan?.allow_repeat_id === row.submission.id) return { text:'재반영 허용', available:true };
  if (last) return { text:last === row.submission.id ? '완료' : '완료 · 수정본 있음', available:false, locked:true };
  return { text:'반영 대기', available:true };
}

export function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}

export function lessonList(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.course.track === 'concept' ? '개념탄탄' : '실력탄탄';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row.lesson.lesson + '강');
  }
  return [...groups].map(([label, numbers]) => label + ' ' + numbers.join('·')).join(' / ');
}

export function transferCell(row, channel, change) {
  const cell = element('td');
  const state = transferStatus(row,channel);
  const label = element('label',undefined,'plan-check');
  const check = element('input');
  check.type='checkbox';
  check.checked=Boolean(row.plans[channel]) && state.available;
  check.disabled=!state.available;
  const title = row.course.instructor + ' ' + (row.course.track === 'concept' ? '개념탄탄 ' : '실력탄탄 ') + row.lesson.lesson + '강 ' + channels[channel];
  check.setAttribute('aria-label', title + ' 오늘 반영');
  check.addEventListener('change', () => change(row,channel,check.checked ? 'add' : 'remove',cell));
  label.append(check, element('span',state.text)); cell.append(label);
  if (state.locked) {
    const force = element('button','오늘 다시 반영','transfer-repeat');
    force.type='button';
    force.setAttribute('aria-label',title + ' 오늘 다시 반영');
    force.addEventListener('click',() => change(row,channel,'repeat',cell));
    cell.append(force);
  }
  return cell;
}
