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

const keys = [
  ['제곱 ²', '제곱', append('²')],
  ['세제곱 ³', '세제곱', append('³')],
  ['지수 입력', '지수 입력', power, '중괄호 안에 지수를 입력하세요.'],
  ['분수', '분수', fraction],
  ['절댓값', '절댓값', wrap('|', '|'), '막대 사이에 값을 입력하세요.'],
  ['제곱근 √', '제곱근', () => ({ text:'√' })],
  ['순환점', '순환소수 점', selected => ({ text:selected + '\u0307' }), '반복되는 숫자 바로 뒤에 점을 붙이세요.'],
  ['×', '곱하기'], ['÷', '나누기'], ['−', '빼기'], ['±', '플러스 마이너스'],
  ['≠', '같지 않음'], ['≤', '작거나 같음'], ['≥', '크거나 같음'],
  ['∠', '각'], ['°', '도'], ['∥', '평행'], ['⊥', '수직'], ['π', '파이'],
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
  let hintMode;
  const activeInput = () => lastInput.disabled || lastInput.closest('[hidden]') ? defaultField : lastInput;
  const group = element('div', 'symbols');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', '수학 기호');
  const help = element('p', 'muted math-fraction-help', '분수 → 분자 입력 → Tab 또는 ‘분모로 이동’ → 분모 입력');
  help.id = root.id + '-fraction-help';
  const hint = element('p', 'muted math-symbol-hint');
  hint.setAttribute('role', 'status');
  const next = element('button', 'math-next-field', '분모로 이동');
  next.type = 'button';
  next.hidden = true;
  const feedback = element('div', 'math-keypad-feedback');
  feedback.append(help, hint, next);

  function setHint(message = '', mode) {
    hint.textContent = message;
    hintMode = mode;
  }

  function update() {
    const input = activeInput();
    const pendingFraction = fractionDestination(input, false) !== null;
    next.hidden = !pendingFraction;
    if ((hintMode === 'fraction' && !pendingFraction)
      || (hintMode === 'power' && !/\^\{\s*\}/.test(input.value))) setHint();
  }

  function moveToDenominator(activeOnly) {
    const input = activeInput();
    const start = fractionDestination(input, activeOnly);
    if (start === null) return false;
    input.focus();
    input.setSelectionRange(start, start + 2);
    setHint('분모를 입력하세요.', 'fraction');
    return true;
  }

  for (const [label, name, format, message] of keys) {
    const button = element('button', null, label);
    button.type = 'button';
    button.title = name;
    button.setAttribute('aria-label', name);
    if (format === fraction) button.setAttribute('aria-describedby', help.id);
    button.addEventListener('click', () => {
      const input = activeInput();
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      const { text, start: offset, length = 0 } = format?.(input.value.slice(start, end)) ?? { text:label };
      if (input.maxLength >= 0 && input.value.length - (end - start) + text.length > input.maxLength) {
        setHint('입력할 수 있는 길이를 넘겼습니다.');
        return;
      }
      input.focus();
      input.setRangeText(text, start, end, 'end');
      if (offset !== undefined) input.setSelectionRange(start + offset, start + offset + length);
      setHint(message, format === fraction ? 'fraction' : format === power ? 'power' : undefined);
      input.dispatchEvent(new Event('input', { bubbles:true }));
    });
    group.append(button);
  }
  next.addEventListener('click', () => moveToDenominator(false));
  for (const input of fields) {
    input.addEventListener('focus', () => {
      if (input !== lastInput) setHint();
      lastInput = input;
      update();
    });
    input.addEventListener('input', update);
    input.addEventListener('keydown', event => {
      if (event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey
        && !event.isComposing && moveToDenominator(true)) event.preventDefault();
    });
  }
  root.append(group, feedback);
  function reset() {
    lastInput = defaultField;
    setHint();
    update();
  }
  return { reset, update };
}
