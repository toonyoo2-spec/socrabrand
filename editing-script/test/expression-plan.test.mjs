import test from 'node:test';
import assert from 'node:assert/strict';
import {expressionParts,audioNumbers} from '../expression-plan.mjs';
import {pairFiles,makeRequest,requestIssues} from '../request.mjs';
const ppt={id:'p',name:'[강사] 영어 표현_13강_제목',slides:[{number:1,text:'주제'},{number:2,text:'표현1'},{number:3,text:'설명\n표현 1_ hello'},{number:4,text:'표현2'},{number:5,text:'설명\n표현 2_ bye'}]};
test('lecture PPT splits into expressions, retaining original page numbers and per-audio RT origin',()=>{
 const rows=pairFiles([ppt],[{id:'a1',name:'day13-1.mp3'},{id:'a2',name:'day13-2.wav'}]);assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.audio.id),['a1','a2']);assert.deepEqual(rows.map(r=>[r.slideStart,r.slideEnd]),[[1,3],[4,5]]);assert.deepEqual(rows[1].slides.map(s=>s.number),[4,5]);
 const plan={course:{id:'parent',name:'강의'},source:{id:'ppt',name:'프롬프트'},audioFolder:{id:'audio',name:'오디오'},files:rows};assert.deepEqual(requestIssues(plan),[]);const text=makeRequest(plan);const payload=JSON.parse(text.split('작업 자료(JSON):\n')[1]);assert.equal(payload.outputStructure.filePerLecture,true);assert.equal(payload.pairs[1].sheetTab,'13-2 표현2');assert.equal(payload.pairs[1].rtOrigin,'해당 오디오 00:00');assert.equal(payload.pairs[1].ppt.id,'p');assert.match(text,/누적 시간을 만들지/);
});
test('ambiguous formats, missing second audio and unknown PPT sections cannot silently generate requests',()=>{
 const rows=pairFiles([ppt],[{id:'a',name:'day13-1.mp3'},{id:'b',name:'day13-1.wav'}]);assert.equal(rows[0].audio,null);assert.equal(rows[1].audio,null);
 const unknown=pairFiles([{...ppt,slides:[{number:1,text:'표현 없는 자료'}]}],[]);assert.match(unknown[0].segmentationError,/표현 번호/);
 assert.equal(expressionParts({...ppt,slides:[{number:1,text:'표현2'},{number:2,text:'표현1'}]}).parts.length,0);
 assert.deepEqual(audioNumbers('1-2.WAV'),{lecture:1,expression:2});assert.deepEqual(audioNumbers('2강_표현1.mp3'),{lecture:2,expression:1});assert.deepEqual(audioNumbers('day13-2.mp3'),{lecture:13,expression:2});
});
