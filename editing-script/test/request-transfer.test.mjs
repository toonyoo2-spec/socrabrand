import test from 'node:test';
import assert from 'node:assert/strict';
import {copyRequest,requestFile,transferInfo} from '../request-transfer.mjs';
const long='요청문 시작\n'+ '강의·표현·오디오 🔊\n'.repeat(5000)+'마지막 강의 끝';
test('long request copies and downloads the exact full text including final lecture',async()=>{
 let copied;assert.equal(await copyRequest({value:long},{writeText:async value=>{copied=value;}}),true);
 assert.equal(copied,long);assert.equal(await requestFile(long).text(),long);
 assert.equal(transferInfo(long).characters,Array.from(long).length);
 assert.match(transferInfo(long).message,/파일로/);
});
test('clipboard rejection selects full text and uses fallback, never reports failure as success',async()=>{
 let selection,focused=false,selected=false;
 const area={value:long,focus(){focused=true;},select(){selected=true;},setSelectionRange(a,b){selection=[a,b];}};
 const denied={writeText:async()=>{throw Error('denied');}};
 assert.equal(await copyRequest(area,denied,{execCommand:cmd=>cmd==='copy'}),true);
 assert.ok(focused&&selected);assert.deepEqual(selection,[0,long.length]);
 assert.equal(await copyRequest(area,denied,{execCommand:()=>false}),false);
 assert.equal(await copyRequest(area,undefined,{execCommand:()=>{throw Error('unsupported');}}),false);
});
