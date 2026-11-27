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
    count++;
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
