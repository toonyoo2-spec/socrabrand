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

function titleMeasure(value, fontSize) {
  const context = document.createElement('canvas').getContext('2d');
  context.font = '700 ' + fontSize * 4 / 3 + 'px "' + FONT + '", sans-serif';
  return context.measureText(value).width / 96;
}

async function frame(deck, label, source, style, book) {
  const slide = deck.addSlide();
  slide.background = { color: DARK };
  const kind = book === '개념원리' && (
    label === '개념원리 확인하기' ? 'concept' :
    label.startsWith('핵심문제') ? 'key' :
    label.includes('시험에 나온다') ? 'exam' :
    label === '중단원 마무리하기' ? 'closing' : null
  );
  const theme = kind ? badges[kind] : style === 'teacher'
    ? { fill:'352A13', line:'88692F', divider:'B39754' }
    : { fill:'231B33', line:'60527E', divider:'8874A8' };
  const maxTitleWidth = SLIDE_WIDTH - 2 * SLIDE_MARGIN - 2.753;
  const sourceWidth = titleMeasure(source, 19);
  const sourceSize = sourceWidth <= maxTitleWidth - .23 ? 19
    : Math.max(1, Math.floor(19 * (maxTitleWidth - .23) / sourceWidth));
  const titleWidth = Math.min(maxTitleWidth, Math.max(2.08, titleMeasure(source, sourceSize) + .23));
  slide.addShape(deck.ShapeType.roundRect, { x:SLIDE_MARGIN, y:2.531, w:2.753 + titleWidth, h:.635, radius:.09,
    fill:{ color:theme.fill }, line:{ color:theme.line, width:1.2 } });
  if (kind) {
    slide.addImage({ data:await loadBadge(kind), x:.729, y:2.849 - theme.height / 2, w:theme.width, h:theme.height });
  } else {
    slide.addText(label, {
      x:.779, y:2.585, w:2.24, h:.50, margin:0, color:'E4DDF2', bold:true, fontFace:FONT,
      fontSize:Math.min(16, Math.floor(16 * 2.10 / titleMeasure(label, 16))), wrap:false,
    });
  }
  slide.addShape(deck.ShapeType.rect, { x:3.115, y:2.74, w:.0167, h:.229,
    fill:{ color:theme.divider }, line:{ color:theme.divider, transparency:100 } });
  slide.addText(source, {
    x:3.281, y:2.635, w:titleWidth, h:.396, margin:0, color:'FFFFFF', bold:true,
    fontFace:FONT, fontSize:sourceSize, wrap:false,
  });
  return slide;
}

function paintProblem(image, crop, rpm = false) {
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
    if (rpm) {
      // Invert ink lightness while preserving hue. Coverage stays continuous at antialiased edges.
      const hi = Math.max(r, g, b);
      const lo = Math.min(r, g, b);
      if (lo < 233) {
        const px = (i / 4) % w, py = Math.floor(i / 4 / w);
        minX = Math.min(px,minX); maxX = Math.max(px,maxX); minY = Math.min(py,minY); maxY = Math.max(py,maxY);
      }
      for (let channel = 0; channel < 3; channel++) {
        const coverage = (255 - hi + ink.data[i + channel] - lo) / 255;
        ink.data[i + channel] = 17 + 238 * coverage * (1.32 - .32 * coverage);
      }
      continue;
    }
    const light = .2126 * r + .7152 * g + .0722 * b;
    const colored = Math.max(r, g, b) - Math.min(r, g, b) > 23;
    const whiteInk = 17 + Math.round(238 * Math.min(1, Math.max(0, (239 - light) / 165)));
    if (whiteInk > 40 || (colored && light < 232)) {
      const px = (i / 4) % w, py = Math.floor(i / 4 / w);
      minX = Math.min(px, minX); maxX = Math.max(px, maxX);
      minY = Math.min(py, minY); maxY = Math.max(py, maxY);
    }
    // Preserve strongly colored diagrams while moving light background off the slide.
    const colorScale = light > 194 ? .42 : 1.12;
    ink.data[i] = colored ? Math.max(17, Math.min(255, Math.round(r * colorScale))) : whiteInk;
    ink.data[i + 1] = colored ? Math.max(17, Math.min(255, Math.round(g * colorScale))) : whiteInk;
    ink.data[i + 2] = colored ? Math.max(17, Math.min(255, Math.round(b * colorScale))) : whiteInk;
  }
  context.putImageData(ink, 0, 0);
  if (maxX < minX || maxY < minY) throw Error('문항 이미지 안에서 내용을 확인하지 못했습니다.');
  const pad = 5;
  const trimmed = document.createElement('canvas');
  trimmed.width = maxX - minX + 1 + 2 * pad;
  trimmed.height = maxY - minY + 1 + 2 * pad;
  const out = trimmed.getContext('2d');
  out.fillStyle = '#' + DARK;
  out.fillRect(0, 0, trimmed.width, trimmed.height);
  out.drawImage(canvas, minX, minY, trimmed.width - 2 * pad, trimmed.height - 2 * pad,
    pad, pad, trimmed.width - 2 * pad, trimmed.height - 2 * pad);
  return trimmed;
}

