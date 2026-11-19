import {quizPlan, quizWorkbook} from './quizn-export.mjs?v=1';
const MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const DARK = '111111';
const FONT = 'Noto Sans KR';
const SLIDE_WIDTH = 20;
const SLIDE_MARGIN = .625;
let library;
const badges = {
  concept: { fill:'162014', line:'3E6134', divider:'527550', width:2.074, height:.479 },
  key: { fill:'132022', line:'386269', divider:'4E747B', width:1.826, height:.479 },
  exam: { fill:'141C28', line:'37587A', divider:'53769A', width:2.198, height:.38 },
  closing: { fill:'231B33', line:'60527E', divider:'8874A8', width:2.074, height:.42 },
};
const badgeImages = new Map();

function loadBadge(kind) {
  if (!badgeImages.has(kind)) {
    const pending = fetch(new URL('./projection-badges/' + kind + '.png', import.meta.url)).then(async response => {
      if (!response.ok) throw Error('교재 코너 배지를 불러오지 못했습니다.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return 'data:image/png;base64,' + btoa(binary);
    }).catch(error => { badgeImages.delete(kind); throw error; });
    badgeImages.set(kind, pending);
  }
  return badgeImages.get(kind);
}

function loadPptx() {
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
  library ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('./vendor/pptxgen-4.0.1.js', import.meta.url).href;
    script.onload = () => window.PptxGenJS ? resolve(window.PptxGenJS) : reject(Error('PPT 기능을 열지 못했습니다.'));
    script.onerror = () => reject(Error('PPT 기능을 열지 못했습니다.'));
    document.head.append(script);
  }).catch(error => { library = null; throw error; });
  return library;
}

function equationRuns(value) {
  const lines = value.replaceAll('⁄', '/').split('\n');
  return lines.flatMap((line, index) => {
    const runs = [];
    let start = 0;
    for (const match of line.matchAll(/\^\{([^{}]{1,60})\}/g)) {
      if (match.index > start) runs.push({ text:line.slice(start, match.index) });
      runs.push({ text:match[1], options:{ superscript:true } });
      start = match.index + match[0].length;
    }
    if (start < line.length || !runs.length) runs.push({ text:line.slice(start) || ' ' });
    if (index < lines.length - 1) {
      const last = runs.at(-1);
      last.options = { ...last.options, breakLine:true };
    }
    return runs;
  });
}

// Paint the badge on one baseline. Slides importers may independently wrap text boxes.
const HEADER_Y = .62;
const BODY_TOP = 1.65;
// The reference deck reserves the right-hand side for live writing.
const BODY_WIDTH = 10.31;
const BODY_HEIGHT = 6.5;
const CIRCLED = '①②③④⑤';

async function frame(deck, label, source, style, book) {
  const slide = deck.addSlide();
  slide.background = { color:DARK };
  const kind = book === '개념원리' && (
    label === '개념원리 확인하기' ? 'concept' : label.startsWith('핵심문제') ? 'key' :
    label.includes('시험에 나온다') ? 'exam' : label === '중단원 마무리하기' ? 'closing' : null
  );
  const theme = badges[kind] ?? (style === 'teacher'
    ? { fill:'352A13', line:'88692F', divider:'B39754' }
    : { fill:'231B33', line:'60527E', divider:'8874A8' });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const dpi = 300, height = .635;
  const font = size => '700 ' + (size * dpi / 72) + 'px "' + FONT + '", sans-serif';
  ctx.font = font(16);
  const sectionWidth = kind ? theme.width : ctx.measureText(label).width / dpi;
  const divider = .15 + sectionWidth + .18;
  const titleStart = divider + .17;
  ctx.font = font(19);
  const width = Math.min(BODY_WIDTH, titleStart + ctx.measureText(source).width / dpi + .19);
  canvas.width = Math.ceil(width * dpi); canvas.height = Math.ceil(height * dpi);
  ctx.scale(dpi,dpi);
  ctx.fillStyle = '#' + theme.fill; ctx.strokeStyle = '#' + theme.line; ctx.lineWidth = .014;
  ctx.beginPath(); ctx.roundRect(.009,.009,width-.018,height-.018,.09); ctx.fill(); ctx.stroke();
  ctx.textBaseline = 'middle'; ctx.fillStyle = '#E4DDF2';
  const setFont = size => { ctx.font = '700 ' + size / 72 + 'px "' + FONT + '", sans-serif'; };
  if (kind) {
    const img = new Image(); img.src = await loadBadge(kind); await img.decode();
    ctx.drawImage(img,.155,(height-theme.height)/2,theme.width,theme.height);
  } else {
    setFont(16); ctx.fillText(label,.15,height/2,sectionWidth+.01);
  }
  ctx.fillStyle = '#' + theme.divider; ctx.fillRect(divider,.19,.015,height-.38);
  setFont(19); ctx.fillStyle = '#fff'; ctx.fillText(source,titleStart,height/2,width-titleStart-.14);
  slide.addImage({data:canvas.toDataURL('image/png'),x:SLIDE_MARGIN,y:HEADER_Y,w:width,h:height,altText:label+' | '+source});
  return slide;
}

