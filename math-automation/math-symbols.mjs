function exponentBase(selection) {
  const value = selection.trim();
  return /[\s+−×÷-]/.test(value) && !(value.startsWith('(') && value.endsWith(')')) ? '(' + value + ')' : value;
}

function append(suffix) {
  return selected => ({ text: exponentBase(selected) + suffix });
}

function power(selected) {
  const base = exponentBase(selected);
  return { text: base + '^{}', start: base.length + 2 };
}

function fraction(selected) {
  const numerator = selected.trim() || '분자';
  return {
    text: '(' + numerator + ')⁄(분모)',
    start: selected.trim() ? numerator.length + 4 : 1,
    length: 2,
  };
}

function wrap(left, right) {
  return selected => ({ text: left + selected + right, start: selected ? undefined : left.length });
}

const frequent = [
  ['제곱', '²', append('²')],
  ['세제곱', '³', append('³')],
  ['지수 입력', 'aⁿ', power, '중괄호 안에 지수를 입력하세요.'],
  ['분수', '½', fraction, '분자를 입력하고 Tab 또는 ‘분모로 이동’을 누르세요.'],
  ['절댓값', '|a|', wrap('|', '|'), '막대 사이에 값을 입력하세요.'],
  ['곱하기', '×'], ['나누기', '÷'], ['빼기', '−'], ['작거나 같음', '≤'], ['크거나 같음', '≥'],
];
const other = [
  ['연산·관계', [
    ['더하기', '+'], ['같음', '='], ['같지 않음', '≠'], ['작음', '<'], ['큼', '>'],
    ['플러스 마이너스', '±'], ['약', '≈'],
  ]],
  ['도형', [['각', '∠'], ['도', '°'], ['평행', '∥'], ['수직', '⊥'], ['삼각형', '△'], ['파이', 'π']]],
  ['표기', [
    ['제곱근', '√'], ['괄호', '( )', wrap('(', ')')], ['빈칸', '□'],
    ['순환소수 점', '◌̇', selected => ({ text: selected + '\u0307' }), '반복되는 숫자 바로 뒤에 점을 붙이세요.'],
  ]],
];

export function hasIncompleteMath(value) {
  return /\^\{\s*\}|\(분자\)⁄|⁄\(분모\)/.test(value);
}

function fractionDestination(input, activeOnly) {
  for (const match of input.value.matchAll(/\(([^()\r\n]*)\)⁄\(분모\)/g)) {
    const start = match.index + 1;
    const end = start + match[1].length;
    if (!activeOnly || (input.selectionStart >= start && input.selectionEnd <= end)) {
      return end + 3;
    }
  }
  return null;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function mountMathSymbols(root, fields) {
  const [defaultField] = fields;
  let lastInput = defaultField;
  const activeInput = () => lastInput.disabled || lastInput.closest('[hidden]') ? defaultField : lastInput;
  const title = element('h3', null, '수학 기호 입력');
  title.id = root.id + '-heading';
  root.setAttribute('aria-labelledby', title.id);
  const target = element('span', 'math-symbol-target');
  const heading = element('div', 'math-keypad-heading');
  heading.append(title, target);
  const hint = element('p', 'muted math-symbol-hint');
  hint.setAttribute('role', 'status');
  const next = element('button', 'math-next-field', '분모로 이동');
  next.type = 'button';
  next.hidden = true;
  const feedback = element('div', 'math-keypad-feedback');
  feedback.append(hint, next);
  const primary = element('div', 'symbols math-symbol-primary');
  const details = element('details', 'math-more-symbols');
  details.append(element('summary', null, '기호 더 보기'));

  function update() {
    const input = activeInput();
    const label = input.labels?.[0]?.textContent.trim() || '문제';
    target.textContent = '입력 위치 · ' + label;
    next.hidden = fractionDestination(input, false) === null;
  }

  function moveToDenominator(activeOnly) {
    const input = activeInput();
    const start = fractionDestination(input, activeOnly);
    if (start === null) return false;
    input.focus();
    input.setSelectionRange(start, start + 2);
    hint.textContent = '분모를 입력하세요.';
    return true;
  }

  function addKeys(group, keys, showName = false) {
    for (const [name, mark, format, message] of keys) {
      const button = element('button', 'math-key');
      button.type = 'button';
      button.title = name;
      button.setAttribute('aria-label', name);
      button.append(element('span', 'math-key-mark', mark));
      if (showName && format) button.append(element('span', 'math-key-name', name === '지수 입력' ? '지수' : name));
      button.addEventListener('click', () => {
        const input = activeInput();
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        const { text, start: offset, length = 0 } = format?.(input.value.slice(start, end)) ?? { text:mark };
        if (input.maxLength >= 0 && input.value.length - (end - start) + text.length > input.maxLength) {
          hint.textContent = '입력할 수 있는 길이를 넘겼습니다.';
          return;
        }
        input.focus();
        input.setRangeText(text, start, end, 'end');
        if (offset !== undefined) input.setSelectionRange(start + offset, start + offset + length);
        hint.textContent = message ?? '';
        input.dispatchEvent(new Event('input', { bubbles:true }));
      });
      group.append(button);
    }
  }

  addKeys(primary, frequent, true);
  for (const [name, keys] of other) {
    const row = element('div', 'math-extra-group');
    const label = element('h4', null, name);
    const group = element('div', 'symbols');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', name);
    addKeys(group, keys);
    row.append(label, group);
    details.append(row);
  }
  next.addEventListener('click', () => moveToDenominator(false));
  for (const input of fields) {
    input.addEventListener('focus', () => {
      if (input !== lastInput) hint.textContent = '';
      lastInput = input;
      update();
    });
    input.addEventListener('input', update);
    input.addEventListener('keydown', event => {
      if (event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey
        && !event.isComposing && moveToDenominator(true)) event.preventDefault();
    });
  }
  root.append(heading, primary, feedback, details);
  function reset() {
    lastInput = defaultField;
    hint.textContent = '';
    details.open = false;
    update();
  }
  return { reset, update };
}
