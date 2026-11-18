import { syncSubmissionToSheet, sheetDestination } from './sheet-sync.mjs?v=7';
import { buildPresentation } from './presentation.mjs?v=8';
import { prepareGoogleDrive, connectStaffDrive, listDriveFolders, listSharedDrives, saveSlidesToStaffDrive } from './google-drive.mjs?v=7';
import { supabaseUrl, publishableKey } from './public-config.mjs';
import { hasIncompleteMath, mountMathSymbols } from './math-symbols.mjs?v=3';

const $ = id => document.getElementById(id);
const tokenKey = 'socra_admin_token';
const accountKey = 'socra_user_id';
const dateLabel = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'UTC' });
const quizSeconds = [30, 30, 60, 60, 120];
const choiceInputs = ['quiz-choice-1', 'quiz-choice-2', 'quiz-choice-3', 'quiz-choice-4'];
const formulaInputs = ['quiz-prompt', 'quiz-answer', ...choiceInputs];
const stages = {
  catalog: 'catalog', 'quiz-one': 'quiz-panel', 'quiz-two': 'quiz-panel',
  'quiz-practice': 'quiz-panel', delivery: 'delivery-panel', progress: 'progress-panel',
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
const tracks = { concept: '개념 · 개념원리', application: '응용 · RPM' };
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
const driveHome = { id:'root', name:'내 드라이브', canAddChildren:true };
let driveConnection;
let drivePath = [];
let driveRequest = 0;

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
      '퀴즈앤 5지선다 문항을 4지선다로 수정해 주세요.'];
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
  $('progress-button').hidden = true;
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

function showStage(stage, restore = false) {
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
  closeStageChoice();
  state.stage = Object.hasOwn(stages, stage) ? stage : 'catalog';
  for (const button of document.querySelectorAll('[data-stage]')) {
    const selected = button.dataset.stage === state.stage;
    button.setAttribute('aria-pressed', String(selected));
  }
  for (const panel of stagePanels) $(panel).hidden = panel !== stages[state.stage];
  const mode = activeQuizMode();
  if (mode) renderQuizStage(mode);
  if (!restore && window.scrollY > $('lesson-tools').offsetTop) window.scrollTo(0, $('lesson-tools').offsetTop);
  rememberView();
  renderSubmission();
  if (state.stage === 'progress') void loadProgress();
  return true;
}

function progressRows(name, filter, select) {
  return table(name, { course_id: filter, select });
}

async function loadProgress() {
  const version = state.courseVersion;
  const instructor = currentCourse()?.instructor;
  const courses = state.courses.filter(course => course.instructor === instructor);
  const filter = 'in.(' + courses.map(course => course.id).join(',') + ')';
  const status = $('progress-status');
  const grid = $('progress-tracks');
  $('progress-heading').textContent = instructor + ' · 작업현황';
  status.textContent = '회차별 작업현황을 불러오는 중입니다.';
  grid.replaceChildren();
  try {
    const [lessons, picks, quizzes, extras, submissions] = await Promise.all([
      progressRows('math_lessons', filter, 'course_id,lesson,live_date,topic,quiz_mode'),
      progressRows('math_selections', filter, 'course_id,lesson,slot'),
      progressRows('math_teacher_quizzes', filter, 'course_id,lesson,slot'),
      progressRows(resourceSelections, filter, 'course_id,lesson,slot,stage_mode'),
      progressRows('math_submissions', filter, 'course_id,lesson,sync_status,submitted_at'),
    ]);
    if (version !== state.courseVersion || state.stage !== 'progress') return;
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
        const courseSubmissions = submissions.filter(item => item.course_id === course.id);
        const summary = document.createElement('p');
        summary.className = 'muted';
        summary.textContent = '제출 ' + new Set(courseSubmissions.map(item => item.lesson)).size + ' / ' + courseLessons.length;
        heading.append(summary);
        const progress = document.createElement('table');
        progress.setAttribute('aria-label', label + ' 회차별 작업현황');
        const head = progress.createTHead().insertRow();
        const quizHeaders = courseModes.map(mode => quizModes[mode].number ? '퀴즈앤 ' + quizModes[mode].number : '문제 출제');
        for (const text of ['회차', '수업 문항', ...quizHeaders, '상태']) {
          const header = document.createElement('th');
          header.scope = 'col';
          header.textContent = text;
          head.append(header);
        }
        const body = progress.createTBody();
        for (const lesson of courseLessons) {
          const matches = item => item.course_id === course.id && item.lesson === lesson.lesson;
          const submitted = courseSubmissions.filter(matches).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0];
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
          row.insertCell().textContent = picks.filter(matches).length + ' / ' + course.lesson_slots;
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
          status.className = 'progress-status';
          status.dataset.state = submitted ? 'done' : 'pending';
          status.textContent = submitted?.sync_status === 'synced' ? '시트 반영' : submitted ? '제출됨' : '미제출';
        }
        group.append(progress);
      }
      grid.append(group);
    }
    status.textContent = '';
  } catch (error) {
    if (version === state.courseVersion) failure(error, 'progress-status');
  }
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
  $('pick-progress').textContent = state.picks.size + ' / ' + lessonSlots();
  for (const stage of quizStages) {
    const mode = lessonModes().find(mode => quizModes[mode].stage === stage);
    const button = document.querySelector('[data-stage="' + stage + '"]');
    button.hidden = !mode;
    button.disabled = state.busy;
    const completed = mode === 'teacher' ? state.quizzes.size : state.stagePicks.get(mode)?.size ?? 0;
    $(stage + '-progress').textContent = mode ? quizModes[mode].source + ' · ' + completed + ' / ' + quizCount(mode) : '';
  }
  $('delivery-progress').textContent = state.submitted ? (state.edited ? '수정 중' : '제출됨') : '미제출';
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
      select: 'question_id,book,unit,section,page,label,preview_top,preview_book,slide_crop,use_kind,five_choice,projection_asset',
      order: 'book,page,question_number,question_id', limit, offset,
    });
    rows.push(...next);
    if (next.length < limit) return rows;
  }
}

