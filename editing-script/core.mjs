import {EDITING_POLICY} from './policy.mjs?v=20261015';
export function timecode(n){if(!Number.isFinite(n)||n<0)throw Error('RT는 0 이상의 초 단위 숫자여야 합니다.');const ms=Math.round(n*1000);return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms%60000/1000)).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
export function seconds(s){if(typeof s==='number')return s;const t=String(s).trim().replace(',','.');if(/^\d+(\.\d+)?$/.test(t))return Number(t);const p=t.split(':').map(Number);if(p.length<2||p.length>3||p.some(x=>!Number.isFinite(x)||x<0)||p.slice(1).some(x=>x>=60))throw Error('RT는 00:00.000 형식으로 입력해 주세요.');return p.reduce((v,x)=>v*60+x,0);}
export function normalize(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/[^a-z0-9가-힣]/g,'');}
export function dropboxLink(value){const u=new URL(String(value).trim());if(u.protocol!=='https:'||!['www.dropbox.com','dropbox.com','dl.dropboxusercontent.com'].includes(u.hostname)||!/^\/(s|scl)\//.test(u.pathname))throw Error('Dropbox 공개 공유 링크를 입력해 주세요.');u.hash='';return u.href;}
export function parseTranscript(text,name=''){
 if(/\.json$/i.test(name)||/^\s*[\[{]/.test(text)){
  const x=JSON.parse(text);if(x.version===1&&Array.isArray(x.rows))return {rows:x.rows.map(validateRow),restored:true};
  const list=Array.isArray(x)?x:x.segments||x.chunks;if(!Array.isArray(list))throw Error('segments 또는 chunks가 있는 전사 JSON을 선택해 주세요.');
  return {segments:list.map(s=>({start:s.start??s.timestamp?.[0],end:s.end??s.timestamp?.[1],text:String(s.text||'').trim()})).filter(s=>s.text).map(validateSegment)};
 }
 const blocks=text.replace(/\r/g,'').split(/\n\s*\n/);const segments=[];
 for(const b of blocks){const l=b.split('\n'),i=l.findIndex(x=>x.includes('-->'));if(i<0)continue;const [a,z]=l[i].split('-->').map(x=>x.trim().split(/\s/)[0]);segments.push(validateSegment({start:seconds(a),end:seconds(z),text:l.slice(i+1).join(' ').replace(/<[^>]*>/g,'').trim()}));}
 if(!segments.length)throw Error('RT가 있는 JSON·SRT·VTT 전사 파일을 선택해 주세요.');return {segments};
}
function validateSegment(s){if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start)throw Error('전사 구간의 시작·종료 RT를 확인해 주세요. 누락된 시간을 임의로 만들지 않습니다.');return s;}
export function validateRow(row){const r={...row,start:seconds(row.start),end:seconds(row.end),full:String(row.full||''),caption:String(row.caption||''),section:String(row.section||'표현'),status:row.status||'확정 후보',slide:Number(row.slide)||null,flags:Array.isArray(row.flags)?row.flags.map(String):[]};validateSegment({...r,text:r.full});if(!['확정 후보','확정','미사용','판독 보류','무발화'].includes(r.status))throw Error('알 수 없는 편집판정입니다.');return r;}
export function slideText(s){function visit(e){return (e.shape?.text?.textElements||[]).map(t=>t.textRun?.content||'').join('')+(e.table?.tableRows||[]).flatMap(r=>(r.tableCells||[]).map(c=>(c.text?.textElements||[]).map(t=>t.textRun?.content||'').join(''))).join('\n')+(e.elementGroup?.children||[]).map(visit).join('\n');}return (s.pageElements||[]).map(visit).join('\n').trim();}
const grams=s=>{s=normalize(s);return new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));};
function score(a,b){const x=grams(a),y=grams(b);let n=0;for(const v of x)if(y.has(v))n++;return 2*n/Math.max(1,x.size+y.size);}
function quotes(s){return [...String(s).matchAll(/["“”‘’]([^"“”‘’\n]{3,120})["“”‘’]/g)].map(x=>x[1]).filter(x=>/[A-Za-z]/.test(x));}
export function buildRows(segments,slides){let previous=0,lastCaption='';return segments.map(s=>{
 let best=null,bestScore=0;for(const slide of slides){const body=slide.text.replace(/표현\s*\d+_.*$/gm,'');const n=score(s.text,body);if(n>bestScore){best=slide;bestScore=n;}}
 if(bestScore<.13)best=null;
 const full=s.text,flags=[];if(!best)flags.push('PPT 대응 확인');if(/다시\s*(할게|해볼게|시작|하겠)|죄송|기침|목소리.*이상|여기서.*해도.*될까/.test(full))flags.push('재촬영·제작 대화 검수');if(/\[.*(불명|판독|확인)/.test(full))flags.push('음절 확인');
 let section='설명';if(best){for(let i=best.number-1;i>=0;i--){const t=slides.find(x=>x.number===i+1)?.text||'';if(/^(Decode|Key Points?|Pro Tip|Check-Up|Practice|배경설명|마무리 영상|표현\s*\d+)\s*$/i.test(t)){section=t;break;}}}
 let caption='';if(best&&!flags.includes('재촬영·제작 대화 검수')){
  const exact=quotes(best.text).find(q=>normalize(full).includes(normalize(q))&&q.split(/\s+/).length>=2);
  if(exact&&best.number!==previous){caption=`"${exact}"`;const korean=[...full.matchAll(/["“”‘’]([^"“”‘’\n]{2,40})["“”‘’]/g)].map(m=>m[1]).find(q=>/[가-힣]/.test(q)&&!/[A-Za-z]/.test(q));if(korean)caption+='\n'+korean;}
  if(/^[ABC][.)]\s/.test(full))caption=full;
  if(/정답은/.test(full))caption=full.split(/[.!?。]\s/)[0];
 }
 if(caption&&caption===lastCaption)caption='';if(caption)lastCaption=caption;previous=best?.number||previous;
 return {start:s.start,end:s.end,full,caption,section,status:'확정 후보',slide:best?.number||null,flags};
});}
export function sheetRequests(rows,title,meta={}){const header=EDITING_POLICY.headers;const preface=[[title,'','','편집스크립트',''],['음원',meta.audioName||'', '', '취소선 = 미사용 발화. 확정 = 채택 테이크. 확정 후보·판독 보류는 확인 필요.',''],['대응 PPT',title,'','실제 발화 기준 / PPT 의미 단위로 분할 / RT는 원본 MP3 기준',''],['PPT 원문','','',meta.presentationUrl||'',''],['영상링크','','',meta.videoUrl||'','']];const values=[...preface,header,...rows.map(r=>[`${timecode(r.start)} – ${timecode(r.end)}`,r.lecture||meta.lecture||title,[r.expression,r.section,r.status].filter(Boolean).join('\n'),r.full,r.status==='확정'?r.caption:''])];return {headerIndex:5,dataStartIndex:6,values,rows:values.map(v=>({values:v.map(t=>({userEnteredValue:{stringValue:String(t)}}))}))};}
