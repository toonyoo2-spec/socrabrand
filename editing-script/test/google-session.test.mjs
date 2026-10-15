import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleSession} from '../../google-session.mjs';
function fixture(){const map=new Map();const storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};let time=1000;return {map,storage,setTime:v=>time=v,session:createGoogleSession('test',()=>storage,()=>time)};}
test('valid Google session restores after module recreation, until expiry',()=>{const f=fixture();f.session.save('client-a','test-only-token',5000);const reloaded=createGoogleSession('test',()=>f.storage,()=>2000);assert.equal(reloaded.read('client-a').token,'test-only-token');f.setTime(5000);assert.equal(f.session.read('client-a'),null);assert.equal(f.map.size,0);});
test('client mismatch, malformed data and disconnect clear saved session',()=>{const f=fixture();f.session.save('a','test',4000);assert.equal(f.session.read('b'),null);f.map.set('test','bad-json');assert.equal(f.session.read('a'),null);f.session.save('a','test',4000);f.session.clear();assert.equal(f.session.read('a'),null);});
test('blocked browser storage does not break Google connection',()=>{const session=createGoogleSession('test',()=>{throw Error('blocked');});assert.doesNotThrow(()=>session.save('a','test',Date.now()+10000));assert.equal(session.read('a'),null);assert.doesNotThrow(()=>session.clear());});
