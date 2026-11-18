import { connectStaffGoogle } from './google-drive.mjs?v=3';

const sheetsScope = 'https://www.googleapis.com/auth/spreadsheets';
const targets = {
  'concept-foundations-han': {
    tab: '[개념원리_커리큘럼]',
    base: 'IJKLMNOP', teacher: 'QRSTU', appendix: 'VWX', end: 'X',
    checks: { I: '문제 1', P: '문제 8', Q: '문제 1 (30초)', U: '문제 5 (2분)', V: '문제 1 (2분)', X: '문제 3 (3분)' },
  },
  'oh-pending': {
    tab: '[RPM_커리큘럼]',
    base: 'IJKLMNOPQRS', practice: 'TU', end: 'U',
    checks: { I: '문제 1', S: '문제 11', T: '빈출 문제 1 (2분)', U: '고난도 문제 2 (3분)' },
  },
};

export function sheetDestination(course, input) {
  const target = targets[course?.id];
  if (!target) throw Error('이 과정의 커리큘럼 양식을 찾을 수 없습니다.');
  let url;
  try { url = new URL(input.trim()); } catch { /* Show the same message as for unsupported links. */ }
  const id = url?.pathname.match(/^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/(?:edit|view))?\/?$/)?.[1];
  if (!id || url.origin !== 'https://docs.google.com' || url.username || url.password) {
    throw Error('Google 스프레드시트의 주소창 링크를 붙여넣어 주세요.');
  }
  const gids = [...url.searchParams.getAll('gid'), ...new URLSearchParams(url.hash.slice(1)).getAll('gid')];
  if (gids.some(gid => !/^\d{1,10}$/.test(gid) || Number(gid) > 2147483647 || Number(gid) !== Number(gids[0]))) {
    throw Error('커리큘럼 탭이 열린 상태에서 링크를 다시 복사해 주세요.');
  }
  return { ...target, id, gid: gids.length ? Number(gids[0]) : null };
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
  const fetchSheet = async (suffix, message = '회사 Google 계정으로 시트를 열 수 없습니다. 링크와 접근 권한을 확인해 주세요.') => {
    const reply = await fetch(base + suffix, { headers, cache:'no-store' });
    if (!reply.ok) throw Error(message);
    return reply.json();
  };
  const meta = await fetchSheet('?fields=sheets(properties(sheetId,title,sheetType,hidden))');
  const tab = meta.sheets?.map(sheet => sheet.properties).find(properties =>
    !properties.hidden && properties.sheetType === 'GRID' &&
    (target.gid === null ? properties.title === target.tab : properties.sheetId === target.gid));
  if (!tab) throw Error('커리큘럼 탭을 찾지 못했습니다. 해당 탭을 열고 주소를 다시 복사해 주세요.');

  const name = "'" + tab.title.replaceAll("'", "''") + "'!";
  const ranges = new URLSearchParams({valueRenderOption:'FORMATTED_VALUE'});
  ranges.append('ranges', name + 'A4:' + target.end + '4');
  ranges.append('ranges', name + 'C6:C');
  const { valueRanges } = await fetchSheet('/values:batchGet?' + ranges);
  const columnIndex = (letter) => letter.charCodeAt(0) - 65;
  const headersRow = valueRanges?.[0]?.values?.[0] ?? [];
  if (Object.entries(target.checks).some(([letter, title]) => headersRow[columnIndex(letter)] !== title)) {
    throw Error('이 탭의 문항 열이 커리큘럼 양식과 다릅니다. 올바른 탭의 URL을 입력해 주세요.');
  }
  const matchingRows = (valueRanges?.[1]?.values ?? []).flatMap(([label], index) =>
    String(label ?? '').trim() === lesson.lesson + '강' ? [index + 6] : []);
  if (matchingRows.length !== 1) throw Error(lesson.lesson + '강 행을 하나로 확인할 수 없습니다. 시트의 C열 회차를 확인해 주세요.');

  const [row] = matchingRows;
  const fullRow = await fetchSheet('/values/' + encodeURIComponent(name + 'A' + row + ':' + target.end + row)
    + '?valueRenderOption=FORMULA');
  const current = fullRow.values?.[0] ?? [];
  const changed = entries.filter(([col,text]) => String(current[columnIndex(col)] ?? '') !== text);
  const occupied = changed.filter(([col]) => String(current[columnIndex(col)] ?? '').trim());
  if (occupied.some(([col]) => String(current[columnIndex(col)]).startsWith('='))) {
    throw Error('반영할 칸에 수식이 있습니다. 커리큘럼 시트를 확인해 주세요.');
  }
  if (occupied.length && !window.confirm(tab.title + ' 탭 ' + row + '행의 기존 값 ' + occupied.length +
    '칸(' + occupied.map(([col]) => col).join(', ') + ')을 이번 제출본으로 바꿀까요?')) return null;
  if (changed.length) {
    const data = changed.map(([col,text]) => ({ range: name + col + row, values:[[text]] }));
    const response = await fetch(base + '/values:batchUpdate', {
      method:'POST', headers: { ...headers, 'Content-Type':'application/json' },
      body: JSON.stringify({ valueInputOption:'RAW', data }),
    });
    if (!response.ok) throw Error('Google 시트에 반영하지 못했습니다. 편집 권한을 확인해 주세요.');
    const outcome = await response.json();
    if (outcome.totalUpdatedCells !== changed.length) throw Error('일부 칸의 반영을 확인하지 못했습니다. 시트를 확인해 주세요.');
  }
  return {
    written:changed.length,
    row,
    url:'https://docs.google.com/spreadsheets/d/' + target.id + '/edit#gid=' + tab.sheetId +
      '&range=' + target.base[0] + row + ':' + target.end + row,
  };
}
