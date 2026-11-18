import { syncSubmissionToSheet, sheetDestination } from './sheet-sync.mjs';
import { buildPresentation } from './presentation.mjs?v=4';
import { prepareGoogleDrive, connectStaffDrive, saveToStaffDrive } from './google-drive.mjs?v=2';
import { supabaseUrl, publishableKey } from './public-config.mjs';

const $ = id => document.getElementById(id);
const tokenKey = 'socra_admin_token';
const accountKey = 'socra_user_id';
const dateLabel = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'UTC' });
const quizSeconds = [30, 30, 60, 60, 120];
const choiceInputs = ['quiz-choice-1', 'quiz-choice-2', 'quiz-choice-3', 'quiz-choice-4'];
const formulaInputs = ['quiz-prompt', 'quiz-answer', ...choiceInputs];
const stages = { catalog: 'catalog', quiz: 'quiz-panel', delivery: 'delivery-panel' };
const state = {
  token: null, staff: false, editor: false, composer: false, memberships: [], courses: [], lessons: [], catalog: [], picks: new Map(), stagePicks: new Map(), quizzes: new Map(),
  submitted: null, courseVersion: 0, lessonVersion: 0, pagePreviews: new Map(), busy: false,
};
let formulaTarget = $('quiz-prompt');

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
    const allowed = ['필수 수업 문항을 모두 선택해 주세요.', '교사부록 또는 실전 스테이지 문항을 모두 선택해 주세요.', '이 회차에 맞는 문항을 선택해 주세요.', '퀴즈앤 직접 출제 문항 5개를 먼저 저장해 주세요.'];
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
  const message = error instanceof ApiError || ['export-status', 'sheet-status'].includes(id)
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
  return state.courses.find(course => course.id === $('course').value);
}

function currentLesson() {
  return state.lessons.find(lesson => lesson.lesson === Number($('lesson').value));
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

function showStage(stage) {
  state.stage = Object.hasOwn(stages, stage) ? stage : 'catalog';
  for (const button of document.querySelectorAll('[data-stage]')) {
    const selected = button.dataset.stage === state.stage;
    button.setAttribute('aria-pressed', String(selected));
    $(stages[button.dataset.stage]).hidden = !selected;
  }
  rememberView();
}

function updateStageProgress() {
  $('pick-progress').textContent = state.picks.size + ' / ' + lessonSlots();
  $('quiz-progress').textContent = currentLesson()?.quiz_mode === 'teacher'
    ? state.quizzes.size + ' / 5' : state.stagePicks.size + ' / ' + stageSlots();
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
      select: 'question_id,book,unit,section,page,label,preview_top,preview_book,slide_crop,use_kind',
      order: 'book,page,question_number,question_id', limit, offset,
    });
    rows.push(...next);
    if (next.length < limit) return rows;
  }
}

