import {submissionTemplate,slotLimits} from './lesson-template.mjs?v=3';
import { lessonIntro } from './intro.mjs?v=5';
import { syncSubmissionToSheet, sheetDestination } from './sheet-sync.mjs?v=15';
import {quizPlan,numberButtons} from './quizn-export.mjs?v=1';
import { buildPresentation, bookQuizPreview, quizExcel } from './presentation.mjs?v=32';
import { numericTimes, normalizeQuizNotation } from './math-notation.mjs?v=1';
import { prepareGoogleDrive, connectStaffGoogle, folderDestination, openDestinationFolder, saveSlidesToStaffDrive } from './google-drive.mjs?v=16';
import { supabaseUrl, publishableKey } from './public-config.mjs';
import { hasIncompleteMath, mountMathSymbols } from './math-symbols.mjs?v=5';

import { workDay, transferStatus, element, lessonList, channels, transferCell as planCell } from './transfer-board.mjs?v=2';

const $ = id => document.getElementById(id);
const tokenKey = 'socra_admin_token';
const accountKey = 'socra_user_id';
const dateLabel = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'UTC' });
const quizSeconds = [30, 30, 60, 60, 120];
const choiceInputs = ['quiz-choice-1', 'quiz-choice-2', 'quiz-choice-3', 'quiz-choice-4'];
const formulaInputs = ['quiz-prompt', 'quiz-answer', ...choiceInputs];
const stages = {
  catalog: 'catalog', 'quiz-one': 'quiz-panel', 'quiz-two': 'quiz-panel',
  'quiz-practice': 'quiz-panel', delivery: 'delivery-panel',
};
const stagePanels = new Set(Object.values(stages));
const quizStages = ['quiz-one', 'quiz-two', 'quiz-practice'];
const quizModes = {
  teacher: { stage: 'quiz-one', number: '①', source: '직접 제작', title: '퀴즈앤 ① · 직접 제작' },
  appendix: { stage: 'quiz-two', number: '②', source: '교사부록', title: '퀴즈앤 ② · 교사부록' },
  rpm_final: { stage: 'quiz-one', number: '①', source: 'RPM', title: '퀴즈앤 ① · RPM' },
  rpm_pro: { stage: 'quiz-two', number: '②', source: 'RPM Pro', title: '퀴즈앤 ② · RPM Pro' },
  practice: { stage: 'quiz-practice', source: '개념원리', title: '실전 스테이지' },
};
const resourceSelections = 'math_stage_group_selections';
const tracks = { concept: '개념탄탄 · 개념원리', application: '실력탄탄 · RPM' };
const resourceStages = {
  appendix: { kind: 'appendix', slots: ['부록 1번 (2분)', '부록 2번 (2분)', '부록 3번 (3분)'], copy: '교사부록 문항 3개를 선택해 주세요.' },
  practice: { kind: 'practice', slots: ['빈출 문제 (2분)', '고난도 문제 (3분)'], copy: '개념원리 · 빈출 1문항, 고난도 1문항' },
  rpm_final: { kind: 'lesson', slots: ['빈출 문제 1 (2분)', '빈출 문제 2 (2분)', '고난도 문제 3 (3분)'], copy: 'RPM · 빈출 2문항, 고난도 1문항' },
  rpm_pro: { kind: 'rpm_pro', slots: ['문제 1 (2분)', '문제 2 (3분)'], copy: 'RPM Pro 문항 2개를 선택해 주세요.' },
};
const state = {
  token: null, staff: false, editor: false, composer: false, memberships: [], courses: [], lessons: [], catalog: [], picks: new Map(), stagePicks: new Map(), quizzes: new Map(),
  submitted: null, courseVersion: 0, lessonVersion: 0, pagePreviews: new Map(), resourceViews: new Map(), busy: false,
};
let transferContext;
let progressGeneration = 0;
let staffProgress;
const lessonWeek = number => Math.ceil(number / 2);
const usesQuizN = course => course?.instructor === '한태인';
const className = course => tracks[course.track].split(' · ')[0];

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const token = state.token;
  if (!token) throw new ApiError(401, '사이트에 로그인해 주세요.');
  const response = await fetch(supabaseUrl + path, {
    ...options, cache: 'no-store',
    headers: { apikey: publishableKey, Authorization: 'Bearer ' + token, ...options.headers },
    signal: AbortSignal.timeout(18000),
  });
  if (token !== state.token) throw new ApiError(401, '로그인 상태가 바뀌었습니다.');
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const allowed = ['필수 수업 문항을 모두 선택해 주세요.', '퀴즈앤 또는 문제 출제 문항을 모두 선택해 주세요.',
      '이 회차에 맞는 문항을 선택해 주세요.', '퀴즈앤 직접 출제 문항 5개를 먼저 저장해 주세요.',
      '이 문항은 교재 정답을 확인하고 있습니다. 다른 문항을 골라 주세요.'];
    const constraint = (data.message ?? '').includes('math_quiz_exactly_four_choices');
    const message = allowed.includes(data.message) ? data.message
      : constraint ? '보기 4개와 1~4번 정답을 확인해 주세요.'
        : response.status === 403 ? '이 작업을 저장할 권한이 없습니다.'
          : '작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    throw new ApiError(response.status, message);
  }
  return response;
}

function table(name, params = {}, method = 'GET', body) {
  const query = new URLSearchParams(params);
  const options = { method, headers: { Prefer: 'return=representation' } };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
  }
  return request('/rest/v1/' + name + '?' + query, options).then(response => response.json());
}

function options(select, entries, value) {
  select.replaceChildren(...entries.map(([id, label]) => new Option(label, id)));
  if (entries.some(([id]) => String(id) === String(value))) select.value = value;
  if (select.closest('.pick-filters')) {
    let fixed=select.parentElement.querySelector('.filter-value');
    if (!fixed) {fixed=element('span',undefined,'filter-value');select.after(fixed);}
    select.hidden=entries.length===1;
    fixed.hidden=!select.hidden;
    fixed.textContent=select.hidden ? select.options[0].text : '';
  }
}

function values(rows, key) {
  return [...new Set(rows.map(row => row[key]))].map(value => [value, value]);
}

function failure(error, id = 'load-status') {
  if (error.status === 401) {
    showStatus('사이트에 다시 로그인해 주세요.', { login: true });
    return;
  }
  const message = error instanceof ApiError || ['export-status', 'sheet-status', 'drive-status'].includes(id)
    ? error.message : '연결을 확인하고 다시 시도해 주세요.';
  if (id === 'quiz-status') quizFeedback(message, 'error');
  else $(id).textContent = message;
}

function showStatus(message, { login = false, retry = false } = {}) {
  $('workspace').hidden = true;
  $('message').hidden = false;
  $('status').textContent = message;
  $('login').hidden = !login;
  $('retry').hidden = !retry;
  clearPreview();
}

function links(id, value, resource) {
  const link = $(id);
  link.hidden = true;
  link.removeAttribute('href');
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.origin !== 'https://docs.google.com' || url.username || url.password ||
        !url.pathname.startsWith('/' + resource + '/d/')) return;
    link.href = url.href;
    link.hidden = false;
  } catch {
    // A missing or invalid source link is unavailable.
  }
}

function currentCourse() {
  return state.courses.find(course => course.id === state.courseId);
}

function selectCourse(course) {
  state.courseId = course.id;
  $('course').value = course.instructor;
  for (const button of document.querySelectorAll('[data-track]')) {
    const available = state.courses.some(item => item.instructor === course.instructor && item.track === button.dataset.track);
    button.disabled = !available;
    button.setAttribute('aria-pressed', String(button.dataset.track === course.track));
  }
}

function currentLesson() {
  return state.lessons.find(lesson => lesson.lesson === Number($('lesson').value));
}

function lessonModes(lesson = currentLesson(), course = currentCourse()) {
  if (usesQuizN(course)) return lesson?.quiz_mode ? [lesson.quiz_mode] : [];
  return course?.quiz_modes ?? (lesson ? [lesson.quiz_mode] : []);
}

function activeQuizMode() {
  return lessonModes().find(mode => quizModes[mode].stage === state.stage);
}

function savedResourceMode(item, lesson = currentLesson()) {
  return item.stage_mode ?? lesson.quiz_mode;
}

function rememberView() {
  state.view = {
    course: currentCourse()?.id,
    lesson: currentLesson()?.lesson,
    stage: state.stage,
    quizSlot: state.quizSlot,
  };
  try { sessionStorage.setItem('math-view:' + state.account, JSON.stringify(state.view)); }
  catch { /* The current page still works with browser storage disabled. */ }
}

function setStaffOverview(active) {
  const field = $('course-field');
  const parent = document.querySelector(active ? '.progress-title' : '.course-controls');
  if (field.parentElement !== parent) {
    if (active) parent.append(field);
    else parent.prepend(field);
  }
  $('workspace').classList.toggle('staff-overview', active);
}

function showStage(stage, restore = false) {
  if (stage === 'progress') stage = 'delivery';
  // Saved views from releases before the split used the "quiz" key.
  if (stage === 'quiz') stage = quizModes[currentLesson()?.quiz_mode]?.stage;
  if (quizStages.includes(stage) && !lessonModes().some(mode => quizModes[mode].stage === stage)) {
    stage = quizModes[lessonModes()[0]]?.stage;
  }
  if (!restore && (state.busy || stage === state.stage || !confirmQuizChange())) return false;
  const previous = activeQuizMode();
  if (!restore && resourceStages[previous]) {
    state.resourceViews.set(previous, {
      book: $('stage-book').value, unit: $('stage-unit').value, section: $('stage-section').value,
      scroll: $('stage-preview-scroll').scrollTop,
    });
  }
  if (!restore && state.quizDirty) renderQuiz();
  state.stage = Object.hasOwn(stages, stage) ? stage : 'catalog';
  setStaffOverview(state.staff && state.stage === 'delivery');
  for (const button of document.querySelectorAll('[data-stage]')) {
    const selected = button.dataset.stage === state.stage;
    button.setAttribute('aria-pressed', String(selected));
  }
  for (const panel of stagePanels) $(panel).hidden = panel !== stages[state.stage];
  if (state.stage === 'catalog') { renderPicks(); positionCatalog(); }
  const mode = activeQuizMode();
  if (mode) renderQuizStage(mode);
  if (!restore && window.scrollY > $('lesson-tools').offsetTop) window.scrollTo(0, $('lesson-tools').offsetTop);
  rememberView();
  renderSubmission();
  if (state.stage === 'delivery' && $('all-progress').open) void loadProgress();
  return true;
}

function progressRows(name, filter, select) {
  return table(name, { course_id: filter, select });
}

async function submissionHistory(filter) {
  const latest = new Map();
  for (let offset = 0; ; offset += 500) {
    const records = await table('math_submissions', {
      course_id:filter, select:'course_id,lesson,id,selected_quiz_mode,submitted_at,math_submission_reviews(status,detail)',
      order:'submitted_at.desc,id.desc', limit:500, offset,
    });
    for (const record of records) {
      const key = record.course_id + '/' + record.lesson;
      if (latest.has(key)) latest.get(key).revised = true;
      else latest.set(key, record);
    }
    if (records.length < 500) return latest;
  }
}

const submissionClock = new Intl.DateTimeFormat('ko-KR', {
  timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit',
  hour:'2-digit', minute:'2-digit', hourCycle:'h23',
});

function reviewLabel(submission) {
  const review=submission?.math_submission_reviews;
  return {queued:'고딕 변환 대기',running:'고딕 변환 중',passed:'',attention:''}[review?.status] ?? '';
}

function renderTeacherStatus(cell, submission, started) {
  cell.className = 'progress-status';
  cell.dataset.state = submission ? 'done' : 'pending';
  cell.textContent = submission ? (submission.revised ? '수정본 제출' : '제출됨') : started ? '작성 중' : '미작성';
  if (!submission) return;
  const date = new Date(submission.submitted_at);
  if (!Number.isFinite(date.getTime())) return;
  const parts = Object.fromEntries(submissionClock.formatToParts(date).map(part => [part.type, part.value]));
  const time = element('time', parts.month + '.' + parts.day + ' ' + parts.hour + ':' + parts.minute, 'submission-time');
  time.dateTime = submission.submitted_at;
  time.title = submissionClock.format(date) + ' (한국시간)';
  time.setAttribute('aria-label', time.title);
  cell.append(time);
  const review = reviewLabel(submission);
  if (review) cell.append(element('small', review,'submission-time'));
}

