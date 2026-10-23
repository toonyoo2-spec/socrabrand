export const TABLE = 'kwan_resource_library';
export const OWNER_ID = 'a7c34db7-128a-45af-9a5c-4068fedc33d5';
export function safeUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function createResourceClient({url,anonKey,getToken,fetchImpl=fetch}) {
  let generation=0;
  const invalidate=()=>{generation++;};
  async function request(path,options={}) {
    const token=getToken(),version=generation;
    if(!token)throw new Error('KWAN 계정으로 로그인해 주세요.');
    const response=await fetchImpl(`${url}/rest/v1/${path}`,{...options,headers:{apikey:anonKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers},cache:'no-store'});
    if(version!==generation||token!==getToken())throw new Error('로그인 상태가 바뀌었습니다. 다시 열어주세요.');
    if(!response.ok)throw new Error(response.status===401||response.status===403?'KWAN 전용 자료입니다.':'자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return response.json();
  }
  async function requireOwner(){if(await request('rpc/is_agency_owner',{method:'POST',body:'{}'})!==true)throw new Error('KWAN 전용 자료입니다.');}
  async function list(){
    await requireOwner(); const rows=[]; let offset=0;
    for(;;){const page=await request(`${TABLE}?select=id,title,sender,category,kind,status,summary,source_url,checked_at,parent_id,skill_note,files&order=checked_at.desc,id.asc&limit=100&offset=${offset}`);rows.push(...page);if(page.length<100)return rows;offset+=100;}
  }
  async function detail(id){await requireOwner();const rows=await request(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=*`);if(rows.length!==1)throw new Error('자료를 찾을 수 없습니다.');return rows[0];}
  return {list,detail,invalidate};
}
const STATUS={collected:'확보',partial:'일부 확보',pending:'수집 대기',excluded:'제외'};
const CATEGORY=['전체','모션·영상','디자인','콘텐츠·마케팅','업무·도구','기타'];
export function filterResources(rows,{query='',category='전체',status='all'}={}) {
  const q=query.trim().toLocaleLowerCase();
  return rows.filter(r=>(category==='전체'||r.category===category)&&(status==='all'||r.status===status)&&(!q||[r.title,r.sender,r.summary,r.skill_note].join(' ').toLocaleLowerCase().includes(q)));
}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function link(label,url){const a=el('a','rl-link',label);const safe=safeUrl(url);if(safe){a.href=safe;a.target='_blank';a.rel='noopener noreferrer';}return a;}
export async function mountResourceLibrary(root,{client}) {
  let disposed=false,rows=[],active=null;const state={query:'',category:'전체',status:'all'};
  root.replaceChildren();root.classList.add('rl');
  const header=el('header','rl-heading');header.append(el('p','rl-eyebrow','KWAN / PRIVATE COLLECTION'),el('h1','','스킬'),el('p','rl-intro','받아 둔 스킬과 가이드, 레퍼런스와 소스까지. 필요한 내용을 찾고, 원문과 스킬 반영 결과를 함께 확인하세요.'));
  const tools=el('div','rl-tools'),search=el('input','rl-search');search.type='search';search.placeholder='자료명, 발신자, 내용으로 검색';search.setAttribute('aria-label','자료 검색');
  const status=el('select','rl-select');status.setAttribute('aria-label','확보 상태');for(const [v,t]of [['all','모든 상태'],...Object.entries(STATUS)]){const o=el('option','',t);o.value=v;status.append(o);}
  tools.append(search,status);
  const metrics=el('div','rl-metrics'),filters=el('nav','rl-filters');filters.setAttribute('aria-label','자료 분야');
  const layout=el('div','rl-layout'),list=el('section','rl-list'),detail=el('section','rl-detail');list.setAttribute('aria-label','자료 목록');detail.setAttribute('aria-label','자료 상세');const notice=el('p','rl-notice','KWAN 계정 권한을 확인하고 있습니다.');notice.setAttribute('role','status');layout.append(list,detail);root.append(header,metrics,tools,filters,notice,layout);
  function render(){
    if(disposed)return;
    filters.replaceChildren();for(const c of CATEGORY){const b=el('button','rl-filter'+(state.category===c?' is-active':''),c);b.type='button';b.setAttribute('aria-pressed',String(state.category===c));b.onclick=()=>{state.category=c;render();};filters.append(b);}
    metrics.replaceChildren();for(const [label,n]of [['전체 자료',rows.length],['확보',rows.filter(r=>r.status==='collected').length],['수집 대기',rows.filter(r=>['partial','pending'].includes(r.status)).length]]){const m=el('div');m.append(el('strong','',String(n)),el('span','',label));metrics.append(m);}
    list.replaceChildren();const shown=filterResources(rows,state);notice.textContent=`${shown.length}개 자료 · 최신 확인 순`;
    if(active&&!shown.some(r=>r.id===active)){active=null;detail.replaceChildren(el('p','rl-empty','목록에서 자료를 선택해 주세요.'));}
    if(!shown.length)list.append(el('p','rl-empty','조건에 맞는 자료가 없습니다. 검색어나 필터를 바꿔보세요.'));
    for(const r of shown){const b=el('button','rl-row'+(active===r.id?' is-selected':''));b.type='button';b.setAttribute('aria-pressed',String(active===r.id));const top=el('div','rl-row-top');top.append(el('span','rl-category',r.category),el('span','rl-badge rl-'+r.status,STATUS[r.status]||r.status));b.append(top,el('h2','',r.title),el('p','rl-summary',r.summary),el('span','rl-sender',r.sender?'@'+r.sender:'수집 자료'));b.onclick=()=>open(r.id);list.append(b);}
  }
  async function open(id){
    active=id;render();detail.replaceChildren(el('p','rl-empty','자료를 불러오고 있습니다.'));try{const r=await client.detail(id);if(disposed||active!==id)return;detail.replaceChildren();const heading=el('div','rl-detail-heading');heading.append(el('span','rl-category',r.category),el('h2','',r.title));detail.append(heading,el('p','rl-byline',`${r.sender?'@'+r.sender+' · ':''}${r.checked_at?new Date(r.checked_at).toLocaleDateString('ko-KR'):''}`),el('p','rl-lead',r.summary));
      if(r.source_url&&safeUrl(r.source_url))detail.append(link('원문 열기 ↗',r.source_url));
      const verdict=el('section','rl-verdict');verdict.append(el('h3','','스킬 반영'),el('p','',r.skill_note||'아직 비교하지 않았습니다. 원문 확보 후 판단합니다.'));detail.append(verdict);
      if(r.reason){detail.append(el('h3','','확보 상태'),el('p','',r.reason));}
      if(r.files?.length){detail.append(el('h3','',`파일 · ${r.files.length}개`));const files=el('ul','rl-files');for(const f of r.files){const li=el('li');li.append(safeUrl(f.url)?link(f.name,f.url):el('span','',f.name));if(f.sha256)li.append(el('small','',`SHA ${f.sha256.slice(0,12)} · ${Number(f.bytes||0).toLocaleString()} bytes`));files.append(li);}detail.append(files);}
      if(r.body){const disclosure=el('details','rl-original');disclosure.append(el('summary','','확보한 원문 텍스트 보기'),el('pre','',r.body));detail.append(disclosure);}
    }catch(error){if(!disposed)detail.replaceChildren(el('p','rl-empty',error.message));}
  }
  search.oninput=()=>{state.query=search.value;render();};status.onchange=()=>{state.status=status.value;render();};
  try{rows=await client.list();if(!disposed){render();if(rows.length)await open(rows[0].id);else detail.append(el('p','rl-empty','수집된 자료가 여기에 표시됩니다.'));}}catch(error){notice.textContent=error.message;list.replaceChildren();detail.replaceChildren();}
  return ()=>{disposed=true;client.invalidate?.();root.replaceChildren();};
}
