import { connectStaffGoogle } from './google-drive.mjs?v=9';
import { normalizeQuizNotation } from './math-notation.mjs?v=1';

const sheetsScope = 'https://www.googleapis.com/auth/spreadsheets';
const targets = {
  'concept-foundations-han': {
    tab: '[개념원리_커리큘럼]',
    quizModes: ['teacher','appendix'],
    base: 'IJKLMNOP', teacher: 'QRSTU', appendix: 'VWX', end: 'X',
    checks: { I: '문제 1', P: '문제 8', Q: '문제 1 (30초)', U: '문제 5 (2분)', V: '문제 1 (2분)', X: '문제 3 (3분)' },
  },
  'rpm-application-han': {
    tab: '[RPM_커리큘럼]',
    quizModes: ['rpm_final','rpm_pro'],
    base: 'IJKLMNOPQRS', rpm_final: 'TUV', rpm_pro: 'WX', end: 'X',
    checks: { I: '문제 1', S: '문제 11', T: '빈출 문제 1 (2분)', U: '빈출 문제 2 (2분)',
      V: '고난도 문제 3 (3분)', W: '문제 1 (2분)', X: '문제 2 (3분)' },
  },
  'concept-foundations-oh': {
    tab: '[개념원리_커리큘럼]', quizModes: ['teacher'],
    base: 'IJKLMNOP', teacher: 'QRSTU', end: 'U',
    checks: { I: '문제 1', P: '문제 8', Q: '문제 1 (30초)', U: '문제 5 (2분)' },
  },
  'oh-pending': {
    tab: '[RPM_커리큘럼]',
    quizModes: ['practice'],
    base: 'IJKLMNOPQRS', practice: 'TU', end: 'U',
    checks: { I: '문제 1', S: '문제 11', T: '빈출 문제 1 (2분)', U: '고난도 문제 2 (3분)' },
  },
};

