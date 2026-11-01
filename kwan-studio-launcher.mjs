export async function verifyStudioAccess({getToken,requireOwner}){
 const token=getToken();if(!token)throw Error('로그인이 필요합니다.');
 if(await requireOwner()!==true)throw Error('KWAN 전용 작업실입니다.');
 if(token!==getToken())throw Error('로그인 상태가 바뀌었습니다.');
 return true;
}

export async function mountKwanStudio(root,access){
 await verifyStudioAccess(access);let disposed=false;
 const doc=root.ownerDocument,origin=doc.defaultView.location.origin;
 const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./kwan-studio-launcher.css?v=20261102-cloud1',import.meta.url).href;
 const frame=doc.createElement('iframe');frame.className='kwan-studio-frame';frame.title='Kwan Studio · 클라우드 작업실';frame.src=new URL('./studio/',import.meta.url).href;
 frame.allow='clipboard-write; fullscreen';
 async function receive(event){if(disposed||event.source!==frame.contentWindow||event.origin!==origin||event.data?.type!=='kwan-studio:ready')return;
  try{await verifyStudioAccess(access);if(disposed)return;
   frame.contentWindow.postMessage({type:'kwan-studio:session',accessToken:access.getToken(),anonKey:access.anonKey,apiUrl:access.apiUrl},origin);
  }catch{if(!disposed)root.textContent='로그인 상태와 KWAN 접근 권한을 확인해 주세요.';}
 }
 doc.defaultView.addEventListener('message',receive);root.replaceChildren(sheet,frame);
 const timer=setInterval(()=>{if(!access.getToken()&&!disposed){disposed=true;root.replaceChildren();}},2000);
 return ()=>{disposed=true;clearInterval(timer);doc.defaultView.removeEventListener('message',receive);root.replaceChildren();};
}