async function loadProgress() {
  const generation = ++progressGeneration;
  const version = state.courseVersion;
  const instructor = currentCourse()?.instructor;
  const courses = state.courses.filter(course => course?.instructor === instructor);
  const filter = 'in.(' + courses.map(course => course.id).join(',') + ')';
  const status = $('progress-status');
  const grid = $('progress-tracks');
  $('progress-heading').textContent = state.staff ? '작업현황' : instructor + ' · 작업현황';
  const previous = state.staff && staffProgress?.instructor === instructor ? staffProgress : null;
  if (previous?.pending) {
    previous.needsRefresh = true;
    return;
  }
  const active = document.activeElement;
  const focusLabel = grid.contains(active) ? active.getAttribute('aria-label') : null;
  grid.inert = true;
  $('progress-filters').inert = true;
  $('progress-transfer').hidden = !state.staff;
  $('progress-transfer').disabled = true;
  if (!previous) {
    staffProgress = null;
    $('progress-filters').hidden = true;
    $('transfer-feedback').textContent = '';
    grid.replaceChildren();
  }
  grid.classList.toggle('staff-tracks',state.staff);
  status.textContent = previous ? '' : '회차별 작업현황을 불러오는 중입니다.';
  try {
    const [lessons, picks, quizzes, extras, submissions, receipts, plans] = await Promise.all([
      progressRows('math_lessons', filter, 'course_id,lesson,live_date,topic,quiz_mode'),
      progressRows('math_selections', filter, 'course_id,lesson,slot'),
      progressRows('math_teacher_quizzes', filter, 'course_id,lesson,slot'),
      progressRows(resourceSelections, filter, 'course_id,lesson,slot,stage_mode'),
      submissionHistory(filter),
      state.staff ? progressRows('math_transfer_state', filter, 'course_id,lesson,channel,completed_id,result_url,claim_until') : [],
      state.staff ? table('math_transfer_plans', { course_id:filter, work_day:'eq.'+workDay(), select:'course_id,lesson,channel,allow_repeat_id' }) : [],
    ]);
    if (generation !== progressGeneration || version !== state.courseVersion || state.stage !== 'delivery') return;
    if (state.staff) {
      const available = courses.filter(staffCourse);
      const rows = lessons.flatMap(lesson => {
        const course = available.find(c => c.id === lesson.course_id);
        if (!course) return [];
        const matches = item => item.course_id === course.id && item.lesson === lesson.lesson;
        const submission = submissions.get(course.id + '/' + lesson.lesson);
        const row = transferRow(course, lesson, submission, receipts, plans);
        row.lessonProgress = lessonPickProgress(course, picks.filter(matches).map(item => item.slot), lesson.quiz_mode);
        row.quizCounts = lessonModes(lesson,course).map(mode => ({
          title: quizModes[mode].number ? '퀴즈앤 ' + quizModes[mode].number : '문제 출제',
          count: mode === 'teacher' ? quizzes.filter(matches).length : extras.filter(item => matches(item) && savedResourceMode(item,lesson) === mode).length,
          total: quizCount(mode)
        }));
        return [row];
      }).sort((a,b) => a.lesson.lesson-b.lesson.lesson || Number(a.course.track !== 'concept')-Number(b.course.track !== 'concept'));
      const weeks = [...new Set(rows.map(row=>lessonWeek(row.lesson.lesson)))];
      const first = selectedTransfers(rows)[0]?.row ?? rows.find(row => Object.keys(channels).some(ch=>transferStatus(row,ch).available)) ?? rows[0];
      const week = weeks.includes(previous?.week) ? previous.week : lessonWeek(first?.lesson.lesson ?? 1);
      staffProgress = {instructor,courses:available,rows,week,pending:0};
      options($('progress-week'),weeks.map(w=>[w,w+'주차 · '+(2*w-1)+'–'+(2*w)+'강']),week);
      $('progress-filters').hidden = false;
      $('progress-transfer').disabled = !rows.length;
      renderStaffProgress();
      status.textContent = '';
      return;
    }
    for (const [track, label] of Object.entries(tracks)) {
      const course = courses.find(item => item.track === track);
      const group = document.createElement('section');
      group.className = 'progress-track';
      const title = document.createElement('h3');
      title.textContent = label;
      const heading = document.createElement('div');
      heading.className = 'progress-track-head';
      heading.append(title);
      group.append(heading);
      if (!course) {
        const pending = document.createElement('p');
        pending.className = 'muted';
        pending.textContent = '커리큘럼 확정 대기';
        heading.append(pending);
      } else {
        const courseLessons = lessons.filter(lesson => lesson.course_id === course.id).sort((a, b) => a.lesson - b.lesson);
        const courseModes = [...new Set(courseLessons.flatMap(lesson => lessonModes(lesson, course)))];
        const courseSubmissions = [...submissions.values()].filter(item => item.course_id === course.id);
        const summary = document.createElement('p');
        summary.className = 'muted';
        summary.textContent = '제출 ' + new Set(courseSubmissions.map(item => item.lesson)).size + ' / ' + courseLessons.length;
        heading.append(summary);
        const progress = document.createElement('table');
        progress.setAttribute('aria-label', label + ' 회차별 작업현황');
        const head = progress.createTHead().insertRow();
        const quizHeaders = courseModes.map(mode => quizModes[mode].number ? '퀴즈앤 ' + quizModes[mode].number : '문제 출제');
        for (const text of ['회차', '기본 · 예비 문항', ...quizHeaders, '선생님']) {
          const header = document.createElement('th');
          header.scope = 'col';
          header.textContent = text;
          head.append(header);
        }
        const body = progress.createTBody();
        for (const lesson of courseLessons) {
          const matches = item => item.course_id === course.id && item.lesson === lesson.lesson;
          const submitted = submissions.get(course.id + '/' + lesson.lesson);
          const row = body.insertRow();
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = lesson.lesson + '강';
          button.title = lesson.topic;
          button.addEventListener('click', () => openProgressLesson(course, lesson.lesson));
          const date = document.createElement('time');
          date.className = 'date';
          date.dateTime = lesson.live_date;
          date.textContent = dateLabel.format(new Date(lesson.live_date + 'T00:00:00Z'));
          row.insertCell().append(button, date);
          row.insertCell().textContent = lessonProgressLabel(lessonPickProgress(course, picks.filter(matches).map(item => item.slot), lesson.quiz_mode));
          for (const mode of courseModes) {
            const progress = row.insertCell();
            if (!lessonModes(lesson, course).includes(mode)) {
              progress.textContent = '—';
              continue;
            }
            const completed = mode === 'teacher' ? quizzes.filter(matches).length
              : extras.filter(item => matches(item) && savedResourceMode(item, lesson) === mode).length;
            progress.textContent = completed + ' / ' + quizCount(mode);
          }
          const status = row.insertCell();
          renderTeacherStatus(status, submitted, [picks,quizzes,extras].some(data => data.some(matches)));

        }
        group.append(progress);
      }
      grid.append(group);
    }
    status.textContent = '';
  } catch (error) {
    if (generation === progressGeneration && version === state.courseVersion) failure(error, 'progress-status');
  } finally {
    if (generation === progressGeneration) {
      grid.inert = false;
      $('progress-filters').inert = false;
      if (focusLabel && document.activeElement === document.body && state.stage === 'delivery') {
        grid.querySelector('[aria-label="' + CSS.escape(focusLabel) + '"]')?.focus({preventScroll:true});
      }
    }
  }
}

function transferCell(row,channel,change) {
  const cell = planCell(row,channel,change);
  const receipt = row.receipts[channel];
  if (!receipt?.completed_id || !receipt.result_url) return cell;
  let url;
  try {url = new URL(receipt.result_url);} catch {return cell;}
  const path = channel === 'sheet' ? /^\/spreadsheets\/d\/[A-Za-z0-9_-]+(?:\/|$)/ : /^\/presentation\/d\/[A-Za-z0-9_-]+(?:\/|$)/;
  if (url.origin !== 'https://docs.google.com' || !path.test(url.pathname)) return cell;
  const link = element('a',channel === 'sheet' ? '시트 열기' : '슬라이드 열기');
  link.href=url.href; link.target='_blank'; link.rel='noopener noreferrer';
  link.setAttribute('aria-label',className(row.course)+' '+row.lesson.lesson+'강 '+link.textContent);
  const label=cell.querySelector('label');
  const group=element('div');group.style.cssText='display:flex;align-items:center;gap:.5em;flex-wrap:wrap';
  label.replaceWith(group);group.append(label,link);
  return cell;
}

function weekRows(view) {
  return view.rows.filter(row=>lessonWeek(row.lesson.lesson)===view.week);
}

function refreshProgressActions() {
  const view = staffProgress;
  const week = weekRows(view);
  for (const [channel, label] of [['','이번 주'],['sheet','시트'],['slides','슬라이드']]) {
    const keys = channel ? [channel] : Object.keys(channels);
    const available = week.flatMap(row => keys.filter(key => transferStatus(row,key).available).map(key => Boolean(row.plans[key])));
    const button = $(channel ? 'select-week-'+channel : 'select-week');
    button.disabled = !available.length || Boolean(view.pending);
    button.textContent = label + (available.length && available.every(Boolean) ? ' 전체 해제' : ' 전체 선택');
  }
  $('progress-transfer').disabled = !view.rows.some(row=>row.submission) || Boolean(view.pending);
  $('progress-week').disabled = !view.rows.length || Boolean(view.pending);
}

function renderStaffProgress() {
  const view = staffProgress;
  const rows = weekRows(view);
  $('progress-total').textContent = rows.length + '개 수업 중 ' + rows.filter(row => row.submission).length + '개 제출';
  $('lesson-delivery').hidden = !state.composer && view.week !== lessonWeek(currentLesson().lesson);
  refreshProgressActions();
  const grid = $('progress-tracks');
  if (!rows.length) {
    grid.replaceChildren(element('p','등록된 회차가 없습니다.','muted'));
    return;
  }
  const section = element('section',undefined,'progress-track combined-track');
  const table = element('table');
  table.setAttribute('aria-label','두 수업의 회차별 작업현황');
  const head = table.createTHead().insertRow();
  for (const name of ['회차','수업명','문항 준비','제출 상태','시트','슬라이드']) {const th=element('th',name);if (name==='문항 준비') th.className='progress-counts';head.append(th);}
  const body = table.createTBody();
  for (const [index,row] of rows.entries()) {
    const tr = body.insertRow();
    if (!index || rows[index-1].lesson.lesson !== row.lesson.lesson) {
      const lesson = element('th',row.lesson.lesson+'강','week-lesson');
      lesson.scope='rowgroup';
      lesson.rowSpan=rows.filter(item=>item.lesson.lesson===row.lesson.lesson).length;
      const date=element('time',dateLabel.format(new Date(row.lesson.live_date+'T00:00:00Z')),'date');
      date.dateTime=row.lesson.live_date; lesson.append(date); tr.append(lesson);
    }
    const open = element('button',className(row.course));
    open.type = 'button';
    open.title = row.lesson.topic;
    open.setAttribute('aria-label',className(row.course)+' '+row.lesson.lesson+'강 열기');
    open.addEventListener('click',() => openProgressLesson(row.course,row.lesson.lesson));
    const courseCell = tr.insertCell();
    courseCell.className = 'course-cell';
    const actions = element('div', undefined, 'course-actions');
    courseCell.append(actions);
    actions.append(open);
    const download = element('button','퀴즈앤','quiz-download');
    download.type='button';
    download.setAttribute('aria-label',className(row.course)+' '+row.lesson.lesson+'강 퀴즈앤 엑셀 받기');
    download.addEventListener('click',()=>downloadQuizExcel(row,download,$('transfer-feedback')));
    download.disabled = !row.submission;
    download.title = row.submission ? '퀴즈앤 등록용 엑셀 받기' : '선생님이 제출하면 다운로드할 수 있습니다.';
    actions.append(download);
    const counts = tr.insertCell();
    counts.className = 'progress-counts';
    counts.append(element('span',lessonProgressLabel(row.lessonProgress)));
    for (const quiz of row.quizCounts) counts.append(element('span',quiz.title+' '+quiz.count+'/'+quiz.total));
    const status = tr.insertCell();
    renderTeacherStatus(status, row.submission, row.lessonProgress.basic || row.lessonProgress.reserve || row.quizCounts.some(q=>q.count));
    for (const channel of Object.keys(channels)) {
      const cell = transferCell(row,channel,updatePlan);
      cell.dataset.channel = channels[channel];
      tr.append(cell);
    }
  }
  section.append(table);
  grid.replaceChildren(section);
}

function openProgressLesson(course, lesson) {
  if (state.busy || !confirmQuizChange()) return;
  state.view = { course: course.id, lesson, stage: 'catalog' };
  if (course.id !== state.courseId) {
    selectCourse(course);
    void loadCourse();
    return;
  }
  $('lesson').value = lesson;
  void loadLesson();
}

function updateStageProgress() {
  $('pick-progress').textContent = lessonProgressLabel(lessonPickProgress());
  for (const stage of quizStages) {
    const mode = lessonModes().find(mode => quizModes[mode].stage === stage);
    const button = document.querySelector('[data-stage="' + stage + '"]');
    button.hidden = !mode;
    button.disabled = state.busy;
    const completed = mode === 'teacher' ? state.quizzes.size : state.stagePicks.get(mode)?.size ?? 0;
    $(stage + '-progress').textContent = mode ? quizModes[mode].source + ' · ' + completed + ' / ' + quizCount(mode) : '';
  }
  $('delivery-progress').textContent = state.staff ? '' : state.submitted ? (state.edited ? '수정 중' : '제출됨') : '미제출';
}

function context() {
  return { course_id: 'eq.' + currentCourse().id, lesson: 'eq.' + currentLesson().lesson };
}

async function loadCatalog(courseId) {
  const rows = [];
  const limit = 500;
  for (let offset = 0; ; offset += limit) {
    const next = await table('math_question_index', {
      course_id: 'eq.' + courseId,
      select: 'question_id,bundle_root_id,book,unit,section,page,label,preview_top,preview_book,slide_crop,slide_prompt_crop,use_kind,five_choice,projection_asset,projection_layout',
      order: 'book,page,question_number,question_id', limit, offset,
    });
    rows.push(...next);
    if (next.length < limit) return rows;
  }
}