async function loadSite() {
  if ($('drive-dialog').open) $('drive-dialog').close();
  state.courseVersion += 1;
  state.lessonVersion += 1;
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
      table('profiles', { select: 'role', limit: 1 }),
      table('math_course_members', { select: 'course_id,team_role' }),
    ]);
    if (token !== state.token) return;
    if (!courses.length) {
      showStatus('이 계정에 배정된 수학 강의가 없습니다.');
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
  const course = currentCourse();
  const role = state.memberships.find(member => member.course_id === course.id)?.team_role;
  state.staff = state.editor || role === 'staff';
  state.composer = state.editor || role === 'teacher';
  if (state.staff) void prepareGoogleDrive().catch(() => {});
  const version = ++state.courseVersion;
  ++state.lessonVersion;
  $('lesson-tools').hidden = true;
  $('staff-panel').hidden = true;
  $('actions').hidden = true;
  $('google-help').hidden = true;
  $('topic').textContent = '';
  $('lesson').disabled = true;
  $('progress-button').disabled = true;
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

async function loadLesson() {
  const lesson = currentLesson();
  const version = ++state.lessonVersion;
  $('lesson-tools').hidden = true;
  $('staff-panel').hidden = true;
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
      table('math_submissions', { ...filter, select: 'id,submitted_at,sync_status,selections,quizzes,stage_questions', order: 'submitted_at.desc', limit: 1 }),
      resourceModes.length ? table(resourceSelections, { ...filter, select: 'stage_mode,slot,question_id,quiz_override' }) : [],
      state.staff ? table('math_course_materials', { course_id: filter.course_id, select: 'label,url', order: 'label' }) : [],
    ]);
    if (version !== state.lessonVersion) return;
    state.picks = new Map(picks.map(value => [value.slot, value.question_id]));
    state.quizzes = new Map(quizzes.map(value => [value.slot, value]));
    state.submitted = submissions[0] ?? null;
    state.stagePicks = new Map(resourceModes.map(mode => [mode, new Map()]));
    state.stageEdits = new Map(resourceModes.map(mode => [mode, new Map()]));
    state.resourceViews = new Map();
    for (const item of stagePicks) {
      state.stagePicks.get(item.stage_mode)?.set(item.slot, item.question_id);
      if (item.quiz_override) state.stageEdits.get(item.stage_mode)?.set(item.slot, item.quiz_override);
    }
    closeStageChoice();
    const savedStage = state.submitted?.stage_questions ?? [];
    renderMaterialLinks(materials);
    $('submission-panel').hidden = !state.composer;
    $('staff-panel').hidden = !state.staff;
    resetSheetResult();
    $('ppt-result').hidden = true;
    $('ppt-result').removeAttribute('href');
    state.exportReceipt = null;
    if (state.staff && state.submitted) void loadExportReceipt(version);
    const savedPicks = state.submitted?.selections ?? [];
    const savedQuizzes = state.submitted?.quizzes ?? [];
    state.edited = savedStage.length !== stagePicks.length ||
      savedStage.some(pick => {
        const mode = savedResourceMode(pick, lesson);
        const draft = state.stageEdits.get(mode)?.get(pick.slot);
        return state.stagePicks.get(mode)?.get(pick.slot) !== pick.question_id ||
          ['prompt', 'choices', 'answer'].some(key => pick.quiz_override?.[key] !== draft?.[key]);
      }) ||
      savedPicks.length !== picks.length ||
      savedPicks.some(pick => state.picks.get(pick.slot) !== pick.question_id) ||
      savedQuizzes.length !== quizzes.length || savedQuizzes.some(saved => {
        const draft = state.quizzes.get(saved.slot);
        return !draft || ['kind', 'prompt', 'answer', 'choices'].some(key => saved[key] !== draft[key]);
      });
    state.quizDirty = false;
    $('export-status').textContent = '';
    $('selection-status').textContent = '';
    $('submit-feedback').textContent = '';
    $('load-status').textContent = '';
    $('lesson-tools').hidden = false;
    $('progress-button').hidden = false;
    $('progress-button').disabled = false;
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
    options($('book'), values(books, 'book'), currentCourse().lesson_slots === 11 ? 'RPM' : undefined);
    setUnit(lesson.unit, lesson.section);
    const restored = state.view.course === currentCourse().id && state.view.lesson === lesson.lesson;
    renderQuizSlots(restored ? state.view.quizSlot : 1);
    renderQuiz();
    $('quiz-save').hidden = !state.composer;
    for (const id of [...formulaInputs, 'quiz-kind', 'quiz-choice-answer']) $(id).disabled = !state.composer;
    $('symbol-panel').hidden = !state.composer;
    showStage(restored ? state.view.stage : 'catalog', true);
    renderExport();
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
  return currentCourse()?.lesson_slots ?? 8;
}

