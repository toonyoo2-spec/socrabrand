// Transfer the exact request text; never truncate lecture lists for messaging limits.
export function transferInfo(text) {
 const characters = Array.from(text).length;
 return {characters, message: `요청문 전체 ${characters.toLocaleString('ko-KR')}자` + (characters > 4000 ? ' · 긴 요청문은 파일로 내려받아 Slack에 첨부해 주세요.' : ' · 복사하거나 파일로 전달할 수 있습니다.')};
}
export async function copyRequest(textarea, clipboard = globalThis.navigator?.clipboard, doc = globalThis.document) {
 const text = textarea.value;
 try { await clipboard.writeText(text); return true; }
 catch {
  textarea.focus(); textarea.select(); textarea.setSelectionRange(0, text.length);
  try { return doc.execCommand('copy') === true; } catch { return false; }
 }
}
export function requestFile(text) { return new Blob([text], {type:'text/plain;charset=utf-8'}); }
