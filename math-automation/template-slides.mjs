import {typeRuns} from './math-type.mjs?v=4';
// Populate a copy of the approved PPTX. Masters, slide layouts and artwork stay native.
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const parts = (node,name) => Array.from(node.getElementsByTagNameNS('*',name));
const first = (node,name) => parts(node,name)[0];
const serialize = doc => new XMLSerializer().serializeToString(doc);
async function xml(zip,path) {
  const entry=zip.file(path);
  if(!entry) throw Error('PPT 내부 파일을 찾지 못했습니다. '+path);
  const doc=new DOMParser().parseFromString(await entry.async('string'),'application/xml');
  if(first(doc,'parsererror')) throw Error('PPT 양식 XML을 확인해 주세요.');
  return doc;
}
function target(path,relative) {
  return new URL(relative,'https://ppt.invalid/'+path).pathname.slice(1);
}
function relPath(file) {
  return file.replace(/([^/]+)$/,'_rels/$1.rels');
}
function setTopic(shape,value) {
  const paras=parts(shape,'p');
  const runs=parts(paras[0],'t');
  if(!runs.length) throw Error('학습 주제 입력란을 찾지 못했습니다.');
  const prototype=runs[0].parentNode;
  const paragraph=paras[0], doc=shape.ownerDocument, ns=prototype.namespaceURI;
  for(const {text,options} of typeRuns(value)){
    const run=prototype.cloneNode(true), t=first(run,'t');
    t.textContent=text;
    let pr=first(run,'rPr');
    if(!pr){pr=doc.createElementNS(ns,'a:rPr');run.insertBefore(pr,t);}
    pr.setAttribute('i',options.italic?'1':'0');pr.setAttribute('b','1');
    for(const tag of ['latin','ea','cs']){
      let face=first(pr,tag);
      if(!face){face=doc.createElementNS(ns,'a:'+tag);pr.append(face);}
      face.setAttribute('typeface',options.fontFace);
    }
    paragraph.insertBefore(run,prototype);
  }
  for(const t of runs)t.parentNode.remove();
  for(const para of paras.slice(1))para.remove();
}
const textOf = node => parts(node,'t').map(n=>n.textContent).join('').trim();
function scaleQuestionShape(node,ratio) {
  for(const child of node.getElementsByTagName('*')) {
    const attrs=({off:['x','y'],ext:['cx','cy'],rPr:['sz'],defRPr:['sz'],endParaRPr:['sz'],ln:['w'],bodyPr:['lIns','rIns','tIns','bIns'],spcPts:['val']})[child.localName]??[];
    for(const a of attrs)if(child.hasAttribute(a))child.setAttribute(a,String(Math.round(Number(child.getAttribute(a))*ratio)));
  }
}
async function placeContent(template, source, doc, file, number, ratio) {
  const sourceFile='ppt/slides/slide'+number+'.xml', content=await xml(source,sourceFile);
  const destTree=first(doc,'spTree');
  const old=Array.from(destTree.children).filter(n=>['sp','pic','graphicFrame','grpSp'].includes(n.localName));
  if(old.length!==1 || old[0].localName!=='sp')throw Error('문항 자리의 원본 구성이 달라졌습니다.');
  old[0].remove();
  const relations=await xml(template,relPath(file));
  const sourceRelations=await xml(source,relPath(sourceFile));
  for(const shape of Array.from(first(content,'spTree').children).filter(n=>n.localName==='sp'||n.localName==='pic')) {
    const node=doc.importNode(shape,true);
    scaleQuestionShape(node,ratio);
    for(const blip of parts(node,'blip')) {
      const rid=blip.getAttributeNS(REL,'embed');
      const link=parts(sourceRelations,'Relationship').find(n=>n.getAttribute('Id')===rid);
      if(!link?.getAttribute('Type').endsWith('/image'))throw Error('문항 이미지 연결이 없습니다.');
      const origin=target(sourceFile,link.getAttribute('Target'));
      const filename='math-content-'+number+'-'+rid+'.'+origin.split('.').at(-1);
      template.file('ppt/media/'+filename,await source.file(origin).async('uint8array'));
      const rel=relations.importNode(link,true);
      rel.setAttribute('Target','../media/'+filename);rel.setAttribute('Id','math'+rid);
      relations.documentElement.append(rel);
      blip.setAttributeNS(REL,'r:embed','math'+rid);
    }
    destTree.append(node);
  }
  template.file(relPath(file),serialize(relations));
  const noteRel=doc=>parts(doc,'Relationship').find(n=>n.getAttribute('Type').endsWith('/notesSlide'));
  const from=noteRel(sourceRelations), to=noteRel(relations);
  if(from && to) {
    const dst=target(file,to.getAttribute('Target'));
    const notes=await xml(template,dst), other=await xml(source,target(sourceFile,from.getAttribute('Target')));
    const notesBody=d=>first(parts(d,'sp').find(sp=>first(sp,'ph')?.getAttribute('type')==='body'),'txBody');
    const body=notesBody(notes), example=notesBody(other);
    if(body && example) {
      for(const para of parts(body,'p'))para.remove();
      for(const para of parts(example,'p'))body.append(notes.importNode(para,true));
      template.file(dst,serialize(notes));
    }
  }
}

