// Current output contract: one request workbook, numeric lecture/expression order.
export const OUTPUT_STRUCTURE=Object.freeze({filePerRequest:true,filePerLecture:false,tabPerExpression:true,tabOrder:'lecture_expression_numeric',rtOrigin:'each_audio_start'});
const natural=(a,b)=>String(a||'').localeCompare(String(b||''),'ko',{numeric:true});
const safe=name=>String(name).replace(/[\[\]:*?/\\]/g,'-').slice(0,100);
export function orderedTabs(pairs){
 const sorted=pairs.map(p=>({...p})).sort((a,b)=>(a.lecture??Infinity)-(b.lecture??Infinity)||(a.expression??Infinity)-(b.expression??Infinity)||natural(a.group,b.group)||natural(a.ppt?.id,b.ppt?.id));
 const counts=new Map();for(const p of sorted){const key=`${p.lecture}-${p.expression}`;counts.set(key,(counts.get(key)||0)+1);}
 const used=new Set();return sorted.map(p=>{const key=`${p.lecture}-${p.expression}`;let title=safe(counts.get(key)>1?`${p.group||p.ppt?.name||'강의 묶음'} · ${key}`:key),base=title,n=2;while(used.has(title))title=base.slice(0,95)+' ('+n+++')';used.add(title);return {...p,sheetTab:title};});
}