function requiredLessonSlots() {
  return currentCourse()?.required_lesson_slots ?? 5;
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
  return state.catalog.filter(q => (q.use_kind ?? 'lesson') === 'lesson');
}

function stageCatalog() {
  const kind = resourceStages[activeQuizMode()]?.kind;
  return kind ? state.catalog.filter(q => (q.use_kind ?? 'lesson') === kind) : [];
}

function setUnit(unit, section) {
  const bookRows = lessonCatalog().filter(question => question.book === $('book').value);
  options($('unit'), values(bookRows, 'unit'), unit);
  setSection(section);
}

function setSection(section) {
  const rows = lessonCatalog().filter(question => question.book === $('book').value && question.unit === $('unit').value);
  options($('section'), values(rows, 'section'), section);
  renderPicks();
  renderCatalogPreview();
}

function pickControls(total, selectedIds, questions, slotLabel, save) {
  const slots = [];
  for (let slot = 1; slot <= total; slot += 1) {
    const label = document.createElement('label');
    label.textContent = slotLabel(slot);
    const select = document.createElement('select');
    const selected = state.catalog.find(question => question.question_id === selectedIds.get(slot));
    label.dataset.filled = String(Boolean(selected));
    const choices = [['', selected ? '문항 비우기' : '문항 선택'], ...questions.map(question => [question.question_id, question.label])];
    if (selected && !questions.includes(selected)) choices.splice(1, 0, [selected.question_id, selected.label + ' · 저장됨']);
    options(select, choices, selected?.question_id);
    select.disabled = !state.composer;
    select.addEventListener('change', () => save(slot, select.value, select));
    label.append(select);
    slots.push(label);
  }
  return slots;
}