const labelNames = new Set(['예', '읽기', '약속']);
function applyLessonLabelColors(doc) {
  const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const child = (node, name) => Array.from(node?.children || []).find(el => el.localName === name);
  const make = name => doc.createElementNS(drawing, 'a:' + name);
  const geometry = shape => child(child(shape, 'spPr'), 'prstGeom')?.getAttribute('prst');
  function bounds(shape) {
    const transform = child(child(shape, 'spPr'), 'xfrm');
    const off = child(transform, 'off'), size = child(transform, 'ext');
    if (off && size) return [off.getAttribute('x'), off.getAttribute('y'), size.getAttribute('cx'), size.getAttribute('cy')].join(',');
  }
  function fill(parent, color, after) {
    const paint = make('solidFill'), rgb = make('srgbClr');
    rgb.setAttribute('val', color);
    paint.append(rgb);
    const old = Array.from(parent.children).find(el => ['noFill','solidFill','gradFill','blipFill','pattFill','grpFill'].includes(el.localName));
    if (old) old.replaceWith(paint);
    else parent.insertBefore(paint, after ? after.nextSibling : parent.firstChild);
  }
  let count = 0;
  for (const label of parts(doc, 'sp')) {
    if (!labelNames.has(textOf(label))) continue;
    const box = bounds(label);
    const rounded = geometry(label) === 'roundRect' ? label :
      Array.from(label.parentNode.children).slice(0, Array.from(label.parentNode.children).indexOf(label)).reverse()
        .find(el => box && el.localName === 'sp' && geometry(el) === 'roundRect' && !textOf(el) && bounds(el) === box);
    if (!rounded) continue;
    const properties = child(rounded, 'spPr');
    fill(properties, '35651C', child(properties, 'prstGeom'));
    const line = child(properties, 'ln');
    if (line) fill(line, 'BFFF00');
    for (const run of parts(label, 'r')) {
      let style = child(run, 'rPr');
      if (!style) {style = make('rPr'); run.prepend(style);}
      child(style, 'highlight')?.remove();
      fill(style, 'FFFFFF', child(style, 'ln'));
      style.setAttribute('b', '1');
    }
    const body = child(label, 'txBody'), bp = child(body, 'bodyPr');
    for (const key of ['tIns','bIns','lIns','rIns']) bp.setAttribute(key,'0');
    bp.setAttribute('anchor','ctr');
    for (const el of Array.from(bp.children)) if (/autofit/i.test(el.localName)) el.remove();
    bp.append(make('noAutofit'));
    for (const pp of parts(body,'pPr')) pp.setAttribute('algn','ctr');
    count++;
  }
  const shapes = parts(doc,'sp'), lookup = value => shapes.find(sp => textOf(sp)===value);
  const paintText = (shape,color) => {
    for (const r of parts(shape,'rPr')) { fill(r,color,child(r,'ln')); child(r,'highlight')?.remove(); }
  };
  function panel(shape,color) {
    const prop=child(shape,'spPr');
    fill(prop,color,child(prop,'prstGeom') || child(prop,'xfrm'));
  }
  // Paint the pill itself. A text highlight otherwise produces a square inside its rounded outline.
  for (const shape of shapes) {
    const marked = parts(shape,'r').filter(r => child(child(r,'rPr'),'highlight'));
    if (!marked.length) continue;
    const previous = shape.previousElementSibling, value = textOf(shape);
    const label = value.length < 14 && parts(shape,'p').length === 1 &&
      geometry(previous) === 'roundRect' && !textOf(previous) && bounds(previous) === bounds(shape);
    if (label) {
      panel(previous,'244637');
      const line = child(child(previous,'spPr'),'ln');
      if (line) fill(line,'738F7A');
      const body=child(child(shape,'txBody'),'bodyPr');
      if(body) body.setAttribute('anchor','ctr');
      for(const para of parts(shape,'pPr')) para.setAttribute('algn','ctr');
    }
    for(const run of marked) {
      const rp=child(run,'rPr');
      child(rp,'highlight').remove();
      fill(rp,label || value.includes('|') ? 'FFFFFF' : 'FFE347',child(rp,'ln'));
    }
    count++;
  }
  for (const shape of shapes) {
    const value = textOf(shape);
    // The teacher-confirmed legacy quiz has four numeric products. Match only their literal x positions.
    const nodes=parts(shape,'t');
    const plain=nodes.map(t=>t.textContent).join('');
    if(value.includes('60을 소인수분해 한 것은?') && plain.includes('2x3x10')) {
      const operators=new Set(Array.from(plain.matchAll(/(?<=[0-9²³])x(?=[0-9])/g),m=>m.index));
      let offset=0;
      for(const node of nodes) {
        const old=node.textContent;
        node.textContent=old.replace(/x/g,(ch,i)=>operators.has(offset+i)?'×':ch);
        offset+=old.length;
      }
      count+=operators.size;
    }
    for (const run of parts(shape,'r')) {
      const chars = child(run,'t'), rp = child(run,'rPr');
      if (!chars || !rp) continue;
      const east=child(rp,'ea');
      if (/[가-힣]/.test(chars.textContent) && east && /^(Lora|Cambria Math|Symbol|Wingdings)/i.test(east.getAttribute('typeface') || '')) {
        east.setAttribute('typeface','Noto Sans KR'); count++;
      }
    }
  }
  const teachingPage = shapes.some(sp => /^(개념 언박싱|개념 충전|0[0-9]-[0-9]|[1-9]\s+.+[?？])/.test(textOf(sp)));
  for (const [index, shape] of shapes.entries()) {
    const value = textOf(shape), previous = shape.previousElementSibling;
    if (/^\d{1,2}$/.test(value) && (geometry(shape)==='ellipse' ||
        (geometry(previous)==='ellipse' && bounds(previous)===bounds(shape)))) {
      for (const mark of parts(shape,'highlight')) mark.remove();
      paintText(shape,'FFFFFF');
      count++;
    }
    if (!teachingPage || index>3 || !/^(?:.+[?？]|0\d-\d+ .+)$/.test(value) || parts(shape,'p').length!==1) continue;
    const xfrm=child(child(shape,'spPr'),'xfrm'), ext=child(xfrm,'ext'), body=child(child(shape,'txBody'),'bodyPr');
    if (!ext || !body) continue;
    const canvas = globalThis.document.createElement('canvas').getContext('2d');
    let width=0;
    for(const run of parts(shape,'r')) {
      const style=child(run,'rPr'), size=Number(style?.getAttribute('sz')||1800)/100;
      canvas.font=(style?.getAttribute('b')==='1'?'bold ':'')+size+'px "'+(child(style,'ea')?.getAttribute('typeface')||'Noto Sans KR')+'", sans-serif';
      width+=canvas.measureText(child(run,'t')?.textContent||'').width;
    }
    const maxWidth=Number(ext.getAttribute('cx')), fitted=Math.ceil((width+12)*12700);
    if(width>0 && fitted<maxWidth) ext.setAttribute('cx',String(fitted));
    body.setAttribute('lIns','50800'); body.setAttribute('rIns','50800');
    panel(shape,'244637');paintText(shape,'FFFFFF'); count++;
  }
  for(const shape of shapes) {
    const value=textOf(shape);
    if (/^(?:[0-9]{2}-[0-9]+\s+.+|개념플러스)$/.test(value) && parts(shape,'rPr').some(r=>r.getAttribute('u')==='sng')) {
      for (const r of [...parts(shape,'rPr'),...parts(shape,'endParaRPr')]) r.setAttribute('u','none');
      paintText(shape,'FFE347'); count++;
    }
    if (value==='24 = 23 × 3 의 소인수는 2, 3이다.') {
      const run=parts(shape,'t').find(t=>t.textContent.endsWith('× 3 '));
      if(run){run.textContent=run.textContent.trimEnd();count++;}
    }
  }
  // Lift each numbered badge and its caption together, retaining room for the camera.
  const steps = lookup('나눈 소수들과 마지막 몫을곱셈 기호 ×로 연결한다.');
  const conclusion = lookup('어느 방법으로 해도 결과는 같다.');
  for (const shape of shapes) {
    const off=child(child(child(shape,'spPr'),'xfrm'),'off');
    if (!off) continue;
    const y=Number(off.getAttribute('y'))/12700;
    const shift=steps && y>=220 ? (y>=320?14:y>=270?9:4) : shape===conclusion && y>=350 ? 17 : 0;
    if (shift) {off.setAttribute('y',String(Math.round((y-shift)*12700)));count++;}
  }
  const title=lookup('개념플러스'), question=lookup('2는 어떤 소수일까?');
  if (title && question && shapes.length===11 && shapes.every(sp=>child(child(sp,'spPr'),'xfrm'))) {
    const rows=[
      [22,10,505,32,22,null,'FFE347'],
      [22,48,240,31,17,'244637','FFFFFF'],
      [28,84,237,23,16,null,'FFE347'],
      [28,109,237,23,16,null,'FFE347'],
      [28,138,236,50,16,null,'FFFFFF'],
      [272,48,258,31,17,'244637','FFFFFF'],
      [277,84,253,86,16,null,'FFFFFF'],
      [22,193,508,32,17,'244637','FFFFFF'],
      [28,231,502,56,16,null,'FFE347'],
      [22,299,239,53,16,'40302D','FFFFFF'],
      [272,299,258,53,16,'234637','FFE347']
    ];
    const strs=['개념플러스','소수 2의 두 가지 성질','① 소수 중 유일한 짝수','② 가장 작은 소수','자연수는 1, 소수, 합성수로 나뉜다.','거듭제곱의 성질','1의 거듭제곱은 항상 1이다.\na ≠ 0일 때, a¹ = a로 정한다.','소인수분해한 결과를 쓰는 방법','작은 소인수부터 쓰고, 같은 소인수의 곱은 거듭제곱으로 나타낸다.','분해가 더 필요함\n84 = 2 × 42','소인수만 남은 결과\n84 = 2² × 3 × 7'];
    const expected=['개념플러스','2는 어떤 소수일까?','① 소수 중 유일한 짝수','② 가장 작은 소수','자연수는 1, 소수, 합성수로 이루어져 있다.','1의 거듭제곱은 항상 1이다.','a≠0일 때, a1=a로 정한다.','소인수분해 한 결과는 작은 소인수부터 차례대로 쓰고같은 소인수의 곱은 거듭제곱으로 나타낸다.','소인수분해 한 결과는 반드시 소인수만의 곱으로 나타내어야 한다.','→ 84=2×42 (×)','84=22×3×7 (○)'];
    if(expected.every((v,i)=>textOf(shapes[i])===v)) shapes.forEach((sp,i)=>{
      const [x,y,w,h,sz,bg,color]=rows[i], prop=child(sp,'spPr'), transform=child(prop,'xfrm'), off=child(transform,'off'), ext=child(transform,'ext');
      for(const [node,key,v] of [[off,'x',x],[off,'y',y],[ext,'cx',w],[ext,'cy',h]]) node.setAttribute(key,String(v*12700));
      const body=child(sp,'txBody'), bp=child(body,'bodyPr');
      bp.setAttribute('anchor','ctr'); for(const key of ['lIns','rIns','tIns','bIns']) bp.setAttribute(key, key==='lIns'&&bg?'114300':'0');
      for(const c of Array.from(bp.children)) if(/autofit/i.test(c.localName))c.remove();
      bp.append(make('noAutofit')); for(const p of Array.from(body.children))if(p.localName==='p')p.remove();
      for(const line of strs[i].split('\n')){
        const para=make('p');body.append(para);
        for(const token of line.match(/[0-9a¹²≠=×]+|[^0-9a¹²≠=×]+/gu)||[]){
          const r=make('r'),style=make('rPr'),t=make('t'); style.setAttribute('sz',String(sz*100));style.setAttribute('b','1');fill(style,color);
          for(const k of ['latin','ea','cs']){const face=make(k);face.setAttribute('typeface',/^[0-9a¹²≠=×]/.test(token)?'Lora':'Noto Sans KR');style.append(face);}
          t.textContent=token;r.append(style,t);para.append(r);
        }
      }
      if(bg)panel(sp,bg); count++;
    });
  }
  return count;
}

