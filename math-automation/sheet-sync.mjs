import { connectStaffGoogle } from './google-drive.mjs?v=2';

const sheetsScope = 'https://www.googleapis.com/auth/spreadsheets';
const targets = {
  'concept-foundations-han': {
    id: '1C56f5yQRZWahG7dWOTyubdcOkQLPFLgo3HzrWKCSzec', tab: '[개념원리_커리큘럼]',
    base: 'IJKLMNOP', teacher: 'QRSTU', appendix: 'VWX', end: 'X',
    checks: { I: '문제 1', P: '문제 8', Q: '문제 1 (30초)', U: '문제 5 (2분)', V: '문제 1 (2분)', X: '문제 3 (3분)' },
  },
  'oh-pending': {
    id: '1aheZt1Je9Ts4kctEPMwoZWf8iHizmnVdmmm8j7UHwgQ', tab: '[RPM_커리큘럼]',
    base: 'JKLMNOPQRST', practice: 'UV', end: 'V',
    checks: { J: '문제 1', T: '문제 11', U: '빈출 문제 1 (2분)', V: '고난도 문제 2 (3분)' },
  },
};

export function sheetDestination(course, lesson) {
  const target = targets[course?.id];
  if (!target || !lesson || !Number.isSafeInteger(lesson.curriculum_row) || lesson.curriculum_row < 6) return null;
  return { ...target, row: lesson.curriculum_row, start: target.base[0] };
}

function cellEntries(columns, items, format) {
  return items.map(item => {
    const column = columns?.[item.slot - 1];
    if (!column) throw Error('제출본 문항 번호와 시트 열이 맞지 않습니다.');
    return [column, format(item)];
  });
}

function formatQuiz(quiz) {
  const choices = quiz.kind === 'choice' ? '\n' + quiz.choices.split('\n').map((choice, i) => (i + 1) + '. ' + choice).join('\n')
    : quiz.kind === 'ox' ? '\nO / X' : '';
  return quiz.prompt + choices + '\n정답 ' + quiz.answer;
}

function questionLabel(item) {
  return ['개념원리','RPM'].includes(item.book) ? item.label : item.book + ' ' + item.label;
}

export function buildSheetWrites(target, lesson, submission) {
  return [
    ...cellEntries(target.base, submission.selections, questionLabel),
    ...cellEntries(target.teacher, submission.quizzes ?? [], formatQuiz),
    ...cellEntries(target[lesson.quiz_mode], submission.stage_questions ?? [], questionLabel),
  ];
}

export async function syncSubmissionToSheet(target, lesson, submission) {
  const entries = buildSheetWrites(target, lesson, submission);
  if (!entries.length) throw Error('반영할 제출 문항이 없습니다.');
  const { headers } = await connectStaffGoogle(sheetsScope);
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + target.id;
  const name = "'" + target.tab + "'!";
  const ranges = new URLSearchParams({
    valueRenderOption:'FORMULA',
  });
  ranges.append('ranges', name + 'A4:' + target.end + '4');
  ranges.append('ranges', name + 'A' + target.row + ':' + target.end + target.row);
  const [reply, lessonReply] = await Promise.all([
    fetch(base + '/values:batchGet?' + ranges, { headers, cache:'no-store' }),
    fetch(base + '/values/' + encodeURIComponent(name + 'C' + target.row)
      + '?valueRenderOption=FORMATTED_VALUE', { headers, cache:'no-store' }),
  ]);
  if (!reply.ok || !lessonReply.ok) throw Error('회사 Google 계정으로 커리큘럼 시트를 열 수 없습니다. 시트의 편집 권한을 확인해 주세요.');
  const [{ valueRanges }, lessonCell] = await Promise.all([reply.json(), lessonReply.json()]);
  const columnIndex = (letter) => letter.charCodeAt(0) - 65;
  const headersRow = valueRanges?.[0]?.values?.[0] ?? [];
  const current = valueRanges?.[1]?.values?.[0] ?? [];
  if (lessonCell.values?.[0]?.[0] !== lesson.lesson + '강' || Object.entries(target.checks).some(([letter, title]) => headersRow[columnIndex(letter)] !== title)) {
    throw Error('시트의 회차나 문항 열이 바뀌었습니다. 위치를 확인한 뒤 다시 시도해 주세요.');
  }
  const changed = entries.filter(([col,text]) => String(current[columnIndex(col)] ?? '') !== text);
  const occupied = changed.filter(([col]) => String(current[columnIndex(col)] ?? '').trim());
  if (occupied.some(([col]) => String(current[columnIndex(col)]).startsWith('='))) {
    throw Error('반영할 칸에 수식이 있습니다. 커리큘럼 시트를 확인해 주세요.');
  }
  if (occupied.length && !window.confirm(target.row + '행의 기존 값 ' + occupied.length +
    '칸(' + occupied.map(([col]) => col).join(', ') + ')을 이번 제출본으로 바꿀까요?')) return null;
  if (changed.length) {
    const data = changed.map(([col,text]) => ({ range: name + col + target.row, values:[[text]] }));
    const response = await fetch(base + '/values:batchUpdate', {
      method:'POST', headers: { ...headers, 'Content-Type':'application/json' },
      body: JSON.stringify({ valueInputOption:'RAW', data }),
    });
    if (!response.ok) throw Error('Google 시트에 반영하지 못했습니다. 편집 권한을 확인해 주세요.');
    const outcome = await response.json();
    if (outcome.totalUpdatedCells !== changed.length) throw Error('일부 칸의 반영을 확인하지 못했습니다. 시트를 확인해 주세요.');
  }
  return { written:changed.length };
}