function renderPicks() {
  const current = lessonCatalog().filter(question => question.book === $('book').value &&
    question.unit === $('unit').value && question.section === $('section').value);
  $('question-count').textContent = state.picks.size + ' / ' + lessonSlots() + '개 선정';
  const labels = slot => (slot <= requiredLessonSlots() ? '기본 ' : '예비 ') + slot + '번';
  const controls = pickControls(lessonSlots(), state.picks, current, labels, savePick);
  controls.slice(requiredLessonSlots()).forEach(control => control.classList.add('reserve'));
  $('question-slots').replaceChildren(...controls);
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
    if (!state.composer || !question || !usesQuizAndResources()) return control;
    const edited = state.stageEdits.get(mode).has(slot);
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.required = String(question.five_choice && !edited);
    button.textContent = edited ? '4지선다 저장됨 · 편집'
      : question.five_choice ? '5지선다 → 4지선다 편집' : '4지선다로 편집';
    button.addEventListener('click', () => openStageChoice(slot, question));
    const container = document.createElement('div');
    container.className = 'stage-pick';
    container.append(control, button);
    return container;
  }));
}

const stageChoiceIds = ['stage-choice-1', 'stage-choice-2', 'stage-choice-3', 'stage-choice-4'];

function usesQuizAndResources(mode = activeQuizMode()) {
  return ['appendix', 'rpm_final', 'rpm_pro'].includes(mode);
}

function selectedStagePick(slot, mode = activeQuizMode()) {
  return state.catalog.find(question => question.question_id === state.stagePicks.get(mode)?.get(slot));
}

function closeStageChoice() {
  $('stage-choice-form').hidden = true;
  state.stageEditSlot = null;
  state.stageDirty = false;
}

function openStageChoice(slot, question) {
  if (state.busy || (state.stageEditSlot !== slot && !confirmQuizChange())) return;
  if (state.stageEditSlot === slot) return;
  state.stageEditSlot = slot;
  state.stageDirty = false;
  const saved = state.stageEdits.get(activeQuizMode()).get(slot);
  $('stage-choice-title').textContent = question.book + ' ' + question.label + ' · 4지선다';
  $('stage-choice-prompt').value = saved?.prompt ?? '';
  $('stage-choice-answer').value = saved?.answer ?? '';
  const choices = saved?.choices.split('\n') ?? [];
  stageChoiceIds.forEach((id, i) => { $(id).value = choices[i] ?? ''; });
  $('stage-choice-form').hidden = false;
  stageSymbols.reset();
  $('stage-choice-prompt').focus();
}

async function saveStageChoice(event) {
  event.preventDefault();
  const slot = state.stageEditSlot;
  const mode = activeQuizMode();
  if (!slot || !state.composer || !usesQuizAndResources(mode)) return;
  const prompt = $('stage-choice-prompt').value.trim();
  const choices = stageChoiceIds.map(id => $(id).value.trim());
  const answer = $('stage-choice-answer').value;
  const incomplete = ['stage-choice-prompt', ...stageChoiceIds].find(id => hasIncompleteMath($(id).value));
  if (incomplete) {
    $('stage-status').textContent = '분수와 지수의 빈칸을 채워 주세요.';
    $(incomplete).focus();
    return;
  }
  if (!prompt || choices.some(choice => !choice) || !/^[1-4]$/.test(answer)) {
    $('stage-status').textContent = '문제와 보기 4개, 정답을 모두 입력해 주세요.';
    return;
  }
  await withSaving(async () => {
    const filter = { ...context(), stage_mode: 'eq.' + mode, slot: 'eq.' + slot,
      question_id: 'eq.' + state.stagePicks.get(mode).get(slot), select: 'quiz_override' };
    const [saved] = await table(resourceSelections, filter, 'PATCH', {
      quiz_override: { prompt, choices: choices.join('\n'), answer },
    });
    if (!saved?.quiz_override) throw Error('편집한 문항을 저장하지 못했습니다.');
    state.stageEdits.get(mode).set(slot, saved.quiz_override);
    state.edited = true;
    closeStageChoice();
    renderStagePicks();
    $('stage-status').textContent = slot + '번 퀴즈앤 문항을 4지선다로 저장했습니다.';
  }, 'stage-status');
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
      renderExport();
    }
  }
}

