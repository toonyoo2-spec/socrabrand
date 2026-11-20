import test from 'node:test';
import assert from 'node:assert/strict';
import {typeRuns} from '../math-automation/math-type.mjs';

function verifyText(input, check, math=true) {
  const runs=typeRuns(input,math);
  assert.equal(runs.map(r=>r.text).join(''),input);
  for(const {text,options} of runs)for(const ch of text)check(ch,options);
}

test('unit codes, labels and numbered prompts are upright',()=>{
  for(const text of ['Ⅰ-1 소인수분해','IV-3 일차방정식']) {
    verifyText(text,(_,o)=>{assert.equal(o.italic,false);assert.equal(o.fontFace,'Pretendard');});
  }
  for(const text of ['0001','(1)','RPM 9p 0001~0006번']){
    verifyText(text,(_,o)=>{assert.equal(o.italic,false);assert.equal(o.fontFace,'Pretendard');},false);
  }
});
test('judgment marks, placeholders, operators and numerals remain upright',()=>{
  for(const text of ['○, △, ×를 (　) 안에','□ 안에 알맞은 수','2 × 3 = 6']){
    verifyText(text,(_,o)=>assert.equal(o.italic,false));
  }
});
test('inline variables retain Lora italic in questions and lesson titles',()=>{
  for(const text of ['x에 대한 두 방정식','3x + y = 2','a와 b의 곱']){
    verifyText(text,(ch,o)=>{
      if(/[xyab]/.test(ch)){assert.equal(o.italic,true);assert.equal(o.fontFace,'Lora');}
      else assert.equal(o.italic,false);
    });
  }
});
