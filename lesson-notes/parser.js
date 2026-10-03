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
  return b.slice(start, endB).trim();
}

function segments_(lines) {
  const result = [];
  let buffer = [];
  function flush() { if (buffer.length) result.push(buffer.join(' ')); buffer = []; }
  lines.forEach(raw => {
    const line = raw.trim();
    if (!line) { flush(); return; }
    // 영어 예문과 한국어 뜻, 새 용어, 소제목은 서로 다른 문단으로 유지.
    const prev = buffer[buffer.length - 1] || '';
    const label = /^(?:[A-Za-z][A-Za-z /-]*\s*:|비슷한 표현|같이 해석|.*관련 표현|based in 비슷한 표현)/.test(line);
    if (buffer.length && (line.startsWith(':') || line.startsWith('→') || label || hasKorean_(prev) !== hasKorean_(line))) flush();
    buffer.push(line.replace(/^:\s*(?=[A-Za-z])/, ''));
    // 짧은 유사 표현 리스트도 합쳐 버리지 않도록 문장 끝에서 분리.
    if (/[.!?]$/.test(line) || /^(Pleasure|I am pleased|It[’']s|Honored|Lovely)\b/.test(line)) flush();
  });
  flush();
  return result;
}

function buildLesson_(deck, options) {
  options = options || {};
  const warnings = [];
  const slides = deck.slides.map(s => ({number:s.number, id:s.id, blocks:s.blocks.map(cleanText_).filter(Boolean), imageCount:s.imageCount || 0, highlights:s.highlights || []}));
  const dialogueSlides = slides.filter(s => dialogueLines_(s.blocks).length >= 2 && /[①-⑳]/.test(s.blocks.join('\n')));
  if (!dialogueSlides.length) throw new Error('화자 이름: 문장 형태의 대화를 찾지 못했습니다. 현재는 예시와 같은 영어 수업 슬라이드 형식을 지원합니다.');
  const first = dialogueSlides[0];
  const questions = dialogueLines_(first.blocks);
  const markers = Array.from(new Set((questions.join('\n').match(/[①-⑳]/g) || [])));
  if (!markers.length) throw new Error('대화에서 ①, ② 같은 문제 번호를 찾지 못했습니다.');
  const sections = [];
  let current = null;
  const usedSlides = new Set(dialogueSlides.map(s => s.number));
  slides.forEach(slide => {
    if (slide.number <= first.number || usedSlides.has(slide.number)) return;
    if (!slide.blocks.length) {
      if (slide.imageCount) warnings.push(slide.number + '번: 이미지 속 글자는 읽지 않습니다. 미리보기와 원본을 비교해 주세요.');
      return;
    }
    const text = slide.blocks.join('\n');
    if (/^(다시보기|수업 노트|테스트|Thank you|감사합니다)/i.test(text)) { usedSlides.add(slide.number); return; }
    const lines = text.split('\n');
    const quoted=lines.join('\n').match(/^[“"]([^”"]+)[”"](?:[ \t]*\n|$)/);
    const heading = quoted ? normalize_(quoted[1]) : null;
    if (heading) {
      const existing = sections.find(s => normalize_(s.expression) === normalize_(heading));
      if (existing) current = existing;
      else { current = {expression:heading, meaning:'', paragraphs:[], slideNumbers:[], highlights:[]}; sections.push(current); }
      lines.splice(0,quoted[0].trimEnd().split('\n').length);
      if (!existing) {
        const meaning = [];
        while (lines.length && lines[0].trim()) meaning.push(lines.shift().trim());
        current.meaning = meaning.join(' ');
      }
    }
    if (!current) { warnings.push(slide.number + '번: 섹션을 판별하지 못했습니다. ' + normalize_(text).slice(0,100)); return; }
    current.slideNumbers.push(slide.number);
    slide.highlights.forEach(term => {
      const normalized = normalize_(term).replace(/\s+(me|you|us|them)$/i,'');
      if (normalized && !current.highlights.includes(normalized)) current.highlights.push(normalized);
    });
    segments_(lines).forEach(line => {
      // 같은 슬라이드의 반복 제목만 제거. 서로 다른 예문은 유지.
      if (!current.paragraphs.includes(line)) current.paragraphs.push(line);
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
      if(following.length===1){section=following[0];positional=true;}
    }
    let text = section && !positional ? section.expression : unique[0];
    if (!text) { text = '[정답 확인 필요]'; warnings.push(marker + ' 정답을 원본에서 찾지 못했습니다.'); }
    if (unique.length > 1 && !section) warnings.push(marker + ' 정답 후보가 여러 개입니다. 원본과 비교해 주세요.');
    return {marker, text, sectionIndex:section ? sections.indexOf(section) : -1};
  });
  if (sections.length !== markers.length) warnings.push('문제 ' + markers.length + '개 / 핵심 표현 ' + sections.length + '개: 번호 연결을 확인해 주세요.');
  if (!sections.length) throw new Error('따옴표로 시작하는 핵심 표현 슬라이드를 찾지 못했습니다.');
  const level = options.level || ((deck.title.match(/LV\s*(\d+)/i) || [])[1] ? 'LV' + deck.title.match(/LV\s*(\d+)/i)[1] : '');
  const lessonNumber = String(options.lessonNumber || (deck.title.match(/(\d+)강/) || [])[1] || '').trim();
  if (!level || !lessonNumber) throw new Error('레벨과 Lesson 번호를 입력해 주세요.');
  const titleSlide = slides.find(s => s.number < first.number && s.blocks.length && /^[A-Za-z]/.test(s.blocks[0]));
  const title = options.lessonTitle || (titleSlide ? normalize_(titleSlide.blocks[0]) : deck.title.replace(/^.*?\d+강[_\s]*/,''));
  return {level, lessonNumber, title, documentTitle:'[' + level + '] 라이브노트_' + lessonNumber + '강_' + title, dialogue:questions, answers, sections, warnings, slideCount:slides.length, dialogueSlideCount:dialogueSlides.length};
}

function lessonRows_(lesson) {
  const rows = [{role:'section',text:'Dialogues'}];
  lesson.dialogue.forEach(text => rows.push({role:'body',text}));
  rows.push({role:'body',text:''},{role:'label',text:'정답:'});
  lesson.answers.forEach(a => rows.push({role:'body',text:a.marker + ' ' + a.text}));
  rows.push({role:'pageBreak'},{role:'section',text:'Key Points'});
  lesson.sections.forEach((s,i) => {
    if (i > 0) rows.push({role:'pageBreak'});
    const answer = lesson.answers.find(a => a.sectionIndex === i);
    rows.push({role:'number',text:'#' + (answer ? answer.marker.charCodeAt(0)-'①'.charCodeAt(0)+1 : i+1)});
    rows.push({role:'expression',text:'“' + s.expression + '”'});
    if (s.meaning) rows.push({role:'expression',text:s.meaning});
    rows.push({role:'body',text:''});
    let previous = '';
    s.paragraphs.forEach(raw => {
      if (normalize_(raw).replace(/[.!?]$/,'') === normalize_(s.expression).replace(/[.!?]$/,'')) return;
      let text = raw;
      let role = /비슷한 표현|관련 표현|같이 해석/.test(text) ? 'label' : 'body';
      if (text.startsWith('→')) { role='note'; text=text.replace(/^→\s*/,''); }
      else if (/^[가-힣]/.test(text) && /^[A-Za-z]/.test(previous) && /[.!?]$/.test(previous)) text=': ' + text;
      rows.push({role,text,highlights:s.highlights || []});
      previous=text;
    });
  });
  return rows;
}

function styledParts_(row) {
  const ranges=[];
  const text=row.text || '';
  (row.highlights || []).forEach(term => {
    if (!term) return;
    let index=text.toLowerCase().indexOf(term.toLowerCase());
    while(index>=0){ranges.push({start:index,end:index+term.length,highlight:'D9EAD3'});index=text.toLowerCase().indexOf(term.toLowerCase(),index+term.length);}
  });
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
    return {text:text.slice(start,breaks[i+1]),bold:active.some(r=>r.bold),highlight:active.find(r=>r.highlight)?.highlight};
  });
}
