export const selectable=files=>files.filter(f=>f.expression&&!f.segmentationError);
export const missingAudio=files=>selectable(files).filter(f=>!f.audio&&!f.candidates?.length);
export function setIncluded(files,checked){for(const f of selectable(files))f.included=checked;}
export function excludeMissing(plan,excluded){for(const f of missingAudio(plan.files))f.included=!excluded;syncMissingChoice(plan);}
export function syncMissingChoice(plan){const missing=missingAudio(plan.files);plan.missingAudioAcknowledged=missing.length>0&&missing.every(f=>f.included===false);}
export function selectionState(files){const rows=selectable(files),selected=rows.filter(f=>f.included!==false).length;return {total:rows.length,selected,checked:rows.length>0&&selected===rows.length,indeterminate:selected>0&&selected<rows.length};}