export function sheetDestination(course, input) {
  const target = targets[course?.id];
  if (!target) throw Error('이 수업의 커리큘럼 양식을 찾을 수 없습니다.');
  let url;
  try { url = new URL(input.trim()); } catch { /* Show the same message as for unsupported links. */ }
  const id = url?.pathname.match(/^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/(?:edit|view))?\/?$/)?.[1];
  if (!id || url.origin !== 'https://docs.google.com' || url.username || url.password) {
    throw Error('이 수업에 연결된 Google 스프레드시트 주소를 확인해 주세요.');
  }
  const gids = [...url.searchParams.getAll('gid'), ...new URLSearchParams(url.hash.slice(1)).getAll('gid')];
  if (gids.some(gid => !/^\d{1,10}$/.test(gid) || Number(gid) > 2147483647 || Number(gid) !== Number(gids[0]))) {
    throw Error('이 수업에 연결된 커리큘럼 탭 주소를 확인해 주세요.');
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

function formatQuiz(raw) {
  const quiz = normalizeQuizNotation(raw);
  const choices = quiz.kind === 'choice' ? '\n' + quiz.choices.split('\n').map((choice, i) => (i + 1) + '. ' + choice).join('\n')
    : quiz.kind === 'ox' ? '\nO / X' : '';
  return quiz.prompt + choices + '\n정답 ' + quiz.answer;
}

function questionLabel(item) {
  return ['개념원리','RPM'].includes(item.book) ? item.label : item.book + ' ' + item.label;
}

export function buildSheetWrites(target, lesson, submission) {
  const modes = target.quizModes.length > 1 ? [lesson.quiz_mode] : target.quizModes;
  if (submission.selected_quiz_mode && !modes.includes(submission.selected_quiz_mode)) {
    throw Error('제출본과 커리큘럼의 퀴즈앤 세트가 다릅니다. 해당 회차를 다시 제출해 주세요.');
  }
  if (modes.some(mode => !target.quizModes.includes(mode))) throw Error('제출본의 퀴즈 유형과 과정이 다릅니다.');
  const quizWrites = modes.flatMap(mode => {
    const columns = target[mode];
    const items = mode === 'teacher' ? submission.quizzes ?? []
      : (submission.stage_questions ?? []).filter(item => (item.stage_mode ?? lesson.quiz_mode) === mode);
    if (items.length !== columns.length || new Set(items.map(item => item.slot)).size !== columns.length) {
      throw Error('퀴즈 문항을 모두 채운 뒤 회차를 다시 제출해 주세요.');
    }
    return cellEntries(columns, items, mode === 'teacher' ? formatQuiz : item => item.quiz_override
      ? questionLabel(item) + '\n' + formatQuiz({ kind: 'choice', ...item.quiz_override })
      : questionLabel(item));
  });
  let base=cellEntries(target.base, submission.selections.filter(q=>q.slot<=target.base.length),questionLabel);
  const extra=submission.selections.filter(q=>q.slot>target.base.length);
  if(extra.length) {
    if(!modes.includes('appendix') || target.base.length!==8) throw Error('제출본 문항 번호와 시트 열이 맞지 않습니다.');
    // The existing sheet reserves I:P for lesson picks. Pair reserves with basics 6–8.
    for(const q of extra) {
      const slot=q.slot-3, cell=base.find(([column])=>column===target.base[slot-1]);
      if(!cell || slot<6 || slot>8)throw Error('예비 문항에 대응하는 기본 문항을 확인해 주세요.');
      cell[1]='기본 '+slot+'번 · '+cell[1]+'\n예비 '+q.slot+'번 · '+questionLabel(q);
    }
  }
  return [
    ...base,
    ...quizWrites,
  ];
}

export function connectSheet() {
  return connectStaffGoogle(sheetsScope);
}

async function sheetError(response, email) {
  const {error} = await response.json().catch(() => ({}));
  const reasons = [...(error?.details ?? []), ...(error?.errors ?? [])].map(item => item.reason);
  const account = email ? ' (' + email + ')' : '';
  if (reasons.includes('SERVICE_DISABLED') || reasons.includes('accessNotConfigured')) {
    return Error('수학자동화에 연결된 Google Cloud 프로젝트에서 Google Sheets API를 사용 설정해 주세요.');
  }
  if (response.status === 401 || reasons.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || reasons.includes('insufficientPermissions')) {
    return Error('회사 Google 계정으로 다시 연결하고 스프레드시트 권한을 허용해 주세요.' + account);
  }
  if (response.status === 404) return Error('연결된 계정으로 커리큘럼 시트를 찾을 수 없습니다. 저장 위치의 시트 주소와 공유 대상을 확인해 주세요.' + account);
  return Error('Google 시트 오류 ' + response.status + ' · ' + (error?.message || '잠시 후 다시 시도해 주세요.') + account);
}

export async function syncSubmissionToSheet(target, lesson, submission, connection, previous, beforeWrite = async () => {}) {
  const entries = buildSheetWrites(target, lesson, submission);
  const active = new Set(entries.map(([column]) => column));
  const previousEntries = Array.isArray(previous)
    ? cellEntries(target.base, previous, questionLabel)
    : previous ? cellEntries(target.base, previous.selections.filter(q => q.slot <= target.base.length), questionLabel) : [];
  for (const [column] of previousEntries) {
    if (!active.has(column)) entries.push([column, '']);
  }
  if (!entries.length) throw Error('반영할 제출 문항이 없습니다.');
  const { headers, email } = connection ?? await connectSheet();
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + target.id;
  const fetchSheet = async suffix => {
    const reply = await fetch(base + suffix, { headers, cache:'no-store' });
    if (!reply.ok) throw await sheetError(reply,email);
    return reply.json();
  };
  const meta = await fetchSheet('?fields=sheets(properties(sheetId,title,sheetType,hidden))');
  const tab = meta.sheets?.map(sheet => sheet.properties).find(properties =>
    !properties.hidden && properties.sheetType === 'GRID' &&
    (target.gid === null ? properties.title === target.tab : properties.sheetId === target.gid));
  if (!tab) throw Error('이 수업에 연결된 커리큘럼 탭을 찾지 못했습니다.');

  const name = "'" + tab.title.replaceAll("'", "''") + "'!";
  const ranges = new URLSearchParams({valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'});
  ranges.append('ranges', name + 'A4:' + target.end + '4');
  ranges.append('ranges', name + 'C6:D');
  const { valueRanges } = await fetchSheet('/values:batchGet?' + ranges);
  const columnIndex = (letter) => letter.charCodeAt(0) - 65;
  const headersRow = valueRanges?.[0]?.values?.[0] ?? [];
  if (Object.entries(target.checks).some(([letter, title]) => headersRow[columnIndex(letter)] !== title)) {
    throw Error('연결된 시트의 문항 열이 커리큘럼 양식과 다릅니다.');
  }
  const matchingRows = (valueRanges?.[1]?.values ?? []).flatMap(([label], index) =>
    String(label ?? '').trim() === lesson.lesson + '강' ? [index + 6] : []);
  if (matchingRows.length !== 1) throw Error(lesson.lesson + '강 행을 하나로 확인할 수 없습니다. 시트의 C열 회차를 확인해 주세요.');

  const [row] = matchingRows;
  const sessionDate = valueRanges[1].values[row - 6][1];
  const expectedDate = Date.parse(lesson.live_date + 'T00:00:00Z') / 86400000 + 25569;
  if (sessionDate !== expectedDate) throw Error('선택한 강의의 날짜와 시트 D열 날짜가 다릅니다. 강사와 수업명을 확인해 주세요.');
  if (target.quizModes.length > 1) {
    const expected = lesson.quiz_mode;
    const first = target[target.quizModes[0]][0];
    const range = name + first + row + ':' + target.end + row;
    const query = new URLSearchParams({ ranges:range, fields:'sheets(data(rowData(values(effectiveFormat(backgroundColor)))))' });
    const grid = await fetchSheet('?' + query);
    const cells = grid.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values ?? [];
    for (const mode of target.quizModes) {
      for (const col of target[mode]) {
        const color = cells[columnIndex(col) - columnIndex(first)]?.effectiveFormat?.backgroundColor;
        const dark = color && Math.max(color.red ?? 0, color.green ?? 0, color.blue ?? 0) < 0.5;
        if (!color || dark !== (mode !== expected)) {
          throw Error('시트의 음영과 이 회차의 퀴즈앤 설정이 다릅니다. 커리큘럼을 확인해 주세요.');
        }
      }
    }
  }
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
    await beforeWrite();
    const response = await fetch(base + '/values:batchUpdate', {
      method:'POST', headers: { ...headers, 'Content-Type':'application/json' },
      body: JSON.stringify({ valueInputOption:'RAW', data }),
    });
    if (!response.ok) throw await sheetError(response,email);
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