async function loadSite() {
  if ($('transfer-dialog').open) $('transfer-dialog').close();
  state.courseVersion += 1;
  state.lessonVersion += 1;
  $('pending-course').hidden = true;
  staffProgress = null;
  state.courses = [];
  state.lessons = [];
  state.catalog = [];
  state.token = localStorage.getItem(tokenKey);
  state.account = localStorage.getItem(accountKey);
  try { state.view = JSON.parse(sessionStorage.getItem('math-view:' + state.account)) ?? {}; }
  catch { state.view = {}; }
  const token = state.token;
  if (!token) {
    showStatus('수학자동화는 권한이 있는 사이트 계정으로 사용할 수 있습니다.', { login: true });
    return;
  }
  showStatus('수학자동화 접속을 확인하는 중입니다.');
  try {
    const [courses, profiles, memberships] = await Promise.all([
      table('math_courses', { select: 'id,instructor,review_url,lesson_slots,required_lesson_slots,track,preview_course_id,quiz_modes', order: 'instructor' }),
      table('profiles', { select: 'role,display_name', limit: 1 }),
      table('math_course_members', { select: 'course_id,team_role' }),
    ]);
    if (token !== state.token) return;
    if (!courses.length) {
      const assigned = memberships.some(member => member.team_role === 'teacher');
      if (assigned) {
        const name = profiles[0]?.display_name || '담당';
        showStatus(name + ' 선생님 · 개념탄탄 / 실력탄탄');
        $('pending-course').hidden = false;
      } else showStatus('이 계정에 배정된 수학 강의가 없습니다.');
      return;
    }
    state.courses = courses;
    state.editor = profiles[0]?.role === 'editor';
    state.memberships = memberships;
    const active = courses.find(course => course.review_url) ?? courses[0];
    options($('course'), values(courses, 'instructor'));
    selectCourse(courses.find(course => course.id === state.view.course) ?? active);
    $('message').hidden = true;
    $('workspace').hidden = false;
    await loadCourse();
  } catch (error) {
    if (token !== state.token) return;
    const login = error.status === 401;
    showStatus(login ? '사이트에 다시 로그인해 주세요.' : '수학자동화를 열지 못했습니다.', { login, retry: !login });
  }
}

async function loadCourse() {
  setStaffOverview(false);
  const course = currentCourse();
  const role = state.memberships.find(member => member.course_id === course.id)?.team_role;
  state.staff = state.editor || role === 'staff';
  state.composer = state.editor || role === 'teacher';
  if (state.staff) void prepareGoogleDrive().catch(() => {});
  const version = ++state.courseVersion;
  ++state.lessonVersion;
  $('lesson-tools').hidden = true;
  $('actions').hidden = true;
  $('google-help').hidden = true;
  $('topic').textContent = '';
  $('lesson').disabled = true;
  $('load-status').textContent = '회차와 교재를 불러오는 중입니다.';
  state.lessons = [];
  state.catalog = [];
  clearPreview();
  try {
    const [lessons, catalog] = await Promise.all([
      table('math_lessons', {
        course_id: 'eq.' + course.id, select: 'lesson,live_date,topic,unit,section,curriculum_row,curriculum_url,presentation_url,quiz_mode', order: 'lesson',
      }),
      loadCatalog(course.id),
    ]);
    if (version !== state.courseVersion) return;
    state.lessons = lessons;
    state.catalog = catalog;
    options($('lesson'), lessons.map(item => [
      item.lesson, item.lesson + '강 · ' + dateLabel.format(new Date(item.live_date + 'T00:00:00Z')),
    ]), state.view.course === course.id ? state.view.lesson : lessons[0]?.lesson);
    $('lesson').disabled = !lessons.length;
    if (!lessons.length) {
      $('load-status').textContent = '이 강의는 회차와 교재 설정을 기다리고 있습니다.';
      return;
    }
    await loadLesson();
  } catch (error) {
    if (version === state.courseVersion) failure(error);
  }
}

async function loadLesson(requestedStage) {
  const lesson = currentLesson();
  const version = ++state.lessonVersion;
  $('lesson-tools').hidden = true;
  $('actions').hidden = true;
  $('google-help').hidden = true;
  clearPreview();
  $('topic').textContent = lesson.topic;
  $('load-status').textContent = '이 회차의 작성 내용을 불러오는 중입니다.';
  try {
    const filter = context();
    const modes = lessonModes();
    const resourceModes = modes.filter(mode => mode !== 'teacher');
    const [picks, quizzes, submissions, stagePicks, materials] = await Promise.all([
      table('math_selections', { ...filter, select: 'slot,question_id' }),
      modes.includes('teacher') ? table('math_teacher_quizzes', { ...filter, select: 'slot,kind,prompt,answer,choices' }) : [],
      table('math_submissions', { ...filter, select: 'id,submitted_at,sync_status,selected_quiz_mode,selections,quizzes,stage_questions,math_submission_reviews(status,detail)', order: 'submitted_at.desc', limit: 1 }),
      resourceModes.length ? table(resourceSelections, { ...filter, select: 'stage_mode,slot,question_id,quiz_override' }) : [],
      state.staff ? table('math_course_materials', { course_id: filter.course_id, select: 'label,url', order: 'label' }) : [],
    ]);
    if (version !== state.lessonVersion) return;
    state.picks = new Map(picks.filter(value => value.slot <= lessonSlots()).map(value => [value.slot, value.question_id]));
    state.quizzes = new Map(quizzes.map(value => [value.slot, value]));
    state.submitted = submissions[0] ?? null;
    state.stagePicks = new Map(resourceModes.map(mode => [mode, new Map()]));
    state.stageEdits = new Map(resourceModes.map(mode => [mode, new Map()]));
    state.resourceViews = new Map();
    for (const item of stagePicks) {
      state.stagePicks.get(item.stage_mode)?.set(item.slot, item.question_id);
      if (item.quiz_override) state.stageEdits.get(item.stage_mode)?.set(item.slot, item.quiz_override);
    }
    renderMaterialLinks(materials);
    $('delivery-panel').classList.toggle('staff-delivery', state.staff);
    $('delivery-label').textContent = state.staff ? '작업현황·Google 반영' : '제출·발표자료';
    $('lesson-delivery-title').textContent = className(currentCourse()) + ' ' + lesson.lesson + (state.composer ? '강 제출·자료' : '강 자료 링크');
    $('all-progress').open = state.staff || state.view.stage === 'progress';
    $('lesson-delivery').open = !state.staff;
    $('lesson-delivery').hidden = false;
    $('submission-panel').hidden = !state.composer;

    $('ppt-result').hidden = true;
    $('ppt-result').removeAttribute('href');
    state.exportReceipt = null;
    if (state.staff && state.submitted) void loadExportReceipt(version);
    state.quizDirty = false;
    $('selection-status').textContent = '';
    $('submit-feedback').textContent = '';
    $('load-status').textContent = '';
    $('lesson-tools').hidden = false;
    const books = lessonCatalog();
    $('catalog-empty').hidden = Boolean(books.length);
    $('catalog-fields').hidden = !books.length;
    $('catalog-picks').hidden = !books.length;
    links('curriculum', state.staff && lesson.curriculum_url, 'spreadsheets');
    links('review', state.staff && lesson.lesson === 1 && currentCourse().review_url, 'spreadsheets');
    links('presentation', state.staff && lesson.presentation_url, 'presentation');
    $('no-deck').hidden = !state.staff || !$('presentation').hidden;
    $('actions').hidden = !state.staff;
    $('google-help').hidden = !state.staff;
    $('staff-links').hidden = !state.staff;
    options($('book'), values(books, 'book'), currentCourse().track === 'application' ? 'RPM' : undefined);
    setUnit(lesson.unit, lesson.section);
    const restored = state.view.course === currentCourse().id && state.view.lesson === lesson.lesson;
    renderQuizSlots(restored ? state.view.quizSlot : 1);
    renderQuiz();
    $('quiz-save').hidden = !state.composer;
    for (const id of [...formulaInputs, 'quiz-kind', 'quiz-choice-answer']) $(id).disabled = !state.composer;
    $('symbol-panel').hidden = !state.composer;
    const defaultStage = state.staff ? 'delivery' : 'catalog';
    showStage(requestedStage ?? (restored && state.view.stage ? state.view.stage : defaultStage), true);
  } catch (error) {
    if (version === state.lessonVersion) failure(error);
  }
}

function renderMaterialLinks(materials) {
  const links = [];
  for (const item of materials) {
    if (item.label.includes('해설')) continue;
    try {
      const url = new URL(item.url);
      if (url.origin !== 'https://drive.google.com' || !url.pathname.startsWith('/file/d/')) continue;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = url.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = item.label;
      li.append(a);
      links.push(li);
    } catch { /* Ignore malformed reference URLs. */ }
  }
  $('material-links').replaceChildren(...links);
}

function lessonSlots() {
  return slotLimits(currentCourse(),currentLesson()?.quiz_mode)[1];
}
function requiredLessonSlots() {
  return slotLimits(currentCourse(),currentLesson()?.quiz_mode)[0];
}
function lessonPickProgress(course = currentCourse(), slots = state.picks.keys(), mode = currentLesson()?.quiz_mode) {
  const [required,total] = slotLimits(course,mode);
  let basic = 0;
  let reserve = 0;
  for (const slot of new Set(slots)) {
    if (!Number.isInteger(slot) || slot < 1 || slot > total) continue;
    if (slot <= required) basic++;
    else reserve++;
  }
  return {basic, required, reserve, optional:total - required};
}

function lessonProgressLabel({basic, required, reserve, optional}) {
  const label = '기본 ' + basic + '/' + required;
  return optional ? label + ' · 예비 ' + reserve + '/' + optional : label;
}

function quizCount(mode) {
  return mode === 'teacher' ? quizSeconds.length : resourceStages[mode]?.slots.length ?? 0;
}

function stageTitle(mode) {
  return quizModes[mode]?.title ?? '퀴즈앤';
}

function renderQuizStage(mode) {
  $('teacher-section').hidden = mode !== 'teacher';
  $('resource-stage').hidden = mode === 'teacher';
  $('quiz-heading').textContent = stageTitle(mode);
  if (mode === 'teacher') return;
  const previous = state.resourceViews.get(mode);
  $('stage-copy').textContent = resourceStages[mode].copy;
  $('stage-status').textContent = '';
  options($('stage-book'), values(stageCatalog(), 'book'), previous?.book);
  setStageUnit(previous?.unit ?? currentLesson().unit, previous?.section);
  if (previous) $('stage-preview-scroll').scrollTop = previous.scroll;
}

function lessonCatalog() {
  const lesson = currentLesson();
  const closingSection = /중단원\s*마무리/;
  const hasClosingSection = closingSection.test(lesson?.topic) || closingSection.test(lesson?.section);
  return state.catalog.filter(q =>
    (!q.bundle_root_id || q.bundle_root_id === q.question_id) &&
    (q.use_kind ?? 'lesson') === 'lesson' &&
    (currentCourse()?.track === 'concept'
      ? closingSection.test(q.section) === hasClosingSection
      : hasClosingSection || !closingSection.test(q.section))
  );
}

function stageCatalog() {
  const kind = resourceStages[activeQuizMode()]?.kind;
  return kind ? state.catalog.filter(q => (!q.bundle_root_id || q.bundle_root_id === q.question_id) && (q.use_kind ?? 'lesson') === kind) : [];
}

function setUnit(unit, section) {
  const bookRows = lessonCatalog().filter(question => question.book === $('book').value);
  options($('unit'), values(bookRows, 'unit'), unit);
  setSection(section);
}

function setSection(section) {
  const rows = catalogUnitQuestions();
  renderPicks();
  renderPageStack('preview', $('book').value, $('unit').value, rows, true);
  const view = state.pagePreviews.get('preview');
  view.initialType = section;
  positionCatalog();
}

function catalogUnitQuestions() {
  return lessonCatalog().filter(q => q.book === $('book').value && q.unit === $('unit').value);
}

let draggedQuestion = null;

function placeInSlot(slot, question, select) {
  const option = [...select.options].find(item => item.value === String(question.question_id));
  if (state.busy || !state.composer || !option || option.disabled || select.disabled) return;
  if (select.value !== option.value) void savePick(slot, option.value, select);
}

function selectionFeedback(message, undo) {
  const notice = $('selection-status');
  notice.textContent = message;
  if (!undo) return;
  const version = state.lessonVersion;
  const button = element('button','되돌리기','pick-undo');
  button.type = 'button';
  button.addEventListener('click', () => {
    if (version === state.lessonVersion && !state.busy) undo();
  });
  notice.append(' ',button);
}

function lessonSlotName(slot) {
  return (slot <= requiredLessonSlots() ? '기본 ' : '예비 ') + slot + '번';
}

async function movePick(from, to, source, canUndo = true) {
  if (from === to || state.busy || !state.composer || state.picks.get(from) !== source) return;
  const target = state.picks.get(to) ?? null;
  await withSaving(async () => {
    const moved = await rpc('math_swap_picks', {p_course:currentCourse().id,p_lesson:currentLesson().lesson,
      p_from:from,p_to:to,p_source:source,p_target:target});
    if (!moved) { await loadLesson(state.stage); throw Error('다른 곳에서 문항이 바뀌었습니다. 새로 불러온 목록을 확인해 주세요.'); }
    state.picks.set(to,source);
    if (target === null) state.picks.delete(from); else state.picks.set(from,target);
    state.edited = true;
    renderPicks();
    const message = !canUndo ? '원래 순서로 되돌렸습니다.' : target === null
      ? lessonSlotName(from)+' 문항을 '+lessonSlotName(to)+'으로 옮겼습니다.'
      : lessonSlotName(from)+'과 '+lessonSlotName(to)+'의 문항을 맞바꿨습니다.';
    selectionFeedback(message, canUndo ? () => movePick(to,from,source,false) : null);
  }, 'selection-status');
}

