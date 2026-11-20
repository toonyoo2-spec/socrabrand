import {typeRuns,loadLessonFonts} from './math-type.mjs?v=2';
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
function styleText(el,text,math=true){
  const value=String(text);
  let i=0,plain='';
  function flush(){
    for(const {text,options} of typeRuns(plain,math)){
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
    const blank=value.slice(i).match(/^_{2,}/);
    if(blank){
      flush();
      const rule=node('span','display:inline-block;vertical-align:baseline;width:'+Math.min(5,Math.max(1.5,blank[0].length*.42))+'em;border-bottom:2px solid white');
      rule.dataset.rule='1';el.append(rule);i+=blank[0].length;continue;
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
  const ctx=c.getContext('2d');
  ctx.drawImage(image,x,y,c.width,c.height,0,0,c.width,c.height);
  const pixels=ctx.getImageData(0,0,c.width,c.height), data=pixels.data;
  // Preserve chromatic features in diagrams. Monochrome ink becomes white on projection.
  const colored=data.some((_,i)=>i%4===0 && Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>35);
  if(!colored){
    const alpha=new Uint8Array(c.width*c.height);
    for(let j=0;j<alpha.length;j++)alpha[j]=(255-data[4*j])*data[4*j+3]/255;
    for(let j=0;j<alpha.length;j++){
      const i=4*j,x=j%c.width;
      data[i+3]=Math.min(255,1.65*Math.max(alpha[j],x?alpha[j-1]:0,x<c.width-1?alpha[j+1]:0,alpha[j-c.width]??0,alpha[j+c.width]??0));
      data[i]=data[i+1]=data[i+2]=255;
    }
  }else for(let i=0;i<data.length;i+=4){
    const hi=Math.max(data[i],data[i+1],data[i+2]),lo=Math.min(data[i],data[i+1],data[i+2]);
    if(hi-lo>8 || lo<250)continue;
    data[i+3]=Math.round(data[i+3]*(255-lo)/255);
    data[i]=data[i+1]=data[i+2]=255;
  }
  ctx.putImageData(pixels,0,0);
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
  async function layoutBody(body,value){
    const items=[...value.matchAll(/(?:^|\n|[ \u3000]{2,})(\(\d+\)|\d{4,})(?=[ \u3000])/g)];
    if(items.length<2 || items[0].index!==0){await rich(body,value);return;}
    const entries=items.map((m,i)=>({label:m[1],text:value.slice(m.index+m[0].length,items[i+1]?.index).trim()}));
    const hasBlank=entries.every(e=>/\([ \u3000]+\)$/.test(e.text));
    const columns=entries.every(e=>e.text.length<44) && !entries.some(e=>/[가-힣]{2}/.test(e.text.replace(/\[\[그림\d+\]\]/g,''))) ? 2 :
      entries.every(e=>e.text.includes('[[그림')) ? 2 : 1;
    body.style.cssText+=';display:grid;grid-template-columns:repeat('+columns+',minmax(0,1fr));gap:.32em 1em;';
    for(const {label,text} of entries){
      const row=node('div','display:grid;grid-template-columns:max-content 1fr'+(hasBlank?' max-content':'')+';column-gap:.35em;align-items:baseline;min-width:0');
      const number=node('span');styleText(number,label,false);row.append(number);
      const cell=node('div','min-width:0');
      await rich(cell,(hasBlank?text.replace(/\s*\([ \u3000]+\)$/,''):text).replace(/(하면)[ \u3000]+(?=\d+\s*=)/g,'$1\n'));
      const illustration=cell.querySelector(':scope > img:first-child');
      if(illustration && columns===2){
        const frame=node('span','display:inline-flex;height:4.4em;align-items:flex-start;vertical-align:top;');
        illustration.before(frame);frame.append(illustration);
        row.style.alignItems='start';
      }
      row.append(cell);
      if(hasBlank){const answer=node('span');styleText(answer,'(　　 )',false);row.append(answer);}
      body.append(row);
    }
  }
  try{
    const stem=node('div','line-height:1.38;margin-bottom:.36em');await rich(stem,g.stem);root.append(stem);
    if(g.body){const body=node('div','font-size:.84em;line-height:1.38;margin-bottom:.3em');await layoutBody(body,g.body);root.append(body);}
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
    for(const row of root.querySelectorAll('div,table,img,span[data-rule]')){
      const box=row.getBoundingClientRect();
      if(box.right>border.right+1 || box.left<border.left-1 || box.bottom>border.top+H+1)
        throw Error(q.label+' · 문항 또는 답칸이 투사 영역을 벗어났습니다.');
    }
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