async function savePick(slot, value, select, mode) {
  const picks = mode ? state.stagePicks.get(mode) : state.picks;
  const name = mode ? resourceSelections : 'math_selections';
  const status = mode ? 'stage-status' : 'selection-status';
  const previous = picks.get(slot);
  const question = state.catalog.find(item => item.question_id === Number(value));
  if (!question && !previous) return;
  if (mode && state.stageEditSlot === slot && !confirmQuizChange()) {
    select.value = previous ?? '';
    return;
  }
  $(status).textContent = '';
  await withSaving(async () => {
    const filter = { ...context(), slot: 'eq.' + slot, select: 'slot,question_id' };
    if (mode) filter.stage_mode = 'eq.' + mode;
    if (previous) filter.question_id = 'eq.' + previous;
    const result = !question
      ? await table(name, filter, 'DELETE')
      : previous
        ? await table(name, filter, 'PATCH', { question_id: question.question_id })
        : await table(name, { select: 'slot,question_id' }, 'POST', {
          course_id: currentCourse().id, lesson: currentLesson().lesson, slot, question_id: question.question_id,
          ...(mode ? { stage_mode: mode } : {}),
        });
    if (!result.length) throw new ApiError(403, '이 문항을 변경할 권한이 없거나 이미 변경됐습니다.');
    if (question) {
      picks.set(slot, question.question_id);
    } else {
      picks.delete(slot);
    }
    state.edited = true;
    if (mode) {
      if (question?.question_id !== previous) state.stageEdits.get(mode).delete(slot);
      if (state.stageEditSlot === slot) closeStageChoice();
      renderStagePicks();
    } else renderPicks();
    $(status).textContent = question ? slot + '번 자리에 ' + question.label + '을 저장했습니다.'
      : slot + '번 문항을 비웠습니다.';
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
  const prompt = $('quiz-prompt').value.trim();
  let answer = $(kind === 'choice' ? 'quiz-choice-answer' : 'quiz-answer').value.trim();
  const choices = kind === 'choice' ? choiceInputs.map(id => $(id).value.trim()) : [];
  if (kind === 'ox') answer = answer.toUpperCase();
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

function renderSubmission() {
  updateStageProgress();
  const totalBasics = requiredLessonSlots();
  const selectedBasics = [...state.picks.keys()].filter(slot => slot <= totalBasics).length;
  const basic = selectedBasics === totalBasics;
  const groups = lessonModes().map(mode => {
    const picks = state.stagePicks.get(mode);
    const count = mode === 'teacher' ? state.quizzes.size : picks?.size ?? 0;
    const total = quizCount(mode);
    const conversion = usesQuizAndResources(mode) && [...(picks?.keys() ?? [])].some(slot =>
      selectedStagePick(slot, mode)?.five_choice && !state.stageEdits.get(mode).has(slot));
    const unsaved = mode === 'teacher' ? state.quizDirty : mode === activeQuizMode() && state.stageDirty;
    const ready = count === total && !conversion && !unsaved;
    const detail = unsaved ? '저장 필요' : conversion ? '4지선다 편집 필요' : ready ? '완료' : '작성 필요';
    return { stage:quizModes[mode].stage, title:stageTitle(mode), count, total, conversion, unsaved, ready, detail };
  });
  const missing = groups.find(group => !group.ready);
  const ready = basic && !missing;
  renderSubmissionChecklist([
    { stage:'catalog', title:'기본 수업 문항', count:selectedBasics, total:totalBasics,
      detail:basic ? '완료' : '선정 필요', ready:basic },
    ...groups,
  ]);
  $('submit').disabled = state.busy || !ready || Boolean(state.submitted && !state.edited);
  $('submit').textContent = state.submitted ? '수정본 제출' : '회차 제출';
  if (!ready) {
    $('submit-status').textContent = !basic ? '기본 문항 ' + requiredLessonSlots() + '개를 먼저 골라 주세요.'
      : missing.unsaved ? '입력한 퀴즈를 저장해 주세요.'
        : missing.conversion ? missing.title + '의 5지선다 문항을 4지선다로 편집해 주세요.'
        : missing.title + ' 문항을 모두 채워 주세요.';
  } else if (state.submitted && !state.edited) {
    const submitted = new Date(state.submitted.submitted_at).toLocaleString('ko-KR');
    $('submit-status').textContent = '제출 완료 · ' + submitted + (state.submitted.sync_status === 'synced' ? ' · Google 반영 완료' : ' · Google 연결 대기');
  } else {
    $('submit-status').textContent = '제출하면 현재 문항이 제출본으로 저장됩니다.';
  }
}

async function submit() {
  if ($('submit').disabled) return;
  $('submit-feedback').textContent = '';
  await withSaving(async () => {
    const rows = await table('math_submissions', { select: 'id,submitted_at,sync_status,selections,quizzes,stage_questions' }, 'POST', {
      course_id: currentCourse().id, lesson: currentLesson().lesson,
    });
    if (!rows[0]) throw new ApiError(403, '이 회차를 제출할 권한이 없습니다.');
    state.submitted = rows[0];
    state.edited = false;
    state.exportReceipt = null;
    $('ppt-result').hidden = true;
    $('ppt-result').removeAttribute('href');
    $('export-status').textContent = '';
    resetSheetResult();
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

function exportBlocker() {
  if (!state.submitted) return '회차를 제출하면 시트 반영과 프레젠테이션 저장을 할 수 있습니다.';
  const missing = lessonModes().find(mode => (
    mode === 'teacher' ? state.submitted.quizzes?.length ?? 0
      : (state.submitted.stage_questions ?? []).filter(item => savedResourceMode(item) === mode).length
  ) !== quizCount(mode));
  if (missing) return stageTitle(missing) + ' 문항을 채우고 다시 제출해 주세요.';
  return '';
}

function renderExport() {
  if (!state.staff) return;
  const blocker = exportBlocker();
  for (const id of ['ppt-drive', 'sheet-sync']) $(id).disabled = state.busy || Boolean(blocker);
  $('sheet-sync').disabled ||= !currentLesson()?.curriculum_url;
  if (blocker) $('export-status').textContent = blocker;
  else if (!$('export-status').textContent || $('export-status').dataset.lesson !== $('lesson').value) {
    $('export-status').textContent = '회사 Google 계정에서 저장할 폴더를 선택할 수 있습니다.';
  }
  $('export-status').dataset.lesson = $('lesson').value;
}

function openDriveDialog() {
  if (!state.staff || state.busy || exportBlocker()) return;
  $('drive-browser').hidden = true;
  $('drive-connect').hidden = false;
  $('drive-connect').disabled = false;
  $('drive-save').disabled = true;
  $('drive-account').textContent = '';
  $('drive-status').textContent = '회사 Google 계정을 연결해 주세요.';
  $('drive-dialog').showModal();
}

async function connectDriveDialog() {
  const requestId = ++driveRequest;
  $('drive-connect').disabled = true;
  $('drive-status').textContent = '회사 Google 계정을 확인하는 중입니다.';
  try {
    const connection = await connectStaffDrive();
    if (requestId !== driveRequest || !$('drive-dialog').open) return;
    driveConnection = connection;
    $('drive-connect').hidden = true;
    $('drive-browser').hidden = false;
    $('drive-account').textContent = connection.email;
    await browseDrive([driveHome], false);
  } catch (error) {
    if (requestId === driveRequest && $('drive-dialog').open) failure(error, 'drive-status');
  } finally {
    $('drive-connect').disabled = false;
  }
}

function renderDrivePath(path, shared) {
  const nav = $('drive-path');
  nav.replaceChildren();
  if (shared) {
    const root = document.createElement(path.length ? 'button' : 'span');
    root.textContent = '공유 드라이브';
    if (path.length) {
      root.type = 'button';
      root.addEventListener('click', () => browseDrive([], true));
    }
    nav.append(root);
  }
  path.forEach((folder, index) => {
    if (index || shared) {
      const divider = document.createElement('span');
      divider.textContent = '›';
      divider.setAttribute('aria-hidden', 'true');
      nav.append(divider);
    }
    const current = index === path.length - 1;
    const crumb = document.createElement(current ? 'span' : 'button');
    crumb.textContent = folder.name;
    if (current) crumb.setAttribute('aria-current', 'location');
    else {
      crumb.type = 'button';
      crumb.addEventListener('click', () => browseDrive(path.slice(0, index + 1), shared));
    }
    nav.append(crumb);
  });
}

async function browseDrive(path, shared) {
  if (state.busy || !driveConnection) return;
  const requestId = ++driveRequest;
  const folder = path.at(-1);
  const list = $('drive-folders');
  drivePath = path;
  $('drive-my-root').setAttribute('aria-pressed', String(!shared));
  $('drive-shared-root').setAttribute('aria-pressed', String(shared));
  renderDrivePath(path, shared);
  list.replaceChildren();
  $('drive-save').disabled = true;
  $('drive-status').textContent = '폴더를 불러오는 중입니다.';
  try {
    const folders = folder ? await listDriveFolders(driveConnection, folder) : await listSharedDrives(driveConnection);
    if (requestId !== driveRequest || !$('drive-dialog').open) return;
    for (const child of folders) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const name = document.createElement('span');
      const arrow = document.createElement('span');
      button.type = 'button';
      name.textContent = child.name;
      arrow.textContent = '›';
      arrow.setAttribute('aria-hidden', 'true');
      button.append(name, arrow);
      button.addEventListener('click', () => browseDrive([...path, child], shared));
      item.append(button);
      list.append(item);
    }
    $('drive-save').disabled = !folder?.canAddChildren;
    $('drive-status').textContent = folder?.canAddChildren
      ? (folders.length ? '' : '하위 폴더가 없습니다. 현재 폴더에 저장할 수 있습니다.')
      : folder ? '이 폴더에는 저장 권한이 없습니다.' : (folders.length ? '공유 드라이브를 선택하세요.' : '접근 가능한 공유 드라이브가 없습니다.');
  } catch (error) {
    if (requestId === driveRequest && $('drive-dialog').open) failure(error, 'drive-status');
  }
}

async function preparePresentation() {
  if (!state.staff || state.busy || exportBlocker() || !driveConnection) return;
  const folder = drivePath.at(-1);
  if (!folder?.canAddChildren || $('drive-save').disabled) return;
  const connection = driveConnection;
  const folderName = drivePath.map(item => item.name).join(' › ');
  const active = [...$('drive-dialog').querySelectorAll('button:not(:disabled)')];
  active.forEach(button => { button.disabled = true; });
  let stored = false;
  await withSaving(async () => {
    const course = currentCourse();
    const submission = state.submitted;
    const withAsset = pick => {
      const question = state.catalog.find(item => item.question_id === pick.question_id);
      if (!question) throw Error('제출된 문항을 교재 목록에서 찾을 수 없습니다.');
      return { ...question, slot: pick.slot, quiz_override: pick.quiz_override };
    };
    const slotList = submission.selections.map(withAsset);
    const stageList = (submission.stage_questions ?? []).map(pick => {
      const mode = savedResourceMode(pick);
      return { ...withAsset(pick), stageLabel: stageTitle(mode), quizOne: quizModes[mode].number === '①' };
    });
    const title = course.instructor + ' · ' + tracks[course.track] + ' · ' + currentLesson().lesson +
      '강 · ' + currentLesson().topic.replace(/^\([^)]*\)\s*/, '') + ' · 빔용';
    $('drive-status').textContent = '문항을 한 장씩 발표자료에 넣는 중입니다.';
    const blob = await buildPresentation({
      title, picks: slotList, quizzes: submission.quizzes, appendix: stageList,
      quizLabel: stageTitle('teacher'),
    }, async question => {
      const path = question.projection_asset
        ? '/storage/v1/object/authenticated/math-teaching-materials/' + encodeURIComponent(course.id) + '/' + question.projection_asset
        : previewPath(course.preview_course_id ?? course.id, question.preview_book, question.page);
      return (await request(path)).blob();
    });
    const driveUrl = resultLink(await saveSlidesToStaffDrive(connection, blob, title, submission.id, folder));
    const [prior] = await table('math_staff_exports', receiptFilter());
    if (!prior) {
      await table('math_staff_exports', { select: 'drive_url' }, 'POST', {
        course_id: course.id, submission_id: submission.id, drive_url: driveUrl,
      });
    } else if (prior.drive_url !== driveUrl) {
      await table('math_staff_exports', receiptFilter(), 'PATCH', { drive_url: driveUrl });
    }
    state.exportReceipt = driveUrl;
    $('export-status').textContent = folderName + '에 저장했습니다.';
    stored = true;
  }, 'drive-status');
  active.forEach(button => { button.disabled = false; });
  if (stored) $('drive-dialog').close();
}

function resetSheetResult() {
  $('sheet-status').textContent = '';
  $('sheet-result').hidden = true;
  $('sheet-result').removeAttribute('href');
}

async function reflectSheet() {
  if (!state.staff || state.busy || exportBlocker()) return;
  $('sheet-result').hidden = true;
  $('sheet-result').removeAttribute('href');
  await withSaving(async () => {
    const lesson = currentLesson();
    const destination = sheetDestination(currentCourse(), lesson.curriculum_url);
    const submission = state.submitted;
    $('sheet-status').textContent = 'Google 계정 권한과 커리큘럼 양식을 확인하고 있습니다.';
    const result = await syncSubmissionToSheet(destination, lesson, submission);
    if (!result) {
      $('sheet-status').textContent = 'Google 시트 반영을 취소했습니다.';
      return;
    }
    $('sheet-result').href = result.url;
    $('sheet-result').hidden = false;
    const status = await table('math_submissions', {
      id: 'eq.' + submission.id, select: 'id,sync_status',
    }, 'PATCH', { sync_status: 'synced' });
    if (status[0]?.sync_status === 'synced') submission.sync_status = 'synced';
    $('sheet-status').textContent = result.written
      ? 'Google 시트 ' + result.row + '행에 ' + result.written + '칸을 반영했습니다.'
      : '이미 같은 내용이 반영되어 있습니다.';
  }, 'sheet-status');
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

function renderCatalogPreview() {
  const [book,unit,section] = [$('book').value, $('unit').value, $('section').value];
  const questions = lessonCatalog().filter(q => q.book === book && q.unit === unit && q.section === section);
  renderPageStack('preview', book, section, questions);
}

function renderPageStack(prefix, bookName, title, questions) {
  const byPage = new Map(questions.filter(q => q.preview_book).map(q => [q.page, q.preview_book]));
  const pages = [...byPage].sort(([a], [b]) => a - b);
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
      void loadCatalogPage(entry.target, course, book, page, urls);
    }
  }, { root: scroller, rootMargin: '500px 0px' });
  state.pagePreviews.set(prefix, { key, observer, urls });
  for (const [page, book] of pages) {
    const figure = document.createElement('figure');
    figure.className = 'catalog-page';
    figure.dataset.page = page;
    figure.dataset.book = book;
    const caption = document.createElement('figcaption');
    caption.textContent = page + '쪽';
    const placeholder = document.createElement('p');
    placeholder.className = 'page-placeholder muted';
    placeholder.textContent = '불러오는 중…';
    figure.append(caption, placeholder);
    scroller.append(figure);
    observer.observe(figure);
  }
  scroller.scrollTop = 0;
}

async function loadCatalogPage(figure, course, book, page, urls) {
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
    placeholder.replaceWith(image);
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
  return !(state.quizDirty || state.stageDirty) || window.confirm('저장하지 않은 퀴즈가 있습니다. 이동할까요?');
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
const stageSymbols = mountMathSymbols($('stage-symbols'), ['stage-choice-prompt', ...stageChoiceIds].map($));
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
$('section').addEventListener('change', () => {
  renderPicks();
  renderCatalogPreview();
});
$('stage-book').addEventListener('change', () => setStageUnit(currentLesson().unit));
$('stage-unit').addEventListener('change', () => setStageSection());
$('stage-section').addEventListener('change', () => {
  renderStagePicks();
  renderStagePreview();
});
$('teacher-section').addEventListener('submit', saveQuiz);
$('quiz-clear').addEventListener('click', clearQuiz);
$('stage-choice-form').addEventListener('submit', saveStageChoice);
$('stage-choice-form').addEventListener('input', () => { state.stageDirty = true; renderSubmission(); });
$('stage-choice-close').addEventListener('click', () => {
  if (confirmQuizChange()) { closeStageChoice(); renderSubmission(); }
});
$('submit').addEventListener('click', submit);
$('sheet-sync').addEventListener('click', reflectSheet);
$('ppt-drive').addEventListener('click', openDriveDialog);
$('drive-connect').addEventListener('click', connectDriveDialog);
$('drive-my-root').addEventListener('click', () => browseDrive([driveHome], false));
$('drive-shared-root').addEventListener('click', () => browseDrive([], true));
$('drive-save').addEventListener('click', preparePresentation);
$('drive-close').addEventListener('click', () => $('drive-dialog').close());
$('drive-dialog').addEventListener('cancel', event => { if (state.busy) event.preventDefault(); });
$('drive-dialog').addEventListener('close', () => {
  driveRequest += 1;
  driveConnection = null;
  drivePath = [];
});
$('retry').addEventListener('click', loadSite);
protectUnsaved($('course'), () => {
  const courses = state.courses.filter(course => course.instructor === $('course').value);
  const course = courses.find(item => item.track === currentCourse()?.track) ?? courses[0];
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
protectUnsaved($('lesson'), loadLesson);
window.addEventListener('storage', event => {
  if (event.key && event.key !== tokenKey && event.key !== accountKey) return;
  const token = localStorage.getItem(tokenKey);
  const account = localStorage.getItem(accountKey);
  if (token && state.token && account === state.account) state.token = token;
  else if (token !== state.token || account !== state.account) void loadSite();
});
void loadSite();
