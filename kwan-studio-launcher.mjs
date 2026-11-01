export async function verifyStudioAccess({getToken,requireOwner}){
 const token=getToken();if(!token)throw Error('로그인이 필요합니다.');
 if(await requireOwner()!==true)throw Error('KWAN 전용 작업실입니다.');
 if(token!==getToken())throw Error('로그인 상태가 바뀌었습니다.');
 return true;
}

export async function mountKwanStudio(root,access){
 await verifyStudioAccess(access);
 const token=access.getToken();let disposed=false;
 const doc=root.ownerDocument;
 const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./kwan-studio-launcher.css?v=20261101-1',import.meta.url).href;
 const section=doc.createElement('section');section.className='kwan-studio-launcher';
 section.innerHTML=`<div class="ks-kicker">KWAN’S WORKSPACE</div><h1>Kwan Studio</h1><p class="ks-intro">기획을 정하고, 컷을 만들고, 한 편으로 완성하는 개인 영상 작업실.</p><div class="ks-launch"><div><span class="ks-label">내 컴퓨터의 작업실</span><h2>이어서 제작하기</h2><p>프로젝트와 원본 파일은 이 컴퓨터에 보관합니다.<br>작업실 서버가 켜져 있어야 열립니다.</p></div><a class="ks-open" href="http://127.0.0.1:4318/" target="_blank" rel="noopener noreferrer">작업실 열기 <span aria-hidden="true">↗</span></a></div><div class="ks-flow"><span>기획안</span><b>→</b><span>시안</span><b>→</b><span>컷 구성</span><b>→</b><span>확정</span><b>→</b><span>제작</span></div><dl class="ks-details"><div><dt>기획</dt><dd>Codex App Server · 현재 컴퓨터에서 실행</dd></div><div><dt>이미지</dt><dd>Seedream 5.0 Lite · Higgsfield 웹<br><small>웹 무제한·0크레딧 표시 확인. 실제 생성 검수 대기.</small></dd></div><div><dt>영상</dt><dd>Seedance 2.5 · Kling 4.0<br><small>생성·다운로드·노드 반영 실검수 전.</small></dd></div></dl><details class="ks-help"><summary>작업실이 열리지 않을 때</summary><p>작업실을 설치한 컴퓨터에서 로컬 서버를 먼저 실행한 뒤 다시 열어 주세요. 다른 컴퓨터의 파일을 불러오거나 서버를 자동으로 켜는 기능은 아직 없습니다.</p><p>이 탭은 개인 작업실의 진입 화면입니다. 프로젝트·생성 파일·계정 토큰을 이 홈페이지에 업로드하지 않습니다.</p></details>`;
 section.querySelector('.ks-open').addEventListener('click',event=>{if(disposed||access.getToken()!==token){event.preventDefault();root.textContent='로그인 상태가 바뀌었습니다. 다시 로그인해 주세요.';}});
 root.replaceChildren(sheet,section);
 return ()=>{disposed=true;root.replaceChildren();};
}
