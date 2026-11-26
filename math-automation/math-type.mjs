// Korean text uses a face Google Slides also serves. A face it lacks (Pretendard) is
// replaced by Arial on import, so every browser-measured position drifts.
export const KOREAN_FACE='Noto Sans KR';
// The distributed Lora Bold Italic cmap. Math outside it uses a full math font.
const coverage='20-7e a0-ac ae-137 139-17f 18f 192 1a0-1a1 1af-1b0 1b7 1cd-1ce 1d3-1d4 1e4-1e9 1ee-1ef 1fe-1ff 218-21b 21e-21f 237 259 292 2bb-2bc 2c6-2c7 2c9 2d8-2dd 300-304 306-30c 312 31b 323 326-328 335-336 393-394 3a0 3a9 3bc 3c0 400-45f 462-463 46a-46d 472-475 48a-4ff 510-513 51a-51d 524-529 52e-52f 1c81 1c85 1e80-1e85 1e9e 1ea0-1ef9 2010 2013-2014 2018-201a 201c-201e 2020-2022 2026 2030 2032-2033 2039-203a 2044 2052 2074 20ac 20ae 20b4 20b8 20ba 20bd 2113 2116 2122 2126 212a-212b 212e 2202 2206 220f 2211-2212 2215 2219-221a 221e 222b 2248 2260 2264-2265 25ca 27e8-27e9 effd fb01-fb02'.split(' ').map(r=>r.split('-').map(n=>parseInt(n,16)));
const faces=new Map();
function faceFor(ch){
  if(faces.has(ch))return faces.get(ch);
  const n=ch.codePointAt(0);
  const face=coverage.some(([lo,hi=lo])=>n>=lo&&n<=hi)?'Lora':
    /[\p{Script=Hangul}\p{Script=Han}\u3000-\u303f\u2460-\u2473]/u.test(ch)?KOREAN_FACE:'STIX Two Math';
  faces.set(ch,face);return face;
}
const symbols=/[\p{Sm}\p{Script=Greek}\p{Nl}\u2070-\u209f\u2190-\u21ff\u2200-\u22ff\u2308-\u230b\u25a0-\u25ff\u27c0-\u27ef\u2980-\u2aff\u{1d400}-\u{1d7ff}°′″%‰⋯·]/u;
const functionsAndUnits=/^(?:sin|cos|tan|cot|sec|csc|log|ln|lim|max|min|mod|cm|mm|km|kg|mg|ml|mol|rad|deg|mL|Hz|RPM|Pro|PPT|QuizN|the|and|or|for|of|to|in|is|as|at|by|on|if|not)$/i;
const tokens=/[\p{Script=Latin}]+|\d+(?:[.,]\d+)*|[\s]+|./gsu;
function isValue(t){
  return !!t && (symbols.test(t) || /\d/.test(t) || (/^[a-z]+$/i.test(t) &&
    (t.length<=3 || /^[A-Z]+$/.test(t) || /^[a-hm-np-z]+$/.test(t)&&t.length<=5)) && !functionsAndUnits.test(t));
}
export function typeRuns(value, math=true){
  // A pasted mathematical italic x (𝑥) denotes the same variable as a typed x.
  const normalized=String(value).replace(/[\u{1D434}-\u{1D467}\u{1D468}-\u{1D49B}ℎ]/gu,ch=>ch.normalize('NFKC'));
  const chapter=normalized.match(/^\s*(?:[Ⅰ-Ⅻ]+|[IVX]+)\s*[-–]\s*\d+(?=\s|$)/u)?.[0] ?? '';
  let offset=0;
  const ts=normalized.match(tokens)??[],runs=[];
  for(let i=0;i<ts.length;i++){
    const t=ts[i];
    const neighbor=(j,step)=>{while(ts[j] && /^\s+$/.test(ts[j]))j+=step;return ts[j];};
    const punct=/^[-+*/=<>()[\]{}|!,:;.]$/.test(t);
    const before=neighbor(i-1,-1),after=neighbor(i+1,1);
    const joinsMath='([{'.includes(t)?isValue(after):')]}'.includes(t)?isValue(before):(isValue(before)||isValue(after));
    const inChapter=offset<chapter.length;
    offset+=t.length;
    const variable = /^[a-zA-Zα-ωΑ-Ω]+$/u.test(t) && isValue(t);
    const italic = Boolean(math && !inChapter && variable);
    for(const ch of t){
      const fontFace = !math || inChapter || /^[○△□×]$/.test(ch) && /[옳안이면]/.test(normalized) ? KOREAN_FACE :
        isValue(t) || (punct && joinsMath) ? faceFor(ch) : KOREAN_FACE;
      const last=runs.at(-1);
      if(last && last.options.fontFace===fontFace && last.options.italic===italic)last.text+=ch;
      else runs.push({text:ch,options:{fontFace,italic,bold:true}});
    }
  }
  return runs;
}
let ready;
export function loadLessonFonts(){
  ready??=Promise.all([
    [KOREAN_FACE,'./fonts/noto-sans-kr-bold.woff2','normal','700'],
    ['Lora','./fonts/lora/bold.ttf','normal','700'],['Lora','./fonts/lora/bolditalic.ttf','italic','700'],
    ['STIX Two Math','./fonts/lora/stix-math.ttf','normal','400']
  ].map(async ([family,path,style,weight])=>{
    const face=new FontFace(family,'url("'+new URL(path,import.meta.url)+'")',{style,weight});
    document.fonts.add(await face.load());
  })).catch(e=>{ready=null;throw e;});
  return ready;
}