function chooseQuestionSlot(question, from) {
  const dialog = $('question-slot-dialog');
  if (state.busy || !state.composer || dialog.open) return;
  $('slot-dialog-title').textContent = question.label + (from ? ' 옮길 자리' : ' 넣을 자리');
  const controls = [...$('question-slots').querySelectorAll('select')];
  $('slot-dialog-options').replaceChildren(...controls.map((select, index) => {
    const slot = index + 1;
    const button = element('button');
    button.type = 'button';
    const assigned = state.catalog.find(q => q.question_id === state.picks.get(slot));
    button.append(element('strong', (slot <= requiredLessonSlots() ? '기본 ' : '예비 ') + slot + '번'),
      element('span', assigned?.label || '빈 자리'));
    const option = [...select.options].find(item => item.value === String(question.question_id));
    button.disabled = select.disabled || (from ? slot === from : !option || option.disabled);
    button.addEventListener('click', () => { dialog.close(); if (from) void movePick(from, slot, question.question_id); else placeInSlot(slot, question, select); });
    return button;
  }));
  dialog.showModal();
}

function addQuestionRegions(image, questions) {
  const surface = element('div', undefined, 'pick-page');
  image.draggable = false;
  surface.append(image);
  for (const question of questions) {
    const bounds = question.slide_crop;
    if (!Array.isArray(bounds) || bounds.length !== 4) continue;
    const [x,y,right,bottom] = bounds;
    const button = element('button', undefined, 'pick-region');
    button.type = 'button';
    button.title = question.label + ' · 클릭해서 자리 선택 또는 원하는 칸으로 드래그';
    button.setAttribute('aria-label',button.title);
    button.setAttribute('aria-haspopup','dialog');
    Object.assign(button.style, {left:x*100+'%', top:y*100+'%', width:(right-x)*100+'%', height:(bottom-y)*100+'%'});
    button.draggable = true;
    let suppressClick = false;
    button.addEventListener('pointerdown', () => { suppressClick = false; });
    button.addEventListener('click', event => {
      if (!suppressClick || event.detail === 0) chooseQuestionSlot(question);
    });
    button.addEventListener('dragstart', event => {
      if (state.busy || !state.composer) { event.preventDefault(); return; }
      suppressClick = true;
      draggedQuestion = {question, version:state.lessonVersion};
      event.dataTransfer.setData('text/plain',question.label);
      event.dataTransfer.effectAllowed = 'copy';
    });
    button.addEventListener('dragend', () => {
      draggedQuestion = null;
      $('question-slots').querySelectorAll('.drop-slot').forEach(el => el.classList.remove('drop-slot'));
    });
    surface.append(button);
  }
  return surface;
}

function pickControls(total, selectedIds, questions, slotLabel, save) {
  const slots = [];
  for (let slot = 1; slot <= total; slot += 1) {
    const label = document.createElement('label');
    let moveHandle;
    label.textContent = slotLabel(slot);
    const select = document.createElement('select');
    const selected = state.catalog.find(question => question.question_id === selectedIds.get(slot));
    label.dataset.filled = String(Boolean(selected));
    const choices = [['', selected ? '문항 비우기' : '문항 선택'], ...questions.map(question => [question.question_id, question.label])];
    if (selected && !questions.includes(selected)) choices.splice(1, 0, [selected.question_id, selected.label + ' · 저장됨']);
    options(select, choices, selected?.question_id);
    if (save === savePick) {
      const groups = new Map();
      const offset = choices.length - questions.length;
      const entries = Array.from(select.options).slice(offset);
      questions.forEach((q, index) => {
        if (!groups.has(q.section)) {
          const group = document.createElement('optgroup');
          group.label = q.section;
          groups.set(q.section, group);
          select.append(group);
        }
        groups.get(q.section).append(entries[index]);
      });
      select.value = selected ? String(selected.question_id) : '';
    }
    const used = new Set([...selectedIds].filter(([usedSlot]) => usedSlot !== slot).map(([,id]) => id));
    for (const item of questions) {
      if (item.bundle_root_id && used.has(item.bundle_root_id)) {
        const option = select.querySelector('option[value="' + item.question_id + '"]');
        if (option) { option.disabled = true; option.textContent += ' · 다른 자리에 선택됨'; }
      }
    }
    if (save === savePick && state.composer) {
      if (selected) {
        const handle = element('button','⠿','slot-handle');
        handle.type = 'button'; handle.draggable = true;
        handle.setAttribute('aria-label',slotLabel(slot)+' 문항 옮기기');
        handle.title = '끌어서 순서 변경 · 클릭해서 옮길 자리 선택';
        let justDragged = false;
        handle.addEventListener('pointerdown', () => { justDragged = false; });
        handle.addEventListener('click', event => {
          event.preventDefault();
          if (!justDragged || event.detail === 0) chooseQuestionSlot(selected,slot);
        });
        handle.addEventListener('dragstart', event => {
          if (state.busy) { event.preventDefault(); return; }
          justDragged = true;
          draggedQuestion = {question:selected,from:slot,version:state.lessonVersion};
          event.dataTransfer.setData('text/plain', selected.label); event.dataTransfer.effectAllowed = 'move';
        });
        handle.addEventListener('dragend', () => {
          draggedQuestion = null;
          $('question-slots').querySelectorAll('.drop-slot').forEach(el => el.classList.remove('drop-slot'));
        });
        moveHandle = handle;
      }
      label.addEventListener('dragover', event => {
        if (draggedQuestion?.version !== state.lessonVersion || state.busy) return;
        event.preventDefault(); event.dataTransfer.dropEffect = draggedQuestion.from ? 'move' : 'copy'; label.classList.add('drop-slot');
      });
      label.addEventListener('dragleave', event => {
        if (!label.contains(event.relatedTarget)) label.classList.remove('drop-slot');
      });
      label.addEventListener('drop', event => {
        label.classList.remove('drop-slot');
        if (draggedQuestion?.version !== state.lessonVersion) return;
        event.preventDefault();
        if (draggedQuestion.from) void movePick(draggedQuestion.from,slot,draggedQuestion.question.question_id);
        else placeInSlot(slot, draggedQuestion.question, select);
        draggedQuestion = null;
      });
    }
    select.disabled = !state.composer;
    select.addEventListener('change', () => save(slot, select.value, select));
    if (!state.composer) {
      const saved=element('span', selected?.label || '미선정','review-pick');label.append(saved);
    } else label.append(select);
    if (moveHandle) {
      const wrap = element('div',undefined,'slot-with-handle');
      wrap.append(label,moveHandle);
      slots.push(wrap);
    } else slots.push(label);
  }
  return slots;
}

function renderPicks() {
  const current = catalogUnitQuestions();
  const progress = lessonPickProgress();
  $('question-count').textContent = lessonProgressLabel(progress);
  const labels = lessonSlotName;
  const controls = pickControls(lessonSlots(), state.picks, current, labels, savePick);
  controls.slice(requiredLessonSlots()).forEach(control => control.classList.add('reserve'));
  const {required, basic:picked, reserve, optional} = progress;
  const group=(name,done,total,items)=>{
    const section=element('section',undefined,'slot-group');
    section.append(element('h4',name+' · '+done+' / '+total),...items);
    return section;
  };
  $('selection-role').textContent=state.composer ? '교재에서 문제를 눌러 자리를 고르거나, 원하는 칸으로 끌어 놓으세요.' : '선생님이 저장한 수업 문항입니다.';
  if(state.composer && currentCourse().id==='concept-foundations-han'){
    $('selection-role').textContent += currentLesson()?.quiz_mode==='appendix' ? ' 교사부록 ②는 기본 8개, 예비 최대 3개입니다.' : ' 퀴즈앤 ①은 기본 5개, 예비 최대 3개입니다.';
  }
  $('question-slots').replaceChildren(group('기본',picked,required,controls.slice(0,required)));
  if (controls.length>required) $('question-slots').append(group('예비 (선택)',reserve,optional,controls.slice(required)));
}

function stageQuestionsForBook() {
  return stageCatalog().filter(q => q.book === $('stage-book').value);
}

function setStageUnit(preferred, section) {
  const available = values(stageQuestionsForBook(), 'unit');
  options($('stage-unit'), available, preferred);
  setStageSection(section);
}

function selectedStageUnitQuestions() {
  return stageQuestionsForBook().filter(q => q.unit === $('stage-unit').value);
}

function setStageSection(preferred) {
  const sections = values(selectedStageUnitQuestions(), 'section');
  options($('stage-section'), sections, preferred ?? $('stage-section').value);
  renderStagePicks();
  renderStagePreview();
}

function selectedStageQuestions() {
  return selectedStageUnitQuestions().filter(q => q.section === $('stage-section').value);
}

function renderStagePicks() {
  const mode = activeQuizMode();
  const labels = slot => resourceStages[mode].slots[slot - 1];
  const controls = pickControls(quizCount(mode), state.stagePicks.get(mode), selectedStageQuestions(), labels,
    (slot, value, select) => savePick(slot, value, select, mode));
  $('stage-picks').replaceChildren(...controls.map((control, index) => {
    const slot = index + 1;
    const question = selectedStagePick(slot);
    const quiz = state.stageEdits.get(mode)?.get(slot);
    if (!question || !quiz || !usesQuizAndResources()) return control;
    const details = document.createElement('details');
    const summary = element('summary', quiz.book_quiz ? '4지선다 자동 저장 · 보기 확인' : '저장된 보기 확인');
    const choices = document.createElement('ol');
    for (const choice of quiz.choices.split('\n')) choices.append(element('li', choice));
    details.append(summary, element('p', quiz.prompt), choices, element('p', '정답 ' + quiz.answer + '번'));
    if (quiz.book_quiz) {
      const course = currentCourse();
      details.addEventListener('toggle', async function preview() {
        if (!details.open) return;
        details.removeEventListener('toggle', preview);
        try {
          const canvas = await bookQuizPreview({ ...question, quiz_override: quiz }, q => loadProjectionImage(course, q), usesQuizN(course));
          canvas.setAttribute('aria-label', question.label + ' 퀴즈 원문');
          if (quiz.book_quiz.mode === 'pairs') {
            choices.previousElementSibling?.remove(); choices.replaceWith(canvas);
          } else details.insertBefore(canvas, choices);
        } catch { details.append(element('p', '교재 이미지는 옆의 미리보기에서 확인할 수 있습니다.')); }
      });
    }
    const container = document.createElement('div');
    container.className = 'stage-pick';
    container.append(control, details);
    return container;
  }));
}

function usesQuizAndResources(mode = activeQuizMode()) {
  return ['appendix', 'rpm_final', 'rpm_pro'].includes(mode);
}

function selectedStagePick(slot, mode = activeQuizMode()) {
  return state.catalog.find(question => question.question_id === state.stagePicks.get(mode)?.get(slot));
}

function renderStagePreview() {
  const title = [$('stage-unit').value, $('stage-section').value].filter(Boolean).join(' · ');
  renderPageStack('stage-preview', $('stage-book').value, title, selectedStageQuestions());
}

async function withSaving(work, statusId) {
  if (state.busy) return;
  state.busy = true;
  const version = state.lessonVersion;
  const selectors = [...$('workspace').querySelectorAll('select, button, input, textarea')];
  const active = selectors.filter(control => !control.disabled);
  active.forEach(control => { control.disabled = true; });
  try {
    await work();
  } catch (error) {
    if (version === state.lessonVersion) failure(error, statusId);
  } finally {
    state.busy = false;
    active.forEach(control => { if (control.isConnected) control.disabled = false; });
    if (version === state.lessonVersion) {
      renderSubmission();
    }
  }
}

async function savePick(slot, value, select, mode, canUndo = true) {
  const picks = mode ? state.stagePicks.get(mode) : state.picks;
  const name = mode ? resourceSelections : 'math_selections';
  const status = mode ? 'stage-status' : 'selection-status';
  const previous = picks.get(slot);
  const question = state.catalog.find(item => item.question_id === Number(value));
  if (!question && !previous) return;
  $(status).textContent = '';
  await withSaving(async () => {
    const columns = mode ? 'slot,question_id,quiz_override' : 'slot,question_id';
    const filter = { ...context(), slot: 'eq.' + slot, select: columns };
    if (mode) filter.stage_mode = 'eq.' + mode;
    if (previous) filter.question_id = 'eq.' + previous;
    const result = !question
      ? await table(name, filter, 'DELETE')
      : previous
        ? await table(name, filter, 'PATCH', { question_id: question.question_id })
        : await table(name, { select: columns }, 'POST', {
          course_id: currentCourse().id, lesson: currentLesson().lesson, slot, question_id: question.question_id,
          ...(mode ? { stage_mode: mode } : {}),
        });
    if (!result.length) throw new ApiError(403, '이 문항을 변경할 권한이 없거나 이미 변경됐습니다.');
    if (question) {
      picks.set(slot, result[0].question_id);
    } else {
      picks.delete(slot);
    }
    state.edited = true;
    if (mode) {
      const edits = state.stageEdits.get(mode);
      if (question && result[0].quiz_override) edits.set(slot, result[0].quiz_override);
      else edits.delete(slot);
      renderStagePicks();
    } else renderPicks();
    if (mode) {
      $(status).textContent = question ? slot+'번에 '+question.label+'을 저장했습니다.' : slot+'번 문항을 비웠습니다.';
    } else {
      const before = state.catalog.find(q => q.question_id === previous)?.label ?? '빈 자리';
      const after = question?.label ?? '빈 자리';
      const message = lessonSlotName(slot)+' · '+(canUndo ? before+' → '+after : after+' (되돌림)');
      selectionFeedback(message, canUndo ? () => {
        const control = $('question-slots').querySelectorAll('select')[slot-1];
        if (control) void savePick(slot,previous ?? '',control,undefined,false);
      } : null);
    }
  }, status);
  if (select.isConnected) select.value = picks.get(slot) ?? '';
}