function bookSource(question, hasPrintedNumber) {
  return [question.book, hasPrintedNumber && question.page ? question.page + 'p' : question.label].filter(Boolean).join(' ');
}

function paintProblem(image, crop, paper = false) {
  if (!Array.isArray(crop) || crop.length !== 4 ||
      !crop.every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
    throw Error('문항 이미지 범위를 확인해 주세요.');
  }
  const [left, top, right, bottom] = crop;
  const x = Math.round(left * image.width), y = Math.round(top * image.height);
  const w = Math.round(right * image.width) - x, h = Math.round(bottom * image.height) - y;
  if (w < 8 || h < 8) {
    throw Error('문항 자르기 영역을 확인해 주세요.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, x, y, w, h, 0, 0, w, h);
  const ink = context.getImageData(0, 0, w, h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 0; i < ink.data.length; i += 4) {
    const r = ink.data[i], g = ink.data[i + 1], b = ink.data[i + 2];
    // Invert ink lightness while preserving hue. Coverage stays continuous at antialiased edges.
    const hi = Math.max(r, g, b);
    const lo = Math.min(r, g, b);
    if (lo < 233) {
      const px = (i / 4) % w, py = Math.floor(i / 4 / w);
      minX = Math.min(px,minX); maxX = Math.max(px,maxX); minY = Math.min(py,minY); maxY = Math.max(py,maxY);
    }
    if (paper) continue;
    for (let channel = 0; channel < 3; channel++) {
      const coverage = (255 - hi + ink.data[i + channel] - lo) / 255;
      ink.data[i + channel] = 17 + 238 * Math.pow(coverage, .72);
    }
  }
  if (!paper) context.putImageData(ink, 0, 0);
  if (maxX < minX || maxY < minY) throw Error('문항 이미지 안에서 내용을 확인하지 못했습니다.');
  const pad = 5;
  const trimmed = document.createElement('canvas');
  trimmed.width = maxX - minX + 1 + 2 * pad;
  trimmed.height = maxY - minY + 1 + 2 * pad;
  const out = trimmed.getContext('2d');
  out.fillStyle = paper ? '#fff' : '#' + DARK;
  out.fillRect(0, 0, trimmed.width, trimmed.height);
  out.drawImage(canvas, minX, minY, trimmed.width - 2 * pad, trimmed.height - 2 * pad,
    pad, pad, trimmed.width - 2 * pad, trimmed.height - 2 * pad);
  return trimmed;
}

function placeProblem(slide, image) {
  const panels = image.parts ?? [image.canvas];
  const sizes = panels.map(panel => {
    const scale = Math.min(image.scale, BODY_WIDTH / panel.width);
    return {w:panel.width * scale, h:panel.height * scale};
  });
  const gap = .20;
  const height = sizes.reduce((sum, size) => sum + size.h, 0) + gap * (panels.length - 1);
  const fit = Math.min(1, BODY_HEIGHT / height);
  let y = BODY_TOP + Math.min(.42, (BODY_HEIGHT - height * fit) / 2);
  for (let i = 0; i < panels.length; i++) {
    const w = sizes[i].w * fit, h = sizes[i].h * fit;
    slide.addImage({data:panels[i].toDataURL('image/png'), x:SLIDE_MARGIN, y, w, h});
    y += h + gap * fit;
  }
}

function convertedPage(original, meta) {
  if (!meta?.erase) return original;
  const page = document.createElement('canvas');
  page.width = original.width;
  page.height = original.height;
  const ctx = page.getContext('2d');
  ctx.drawImage(original, 0, 0);
  const pixels = ([x0,y0,x1,y1]) => [x0*page.width,y0*page.height,(x1-x0)*page.width,(y1-y0)*page.height];
  ctx.fillStyle = '#fff';
  ctx.fillRect(...pixels(meta.erase));
  if (meta.replaceNumber) {
    const [from, to] = meta.replaceNumber.map(pixels);
    ctx.fillRect(...to);
    ctx.drawImage(original, ...from, ...to);
  }
  return page;
}

function combine(panels, gap, horizontal = false, alignBottom = false, background = '#' + DARK) {
  if (panels.length === 1) return panels[0];
  const canvas = document.createElement('canvas');
  const widths = panels.map(p => p.width), heights = panels.map(p => p.height);
  const sum = values => values.reduce((a,b) => a+b,0) + gap*(panels.length-1);
  canvas.width = horizontal ? sum(widths) : Math.max(...widths);
  canvas.height = horizontal ? Math.max(...heights) : sum(heights);
  const ctx = canvas.getContext('2d'); ctx.fillStyle=background; ctx.fillRect(0,0,canvas.width,canvas.height);
  let offset = 0;
  for (const panel of panels) {
    const y = horizontal ? (alignBottom ? canvas.height-panel.height : (canvas.height-panel.height)/2) : offset;
    ctx.drawImage(panel,horizontal ? offset : 0,y);
    offset += (horizontal ? panel.width : panel.height) + gap;
  }
  return canvas;
}

function textPanel(value, size, paper = false) {
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  const font=size+'px "'+FONT+'", sans-serif';
  ctx.font=font;
  canvas.width=Math.ceil(ctx.measureText(value).width)+10;
  canvas.height=Math.ceil(size*1.52);
  ctx.fillStyle=paper?'#fff':'#'+DARK;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.font=font;ctx.fillStyle=paper?'#111':'#fff';ctx.textBaseline='middle';ctx.fillText(value,4,canvas.height/2);
  return canvas;
}

function pairIndices(quiz) {
  const rows=quiz.choices.split('\n').map(choice=>choice.split(/\s*·\s*/).map(value=>Array.from(CIRCLED).indexOf(value)));
  if (rows.length!==4 || rows.some(row=>row.length<2 || row.some(i=>i<0))) throw Error('묶음 보기 네 개를 확인해 주세요.');
  return rows;
}

function pairPanel(page, quiz, layout, paper = false) {
  const label = (value, size) => textPanel(value, size, paper);
  const join = (parts, gap, horizontal) => combine(parts, gap, horizontal, false, paper ? '#fff' : '#' + DARK);
  const rows=pairIndices(quiz);
  const size=Math.round(page.width*.018), gap=Math.round(size*.38);
  if (layout.question && layout.values?.length===5) {
    const lines=rows.map((row,i)=>label(CIRCLED[i]+'   '+row.map(j=>layout.values[j]).join(',   '),size));
    return join([label(layout.question, size), ...lines],gap);
  }
  const {stem,cells,markers}=layout.pairs;
  const question=paintProblem(page,stem,paper);
  const cleaned=document.createElement('canvas');cleaned.width=page.width;cleaned.height=page.height;
  const ctx=cleaned.getContext('2d');ctx.drawImage(page,0,0);ctx.fillStyle='#fff';
  for(const [l,t,r,b] of markers)ctx.fillRect(l*page.width,t*page.height,(r-l)*page.width,(b-t)*page.height);
  const values=cells.map(cell=>paintProblem(cleaned,cell,paper));
  const separator=label('·',size);
  const lines=rows.map((row,i)=>{
    const parts=[label(CIRCLED[i],size)];
    row.forEach((v,j)=>{if(j)parts.push(separator); if(layout.pairs.graphReferences)parts.push(label('그래프 '+CIRCLED[v],size*.86)); parts.push(values[v]);});
    return join(parts,gap,true);
  });
  return join([question,label('해당하는 항목을 묶은 보기를 하나 고르세요.',size*.83),...lines],gap);
}

export async function bookQuizPreview(question, loadImage, paper = false) {
  if (paper) return paperQuizImage(question,loadImage);
  return (await projectionProblem(question, loadImage)).canvas;
}

async function projectionProblem(question, loadImage) {
  const quiz=question.quiz_override, meta=quiz?.book_quiz, layout=question.projection_layout ?? {};
  const image=await createImageBitmap(await loadImage(meta ? {...question,projection_asset:null} : question));
  try {
    let canvas, parts;
    let scale=.025 * 1075 / image.width;
    if (question.projection_asset && !meta) {
      canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      canvas.getContext('2d').drawImage(image,0,0);scale=1/125;
    } else {
      if (image.width<2200) throw Error('발표용 원본 해상도가 부족합니다. 교재 쪽을 확인해 주세요.');
      const page=convertedPage(image,meta);
      const gap=Math.round(.011*image.width);
      if (meta?.mode==='pairs') {
        if (!layout.pairs) throw Error('묶음 보기의 원본 위치를 확인해 주세요.');
        canvas=pairPanel(page,quiz,layout);
      } else if (layout.stemRows?.length && layout.body && !question.bundle_parts && !question.slide_prompt_crop) {
        const stem=combine(layout.stemRows.map(r=>paintProblem(page,r)),0,true,true);
        parts=[stem, paintProblem(page,layout.body)];
        canvas=combine(parts,gap);
      } else {
        const parts=question.bundle_parts ?? [question.slide_prompt_crop, meta?.crop ?? layout.bounds ?? question.slide_crop].filter(Boolean);
        if (!parts.length) throw Error('문항 이미지 범위가 없습니다.');
        canvas=combine(parts.map(r=>paintProblem(page,r)),gap);
      }
      if (meta?.mode==='diagram') {
        const options=meta.retained?.map((v,i)=>CIRCLED[i]+'  그래프 '+CIRCLED[v-1]);
        if (options?.length!==4) throw Error('그래프 보기를 확인해 주세요.');
        canvas=combine([canvas,textPanel(options.join('      '),Math.round(image.width*.016))],gap);
      }
    }
    return {canvas, scale, parts};
  } finally {image.close();}
}

async function addQuestionImage(slide, question, loadImage) {
  try {
    placeProblem(slide, await projectionProblem(question, loadImage));
  } catch (error) {
    throw Error([question.book, question.label].filter(Boolean).join(' ') + ' · ' + error.message, { cause:error });
  }
}

function placeQuiz(slide, quiz) {
  const options = quiz.kind === 'choice' ? quiz.choices.split('\n') : [];
  if (quiz.kind === 'choice' && (options.length !== 4 || options.some(choice => !choice.trim()) || !/^[1-4]$/.test(quiz.answer))) {
    throw Error('객관식 문항의 보기 4개와 정답을 확인해 주세요.');
  }
  const choices = options.length ? '\n\n' + options.map((choice, index) => (index + 1) + '. ' + choice).join('\n')
    : quiz.kind === 'ox' ? '\n\nO   /   X' : '';
  slide.addText(equationRuns(quiz.prompt + choices), {
    x: SLIDE_MARGIN, y: BODY_TOP + .42, w: BODY_WIDTH, h: BODY_HEIGHT, color: 'FFFFFF', margin: 0, valign: 'top', fontFace: FONT,
    fontSize: 26, fit: 'shrink', breakLine: false,
  });
  slide.addNotes('정답 ' + quiz.answer);
}

export async function buildPresentation({
  title, picks, quizzes, appendix, stageLabel = '퀴즈앤 ② · 교사부록', quizLabel = '퀴즈앤 ① · 직접 제작',
}, loadImage) {
  const Pptx = await loadPptx();
  const deck = new Pptx();
  deck.defineLayout({ name:'PROJECTION', width:SLIDE_WIDTH, height:11.25 });
  deck.layout = 'PROJECTION';
  deck.title = title;
  deck.author = 'Socra LX팀';
  deck.lang = 'ko-KR';

  for (const question of picks) {
    const slide = await frame(deck, question.section, bookSource(question, !question.projection_asset), 'lesson', question.book);
    await addQuestionImage(slide, question, loadImage);
    slide.addNotes('수업 문항 ' + question.slot + '번 · ' + question.book + ' ' + question.label);
  }
  for (const quiz of quizzes) {
    const slide = await frame(deck, quizLabel, '문항 ' + quiz.slot, 'teacher');
    placeQuiz(slide, quiz);
  }
  for (const question of appendix) {
    const slide = await frame(deck, question.stageLabel ?? stageLabel,
      bookSource(question, (!question.quiz_override || question.quiz_override.book_quiz) && !question.projection_asset), question.quizOne ? 'teacher' : 'appendix');
    const quiz = question.quiz_override;
    if (quiz?.book_quiz) {
      await addQuestionImage(slide, question, loadImage);
      slide.addNotes(bookSource(question,false) + ' · 정답 ' + quiz.answer);
    } else if (question.quiz_override) placeQuiz(slide, { kind: 'choice', ...question.quiz_override });
    else await addQuestionImage(slide, question, loadImage);
  }
  return new Blob([await deck.write({ outputType: 'arraybuffer', compression: true })], { type: MIME });
}

// QuizN text questions use the same exponent notation as slides. Wrap before
// drawing so long Korean prompts and narrow superscripts keep their full extent.
function writtenQuizImage(quiz) {
  const choices = quiz.kind === 'choice' ? quiz.choices.split('\n').map((v,i)=>CIRCLED[i]+' '+v) : [];
  const blocks = [quiz.prompt, ...choices].join('\n\n').split('\n');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const lines = [[]];
  const maxWidth = 1360, margin = 32, lineHeight = 58;
  let width = 0, longest = 0;
  for (const [index,block] of blocks.entries()) {
    if (index) { lines.push([]); width = 0; }
    for (const run of equationRuns(block)) {
      const raised = Boolean(run.options?.superscript);
      const font = (raised ? 27 : 40) + 'px "' + FONT + '", sans-serif';
      ctx.font = font;
      for (const ch of run.text) {
        const advance = ctx.measureText(ch).width;
        if (width + advance > maxWidth) { lines.push([]); width = 0; }
        lines.at(-1).push({ch, x:width, font, raised});
        width += advance;
        longest = Math.max(longest,width);
      }
    }
  }
  canvas.width = Math.ceil(longest) + margin*2;
  canvas.height = lines.length*lineHeight + margin*2;
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#111';
  lines.forEach((line,i)=>{for (const glyph of line) {
    ctx.font=glyph.font;
    ctx.fillText(glyph.ch, margin+glyph.x, margin+i*lineHeight+(glyph.raised?20:38));
  }});
  return canvas;
}

async function paperQuizImage(question, loadPage) {
  const quiz = question.quiz_override, meta = quiz?.book_quiz;
  if (quiz && !meta) return writtenQuizImage({...quiz,kind:'choice'});
  const page = await createImageBitmap(await loadPage({...question,projection_asset:null}));
  try {
    if (page.width < 2200) throw Error('고해상도 교재 원본을 확인해 주세요.');
    const layout = question.projection_layout ?? {};
    const original = convertedPage(page,meta);
    if (meta?.mode === 'pairs') return pairPanel(original,quiz,layout,true);
    const regions = question.bundle_parts ?? [question.slide_prompt_crop,meta?.crop ?? layout.bounds ?? question.slide_crop].filter(Boolean);
    if (!regions.length) throw Error('문제 영역을 찾지 못했습니다.');
    const panels = regions.map(region => paintProblem(original,region,true));
    if (meta?.mode === 'diagram') {
      const labels = meta.retained.map((v,i)=>CIRCLED[i]+' 그래프 '+CIRCLED[v-1]);
      panels.push(textPanel(labels.join('      '), Math.round(page.width*.016),true));
    }
    return combine(panels,Math.round(.011*page.width),false,false,'#fff');
  } finally {page.close();}
}

// Each Excel row and its PNG are emitted from the same ordered entry.
export async function quizImageZip(written, questions, loadPage, reviewMissing) {
  const items = [
    ...written.map(quiz => ({quiz,group:1,slot:quiz.slot})),
    ...questions.map(q => ({q,quiz:q.quiz_override,group:q.quizOne ? 1 : 2,slot:q.slot})),
  ].sort((a,b) => a.group-b.group || a.slot-b.slot);
  if (!items.length || items.length>100) throw Error('제출된 퀴즈 문항 수를 확인해 주세요.');
  await loadPptx();
  let geometry;
  if (questions.some(q=>q.quiz_override?.book_quiz?.mode==='single')) {
    const response=await fetch(new URL('./quizn-layout.json?v=1',import.meta.url));
    if (!response.ok) throw Error('교재 보기의 위치를 불러오지 못했습니다.');
    geometry=await response.json();
  }
  const entries=[], zip = new window.JSZip(), slots=new Set();
  for (const [idx,{q,quiz,group,slot}] of items.entries()) {
    const key=group+'-'+slot;
    if (!Number.isInteger(slot) || slot<1 || slots.has(key)) throw Error('제출본의 문항 번호를 확인해 주세요.');
    slots.add(key);
    const number=String(idx+1).padStart(2,'0');
    const label=q ? q.book+' '+q.label : '직접 작성 '+slot+'번';
    try {
      let plan=quizPlan(quiz,q?.projection_layout,geometry?.numbers[q?.question_id]), canvas;
      if (!q || (quiz && !quiz.book_quiz)) {
        canvas=writtenQuizImage({...quiz,kind:plan.imageChoices ? 'choice' : 'short'});
      } else if (!plan) {
        canvas=await paperQuizImage(q,loadPage);
        if (!reviewMissing) throw Error('제출본에 정답이 없습니다.');
        const review=await reviewMissing(q,canvas,number);
        plan=review.plan;
        if (review.keep<100) {
          const cropped=document.createElement('canvas'); cropped.width=canvas.width;
          cropped.height=Math.max(1,Math.round(canvas.height*review.keep/100));
          cropped.getContext('2d').drawImage(canvas,0,0); canvas=cropped;
        }
      } else if (plan.imageChoices) {
        canvas=await paperQuizImage(q,loadPage);
      } else if (quiz.book_quiz.mode==='pairs' && q.projection_layout.question) {
        canvas=writtenQuizImage({prompt:q.projection_layout.question});
      } else {
        const bottom=geometry?.cutoffs[q.question_id], bounds=geometry?.bounds?.[q.question_id] ?? quiz.book_quiz.crop ?? q.projection_layout?.bounds ?? q.slide_crop;
        if (!Number.isFinite(bottom) || !bounds || bottom<=bounds[1] || bottom>bounds[3]) {
          throw Error('교재에서 문제와 보기의 경계를 확인해 주세요.');
        }
        const region=[bounds[0],bounds[1],bounds[2],bottom];
        const page=await createImageBitmap(await loadPage({...q,projection_asset:null}));
        try {
          if (page.width<2200) throw Error('고해상도 교재 원본을 확인해 주세요.');
          const regions=q.bundle_parts ? q.bundle_parts.map(box=>[box[0],box[1],box[2],Math.min(box[3],bottom)]).filter(box=>box[3]>box[1]) : [q.slide_prompt_crop,region].filter(Boolean);
          canvas=combine(regions.map(box=>paintProblem(page,box,true)),Math.round(.011*page.width),false,false,'#fff');
        } finally {page.close();}
      }
      const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if (!png) throw Error('PNG 파일을 만들지 못했습니다.');
      zip.file(number+'.png',await png.arrayBuffer());
      const prompt=(quiz && !quiz.book_quiz ? quiz.prompt : '')?.trim();
      const question=number+'번 · '+(prompt && prompt.length<=140 ? prompt : '문제 이미지를 보고 답하세요.');
      // The Show template offers 120 and 240 seconds, but not 180.
      const seconds=!q ? [30,30,60,60,120][slot-1] : slot===(q.stage_mode==='rpm_pro' ? 2 : 3) ? 240 : 120;
      entries.push({plan,question,seconds:seconds ?? '제한없음'});
    } catch(error) {
      if (error.name==='AbortError') throw error;
      throw Error(number+'번 ('+label+') · '+error.message,{cause:error});
    }
  }
  zip.file('퀴즈앤 업로드.xlsx',await quizWorkbook(entries));
  return zip.generateAsync({type:'blob'});
}
