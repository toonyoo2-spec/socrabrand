/*
 * PPT 자동화 코어
 * 커리큘럼 시트 행 → 강의 데이터(JSON) → 검수 → 슬라이드 계획
 * 브라우저(ppt-automation.html)와 Node 테스트에서 같이 쓴다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PPTCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 슬라이드 유형 (템플릿의 각 원본 슬라이드 발표자 노트에 #유형 으로 표시)
  // tokens: 그 슬라이드에서 쓸 수 있는 {{토큰}}
  // choices: 정답 강조 박스를 옮길 때 기준이 되는 보기 토큰
  // ---------------------------------------------------------------------------
  const C4 = ['c1', 'c2', 'c3', 'c4'];
  const SLIDE_TYPES = {
    greet:            { name: '인사', group: '안내', tokens: [] },
    trivia_intro:     { name: '흥미 유발 퀴즈 안내', group: '안내', tokens: [] },
    trivia_q:         { name: 'Trivia 문제', group: 'Trivia', tokens: ['q', ...C4] },
    trivia_a:         { name: 'Trivia 정답', group: 'Trivia', tokens: ['q', ...C4, 'answer', 'letter'], choices: C4 },
    video:            { name: '영상 시청 안내', group: '안내', tokens: [] },
    words_intro:      { name: '단어 안내', group: '안내', tokens: [] },
    word_q:           { name: 'Word Check 문제', group: 'Word Check', tokens: ['n', 'word', 'sentence', ...C4] },
    word_a:           { name: 'Word Check 정답', group: 'Word Check', tokens: ['n', 'word', 'sentence', ...C4, 'answer', 'letter'], choices: C4 },
    word_card:        { name: 'Word Check 뜻·예문', group: 'Word Check', tokens: ['n', 'word', 'meaning', 'example', 'image'] },
    script_intro:     { name: '스크립트 안내', group: '안내', tokens: [] },
    script_text:      { name: '스크립트 본문', group: 'Script', tokens: ['s', 'script'] },
    script_q:         { name: '표현 질문', group: 'Script', tokens: ['s', 'script', 'expression', 'question'] },
    script_a:         { name: '표현 정답', group: 'Script', tokens: ['s', 'script', 'expression', 'question', 'answer'] },
    grammar_1:        { name: '문법 (문장)', group: 'Grammar', tokens: ['s', 'sentence', 'pattern', 'explanation'] },
    grammar_2:        { name: '문법 (+예문1)', group: 'Grammar', tokens: ['s', 'sentence', 'pattern', 'explanation', 'ex1'] },
    grammar_3:        { name: '문법 (+예문2)', group: 'Grammar', tokens: ['s', 'sentence', 'pattern', 'explanation', 'ex1', 'ex2'] },
    wordwall:         { name: '워드월 안내', group: 'Practice', tokens: ['s', 'code'] },
    practice_fill_q:  { name: '연습 빈칸 문제', group: 'Practice', tokens: ['s', 'k', 'kk', 'instruction', 'pattern', 'explanation', 'prompt'] },
    practice_fill_a:  { name: '연습 빈칸 정답', group: 'Practice', tokens: ['s', 'k', 'kk', 'instruction', 'pattern', 'explanation', 'prompt', 'answer'] },
    practice_order_q: { name: '연습 배열 문제', group: 'Practice', tokens: ['s', 'k', 'kk', 'instruction', 'pattern', 'explanation', 'prompt'] },
    practice_order_a: { name: '연습 배열 정답', group: 'Practice', tokens: ['s', 'k', 'kk', 'instruction', 'pattern', 'explanation', 'prompt', 'answer'] },
    practice_mc_q:    { name: '연습 4지선다 문제', group: 'Practice', tokens: ['s', 'k', 'kk', 'instruction', 'pattern', 'explanation', 'prompt', ...C4] },
    practice_mc_a:    { name: '연습 4지선다 정답', group: 'Practice', tokens: ['s', 'k', 'kk', 'instruction', 'pattern', 'explanation', 'prompt', ...C4, 'answer', 'letter'], choices: C4 },
    comp_tf_q:        { name: '독해 T/F 문제', group: 'Comprehension', tokens: ['s', 'k', 'kk', 'statement'] },
    comp_tf_a:        { name: '독해 T/F 정답', group: 'Comprehension', tokens: ['s', 'k', 'kk', 'statement', 'answer'] },
    comp_lie_q:       { name: '독해 Two Truths 문제', group: 'Comprehension', tokens: ['s', 'instruction', 'st1', 'st2', 'st3'] },
    comp_lie_a:       { name: '독해 Two Truths 정답', group: 'Comprehension', tokens: ['s', 'instruction', 'st1', 'st2', 'st3', 'answer', 'lieNo', 'explanation'], choices: ['st1', 'st2', 'st3'] },
    comp_order_q:     { name: '독해 순서 배열 문제', group: 'Comprehension', tokens: ['s', 'instruction', 'ev1', 'ev2', 'ev3', 'ev4'] },
    comp_order_a:     { name: '독해 순서 배열 정답', group: 'Comprehension', tokens: ['s', 'instruction', 'ev1', 'ev2', 'ev3', 'ev4', 'ord1', 'ord2', 'ord3', 'ord4', 'num1', 'num2', 'num3', 'num4'] },
    quiz_intro:       { name: '퀴즈앤 안내', group: 'Quiz', tokens: ['code'] },
    quiz_mc_q:        { name: '퀴즈 4지선다 문제', group: 'Quiz', tokens: ['k', 'kk', 'instruction', 'prompt', ...C4] },
    quiz_mc_a:        { name: '퀴즈 4지선다 정답', group: 'Quiz', tokens: ['k', 'kk', 'instruction', 'prompt', ...C4, 'answer', 'letter'], choices: C4 },
    quiz_fill_q:      { name: '퀴즈 빈칸 문제', group: 'Quiz', tokens: ['k', 'kk', 'instruction', 'prompt'] },
    quiz_fill_a:      { name: '퀴즈 빈칸 정답', group: 'Quiz', tokens: ['k', 'kk', 'instruction', 'prompt', 'answer'] },
    quiz_order_q:     { name: '퀴즈 배열 문제', group: 'Quiz', tokens: ['k', 'kk', 'instruction', 'prompt'] },
    quiz_order_a:     { name: '퀴즈 배열 정답', group: 'Quiz', tokens: ['k', 'kk', 'instruction', 'prompt', 'answer'] },
    headline_intro:   { name: '헤드라인 안내', group: '안내', tokens: [] },
    headline_rewatch: { name: '헤드라인 영상 재시청', group: '안내', tokens: [] },
    headline_q:       { name: '헤드라인 작성 (채팅)', group: 'Headline', tokens: [] },
    headline_a:       { name: '헤드라인 예시', group: 'Headline', tokens: ['headline'] },
  };
  // 모든 슬라이드에서 쓸 수 있는 공통 토큰
  const GLOBAL_TOKENS = ['no', 'week', 'date', 'day', 'title', 'titleKo', 'series'];
  const LETTERS = ['A', 'B', 'C', 'D', 'E'];

  // 시트 Ex 행(작성 가이드)의 글자 수 규칙
  const LIMITS = {
    wordSentence: 150, wordChoice: 35, wordExample: 80,
    question: 45, answer1: 45, answer23: 80,
    grammarSentence: 130, explanation1: 100, explanation23: 80, grammarExample: 90,
    practiceSentence: 90, practiceOption: 50, compStatement: 70, headline: 60,
  };

  // ---------------------------------------------------------------------------
  // CSV
  // ---------------------------------------------------------------------------
  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', i = 0, quoted = false;
    text = String(text || '').replace(/^\uFEFF/, '');
    while (i < text.length) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          quoted = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { quoted = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function colLetter(i) {
    let s = ''; i += 1;
    while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }

  // ---------------------------------------------------------------------------
  // 머리글 → 열 위치 (열이 앞뒤로 밀려도 이름으로 찾는다)
  // ---------------------------------------------------------------------------
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  function mapColumns(rows) {
    const h2Row = rows.findIndex((r) => r.some((c) => norm(c) === 'No.'));
    if (h2Row < 1) throw new Error('머리글 행(No.)을 찾지 못했습니다. 커리큘럼 시트가 맞는지 확인해 주세요.');
    const gRow = rows[h2Row - 1] || [], hRow = rows[h2Row] || [], sRow = rows[h2Row + 1] || [];
    const width = Math.max(gRow.length, hRow.length, sRow.length);
    const cols = {};
    let g = '', h = '';
    for (let c = 0; c < width; c++) {
      if (norm(gRow[c])) { g = norm(gRow[c]); h = ''; }
      if (norm(hRow[c])) h = norm(hRow[c]);
      const s = norm(sRow[c]);
      const set = (key) => { if (!(key in cols)) cols[key] = c; };
      if (h === 'No.') set('no');
      else if (h === 'Week') set('week');
      else if (s === 'Date') set('date');
      else if (s === 'Day') set('day');
      else if (h === 'Lesson Title (KOR)') set('titleKo');
      else if (h === 'Lesson Title (ENG)') set('titleEn');
      else if (h === 'Lesson Objectives') set('objective');
      else if (h === 'Thumbnail IMG') set('thumbnail');
      else if (s === 'Video Link') set('videoLink');
      else if (s === 'Time Code') set('timeCode');
      else if (/^Trivia/i.test(g)) set('trivia');
      else if (h === 'Vocabulary') set('words');
      else if (h === 'From the Script') set('wordSentences');
      else if (h === 'Answer Choices') set('wordChoices');
      else if (h === 'New Example') set('wordExamples');
      else if (/^Word Check/i.test(g) && /IMG/i.test(h)) set('wordImages');
      else if (/^Quiz Time/i.test(g)) set('quiz');
      else if (g === 'My Headline') set('headline');
      else if (/^My Headline IMG/i.test(g)) set('headlineImg');
      else if (g === 'PPT') set('ppt');
      else {
        let m;
        if ((m = h.match(/^Script (\d)$/))) set('script' + m[1]);
        else if ((m = h.match(/^Analysis (\d)$/))) {
          if (s === 'Expression') set('expr' + m[1]);
          else if (s === 'Question') set('question' + m[1]);
          else if (s === 'Answer') set('answer' + m[1]);
        } else if ((m = h.match(/^Grammar (\d)$/))) {
          if (s === 'Script Sentence') set('gSentence' + m[1]);
          else if (s === 'Pattern') set('gPattern' + m[1]);
          else if (s === 'Explanation') set('gExplain' + m[1]);
          else if (s === 'Example') set('gExample' + m[1]);
          else if (/^Practice/i.test(s)) set('practice' + m[1]);
        } else if ((m = (h || s).match(/^Comprehension (\d)/))) set('comp' + m[1]);
        else if ((m = s.match(/^Comprehension Practice/)) && /Comprehension (\d)/.test(h)) set('comp' + h.match(/(\d)/)[1]);
      }
    }
    const required = ['no', 'titleEn', 'words', 'script1', 'quiz'];
    const missing = required.filter((k) => !(k in cols));
    if (missing.length) throw new Error('필수 열을 찾지 못했습니다: ' + missing.join(', '));
    return { cols, headerEnd: h2Row + 1 };
  }

  // 시트 전체(행 배열) → 강의 목록
  function readLessons(rows, opts) {
    opts = opts || {};
    const { cols, headerEnd } = mapColumns(rows);
    const lessons = [];
    for (let r = headerEnd + 1; r < rows.length; r++) {
      const row = rows[r];
      const no = norm(row[cols.no]);
      if (!/^\d+$/.test(no)) continue;
      const lesson = parseLesson(row, cols, { links: opts.links ? opts.links[r] : null, rowIndex: r });
      lessons.push(lesson);
    }
    return { cols, lessons };
  }

  // ---------------------------------------------------------------------------
  // 문자열 도우미
  // ---------------------------------------------------------------------------
  const CHECK_RE = /\s*(?:✅|✔️?|☑️?)\s*/g;
  const hasCheck = (s) => /✅|✔|☑/.test(s);
  const stripCheck = (s) => s.replace(CHECK_RE, ' ').replace(/\s+$/, '').replace(/^\s+/, '');
  function clean(s) {
    return String(s == null ? '' : s).replace(/\r/g, '').replace(/\u00a0/g, ' ')
      .split('\n').map((l) => l.replace(/\s+$/, '')).join('\n')
      .replace(/^\s*\n+/, '').replace(/\n+\s*$/, '').trim();
  }
  const oneLine = (s) => s.replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim();
  const squash = (s) => s.replace(/[ \t]{2,}/g, ' ').trim();

  // "1." "01." "1)" 로 시작하는 번호 목록. 번호가 1부터 차례로 늘 때만 새 항목으로 본다.
  function splitNumbered(text) {
    const out = { pre: [], items: [] };
    for (const raw of clean(text).split('\n')) {
      const m = raw.match(/^\s*#?0?(\d{1,2})\s*[.)](?:\s+|$)(.*)$/);
      if (m && Number(m[1]) === out.items.length + 1) {
        out.items.push({ num: Number(m[1]), head: m[2].trim(), body: [] });
      } else if (out.items.length) {
        out.items[out.items.length - 1].body.push(raw);
      } else {
        out.pre.push(raw);
      }
    }
    out.pre = out.pre.filter((l) => l.trim());
    out.items.forEach((it) => {
      while (it.body.length && !it.body[it.body.length - 1].trim()) it.body.pop();
    });
    return out;
  }
  // 항목 전체 텍스트 (줄바꿈은 시트에서 일부러 넣은 것이므로 유지)
  const itemText = (it) => [it.head, ...it.body].filter((l) => l.trim()).map((l) => l.trim()).join('\n');

  // "A) x B) y ✅ C) z" 같이 한 줄에 여러 보기가 있어도 A→B→C→D 순서로 잘라낸다
  function parseLetterChoices(line) {
    const choices = [];
    let pos = 0;
    const re = (L) => new RegExp('(^|\\s)\\(?' + L + '\\s*[).]\\s*', 'g');
    const starts = [];
    // 줄마다 보기가 하나씩 있으면 B), C)… 로 시작하므로 첫 글자부터 차례로 찾는다
    const first = LETTERS.indexOf((line.match(/^\s*\(?([A-E])/) || [])[1]);
    for (let k = Math.max(first, 0); k < 5; k++) {
      const r = re(LETTERS[k]); r.lastIndex = pos;
      const m = r.exec(line);
      if (!m) break;
      if (!starts.length && line.slice(0, m.index).trim()) break;
      starts.push({ at: m.index + m[1].length, textAt: m.index + m[0].length });
      pos = m.index + m[0].length;
    }
    for (let k = 0; k < starts.length; k++) {
      const seg = line.slice(starts[k].textAt, k + 1 < starts.length ? starts[k + 1].at : undefined);
      choices.push({ text: squash(stripCheck(seg)), correct: hasCheck(seg) });
    }
    return choices;
  }
  const isLetterChoiceLine = (l) => /^\s*\(?[A-E]\s*[).]\s*\S/.test(l) || /^\s*\(?[A-E]\s*[).]\s*$/.test(l);
  const isCircledLine = (l) => /^\s*[①②③④⑤]/.test(l);
  const circledText = (l) => l.replace(/^\s*[①②③④⑤]\s*/, '');
  const ANSWER_RE = /^\s*(?:A|Ans|Answer|답|정답|Correct answer)\s*[:：]\s*(.*)$/i;
  const INSTRUCTION_RE = /^(choose|complete|put|fill|select|rearrange|unscramble|write|circle|match|find|use)\b/i;

  // ---------------------------------------------------------------------------
  // 문항 하나 (연습·퀴즈 공통): 지시문 / 문장 / 보기 / 정답
  // ---------------------------------------------------------------------------
  function parseQuestion(rawLines, issue) {
    const lines = [];
    rawLines.map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim()).forEach((l) => {
      // "…the blank. A)Originally ✅" 처럼 문장 끝에 붙은 보기는 떼어 낸다
      const m = l.match(/^(.*\S)\s+(\(?A\)\s*\S.*)$/);
      if (m && !isLetterChoiceLine(l)) { lines.push(m[1], m[2]); } else lines.push(l);
    });
    let instruction = '', answer = null, choices = [];
    const prompt = [];
    for (const line of lines) {
      const am = line.match(ANSWER_RE);
      if (am) { answer = am[1].replace(/^\s*→\s*/, '').trim(); continue; }
      if (isLetterChoiceLine(line)) { choices.push(...parseLetterChoices(line.trim())); continue; }
      if (isCircledLine(line)) { const t = circledText(line); choices.push({ text: squash(stripCheck(t)), correct: hasCheck(t) }); continue; }
      prompt.push(line.trim());
    }
    // 같은 줄 화살표 정답: "... (dig) → is digging"
    if (answer == null && prompt.length) {
      const last = prompt[prompt.length - 1];
      const i = last.lastIndexOf('→');
      if (i > 0) { answer = last.slice(i + 1).trim(); prompt[prompt.length - 1] = last.slice(0, i).trim(); }
    }
    if (prompt.length > 1 && INSTRUCTION_RE.test(prompt[0])) instruction = prompt.shift();
    else if (prompt.length === 1 && INSTRUCTION_RE.test(prompt[0]) && /[.!]$/.test(prompt[0]) && !/_{2,}/.test(prompt[0]) && !choices.length) {
      instruction = prompt.shift();
    }
    let text = prompt.join('\n');

    // 괄호 안 보기: "( highest / high / higher / more high)" + "A: higher"
    if (!choices.length && answer) {
      const pm = text.match(/\(([^()]*\/[^()]*)\)\s*$/);
      if (pm) {
        const parts = pm[1].split('/').map((p) => squash(p)).filter(Boolean);
        const idx = parts.findIndex((p) => p.toLowerCase() === answer.toLowerCase());
        if (parts.length >= 3 && idx >= 0) {
          choices = parts.map((p, k) => ({ text: p, correct: k === idx }));
          text = text.slice(0, pm.index).trim();
        }
      }
    }

    let answerIndex = -1;
    if (choices.length) {
      const checked = choices.map((c, k) => (c.correct ? k : -1)).filter((k) => k >= 0);
      if (checked.length > 1) issue('error', '정답 표시(✅)가 ' + checked.length + '개입니다');
      if (checked.length) answerIndex = checked[0];
      if (answer) {
        const lm = answer.match(/^([A-E])(?:\s*[).]\s*(.*)|\s*$)/);
        let byAnswer = -1;
        if (lm && LETTERS.indexOf(lm[1]) < choices.length) byAnswer = LETTERS.indexOf(lm[1]);
        if (byAnswer < 0) byAnswer = choices.findIndex((c) => c.text.toLowerCase() === answer.toLowerCase());
        if (answerIndex < 0) answerIndex = byAnswer;
        else if (byAnswer >= 0 && byAnswer !== answerIndex) issue('error', '✅ 표시와 정답 줄이 서로 다릅니다');
      }
      if (answerIndex < 0) issue('error', '정답 표시가 없습니다 (✅ 또는 A: 정답)');
      if (choices.length !== 4) issue('warn', '보기가 ' + choices.length + '개입니다 (4개 기준)');
      answer = answerIndex >= 0 ? choices[answerIndex].text : answer;
    }
    let kind;
    if (choices.length >= 2) kind = 'mc';
    else if ((text.match(/ \/ |\/ | \//g) || []).length >= 2 && !/_{2,}/.test(text)) kind = 'order';
    else kind = 'fill';
    if (!answer) issue('error', '정답이 없습니다');
    if (kind === 'fill' && !/_{2,}/.test(text)) issue('warn', '빈칸(___)이 보이지 않습니다');
    if (!text) issue('error', '문제 문장이 비어 있습니다');
    return { kind, instruction, prompt: text, choices: choices.map((c) => c.text), answerIndex, answer: answer || '' };
  }

  // ---------------------------------------------------------------------------
  // 강조할 표현 찾기 (launch → launched, carve → carving, "take ~ off" 등)
  // 결과는 값 문자열 안의 [시작, 끝) 범위 목록. 못 찾으면 null.
  // ---------------------------------------------------------------------------
  function phraseRegexSource(part) {
    const words = part.trim().split(/\s+/).filter(Boolean);
    return words.map((w) => {
      const core = w.replace(/^[^\w']+|[^\w']+$/g, '');
      if (!core) return null;
      let stem = core;
      if (core.length >= 4) stem = core.replace(/(e|y)$/i, '');
      const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]");
      return core.length >= 3 ? esc + "[a-z'’]*" : esc;
    }).filter(Boolean).join("[\\s,.'’\"-]+");
  }
  function findPhrase(text, phrase) {
    if (!text || !phrase) return null;
    // "~", "...", 자리표시 A/B("turning A into B")는 떨어진 구간으로 나눠 각각 강조
    const parts = String(phrase).split(/\s*(?:~|\.{2,}|…)\s*|\s+[AB](?=\s|$)\s*/).filter((p) => p && p.trim());
    if (!parts.length) return null;
    const found = matchParts(text, parts);
    if (found) return found;
    // "a decade's worth of" ↔ "that decade's worth of": 맨 앞 관사는 빼고 다시 찾기
    const noArticle = parts.slice();
    noArticle[0] = noArticle[0].replace(/^(a|an|the)\s+/i, '');
    return noArticle[0] !== parts[0] ? matchParts(text, noArticle) : null;
  }
  function matchParts(text, parts) {
    // 1차: 그대로(대소문자 무시) 찾기
    const ranges = [];
    let from = 0;
    for (const part of parts) {
      const src = phraseRegexSource(part);
      if (!src) continue;
      const re = new RegExp('(^|[^A-Za-z])(' + src + ')', 'gi');
      re.lastIndex = from;
      const m = re.exec(text);
      if (!m) return null;
      const start = m.index + m[1].length;
      ranges.push([start, start + m[2].length]);
      from = start + m[2].length;
    }
    return ranges.length ? ranges : null;
  }

  // ---------------------------------------------------------------------------
  // 강의 한 행 해석
  // ---------------------------------------------------------------------------
  function parseLesson(row, cols, meta) {
    meta = meta || {};
    const issues = [];
    const get = (key) => (key in cols ? clean(row[cols[key]]) : '');
    const issuer = (key, where) => (level, msg) => issues.push({ level, col: key in cols ? colLetter(cols[key]) : '', key, where, msg });

    const no = Number(norm(row[cols.no]));
    const date = get('date');
    const lesson = {
      no, week: get('week'), date, day: get('day'),
      dateMMDD: formatMMDD(date),
      titleKo: get('titleKo'), titleEn: get('titleEn'), objective: get('objective'),
      thumbnail: get('thumbnail'), videoLink: get('videoLink'), timeCode: get('timeCode'),
      pptLink: meta.links && 'ppt' in cols ? meta.links[cols.ppt] || '' : '',
      empty: false, issues,
    };
    const filled = ['words', 'script1', 'quiz'].filter((k) => get(k)).length;
    if (!filled) { lesson.empty = true; return lesson; }

    lesson.trivia = parseTrivia(get('trivia'), issuer('trivia', 'Trivia'));
    lesson.words = parseWords(get, issuer);
    lesson.scripts = [1, 2, 3].map((s) => parseScript(s, get, issuer));
    lesson.quiz = parseQuiz(get('quiz'), issuer('quiz', '퀴즈앤'));
    lesson.headline = oneLine(get('headline'));
    if (!lesson.headline) issuer('headline', 'My Headline')('error', '헤드라인이 비어 있습니다');
    else if (lesson.headline.length > LIMITS.headline) issuer('headline', 'My Headline')('warn', `${lesson.headline.length}자 (최대 ${LIMITS.headline}자)`);
    return lesson;
  }

  function formatMMDD(d) {
    const m = String(d || '').match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})/);
    return m ? m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') : '';
  }

  function parseTrivia(text, issue) {
    const out = { question: '', choices: [], answerIndex: -1 };
    if (!text) { issue('error', '비어 있습니다'); return out; }
    const lines = text.split('\n');
    let mode = 'pre';
    const q = [], ch = [];
    for (const raw of lines) {
      const l = raw.trim();
      let m;
      if ((m = l.match(/^Q\s*[).:]\s*(.*)$/i))) { mode = 'q'; if (m[1]) q.push(m[1]); continue; }
      if ((m = l.match(/^A\s*[).:]\s*(.*)$/i)) && mode !== 'a') { mode = 'a'; if (m[1].trim()) ch.push(m[1]); continue; }
      if (!l) continue;
      if (mode === 'a') ch.push(l); else q.push(l);
    }
    out.question = q.join(' ').trim();
    out.choices = ch.map((c) => squash(stripCheck(c)));
    out.answerIndex = ch.findIndex(hasCheck);
    if (!out.question) issue('error', '질문이 없습니다');
    if (out.choices.length !== 4) issue('warn', `보기가 ${out.choices.length}개입니다 (4개 기준)`);
    if (out.answerIndex < 0) issue('error', '정답 표시(✅)가 없습니다');
    if (ch.filter(hasCheck).length > 1) issue('error', '정답 표시(✅)가 여러 개입니다');
    return out;
  }

  function parseWords(get, issuer) {
    const W = splitNumbered(get('words')).items.map((it) => oneLine(itemText(it)));
    const P = splitNumbered(get('wordSentences')).items.map((it) => oneLine(itemText(it)));
    const Q = splitNumbered(get('wordChoices')).items;
    const R = splitNumbered(get('wordExamples')).items;
    const S = splitNumbered(get('wordImages')).items.map((it) => (itemText(it).match(/https?:\/\/\S+/) || [''])[0]);
    const n = Math.max(W.length, P.length, Q.length, R.length);
    if (W.length !== 4) issuer('words', 'Word Check')('warn', `단어가 ${W.length}개입니다 (4개 기준)`);
    const words = [];
    for (let k = 0; k < n; k++) {
      const where = `단어 ${k + 1}`;
      const word = W[k] || '';
      const sentence = P[k] || '';
      const qi = Q[k];
      const choiceLines = qi ? [qi.head, ...qi.body].filter((l) => isCircledLine(l)) : [];
      const choicesRaw = choiceLines.map(circledText);
      const choices = choicesRaw.map((c) => squash(stripCheck(c)));
      const answerIndex = choicesRaw.findIndex(hasCheck);
      let example = '';
      const ri = R[k];
      if (ri) {
        const body = ri.body.filter((l) => l.trim()).map((l) => l.trim());
        const headIsWord = body.length && ri.head && ri.head.split(/\s+/).length <= 4 && !/[.!?]$/.test(ri.head);
        example = headIsWord ? body.join('\n') : itemText(ri);
      }
      const w = { word, sentence, choices, answerIndex, meaning: answerIndex >= 0 ? choices[answerIndex] : '', example, image: S[k] || '' };
      w.sentenceHighlight = findPhrase(sentence, word);
      w.exampleHighlight = findPhrase(example, word);
      if (!word) issuer('words', where)('error', '단어가 비어 있습니다');
      if (!sentence) issuer('wordSentences', where)('error', '원문 문장이 없습니다');
      else {
        if (sentence.length > LIMITS.wordSentence) issuer('wordSentences', where)('warn', `${sentence.length}자 (최대 ${LIMITS.wordSentence}자)`);
        if (word && !w.sentenceHighlight) issuer('wordSentences', where)('warn', `문장에서 "${word}"을(를) 못 찾아 강조할 수 없습니다`);
      }
      if (choices.length !== 4) issuer('wordChoices', where)('error', `보기가 ${choices.length}개입니다 (①~④ 4개 필요)`);
      if (answerIndex < 0) issuer('wordChoices', where)('error', '정답 표시(✅)가 없습니다');
      if (choicesRaw.filter(hasCheck).length > 1) issuer('wordChoices', where)('error', '정답 표시(✅)가 여러 개입니다');
      choices.forEach((c, j) => { if (c.length > LIMITS.wordChoice) issuer('wordChoices', where)('warn', `보기 ${j + 1}: ${c.length}자 (최대 ${LIMITS.wordChoice}자)`); });
      if (!example) issuer('wordExamples', where)('error', '예문이 없습니다');
      else if (oneLine(example).length > LIMITS.wordExample) issuer('wordExamples', where)('warn', `예문 ${oneLine(example).length}자 (최대 ${LIMITS.wordExample}자)`);
      if (!w.image) issuer('wordImages', where)('warn', '이미지 링크가 없습니다');
      words.push(w);
    }
    return words;
  }

  function parseScript(s, get, issuer) {
    const label = `Script ${s}`;
    const text = oneLine(get('script' + s));
    if (!text) issuer('script' + s, label)('error', '스크립트가 비어 있습니다');
    // 표현 분석
    const E = splitNumbered(get('expr' + s)).items.map((it) => oneLine(itemText(it)));
    const Qs = splitNumbered(get('question' + s)).items.map((it) => oneLine(itemText(it)));
    const A = splitNumbered(get('answer' + s)).items.map((it) => oneLine(itemText(it)));
    const n = Math.max(E.length, Qs.length, A.length);
    if (!(E.length === Qs.length && Qs.length === A.length)) issuer('expr' + s, label)('error', `표현 ${E.length}개 / 질문 ${Qs.length}개 / 정답 ${A.length}개 — 개수가 맞지 않습니다`);
    if (n < 2 || n > 3) issuer('expr' + s, label)('warn', `표현이 ${n}개입니다 (2~3개 기준)`);
    const aLimit = s === 1 ? LIMITS.answer1 : LIMITS.answer23;
    const expressions = [];
    for (let k = 0; k < n; k++) {
      const where = `${label} 표현 ${k + 1}`;
      const e = { expression: E[k] || '', question: Qs[k] || '', answer: A[k] || '' };
      e.highlight = findPhrase(text, e.expression);
      if (e.expression && text && !e.highlight) issuer('expr' + s, where)('warn', `본문에서 "${e.expression}"을(를) 못 찾아 강조할 수 없습니다`);
      if (e.question.length > LIMITS.question) issuer('question' + s, where)('warn', `질문 ${e.question.length}자 (최대 ${LIMITS.question}자)`);
      if (e.answer.length > aLimit) issuer('answer' + s, where)('warn', `정답 ${e.answer.length}자 (최대 ${aLimit}자)`);
      if (!e.answer) issuer('answer' + s, where)('error', '정답이 없습니다');
      expressions.push(e);
    }
    // 문법
    const gEx = splitNumbered(get('gExample' + s)).items.map(itemText);
    const grammar = { sentence: get('gSentence' + s), pattern: oneLine(get('gPattern' + s)), explanation: get('gExplain' + s), examples: gEx };
    const gw = `${label} 문법`;
    if (!grammar.sentence) issuer('gSentence' + s, gw)('error', '문법 예시 문장이 없습니다');
    else if (oneLine(grammar.sentence).length > LIMITS.grammarSentence) issuer('gSentence' + s, gw)('warn', `${oneLine(grammar.sentence).length}자 (최대 ${LIMITS.grammarSentence}자)`);
    if (!grammar.pattern) issuer('gPattern' + s, gw)('error', '패턴이 없습니다');
    const eLimit = s === 1 ? LIMITS.explanation1 : LIMITS.explanation23;
    if (oneLine(grammar.explanation).length > eLimit) issuer('gExplain' + s, gw)('warn', `설명 ${oneLine(grammar.explanation).length}자 (최대 ${eLimit}자)`);
    if (gEx.length !== 2) issuer('gExample' + s, gw)('warn', `예문이 ${gEx.length}개입니다 (2개 기준)`);
    gEx.forEach((x, j) => { if (oneLine(x).length > LIMITS.grammarExample) issuer('gExample' + s, gw)('warn', `예문 ${j + 1}: ${oneLine(x).length}자 (최대 ${LIMITS.grammarExample}자)`); });
    // 연습 문제
    const pr = splitNumbered(get('practice' + s));
    const practice = { instruction: pr.pre.map((l) => l.trim()).join(' '), items: [] };
    pr.items.forEach((it, k) => {
      const where = `${label} 연습 ${k + 1}`;
      const q = parseQuestion([it.head, ...it.body], issuer('practice' + s, where));
      if (!q.instruction) q.instruction = practice.instruction;
      const full = q.kind === 'order' ? q.answer : q.prompt;
      if (oneLine(full || '').length > LIMITS.practiceSentence) issuer('practice' + s, where)('warn', `문장 ${oneLine(full).length}자 (최대 ${LIMITS.practiceSentence}자)`);
      q.choices.forEach((c, j) => { if (c.length > LIMITS.practiceOption) issuer('practice' + s, where)('warn', `보기 ${j + 1}: ${c.length}자 (최대 ${LIMITS.practiceOption}자)`); });
      practice.items.push(q);
    });
    if (!practice.items.length) issuer('practice' + s, `${label} 연습`)('error', '연습 문제가 없습니다');
    else if (practice.items.length !== 3) issuer('practice' + s, `${label} 연습`)('warn', `연습 문제가 ${practice.items.length}개입니다 (3개 기준)`);
    if (!practice.instruction && practice.items.some((q) => !q.instruction)) issuer('practice' + s, `${label} 연습`)('warn', '지시문이 없습니다');
    // 독해
    const comprehension = parseComprehension(get('comp' + s), issuer('comp' + s, `${label} 독해`));
    return { text, expressions, grammar, practice, comprehension };
  }

  function parseComprehension(text, issue) {
    if (!text) { issue('error', '비어 있습니다'); return { kind: 'none', items: [] }; }
    const sp = splitNumbered(text);
    const instruction = sp.pre.map((l) => l.trim()).join(' ');
    const allLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const arrowLine = allLines.find((l) => (l.match(/→/g) || []).length >= 2 && /\d\s*→\s*\d/.test(l));
    if (/\blie\b/i.test(instruction)) return parseLie(sp, instruction, issue);
    if (/order/i.test(instruction) || arrowLine) return parseOrder(sp, instruction, arrowLine, issue);
    // True / False
    const items = sp.items.map((it, k) => {
      const t = oneLine(itemText(it));
      let m = t.match(/^(.*?)\s*(?:>|→|->|=>)\s*(True|False|T|F)\.?\s*$/i) || t.match(/^(.*?)\s*\((True|False)\)\s*$/i);
      if (!m) { issue('error', `${k + 1}번 문장에 True/False 정답이 없습니다`); return { statement: t, answer: '' }; }
      const ans = /^t/i.test(m[2]) ? 'True' : 'False';
      if (m[1].length > LIMITS.compStatement) issue('warn', `${k + 1}번 ${m[1].length}자 (최대 ${LIMITS.compStatement}자)`);
      return { statement: m[1].trim(), answer: ans };
    });
    if (items.length !== 2) issue('warn', `문장이 ${items.length}개입니다 (T/F 2개 기준)`);
    return { kind: 'tf', instruction, items };
  }

  function parseLie(sp, instruction, issue) {
    const statements = [];
    let marked = -1, lieIndex = -1, explanation = '';
    const answerLines = [];
    sp.items.forEach((it, k) => {
      const lines = [it.head, ...it.body].map((l) => l.trim()).filter(Boolean);
      const own = [];
      for (const l of lines) { if (ANSWER_RE.test(l) || /^(Correct|정답)/i.test(l)) answerLines.push(l); else own.push(l); }
      let t = own.join(' ');
      const ann = t.match(/\s*\((True|LIE|Lie|false)([^)]*)\)\s*$/);
      if (ann) {
        if (/lie|false/i.test(ann[1])) { marked = k; explanation = ann[2].replace(/^\s*[—–-]\s*/, '').trim() || explanation; }
        t = t.slice(0, ann.index).trim();
      }
      statements.push(t);
    });
    sp.pre.forEach((l) => { if (ANSWER_RE.test(l)) answerLines.push(l); });
    const ansText = answerLines.map((l) => l.replace(ANSWER_RE, '$1')).join(' ');
    if (ansText) {
      const m = ansText.match(/#?\s*([1-9])\b/);
      if (m) lieIndex = Number(m[1]) - 1;
      const ex = ansText.match(/\((?:LIE\s*[—–-]\s*)?([^)]*)\)/i);
      if (ex && ex[1].trim() && !/^LIE$/i.test(ex[1].trim())) explanation = ex[1].trim();
    }
    if (lieIndex < 0) lieIndex = marked;
    if (lieIndex < 0) issue('error', '거짓 문장 번호(A: #2 …)가 없습니다');
    else if (marked >= 0 && marked !== lieIndex) issue('error', `문장 표시(LIE)는 ${marked + 1}번인데 정답 줄은 ${lieIndex + 1}번입니다`);
    if (statements.length !== 3) issue('warn', `문장이 ${statements.length}개입니다 (3개 기준)`);
    statements.forEach((t, k) => { if (t.length > LIMITS.compStatement) issue('warn', `${k + 1}번 ${t.length}자 (최대 ${LIMITS.compStatement}자)`); });
    return { kind: 'lie', instruction, statements, lieIndex, explanation };
  }

  function parseOrder(sp, instruction, arrowLine, issue) {
    const events = [];
    sp.items.forEach((it) => {
      const lines = [it.head, ...it.body].map((l) => l.trim()).filter(Boolean)
        .filter((l) => !ANSWER_RE.test(l) && l !== arrowLine && !/^(Correct order|정답|답)\b/i.test(l));
      events.push(lines.join(' '));
    });
    let order = [];
    if (arrowLine) order = (arrowLine.replace(/^[^\d]*/, '').match(/\d+/g) || []).map(Number);
    const n = events.length;
    const valid = order.length === n && order.slice().sort((a, b) => a - b).every((v, k) => v === k + 1);
    if (!valid) issue('error', `정답 순서(예: 2 → 4 → 1 → 3)가 없거나 잘못되었습니다`);
    if (n !== 4) issue('warn', `사건이 ${n}개입니다 (4개 기준)`);
    events.forEach((t, k) => { if (t.length > LIMITS.compStatement) issue('warn', `${k + 1}번 ${t.length}자 (최대 ${LIMITS.compStatement}자)`); });
    return { kind: 'order', instruction, events, order: valid ? order : [] };
  }

  const DEFAULT_INSTRUCTION = {
    mc: 'Choose the correct words to fill in the blank.',
    fill: 'Complete the sentence using the correct form of the word in parentheses.',
    order: 'Put the words in the correct order.',
  };
  function parseQuiz(text, issue) {
    const out = { coverage: '', items: [] };
    if (!text) { issue('error', '비어 있습니다'); return out; }
    const sp = splitNumbered(text);
    out.coverage = sp.pre.join(' ').replace(/^Pattern coverage:\s*/i, '').trim();
    let lastInstruction = { mc: '', fill: '', order: '' };
    sp.items.forEach((it, k) => {
      const where = `퀴즈 ${k + 1}`;
      const q = parseQuestion([it.head, ...it.body], (lv, msg) => issue(lv, `${k + 1}번: ${msg}`));
      if (q.instruction) lastInstruction[q.kind] = q.instruction;
      else q.instruction = lastInstruction[q.kind] || DEFAULT_INSTRUCTION[q.kind];
      q.where = where;
      out.items.push(q);
    });
    const mc = out.items.filter((q) => q.kind === 'mc').length;
    if (out.items.length !== 5) issue('warn', `문항이 ${out.items.length}개입니다 (5개 기준)`);
    else if (mc !== 4) issue('info', `4지선다 ${mc}개 / 단답 ${5 - mc}개 (가이드: 4지선다 4 + 단답 1)`);
    return out;
  }

  // ---------------------------------------------------------------------------
  // 슬라이드 계획: 1강 완성본(91장) 순서를 그대로 따른다
  // ---------------------------------------------------------------------------
  function planSlides(lesson, opts) {
    opts = opts || {};
    const series = opts.series || 'CNN 10';
    const plan = [];
    const add = (type, values, extra) => plan.push(Object.assign({ type, values: values || {}, highlights: [], answer: null, image: null }, extra || {}));
    const pad = (k) => String(k).padStart(2, '0');
    const choiceVals = (arr) => ({ c1: arr[0] || '', c2: arr[1] || '', c3: arr[2] || '', c4: arr[3] || '' });
    const code = (s) => `${series}_Class ${lesson.no}_${pad(s)}_${lesson.dateMMDD}`;

    add('greet');
    add('trivia_intro');
    const t = lesson.trivia;
    add('trivia_q', Object.assign({ q: t.question }, choiceVals(t.choices)));
    add('trivia_a', Object.assign({ q: t.question, answer: t.choices[t.answerIndex] || '', letter: LETTERS[t.answerIndex] || '' }, choiceVals(t.choices)),
      { answer: { tokens: C4, index: t.answerIndex } });
    add('video');
    add('words_intro');
    lesson.words.forEach((w, k) => {
      const base = Object.assign({ n: String(k + 1), word: w.word, sentence: w.sentence }, choiceVals(w.choices));
      const hl = w.sentenceHighlight ? [{ token: 'sentence', ranges: w.sentenceHighlight }] : [];
      add('word_q', base, { highlights: hl });
      add('word_a', Object.assign({ answer: w.meaning, letter: LETTERS[w.answerIndex] || '' }, base), { highlights: hl, answer: { tokens: C4, index: w.answerIndex } });
      add('word_card', { n: String(k + 1), word: w.word, meaning: w.meaning, example: w.example },
        { highlights: w.exampleHighlight ? [{ token: 'example', ranges: w.exampleHighlight }] : [], image: w.image ? { token: 'image', url: w.image } : null });
    });
    add('script_intro');
    lesson.scripts.forEach((sc, si) => {
      const s = String(si + 1);
      add('script_text', { s, script: sc.text });
      sc.expressions.forEach((e) => {
        const hl = e.highlight ? [{ token: 'script', ranges: e.highlight }] : [];
        add('script_q', { s, script: sc.text, expression: e.expression, question: e.question }, { highlights: hl });
        add('script_a', { s, script: sc.text, expression: e.expression, question: e.question, answer: e.answer }, { highlights: hl });
      });
      const g = sc.grammar;
      const gv = { s, sentence: g.sentence, pattern: g.pattern, explanation: g.explanation };
      add('grammar_1', gv);
      add('grammar_2', Object.assign({ ex1: g.examples[0] || '' }, gv));
      add('grammar_3', Object.assign({ ex1: g.examples[0] || '', ex2: g.examples[1] || '' }, gv));
      add('wordwall', { s, code: code(si + 1) });
      sc.practice.items.forEach((q, k) => {
        const v = Object.assign({ s, k: String(k + 1), kk: pad(k + 1), instruction: q.instruction, pattern: g.pattern, explanation: g.explanation, prompt: q.prompt }, q.kind === 'mc' ? choiceVals(q.choices) : {});
        add(`practice_${q.kind}_q`, v);
        add(`practice_${q.kind}_a`, Object.assign({ answer: q.answer }, q.kind === 'mc' ? { letter: LETTERS[q.answerIndex] || '' } : {}, v),
          q.kind === 'mc' ? { answer: { tokens: C4, index: q.answerIndex } } : {});
      });
      const c = sc.comprehension;
      if (c.kind === 'tf') {
        c.items.forEach((it, k) => {
          const v = { s, k: String(k + 1), kk: pad(k + 1), statement: it.statement };
          add('comp_tf_q', v);
          add('comp_tf_a', Object.assign({ answer: it.answer }, v));
        });
      } else if (c.kind === 'lie') {
        const v = { s, instruction: c.instruction, st1: c.statements[0] || '', st2: c.statements[1] || '', st3: c.statements[2] || '' };
        add('comp_lie_q', v);
        add('comp_lie_a', Object.assign({ answer: c.statements[c.lieIndex] || '', lieNo: c.lieIndex >= 0 ? String(c.lieIndex + 1) : '', explanation: c.explanation || '' }, v),
          { answer: { tokens: ['st1', 'st2', 'st3'], index: c.lieIndex } });
      } else if (c.kind === 'order') {
        const v = { s, instruction: c.instruction };
        c.events.forEach((e, k) => { v['ev' + (k + 1)] = e; });
        add('comp_order_q', v);
        const a = Object.assign({}, v);
        c.order.forEach((num, k) => { a['ord' + (k + 1)] = c.events[num - 1] || ''; a['num' + (k + 1)] = String(num); });
        add('comp_order_a', a);
      }
    });
    add('quiz_intro', { code: code(1) });
    lesson.quiz.items.forEach((q, k) => {
      const v = Object.assign({ k: String(k + 1), kk: pad(k + 1), instruction: q.instruction, prompt: q.prompt }, q.kind === 'mc' ? choiceVals(q.choices) : {});
      add(`quiz_${q.kind}_q`, v);
      add(`quiz_${q.kind}_a`, Object.assign({ answer: q.answer }, q.kind === 'mc' ? { letter: LETTERS[q.answerIndex] || '' } : {}, v),
        q.kind === 'mc' ? { answer: { tokens: C4, index: q.answerIndex } } : {});
    });
    add('headline_intro');
    add('headline_rewatch');
    add('headline_q');
    add('headline_a', { headline: lesson.headline });
    const globals = { no: String(lesson.no), week: lesson.week, date: lesson.dateMMDD, day: lesson.day, title: lesson.titleEn, titleKo: lesson.titleKo, series };
    plan.forEach((p, i) => { p.index = i; p.globals = globals; });
    return plan;
  }

  function summarizeIssues(lesson) {
    const c = { error: 0, warn: 0, info: 0 };
    (lesson.issues || []).forEach((i) => { c[i.level] = (c[i.level] || 0) + 1; });
    return c;
  }

  return {
    SLIDE_TYPES, GLOBAL_TOKENS, LETTERS, LIMITS,
    parseCsv, colLetter, mapColumns, readLessons, parseLesson, planSlides,
    findPhrase, splitNumbered, parseQuestion, summarizeIssues, formatMMDD,
  };
});
