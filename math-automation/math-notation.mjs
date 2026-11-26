// An English x between two numbers is always multiplication (2x3, 2²x5, 2^{3}x5²).
// A variable keeps its x: 2x, x², 3x+1, (192)⁄(x) and 2x² are left as written.
// Spacing must match on both sides ("2x3" or "2 x 3"); a lopsided "2x 3" is left for the teacher.
const numericX = /(\d|[⁰¹²³⁴⁵⁶⁷⁸⁹]|\^\{\d+\})(?:([ \t]+)[xX](?=[ \t]+\d)|[xX](?=\d))/g;

export function numericTimes(value) {
  return typeof value === 'string' ? value.replace(numericX, (_, left, space = '') => left + space + '×') : value;
}

// Returns the same object when nothing changes, so callers can detect a rewrite.
export function normalizeQuizNotation(quiz) {
  if (!quiz || quiz.book_quiz) return quiz;
  let changed = false;
  const next = {...quiz};
  for (const key of ['prompt', 'choices', 'answer']) {
    // OX answers are the letters O/X and must never be rewritten.
    if (key === 'answer' && quiz.kind === 'ox') continue;
    const fixed = numericTimes(quiz[key]);
    if (fixed !== quiz[key]) { next[key] = fixed; changed = true; }
  }
  return changed ? next : quiz;
}