function renderQuizSlots(slot) {
  state.quizSlot = Number.isInteger(slot) && slot >= 1 && slot <= quizSeconds.length ? slot : 1;
  $('quiz-slots').replaceChildren(...quizSeconds.map((seconds, index) => {
    const number = index + 1;
    const duration = seconds < 60 ? seconds + '초' : seconds / 60 + '분';
    const saved = state.quizzes.has(number);
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.slot = number;
    button.setAttribute('aria-pressed', String(number === state.quizSlot));
    const label = document.createElement('span');
    label.textContent = '문항 ' + number + ' · ' + duration;
    const status = document.createElement('small');
    status.textContent = saved ? '완료' : '미저장';
    status.classList.toggle('saved', saved);
    button.append(label, status);
    button.addEventListener('click', () => {
      if (number === state.quizSlot) return;
      if (state.quizDirty && !window.confirm('저장하지 않은 퀴즈가 있습니다. 이동할까요?')) return;
      renderQuizSlots(number);
      renderQuiz();
      rememberView();
      renderSubmission();
      $('quiz-slots').querySelector('[aria-pressed="true"]').focus();
    });
    return button;
  }));
}

function quizFeedback(message, status = '') {
  const region = $('quiz-status');
  region.textContent = message;
  region.dataset.state = status;
}

function renderQuiz() {
  const quiz = state.quizzes.get(state.quizSlot);
  $('quiz-clear').hidden = !quiz || !state.composer;
  const choices = quiz?.choices?.split(/\r?\n/) ?? [];
  $('quiz-kind').value = quiz?.kind ?? 'short';
  $('quiz-answer').value = quiz?.kind === 'choice' ? '' : quiz?.answer ?? '';
  $('quiz-choice-answer').value = quiz?.kind === 'choice' && /^[1-4]$/.test(quiz.answer) ? quiz.answer : '';
  $('quiz-prompt').value = quiz?.prompt ?? '';
  choiceInputs.forEach((id, index) => { $(id).value = choices[index] ?? ''; });
  const extra = choices.slice(4).filter(Boolean);
  $('legacy-choices').textContent = extra.length ? '이전 추가 보기: ' + extra.join(' · ') : '';
  $('legacy-choices').hidden = !extra.length;
  quizFeedback(quiz ? '저장된 문항입니다.' : '', quiz ? 'success' : '');
  state.quizDirty = false;
  updateQuizPreview();
  teacherSymbols.reset();
}

function mathText(value) {
  const fragment = document.createDocumentFragment();
  const matches = value.matchAll(/\^\{([^{}]{1,60})\}|\(([^()\r\n]+)\)⁄\(([^()\r\n]+)\)/g);
  let from = 0;
  for (const match of matches) {
    fragment.append(document.createTextNode(value.slice(from, match.index)));
    if (match[1]) {
      const power = document.createElement('sup');
      power.textContent = match[1];
      fragment.append(power);
    } else {
      const fraction = document.createElement('span');
      fraction.className = 'fraction';
      fraction.setAttribute('aria-label', match[3] + '분의 ' + match[2]);
      for (const value of match.slice(2, 4)) {
        const term = document.createElement('span');
        term.append(mathText(value));
        fraction.append(term);
      }
      fragment.append(fraction);
    }
    from = match.index + match[0].length;
  }
  fragment.append(document.createTextNode(value.slice(from)));
  return fragment;
}

function updateQuizPreview() {
  const isChoice = $('quiz-kind').value === 'choice';
  $('choices-field').hidden = !isChoice;
  $('quiz-choice-answer-field').hidden = !isChoice;
  $('quiz-answer-field').hidden = isChoice;
  $('quiz-answer').placeholder = $('quiz-kind').value === 'ox' ? 'O 또는 X' : '';
  const text = $('quiz-prompt').value.trim();
  const list = $('quiz-preview-choices');
  const choices = isChoice ? choiceInputs.map(id => $(id).value.trim()) : [];
  const hasChoices = choices.some(Boolean);
  $('quiz-preview-empty').hidden = Boolean(text) || hasChoices;
  $('quiz-preview').hidden = !text;
  $('quiz-preview').replaceChildren(mathText(text));
  list.hidden = !hasChoices;
  list.replaceChildren(...choices.map(choice => {
    const li = document.createElement('li');
    li.append(choice ? mathText(choice) : '—');
    return li;
  }));
  teacherSymbols.update();
}

async function saveQuiz(event) {
  event.preventDefault();
  if (state.busy || !state.composer) return;
  const slot = state.quizSlot;
  const kind = $('quiz-kind').value;
  // 2x3 or 2²x5 is always multiplication; 2x and x² stay as the variable x.
  const prompt = numericTimes($('quiz-prompt').value.trim());
  let answer = $(kind === 'choice' ? 'quiz-choice-answer' : 'quiz-answer').value.trim();
  const choices = kind === 'choice' ? choiceInputs.map(id => numericTimes($(id).value.trim())) : [];
  if (kind === 'ox') answer = answer.toUpperCase();
  else if (kind === 'short') answer = numericTimes(answer);
  const incomplete = ['quiz-prompt', ...(kind === 'choice' ? choiceInputs : ['quiz-answer'])]
    .find(id => hasIncompleteMath($(id).value));
  if (incomplete) {
    quizFeedback('분수와 지수의 빈칸을 채워 주세요.', 'error');
    $(incomplete).focus();
    return;
  }
  if (!prompt) {
    quizFeedback('문제 내용을 입력해 주세요.', 'error');
    $('quiz-prompt').focus();
    return;
  }
  if (kind === 'choice' && (choices.some(choice => !choice) || !/^[1-4]$/.test(answer))) {
    quizFeedback('보기 4개를 모두 채우고 1~4번 중 정답을 선택해 주세요.', 'error');
    $(choiceInputs[choices.indexOf('')] ?? 'quiz-choice-answer').focus();
    return;
  }
  if (choices.join('\n').length > 1500) {
    quizFeedback('보기 전체를 1,500자 이하로 줄여 주세요.', 'error');
    return;
  }
  if (!answer || (kind === 'ox' && !['O', 'X'].includes(answer))) {
    quizFeedback(kind === 'ox' ? '정답에 O 또는 X를 입력해 주세요.' : '정답을 입력해 주세요.', 'error');
    $('quiz-answer').focus();
    return;
  }
  quizFeedback('저장 중…');
  await withSaving(async () => {
    const body = { kind, prompt, answer, choices: choices.join('\n') };
    const select = 'slot,kind,prompt,answer,choices';
    const filter = { ...context(), slot: 'eq.' + slot, select };
    const rows = state.quizzes.has(slot)
      ? await table('math_teacher_quizzes', filter, 'PATCH', body)
      : await table('math_teacher_quizzes', { select }, 'POST', {
        ...body, course_id: currentCourse().id, lesson: currentLesson().lesson, slot,
      });
    if (!rows.length) throw new ApiError(403, '이 퀴즈 문항을 저장할 권한이 없습니다.');
    state.quizzes.set(slot, rows[0]);
    state.edited = true;
    renderQuizSlots(slot);
    renderQuiz();
    rememberView();
    quizFeedback(slot + '번 문항을 저장했습니다.', 'success');
  }, 'quiz-status');
}

async function clearQuiz() {
  const slot = state.quizSlot;
  if (state.busy || !state.composer || !state.quizzes.has(slot)) return;
  if (!window.confirm(slot + '번 퀴즈 문항을 비울까요?')) return;
  let cleared = false;
  quizFeedback('비우는 중…');
  await withSaving(async () => {
    const filter = { ...context(), slot: 'eq.' + slot, select: 'slot' };
    const [removed] = await table('math_teacher_quizzes', filter, 'DELETE');
    if (!removed && (await table('math_teacher_quizzes', filter)).length) {
      throw new ApiError(403, '이 퀴즈 문항을 비울 권한이 없습니다.');
    }
    state.quizzes.delete(slot);
    state.edited = true;
    renderQuizSlots(slot);
    renderQuiz();
    quizFeedback(slot + '번 문항을 비웠습니다.', 'success');
    cleared = true;
  }, 'quiz-status');
  if (cleared) $('quiz-prompt').focus();
}

function renderSubmissionChecklist(items) {
  if (!state.composer) return;
  $('submission-checklist').replaceChildren(...items.map(({ stage, title, count, total, detail, ready }) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    const label = document.createElement('span');
    const status = document.createElement('small');
    button.type = 'button';
    button.dataset.ready = String(ready);
    button.disabled = state.busy;
    label.textContent = title;
    status.textContent = count + ' / ' + total + ' · ' + detail;
    button.append(label, status);
    button.addEventListener('click', () => {
      if (showStage(stage)) document.querySelector('[data-stage="' + stage + '"]').focus({preventScroll:true});
    });
    li.append(button);
    return li;
  }));
}

function changedSubmission(mode) {
  const saved = state.submitted;
  if (!saved) return true;
  if (mode && saved.selected_quiz_mode !== mode) return true;
  if (saved.selections.length !== [...state.picks.keys()].filter(slot => slot <= slotLimits(currentCourse(),mode ?? currentLesson()?.quiz_mode)[1]).length ||
      saved.selections.some(p => state.picks.get(p.slot) !== p.question_id)) return true;
  if (!mode || mode === 'teacher') {
    if (saved.quizzes.length !== state.quizzes.size || saved.quizzes.some(q => {
      const draft = state.quizzes.get(q.slot);
      return !draft || ['kind','prompt','answer','choices'].some(key => draft[key] !== q[key]);
    })) return true;
  }
  const resources = mode ? [mode] : lessonModes();
  const count = resources.reduce((sum,m) => sum + (state.stagePicks.get(m)?.size ?? 0), 0);
  const stages = saved.stage_questions ?? [];
  return count !== stages.length || stages.some(q => {
    const m = savedResourceMode(q);
    const draft = state.stageEdits.get(m)?.get(q.slot);
    return state.stagePicks.get(m)?.get(q.slot) !== q.question_id ||
      ['prompt','choices','answer'].some(key => q.quiz_override?.[key] !== draft?.[key]);
  });
}

function renderSubmission() {
  $('lesson-ppt').disabled = !state.submitted;
  $('quiz-excel').disabled = !state.submitted;
  const groups = lessonModes().map(mode => {
    const picks = state.stagePicks.get(mode);
    const count = mode === 'teacher' ? state.quizzes.size : picks?.size ?? 0;
    const total = quizCount(mode);
    const conversion = usesQuizAndResources(mode) && [...(picks?.keys() ?? [])].some(slot =>
      selectedStagePick(slot, mode)?.five_choice && !state.stageEdits.get(mode).has(slot));
    const unsaved = mode === 'teacher' && state.quizDirty;
    const ready = count === total && !conversion && !unsaved;
    const detail = unsaved ? '저장 필요' : conversion ? '교재 정답 확인 필요' : ready ? '완료' : '작성 필요';
    return { mode, stage:quizModes[mode].stage, title:stageTitle(mode), count, total, conversion, unsaved, ready, detail };
  });
  const mode = usesQuizN(currentCourse()) ? currentLesson().quiz_mode : null;

  const {required:totalBasics, basic:selectedBasics, reserve, optional} = lessonPickProgress();
  const basic = selectedBasics === totalBasics;
  const missing = groups.find(group => !group.ready);
  const ready = basic && groups.length > 0 && !missing;
  state.edited = changedSubmission(mode);
  updateStageProgress();
  renderSubmissionChecklist([
    { stage:'catalog', title:'기본 수업 문항', count:selectedBasics, total:totalBasics,
      detail:(basic ? '완료' : '선정 필요') + (optional ? ' · 예비(선택) ' + reserve + '/' + optional : ''), ready:basic },
    ...groups,
  ]);
  $('submit').disabled = state.busy || !ready || Boolean(state.submitted && !state.edited);
  $('submit').textContent = state.submitted ? '수정본 제출' : '회차 제출';
  if (!ready) {
    $('submit-status').textContent = !basic ? '기본 문항 ' + requiredLessonSlots() + '개를 먼저 골라 주세요.'
      : !groups.length ? '회차별 커리큘럼을 확인해 주세요.'
      : missing.unsaved ? '입력한 퀴즈를 저장해 주세요.'
        : missing.conversion ? missing.title + '에서 문항을 다시 선택해 주세요.'
        : missing.title + ' 문항을 모두 채워 주세요.';
  } else if (state.submitted && !state.edited) {
    const submitted = new Date(state.submitted.submitted_at).toLocaleString('ko-KR');
    $('submit-status').textContent = '제출 완료 · ' + submitted + (reviewLabel(state.submitted) ? ' · '+reviewLabel(state.submitted) : '') + (state.submitted.sync_status === 'synced' ? ' · Google 반영 완료' : ' · Google 연결 대기');
  } else {
    $('submit-status').textContent = mode ? '수업 문항과 퀴즈앤 ' + quizModes[mode].number + '을 제출하면 교재 문항의 고딕 변환이 자동으로 시작됩니다.'
      : '제출하면 이 회차의 자료를 저장하고 교재 문항을 고딕으로 변환합니다.';
  }
}

