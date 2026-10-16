import test from 'node:test';
import assert from 'node:assert/strict';
import {pairFiles,requestIssues,makeRequest} from '../request.mjs';
test('match exact titles or uniquely numbered lectures; never guess ambiguous audio',()=>{const ppts=[{id:'p1',name:'[강사] 필수 영어 표현_1강_제목'},{id:'p2',name:'2일차_과정'},{id:'p3',name:'3강'},{id:'p4',name:'Quiz'}];const audios=[{id:'a1',name:'1강_녹음.mp3'},{id:'a2',name:'2일차.mp3'},{id:'a3',name:'3강_take1.mp3'},{id:'a4',name:'3강_take2.mp3'}];const rows=pairFiles(ppts,audios);assert.equal(rows[0].audio.id,'a1');assert.equal(rows[1].audio.id,'a2');assert.equal(rows[2].audio,null);assert.equal(rows[2].candidates.length,2);assert.equal(rows[3].audio,null);});
test('request includes exact IDs and rules, with no OAuth credentials; duplicate and missing audio blocked',()=>{const plan={course:{id:'root',name:'0'},source:{id:'ppt',name:'PPT'},audioFolder:{id:'audio',name:'MP3'},files:pairFiles([{id:'p1',name:'1강'}],[{id:'a1',name:'1강.mp3'}]),token:'never-copy-me'};assert.deepEqual(requestIssues(plan),[]);const message=makeRequest(plan);assert.ok(message.includes('https://drive.google.com/drive/folders/root'));assert.ok(message.includes('https://drive.google.com/file/d/a1/view'));assert.ok(message.includes('취소선'));assert.ok(message.includes('A~E'));assert.ok(message.includes('F열은 읽기·학습·작성·출력에서 제외'));assert.ok(message.includes('Check-Up'));assert.ok(message.includes('2026-10-15'));assert.ok(!message.includes('never-copy-me'));assert.ok(!message.includes('access_token'));plan.files.push({...plan.files[0],id:'p2'});assert.throws(()=>makeRequest(plan),/중복/);plan.files[1].audio=null;assert.throws(()=>makeRequest(plan),/오디오 선택 필요/);});

test('WAV matches exact title and ambiguous formats require a choice; request uses PPT parent',()=>{
 const ppts=[{id:'p',name:'Interview'}];
 const audio=[{id:'w',name:'Interview.WAV'}];
 const paired=pairFiles(ppts,audio);assert.equal(paired[0].audio.id,'w');
 assert.equal(pairFiles(ppts,[...audio,{id:'m',name:'Interview.mp3'}])[0].audio,null);
 const text=makeRequest({course:{id:'ppt-parent',name:'Course'},source:{id:'slides',name:'Any folder name'},audioFolder:{id:'elsewhere',name:'오디오'},files:paired});
 const data=JSON.parse(text.split('작업 자료(JSON):\n')[1]);
 assert.equal(data.destination.parentFolderId,'ppt-parent');assert.equal(data.audioFolder.url,'https://drive.google.com/drive/folders/elsewhere');assert.equal(data.pairs[0].audio.id,'w');
 assert.ok(text.includes('프롬프트 폴더의 바로 위 상위 폴더'));
});