function placeProblem(slide, image) {
  const scale = Math.min(image.scale ?? .014, 10.31 / image.w, 6.5 / image.h);
  slide.addImage({ data:image.data, x:.625, y:3.542, w:image.w * scale, h:image.h * scale });
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

export async function bookQuizPreview(question, loadImage) {
  return (await projectionProblem(question, loadImage)).canvas;
}

async function projectionProblem(question, loadImage) {
  const meta = question.quiz_override?.book_quiz;
  const image = await createImageBitmap(await loadImage(meta ? {...question, projection_asset:null} : question));
  try {
    if (question.projection_asset && !meta) {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return { canvas, data:canvas.toDataURL('image/png'), w:canvas.width, h:canvas.height, scale:1 / 125 };
    }
    const rpm = ['rpm-student', 'rpm-pro-student'].includes(question.preview_book);
    const scale = rpm ? .014 * 1075 / image.width : undefined;
    const page = convertedPage(image, meta);
    const parts = question.bundle_parts
      ?? [question.slide_prompt_crop, meta?.crop ?? question.slide_crop].filter(Boolean);
    const panels = parts.map(crop => paintProblem(page, crop, rpm));
    if (panels.length === 1) {
      const canvas = panels[0];
      return { canvas, scale, data:canvas.toDataURL('image/png'), w:canvas.width, h:canvas.height };
    }
    const gap = Math.round(14 * (rpm ? image.width / 1075 : 1));
    const combined = document.createElement('canvas');
    combined.width = Math.max(...panels.map(panel => panel.width));
    combined.height = panels.reduce((height,panel) => height+panel.height, 0) + gap*(panels.length-1);
    const output = combined.getContext('2d');
    output.fillStyle = '#' + DARK;
    output.fillRect(0, 0, combined.width, combined.height);
    let y = 0;
    for (const panel of panels) {
      output.drawImage(panel, 0, y);
      y += panel.height + gap;
    }
    return { canvas:combined, scale, data:combined.toDataURL('image/png'), w:combined.width, h:combined.height };
  } finally {
    image.close();
  }
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
    x: .625, y: 3.542, w: 10.31, h: 6.5, color: 'FFFFFF', margin: 0, valign: 'top', fontFace: FONT,
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
    const slide = await frame(deck, question.section, question.book + ' ' + question.label, 'lesson', question.book);
    await addQuestionImage(slide, question, loadImage);
    slide.addNotes('수업 문항 ' + question.slot + '번 · ' + question.book + ' ' + question.label);
  }
  for (const quiz of quizzes) {
    const slide = await frame(deck, quizLabel, '문항 ' + quiz.slot, 'teacher');
    placeQuiz(slide, quiz);
  }
  for (const question of appendix) {
    const slide = await frame(deck, question.stageLabel ?? stageLabel,
      question.book ? question.book + ' ' + question.label : question.label, question.quizOne ? 'teacher' : 'appendix');
    const quiz = question.quiz_override;
    if (quiz?.book_quiz) {
      await addQuestionImage(slide, question, loadImage);
      if (quiz.book_quiz.mode !== 'single') {
        const lines = quiz.choices.split('\n').map((choice, i) => (i + 1) + '. ' + choice);
        slide.addText([quiz.prompt, '', ...lines].join('\n'), { x:11.2, y:3.542, w:8, h:6.5,
          fontFace:FONT, fontSize:24, margin:0, valign:'top', fit:'shrink', color:'FFFFFF' });
      }
      slide.addNotes('정답 ' + quiz.answer);
    } else if (question.quiz_override) placeQuiz(slide, { kind: 'choice', ...question.quiz_override });
    else await addQuestionImage(slide, question, loadImage);
  }
  return new Blob([await deck.write({ outputType: 'arraybuffer', compression: true })], { type: MIME });
}
