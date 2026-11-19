const instructions = {
  "select": [
    "수업 선택",
    "선생님",
    [
      "‘과정’에서 개념(개념원리) 또는 응용(RPM)을 누릅니다.",
      "‘회차 · 라이브 날짜’를 고른 뒤 옆의 ‘수업 범위’를 확인합니다.",
      "‘수업 문항’에서 단원과 교재 코너를 고릅니다. 미리보기를 보며 각 자리의 문항을 선택하면 저장됩니다."
    ]
  ],
  "submit": [
    "문항 제출",
    "선생님",
    [
      "해당 회차의 ‘퀴즈앤 ①’, ‘퀴즈앤 ②’ 또는 ‘문제 출제’를 엽니다. 과정에 따라 보이는 탭이 다릅니다.",
      "직접 만드는 퀴즈는 문제와 정답을 입력하고 ‘퀴즈 문항 저장’을 누릅니다. 객관식은 보기 4개와 정답 보기를 지정합니다. 지우려면 해당 자리에서 ‘문항 비우기’를 누릅니다.",
      "교재를 쓰는 탭에서는 자리별로 문제를 고릅니다. 5지선다 문제에 편집 버튼이 보이면 원래 정답을 포함한 보기 4개를 입력하고 ‘4지선다 저장’을 누릅니다.",
      "‘제출·발표자료’에서 작성 상태를 확인하고 ‘회차 제출’을 누릅니다. 이미 제출한 회차를 고쳤다면 ‘수정본 제출’을 누릅니다."
    ]
  ],
  "choose": [
    "회차 선택",
    "LX 직원",
    [
      "상단 ‘작업현황’에서 강사와 과정, 선생님이 제출한 회차를 확인합니다.",
      "해당 과정의 ‘Google에 반영’을 엽니다. ‘오늘 넘길 회차’에서 각 강의의 시트와 슬라이드를 따로 체크할 수 있습니다.",
      "예를 들어 5강은 두 칸을, 16강은 시트만 체크합니다. 실행 전에 선택한 회차와 항목 수를 확인합니다."
    ]
  ],
  "sheet": [
    "구글 시트",
    "LX 직원",
    [
      "‘Google에 반영’에서 ‘Google 시트 URL’ 옆 ‘복사’로 대상 시트를 확인합니다.",
      "이번에 쓸 시트가 다르면 주소를 바꿉니다. 다음 작업에도 쓸 주소일 때만 ‘팀 기본값으로 저장’을 누릅니다.",
      "원하는 회차의 시트를 체크하고 ‘선택한 항목 반영’을 누릅니다. ‘완료 · 열기’에서 해당 회차에 들어간 문항을 확인합니다."
    ]
  ],
  "deck": [
    "구글 슬라이드",
    "LX 직원",
    [
      "‘Google에 반영’에서 ‘슬라이드 저장 폴더 URL’을 확인합니다. ‘복사’를 누르면 주소를 복사할 수 있습니다.",
      "발표자료를 만들 회차의 슬라이드를 체크하고 ‘선택한 항목 반영’을 누릅니다. Google 로그인이 뜨면 해당 폴더에 저장할 수 있는 회사 계정으로 연결합니다.",
      "반영 결과의 ‘완료 · 열기’를 누르면 생성된 Google 슬라이드가 열립니다."
    ]
  ],
  "done": [
    "반영 완료",
    "LX 직원",
    [
      "반영 결과에서 회차별 시트와 슬라이드의 ‘완료 · 열기’를 눌러 결과물을 확인합니다.",
      "다음에 ‘작업현황’을 열면 이미 반영한 항목은 잠겨 있습니다. 선생님이 수정본을 제출해도 자동으로 다시 보내지 않습니다.",
      "다시 보낼 항목에서 ‘오늘 다시 반영’을 누르고 확인합니다. ‘Google에 반영’에서 선택 내역을 확인한 뒤 실행합니다."
    ]
  ],
  "root": [
    "수학 수업 자료",
    "LX 직원",
    [
      "Google Drive에서 강사 자료를 모아 볼 상위 폴더를 엽니다.",
      "아래 그림에서 강사 이름을 누르면 시트 바로가기와 발표자료의 권장 위치를 볼 수 있습니다."
    ]
  ],
  "han": [
    "한태인 선생님 폴더",
    "LX 직원",
    [
      "Drive에서 한태인 선생님 폴더를 엽니다.",
      "개념·응용 시트 바로가기와 발표자료 폴더를 이곳에 모으면, 이름이 비슷한 다른 강사의 자료와 구분하기 쉽습니다."
    ]
  ],
  "han-concept": [
    "한태인 · 개념 시트",
    "LX 직원",
    [
      "‘작업현황’에서 한태인 선생님의 개념 과정을 찾아 ‘Google에 반영’을 엽니다.",
      "‘Google 시트 URL’의 ‘복사’를 눌러 시트를 열고 강사·과정이 맞는지 확인합니다.",
      "팀 공용 주소를 바꿀 때는 해당 과정 팝업에서 새 주소를 입력하고 ‘팀 기본값으로 저장’을 누릅니다."
    ]
  ],
  "han-rpm": [
    "한태인 · 응용 시트",
    "LX 직원",
    [
      "‘작업현황’에서 한태인 선생님의 응용 과정을 찾아 ‘Google에 반영’을 엽니다.",
      "‘Google 시트 URL’의 ‘복사’를 눌러 시트를 열고 강사·과정이 맞는지 확인합니다.",
      "팀 공용 주소를 바꿀 때는 해당 과정 팝업에서 새 주소를 입력하고 ‘팀 기본값으로 저장’을 누릅니다."
    ]
  ],
  "han-slides": [
    "한태인 · 수업 슬라이드",
    "LX 직원",
    [
      "‘작업현황’에서 한태인 선생님의 작업할 과정을 찾아 ‘Google에 반영’을 엽니다.",
      "‘슬라이드 저장 폴더 URL’의 ‘복사’를 눌러 Drive에서 폴더를 확인합니다. 현재 기본 경로는 테스트용 임시 폴더입니다."
    ]
  ],
  "oh": [
    "오지예 선생님 폴더",
    "LX 직원",
    [
      "Drive에서 오지예 선생님 폴더를 엽니다.",
      "개념·응용 시트 바로가기와 발표자료 폴더를 이곳에 모으면, 이름이 비슷한 다른 강사의 자료와 구분하기 쉽습니다."
    ]
  ],
  "oh-concept": [
    "오지예 · 개념 시트",
    "LX 직원",
    [
      "오지예 선생님의 개념 과정은 최종 시트 연결을 기다리고 있습니다.",
      "최종 시트를 받으면 운영 담당자가 강사와 과정명을 확인해 해당 과정에 연결합니다."
    ]
  ],
  "oh-rpm": [
    "오지예 · 응용 시트",
    "LX 직원",
    [
      "오지예 선생님의 응용 과정은 최종 시트 연결을 기다리고 있습니다.",
      "최종 시트를 받으면 운영 담당자가 강사와 과정명을 확인해 해당 과정에 연결합니다."
    ]
  ],
  "oh-slides": [
    "오지예 · 수업 슬라이드",
    "LX 직원",
    [
      "오지예 선생님의 운영 폴더 주소는 아직 확정 전입니다.",
      "운영 경로가 정해지면 해당 과정의 ‘슬라이드 저장 폴더 URL’에서 확인할 수 있습니다."
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
