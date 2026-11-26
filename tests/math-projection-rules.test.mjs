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

import {execFileSync} from 'node:child_process';
// Run against exports from the normal slide generator, including template resizing.
test('exported question numbers, answer fields and rules align in the actual PPTX', {skip:!process.env.MATH_QA_EXPORTS},()=>{
  execFileSync('python3',['-c',String.raw`
from pathlib import Path
from zipfile import ZipFile
import sys,json,xml.etree.ElementTree as ET
root=Path(sys.argv[1])
def shapes(course,question):
    folder=root/course
    number=json.loads((folder/'slide-order.json').read_text()).index(question)+1
    with ZipFile(folder/'lesson.pptx') as deck:
        slide=ET.fromstring(deck.read('ppt/slides/slide%d.xml'%number))
    result={}
    for sp in slide.findall('.//{*}sp'):
        label=''.join(t.text or '' for t in sp.findall('.//{*}t')).strip()
        off=sp.find('./{*}spPr/{*}xfrm/{*}off')
        if off is not None: result.setdefault(label,[]).append(int(off.get('x')))
    return slide,result
for course,q,numbers in [('han-concept-1',21,['(%d)'%i for i in range(1,7)]),('han-rpm-1',4426,['%04d'%i for i in range(1,7)])]:
    _,items=shapes(course,q)
    for column in [numbers[::2],numbers[1::2]]:
        xs=[items[label][0] for label in column]
        assert max(xs)-min(xs)<1000,(q,column,xs)
    assert items[numbers[1]][0]>items[numbers[0]][0]
_,items=shapes('han-concept-1',2)
blanks=[x for text,xs in items.items() if ''.join(text.split())=='()' for x in xs]
assert len(blanks)==4 and max(blanks)-min(blanks)<1000
slide,items=shapes('han-concept-1',5)
assert len(slide.findall('.//{*}pic'))==2
assert len([g for g in slide.findall('.//{*}prstGeom') if g.get('prst')=='line'])==2
assert not any('__' in t for t in items)
`,process.env.MATH_QA_EXPORTS],{stdio:'pipe'});
});

test('an English x between numbers becomes ×, a variable x stays', async ()=>{
  const {numericTimes,normalizeQuizNotation}=await import('../math-automation/math-notation.mjs');
  for(const [input,expected] of [
    ['2x3x10','2×3×10'],['2^{2}x15','2^{2}×15'],['2²x3x5','2²×3×5'],
    ['8은 2²x5의 약수이다.','8은 2²×5의 약수이다.'],['2³x5²의 약수의 개수','2³×5²의 약수의 개수'],['2 x 3','2 × 3'],
  ]) assert.equal(numericTimes(input),expected);
  for(const kept of ['2x','x²','3x+1','2x²','2x = 6','(192)⁄(x)','2x 3']) assert.equal(numericTimes(kept),kept);
  const ox={kind:'ox',prompt:'15는 소수이다.',answer:'X'};
  assert.equal(normalizeQuizNotation(ox),ox);
  assert.equal(normalizeQuizNotation({kind:'choice',prompt:'60을 소인수분해 한 것은?',choices:'2x3x10\n3x4x5',answer:'1'}).choices,'2×3×10\n3×4×5');
});