async function loadSite() {
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
      table('math_courses', { select: 'id,instructor,review_url,lesson_slots,required_lesson_slots', order: 'instructor' }),
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
    options($('course'), courses.map(item => [item.id, item.instructor]), state.view.course ?? active.id);
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
    const [picks, quizzes, submissions, stagePicks, materials] = await Promise.all([
      table('math_selections', { ...filter, select: 'slot,question_id' }),
      lesson.quiz_mode === 'teacher' ? table('math_teacher_quizzes', { ...filter, select: 'slot,kind,prompt,answer,choices' }) : [],
      table('math_submissions', { ...filter, select: 'id,submitted_at,sync_status,selections,quizzes,stage_questions', order: 'submitted_at.desc', limit: 1 }),
      lesson.quiz_mode !== 'teacher' ? table('math_stage_selections', { ...filter, select: 'slot,question_id' }) : [],
      state.staff ? table('math_course_materials', { course_id: filter.course_id, select: 'label,url', order: 'label' }) : [],
    ]);
    if (version !== state.lessonVersion) return;
    state.picks = new Map(picks.map(value => [value.slot, value.question_id]));
    state.quizzes = new Map(quizzes.map(value => [value.slot, value]));
    state.submitted = submissions[0] ?? null;
    state.stagePicks = new Map(stagePicks.map(value => [value.slot, value.question_id]));
    $('sheet-status').textContent = '';
    const savedStage = state.submitted?.stage_questions ?? [];
    renderMaterialLinks(materials);
    $('submission-panel').hidden = !state.composer;
    $('staff-panel').hidden = !state.staff;
    $('ppt-result').hidden = true;
    $('ppt-result').removeAttribute('href');
    state.exportReceipt = null;
    if (state.staff && state.submitted) void loadExportReceipt(version);
    const savedPicks = state.submitted?.selections ?? [];
    const savedQuizzes = state.submitted?.quizzes ?? [];
    state.edited = savedStage.length !== stagePicks.length ||
      savedStage.some(pick => state.stagePicks.get(pick.slot) !== pick.question_id) ||
      savedPicks.length !== picks.length ||
      savedPicks.some(pick => state.picks.get(pick.slot) !== pick.question_id) ||
      savedQuizzes.length !== quizzes.length || savedQuizzes.some(saved => {
        const draft = state.quizzes.get(saved.slot);
        return !draft || ['kind', 'prompt', 'answer', 'choices'].some(key => saved[key] !== draft[key]);
      });
    state.quizDirty = false;
    $('export-status').textContent = '';
    $('load-status').textContent = '';
    $('lesson-tools').hidden = false;
    const books = lessonCatalog();
    $('catalog-empty').hidden = Boolean(books.length);
    $('catalog-fields').hidden = !books.length;
    $('catalog-picks').hidden = !books.length;
    const teacherQuiz = lesson.quiz_mode === 'teacher';
    $('teacher-section').hidden = !teacherQuiz;
    $('resource-stage').hidden = teacherQuiz;
    $('quiz-stage-label').textContent = lesson.quiz_mode === 'practice' ? '실전 스테이지'
      : lesson.quiz_mode === 'appendix' ? '교사부록' : '퀴즈앤';
    $('quiz-heading').textContent = stageTitle(lesson.quiz_mode);
    $('stage-copy').textContent = lesson.quiz_mode === 'practice'
      ? '개념원리 · 빈출 1문항, 고난도 1문항'
      : '이번 회차에 사용할 교사부록 문항 3개를 선택해 주세요.';
    links('curriculum', state.staff && lesson.curriculum_url, 'spreadsheets');
    links('review', state.staff && lesson.lesson === 1 && currentCourse().review_url, 'spreadsheets');
    links('presentation', state.staff && lesson.presentation_url, 'presentation');
    $('no-deck').hidden = !state.staff || !$('presentation').hidden;
    $('actions').hidden = !state.staff;
    $('google-help').hidden = !state.staff;
    $('staff-links').hidden = !state.staff;
    options($('book'), values(books, 'book'), currentCourse().lesson_slots === 11 ? 'RPM' : undefined);
    setUnit(lesson.unit, lesson.section);
    options($('stage-book'), values(stageCatalog(), 'book'));
    setStageUnit(lesson.unit);
    const restored = state.view.course === currentCourse().id && state.view.lesson === lesson.lesson;
    renderQuizSlots(restored ? state.view.quizSlot : 1);
    renderQuiz();
    $('quiz-save').hidden = !state.composer;
    for (const id of [...formulaInputs, 'quiz-kind', 'quiz-choice-answer']) $(id).disabled = !state.composer;
    $('symbol-panel').hidden = !state.composer;
    showStage(restored ? state.view.stage : 'catalog');
    renderSubmission();
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

function stageSlots() {
  const mode = currentLesson()?.quiz_mode;
  return mode === 'practice' ? 2 : mode === 'appendix' ? 3 : 0;
}

function stageTitle(mode) {
  if (mode === 'practice') return '실전 스테이지';
  if (mode === 'appendix') return '퀴즈앤 · 교사부록';
  return '퀴즈앤 · 직접 출제';
}

function lessonCatalog() {
  return state.catalog.filter(q => (q.use_kind ?? 'lesson') === 'lesson');
}

function stageCatalog() {
  return state.catalog.filter(q => q.use_kind === currentLesson()?.quiz_mode);
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
    const choices = [['', '문항 선택'], ...questions.map(question => [question.question_id, question.label])];
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
  $('question-slots').replaceChildren(...pickControls(lessonSlots(), state.picks, current, labels, savePick));
}

function stageQuestionsForBook() {
  return stageCatalog().filter(q => q.book === $('stage-book').value);
}

function setStageUnit(preferred) {
  const available = values(stageQuestionsForBook(), 'unit');
  options($('stage-unit'), available, preferred);
  setStageSection();
}

function selectedStageUnitQuestions() {
  return stageQuestionsForBook().filter(q => q.unit === $('stage-unit').value);
}

function setStageSection() {
  const sections = values(selectedStageUnitQuestions(), 'section');
  options($('stage-section'), sections, $('stage-section').value);
  renderStagePicks();
  renderStagePreview();
}

function selectedStageQuestions() {
  return selectedStageUnitQuestions().filter(q => q.section === $('stage-section').value);
}

function renderStagePicks() {
  const labels = currentLesson()?.quiz_mode === 'practice'
    ? slot => slot === 1 ? '빈출 문제 (2분)' : '고난도 문제 (3분)'
    : slot => '부록 ' + slot + '번 (' + (slot === 3 ? 3 : 2) + '분)';
  $('stage-picks').replaceChildren(...pickControls(stageSlots(), state.stagePicks, selectedStageQuestions(), labels,
    (slot, value, select) => savePick(slot, value, select, true)));
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

async function savePick(slot, value, select, stage = false) {
  const picks = stage ? state.stagePicks : state.picks;
  const name = stage ? 'math_stage_selections' : 'math_selections';
  const status = stage ? 'stage-status' : 'load-status';
  const previous = picks.get(slot);
  const question = state.catalog.find(item => item.question_id === Number(value));
  if (!question && !previous) return;
  $(status).textContent = '';
  await withSaving(async () => {
    const filter = { ...context(), slot: 'eq.' + slot, select: 'slot,question_id' };
    const result = !question
      ? await table(name, filter, 'DELETE')
      : previous
        ? await table(name, filter, 'PATCH', { question_id: question.question_id })
        : await table(name, { select: 'slot,question_id' }, 'POST', {
          course_id: currentCourse().id, lesson: currentLesson().lesson, slot, question_id: question.question_id,
        });
    if (!result.length) throw new ApiError(403, '이 문항을 변경할 권한이 없거나 이미 변경됐습니다.');
    if (question) {
      picks.set(slot, question.question_id);
    } else {
      picks.delete(slot);
    }
    state.edited = true;
    if (stage) renderStagePicks();
    else renderPicks();
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
  formulaTarget = $('quiz-prompt');
  const quiz = state.quizzes.get(state.quizSlot);
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
        term.textContent = value;
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

function renderSubmission() {
  updateStageProgress();
  const basic = Array.from({ length: requiredLessonSlots() }, (_, i) => i + 1).every(slot => state.picks.has(slot));
  const extras = currentLesson()?.quiz_mode === 'teacher' ? state.quizzes.size === 5 : state.stagePicks.size === stageSlots();
  const ready = basic && extras && !state.quizDirty;
  $('submit').disabled = state.busy || !ready || Boolean(state.submitted && !state.edited);
  $('submit').textContent = state.submitted ? '수정본 제출' : '회차 제출';
  if (!ready) {
    $('submit-status').textContent = !basic ? '기본 문항 ' + requiredLessonSlots() + '개를 먼저 골라 주세요.'
      : state.quizDirty ? '입력한 퀴즈를 저장해 주세요.'
        : stageTitle(currentLesson()?.quiz_mode) + ' 문항을 모두 채워 주세요.';
  } else if (state.submitted && !state.edited) {
    const submitted = new Date(state.submitted.submitted_at).toLocaleString('ko-KR');
    $('submit-status').textContent = '제출 완료 · ' + submitted + (state.submitted.sync_status === 'synced' ? ' · Google 반영 완료' : ' · Google 연결 대기');
  } else {
    $('submit-status').textContent = '제출하면 현재 문항이 제출본으로 저장됩니다.';
  }
}

async function submit() {
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
  }, 'load-status');
}

function resultLink(value) {
  const url = new URL(value);
  const isDriveFile = url.origin === 'https://drive.google.com' && url.pathname.startsWith('/file/d/');
  const isPresentation = url.origin === 'https://docs.google.com' && url.pathname.startsWith('/presentation/d/');
  if (!isDriveFile && !isPresentation) throw Error('저장한 PPT의 Google 링크를 확인하지 못했습니다.');
  $('ppt-result').href = url.href;
  $('ppt-result').hidden = false;
  return url.href;
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
  if (!state.submitted) return '회차를 제출하면 시트 반영과 PPT 저장을 할 수 있습니다.';
  if ((state.submitted.stage_questions ?? []).length !== stageSlots()) {
    return stageTitle(currentLesson().quiz_mode) + ' 문항을 선택하고 다시 제출해 주세요.';
  }
  return '';
}

function renderExport() {
  if (!state.staff) return;
  const blocker = exportBlocker();
  for (const id of ['ppt-drive', 'sheet-sync']) $(id).disabled = state.busy || Boolean(blocker);
  $('sheet-sync').disabled ||= !sheetDestination(currentCourse(), currentLesson());
  if (blocker) $('export-status').textContent = blocker;
  else if (!$('export-status').textContent || $('export-status').dataset.lesson !== $('lesson').value) {
    $('export-status').textContent = 'PPT는 연결한 @socra.ai 계정의 내 드라이브에 저장됩니다.';
  }
  $('export-status').dataset.lesson = $('lesson').value;
}

async function preparePresentation() {
  if (!state.staff || state.busy || exportBlocker()) return;
  $('export-status').textContent = '회사 Google 계정을 확인하는 중입니다.';
  await withSaving(async () => {
    const connection = await connectStaffDrive();
    const course = currentCourse();
    const submission = state.submitted;
    const withAsset = pick => {
      const question = state.catalog.find(item => item.question_id === pick.question_id);
      if (!question) throw Error('제출된 문항을 교재 목록에서 찾을 수 없습니다.');
      return { ...question, slot: pick.slot };
    };
    const slotList = submission.selections.map(withAsset);
    const stageList = (submission.stage_questions ?? []).map(withAsset);
    const title = '수학 ' + currentLesson().lesson + '강 · ' + currentLesson().topic.replace(/^\([^)]*\)\s*/, '') + ' · 빔용';
    const filename = title + '.pptx';
    $('export-status').textContent = '문항을 한 장씩 발표자료에 넣는 중입니다.';
    const blob = await buildPresentation({
      title, picks: slotList, quizzes: submission.quizzes, appendix: stageList,
      stageLabel: stageTitle(currentLesson().quiz_mode),
    }, async question => {
      const path = question.image_key
        ? '/storage/v1/object/authenticated/math-teaching-materials/' + encodeURIComponent(course.id) + '/' + question.image_key
        : previewPath(course.id, question.preview_book, question.page);
      return (await request(path)).blob();
    });
    const driveUrl = resultLink(await saveToStaffDrive(connection, blob, filename, submission.id));
    const [prior] = await table('math_staff_exports', receiptFilter());
    if (!prior) {
      await table('math_staff_exports', { select: 'drive_url' }, 'POST', {
        course_id: course.id, submission_id: submission.id, drive_url: driveUrl,
      });
    } else if (prior.drive_url !== driveUrl) {
      await table('math_staff_exports', receiptFilter(), 'PATCH', { drive_url: driveUrl });
    }
    state.exportReceipt = driveUrl;
    $('export-status').textContent = connection.email + ' 내 드라이브에 저장했습니다.';
  }, 'export-status');
}

async function reflectSheet() {
  if (!state.staff || state.busy || exportBlocker()) return;
  const destination = sheetDestination(currentCourse(), currentLesson());
  if (!destination) return;
  $('sheet-status').textContent = 'Google 계정 권한과 시트 위치를 확인하고 있습니다.';
  await withSaving(async () => {
    const submission = state.submitted;
    const result = await syncSubmissionToSheet(destination, currentLesson(), submission);
    if (!result) {
      $('sheet-status').textContent = 'Google 시트 반영을 취소했습니다.';
      return;
    }
    const status = await table('math_submissions', {
      id: 'eq.' + submission.id, select: 'id,sync_status',
    }, 'PATCH', { sync_status: 'synced' });
    if (status[0]?.sync_status === 'synced') submission.sync_status = 'synced';
    $('sheet-status').textContent = result.written
      ? 'Google 시트 ' + destination.row + '행에 ' + result.written + '칸을 반영했습니다.'
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
  const course = currentCourse()?.id;
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

function insertSymbol(value, cursor, selectionLength = 0) {
  const input = formulaTarget.closest('[hidden]') ? $('quiz-prompt') : formulaTarget;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.focus();
  input.setRangeText(value, start, end, 'end');
  if (cursor !== undefined) input.setSelectionRange(start + cursor, start + cursor + selectionLength);
  input.dispatchEvent(new Event('input'));
}

for (const [label, value, aria, cursor, selectionLength] of [
  ['제곱 ²', '²', '제곱'], ['세제곱 ³', '³', '세제곱'], ['지수 입력', '^{}', '지수 입력', 2],
  ['분수', '(분자)⁄(분모)', '분수', 1, 2], ['절댓값', '|값|', '절댓값', 1, 1],
  ['제곱근 √', '√', '제곱근'], ['순환점', '\u0307', '순환소수 점'],
  ['×', '×', '곱하기'], ['÷', '÷', '나누기'], ['−', '−', '빼기'], ['±', '±', '플러스 마이너스'],
  ['≠', '≠', '같지 않음'], ['≤', '≤', '작거나 같음'], ['≥', '≥', '크거나 같음'],
  ['∠', '∠', '각'], ['°', '°', '도'], ['∥', '∥', '평행'], ['⊥', '⊥', '수직'], ['π', 'π', '파이'],
]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = aria;
  button.setAttribute('aria-label', aria);
  button.addEventListener('click', () => insertSymbol(value, cursor, selectionLength));
  $('symbols').append(button);
}

function protectUnsaved(select, callback) {
  let prior = select.value;
  select.addEventListener('focus', () => { prior = select.value; });
  select.addEventListener('change', () => {
    if (state.quizDirty && !window.confirm('저장하지 않은 퀴즈가 있습니다. 이동할까요?')) {
      select.value = prior;
      return;
    }
    prior = select.value;
    callback();
  });
}

for (const id of formulaInputs) {
  $(id).addEventListener('focus', () => { formulaTarget = $(id); });
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
$('stage-unit').addEventListener('change', setStageSection);
$('stage-section').addEventListener('change', () => {
  renderStagePicks();
  renderStagePreview();
});
$('teacher-section').addEventListener('submit', saveQuiz);
$('submit').addEventListener('click', submit);
$('sheet-sync').addEventListener('click', reflectSheet);
$('ppt-drive').addEventListener('click', preparePresentation);
$('retry').addEventListener('click', loadSite);
protectUnsaved($('course'), loadCourse);
protectUnsaved($('lesson'), loadLesson);
window.addEventListener('storage', event => {
  if (event.key && event.key !== tokenKey && event.key !== accountKey) return;
  const token = localStorage.getItem(tokenKey);
  const account = localStorage.getItem(accountKey);
  if (token && state.token && account === state.account) state.token = token;
  else if (token !== state.token || account !== state.account) void loadSite();
});
void loadSite();