async function submit() {
  if ($('submit').disabled) return;
  $('submit-feedback').textContent = '';
  await withSaving(async () => {
    const rows = await table('math_submissions', { select: 'id,submitted_at,sync_status,selected_quiz_mode,selections,quizzes,stage_questions' }, 'POST', {
      course_id: currentCourse().id, lesson: currentLesson().lesson,
      ...(usesQuizN(currentCourse()) ? {selected_quiz_mode:currentLesson().quiz_mode} : {}),
    });
    if (!rows[0]) throw new ApiError(403, '이 회차를 제출할 권한이 없습니다.');
    state.submitted = {...rows[0],math_submission_reviews:{status:'queued'}};
    state.edited = false;
    if (state.stage === 'delivery' && $('all-progress').open) void loadProgress();
    state.exportReceipt = null;
    $('ppt-result').hidden = true;
    $('ppt-result').removeAttribute('href');

  }, 'submit-feedback');
}

function resultLink(value) {
  const url = new URL(value);
  if (url.origin !== 'https://docs.google.com' || !/^\/presentation\/d\/[A-Za-z0-9_-]+\/edit\/?$/.test(url.pathname)) return null;
  $('ppt-result').href = url.origin + url.pathname;
  $('ppt-result').hidden = false;
  return $('ppt-result').href;
}

function receiptFilter() {
  return {
    course_id: 'eq.' + currentCourse().id,
    submission_id: 'eq.' + state.submitted.id,
    select: 'drive_url',
  };
}

async function loadExportReceipt(version) {
  const submitted = state.submitted.id;
  try {
    const [receipt] = await table('math_staff_exports', receiptFilter());
    if (version === state.lessonVersion && submitted === state.submitted?.id && receipt) {
      state.exportReceipt = resultLink(receipt.drive_url);
    }
  } catch {
    // PPT creation remains available when the saved link cannot be retrieved.
  }
}

function staffCourse(course) {
  return state.editor || state.memberships.some(m => m.course_id===course.id && m.team_role==='staff');
}

function transferRow(course, lesson, submission, receipts, plans) {
  const pick = values => Object.fromEntries(values.filter(v => v.course_id===course.id && v.lesson===lesson.lesson).map(v => [v.channel,v]));
  return { course, lesson, submission, receipts:pick(receipts), plans:pick(plans) };
}

function rpc(name,body) { return table('rpc/'+name,{},'POST',body); }

async function transferData(course) {
  const filter = {course_id:'eq.'+course.id};
  const [lessons, submissions, receipts, plans, settings] = await Promise.all([
    table('math_lessons',{...filter,select:'course_id,lesson,topic,live_date,curriculum_url,quiz_mode',order:'lesson'}),
    table('math_transfer_versions',{...filter,select:'lesson,id'}),
    table('math_transfer_state',{...filter,select:'course_id,lesson,channel,completed_id,result_url,claim_until,destination'}),
    table('math_transfer_plans',{...filter,work_day:'eq.'+workDay(),select:'course_id,lesson,channel,allow_repeat_id'}),
    table('math_transfer_settings',{...filter,select:'sheet_url,folder_url,revision'})
  ]);
  return {rows:lessons.map(l => transferRow(course,l,submissions.find(s=>s.lesson===l.lesson),receipts,plans)),settings:settings[0]};
}

async function openTransfers(requested, week = null) {
  const courses = Array.isArray(requested) ? requested : [requested];
  if (!courses.length || courses.some(c=>!staffCourse(c)) || state.busy || transferContext || staffProgress?.pending) return;
  const ctx = transferContext = {courses, week, day:workDay(), loading:true, rows:[], destinations:new Map(), pending:0};
  $('transfer-course').textContent=courses[0].instructor+' · '+courses.map(className).join(' / ');
  $('transfer-preview').replaceChildren(); $('transfer-counts').textContent='';
  $('transfer-config-status').textContent=''; $('transfer-check-status').textContent='불러오는 중…';
  $('transfer-urls').disabled=true; $('transfer-run').disabled=true;
  $('transfer-location').open=false;
  $('destination-sheet').value=''; $('destination-slides').value='';
  $('destination-course-label').hidden = courses.length <= 1;
  options($('destination-course'),courses.map(c=>[c.id,className(c)]),courses[0].id);
  $('transfer-dialog').showModal();
  try {
    const data = await Promise.all(courses.map(transferData));
    if (ctx!==transferContext) return;
    courses.forEach((course,i) => {
      const settings = data[i].settings;
      ctx.destinations.set(course.id,{course,settings,sheet:settings?.sheet_url ?? '',slides:settings?.folder_url ?? ''});
    });
    ctx.rows = data.flatMap(d=>d.rows).sort((a,b)=>a.lesson.lesson-b.lesson.lesson);
    const missing = selectedTransfers(ctx.rows).find(({row,channel}) => !ctx.destinations.get(row.course.id)[channel]);
    if (missing) {
      $('transfer-location').open=true;
      $('destination-course').value=missing.row.course.id;
    }
    ctx.loading = false;
    $('transfer-urls').disabled=false; $('transfer-check-status').textContent='';
    showDestination();
    renderTransfers();
  } catch(error) { if (ctx===transferContext) $('transfer-check-status').textContent=error.message; }
}

function showDestination() {
  const target = transferContext.destinations.get($('destination-course').value);
  $('destination-sheet').value = target.sheet;
  $('destination-slides').value = target.slides;
  $('save-destinations').disabled = !target.settings;
  $('transfer-config-status').textContent = target.settings ? '' : '등록된 기본 주소가 없습니다. 이번에 사용할 주소를 입력하세요.';
  for (const button of $('transfer-urls').querySelectorAll('[data-copy]')) button.disabled=!target[button.dataset.copy].trim();
}

function selectedTransfers(rows) {
  return rows.flatMap(row=>Object.keys(channels).filter(key=>row.plans[key] && transferStatus(row,key).available).map(channel=>({row,channel})));
}

function renderTransfers() {
  const ctx=transferContext;
  if (!ctx || ctx.loading) return;
  const grid=element('table'); grid.setAttribute('aria-label','회차별 반영 선택');
  const head=grid.createTHead().insertRow();
  for (const label of ['회차','Google 시트','슬라이드']) head.append(element('th',label));
  const body=grid.createTBody();
  const visible = ctx.rows.filter(row => row.submission && (ctx.week === null || lessonWeek(row.lesson.lesson) === ctx.week || Object.keys(row.plans).length));
  for (const row of visible) {
    const tr=body.insertRow();
    const title=element('th',className(row.course)+' '+row.lesson.lesson+'강'); title.scope='row'; title.title=row.lesson.topic; tr.append(title);
    for (const channel of Object.keys(channels)) tr.append(transferCell(row,channel,updatePlan));
  }
  $('transfer-preview').replaceChildren(grid);
  if (!body.rows.length) {const cell=body.insertRow().insertCell();cell.colSpan=3;cell.textContent=ctx.week ? '이 주차에는 반영할 수업이 없습니다.' : '아직 제출된 회차가 없습니다.';}
  renderTransferCounts();
}

function renderTransferCounts() {
  const ctx=transferContext;
  const chosen=selectedTransfers(ctx.rows);
  $('transfer-counts').textContent=Object.entries(channels).map(([ch,label])=> {
    const rows=chosen.filter(x=>x.channel===ch).map(x=>x.row);
    return label+' '+rows.length+'개'+(rows.length?' ('+lessonList(rows)+')':'');
  }).join(' / ');
  $('transfer-run').disabled=Boolean(ctx.busy || ctx.loading || ctx.saving || ctx.pending || !chosen.length);
}

const actionMessages={busy:'다른 직원이 반영 중입니다.',revised:'새 제출본이 있습니다. 목록을 확인해 주세요.',done:'이미 완료되어 잠겨 있습니다.',removed:'오늘 목록에서 제외됐습니다.',day:'날짜가 바뀌었습니다. 팝업을 다시 열어 주세요.'};

async function updatePlan(row,channel,action,cell) {
  const ctx=transferContext;
  const view=ctx ?? staffProgress;
  if (!view || state.busy || ctx?.busy || cell.hasAttribute('aria-busy')) return;
  if (action==='repeat' && !window.confirm(className(row.course)+' '+row.lesson.lesson+'강 '+channels[channel]+'를 오늘 다시 반영할까요?')) return;
  const notice=ctx ? $('transfer-config-status') : $('transfer-feedback');
  const button=ctx ? $('transfer-run') : $('progress-transfer');
  const blockClick=event=>event.preventDefault();
  cell.setAttribute('aria-busy','true');
  cell.addEventListener('click',blockClick,true);
  view.pending++;
  button.disabled=true;
  if (!ctx) refreshProgressActions();
  else $('transfer-cancel').disabled=true;
  let refresh=false;
  try {
    const result=await rpc('math_plan_transfer',{p_course:row.course.id,p_lesson:row.lesson.lesson,p_channel:channel,p_submission:row.submission?.id??null,p_action:action,p_day:ctx?.day??workDay()});
    if (result!=='ok') throw Error(actionMessages[result] || '선택을 저장하지 못했습니다.');
    if (action==='remove') delete row.plans[channel];
    else row.plans[channel]={allow_repeat_id:action==='repeat' ? row.submission.id : null};
    if (view !== (ctx ? transferContext : staffProgress)) return;
    notice.textContent=className(row.course)+' '+row.lesson.lesson+'강 '+channels[channel]+(action==='remove'?' 선택을 해제했습니다.':'를 선택했습니다.');
    cell.querySelector('input').checked=Boolean(row.plans[channel]) && transferStatus(row,channel).available;
    if (action==='repeat' || (action==='remove' && transferStatus(row,channel).locked)) {
      const replacement=transferCell(row,channel,updatePlan);
      replacement.dataset.channel=channels[channel];
      const focused=cell.contains(document.activeElement);
      cell.replaceWith(replacement);
      if (focused) (replacement.querySelector('button') ?? replacement.querySelector('input')).focus({preventScroll:true});
    }
  } catch(error) {
    if (view !== (ctx ? transferContext : staffProgress)) return;
    notice.textContent=error.message;
    cell.querySelector('input').checked=Boolean(row.plans[channel]) && transferStatus(row,channel).available;
    refresh=true;
  } finally {
    view.pending--;
    cell.removeAttribute('aria-busy');
    cell.removeEventListener('click',blockClick,true);
    if (view === (ctx ? transferContext : staffProgress)) {
      if (refresh) view.needsRefresh=true;
      if (ctx) {renderTransferCounts(); $('transfer-cancel').disabled=Boolean(view.pending || ctx.busy || ctx.saving);}
      else refreshProgressActions();
      if (!view.pending && view.needsRefresh) {
        delete view.needsRefresh;
        if (ctx) {
          ctx.loading=true; button.disabled=true;
          try {
            const data=await Promise.all(ctx.courses.map(transferData));
            if (ctx===transferContext) {ctx.rows=data.flatMap(d=>d.rows);ctx.loading=false;renderTransfers();}
          } catch {if (ctx===transferContext) notice.textContent+=' 창을 다시 열어 최신 상태를 확인하세요.';}
        } else if (state.stage==='delivery') {
          const focused=document.activeElement;
          const label=cell.contains(focused) && focused.getAttribute('aria-label');
          await loadProgress();
          if (label && document.activeElement===document.body && state.stage==='delivery') {
            $('progress-tracks').querySelector('[aria-label="'+CSS.escape(label)+'"]')?.focus({preventScroll:true});
          }
        }
      }
    }
  }
}

function sheetURL(course,raw) {
  const t=sheetDestination(course,raw);
  return 'https://docs.google.com/spreadsheets/d/'+t.id+'/edit'+(t.gid===null?'':'?gid='+t.gid+'#gid='+t.gid);
}

async function saveDestinations() {
  const ctx=transferContext;
  if (!ctx || ctx.busy || ctx.loading) return;
  const status=$('transfer-config-status');
  const target=ctx.destinations.get($('destination-course').value);
  if (!target?.settings) return;
  try {
    const sheet=sheetURL(target.course,$('destination-sheet').value);
    const folder=$('destination-slides').value.trim();
    const url=folder ? folderDestination(folder).url : '';
    if (sheet===target.settings.sheet_url && url===target.settings.folder_url) {status.textContent='이미 같은 팀 기본값입니다.';return;}
    if (!window.confirm(target.course.instructor+' '+tracks[target.course.track]+'의 팀 기본 주소를 변경할까요? 두 직원에게 적용됩니다.')) return;
    $('transfer-urls').disabled=true; $('transfer-cancel').disabled=true; ctx.saving=true; $('transfer-run').disabled=true;
    const updated=await table('math_transfer_settings',{course_id:'eq.'+target.course.id,revision:'eq.'+target.settings.revision,select:'sheet_url,folder_url,revision'},'PATCH',{sheet_url:sheet,folder_url:url,revision:target.settings.revision+1});
    if (ctx!==transferContext) return;
    if (!updated.length) throw Error('다른 직원이 기본값을 변경했습니다. 팝업을 다시 열어 확인해 주세요.');
    target.settings=updated[0]; target.sheet=sheet; target.slides=url; showDestination();
    status.textContent='이 수업의 팀 기본값으로 저장했습니다.';
  } catch(error) {status.textContent=error.message;}
  finally { if (ctx===transferContext) {ctx.saving=false; $('transfer-urls').disabled=false; $('transfer-cancel').disabled=Boolean(ctx.pending); renderTransferCounts();} }
}

