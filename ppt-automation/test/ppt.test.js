// node --test ppt-automation/test
// 실제 커리큘럼은 공개 저장소에 올리지 않는다. 아래 데이터는 형식만 흉내 낸 가짜 예시다.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../ppt-core.js');
const B = require('../slides-builder.js');

// ---------------------------------------------------------------------------
// 가짜 시트 (머리글 3줄 + 가이드 행 + 강의 2개)
// ---------------------------------------------------------------------------
const HEAD = [
  ['', '', 'Class', '', '', '', '', '', '', '', '', '', '', 'Trivia Time', 'Word Check', '', '', '', '', 'Inside the Story', '', '', '', '', '', '', '', '', '', 'Quiz Time (퀴즈앤)', 'My Headline', 'My Headline IMG', 'PPT'],
  ['', 'No.', 'Week', 'Live Class', '', 'Lesson Title (KOR)', 'Lesson Title (ENG)', 'Lesson Objectives', 'Thumbnail IMG', 'IP Clip', '', '', '', 'Trivia Time', 'Vocabulary', 'From the Script', 'Answer Choices', 'New Example', 'IMG Link', 'Script 1', 'Analysis 1', '', '', 'Grammar 1', '', '', '', '', 'Comprehension 1', 'Quiz Time (퀴즈앤)', 'My Headline', 'My Headline IMG', 'PPT'],
  ['', '', '', 'Date', 'Day', '', '', '', '', 'Video Link', 'Time Code', 'Subtitle Link', 'Subtitles', '', '', '', '', '', '', '', 'Expression', 'Question', 'Answer', 'Script Sentence', 'Pattern', 'Explanation', 'Example', 'Practice', 'Comprehension Practice', '', '', '', ''],
  ['', 'Ex', '0'],
];
function lessonRow(no, cells) {
  const r = new Array(HEAD[0].length).fill('');
  r[1] = String(no); r[3] = '3/4'; r[4] = 'Mon'; r[6] = cells.title || 'Robots Bake Bread';
  Object.assign(r, cells.at || {});
  return r;
}
const L1 = lessonRow(1, {
  at: {
    13: 'Q)\nHow many loaves does the robot bake per hour?\nA)\n10\n40 ✅\n100\n400',
    14: '1. knead\n2. crisp',
    15: '1. The robot kneads the dough for ten minutes.\n2. ...until the crust is crisp and golden.',
    16: '1.\n① to fold and press dough ✅\n② to cut bread\n③ to sell bread\n④ to cool down\n\n2. crisp\n① soft and wet\n② firm and crunchy ✅\n③ very old\n④ sweet',
    17: '1. knead\nShe kneaded the clay into a ball.\n\n2. The chips were crisp and salty.',
    18: '1. https://example.com/a.png\n2. https://example.com/b.png',
    19: 'A bakery in town is testing a robot. It works around the clock, and customers say the bread tastes the same.',
    20: '1. around the clock\n2. tastes the same',
    21: '1. What does "around the clock" mean?\n2. What does "the same" mean here?',
    22: '1. All day and night\n2. Not different',
    23: 'A bakery in town is testing a robot.',
    24: 'be + V-ing',
    25: 'Something happening now',
    26: '1. We are baking cookies.\n2. He is fixing the oven.',
    27: 'Complete the sentence.\n01. The robot ___ bread now. (bake) → is baking\n02. They ___ the oven. (clean)\nA: are cleaning\n03. Choose the right one: The baker ___ tired.\nA) are B) is ✅ C) be D) being',
    28: '1. The robot works only in the morning. > False\n2. Customers like the bread. → True',
    29: '1. Choose the correct words to fill in the blank.\nThe robot ___ bread.\nA) bake\nB) is baking ✅\nC) baking\nD) bakes now\n\n2. Complete the sentence using the correct form of the word in parentheses.\nWe ___ a cake. (make)\nA: are making',
    30: 'Robot Bakes Bread All Night',
  },
});
const L2 = lessonRow(2, { title: 'Not Yet Written' });
const ROWS = [new Array(HEAD[0].length).fill('')].concat(HEAD, [L1, L2]);

function lesson1() {
  const { lessons } = C.readLessons(ROWS);
  return lessons;
}

test('열 이름으로 위치를 찾는다', () => {
  const { cols } = C.mapColumns(ROWS);
  assert.equal(cols.trivia, 13);
  assert.equal(cols.expr1, 20);
  assert.equal(cols.practice1, 27);
  assert.equal(cols.comp1, 28);
  assert.equal(cols.quiz, 29);
  assert.equal(cols.headline, 30);
});