export async function fillTemplate(bytes, generated, picks, extras, topic, nextTopic, title, onSlideOrder) {
  const template=await window.JSZip.loadAsync(bytes), source=await window.JSZip.loadAsync(generated);
  const main='ppt/presentation.xml', pres=await xml(template,main), rels=await xml(template,relPath(main));
  const ratio=Number(first(pres,'sldSz').getAttribute('cx'))/Number(first(await xml(source,main),'sldSz').getAttribute('cx'));
  const slots=new Map(picks.map((q,i)=>[q.slot,{number:i+1,id:q.question_id}]));
  const seen=new Set(), quizSeen=new Set(), order=[];
  const sampleTopic='소인수분해를 이용하여약수 구하기';
  for(const id of parts(pres,'sldId')) {
    const ref=parts(rels,'Relationship').find(r=>r.getAttribute('Id')===id.getAttributeNS(REL,'id'));
    const file=target(main,ref.getAttribute('Target')), doc=await xml(template,file);
    const shapes=parts(doc,'sp'), label=shapes.length===1?textOf(shapes[0]):'';
    const normal=label.match(/^(기본|예비)\s*문제\s*(\d+)$/);
    const quiz=label.match(/^(?:퀴즈앤|교사부록|RPM(?:\s*(?:Pro|빈출|고난도))?)\s*문제\s*(\d+)$/);
    let entry;
    if(normal || quiz) {
      const slot=Number((normal || quiz).at(-1));
      if(normal) {entry=slots.get(slot);if(entry)seen.add(slot);}
      else if(extras[slot-1]) { entry={number:picks.length+slot,id:extras[slot-1].q?.question_id};quizSeen.add(slot); }
      if(!entry){id.remove();ref.remove();continue;}
      await placeContent(template,source,doc,file,entry.number,ratio);
    } else {
      const topicBox=shapes.find(sp=>textOf(sp).replace(/\s/g,'')===sampleTopic.replace(/\s/g,''));
      if(topicBox) {
        const next=shapes.find(sp=>textOf(sp)==='다음 회차 내용');
        setTopic(topicBox,next ? nextTopic || topic : topic);
        if(next && !nextTopic)setTopic(next,'수업 마무리');
      }
    }
    applyLessonLabelColors(doc);
    order.push(entry?.id??null);template.file(file,serialize(doc));
  }
  if(seen.size!==picks.length || quizSeen.size!==extras.length) throw Error('제출한 문항 수와 PPT 양식의 자리가 다릅니다.');
  template.file(main,serialize(pres));template.file(relPath(main),serialize(rels));
  if(template.file('docProps/core.xml')) {
    const core=await xml(template,'docProps/core.xml');
    if(first(core,'title'))first(core,'title').textContent=title;
    template.file('docProps/core.xml',serialize(core));
  }
  onSlideOrder?.(order);
  return template.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',compression:'DEFLATE'});
}
