import { buildPresentation, downloadPresentation } from './presentation.mjs?v=2';
import { prepareGoogleDrive, connectStaffDrive, saveToStaffDrive } from './google-drive.mjs';
import { supabaseUrl, publishableKey } from './public-config.mjs';

const $ = id => document.getElementById(id);
const tokenKey = 'socra_admin_token';
const accountKey = 'socra_user_id';
const dateLabel = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'UTC' });
const quizSeconds = [30, 30, 60, 60, 120];
const formulaInputs = ['quiz-prompt', 'quiz-answer', 'quiz-choices'];
const state = {
  token: null, staff: false, editor: false, composer: false, memberships: [], courses: [], lessons: [], catalog: [], picks: new Map(), quizzes: new Map(),
  submitted: null, courseVersion: 0, lessonVersion: 0, previewVersion: 0, previewUrl: '', busy: false,
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
    const allowed = ['기본 문항 1~5번을 먼저 골라 주세요.', '퀴즈앤 직접 출제 문항 5개를 먼저 저장해 주세요.'];
    const message = allowed.includes(data.message) ? data.message : '작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
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
  $(id).textContent = error instanceof ApiError || id === 'export-status'
    ? error.message : '연결을 확인하고 다시 시도해 주세요.';
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

function context() {
  return { course_id: 'eq.' + currentCourse().id, lesson: 'eq.' + currentLesson().lesson };
}

async function loadCatalog(courseId) {
  const rows = [];
  const limit = 500;
  for (let offset = 0; ; offset += limit) {
    const next = await table('math_question_index', {
      course_id: 'eq.' + courseId,
      select: 'question_id,book,unit,section,page,label,preview_top,preview_book,slide_crop',
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
  const token = state.token;
  if (!token) {
    showStatus('수학자동화는 권한이 있는 사이트 계정으로 사용할 수 있습니다.', { login: true });
    return;
  }
  showStatus('수학자동화 접속을 확인하는 중입니다.');
  try {
    const [courses, profiles, memberships] = await Promise.all([
      table('math_courses', { select: 'id,instructor,review_url', order: 'instructor' }),
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
    options($('course'), courses.map(item => [item.id, item.instructor]), active.id);
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
        course_id: 'eq.' + course.id, select: 'lesson,live_date,topic,unit,section,curriculum_url,presentation_url,quiz_mode', order: 'lesson',
      }),
      loadCatalog(course.id),
    ]);
    if (version !== state.courseVersion) return;
    state.lessons = lessons;
    state.catalog = catalog;
    options($('lesson'), lessons.map(item => [
      item.lesson, item.lesson + '강 · ' + dateLabel.format(new Date(item.live_date + 'T00:00:00Z')),
    ]), lessons[0]?.lesson);
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
    const [picks, quizzes, submissions, appendix] = await Promise.all([
      table('math_selections', { ...filter, select: 'slot,question_id' }),
      lesson.quiz_mode === 'teacher' ? table('math_teacher_quizzes', { ...filter, select: 'slot,kind,prompt,answer,choices' }) : [],
      table('math_submissions', { ...filter, select: 'id,submitted_at,sync_status,selections,quizzes', order: 'submitted_at.desc', limit: 1 }),
      lesson.quiz_mode === 'appendix' ? table('math_appendix_items', { ...filter, select: 'slot,label,image_key', order: 'slot' }) : [],
    ]);
    if (version !== state.lessonVersion) return;
    state.picks = new Map(picks.map(value => [value.slot, value.question_id]));
    state.quizzes = new Map(quizzes.map(value => [value.slot, value]));
    state.submitted = submissions[0] ?? null;
    state.appendix = appendix;
    $('appendix-note').textContent = appendix.length ? appendix.map(item => item.label).join(' · ') : '부록 자료 준비 중';
    $('submission-panel').hidden = !state.composer;
    $('staff-panel').hidden = !state.staff;
    $('ppt-result').hidden = true;
    $('ppt-result').removeAttribute('href');
    const savedPicks = state.submitted?.selections ?? [];
    const savedQuizzes = state.submitted?.quizzes ?? [];
    state.edited = savedPicks.length !== picks.length ||
      savedPicks.some(pick => state.picks.get(pick.slot) !== pick.question_id) ||
      savedQuizzes.length !== quizzes.length || savedQuizzes.some(saved => {
        const draft = state.quizzes.get(saved.slot);
        return !draft || ['kind', 'prompt', 'answer', 'choices'].some(key => saved[key] !== draft[key]);
      });
    state.quizDirty = false;
    $('export-status').textContent = '';
    $('load-status').textContent = '';
    $('lesson-tools').hidden = false;
    $('catalog').hidden = !state.catalog.length;
    $('asset-admin').hidden = !state.editor;
    $('teacher-section').hidden = lesson.quiz_mode !== 'teacher';
    $('appendix-section').hidden = lesson.quiz_mode !== 'appendix';
    links('curriculum', state.staff && lesson.curriculum_url, 'spreadsheets');
    links('review', state.staff && lesson.lesson === 1 && currentCourse().review_url, 'spreadsheets');
    links('presentation', state.staff && lesson.presentation_url, 'presentation');
    $('no-deck').hidden = !state.staff || !$('presentation').hidden;
    $('actions').hidden = !state.staff;
    $('google-help').hidden = !state.staff;
    options($('book'), values(state.catalog, 'book'));
    setUnit(lesson.unit, lesson.section);
    renderQuizSlots(1);
    renderQuiz();
    $('quiz-save').hidden = !state.composer;
    for (const id of [...formulaInputs, 'quiz-kind']) $(id).disabled = !state.composer;
    $('symbols').hidden = !state.composer;
    renderSubmission();
    renderExport();
    const first = state.catalog.find(question => question.question_id === state.picks.get(1));
    if (first) void showPreview(first);
  } catch (error) {
    if (version === state.lessonVersion) failure(error);
  }
}

function setUnit(unit, section) {
  const bookRows = state.catalog.filter(question => question.book === $('book').value);
  options($('unit'), values(bookRows, 'unit'), unit);
  setSection(section);
}

function setSection(section) {
  const rows = state.catalog.filter(question => question.book === $('book').value && question.unit === $('unit').value);
  options($('section'), values(rows, 'section'), section);
  renderPicks();
}

function renderPicks() {
  const current = state.catalog.filter(question => question.book === $('book').value &&
    question.unit === $('unit').value && question.section === $('section').value);
  $('question-count').textContent = state.picks.size + ' / 8개 선정 · 현재 목록 ' + current.length + '문항';
  const slots = [];
  for (let slot = 1; slot <= 8; slot += 1) {
    const label = document.createElement('label');
    if (slot > 5) label.className = 'reserve';
    label.textContent = (slot <= 5 ? '기본 ' : '예비 ') + slot + '번';
    const select = document.createElement('select');
    const selected = state.catalog.find(question => question.question_id === state.picks.get(slot));
    const picks = [['', '문항 선택'], ...current.map(question => [question.question_id, question.label])];
    if (selected && !current.includes(selected)) picks.splice(1, 0, [selected.question_id, selected.label + ' · 저장됨']);
    options(select, picks, selected?.question_id);
    select.disabled = !state.composer;
    select.addEventListener('change', () => savePick(slot, select.value, select));
    select.addEventListener('focus', () => {
      if (selected && !state.busy) void showPreview(selected);
    });
    label.append(select);
    if (!state.composer && selected) {
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'slot-preview';
      preview.textContent = '교재 원본 보기';
      preview.addEventListener('click', () => showPreview(selected));
      label.append(preview);
    }
    slots.push(label);
  }
  $('question-slots').replaceChildren(...slots);
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

async function savePick(slot, value, select) {
  const previous = state.picks.get(slot);
  const question = state.catalog.find(item => item.question_id === Number(value));
  if (!question && !previous) return;
  $('load-status').textContent = '';
  await withSaving(async () => {
    const filter = { ...context(), slot: 'eq.' + slot, select: 'slot,question_id' };
    const result = !question
      ? await table('math_selections', filter, 'DELETE')
      : previous
        ? await table('math_selections', filter, 'PATCH', { question_id: question.question_id })
        : await table('math_selections', { select: 'slot,question_id' }, 'POST', {
          course_id: currentCourse().id, lesson: currentLesson().lesson, slot, question_id: question.question_id,
        });
    if (!result.length) throw new ApiError(403, '이 문항을 변경할 권한이 없거나 이미 변경됐습니다.');
    if (question) {
      state.picks.set(slot, question.question_id);
      void showPreview(question);
    } else {
      state.picks.delete(slot);
      clearPreview();
    }
    state.edited = true;
    renderPicks();
  }, 'load-status');
  if (select.isConnected) select.value = state.picks.get(slot) ?? '';
}

function renderQuizSlots(slot) {
  options($('quiz-slot'), quizSeconds.map((seconds, idx) => {
    const number = idx + 1;
    const duration = seconds < 60 ? seconds + '초' : seconds / 60 + '분';
    return [number, '문항 ' + number + ' · ' + duration + (state.quizzes.has(number) ? ' · 저장됨' : '')];
  }), slot);
}

function renderQuiz() {
  formulaTarget = $('quiz-prompt');
  const quiz = state.quizzes.get(Number($('quiz-slot').value));
  $('quiz-kind').value = quiz?.kind ?? 'short';
  $('quiz-answer').value = quiz?.answer ?? '';
  $('quiz-prompt').value = quiz?.prompt ?? '';
  $('quiz-choices').value = quiz?.choices ?? '';
  $('quiz-status').textContent = '';
  state.quizDirty = false;
  updateQuizPreview();
}

function mathText(value) {
  const fragment = document.createDocumentFragment();
  const matches = value.matchAll(/\^\{([^{}]{1,60})\}/g);
  let from = 0;
  for (const match of matches) {
    fragment.append(document.createTextNode(value.slice(from, match.index)));
    const power = document.createElement('sup');
    power.textContent = match[1];
    fragment.append(power);
    from = match.index + match[0].length;
  }
  fragment.append(document.createTextNode(value.slice(from)));
  return fragment;
}

function updateQuizPreview() {
  const isChoice = $('quiz-kind').value === 'choice';
  $('choices-field').hidden = !isChoice;
  $('quiz-answer').placeholder = isChoice ? '정답 보기 번호' : $('quiz-kind').value === 'ox' ? 'O 또는 X' : '';
  const text = $('quiz-prompt').value;
  $('quiz-preview').hidden = !text.trim();
  $('quiz-preview').replaceChildren(mathText(text));
}

async function saveQuiz() {
  const slot = Number($('quiz-slot').value);
  const kind = $('quiz-kind').value;
  const prompt = $('quiz-prompt').value.trim();
  let answer = $('quiz-answer').value.trim();
  const choices = kind === 'choice' ? $('quiz-choices').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean) : [];
  if (kind === 'ox') answer = answer.toUpperCase();
  if (!prompt || !answer || (kind === 'ox' && !['O', 'X'].includes(answer)) ||
      (kind === 'choice' && (choices.length < 2 || choices.length > 5 || !/^[1-5]$/.test(answer) || Number(answer) > choices.length))) {
    $('quiz-status').textContent = '문제와 정답을 입력해 주세요. 객관식은 보기 2~5개와 정답 번호가 필요합니다.';
    return;
  }
  await withSaving(async () => {
    const body = { kind, prompt, answer, choices: choices.join('\n') };
    const select = 'slot,kind,prompt,answer,choices';
    const rows = state.quizzes.has(slot)
      ? await table('math_teacher_quizzes', { ...context(), slot: 'eq.' + slot, select }, 'PATCH', body)
      : await table('math_teacher_quizzes', { select }, 'POST', {
        ...body, course_id: currentCourse().id, lesson: currentLesson().lesson, slot,
      });
    if (!rows.length) throw new ApiError(403, '이 퀴즈 문항을 저장할 권한이 없습니다.');
    state.quizzes.set(slot, rows[0]);
    state.edited = true;
    renderQuizSlots(slot);
    renderQuiz();
    $('quiz-status').textContent = '저장했습니다.';
  }, 'quiz-status');
}

function renderSubmission() {
  const ready = [1, 2, 3, 4, 5].every(slot => state.picks.has(slot)) &&
    (currentLesson()?.quiz_mode !== 'teacher' || state.quizzes.size === 5) && !state.quizDirty;
  $('submit').disabled = state.busy || !ready || Boolean(state.submitted && !state.edited);
  $('submit').textContent = state.submitted ? '수정본 제출' : '회차 제출';
  if (!ready) {
    $('submit-status').textContent = '기본 문항 5개와 이 회차에 필요한 직접 출제 문항을 저장해 주세요.';
  } else if (state.submitted && !state.edited) {
    const submitted = new Date(state.submitted.submitted_at).toLocaleString('ko-KR');
    $('submit-status').textContent = '제출 완료 · ' + submitted + (state.submitted.sync_status === 'synced' ? ' · Google 반영 완료' : ' · Google 연결 대기');
  } else {
    $('submit-status').textContent = '제출하면 현재 문항이 제출본으로 저장됩니다.';
  }
}

async function submit() {
  await withSaving(async () => {
    const rows = await table('math_submissions', { select: 'id,submitted_at,sync_status,selections,quizzes' }, 'POST', {
      course_id: currentCourse().id, lesson: currentLesson().lesson,
    });
    if (!rows[0]) throw new ApiError(403, '이 회차를 제출할 권한이 없습니다.');
    state.submitted = rows[0];
    state.edited = false;
    $('export-status').textContent = '';
  }, 'load-status');
}

function exportBlocker() {
  if (!state.submitted) return '제출된 회차를 선택하면 빔용 PPT를 만들 수 있습니다.';
  if (currentLesson().quiz_mode === 'appendix' && state.appendix.length !== 3) {
    return '교사부록 문항 3개가 등록되면 빔용 PPT를 만들 수 있습니다.';
  }
  return '';
}

function renderExport() {
  if (!state.staff) return;
  const blocker = exportBlocker();
  for (const id of ['ppt-download', 'ppt-drive']) $(id).disabled = state.busy || Boolean(blocker);
  if (blocker) $('export-status').textContent = blocker;
  else if (!$('export-status').textContent || $('export-status').dataset.lesson !== $('lesson').value) {
    $('export-status').textContent = '최근 제출본으로 생성합니다. 이미지 잘림과 글자 크기를 발표 전에 확인해 주세요.';
  }
  $('export-status').dataset.lesson = $('lesson').value;
}

async function preparePresentation(saveInDrive) {
  if (!state.staff || state.busy || exportBlocker()) return;
  $('export-status').textContent = saveInDrive ? '회사 Google 계정을 확인하는 중입니다.' : '발표자료를 준비하는 중입니다.';
  await withSaving(async () => {
    const connection = saveInDrive ? await connectStaffDrive() : null;
    const course = currentCourse();
    const submission = state.submitted;
    const slotList = submission.selections.map(pick => {
      const question = state.catalog.find(item => item.question_id === pick.question_id);
      if (!question) throw Error('제출된 문항을 교재 목록에서 찾을 수 없습니다.');
      return { ...question, slot: pick.slot };
    });
    const title = '수학 ' + currentLesson().lesson + '강 · ' + currentLesson().topic.replace(/^\([^)]*\)\s*/, '') + ' · 빔용';
    const filename = title + '.pptx';
    $('export-status').textContent = '문항을 한 장씩 발표자료에 넣는 중입니다.';
    const blob = await buildPresentation({
      title, picks: slotList, quizzes: submission.quizzes, appendix: state.appendix,
    }, async question => {
      const path = question.image_key
        ? '/storage/v1/object/authenticated/math-teaching-materials/' + encodeURIComponent(course.id) + '/' + question.image_key
        : previewPath(course.id, question.preview_book, question.page);
      return (await request(path)).blob();
    });
    if (saveInDrive) {
      const url = new URL(await saveToStaffDrive(connection, blob, filename, submission.id));
      const isDriveFile = url.origin === 'https://drive.google.com' && url.pathname.startsWith('/file/d/');
      const isPresentation = url.origin === 'https://docs.google.com' && url.pathname.startsWith('/presentation/d/');
      if (!isDriveFile && !isPresentation) throw Error('저장한 PPT의 Google 링크를 확인하지 못했습니다.');
      $('ppt-result').href = url.href;
      $('ppt-result').hidden = false;
      $('export-status').textContent = connection.email + ' 내 드라이브에 저장했습니다.';
    } else {
      downloadPresentation(blob, filename);
      $('export-status').textContent = 'PPT를 생성했습니다.';
    }
  }, 'export-status');
}

function clearPreview() {
  state.previewVersion += 1;
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = '';
  $('preview-image').removeAttribute('src');
  $('preview-image').hidden = true;
  $('preview-title').textContent = '교재 원본';
  $('preview-status').textContent = '왼쪽에서 문항을 고르면 여기에 표시됩니다.';
}

function assetKey(course, book, page) {
  return encodeURIComponent(course) + '/' + encodeURIComponent(book) + '/page-' + String(page).padStart(3, '0') + '.webp';
}

function previewPath(course, book, page) {
  return '/storage/v1/object/authenticated/math-teaching-materials/' + assetKey(course, book, page);
}

async function showPreview(question) {
  clearPreview();
  const version = state.previewVersion;
  $('preview-title').textContent = question.label;
  if (!question.preview_book) {
    $('preview-status').textContent = '아직 등록된 교재 원본이 없습니다.';
    return;
  }
  $('preview-status').textContent = '교재 원본 불러오는 중';
  try {
    const reply = await request(previewPath(currentCourse().id, question.preview_book, question.page));
    const file = await reply.blob();
    if (version !== state.previewVersion) return;
    if (file.type !== 'image/webp') throw Error('Wrong image type');
    state.previewUrl = URL.createObjectURL(file);
    const img = $('preview-image');
    img.onload = () => {
      if (version !== state.previewVersion) return;
      const scroller = $('preview-scroll');
      scroller.scrollTop = Math.max(0, (question.preview_top ?? 0) * img.height - 24);
      scroller.scrollLeft = Math.max(0, ((question.slide_crop?.[0] ?? 0) - .08) * img.width);
    };
    img.alt = question.label + ' · 교재 원본';
    img.hidden = false;
    img.src = state.previewUrl;
    $('preview-status').textContent = '교재 ' + question.page + '쪽 · 스크롤로 원본 확인';
  } catch {
    if (version === state.previewVersion) $('preview-status').textContent = '이 교재 쪽의 미리보기를 열 수 없습니다.';
  }
}

async function uploadPreviews() {
  if (!state.editor) return;
  const files = [...$('preview-files').files];
  const byPage = new Map(state.catalog.filter(question => question.book === $('book').value && question.preview_book)
    .map(question => [question.page, question.preview_book]));
  const entries = files.map(file => [file, Number(file.name.match(/^page-(\d{3})\.webp$/)?.[1])]);
  if (!entries.length || entries.some(([file, page]) => file.size > 2097152 || !byPage.has(page))) {
    $('upload-status').textContent = '현재 교재에 있는 page-001.webp 형식의 파일을 골라 주세요.';
    return;
  }
  await withSaving(async () => {
    const course = currentCourse().id;
    let uploaded = 0, present = 0, failed = 0;
    for (let i = 0; i < entries.length; i += 5) {
      await Promise.all(entries.slice(i, i + 5).map(async ([file, page]) => {
        const path = '/storage/v1/object/math-teaching-materials/' + assetKey(course, byPage.get(page), page);
        try {
          await request(path, { method: 'POST', body: file, headers: { 'Content-Type': 'image/webp', 'cache-control': 'no-store' } });
          uploaded += 1;
        } catch (error) {
          if (error.status === 401) throw error;
          if (error.status === 409) present += 1;
          else failed += 1;
        }
      }));
      $('upload-status').textContent = '신규 ' + uploaded + '쪽 · 기등록 ' + present + '쪽 · 실패 ' + failed + '쪽';
    }
    $('preview-files').value = '';
  }, 'upload-status');
}

function insertSymbol(value, move) {
  const input = formulaTarget;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.focus();
  input.setRangeText(value, start, end, 'end');
  if (move) input.setSelectionRange(start + move, start + move);
  input.dispatchEvent(new Event('input'));
}

for (const [label, value, aria, move] of [
  ['x²', '²', '제곱'], ['x³', '³', '세제곱'], ['xⁿ', '^{}', '지수 입력', 2],
  ['×', '×', '곱하기'], ['÷', '÷', '나누기'], ['−', '−', '빼기'], ['√', '√', '제곱근'],
  ['≠', '≠', '같지 않음'], ['≤', '≤', '작거나 같음'], ['≥', '≥', '크거나 같음'],
  ['π', 'π', '파이'], ['⁄', '⁄', '분수 기호'],
]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = aria;
  button.setAttribute('aria-label', aria);
  button.addEventListener('click', () => insertSymbol(value, move));
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
    updateQuizPreview();
    renderSubmission();
  });
}
$('quiz-kind').addEventListener('change', () => {
  state.quizDirty = true;
  updateQuizPreview();
  renderSubmission();
});
$('book').addEventListener('change', () => setUnit(currentLesson().unit, currentLesson().section));
$('unit').addEventListener('change', () => setSection(currentLesson().section));
$('section').addEventListener('change', renderPicks);
$('quiz-save').addEventListener('click', saveQuiz);
$('submit').addEventListener('click', submit);
$('ppt-download').addEventListener('click', () => preparePresentation(false));
$('ppt-drive').addEventListener('click', () => preparePresentation(true));
$('retry').addEventListener('click', loadSite);
$('preview-upload').addEventListener('click', uploadPreviews);
protectUnsaved($('course'), loadCourse);
protectUnsaved($('lesson'), loadLesson);
protectUnsaved($('quiz-slot'), renderQuiz);
window.addEventListener('storage', event => {
  if (event.key && event.key !== tokenKey && event.key !== accountKey) return;
  const token = localStorage.getItem(tokenKey);
  const account = localStorage.getItem(accountKey);
  if (token && state.token && account === state.account) state.token = token;
  else if (token !== state.token || account !== state.account) void loadSite();
});
void loadSite();
