// The six approved samples. Slots are numbered the same way on the site and in the slides.
const templates = {
  'concept-foundations-oh': {teacher:'oh-concept'},
  'oh-pending': {practice:'oh-rpm'},
  'concept-foundations-han': {teacher:'han-concept-1',appendix:'han-concept-2'},
  'rpm-application-han': {rpm_final:'han-rpm-1',rpm_pro:'han-rpm-2'},
};

export function submissionTemplate(course, submission) {
  const choices=templates[course.id];
  if (!choices) throw Error('등록된 PPT 양식이 없는 수업입니다.');
  const modes=new Set((submission.stage_questions ?? []).map(q=>q.stage_mode).filter(Boolean));
  if (submission.quizzes?.length) modes.add('teacher');
  const selected=submission.selected_quiz_mode;
  if (!selected && modes.size>1) return null; // Historical two-set submission.
  const mode=selected ?? [...modes][0] ?? Object.keys(choices)[0];
  if (!choices[mode] || [...modes].some(value=>value!==mode)) throw Error('제출한 세트와 PPT 양식이 일치하지 않습니다.');
  return choices[mode];
}

export function conceptMode(teacherCount, appendixCount, preferred) {
  if (appendixCount===3 && teacherCount!==5) return 'appendix';
  if (teacherCount===5 && appendixCount!==3) return 'teacher';
  return preferred || (appendixCount && !teacherCount ? 'appendix' : 'teacher');
}
export function slotLimits(course, mode) {
  if (course?.id==='concept-foundations-han') return mode==='appendix' ? [8,11] : [5,8];
  return [course?.required_lesson_slots??5,course?.lesson_slots??8];
}