async function questionAssets(course, picks) {
  const ids=[...new Set(picks.map(p=>p.question_id))];
  const items=ids.length ? await table('math_question_index',{course_id:'eq.'+course.id,question_id:'in.('+ids.join(',')+')',select:'question_id,bundle_root_id,bundle_parts,book,section,page,label,preview_book,slide_crop,slide_prompt_crop,projection_asset,projection_layout,gothic_content'}) : [];
  const withAsset=pick=>{
    const item=items.find(x=>x.question_id===pick.question_id);
    if (!item) throw Error('선택한 교재 문항을 찾을 수 없습니다.');
    return {...item,slot:pick.slot,quiz_override:pick.quiz_override};
  };
  const pages = new Map();
  const loadPage = question => {
    const key = question.projection_asset ?? question.preview_book + '/' + question.page;
    if (!pages.has(key)) pages.set(key, loadProjectionImage(course, question));
    return pages.get(key);
  };
  return {withAsset,loadPage};
}

function stageImage(pick,lesson,withAsset) {
  const mode = savedResourceMode(pick,lesson);
  return {...withAsset(pick),stage_mode:mode,stageLabel:stageTitle(mode),quizOne:quizModes[mode].number==='①'};
}

async function slideBlob(row, submission) {
  const {course,lesson} = row;
  const appendix = submission.stage_questions ?? [];
  const review=submission.math_submission_reviews;
  const approved=review?.status==='passed' ? review.crop_fixes : {};
  const {withAsset,loadPage} = await questionAssets(course,[...submission.selections,...appendix]);
  const template = submissionTemplate(course,submission,lesson.quiz_mode);
  const next = (currentCourse()?.id===course.id ? state.lessons.find(l=>l.lesson===lesson.lesson+1) : null)
    ?? (template ? (await table('math_lessons',{course_id:'eq.'+course.id,lesson:'eq.'+(lesson.lesson+1),select:'topic',limit:1}))[0] : null);
  const templateBytes=template ? await (await request('/storage/v1/object/authenticated/math-ppt-templates/'+course.id+'/'+template+'-v1.pptx')).arrayBuffer() : null;
  return buildPresentation({title:deckTitle(row),intro:lessonIntro(course,lesson),templateBytes,topic:lesson.topic,nextTopic:next?.topic,picks:submission.selections.map(pick=>{
      const item=withAsset(pick), bounds=approved?.[pick.question_id];
      return bounds ? {...item,projection_layout:{bounds}} : item;
    }),
    quizzes:submission.quizzes ?? [],
    appendix:appendix.map(p=>stageImage(p,lesson,withAsset)),quizLabel:'퀴즈앤 ①'},loadPage);
}

// Confirm only unkeyed textbook items. A revised submission gets a fresh cache key.
const confirmedQuizKeys = new Map();
function confirmQuizKey(submissionId,q,canvas,number) {
  const key = [submissionId,q.quizOne,q.slot,q.question_id].join('/');
  if (confirmedQuizKeys.has(key)) return confirmedQuizKeys.get(key);
  const dialog=$('quiz-key-dialog'), form=$('quiz-key-form'), type=$('quiz-key-type');
  form.reset();
  $('quiz-key-source').textContent=number+'번 · '+q.book+' '+q.label;
  $('quiz-key-error').textContent='';
  canvas.style.cssText='display:block;max-width:100%;height:auto';
  $('quiz-key-preview').replaceChildren(canvas);
  function refresh() {
    const text=type.value==='choice';
    $('quiz-key-choices-label').hidden=!text;
    $('quiz-key-answer-label').textContent=type.value==='short' ? '정답' : type.value==='ox' ? '정답 (O 또는 X)' : '정답 번호 (1~4)';
  }
  type.onchange=refresh; refresh();
  return new Promise((resolve,reject)=>{
    let result;
    $('quiz-key-cancel').onclick=()=>dialog.close();
    dialog.onclose=()=>{
      form.onsubmit=null; type.onchange=null; dialog.onclose=null;
      $('quiz-key-preview').replaceChildren();
      if (!result) { reject(new DOMException('취소','AbortError')); return; }
      confirmedQuizKeys.set(key,result); resolve(result);
    };
    form.onsubmit=event=>{
      event.preventDefault();
      try {
        const image=type.value==='image', kind=image ? 'choice' : type.value;
        const raw=$('quiz-key-answer').value.trim();
        const plan=quizPlan({kind,answer:kind==='ox' ? raw.toUpperCase() : raw,choices:image ? numberButtons.join('\n') : $('quiz-key-choices').value});
        if (kind==='short' && raw.length>15) throw Error('퀴즈앤 단답형 정답은 15자 이내로 입력해 주세요.');
        if (type.value==='choice' && plan.imageChoices) throw Error('답 버튼의 보기는 각각 30자 이내로 입력해 주세요.');
        result={plan};
        dialog.close();
      } catch(error) { $('quiz-key-error').textContent=error.message; }
    };
    dialog.showModal();
  });
}

function downloadFile(blob,filename) {
  const url=URL.createObjectURL(blob), link=element('a');
  link.href=url;link.download=filename;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

async function downloadLessonPpt() {
  const button=$('lesson-ppt'), notice=$('submit-feedback');
  if (button.disabled || !state.submitted) return;
  const row={course:currentCourse(),lesson:currentLesson()}, id=state.submitted.id;
  button.disabled=true;notice.textContent='수업 PPT를 만드는 중입니다.';
  try {
    const [saved]=await table('math_submissions',{course_id:'eq.'+row.course.id,id:'eq.'+id,select:'id,selections,quizzes,stage_questions,selected_quiz_mode,math_submission_reviews(status,crop_fixes,updated_at)'});
    if (!saved) throw Error('제출본을 찾지 못했습니다.');
    const name=deckTitle(row)+'.pptx';
    downloadFile(await slideBlob(row,saved),name);
    notice.textContent=name+' 다운로드를 시작했습니다.';
  } catch(error) {notice.textContent='PPT를 받지 못했습니다. '+error.message;}
  finally {button.disabled=!state.submitted;}
}

async function downloadQuizExcel(row,button,notice) {
  if (button.disabled || !row.submission) return;
  button.disabled = true;
  notice.textContent = '제출한 퀴즈로 등록용 엑셀을 만드는 중입니다.';
  try {
    const [saved] = await table('math_submissions',{course_id:'eq.'+row.course.id,id:'eq.'+row.submission.id,select:'id,quizzes,stage_questions'});
    if (!saved) throw Error('제출본을 찾지 못했습니다.');
    const picks = saved.stage_questions ?? [];
    const {withAsset,loadPage} = await questionAssets(row.course,picks);
    const workbook = await quizExcel(saved.quizzes ?? [], picks.map(p=>stageImage(p,row.lesson,withAsset)), loadPage, (q,canvas,number)=>confirmQuizKey(row.submission.id,q,canvas,number));
    const filename=[row.course.instructor,className(row.course),row.lesson.lesson+'강','퀴즈앤'].join('_')+'.xlsx';
    downloadFile(workbook,filename);
    notice.textContent=filename+' 다운로드를 시작했습니다.';
  } catch (error) { notice.textContent = error.name==='AbortError' ? '다운로드를 취소했습니다.' : '등록 자료를 받지 못했습니다. '+error.message; }
  finally { button.disabled = false; }
}

async function loadProjectionImage(course, question) {
  const sourceBooks = ['concept-m1','concept-appendix','rpm-student','rpm-pro-student','rpm-appendix'];
  if (!sourceBooks.includes(question.preview_book)) throw Error('학생용 교재 또는 교사부록의 원본을 확인해 주세요.');
  if (question.projection_asset) {
    const path = '/storage/v1/object/authenticated/math-teaching-materials/' + encodeURIComponent(course.id) + '/' + question.projection_asset;
    return (await request(path)).blob();
  }
  const page = previewPath(course.preview_course_id ?? course.id, question.preview_book, question.page);
  const highResolution = page.replace('/page-', '/projection-hq/page-');
  return (await request(highResolution)).blob();
}

function deckTitle({course,lesson}) {
  const track = course.track === 'concept' ? '개념 탄탄' : '실력 탄탄';
  const number = String(lesson.lesson).padStart(2, '0');
  return '[RA 수학] 중1-1 '+track+'_'+number+'강 ('+course.instructor+')';
}
async function transferOne(task,connection,sheet,folder,folderUrl) {
  const {row,channel}=task, sid=row.submission.id, claim=crypto.randomUUID();
  const args={p_course:row.course.id,p_lesson:row.lesson.lesson,p_channel:channel,p_submission:sid,p_claim:claim};
  const check=async()=>{const result=await rpc('math_claim_transfer',{...args,p_planned:true});if(result!=='ready') throw Error(actionMessages[result] || '반영 권한을 확인해 주세요.');};
  await check();
  try {
    const [submission]=await table('math_submissions',{course_id:'eq.'+row.course.id,id:'eq.'+sid,select:'id,selections,quizzes,stage_questions,selected_quiz_mode,math_submission_reviews(status,crop_fixes,updated_at)'});
    if (!submission) throw Error('제출본을 찾을 수 없습니다.');
    let url,destination;
    if (channel==='sheet') {
      const prev=row.receipts.sheet;
      // Before team overrides, the site always wrote to the lesson's configured curriculum URL.
      const lastTarget=prev?.destination || (prev?.completed_id && sheetURL(row.course,row.lesson.curriculum_url));
      const prior=prev?.completed_id && lastTarget===sheet ? await table('math_submissions',{course_id:'eq.'+row.course.id,id:'eq.'+prev.completed_id,select:'selections,quizzes,stage_questions,selected_quiz_mode'}) : [];
      const cells=await syncSubmissionToSheet(sheetDestination(row.course,sheet),row.lesson,submission,connection,prior[0],check);
      if (!cells) throw Error('기존 셀 변경을 취소했습니다.');
      url=cells.url;destination=sheet;
    } else {
      const review=submission.math_submission_reviews;
      const template=submissionTemplate(row.course,submission,row.lesson.quiz_mode);
      const baseLayout=template ? 'lx-lora-v5-'+template : 'han-lora-v7';
      const rewritten = [...(submission.quizzes ?? []), ...(submission.stage_questions ?? []).map(p => p.quiz_override)]
        .some(q => normalizeQuizNotation(q) !== q);
      const quizLayout = rewritten ? baseLayout+'-numeric-product' : baseLayout;
      const layout=review?.status==='passed' && Object.keys(review.crop_fixes ?? {}).length
        ? quizLayout+'@'+Date.parse(review.updated_at) : quizLayout;
      const prev=row.receipts.slides;
      const [prior]=prev?.completed_id ? await table('math_staff_exports',{course_id:'eq.'+row.course.id,submission_id:'eq.'+prev.completed_id,select:'drive_url'}) : [];
      const priorId=prior?.drive_url?.match(/^https:\/\/docs\.google\.com\/presentation\/d\/([A-Za-z0-9_-]+)\/edit/)?.[1];
      url=await saveSlidesToStaffDrive(connection,()=>slideBlob(row,submission),deckTitle(row),sid,folder,check,layout,{id:priorId,submission:prev?.completed_id});
      destination=folderUrl;
    }
    if (!await rpc('math_finish_transfer',{...args,p_url:url,p_destination:destination})) throw Error('Google 결과의 완료 기록을 확인해 주세요.');
    return url;
  } finally {
    await table('math_transfer_state',{course_id:'eq.'+row.course.id,lesson:'eq.'+row.lesson.lesson,channel:'eq.'+channel,claim:'eq.'+claim,select:'lesson'},'PATCH',{claim:null,claim_until:null});
  }
}

async function runTransfers() {
  const ctx=transferContext;
  if (!ctx || ctx.busy || ctx.pending || ctx.loading || ctx.saving) return;
  const tasks=selectedTransfers(ctx.rows);
  if (!tasks.length) return;
  const status=$('transfer-check-status');status.replaceChildren();
  ctx.busy=true; $('transfer-run').disabled=true; $('transfer-cancel').disabled=true; $('transfer-urls').disabled=true;
  $('transfer-preview').inert=true;
  try {
    if (ctx.day!==workDay()) throw Error(actionMessages.day);
    const destinations=new Map();
    for (const course of ctx.courses) {
      const selected=tasks.filter(task=>task.row.course.id===course.id);
      if (!selected.length) continue;
      const draft=ctx.destinations.get(course.id);
      try {
        const sheet=selected.some(t=>t.channel==='sheet') ? sheetURL(course,draft.sheet) : '';
        const dest=selected.some(t=>t.channel==='slides') ? folderDestination(draft.slides) : null;
        destinations.set(course.id,{sheet,dest});
      } catch(error) {throw Error(className(course)+' · '+error.message);}
    }
    const scopes=Object.keys(channels).filter(ch=>tasks.some(t=>t.channel===ch)).map(ch=>'https://www.googleapis.com/auth/'+(ch==='sheet'?'spreadsheets':'drive'));
    const connection=await connectStaffGoogle(scopes.join(' '));
    const folders=new Map();
    for (const task of tasks) {
      const {sheet,dest}=destinations.get(task.row.course.id);
      const item=element('p',className(task.row.course)+' '+task.row.lesson.lesson+'강 '+channels[task.channel]+' · ');status.append(item);
      try {
        let folder;
        if (task.channel==='slides') {
          if (!folders.has(dest.url)) folders.set(dest.url,openDestinationFolder(connection,dest));
          folder=await folders.get(dest.url);
        }
        const url=await transferOne(task,connection,sheet,folder,dest?.url);
        const link=element('a','완료 · 열기');link.href=url;link.target='_blank';link.rel='noopener noreferrer';item.append(link);
        if (task.channel==='slides') {
          const folderLink=element('a','저장 폴더');
          folderLink.href=dest.url; folderLink.target='_blank'; folderLink.rel='noopener noreferrer';
          item.append(' · ',folderLink);
        }
        if (task.channel==='slides' && task.row.course.id===state.courseId && task.row.lesson.lesson===currentLesson()?.lesson) resultLink(url);
      } catch(error) {item.append(error.message);}
    }
  } catch(error) {status.append(element('p',error.message));}
  finally {
    try {ctx.rows=(await Promise.all(ctx.courses.map(transferData))).flatMap(d=>d.rows).sort((a,b)=>a.lesson.lesson-b.lesson.lesson);}
    catch(error) {ctx.loading=true;status.append(element('p','목록을 다시 열어 반영 결과를 확인해 주세요.'));}
    ctx.busy=false; $('transfer-urls').disabled=false; $('transfer-preview').inert=false; $('transfer-cancel').disabled=false;
    renderTransfers();
  }
}


function resetPageStack(prefix) {
  const previous = state.pagePreviews.get(prefix);
  previous?.observer.disconnect();
  for (const url of previous?.urls ?? []) URL.revokeObjectURL(url);
  state.pagePreviews.delete(prefix);
  $(prefix + '-scroll').replaceChildren();
}

function clearPreview() {
  for (const prefix of ['preview', 'stage-preview']) resetPageStack(prefix);
}

function positionCatalog() {
  const view = state.pagePreviews.get('preview');
  const scroller = $('preview-scroll');
  if (!view || !scroller.clientHeight) return;
  if ('initialType' in view) {
    const target = view.anchors?.find(a => a.name === view.initialType);
    scroller.scrollTop = target?.figure.offsetTop ?? 0;
    delete view.initialType;
  }
  markCatalogType();
}

function markCatalogType() {
  const scroller = $('preview-scroll');
  const anchors = state.pagePreviews.get('preview')?.anchors;
  if (!anchors?.length || !scroller.clientHeight) return;
  const active = anchors.findLast(a => a.figure.offsetTop <= scroller.scrollTop + 2) ?? anchors[0];
  if (active.button.getAttribute('aria-current') === 'location') return;
  for (const {button} of anchors) button.removeAttribute('aria-current');
  active.button.setAttribute('aria-current','location');
  const bar = $('type-links');
  if (active.button.offsetLeft < bar.scrollLeft) bar.scrollLeft = active.button.offsetLeft;
  else if (active.button.offsetLeft + active.button.offsetWidth > bar.scrollLeft + bar.clientWidth) {
    bar.scrollLeft = active.button.offsetLeft + active.button.offsetWidth - bar.clientWidth;
  }
}

function renderPageStack(prefix, bookName, title, questions, grouped = false) {
  const groups = new Map();
  for (const q of questions) {
    const name = grouped ? q.section : '';
    if (!groups.has(name)) groups.set(name, new Map());
    groups.get(name).set(q.page,q.preview_book);
  }
  const pages = Array.from(groups, ([name, group]) =>
    [...group].sort(([a],[b]) => a-b).map(([page,book], i) => ({page,book,section:name,heading:i === 0 ? name : ''}))
  ).flat();
  const activeCourse = currentCourse();
  const course = activeCourse?.preview_course_id ?? activeCourse?.id;
  const key = JSON.stringify([course,bookName,title,pages]);
  if (state.pagePreviews.get(prefix)?.key === key) return;
  resetPageStack(prefix);
  const scroller = $(prefix + '-scroll');
  $(prefix + '-title').textContent = title || '교재 원본';
  $(prefix + '-status').textContent = pages.length ? bookName + ' · ' + pages.length + '쪽' : '등록된 페이지가 없습니다.';
  const urls = [];
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const { page, book } = entry.target.dataset;
      const items = grouped && state.composer ? questions.filter(q => q.page === Number(page)
        && q.preview_book === book && q.section === entry.target.dataset.section) : [];
      void loadCatalogPage(entry.target, course, book, page, urls, items);
    }
  }, { root: scroller, rootMargin: '500px 0px' });
  const anchors = [];
  state.pagePreviews.set(prefix, {key,observer,urls,anchors});
  if (grouped) $('type-links').replaceChildren();
  for (const {page, book, heading, section} of pages) {
    const figure = document.createElement('figure');
    figure.className = 'catalog-page';
    figure.dataset.page = page;
    figure.dataset.book = book;
    figure.dataset.section = section;
    const caption = document.createElement('figcaption');
    caption.textContent = page + '쪽';
    const placeholder = document.createElement('p');
    placeholder.className = 'page-placeholder muted';
    placeholder.textContent = '불러오는 중…';
    if (heading) {
      const name = element('h4',heading,'type-heading');
      const button = element('button',heading);
      button.type = 'button';
      figure.id = 'catalog-type-' + anchors.length;
      button.setAttribute('aria-controls',figure.id);
      button.addEventListener('click', () => {
        scroller.scrollTop = figure.offsetTop;
        markCatalogType();
      });
      anchors.push({name:heading,button,figure});
      $('type-links').append(button);
      figure.append(name);
    }
    figure.append(caption, placeholder);
    scroller.append(figure);
    if (book) observer.observe(figure);
    else placeholder.textContent = '이 쪽의 미리보기를 열 수 없습니다.';
  }
  scroller.scrollTop = 0;
}

