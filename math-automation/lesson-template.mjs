// The six approved samples. Slots are numbered the same way on the site and in the slides.
const templates = {
  'concept-foundations-oh': {teacher:'oh-concept'},
  'oh-pending': {practice:'oh-rpm'},
  'concept-foundations-han': {teacher:'han-concept-1',appendix:'han-concept-2'},
  'rpm-application-han': {rpm_final:'han-rpm-1',rpm_pro:'han-rpm-2'},
};

export function submissionTemplate(course, submission, scheduledMode = submission.quiz_mode) {
  const choices=templates[course.id];
  if (!choices) throw Error('등록된 PPT 양식이 없는 수업입니다.');
  const modes=new Set((submission.stage_questions ?? []).map(q=>q.stage_mode).filter(Boolean));
  if (submission.quizzes?.length) modes.add('teacher');
  const selected=submission.selected_quiz_mode;
  if (scheduledMode && Object.keys(choices).length > 1 &&
      ((selected && selected !== scheduledMode) || modes.size !== 1 || !modes.has(scheduledMode))) {
    throw Error('이 제출본은 회차에 지정된 세트와 다릅니다. 커리큘럼을 확인하고 다시 제출해 주세요.');
  }
  const legacyPair=!selected && modes.size>1;
  const mode=selected ?? [...modes][0] ?? Object.keys(choices)[0];
  const [required]=slotLimits(course,legacyPair ? null : mode);
  const filled=new Set((submission.selections ?? []).filter(p=>p.question_id!=null).map(p=>p.slot));
  const missing=Array.from({length:required},(_,i)=>i+1).filter(slot=>!filled.has(slot));
  if (missing.length) throw Error('기본 수업 문항 '+missing.join(', ')+'번을 채워 다시 제출해 주세요.');
  if (legacyPair) return null; // Historical two-set submission.
  if (!choices[mode] || [...modes].some(value=>value!==mode)) throw Error('제출한 세트와 PPT 양식이 일치하지 않습니다.');
  return choices[mode];
}

export function slotLimits(course, mode) {
  if (course?.id==='concept-foundations-han') return mode==='appendix' ? [8,11] : [5,8];
  // Review jobs carry the course identity but do not include its slot counts.
  const rpm=course?.id==='rpm-application-han' || course?.id==='oh-pending';
  return [course?.required_lesson_slots??(rpm?8:5),course?.lesson_slots??(rpm?11:8)];
}