test('강의 행을 해석하고 빈 강의는 비어 있음으로 표시', () => {
  const [a, b] = lesson1();
  assert.equal(a.no, 1);
  assert.equal(a.dateMMDD, '03/04');
  assert.equal(b.empty, true);
  assert.deepEqual(a.trivia.choices, ['10', '40', '100', '400']);
  assert.equal(a.trivia.answerIndex, 1);
  assert.equal(a.words[0].answerIndex, 0);
  assert.equal(a.words[1].meaning, 'firm and crunchy');
  assert.equal(a.words[0].example, 'She kneaded the clay into a ball.');
  assert.equal(a.words[1].example, 'The chips were crisp and salty.');
});

test('정답 표기 여러 형식 (→, A:, ✅, > False)', () => {
  const [a] = lesson1();
  const items = a.scripts[0].practice.items;
  assert.equal(a.scripts[0].practice.instruction, 'Complete the sentence.');
  assert.deepEqual(items.map((q) => q.kind), ['fill', 'fill', 'mc']);
  assert.equal(items[0].answer, 'is baking');
  assert.equal(items[1].answer, 'are cleaning');
  assert.equal(items[2].answerIndex, 1);
  assert.deepEqual(a.scripts[0].comprehension.items.map((x) => x.answer), ['False', 'True']);
  assert.deepEqual(a.quiz.items.map((q) => q.kind), ['mc', 'fill']);
  assert.equal(a.quiz.items[1].answer, 'are making');
});

test('강조: 변화형·떨어진 표현·관사', () => {
  assert.deepEqual(C.findPhrase('The robot kneads the dough.', 'knead'), [[10, 16]]);
  const t = 'There are no buses... and no trains here.';
  const r = C.findPhrase(t, 'no buses... no trains');
  assert.equal(r.map(([s, e]) => t.slice(s, e)).join('|'), 'no buses|no trains');
  const t2 = 'that decade\'s worth of data';
  assert.ok(C.findPhrase(t2, "a decade's worth of"));
  const t3 = 'turning a long drive into a short flight';
  assert.equal(C.findPhrase(t3, 'turning A into B').length, 2);
  assert.equal(C.findPhrase('nothing here', 'robot'), null);
});

test('검수: 정답 누락·보기 개수 오류를 잡는다', () => {
  const issues = [];
  C.parseQuestion(['The cat ___ asleep.', 'A) is', 'B) are', 'C) be'], (lv, msg) => issues.push(lv + ':' + msg));
  assert.ok(issues.some((x) => x.startsWith('error:정답 표시가 없습니다')));
  assert.ok(issues.some((x) => x.includes('보기가 3개')));
});

test('슬라이드 계획 순서', () => {
  const [a] = lesson1();
  const plan = C.planSlides(a);
  const types = plan.map((p) => p.type);
  assert.deepEqual(types.slice(0, 6), ['greet', 'trivia_intro', 'trivia_q', 'trivia_a', 'video', 'words_intro']);
  assert.equal(types.filter((t) => t === 'word_q').length, 2);
  assert.ok(types.includes('practice_mc_a'));
  assert.equal(types[types.length - 1], 'headline_a');
  const wall = plan.find((p) => p.type === 'wordwall');
  assert.equal(wall.values.code, 'CNN 10_Class 1_01_03/04');
  const wa = plan.find((p) => p.type === 'word_a');
  assert.deepEqual(wa.answer, { tokens: ['c1', 'c2', 'c3', 'c4'], index: 0 });
});

// ---------------------------------------------------------------------------
// 가짜 템플릿 (Slides API presentations.get 응답 모양)
// ---------------------------------------------------------------------------
const run = (s) => ({ textRun: { content: s } });
const shape = (id, text, x, y, w = 2000000, h = 500000) => ({
  objectId: id, size: { width: { magnitude: w, unit: 'EMU' }, height: { magnitude: h, unit: 'EMU' } },
  transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: 'EMU' },
  shape: { text: { textElements: [{ paragraphMarker: {} }, run(text + '\n')] } },
});
const slide = (id, tag, elements) => ({
  objectId: id, pageElements: elements,
  slideProperties: { notesPage: { pageElements: [{ objectId: id + '_notes', shape: { placeholder: { type: 'BODY' }, text: { textElements: [run('#' + tag + '\n선생님 메모\n')] } } }] } },
});
function fakeTemplate() {
  const choiceGroup = (id, tok, x, y) => ({
    objectId: id, transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: 'EMU' },
    elementGroup: { children: [shape(id + 'L', 'A', 0, 0, 300000, 300000), shape(id + 'T', `{{${tok}}}`, 400000, 0)] },
  });
  const slides = [
    slide('t_wq', 'word_q', [shape('wq_s', 'Q. "{{word}}" → {{sentence}}', 0, 0)]),
    slide('t_wa', 'word_a', [
      shape('wa_s', '{{sentence}}', 0, 0),
      choiceGroup('ga', 'c1', 100000, 2000000), choiceGroup('gb', 'c2', 3000000, 2000000),
      choiceGroup('gc', 'c3', 100000, 3000000), choiceGroup('gd', 'c4', 3000000, 3000000),
      // 정답 강조 박스: 처음엔 보기 A 위에 있다
      shape('wa_box', '{{answer}}', 500000, 2000000),
    ]),
    slide('t_card', 'word_card', [shape('card_w', '{{word}} 단어 {{n}}/4', 0, 0), shape('card_img', '{{image}}', 0, 600000), shape('card_ex', '{{example}}', 0, 1200000)]),
  ];
  return { presentationId: 'p1', slides };
}
const wordPlan = () => {
  const [a] = lesson1();
  return C.planSlides(a).filter((p) => p.type.startsWith('word_'));
};

