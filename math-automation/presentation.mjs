const MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const DARK = '111111';
const FONT = 'Noto Sans KR';
let library;

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
  const runs = [];
  let start = 0;
  for (const match of value.matchAll(/\^\{([^{}]{1,60})\}/g)) {
    runs.push({ text: value.slice(start, match.index) }, { text: match[1], options: { superscript: true } });
    start = match.index + match[0].length;
  }
  runs.push({ text: value.slice(start) });
  return runs;
}

function frame(deck, label, source, style) {
  const slide = deck.addSlide();
  slide.background = { color: DARK };
  const fill = { lesson: '16251B', teacher: '352A13', appendix: '193222' }[style];
  const line = { lesson: '46634C', teacher: '88692F', appendix: '467852' }[style];
  slide.addShape(deck.ShapeType.roundRect, { x: .45, y: 1.45, w: 7.15, h: .45, rectRadius: .1,
    fill: { color: fill }, line: { color: line, width: .8 } });
  slide.addText(label + '  ·  ' + source, {
    x: .59, y: 1.48, w: 6.85, h: .38, margin: 0, color: 'FFFFFF', bold: true, fontFace: 'Pretendard', fontSize: 14, fit: 'shrink',
  });
  return slide;
}

async function paintProblem(blob, crop) {
  const image = await createImageBitmap(blob);
  try {
    const [left, top, right, bottom] = crop || [0, 0, 1, 1];
    const x = Math.round(left * image.width), y = Math.round(top * image.height);
    const w = Math.round((right - left) * image.width), h = Math.round((bottom - top) * image.height);
    if (w < 8 || h < 8 || x < 0 || y < 0 || x + w > image.width + 1 || y + h > image.height + 1) {
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
    return { data: trimmed.toDataURL('image/png'), w: trimmed.width, h: trimmed.height };
  } finally {
    image.close();
  }
}

function placeProblem(slide, image) {
  const link = Math.min(7.15 / image.w, 3.4 / image.h);
  slide.addImage({ data: image.data, x: .47, y: 2.04, w: image.w * link, h: image.h * link });
}

export async function buildPresentation({ title, picks, quizzes, appendix, stageLabel = '퀴즈앤 · 교사부록' }, loadImage) {
  const Pptx = await loadPptx();
  const deck = new Pptx();
  deck.layout = 'LAYOUT_WIDE';
  deck.title = title;
  deck.author = 'Socra LX팀';
  deck.lang = 'ko-KR';

  for (const question of picks) {
    if (!question.slide_crop) throw Error(question.label + ' 이미지 영역을 확인해 주세요.');
    const slide = frame(deck, question.section, question.book + ' ' + question.label, 'lesson');
    const image = await paintProblem(await loadImage(question), question.slide_crop);
    placeProblem(slide, image);
    slide.addNotes('수업 문항 ' + question.slot + '번 · ' + question.book + ' ' + question.label);
  }
  for (const quiz of quizzes) {
    const slide = frame(deck, '퀴즈앤 · 직접 출제', '문항 ' + quiz.slot, 'teacher');
    const options = quiz.kind === 'choice' ? quiz.choices.split('\n') : [];
    if (quiz.kind === 'choice' && (options.length !== 4 || options.some(choice => !choice.trim()) || !/^[1-4]$/.test(quiz.answer))) {
      throw Error('객관식 문항의 보기 4개와 정답을 확인해 주세요.');
    }
    const choices = options.length ? '\n\n' + options.map((choice, index) => (index + 1) + '. ' + choice).join('\n')
      : quiz.kind === 'ox' ? '\n\nO   /   X' : '';
    slide.addText(equationRuns(quiz.prompt + choices), {
      x: .47, y: 2.04, w: 7.15, h: 3.36, color: 'FFFFFF', margin: 0, valign: 'top', fontFace: FONT,
      fontSize: 26, fit: 'shrink', breakLine: false,
    });
    slide.addNotes('퀴즈앤 직접 출제 · 정답 ' + quiz.answer);
  }
  for (const question of appendix) {
    const slide = frame(deck, stageLabel, question.book ? question.book + ' ' + question.label : question.label, 'appendix');
    const image = await paintProblem(await loadImage(question), question.slide_crop);
    placeProblem(slide, image);
  }
  return new Blob([await deck.write({ outputType: 'arraybuffer', compression: true })], { type: MIME });
}

export function downloadPresentation(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