async function loadCatalogPage(figure, course, book, page, urls, questions) {
  const placeholder = figure.querySelector('.page-placeholder');
  try {
    const file = await (await request(previewPath(course, book, page))).blob();
    if (!figure.isConnected) return;
    if (file.type !== 'image/webp') throw Error('Wrong image type');
    const url = URL.createObjectURL(file);
    urls.push(url);
    const image = new Image();
    image.alt = page + '쪽 교재 원본';
    image.src = url;
    placeholder.replaceWith(questions.length ? addQuestionRegions(image, questions) : image);
  } catch {
    placeholder.textContent = '이 쪽의 미리보기를 열 수 없습니다.';
  }
}

function assetKey(course, book, page) {
  return encodeURIComponent(course) + '/' + encodeURIComponent(book) + '/page-' + String(page).padStart(3, '0') + '.webp';
}

function previewPath(course, book, page) {
  return '/storage/v1/object/authenticated/math-teaching-materials/' + assetKey(course, book, page);
}

function confirmQuizChange() {
  return !state.quizDirty || window.confirm('저장하지 않은 퀴즈가 있습니다. 이동할까요?');
}

function protectUnsaved(select, callback) {
  let prior = select.value;
  select.addEventListener('focus', () => { prior = select.value; });
  select.addEventListener('change', () => {
    if (!confirmQuizChange()) {
      select.value = prior;
      return;
    }
    prior = select.value;
    callback();
  });
}

const teacherSymbols = mountMathSymbols($('symbol-panel'), formulaInputs.map($));
for (const id of formulaInputs) {
  $(id).addEventListener('input', () => {
    state.quizDirty = true;
    quizFeedback('저장되지 않은 변경 사항');
    updateQuizPreview();
    renderSubmission();
  });
}
for (const id of ['quiz-kind', 'quiz-choice-answer']) {
  $(id).addEventListener('change', () => {
    state.quizDirty = true;
    quizFeedback('저장되지 않은 변경 사항');
    updateQuizPreview();
    renderSubmission();
  });
}
for (const button of document.querySelectorAll('[data-stage]')) {
  button.addEventListener('click', () => showStage(button.dataset.stage));
}
$('book').addEventListener('change', () => setUnit(currentLesson().unit, currentLesson().section));
$('unit').addEventListener('change', () => setSection(currentLesson().section));
$('preview-scroll').addEventListener('scroll', markCatalogType, {passive:true});
$('stage-book').addEventListener('change', () => setStageUnit(currentLesson().unit));
$('stage-unit').addEventListener('change', () => setStageSection());
$('stage-section').addEventListener('change', () => {
  renderStagePicks();
  renderStagePreview();
});
$('teacher-section').addEventListener('submit', saveQuiz);
$('quiz-clear').addEventListener('click', clearQuiz);
$('submit').addEventListener('click', submit);
$('lesson-ppt').addEventListener('click',downloadLessonPpt);
$('quiz-excel').addEventListener('click', () => downloadQuizExcel({course:currentCourse(),lesson:currentLesson(),submission:state.submitted},$('quiz-excel'),$('submit-feedback')));
$('progress-week').addEventListener('change', () => {
  staffProgress.week=Number($('progress-week').value);
  $('transfer-feedback').textContent='';
  renderStaffProgress();
});
for (const channel of ['', 'sheet', 'slides']) {
  $(channel ? 'select-week-'+channel : 'select-week').addEventListener('click', () => {
    const cells = channel ? 'td[data-channel="'+channels[channel]+'"] ' : '';
    const boxes = [...$('progress-tracks').querySelectorAll(cells+'input[type=checkbox]:enabled')];
    const select = boxes.some(box => !box.checked);
    for (const box of boxes) if (box.checked !== select) box.click();
  });
}
$('progress-transfer').addEventListener('click', () => openTransfers(staffProgress.courses, staffProgress.week));
$('destination-course').addEventListener('change',showDestination);
$('all-progress').addEventListener('toggle', () => {
  if (!state.staff && state.stage === 'delivery' && $('all-progress').open) void loadProgress();
});
$('transfer-cancel').addEventListener('click', () => $('transfer-dialog').close());
$('transfer-dialog').addEventListener('cancel', event => { if (transferContext?.busy || transferContext?.pending || transferContext?.saving) event.preventDefault(); });
$('transfer-dialog').addEventListener('close', () => { transferContext=null; if (state.stage==='delivery') void loadProgress(); });
$('transfer-run').addEventListener('click', runTransfers);
$('save-destinations').addEventListener('click', saveDestinations);
for (const input of $('transfer-urls').querySelectorAll('input')) input.addEventListener('input', () => { const key=input.id==='destination-sheet'?'sheet':'slides';
  const target=transferContext?.destinations.get($('destination-course').value);
  if (target) target[key]=input.value;
  const button=document.querySelector('[data-copy="'+key+'"]'); button.disabled=!input.value.trim(); });
for (const button of document.querySelectorAll('[data-copy]')) button.addEventListener('click', async () => {
  const field=$('destination-'+button.dataset.copy);
  try { await navigator.clipboard.writeText(field.value); $('transfer-config-status').textContent='주소를 복사했습니다.'; }
  catch { field.focus(); field.select(); $('transfer-config-status').textContent='주소를 선택했습니다. 복사 단축키를 눌러 주세요.'; }
});
$('retry').addEventListener('click', loadSite);
protectUnsaved($('course'), () => {
  const courses = state.courses.filter(course => course?.instructor === $('course').value);
  const course = courses.find(item => item.track === currentCourse()?.track) ?? courses[0];
  state.view = {course:course.id, lesson:currentLesson()?.lesson, stage:state.stage};
  selectCourse(course);
  void loadCourse();
});
for (const button of document.querySelectorAll('[data-track]')) {
  button.addEventListener('click', () => {
    const current = currentCourse();
    const course = state.courses.find(item => item.instructor === current.instructor && item.track === button.dataset.track);
    if (course && course.id !== current.id) {
      if (!confirmQuizChange()) return;
      state.view = { course: course.id, lesson: currentLesson()?.lesson, stage: state.stage };
      selectCourse(course);
      void loadCourse();
    }
  });
}
protectUnsaved($('lesson'), () => loadLesson(state.stage));
window.addEventListener('storage', event => {
  if (event.key && event.key !== tokenKey && event.key !== accountKey) return;
  const token = localStorage.getItem(tokenKey);
  const account = localStorage.getItem(accountKey);
  if (token && state.token && account === state.account) state.token = token;
  else if (token !== state.token || account !== state.account) void loadSite();
});

const usageDialog = $('usage-dialog');
let usageView;
function selectGuideTopic(topic) {
  const root=$('usage-content').shadowRoot;
  if (!root) return;
  for (const section of root.querySelectorAll('.part')) section.hidden=section.id!==topic;
  for (const button of usageDialog.querySelectorAll('[data-guide-topic]')) button.setAttribute('aria-pressed', String(button.dataset.guideTopic===topic));
  usageDialog.scrollTop=0;
}
for (const button of usageDialog.querySelectorAll('[data-guide-topic]')) button.addEventListener('click',()=>selectGuideTopic(button.dataset.guideTopic));
async function openUsageGuide() {
  if (usageDialog.open) return;
  usageDialog.showModal();
  usageDialog.scrollTop = 0;
  const initial = state.stage?.startsWith('quiz') ? 'submit'
    : state.staff ? 'choose' : state.stage === 'delivery' ? 'submit' : 'select';
  const status = $('usage-error');
  const topics = usageDialog.querySelector('.usage-topics');
  topics.inert = true;
  status.textContent = '사용 방법을 불러오는 중입니다.';
  status.hidden = false;
  try {
    usageView ??= import('./usage-guide.mjs?v=15').then(module => module.mountUsageGuide($('usage-content')));
    const show = await usageView;
    if (usageDialog.open) {selectGuideTopic('workflow');await show(initial);}
    status.hidden = true;
  } catch {
    usageView = null;
    $('usage-content').replaceWith($('usage-content').cloneNode(false));
    status.textContent = '사용 방법을 불러오지 못했습니다. 창을 닫고 다시 열어 주세요.';
  } finally {
    topics.inert = false;
  }
}
$('usage-open').addEventListener('click', openUsageGuide);
$('usage-close').addEventListener('click', () => usageDialog.close());
usageDialog.addEventListener('close', () => $('usage-open').focus({preventScroll:true}));
if (location.hash === '#usage') void openUsageGuide();

void loadSite();
