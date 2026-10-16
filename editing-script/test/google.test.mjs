import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../google.mjs';
import {sheetRequests} from '../core.mjs';
test('new Sheet is verified before completion; duplicates never overwritten',async()=>{const calls=[];let duplicate=false;const rows=sheetRequests([{start:0,end:2,section:'표현',status:'미사용',full:'다시 할게요',caption:'삭제'}],'테스트').rows;const original=global.fetch;global.window={google:{accounts:{oauth2:{}}}};global.google=window.google;google.accounts.oauth2.initTokenClient=o=>({requestAccessToken:()=>o.callback({access_token:'mock-only',expires_in:3600})});global.fetch=async(url,opts={})=>{calls.push({url,opts});let data={};if(url.includes('config.json'))data={googleClientId:'mock'};else if(url.includes('userinfo'))data={email:'test@example.com'};else if(url.includes('/files?')&&opts.method!=='POST')data={files:duplicate?[{id:'existing'}]:[]};else if(opts.method==='POST'&&url.includes('/files?'))data={id:'new'};else if(url.includes('/values/'))data={values:rows.map(r=>r.values.map(c=>c.userEnteredValue.stringValue))};else if(url.includes('fields=spreadsheetId'))data={sheets:[{properties:{sheetId:0}}]};return new Response(JSON.stringify(data));};try{await G.setupGoogle();await G.connect();const r=await G.saveSheet({rows,title:'테스트',folder:{id:'dest'},source:'ppt',requests:()=>[]});assert.equal(r.file.id,'new');assert.equal(calls.at(-1).opts.method,'PATCH');assert.ok(calls.some(c=>c.url.includes('/values/')));calls.length=0;duplicate=true;const dup=await G.saveSheet({rows,title:'테스트',folder:{id:'dest'},source:'ppt',requests:()=>[]});assert.equal(dup.duplicate,true);assert.equal(calls.length,1);assert.equal(calls[0].opts.method,undefined);}finally{global.fetch=original;delete global.window;delete global.google;}});
test('explicit arbitrary PPT/audio folders support WAV, read only load, PPT parent destination and relocation guard',async()=>{
 const original=global.fetch,calls=[],folder='application/vnd.google-apps.folder';let existing=false,moved=false;
 const files={ppt:{id:'ppt',name:'강의자료_최종',mimeType:folder,parents:['root']},root:{id:'root',name:'Course',mimeType:folder,capabilities:{canAddChildren:true}},audio:{id:'audio',name:'MP3&wav',mimeType:folder,parents:['other']},p1:{id:'p1',name:'1강_제목',mimeType:'application/vnd.google-apps.presentation',parents:['ppt']},p2:{id:'p2',name:'2강_제목',mimeType:'application/vnd.google-apps.presentation',parents:['ppt']},p3:{id:'p3',name:'3강',mimeType:'application/vnd.google-apps.presentation',parents:['other']}};
 global.window={google:{accounts:{oauth2:{}}}};global.google=window.google;
 google.accounts.oauth2.initTokenClient=o=>({requestAccessToken:()=>o.callback({access_token:'mock-only',expires_in:3600})});
 global.fetch=async(url,opts={})=>{calls.push({url,opts});const u=new URL(url,'https://test.local');let data;const id=u.pathname.split('/').at(-1);
 if(url.includes('config.json'))data={googleClientId:'mock'};
 else if(url.includes('userinfo'))data={email:'test@example.com'};
 else if(u.hostname==='slides.googleapis.com')data={slides:[{pageElements:[{shape:{text:{textElements:[{textRun:{content:'표현1\n'}}]}}}]}]};
 else if(id==='files'){
  const q=u.searchParams.get('q')||'';
  if(opts.method==='POST'){const body=JSON.parse(opts.body);assert.deepEqual(body.parents,['root']);assert.equal(body.name,'편집스크립트');data={id:'dest',name:body.name};existing=true;}
  else if(q.includes("'root' in parents"))data={files:existing?[{id:'dest',name:'편집스크립트',capabilities:{canAddChildren:true}}]:[]};
  else if(q.includes("'ppt' in parents"))data={files:[files.p1,files.p2]};
  else if(q.includes("'subfolder' in parents"))data={files:[]};
  else if(q.includes("'audio' in parents"))data={files:[{id:'a1',name:'1-1.mp3',mimeType:'audio/mpeg'},{id:'a2',name:'2-1.WAV',mimeType:'audio/x-wav'},{id:'junk',name:'script.txt',mimeType:'text/plain'},{id:'subfolder',name:'3강.wav',mimeType:folder}]};
  else throw Error(q);
 }else data=id==='ppt'&&moved?{...files.ppt,parents:['new-parent']}:files[id];
 return new Response(JSON.stringify(data));};
 try{
  await G.setupGoogle();await G.connect();calls.length=0;
  const plan=await G.loadPlan('https://drive.google.com/drive/folders/ppt','folder','https://drive.google.com/drive/folders/audio');
  assert.equal(plan.course.id,'root');assert.equal(plan.source.name,'강의자료_최종');assert.equal(plan.audioFolder.name,'MP3&wav');assert.equal(plan.audios.length,2);assert.deepEqual(plan.files.map(f=>f.audio.id),['a1','a2']);
  const picked=await G.loadSelectedPlan([files.p1,files.p2],'https://drive.google.com/drive/folders/audio');assert.equal(picked.files.length,2);
  await assert.rejects(G.loadSelectedPlan([files.p1,files.p3],'https://drive.google.com/drive/folders/audio'),/같은 프롬프트 폴더/);
  const automatic=await G.loadPlan('https://drive.google.com/drive/folders/ppt','folder','');assert.equal(automatic.audioFolder.id,'ppt');assert.equal(automatic.course.id,'ppt');assert.equal(automatic.combinedRoot,true);assert.equal(automatic.files.length,2);assert.equal(automatic.audios.length,0);
  await assert.rejects(G.loadPlan('https://drive.google.com/drive/folders/root','folder','https://drive.google.com/drive/folders/audio'),/상위 폴더/);
  assert.ok(calls.every(x=>!x.opts.method));
  const dest=await G.destination(plan,'',files.p1);assert.equal(dest.id,'dest');assert.equal(calls.filter(x=>x.opts.method==='POST').length,1);
  await G.destination(plan,'',files.p1);assert.equal(calls.filter(x=>x.opts.method==='POST').length,1);
  moved=true;await assert.rejects(G.destination(plan,'',files.p1),/상위 경로가 변경/);
  assert.ok(calls.every(x=>!x.opts.method||x.opts.method==='POST'));
 }finally{global.fetch=original;delete global.window;delete global.google;}
});
test('audio picker starts at PPT parent for pasted folders and selected PPT files, with actual ancestor trail',async()=>{
 const old=global.fetch;const F='application/vnd.google-apps.folder';const data={ppt:{id:'ppt',name:'프롬프트',mimeType:F,parents:['parent']},p1:{id:'p1',parents:['ppt']},parent:{id:'parent',name:'강의자료',mimeType:F,parents:['drive']},drive:{id:'drive',name:'내 드라이브',mimeType:F}};
 global.fetch=async url=>new Response(JSON.stringify(data[new URL(url).pathname.split('/').at(-1)]));try{for(const mode of ['folder','presentation']){const start=await G.audioBrowseStart('https://drive.google.com/drive/folders/ppt',mode,mode==='presentation'?[{id:'p1'}]:[]);assert.equal(start.folder.id,'parent');assert.deepEqual(start.trail.map(f=>f.id),['drive','parent']);}}finally{global.fetch=old;}
});
test('one lecture save creates expression tabs, keeps each RT at zero, verifies both and never overwrites a prior file',async()=>{
 const old=global.fetch,calls=[],saved=new Map();let duplicate=false;
 const parts=[1,2].map(expression=>({name:'1강 · 표현'+expression,tabName:'1-'+expression+' 표현'+expression,lectureNumber:1,expression,slideStart:expression===1?1:30,slideEnd:expression===1?29:55,audio:{id:'audio'+expression,name:'day1-'+expression+'.wav'},rows:[{start:0,end:2,section:'표현',expression:'표현'+expression,status:'미사용',full:'실제 발화'+expression,caption:'',flags:[]}]}));
 global.fetch=async(url,opts={})=>{calls.push({url,opts});let data={};if(url.includes('/files?')&&opts.method!=='POST')data={files:duplicate?[{id:'prior'}]:[]};else if(url.includes('/files?')&&opts.method==='POST')data={id:'new'};else if(url.includes('fields=spreadsheetId'))data={sheets:[{properties:{sheetId:0}}]};else if(url.endsWith(':batchUpdate')){const req=JSON.parse(opts.body).requests;const names=new Map(req.filter(x=>x.updateSheetProperties).map(x=>[x.updateSheetProperties.properties.sheetId,x.updateSheetProperties.properties.title]));for(const x of req)if(x.updateCells?.fields==='userEnteredValue')saved.set(names.get(x.updateCells.range.sheetId),x.updateCells.rows.map(r=>r.values.map(v=>v.userEnteredValue.stringValue)));assert.equal(req.filter(x=>x.addSheet).length,1);}else if(url.includes('/values/')){const range=decodeURIComponent(url.split('/values/')[1]);const title=range.match(/^'(.+)'!/)[1];data={values:saved.get(title)};}return new Response(JSON.stringify(data));};
 try{const result=await G.saveLecture({parts,title:'1강',folder:{id:'dest'},source:'ppt'});assert.equal(result.file.id,'new');assert.equal(saved.size,2);for(const rows of saved.values())assert.match(rows[6][0],/^00:00/);assert.match(saved.get('1-2 표현2')[2][3],/30~55/);assert.equal(calls.filter(x=>x.url.includes('/files?')&&x.opts.method==='POST').length,1);assert.equal(calls.filter(x=>x.url.includes('/values/')).length,2);calls.length=0;duplicate=true;assert.equal((await G.saveLecture({parts,title:'1강',folder:{id:'dest'},source:'ppt'})).duplicate,true);assert.ok(calls.every(x=>!x.opts.method));}finally{global.fetch=old;}
});
test('single selected root saves inside that folder, never My Drive or an extra parent',async()=>{const old=global.fetch,calls=[];const selected={id:'selected',name:'이름이 달라도 됨',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}};global.fetch=async(url,opts={})=>{calls.push({url,opts});let data;if(opts.method==='POST'){const body=JSON.parse(opts.body);assert.deepEqual(body.parents,['selected']);data={id:'new-result',name:body.name};}else if(new URL(url).pathname.endsWith('/selected'))data=selected;else data={files:[]};return new Response(JSON.stringify(data));};try{const result=await G.destination({source:selected,course:selected,combinedRoot:true},'',{});assert.equal(result.id,'new-result');assert.equal(calls.filter(c=>c.opts.method==='POST').length,1);assert.ok(calls.every(c=>!c.url.includes('/root?')));}finally{global.fetch=old;}});
