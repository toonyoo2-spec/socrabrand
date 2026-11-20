import {typeRuns,loadLessonFonts} from './math-type.mjs';
// Lay out selectable text in the browser, then transfer its lines, rules and original figures to PPT.
const FACE='Pretendard', PX=96, marks='①②③④⑤';
const W=1300,H=835,LEFT=62,TOP=161;
const node=(tag,css='')=>{const n=document.createElement(tag);n.style.cssText=css;return n;};
function closingBrace(value,start){
  let depth=0;
  for(let i=start;i<value.length;i++){
    if(value[i]==='{')depth++;
    if(value[i]==='}' && --depth===0)return i;
  }
  return -1;
}
function fractionSlash(value){
  let depth=0;
  for(let i=0;i<value.length;i++){
    if(value[i]==='{')depth++;
    else if(value[i]==='}')depth--;
    else if(value[i]==='/' && !depth)return i;
  }
  return -1;
}
function styleText(el,text){
  const value=String(text);
  let i=0,plain='';
  function flush(){
    for(const {text,options} of typeRuns(plain)){
      const span=node('span');span.style.fontFamily=options.fontFace;
      span.style.fontStyle=options.italic?'italic':'normal';span.dataset.face=options.fontFace;
      span.textContent=text;el.append(span);
    }
    plain='';
  }
  while(i<value.length){
    if(value.startsWith('<u>',i)){
      const end=value.indexOf('</u>',i+3);
      if(end<0)throw Error('문항의 밑줄 범위를 확인해 주세요.');
      flush();const u=node('u');styleText(u,value.slice(i+3,end));el.append(u);i=end+4;continue;
    }
    const script=value[i]==='^'||value[i]==='_';
    if(script && (value[i+1]==='{' || (value[i]==='^' && /^[A-Za-z0-9]/.test(value.slice(i+1))))){
      const grouped=value[i+1]==='{';
      const end=grouped?closingBrace(value,i+1):i+(value.slice(i+1).match(/^\d+|^[A-Za-z]/)[0].length);
      if(end<0)throw Error('문항의 지수 범위를 확인해 주세요.');
      flush();const sup=node(value[i]==='^'?'sup':'sub','font-size:64%;line-height:0');
      styleText(sup,value.slice(i+(grouped?2:1),end+(grouped?0:1)));el.append(sup);i=end+1;continue;
    }
    if(value[i]==='{'){
      const end=closingBrace(value,i),group=value.slice(i+1,end),slash=fractionSlash(group);
      if(end>i && slash>0){
        flush();const frac=node('span','display:inline-flex;vertical-align:middle;flex-direction:column;align-items:stretch;text-align:center;line-height:1.13;font-size:84%;margin:0 .07em;white-space:nowrap');
        for(const [n,part] of [group.slice(0,slash),group.slice(slash+1)].entries()){
          const cell=node('span','padding:0 .09em');
          if(!n){cell.dataset.rule='1';cell.style.borderBottom='2px solid white';}
          styleText(cell,part);frac.append(cell);
        }
        el.append(frac);i=end+1;continue;
      }
    }
    plain+=value[i++];
  }
  flush();
}
function displayedChoices(content,quiz){
  const arr=content.choices,meta=quiz?.book_quiz;
  if(!meta)return arr;
  if(meta.mode==='pairs')return arr;
  if(!Array.isArray(meta.retained)||meta.retained.length!==4||new Set(meta.retained).size!==4)throw Error('퀴즈앤 보기 순서를 확인해 주세요.');
  return meta.retained.map(i=>{
    if(!Number.isInteger(i)||typeof arr[i-1]!=='string')throw Error('퀴즈앤 보기와 교재 원문이 일치하지 않습니다.');
    return arr[i-1];
  });
}
async function figureSource(image, bounds){
  if(!Array.isArray(bounds)||bounds.length!==4||bounds.some(v=>!Number.isFinite(v)||v<0||v>1)||bounds[2]<=bounds[0]||bounds[3]<=bounds[1])throw Error('원본 도형 위치를 확인해 주세요.');
  const [l,t,r,b]=bounds;
  const x=Math.floor(l*image.width),y=Math.floor(t*image.height);
  const c=node('canvas');c.width=Math.ceil(r*image.width)-x;c.height=Math.ceil(b*image.height)-y;
  c.getContext('2d').drawImage(image,x,y,c.width,c.height,0,0,c.width,c.height);
  const img=node('img','vertical-align:middle;max-width:92%;height:auto;max-height:4.1em;object-fit:contain;margin:0 .16em');
  img.src=c.toDataURL('image/png');await img.decode();
  img.style.width='min('+Math.min(750,c.width*.50)+'px, '+(4.1*c.width/c.height)+'em)';
  return img;
}
async function addContent(root,g,quiz,loadImage,q){
  let image;
  async function rich(el,value){
    for(const part of value.split(/(\[\[(?:그림|표)\d+\]\])/g)){
      const ref=part.match(/^\[\[(그림|표)(\d+)\]\]$/);
      if(!ref){styleText(el,part);continue;}
      const i=Number(ref[2])-1;
      if(ref[1]==='그림'){
        image??=await createImageBitmap(await loadImage({...q,projection_asset:null}));
        el.append(await figureSource(image,g.figures[i]));
      }else{
        const table=node('table','display:inline-table;border-collapse:collapse;vertical-align:middle;text-align:center;font-size:.88em;line-height:1.2;margin:.12em .3em');
        for(const row of g.tables[i]){
          const tr=table.insertRow();for(const val of row){const td=tr.insertCell();td.style.cssText='border:2px solid white;min-width:1.8em;padding:.05em .24em';styleText(td,val);}
        }
        el.append(table);
      }
    }
  }
  try{
    const stem=node('div','line-height:1.38;margin-bottom:.36em');await rich(stem,g.stem);root.append(stem);
    if(g.body){const body=node('div','font-size:.84em;line-height:1.38;margin-bottom:.3em');await rich(body,g.body);root.append(body);}
    const choices=displayedChoices(g,quiz);
    if(choices.length){
      const grid=node('div','display:grid;gap:.14em .64em;font-size:.86em;line-height:1.35;grid-template-columns:repeat('+ (choices.some(c=>c.length>30)?1:2)+', minmax(0,1fr))');
      for(const [i,txt] of choices.entries()){
        const cell=node('div');await rich(cell,(marks[i]??String(i+1))+ '　'+txt);grid.append(cell);
      }
      root.append(grid);
    }
    if(quiz?.book_quiz?.mode==='pairs'){
      const el=node('div','font-size:.75em;margin-top:.6em;line-height:1.4');styleText(el,'답 버튼　'+quiz.choices.split('\n').map((s,i)=>(i+1)+'. '+s).join('　　 '));root.append(el);
    }
  }finally{image?.close();}
}
function* textLines(t){
  const range=document.createRange();
  let line;
  for(let i=0;i<t.length;){
    const char=String.fromCodePoint(t.data.codePointAt(i));
    range.setStart(t,i);range.setEnd(t,i+char.length);i+=char.length;
    const rect=range.getBoundingClientRect();
    if(!rect.width || !rect.height || char==='\n')continue;
    if(!line || Math.abs(rect.top-line.top)>1){
      if(line)yield line;
      line={text:'',top:rect.top,left:rect.left,bottom:rect.bottom,right:rect.right};
    }
    line.text+=char;line.right=Math.max(line.right,rect.right);
  }
  if(line)yield line;
}
export async function addGothicQuestion(slide,q,loadImage){
  const g=q.gothic_content;
  if(!g?.stem)throw Error(q.book+' '+q.label+' · 제출본의 문항 원문을 준비하고 있습니다.');
  await loadLessonFonts();
  const root=node('div','position:fixed;top:0;left:-5000px;visibility:hidden;width:'+W+'px;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;font:700 50px "'+FACE+'",sans-serif;line-height:1.38;letter-spacing:0;');
  document.body.append(root);
  try{
    await addContent(root,g,q.quiz_override,loadImage,q);
    let size=50;
    while(root.getBoundingClientRect().height>H && size>21){root.style.fontSize=(--size)+'px';}
    if(root.getBoundingClientRect().height>H||root.scrollWidth>W+1)throw Error(q.label+' · 한 장에 문항을 배치할 수 없습니다.');
    const border=root.getBoundingClientRect();
    const xy=(l,t)=>({x:(LEFT+l-border.left)/PX,y:(TOP+t-border.top)/PX});
    for(const cell of root.querySelectorAll('td,[data-rule]')){
      const r=cell.getBoundingClientRect();
      if(cell.dataset.rule)slide.addShape('line',{...xy(r.left,r.bottom-1),w:r.width/PX,h:0,line:{color:'FFFFFF',width:1.25}});
      else slide.addShape('rect',{...xy(r.left,r.top),w:r.width/PX,h:r.height/PX,line:{color:'B9C4C7',width:.8},fill:{color:'111111',transparency:100}});
    }
    for(const img of root.querySelectorAll('img')){
      const r=img.getBoundingClientRect();slide.addImage({data:img.src,...xy(r.left,r.top),w:r.width/PX,h:r.height/PX,altText:'원본 도형'});
    }
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const t=walker.currentNode,css=getComputedStyle(t.parentElement);
      for(const l of textLines(t)){
        if(!l.text.trim())continue;
        slide.addText(l.text,{...xy(l.left,l.top),w:(l.right-l.left+12)/PX,h:(l.bottom-l.top)/PX,margin:0,fontFace:t.parentElement.dataset.face??FACE,italic:css.fontStyle==='italic',bold:true,color:'FFFFFF',fontSize:parseFloat(css.fontSize)*.75,
          underline:!!t.parentElement.closest('u'),valign:'mid',align:'left',wrap:false,lang:'ko-KR',paraSpaceAfter:0,paraSpaceBefore:0});
      }
    }
  }finally{root.remove();}
}
