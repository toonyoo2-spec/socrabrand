const instructions = {
  "select": [
    "수업 선택",
    "선생님",
    [
      "‘수업명’에서 수업을 고르세요. 개념탄탄은 개념원리로, 실력탄탄은 RPM으로 수업합니다.",
      "‘회차 · 라이브 날짜’에서 준비할 회차를 고르면 ‘수업 범위’에 그날 배울 내용이 나옵니다.",
      "‘수업 문항’에서 단원과 교재 코너를 고르세요. 교재 미리보기를 보면서 수업에 쓸 문제를 선택하면 바로 저장됩니다.",
      "예를 들어 ‘0001~0006번’은 여섯 문항을 묶은 하나의 문제입니다. 한 번만 선택하면 시트와 슬라이드에 여섯 문항이 함께 표시됩니다."
    ]
  ],
  "submit": [
    "문항 제출",
    "선생님",
    [
      "직접 퀴즈를 만들 때는 문항 번호와 문제 유형을 고르세요. 문제를 쓴 뒤, 단답형과 OX는 정답을 입력하세요. 객관식은 보기 4개를 입력하고 정답 번호를 고르세요. 마지막에 ‘퀴즈 문항 저장’을 누르세요.",
      "교재 퀴즈는 사용할 문제를 고르면 바로 저장됩니다. 보기가 5개이고 정답이 하나면 오답 하나를 빼서 보기 4개로 만듭니다. 정답이 두 개면 보기마다 두 답을 짝지어 보여 줍니다. 학생은 정답 두 개가 함께 있는 보기를 고릅니다. ‘보기 확인’에서 학생에게 보일 보기를 확인할 수 있습니다.",
      "수업 문제와 퀴즈를 모두 준비했으면 ‘제출·발표자료’에서 ‘회차 제출’을 누르세요. 이제 LX팀이 이 회차를 시트와 슬라이드에 반영할 수 있습니다.",
      "제출 후 내용을 바꿨다면 ‘수정본 제출’을 누르세요. 직접 만든 퀴즈를 지우려면 문항 번호를 선택하고 ‘문항 비우기’를 누르세요."
    ]
  ],
  "choose": [
    "회차 선택",
    "LX팀",
    [
      "화면 위의 ‘작업현황’을 열고, 자료를 만들 선생님과 수업을 찾으세요.",
      "‘Google에 반영’을 누른 뒤 ‘오늘 넘길 회차’에서 회차별로 필요한 자료를 선택하세요.",
      "예를 들어 1강은 시트와 슬라이드가 모두 필요하면 둘 다 선택하세요. 2강은 시트만 필요하면 ‘시트’만 선택하세요."
    ]
  ],
  "sheet": [
    "구글 시트",
    "LX팀",
    [
      "‘Google에 반영’을 열고 ‘Google 시트 URL’을 확인하세요. 시트를 미리 보려면 ‘복사’를 누른 뒤 브라우저의 새 탭에 주소를 붙여 넣으세요.",
      "이번에만 다른 시트를 쓰려면 주소를 바꾸세요. 다음 작업부터 팀원 모두가 그 시트를 쓰려면 ‘팀 기본값으로 저장’을 누르세요.",
      "원하는 회차의 ‘시트’를 선택한 뒤 ‘선택한 항목 반영’을 누르세요. 작업이 끝나면 ‘완료 · 열기’를 눌러 해당 회차의 문항을 확인하세요."
    ]
  ],
  "deck": [
    "구글 슬라이드",
    "LX팀",
    [
      "‘Google에 반영’을 열고 ‘슬라이드 저장 폴더 URL’을 확인하세요. 완성된 발표자료는 이 폴더에 회차별로 저장됩니다.",
      "원하는 회차의 ‘슬라이드’를 선택하고 ‘선택한 항목 반영’을 누르세요. Google 로그인 창이 뜨면 해당 폴더에 파일을 저장할 수 있는 회사 계정을 선택하세요.",
      "작업이 끝나면 ‘완료 · 열기’를 눌러 슬라이드를 확인하세요."
    ]
  ],
  "done": [
    "반영 완료",
    "LX팀",
    [
      "회차별 결과를 확인하세요. 시트만 완료됐다면 슬라이드는 나중에 따로 만들 수 있습니다.",
      "한 번 완료한 자료는 다음 작업에서 자동으로 선택되지 않습니다. ‘완료 · 수정본 있음’은 선생님이 이후에 내용을 수정해 다시 제출했다는 뜻입니다.",
      "다시 보낼 자료의 ‘오늘 다시 반영’을 누른 뒤 ‘선택한 항목 반영’을 누르세요."
    ]
  ],
  "root": [
    "수학 수업 자료",
    "LX팀",
    [
      "Google Drive에서 수업 자료를 모아 둘 폴더를 여세요.",
      "아래 그림에서 선생님 이름을 누르면 시트와 발표자료를 어디에 두면 좋을지 볼 수 있습니다."
    ]
  ],
  "han": [
    "한태인 선생님 폴더",
    "LX팀",
    [
      "Google Drive에서 한태인 선생님 폴더를 여세요.",
      "개념탄탄과 실력탄탄의 시트 바로가기, 발표자료를 저장할 폴더를 여기에 모아 두세요."
    ]
  ],
  "han-concept": [
    "한태인 · 개념탄탄 시트",
    "LX팀",
    [
      "‘작업현황’에서 한태인 선생님의 개념탄탄 수업을 찾고 ‘Google에 반영’을 누르세요.",
      "시트를 확인하려면 ‘Google 시트 URL’ 오른쪽의 ‘복사’를 누르고 새 탭에 주소를 붙여 넣으세요.",
      "팀에서 쓸 시트가 바뀌었다면 새 주소를 입력하고 ‘팀 기본값으로 저장’을 누르세요."
    ]
  ],
  "han-rpm": [
    "한태인 · 실력탄탄 시트",
    "LX팀",
    [
      "‘작업현황’에서 한태인 선생님의 실력탄탄 수업을 찾고 ‘Google에 반영’을 누르세요.",
      "시트를 확인하려면 ‘Google 시트 URL’ 오른쪽의 ‘복사’를 누르고 새 탭에 주소를 붙여 넣으세요.",
      "팀에서 쓸 시트가 바뀌었다면 새 주소를 입력하고 ‘팀 기본값으로 저장’을 누르세요."
    ]
  ],
  "han-slides": [
    "한태인 · 수업 슬라이드",
    "LX팀",
    [
      "‘작업현황’에서 한태인 선생님의 수업을 찾고 ‘Google에 반영’을 누르세요.",
      "‘슬라이드 저장 폴더 URL’ 오른쪽의 ‘복사’를 눌러 새 탭에 붙여 넣으면 폴더가 열립니다. 현재는 테스트용 폴더를 사용합니다."
    ]
  ],
  "oh": [
    "오지예 선생님 폴더",
    "LX팀",
    [
      "Google Drive에서 오지예 선생님 폴더를 여세요.",
      "개념탄탄과 실력탄탄의 시트 바로가기, 발표자료를 저장할 폴더를 여기에 모아 두세요."
    ]
  ],
  "oh-concept": [
    "오지예 · 개념탄탄 시트",
    "LX팀",
    [
      "오지예 선생님의 개념탄탄 시트는 아직 연결되지 않았습니다.",
      "운영 담당자가 시트를 연결하면 ‘Google에 반영’에서 주소를 확인할 수 있습니다."
    ]
  ],
  "oh-rpm": [
    "오지예 · 실력탄탄 시트",
    "LX팀",
    [
      "오지예 선생님의 실력탄탄 시트는 아직 연결되지 않았습니다.",
      "운영 담당자가 시트를 연결하면 ‘Google에 반영’에서 주소를 확인할 수 있습니다."
    ]
  ],
  "oh-slides": [
    "오지예 · 수업 슬라이드",
    "LX팀",
    [
      "오지예 선생님의 슬라이드 저장 폴더는 아직 정해지지 않았습니다.",
      "폴더를 연결하면 ‘Google에 반영’의 ‘슬라이드 저장 폴더 URL’에서 주소를 확인할 수 있습니다."
    ]
  ]
};

