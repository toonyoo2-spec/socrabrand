// QuizN's Korean Show template reserves rows 1–21 for its instructions and examples.
const circles = Array.from('①②③④⑤');
export const numberButtons = circles.slice(0,4);
const xmlSpace = 'http://www.w3.org/XML/1998/namespace';

function fourValues(value) {
  const values = String(value ?? '').split('\n').map(s => s.trim());
  if (values.length !== 4 || values.some(v => !v) || new Set(values).size !== 4) {
    throw Error('서로 다른 보기 4개를 확인해 주세요.');
  }
  return values;
}

function validIndices(values) {
  return Array.isArray(values) && values.length > 0 && new Set(values).size === values.length
    && values.every(n => Number.isInteger(n) && n >= 1 && n <= 5);
}

export function quizPlan(quiz, layout = {}, numbers = {}) {
  if (!quiz) return null;
  const meta = quiz.book_quiz;
  const answer = String(quiz.answer ?? '').trim();
  if (quiz.kind === 'ox' || quiz.kind === 'short') {
    if (quiz.kind === 'ox' ? !['O','X'].includes(answer) : !answer || /[\r\n]/.test(answer)) {
      throw Error('제출한 정답을 확인해 주세요.');
    }
    if (quiz.kind==='short' && answer.split(',').some(v=>!v.trim() || v.trim().length>15)) throw Error('단답형 정답은 각각 15자 이내로 입력해 주세요.');
    return {type:quiz.kind === 'ox' ? 'OX형' : '단답형', buttons:quiz.kind === 'ox' ? ['O','X'] : [], answer};
  }
  let buttons = fourValues(quiz.choices);
  if (!/^[1-4]$/.test(answer)) throw Error('정답 번호가 1~4 사이인지 확인해 주세요.');
  let imageChoices = false;
  if (meta) {
    const original = meta.originalAnswer;
    if (!validIndices(original)) throw Error('교재의 원래 정답을 확인해 주세요.');
    if (meta.mode === 'pairs') {
      const sets = buttons.map(value => value.split(/\s*·\s*/).map(s => circles.indexOf(s) + 1));
      if (sets.some(set => !validIndices(set))) throw Error('교재의 묶음 보기를 확인해 주세요.');
      const matches = sets.map(set => set.length === original.length && original.every(n => set.includes(n)));
      if (matches.filter(Boolean).length !== 1 || !matches[Number(answer)-1]) throw Error('묶음 보기와 제출한 정답이 다릅니다.');
      if (layout.values?.length === 5) buttons = sets.map(set => set.map(n => layout.values[n-1]).join(', '));
      else imageChoices = true;
    } else {
      const kept = meta.retained;
      if (!['single','diagram'].includes(meta.mode) || !validIndices(kept) || kept.length !== 4
          || original.length !== 1 || kept[Number(answer)-1] !== original[0]) {
        throw Error('원래 정답과 4지선다로 바꾼 정답 번호가 다릅니다.');
      }
      buttons = buttons.map((v,i) => v === '교재 원문 '+circles[kept[i]-1]+'번 보기' ? numbers[kept[i]] ?? v : v);
      imageChoices = meta.mode === 'diagram' || buttons.some(v => /^교재 원문 [①②③④⑤]번 보기$/.test(v));
    }
  }
  imageChoices ||= buttons.some(v => v.length > 30);
  return {type:'선택형', answer, buttons:imageChoices ? numberButtons : buttons, imageChoices};
}

export async function quizWorkbook(entries) {
  const response = await fetch(new URL('./quizn-template.xlsx',import.meta.url));
  if (!response.ok) throw Error('퀴즈앤 엑셀 양식을 불러오지 못했습니다.');
  const book = await window.JSZip.loadAsync(await response.arrayBuffer());
  const readXML = async path => new DOMParser().parseFromString(await book.file(path).async('string'),'application/xml');
  const sheetPath='xl/worksheets/sheet1.xml', stringsPath='xl/sharedStrings.xml';
  const sheet=await readXML(sheetPath), strings=await readXML(stringsPath);
  const sst=strings.documentElement, ns=sst.namespaceURI;
  const indices=new Map(Array.from(sst.children,(node,i)=>[node.textContent,i]));
  let count=Number(sst.getAttribute('count'));
  function put(ref,value) {
    if (value === '' || value == null) return;
    const cell=sheet.querySelector('c[r="'+ref+'"]');
    if (!cell) throw Error('퀴즈앤 엑셀의 입력 위치를 확인해 주세요.');
    const node=sheet.createElementNS(ns,'v');
    if (typeof value === 'number') {
      cell.removeAttribute('t'); node.textContent=String(value);
    } else {
      if (!indices.has(value)) {
        const si=strings.createElementNS(ns,'si'), t=strings.createElementNS(ns,'t');
        t.setAttributeNS(xmlSpace,'xml:space','preserve'); t.textContent=value;
        indices.set(value,sst.children.length); si.append(t); sst.append(si);
      }
      cell.setAttribute('t','s'); node.textContent=String(indices.get(value)); count++;
    }
    cell.replaceChildren(node);
  }
  entries.forEach(({plan,question,seconds},i)=>{
    const row=22+i;
    put('B'+row,plan.type); put('C'+row,question);
    plan.buttons.forEach((v,j)=>put('DEFG'[j]+row,v));
    put('H'+row,seconds); put('I'+row,plan.type==='선택형' ? Number(plan.answer) : plan.answer);
    put('J'+row,'On'); put('K'+row,'Off');
  });
  sst.setAttribute('uniqueCount',String(sst.children.length)); sst.setAttribute('count',String(count));
  const serializer=new XMLSerializer();
  book.file(sheetPath,serializer.serializeToString(sheet)); book.file(stringsPath,serializer.serializeToString(strings));
  return book.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
}
