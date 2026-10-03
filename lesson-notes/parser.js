/** Google Apps Script V8 + Node 테스트에서 함께 쓰는 순수 변환 로직. */
function parseGoogleId_(value, kind) {
  const input = String(value || '').trim();
  if (/^[\w-]{20,}$/.test(input)) return input;
  const match = input.match(/^https:\/\/docs\.google\.com\/(?:u\/\d+\/)?(presentation|document)\/(?:u\/\d+\/)?d\/([\w-]+)(?:[/?#]|$)/);
  if (!match || match[1] !== kind) throw new Error(kind === 'presentation' ? 'Google Slides 링크를 입력해 주세요. .pptx 파일은 먼저 Google Slides로 변환해 주세요.' : 'Google 문서 템플릿 링크를 확인해 주세요.');
  return match[2];
}

function cleanText_(value) {
  return String(value || '').replace(/\r\n?/g, '\n').replace(/\u000b/g, '\n').replace(/[\u200b\ufeff]/g, '').trim();
}

function normalize_(value) { return cleanText_(value).replace(/\s+/g, ' '); }
function hasKorean_(value) { return /[가-힣]/.test(value); }
function quoteHeading_(line) {
  const m = line.match(/^[“"](.+?)[”"]\s*$/);
  return m ? m[1] : null;
}

function dialogueLines_(blocks) {
  const result=[];
  blocks.forEach(block=>{
    let current='';
    cleanText_(block).split('\n').forEach(raw=>{
      const line=raw.trim();
      if(/^[A-Za-z][A-Za-z .'-]{0,35}:\s*\S/.test(line)) {
        if(current)result.push(current);
        current=line;
      }else if(current&&line)current+=' '+line;
    });
    if(current)result.push(current);
  });
  return result;
}

function expressionKey_(value) {
  return normalize_(value).toLowerCase().replace(/[‘’]/g,"'").replace(/[.!?]+$/,'');
}

/** 문장 사이에 바뀐 정답만 찾아 고정된 뒤 문장을 잘라내지 않는다. */
function changedAnswer_(question, answered) {
  const a = normalize_(question), b = normalize_(answered);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  // A period/question mark shared with the Korean prompt belongs to the
  // revealed answer. Shared English context (e.g. "so much. ...") does not.
  const punctuation = b.slice(endB).match(/^[.!?,;:…]+/);
  return b.slice(start, endB + (punctuation ? punctuation[0].length : 0)).trim();
}

function segments_(lines) {
  return segmentRows_(lines.map(text=>({text,start:0}))).map(r=>r.text);
}

function slideRich_(slide) {
  const blocks=slide.styledBlocks || slide.blocks.map(text=>({text,runs:[]}));
  let text='',runs=[];
  blocks.forEach((b,i)=>{if(i)text+='\n';const base=text.length;text+=b.text;(b.runs||[]).forEach(r=>runs.push({...r,start:r.start+base,end:r.end+base}));});
  return {text,runs,styled:!!slide.styledBlocks};
}
function richLines_(rich) {
  let offset=0;return rich.text.split('\n').map(text=>{const line={text,start:offset};offset+=text.length+1;return line;});
}
function richParts_(text,map,rich) {
  if(!rich?.styled)return undefined;
  const parts=[];
  for(let i=0;i<text.length;i++){
    const r=rich.runs.find(r=>r.start<=map[i]&&r.end>map[i]);
    const style=r?{bold:r.bold,italic:r.italic,underline:r.underline,strike:r.strike,color:r.color,highlight:r.highlight}:{};
    const last=parts[parts.length-1];
    if(last&&JSON.stringify(last.style)===JSON.stringify(style))last.text+=text[i];
    else parts.push({text:text[i],style});
  }
  return parts.map(p=>({text:p.text,...p.style}));
}
function joinedRow_(lines,rich) {
  let text='',map=[];
  lines.forEach(line=>{const trimmed=line.text.trim();if(!trimmed)return;const leading=line.text.length-line.text.trimStart().length;
    if(text){text+=' ';map.push(line.start-1);}
    text+=trimmed;for(let i=0;i<trimmed.length;i++)map.push(line.start+leading+i);
  });
  return {text,parts:richParts_(text,map,rich)};
}
function segmentRows_(lines,rich) {
  const result=[];let buffer=[];
  function flush(){if(buffer.length)result.push(joinedRow_(buffer,rich));buffer=[];}
  function strong(line){const row=joinedRow_([line],rich);return !!row.parts?.length&&row.parts.filter(p=>p.text.trim()).every(p=>p.bold);}
  lines.forEach(line=>{
    const text=line.text.trim();if(!text){flush();if(result.length&&result[result.length-1].text)result.push({text:'',parts:rich?.styled?[]:undefined});return;}
    const previous=buffer[buffer.length-1];
    const label=/^(?:[A-Za-z][A-Za-z /-]*\s*:|비슷한 표현|같이 해석|.*관련 표현|based in 비슷한 표현)/.test(text);
    if(previous&&(text.startsWith(':')||text.startsWith('→')||label||hasKorean_(previous.text)!==hasKorean_(text)||(/^[A-Za-z]/.test(text)&&/^[가-힣]/.test(previous.text.trim().replace(/^[:→]\s*/,'')))||strong(line)||strong(previous)))flush();
    buffer.push(line);
    if(/[.!?]$/.test(text)||/^(Pleasure|I am pleased|It[’']s|Honored|Lovely)\b/.test(text))flush();
  });flush();return result;
}
function dialogueRows_(questions,rich) {
  // Dialogue reflow normalizes whitespace; each output character retains its
  // original source position, including repeated words in the same text box.
  let normalized='',map=[],space=null;
  for(let i=0;i<rich.text.length;i++){
    if(/\s/.test(rich.text[i])){if(normalized)space=i;continue;}
    if(space!==null){normalized+=' ';map.push(space);space=null;}
    normalized+=rich.text[i];map.push(i);
  }
  let cursor=0;
  return questions.map(text=>{const start=normalized.indexOf(text,cursor);if(start<0)return {text};cursor=start+text.length;return {text,parts:richParts_(text,map.slice(start,cursor),rich)};});
}

function buildLesson_(deck, options) {
  options = options || {};
  const warnings = [];
  const slides = deck.slides.map(s => ({number:s.number, id:s.id, blocks:s.blocks.map(cleanText_).filter(Boolean), styledBlocks:s.styledBlocks, imageCount:s.imageCount || 0}));
  const dialogueSlides = slides.filter(s => dialogueLines_(s.blocks).length >= 2 && /[①-⑳]/.test(s.blocks.join('\n')));
  if (!dialogueSlides.length) throw new Error('화자 이름: 문장 형태의 대화를 찾지 못했습니다. 현재는 예시와 같은 영어 수업 슬라이드 형식을 지원합니다.');
  const first = dialogueSlides[0];
  const questions = dialogueLines_(first.blocks);
  const markers = Array.from(new Set((questions.join('\n').match(/[①-⑳]/g) || [])));
  if (!markers.length) throw new Error('대화에서 ①, ② 같은 문제 번호를 찾지 못했습니다.');
  const sections = [];
  let current = null;
  const contentSlides = new Set();
  const usedSlides = new Set(dialogueSlides.map(s => s.number));
  slides.forEach(slide => {
    if (slide.number <= first.number || usedSlides.has(slide.number)) return;
    if (!slide.blocks.length) {
      if (slide.imageCount) warnings.push(slide.number + '번: 이미지 속 글자는 읽지 않습니다. 미리보기와 원본을 비교해 주세요.');
      return;
    }
    const text = slide.blocks.join('\n');
    if (/^(다시보기|수업 노트|테스트|Thank you|감사합니다)/i.test(text)) { usedSlides.add(slide.number); return; }
    const rich=slideRich_(slide);
    const lines = richLines_(rich);
    const quoted=rich.text.match(/^[“"]([^”"]+)[”"](?:[ \t]*\n|$)/);
    const heading = quoted ? normalize_(quoted[1]) : null;
    if (heading) {
      const existing = sections.find(s => normalize_(s.expression) === normalize_(heading));
      if (existing) current = existing;
      else { current = {expression:heading, meaning:'', paragraphs:[], paragraphRows:[], slideNumbers:[]}; sections.push(current); }
      const headingLines=lines.splice(0,quoted[0].trimEnd().split('\n').length);
      if(!existing)current.expressionRow=joinedRow_(headingLines,rich);
      if (!existing) {
        const meaning = [];
        while (lines.length && /^[가-힣]/.test(lines[0].text.trim()) && !/^(비슷한 표현|같이 해석)/.test(lines[0].text.trim())) meaning.push(lines.shift());
        current.meaningRow=joinedRow_(meaning,rich);
        current.meaning = current.meaningRow.text;
      }
    }
    if (!current) { warnings.push(slide.number + '번: 섹션을 판별하지 못했습니다. ' + normalize_(text).slice(0,100)); return; }
    const fingerprint=JSON.stringify([current.expression,rich.text,rich.runs]);
    if(contentSlides.has(fingerprint)){usedSlides.add(slide.number);return;}
    contentSlides.add(fingerprint);
    current.slideNumbers.push(slide.number);
    segmentRows_(lines,rich).forEach(row => {
      // Identical vocabulary labels can introduce different examples. Only
      // repeated quoted slide headings are structural duplicates.
      current.paragraphs.push(row.text);current.paragraphRows.push(row);
    });
    usedSlides.add(slide.number);
  });
  const answers = markers.map((marker, i) => {
    const questionLine = questions.find(line => line.includes(marker));
    const qPart = questionLine.split(marker)[1].split(/[①-⑳]/)[0];
    const candidates = [], answeredParts=[], reveals=[];
    dialogueSlides.forEach(s => {
      const line = dialogueLines_(s.blocks).find(l => l.split(':')[0] === questionLine.split(':')[0] && l.includes(marker));
      if (!line) return;
      const part = line.split(marker)[1].split(/[①-⑳]/)[0];
      if (normalize_(part) !== normalize_(qPart)) {
        const answer = changedAnswer_(qPart, part);
        if (answer && !hasKorean_(answer)) { candidates.push(answer); answeredParts.push(part); reveals.push(s.number); }
      }
    });
    // 따옴표로 정의된 핵심 표현과 정답을 대조해서 연결한다.
    const unique = Array.from(new Set(candidates));
    const matches=sections.filter(s=>unique.some(a=>expressionKey_(s.expression)===expressionKey_(a)) || answeredParts.some(part=>{
      const phrase=expressionKey_(s.expression), full=expressionKey_(part);
      return phrase.length>=8 && (full===phrase || full.startsWith(phrase+' ') || full.startsWith(phrase+'.') || full.startsWith(phrase+'!') || full.startsWith(phrase+'?'));
    }));
    // 대화 직후 핵심 표현을 설명하는 원본 순서로도 연결한다.
    // 제목에 오타가 있어도 대화의 실제 정답 문장은 그대로 유지한다.
    let section=matches.length===1?matches[0]:null;
    let positional=false;
    if(!section&&reveals.length){
      const reveal=Math.min(...reveals);
      const nextDialogue=dialogueSlides.find(s=>s.number>reveal);
      const following=sections.filter(s=>s.slideNumbers[0]>reveal&&(!nextDialogue||s.slideNumbers[0]<nextDialogue.number));
      if(following.length){section=following[0];positional=true;}
    }
    // The quoted key phrase can abbreviate the answer. Always retain the
    // complete revealed replacement, excluding unchanged dialogue context.
    let text = unique[0];
    if (!text) { text = '[정답 확인 필요]'; warnings.push(marker + ' 정답을 원본에서 찾지 못했습니다.'); }
    if (unique.length > 1 && !section) warnings.push(marker + ' 정답 후보가 여러 개입니다. 원본과 비교해 주세요.');
    return {marker, text, sectionIndex:section ? sections.indexOf(section) : -1};
  });
  // Unmatched quoted phrases are supporting material, not extra questions.
  // Keep their source heading/meaning/body under the preceding primary item.
  const primary = new Set(answers.filter(a=>a.sectionIndex>=0).map(a=>sections[a.sectionIndex]));
  const grouped=[];let parent=null;const pending=[];
  function appendSupporting(target,section){
    const additional=[section.expressionRow || {text:'“'+section.expression+'”'},...(section.meaning?[section.meaningRow || {text:section.meaning}]:[]),...section.paragraphRows];
    additional.forEach(row=>{target.paragraphRows.push(row);target.paragraphs.push(row.text);});
    target.slideNumbers.push(...section.slideNumbers);
  }
  sections.forEach(section=>{
    if(primary.has(section)){grouped.push(section);parent=section;pending.splice(0).forEach(s=>appendSupporting(parent,s));return;}
    if(!parent){pending.push(section);return;}
    appendSupporting(parent,section);
  });
  if(grouped.length){
    answers.forEach(a=>{a.sectionIndex=grouped.indexOf(sections[a.sectionIndex]);});
    sections.splice(0,sections.length,...grouped);
  }
  if (sections.length !== markers.length) warnings.push('문제 ' + markers.length + '개 / 핵심 표현 ' + sections.length + '개: 번호 연결을 확인해 주세요.');
  if (!sections.length) throw new Error('따옴표로 시작하는 핵심 표현 슬라이드를 찾지 못했습니다.');
  const level = options.level || ((deck.title.match(/LV\s*(\d+)/i) || [])[1] ? 'LV' + deck.title.match(/LV\s*(\d+)/i)[1] : '');
  const lessonNumber = String(options.lessonNumber || (deck.title.match(/(\d+)강/) || [])[1] || '').trim();
  if (!level || !lessonNumber) throw new Error('레벨과 Lesson 번호를 입력해 주세요.');
  const titleSlide = slides.find(s => s.number < first.number && s.blocks.length && /^[A-Za-z]/.test(s.blocks[0]));
  const title = options.lessonTitle || (titleSlide ? normalize_(titleSlide.blocks[0]) : deck.title.replace(/^.*?\d+강[_\s]*/,''));
  return {level, lessonNumber, title, documentTitle:'[' + level + '] 라이브노트_' + lessonNumber + '강_' + title, dialogue:questions, dialogueRows:dialogueRows_(questions,slideRich_(first)), answers, sections, warnings, slideCount:slides.length, dialogueSlideCount:dialogueSlides.length};
}

function lessonRows_(lesson) {
  const rows = [{role:'section',text:'Dialogues'},{role:'body',text:'',keepNext:true}];
  (lesson.dialogueRows || lesson.dialogue.map(text=>({text}))).forEach(row => rows.push({role:'body',...row}));
  rows.push({role:'body',text:''},{role:'label',text:'정답:'});
  lesson.answers.forEach(a => rows.push({role:'body',text:a.marker + ' ' + a.text}));
  rows.push({role:'pageBreak'},{role:'section',text:'Key Points'},{role:'body',text:'',keepNext:true});
  lesson.sections.forEach((s,i) => {
    if (i > 0) rows.push({role:'body',text:''});
    const answer = lesson.answers.find(a => a.sectionIndex === i);
    rows.push({role:'number',text:'#' + (answer ? answer.marker.charCodeAt(0)-'①'.charCodeAt(0)+1 : i+1)});
    rows.push({role:'expression',...(s.expressionRow || {text:'“' + s.expression + '”'})});
    if (s.meaning) rows.push({role:'expression',...(s.meaningRow || {text:s.meaning})});
    rows.push({role:'body',text:'',keepNext:true});
    const sources=s.paragraphRows || s.paragraphs.map(text=>({text}));
    sources.forEach((source,index) => {
      const raw=source.text;
      const text = raw;
      let role = /비슷한 표현|관련 표현|같이 해석/.test(text) ? 'label' : 'body';
      if (text.startsWith('→')) role='note';
      const next=sources[index+1]?.text || '';
      const paired=/[A-Za-z]/.test(text)&&!hasKorean_(text)&&/^(?:[:→]\s*)?[가-힣]/.test(next);
      const heading=/^[A-Za-z]/.test(text)&&text.length<70&&source.parts?.filter(p=>p.text.trim()).every(p=>p.bold);
      rows.push({role,...source,keepNext:paired||heading});
    });
  });
  return rows;
}

function styledParts_(row) {
  if(row.parts)return row.parts;
  const ranges=[];
  const text=row.text || '';
  if(row.role==='body') {
    const speaker=text.match(/^[A-Za-z][A-Za-z .'-]{0,35}(?=:)/);
    if(speaker)ranges.push({start:0,end:speaker[0].length,bold:true});
    const re=/[①-⑳][^①-⑳]*/g;let m;
    while((m=re.exec(text)))if(hasKorean_(m[0])) {
      // 번호 뒤 한국어 문제만 강조하고 뒤의 영어 대사는 제외.
      const korean=m[0].match(/^[①-⑳]\s*[^A-Za-z]+/);
      const len=korean ? korean[0].trimEnd().length : m[0].length;
      ranges.push({start:m.index,end:m.index+len,highlight:'DFFFCA'});
    }
  }
  const breaks=Array.from(new Set([0,text.length,...ranges.flatMap(r=>[r.start,r.end])])).sort((a,b)=>a-b);
  return breaks.slice(0,-1).map((start,i)=>{
    const active=ranges.filter(r=>r.start<=start&&r.end>=breaks[i+1]);
    return {text:text.slice(start,breaks[i+1]),bold:active.some(r=>r.bold)?true:undefined,highlight:active.find(r=>r.highlight)?.highlight};
  });
}

function validateLesson_(lesson) {
  const errors=[];
  if(lesson.answers.some(a=>a.text==='[정답 확인 필요]'||a.sectionIndex<0))errors.push('정답을 원본 핵심 표현에 연결하지 못했습니다.');
  if(lesson.answers.length!==lesson.sections.length || new Set(lesson.answers.map(a=>a.sectionIndex)).size!==lesson.answers.length)errors.push('문제와 핵심 표현 번호가 일대일로 연결되지 않았습니다.');
  lessonRows_(lesson).forEach(row=>{
    if(row.parts&&row.parts.map(p=>p.text).join('')!==row.text)errors.push('본문과 강조 구간의 글자가 일치하지 않습니다.');
  });
  // An unclassified text slide is a potential omission; never call this a
  // successful conversion just because the four answers were found.
  lesson.warnings.filter(w=>w.includes('섹션을 판별')).forEach(w=>errors.push(w));
  return {ok:!errors.length,errors:Array.from(new Set(errors)),reviewSlides:lesson.warnings.filter(w=>w.includes('이미지 속'))};
}
