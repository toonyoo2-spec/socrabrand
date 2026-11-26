import {typeRuns,KOREAN_FACE} from './math-type.mjs?v=3';
// Coordinates are in the 20 × 11.25 inch projector layout.
export function lessonIntro(course, lesson) {
  const concept = course.track === 'concept';
  const topic = lesson.topic.replace(/^\([^)]*\)\s*/, '').trim();
  return { scenes: [
    { art:'cover', label:'중1-1', body:concept ? '개념 탄탄' : '실력 탄탄', foot:concept ? '(개념원리)' : '(RPM)', size:102 },
    { art:'homework', label:'숙제 체크!', body:'숙제 완료한 학생,\n손 들어주세요!', foot:'잊지 말고 숙제를 꼭 해주세요!', size:56 },
    { art:'quiz', label:'오늘의', body:'퀴즈', size:102 },
    { art:'topic', label:'오늘의 학습 내용', body:topic, size:45 },
  ] };
}

export async function addEchoScenes(deck, scenes) {
  const used = new Set();
  for (const scene of scenes) {
    if (!/^[a-z][a-z0-9-]*$/.test(scene.art) || used.has(scene.art)) throw Error('각 도입 장에 해당하는 고유 삽화를 지정해 주세요.');
    used.add(scene.art);
    const response = await fetch(new URL('./intro-art/'+scene.art+'.png?v=2', import.meta.url));
    if (!response.ok) throw Error(scene.label+' 삽화를 열 수 없습니다.');
    const blob = await response.blob();
    const data = await new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const slide = deck.addSlide();
    slide.background = {color:'000000'};
    slide.addShape(deck.ShapeType.rect,{x:.85,y:2.5375,w:.675,h:.094,line:{transparency:100},fill:{color:'9ADBFF'}});
    const text = { x:.85,w:7.02,fontFace:KOREAN_FACE,bold:true,margin:0,lang:'ko-KR',valign:'top',fit:'shrink',paraSpaceAfter:0 };
    slide.addText(scene.label,{...text,y:3.06,h:.76,fontSize:40,color:'9ADBFF'});
    slide.addText(scene.art==='topic'?typeRuns(scene.body):scene.body,{...text,y:3.90,h:scene.foot?2.03:3.44,fontSize:scene.size,color:'FFF9EC',lineSpacingMultiple:1});
    if (scene.foot) {
      const homework=scene.art==='homework';
      slide.addText(scene.foot,{...text,y:homework?6.16:5.72,h:.9,fontSize:homework?27.5:40,color:'9ADBFF'});
    }
    const box={x:7.99,y:3.04,w:4.12,h:5.49};
    slide.addImage({data,...box,altText:scene.label+' 에코'});
  }
}
