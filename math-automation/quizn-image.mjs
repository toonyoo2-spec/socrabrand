// One shared design for the images attached to QuizN Show questions.
const font = '"QuizN Gothic", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
let assets;

async function readAsset(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw Error('퀴즈앤 이미지 디자인을 불러오지 못했습니다.');
  return response;
}

export function loadQuizDesign() {
  assets ??= Promise.all([
    readAsset('./quizn-background.webp').then(r => r.blob()).then(createImageBitmap.bind(globalThis)),
    readAsset('../gv-report/fonts/pretendard-700.woff2').then(r => r.arrayBuffer()).then(async bytes => {
      const face = new FontFace('QuizN Gothic', bytes, {weight:'700'});
      document.fonts.add(await face.load());
    }),
  ]).then(([background]) => background).catch(error => {
    assets = null;
    throw error;
  });
  return assets;
}

export const quizFont = font;

export function frameQuizImage(background, content, {number, total, lesson, source, paper}) {
  const out = document.createElement('canvas');
  out.width = 1920;
  out.height = 1080;
  const ctx = out.getContext('2d');
  ctx.scale(1.5, 1.5);
  ctx.drawImage(background, 0, 0, 1280, 720);

  function label(text, x, y, size, color, maxWidth) {
    ctx.fillStyle = color;
    ctx.font = '700 ' + size + 'px ' + font;
    ctx.fillText(text, x, y, maxWidth);
  }
  label('퀴즈앤', 56, 58, 28, '#3ed198', 94);
  label(lesson, 174, 58, 28, '#f1f6f3', 760);
  label(number, 54, 205, 76, '#3ed198', 108);
  label('/ ' + String(total).padStart(2,'0'), 60, 238, 23, '#b7c9c1', 100);
  label(source, 58, 681, 21, '#d0ded8', 850);

  // Reserve the lower right for Echo. Keep the whole source, including fine
  // diagram labels, and cap enlargement for short or narrow questions.
  const left = 175, width = 914, height = 430;
  const scale = Math.min(width / content.width, height / content.height, paper ? 0.94 : 0.78);
  const w = content.width * scale, h = content.height * scale;
  const top = 150 + (height - h) * 0.36;
  if (paper) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(left - 12, top - 12, w + 24, h + 24, 8);
    ctx.fill();
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(content, left, top, w, h);
  return out;
}
