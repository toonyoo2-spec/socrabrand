// Builds real slides in Chromium and checks the shapes that Google Slides will receive.
// Guards the defects found in the 2026-11-26 review: split lines that drifted apart,
// wrapped choices starting under their mark, and faces Google Slides replaces.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({chromium} = createRequire(import.meta.url)('playwright')); } catch { /* skipped below */ }

const question = (label, gothic) => ({slot:1, question_id:1, section:'유형 익히기', book:'RPM', label, page:10, gothic_content:gothic});
const cases = {
  choices: question('10p 0046번', {tag:'대표문제', body:'', tables:[], figures:[], stem:'다음 중 옳지 <u>않은</u> 것은?',
    choices:['1은 소수가 아니다.','1을 제외한 모든 자연수는 약수가 2개 이상이다.','가장 작은 합성수는 4이다.','2의 배수 중 소수는 1개뿐이다.','소수가 아닌 자연수는 합성수이다.']}),
  exponents: question('13p 0070번', {tag:'중', body:'', tables:[], figures:[], choices:[], stem:'8×3^{a}×5^{2}의 약수의 개수가 72일 때, 자연수 a의 값을 구하시오.'}),
};

async function shapes(picks) {
  const types = {'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.ttf':'font/ttf'};
  const server = createServer(async (req, res) => {
    if (req.url === '/') { res.setHeader('content-type','text/html'); res.end('<!doctype html><body>'); return; }
    try { const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      res.setHeader('content-type', types[path.extname(file)] ?? 'application/octet-stream'); res.end(await readFile(file)); }
    catch { res.statusCode = 404; res.end(); }
  }).listen(0);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:' + server.address().port + '/');
    return await page.evaluate(async picks => {
      const {buildPresentation} = await import('/math-automation/presentation.mjs');
      const blob = await buildPresentation({title:'t', picks, quizzes:[], appendix:[]}, () => { throw Error('no figure'); });
      const zip = await window.JSZip.loadAsync(await blob.arrayBuffer());
      const xml = new DOMParser().parseFromString(await zip.file('ppt/slides/slide1.xml').async('string'), 'application/xml');
      return Array.from(xml.getElementsByTagNameNS('*','sp')).map(sp => ({
        x: Number(sp.getElementsByTagNameNS('*','off')[0]?.getAttribute('x')),
        text: Array.from(sp.getElementsByTagNameNS('*','t')).map(t => t.textContent).join(''),
        faces: Array.from(sp.getElementsByTagNameNS('*','latin')).map(f => f.getAttribute('typeface')),
        raised: Array.from(sp.getElementsByTagNameNS('*','rPr')).some(r => Number(r.getAttribute('baseline')) > 0),
      })).filter(s => s.text.trim());
    }, picks);
  } finally { await browser.close(); server.close(); }
}

test('choice lines stay whole, wrap under their text and use served faces', {skip:!chromium && 'playwright not installed'}, async () => {
  const boxes = await shapes([cases.choices]);
  for (const line of ['가장 작은 합성수는 4이다.','2의 배수 중 소수는 1개뿐이다.','1은 소수가 아니다.'])
    assert.ok(boxes.some(b => b.text === line), '한 줄이 여러 상자로 나뉘었습니다: ' + line);
  const first = boxes.find(b => b.text.startsWith('1을 제외한')), wrapped = boxes.find(b => b !== first && b.text.endsWith('2개 이상이다.'));
  assert.ok(first && wrapped, '② 보기의 두 줄을 찾지 못했습니다.');
  assert.equal(wrapped.x, first.x, '줄바꿈된 보기가 번호 아래에서 시작합니다.');
  for (const b of boxes) for (const face of b.faces) assert.ok(['Noto Sans KR','Lora','STIX Two Math'].includes(face), face);
});

test('a line with exponents is one text box with raised runs', {skip:!chromium && 'playwright not installed'}, async () => {
  const boxes = await shapes([cases.exponents]);
  const line = boxes.find(b => b.text.includes('의 약수의 개수가'));
  assert.ok(line?.text.startsWith('8×3a×52의 약수의 개수가 72일 때'), '지수가 든 줄이 나뉘었습니다: ' + JSON.stringify(boxes.map(b=>b.text)));
  assert.ok(line.raised, '지수가 위첨자로 표시되지 않았습니다.');
});