function initializeGuide(root) {
  const byId = id => root.getElementById(id);
  const graphs = {
    flow: {
      section: root.querySelector('.flow'), detail: byId('flow-detail'),
      edges: [['select','submit'], ['submit','choose'], ['choose','sheet'], ['choose','deck'], ['sheet','done'], ['deck','done']]
    },
    tree: {
      section: root.querySelector('.tree'), detail: byId('drive-detail'),
      edges: ['han','oh'].flatMap(key => [['root',key], ...['concept','rpm','slides'].map(dest => [key,key+'-'+dest])])
    }
  };
  const order = Array.from(graphs.flow.section.querySelectorAll('[data-key]'), node => node.id);
  const active = {flow:'select', tree:'root'};

  function highlight(group) {
    const graph = graphs[group];
    const upstream = new Set();
    function visit(target) {
      for (const [source, destination] of graph.edges) {
        if (destination === target) {
          upstream.add(source+'_'+destination);
          visit(source);
        }
      }
    }
    visit(active[group]);
    for (const path of graph.section.querySelectorAll('[data-edge]')) {
      path.classList.toggle('hot', upstream.has(path.dataset.edge));
    }
  }

  function centerNode(node, animate) {
    const pane = node.closest('.scroll');
    const offset = node.getBoundingClientRect().left - pane.getBoundingClientRect().left + pane.scrollLeft;
    pane.scrollTo({
      left: offset - (pane.clientWidth - node.offsetWidth) / 2,
      behavior: animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant'
    });
  }

  function selectNode(id, reveal = false) {
    const group = order.includes(id) ? 'flow' : 'tree';
    const graph = graphs[group];
    const [title, role, steps] = instructions[id];
    active[group] = id;
    for (const node of graph.section.querySelectorAll('[data-key]')) {
      node.setAttribute('aria-pressed', String(node.id === id));
    }
    graph.detail.querySelector('strong').textContent = title;
    graph.detail.querySelector('.role').textContent = role;
    graph.detail.querySelector('ol').replaceChildren(...steps.map(step => {
      const item = document.createElement('li');
      item.textContent = step;
      return item;
    }));
    if (group === 'flow') {
      byId('prev').disabled = id === order[0];
      byId('next').disabled = id === order.at(-1);
    }
    highlight(group);
    if (reveal) centerNode(byId(id), true);
  }

  const namespace = 'http://www.w3.org/2000/svg';
  function svgElement(tag, attributes) {
    const node = document.createElementNS(namespace, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  }

  function draw() {
    for (const [group, graph] of Object.entries(graphs)) {
      const base = graph.section.getBoundingClientRect();
      if (!base.width || !base.height) continue;
      const svg = graph.section.querySelector('.wires');
      svg.setAttribute('viewBox', [0,0,base.width,base.height].join(' '));
      const paths = [];
      const ports = new Map();
      for (const [source, destination] of graph.edges) {
        const a = byId(source).getBoundingClientRect(), b = byId(destination).getBoundingClientRect();
        const x = a.right - base.left, y = a.top + a.height / 2 - base.top;
        const endX = b.left - base.left, endY = b.top + b.height / 2 - base.top;
        paths.push(svgElement('path', {'data-edge':source+'_'+destination, d:'M '+x+' '+y+' H '+(x+endX)/2+' V '+endY+' H '+(endX-3)}));
        ports.set(source+'-out', svgElement('circle', {cx:x, cy:y, r:2.6}));
        ports.set(destination+'-in', svgElement('path', {class:'arrowhead', d:'M '+(endX-9)+' '+(endY-3.3)+' l 6 3.3 -6 3.3 z'}));
      }
      svg.replaceChildren(...paths, ...ports.values());
      highlight(group);
    }
  }

  for (const [group, graph] of Object.entries(graphs)) {
    for (const node of graph.section.querySelectorAll('[data-key]')) {
      node.setAttribute('aria-controls', graph.detail.id);
      node.addEventListener('click', () => selectNode(node.id, true));
    }
    new ResizeObserver(draw).observe(graph.section);
    selectNode(active[group]);
  }
  function move(delta, focus) {
    const next = order[order.indexOf(active.flow) + delta];
    if (!next) return;
    selectNode(next, true);
    if (focus) byId(next).focus({preventScroll:true});
  }
  byId('prev').addEventListener('click', () => move(-1, false));
  byId('next').addEventListener('click', () => move(1, false));
  graphs.flow.section.addEventListener('keydown', event => {
    if (!event.target.matches('[data-key]') || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    active.flow = event.target.id;
    move(event.key === 'ArrowRight' ? 1 : -1, true);
  });
  byId('print')?.addEventListener('click', () => window.print());
  window.addEventListener('beforeprint', draw);
  window.addEventListener('afterprint', draw);
  document.fonts.ready.then(draw);
  draw();
  return function show(initial) {
    selectNode(initial);
    centerNode(byId(initial), false);
    draw();
  };
}

export function mountUsageGuide(host) {
  const root = host.attachShadow({mode:'open'});
  const content = document.getElementById('usage-template').content.cloneNode(true);
  const stylesheet = content.querySelector('link');
  const loaded = new Promise((resolve,reject) => {
    stylesheet.addEventListener('load', resolve, {once:true});
    stylesheet.addEventListener('error', () => reject(new Error('도움말 스타일을 불러오지 못했습니다.')), {once:true});
  });
  root.append(content);
  const show = initializeGuide(root);
  return async initial => { await loaded; show(initial); };
}
