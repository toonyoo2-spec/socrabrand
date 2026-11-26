// Build one deck per submission from real picks; figures get a blank page so text can be reviewed.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const [,, root, picksFile, outDir]=process.argv;
const types={'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.ttf':'font/ttf'};
const srv=http.createServer((q,r)=>{if(q.url==='/blank'){r.setHeader('content-type','text/html');r.end('<html><body></body></html>');return;}const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.statusCode=404;r.end();return;}r.setHeader('content-type',types[path.extname(f)]||'application/octet-stream');r.end(d);});}).listen(0,async()=>{
 const b=await chromium.launch();const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('http://localhost:'+srv.address().port+'/blank');
 const decks=JSON.parse(fs.readFileSync(picksFile,'utf8'));fs.mkdirSync(outDir,{recursive:true});
 for(const [name,picks] of Object.entries(decks)){
  const res=await p.evaluate(async(picks)=>{
   const {buildPresentation}=await import('/math-automation/presentation.mjs');
   const blank=async()=>{const c=document.createElement('canvas');c.width=2400;c.height=3200;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,2400,3200);x.fillStyle='#000';x.fillRect(200,200,40,40);return new Promise(r=>c.toBlob(r));};
   const errors=[];const ok=[];
   for(const q of picks){try{await buildPresentation({title:'t',picks:[q],quizzes:[],appendix:[]},blank);ok.push(q);}catch(e){errors.push(q.label+': '+e.message);}}
   const blob=await buildPresentation({title:'t',picks:ok.map((q,i)=>({...q,slot:i+1})),quizzes:[],appendix:[]},blank);
   return {errors,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))};
  },picks.map(q=>({...q,quiz_override:q.kind==='sel'?undefined:q.quiz_override})));
  fs.writeFileSync(path.join(outDir,name+'.pptx'),Buffer.from(res.bytes));
  console.log(name,picks.length,'slides',res.errors.length?'ERRORS '+res.errors.join(' | '):'');
 }
 await b.close();srv.close();});