test('템플릿 점검: 빠진 유형과 이상한 토큰', () => {
  const r = B.checkTemplate(fakeTemplate(), ['word_q', 'word_a', 'quiz_mc_q']);
  assert.deepEqual(r.missing, ['quiz_mc_q']);
  assert.deepEqual(r.found.sort(), ['word_a', 'word_card', 'word_q']);
  assert.deepEqual(r.unknownTokens, {});
});

test('없는 유형이 계획에 있으면 생성 전에 멈춘다', () => {
  const [a] = lesson1();
  assert.throws(() => B.buildRequests(fakeTemplate(), C.planSlides(a)), /템플릿에 없는 슬라이드 유형/);
});

test('요청 만들기: 복제 → 글자 → 강조 → 정답 박스 이동 → 순서 → 원본 삭제', () => {
  const plan = wordPlan();
  const out = B.buildRequests(fakeTemplate(), plan, { highlightColor: '#e53935' });
  const r = out.requests;
  assert.equal(r.filter((x) => x.duplicateObject).length, plan.length);
  // 복제가 가장 먼저, 원본 삭제가 가장 마지막
  assert.ok(r[0].duplicateObject);
  assert.equal(r.slice(-3).every((x) => x.deleteObject), true);
  // 글자 바꾸기는 그 슬라이드에만
  const rep = r.find((x) => x.replaceAllText && x.replaceAllText.containsText.text === '{{sentence}}');
  assert.deepEqual(rep.replaceAllText.pageObjectIds, ['auto_0_s']);
  assert.equal(rep.replaceAllText.replaceText, 'The robot kneads the dough for ten minutes.');
  // 강조 위치: 'Q. "knead" → ' 뒤의 kneads
  const st = r.find((x) => x.updateTextStyle && x.updateTextStyle.objectId === 'auto_0_0');
  const prefix = 'Q. "knead" → ';
  assert.equal(st.updateTextStyle.textRange.startIndex, prefix.length + 10);
  assert.equal(st.updateTextStyle.textRange.endIndex, prefix.length + 16);
  // 정답 박스: 단어 2의 정답은 ②(c2) → 오른쪽으로 2,900,000 EMU 이동
  const wa2 = plan.findIndex((p, i) => p.type === 'word_a' && i > 2);
  const mv = r.filter((x) => x.updatePageElementTransform).find((x) => x.updatePageElementTransform.objectId.startsWith(`auto_${wa2}_`));
  assert.equal(mv.updatePageElementTransform.transform.translateX, 2900000);
  assert.equal(mv.updatePageElementTransform.transform.translateY, 0);
  // 단어 1의 정답은 ①(c1) → 이미 제자리라 이동 없음
  const wa1 = plan.findIndex((p) => p.type === 'word_a');
  assert.equal(r.filter((x) => x.updatePageElementTransform && x.updatePageElementTransform.objectId.startsWith(`auto_${wa1}_`)).length, 0);
  // 이미지는 따로
  assert.equal(out.imageJobs.length, 2);
  assert.equal(r.some((x) => x.replaceAllText && x.replaceAllText.containsText.text === '{{image}}'), false);
  // 순서
  const pos = r.filter((x) => x.updateSlidesPosition);
  assert.deepEqual(pos.map((x) => x.updateSlidesPosition.insertionIndex), plan.map((_, i) => i));
});

test('발표자 노트의 #유형 표시만 지운다', () => {
  const reqs = B.notesCleanupRequests(fakeTemplate());
  assert.equal(reqs.length, 3);
  assert.deepEqual(reqs[0].deleteText.textRange, { type: 'FIXED_RANGE', startIndex: 0, endIndex: '#word_q\n'.length });
});
