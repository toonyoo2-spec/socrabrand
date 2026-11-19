const instructions = {
  "select": [
    "수업 선택",
    "선생님",
    [
      "‘수업명’에서 개념탄탄 또는 실력탄탄을 고르세요. 개념탄탄은 개념원리, 실력탄탄은 RPM을 사용합니다.",
      "‘회차 · 라이브 날짜’에서 수업할 날짜를 고르세요. ‘수업 범위’에 그날 배울 내용이 나옵니다.",
      "‘수업 문항’을 열고 단원과 교재 코너를 고르세요. 옆에서 교재를 보면서 각 자리에 문제를 고르면 바로 저장됩니다. ‘0001~0006번’처럼 번호 범위가 있으면 한 자리로 고르며, 시트와 슬라이드에도 한 묶음으로 들어갑니다."
    ]
  ],
  "submit": [
    "문항 제출",
    "선생님",
    [
      "직접 만드는 퀴즈는 번호를 누른 뒤 문제와 정답을 적으세요. 객관식은 보기 4개와 정답 번호도 입력하고 ‘퀴즈 문항 저장’을 누르세요.",
      "교재를 쓰는 퀴즈는 자리마다 문제만 고르세요. 5지선다는 정답을 살려 보기 4개로 자동 저장됩니다.",
      "다 채웠으면 ‘제출·발표자료’에서 ‘회차 제출’을 누르세요. 이때부터 LX팀이 시트와 발표자료를 만들 수 있습니다.",
      "제출한 문제를 바꿀 때는 고친 뒤 ‘수정본 제출’을 누르세요. 직접 쓴 퀴즈를 지우려면 해당 번호에서 ‘문항 비우기’를 누르세요."
    ]
  ],
  "choose": [
    "회차 선택",
    "LX팀",
    [
      "상단 ‘작업현황’을 열고 강사와 수업명을 확인하세요.",
      "‘Google에 반영’을 누르세요. ‘오늘 넘길 회차’에서 보낼 강의만 체크하세요.",
      "예를 들어 1강은 시트와 발표자료가 모두 필요하면 두 칸을, 2강은 시트만 필요하면 시트 한 칸을 체크하세요."
    ]
  ],
  "sheet": [
    "구글 시트",
    "LX팀",
    [
      "‘Google에 반영’에서 ‘Google 시트 URL’을 확인하세요. ‘복사’를 누르면 새 탭에 주소를 붙여 넣어 시트를 미리 볼 수 있습니다.",
      "다른 시트에 한 번만 보낼 때는 주소만 바꾸세요. 팀이 다음에도 같은 주소를 쓸 때는 ‘팀 기본값으로 저장’도 누르세요.",
      "보낼 회차의 시트를 체크하고 ‘선택한 항목 반영’을 누르세요. 끝나면 ‘완료 · 열기’를 눌러 그 강의 행에 들어간 문항을 확인하세요."
    ]
  ],
  "deck": [
    "구글 슬라이드",
    "LX팀",
    [
      "‘Google에 반영’에서 ‘슬라이드 저장 폴더 URL’을 확인하세요. 이 폴더 안에 회차별 발표자료가 생깁니다.",
      "원하는 회차의 슬라이드를 체크하고 ‘선택한 항목 반영’을 누르세요. Google 로그인이 뜨면 폴더에 파일을 저장할 수 있는 회사 계정을 선택하세요.",
      "‘완료 · 열기’를 누르면 방금 만든 발표자료를 볼 수 있습니다."
    ]
  ],
  "done": [
    "반영 완료",
    "LX팀",
    [
      "결과에서 시트와 슬라이드를 각각 열어 보세요. 한 번 보낸 항목은 다음 작업에서 잠깁니다.",
      "‘완료 · 수정본 있음’이면 선생님이 제출한 새 버전이 있습니다. 다시 보내려는 항목만 ‘오늘 다시 반영’을 누르세요.",
      "선택한 회차와 항목을 확인하고 ‘선택한 항목 반영’을 누르세요."
    ]
  ],
  "root": [
    "수학 수업 자료",
    "LX팀",
    [
      "Drive에서 수업 자료를 모을 상위 폴더를 여세요.",
      "그림에서 선생님 이름을 누르면 그 안에 둘 시트와 발표자료 폴더를 볼 수 있습니다."
    ]
  ],
  "han": [
    "한태인 선생님 폴더",
    "LX팀",
    [
      "Drive에서 한태인 선생님 폴더를 엽니다.",
      "개념탄탄·실력탄탄 시트 바로가기와 발표자료 폴더를 이곳에 모으면, 이름이 비슷한 다른 강사의 자료와 구분하기 쉽습니다."
    ]
  ],
  "han-concept": [
    "한태인 · 개념탄탄 시트",
    "LX팀",
    [
      "‘작업현황’에서 한태인 선생님의 개념탄탄 수업을 찾아 ‘Google에 반영’을 엽니다.",
      "‘Google 시트 URL’의 ‘복사’를 눌러 시트를 열고 강사·수업명이 맞는지 확인합니다.",
      "팀 공용 주소를 바꿀 때는 해당 수업 팝업에서 새 주소를 입력하고 ‘팀 기본값으로 저장’을 누릅니다."
    ]
  ],
  "han-rpm": [
    "한태인 · 실력탄탄 시트",
    "LX팀",
    [
      "‘작업현황’에서 한태인 선생님의 실력탄탄 수업을 찾아 ‘Google에 반영’을 엽니다.",
      "‘Google 시트 URL’의 ‘복사’를 눌러 시트를 열고 강사·수업명이 맞는지 확인합니다.",
      "팀 공용 주소를 바꿀 때는 해당 수업 팝업에서 새 주소를 입력하고 ‘팀 기본값으로 저장’을 누릅니다."
    ]
  ],
  "han-slides": [
    "한태인 · 수업 슬라이드",
    "LX팀",
    [
      "‘작업현황’에서 한태인 선생님의 작업할 수업을 찾아 ‘Google에 반영’을 엽니다.",
      "‘슬라이드 저장 폴더 URL’의 ‘복사’를 눌러 Drive에서 폴더를 확인합니다. 현재 기본 경로는 테스트용 임시 폴더입니다."
    ]
  ],
  "oh": [
    "오지예 선생님 폴더",
    "LX팀",
    [
      "Drive에서 오지예 선생님 폴더를 엽니다.",
      "개념탄탄·실력탄탄 시트 바로가기와 발표자료 폴더를 이곳에 모으면, 이름이 비슷한 다른 강사의 자료와 구분하기 쉽습니다."
    ]
  ],
  "oh-concept": [
    "오지예 · 개념탄탄 시트",
    "LX팀",
    [
      "오지예 선생님의 개념탄탄 수업은 최종 시트 연결을 기다리고 있습니다.",
      "최종 시트를 받으면 운영 담당자가 강사와 수업명을 확인해 해당 수업에 연결합니다."
    ]
  ],
  "oh-rpm": [
    "오지예 · 실력탄탄 시트",
    "LX팀",
    [
      "오지예 선생님의 실력탄탄 수업은 최종 시트 연결을 기다리고 있습니다.",
      "최종 시트를 받으면 운영 담당자가 강사와 수업명을 확인해 해당 수업에 연결합니다."
    ]
  ],
  "oh-slides": [
    "오지예 · 수업 슬라이드",
    "LX팀",
    [
      "오지예 선생님의 운영 폴더 주소는 아직 확정 전입니다.",
      "운영 경로가 정해지면 해당 수업의 ‘슬라이드 저장 폴더 URL’에서 확인할 수 있습니다."
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
