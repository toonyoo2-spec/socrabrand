// Use folder identity first, then equal folder names for separate PPT/audio trees.
const roleName=name=>/^(ppt|pptx|피피티|파워포인트|프롬프트|audio|audios|오디오|음원|mp3|wav|mp3wav|mp3와wav|mp3및wav)$/.test(normalize(name));
const normalize=name=>String(name||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
function branches(file){return (file.folderPath||[]).slice(1).filter(f=>!roleName(f.name));}
export function groupIdentity(file){return branches(file).map(f=>f.id).join('/')||file.folderPath?.[0]?.id||'';}
export function groupLabel(file){return branches(file).map(f=>f.name).join(' / ');}
function score(ppt,audio){const p=branches(ppt),a=branches(audio);let ids=0,names=0;for(const f of p)if(a.some(g=>g.id===f.id))ids++;for(let i=0;i<Math.min(p.length,a.length);i++){if(!normalize(p[i].name)||normalize(p[i].name)!==normalize(a[i].name))break;names++;}return ids*100+names;}
export function scopedAudios(ppt,ppts,audios,lectureOf){
 const scores=audios.map(a=>score(ppt,a)),best=Math.max(0,...scores);
 if(best>0)return {audios:audios.filter((a,i)=>scores[i]===best),unresolved:false};
 // Dates or other organization folders may share one flat audio folder.
 // Only a globally unique lesson may use audio with no known course association.
 const unscoped=audios.filter(a=>!ppts.some(p=>score(p,a)>0));
 const sameLesson=new Set(ppts.filter(p=>lectureOf(p.name)===lectureOf(ppt.name)).map(p=>p.id));
 if(sameLesson.size>1&&unscoped.length)return {audios:[],unresolved:true};
 return {audios:unscoped,unresolved:false};
}
