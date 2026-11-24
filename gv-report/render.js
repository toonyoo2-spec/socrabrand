/* GV 라이팅 리포트 화면 틀: gv_reports.data(JSON)를 받아 리포트 HTML을 만든다.
   이 파일에는 학생 데이터가 없다. 레벨 설명은 「GV 라이팅 레벨 가이드」 PDF 기준. */
(function () {
  "use strict";
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /* **굵게** · {{영어로 못 쓴 부분}} · [[다듬을 부분]] · 줄바꿈 \n */
  function rich(s, strongTag) {
    var t = strongTag || "strong";
    return esc(s).replace(/\*\*(.+?)\*\*/g, "<" + t + ">$1</" + t + ">").replace(/\{\{(.+?)\}\}/g, '<span class="hl">$1</span>')
      .replace(/\[\[(.+?)\]\]/g, '<span class="fix">$1</span>').replace(/\n/g, "<br>");
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  var ARROW = '<svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8h10M9 4.5L12.5 8 9 11.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CHEV = '<svg class="go" width="14" height="14" aria-hidden="true"><use href="#chev"/></svg>';

  var LEVELS = {
    1: { cefr: "A1 Basic", short: "간단한 문장 만들기", title: "기본 문장으로 나를 표현하는 단계", rep: "I like running. I do it with my sister.",
         grammar: "‘누가 무엇을 한다’는 기본 문장, 주어에 맞는 동사 모양, 현재·과거·미래를 나타내는 기초 시제를 배워요.",
         school: "초등 3~4학년 교과서에 나오는 짧고 쉬운 문장 쓰기와 비슷한 수준이에요.", grade: "초등 3~6학년" },
    2: { cefr: "A1 Plus", short: "풍부한 문장 만들기", title: "정보를 더해 문장을 풍부하게 만드는 단계", rep: "I went to the zoo with my brother. We stayed there for two hours.",
         grammar: "‘언제, 어디서, 얼마나 자주’를 덧붙이는 말과, 지금 하고 있는 일을 말하는 진행형을 배워요.",
         school: "초등 5~6학년 교과서에서 경험과 계획을 짧은 문장으로 쓰는 연습과 비슷해요.", grade: "초등 3~6학년" },
    3: { cefr: "A2 Basic", short: "짧은 문단 완성하기", title: "연결된 문장으로 하나의 주제를 설명하는 단계", rep: "My favorite season is winter. I love this season because I can play in the snow. For example, I like to make snowmen with my friends.",
         grammar: "because, for example처럼 이유와 예시를 잇는 말로, 여러 문장을 하나의 주제로 이어 쓰는 법을 배워요.",
         school: "초등 5~6학년에서 여러 문장으로 내용을 자세히 쓰는 연습, 중학교의 짧은 문단 쓰기와 이어져요.", grade: "초등 3~6학년" },
    4: { cefr: "A2 Plus", short: "정보를 더해 구체적으로", title: "문장을 구체적으로 만드는 단계", rep: "When Lia tries to get a cookie, she climbs very high without knowing how.",
         grammar: "to부정사와 동명사, 시간·이유·대조를 잇는 말을 배워요.", school: "초등 5~6학년에서 중학교로 넘어가는 시기의 문장 쓰기와 비슷해요.", grade: "초등 3~6학년" },
    5: { cefr: "B1 Basic", short: "생각에 이유 붙여 설명", title: "생각과 이유를 연결하는 단계", rep: "People who wake up early have more time, so they feel less stressed.",
         grammar: "이유·조건·대조를 잇는 말, 비교급과 최상급, therefore처럼 결론을 이끄는 말을 배워요.", school: "중학교에서 의견과 이유를 함께 쓰는 연습과 이어져요.", grade: "초등 고학년~중1" },
    6: { cefr: "B1 Plus", short: "이유와 영향 자세히 설명", title: "원인과 영향을 설명하는 단계", rep: "Efficient public transportation reduces cars on the road, which lowers air pollution.",
         grammar: "여러 문장을 잇는 복합적인 연결, 가정 표현, 대조·양보 표현을 배워요.", school: "중학교에서 원인과 결과를 이어 쓰는 연습과 이어져요.", grade: "중1~중2" },
    7: { cefr: "B1 Plus", short: "이슈 설명과 입장 밝히기", title: "이슈에 대해 입장을 전하는 단계", rep: "While fast fashion companies continue to profit, the human cost is being ignored.",
         grammar: "주제별 어휘, 대조·양보 표현, 수동태와 과거완료를 배워요.", school: "중학교 후반~고등학교에서 근거를 들어 의견을 쓰는 연습과 이어져요.", grade: "중3~고1" },
    8: { cefr: "B2 Basic", short: "원리·영향 설명과 제안", title: "복잡한 내용을 설명하고 제안하는 단계", rep: "Regulations should be put in place so that both residents and the tech industry can benefit.",
         grammar: "과학·기술 주제의 어휘, 조동사 수동태, 분사 구문, 강조 구문을 배워요.", school: "고등학교에서 정보와 근거로 의견을 제시하는 글쓰기와 이어져요.", grade: "중3~고1" }
  };

  function compare(label, a, ofA, b, ofB, unit) {
    return '<div class="vs" role="img" aria-label="' + esc(label + ": 처음 " + ofA + unit + " 중 " + a + ", 지금 " + ofB + unit + " 중 " + b) + '">' +
      '<div class="vs-col"><span class="vs-k">처음</span><p class="vs-n"><b>' + a + "</b><small>/ " + ofA + unit + '</small></p><span class="vs-bar"><i style="width:' + pct(a, ofA) + '%"></i></span></div>' +
      '<div class="vs-mid">' + ARROW + "</div>" +
      '<div class="vs-col now"><span class="vs-k">지금</span><p class="vs-n"><b>' + b + "</b><small>/ " + ofB + unit + '</small></p><span class="vs-bar"><i style="width:' + pct(b, ofB) + '%"></i></span></div></div>';
  }
  function note(kind, n) {
    var hasHl = n.lines.some(function (l) { return /\{\{/.test(l[0]); }), hasFix = n.lines.some(function (l) { return /\[\[/.test(l[0]); });
    return '<section class="note' + (kind === "now" ? " now" : "") + '" data-item="note-' + kind + '"><div class="note-top"><div><span class="eyebrow">' + esc(n.label || (kind === "now" ? "지금" : "처음")) + "</span><h3>" + esc(n.title) + '</h3></div><span class="stamp">' + esc(n.date + " · " + n.lesson) + "</span></div>" +
      '<ul class="lines">' + n.lines.map(function (l) { return '<li><span class="en">' + rich(l[0]) + '</span><span class="ko">' + esc(l[1]) + "</span></li>"; }).join("") + "</ul>" +
      ((hasHl || hasFix) ? '<div class="legend">' + (hasHl ? '<span><i class="k1"></i>영어로 쓰지 못한 부분</span>' : "") + (hasFix ? '<span><i class="k2"></i>다듬을 부분</span>' : "") + "</div>" : "") + "</section>";
  }

  /* 항목별로 보기: 기획 시트(평가 항목)의 틀 그대로. 값이 없는 항목은 펼쳐 보기 안에 모은다 */
  var GRADE = { "높음": "hi", "보통": "mid", "낮음": "lo", "성장": "hi", "유지": "mid", "하락": "lo" };
  function itemsPanel(it) {
    var g = (it.groups || []).map(function (gr) {
      var res = gr.result ? '<span class="grade ' + (GRADE[gr.result] || "wait") + '">' + esc(gr.result) + "</span>" : '<span class="grade wait">판정 전</span>';
      var rows = (gr.rows || []).map(function (r) {
        return '<div class="irow"><div class="irow-k"><b>' + esc(r[0]) + "</b><small>" + esc(r[1]) + '</small></div><div class="irow-v"><b>' + rich(r[2]) + "</b>" +
          (r[4] ? '<span class="ibadge">기준이 달라요</span>' : "") + "</div><p class=\"irow-basis\">" + esc(r[3]) + "</p></div>";
      }).join("");
      var miss = (gr.missing || []).length ? '<details class="basis"><summary>아직 못 채운 항목 ' + gr.missing.length + '개<svg width="14" height="14" aria-hidden="true"><use href="#chev"/></svg></summary><div class="basis-body">' +
        gr.missing.map(function (m) { return '<div class="imiss"><b>' + esc(m[0]) + "</b><span>" + esc(m[1]) + "</span></div>"; }).join("") + "</div></details>" : "";
      return '<section class="card" data-item="' + esc(gr.key) + '"><div class="ihead"><div><span class="eyebrow">' + esc(gr.eyebrow) + "</span><h2>" + esc(gr.title) + "</h2></div>" + res + "</div>" +
        (gr.note ? '<p class="lead">' + esc(gr.note) + "</p>" : "") + (rows ? '<div class="irows">' + rows + "</div>" : "") + miss + "</section>";
    }).join("");
    var ty = it.type || {};
    return '<div class="panel" role="tabpanel" id="p-items" aria-labelledby="t-items" tabindex="0" hidden>' +
      '<section class="card" data-item="items-intro"><span class="eyebrow">항목별로 보기</span><h2>' + rich(it.title || "평가 항목마다\n하나씩 볼게요") + '</h2><p class="lead">' + esc(it.lead) + "</p></section>" + g +
      '<section class="card" data-item="items-type"><div class="ihead"><div><span class="eyebrow">성취도 × 참여도</span><h2>학습 유형</h2></div>' +
      (ty.result ? '<span class="grade hi">' + esc(ty.result) + "</span>" : '<span class="grade wait">판정 전</span>') + "</div>" +
      '<div class="quad" aria-hidden="true"><span>잠재력형</span><span>우수 지속형</span><span>학습 지원형</span><span>성실 노력형</span></div>' +
      '<p class="lead">' + esc(ty.note) + "</p></section>" +
      (it.recs_note ? '<section class="card" data-item="items-recs"><span class="eyebrow">추천학습 기준</span><p class="lead" style="margin-top:4px">' + esc(it.recs_note) + "</p></section>" : "") + "</div>";
  }

  /* 레벨 팝업 (두 틀이 같이 쓴다) */
  function levelSheet(d, nm) {
    var lv = LEVELS[d.level] || LEVELS[1];
    var ladder = [8, 7, 6, 5, 4, 3, 2, 1].map(function (n) {
      var L = LEVELS[n], cur = n === d.level;
      return '<li class="' + (cur ? "cur" : "up") + '"' + (cur ? ' aria-current="step"' : "") + '><span class="lv">LV ' + n + '</span><span class="sch">' + esc(L.short) + (cur ? "<em>지금</em>" : "") + '</span><span class="cefr">' + esc(L.cefr) + "</span></li>";
    }).join("");
    var nx = LEVELS[d.level + 1];
    return '<div class="sheet-bg" id="lvBg" hidden></div><div class="sheet" id="lvSheet" role="dialog" aria-modal="true" aria-labelledby="lvTitle" hidden><div class="sheet-in">' +
      '<div class="sheet-head"><b id="lvTitle">지금 배우는 수준</b><button type="button" id="lvClose" aria-label="닫기"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>' +
      '<div class="sheet-body" data-item="level"><p class="sh-title">LV ' + d.level + jo(d.level, "은", "는") + "<br>" + esc(lv.title) + "예요</p>" +
      '<p class="lead">레벨마다 배우는 문장의 수준이에요.<br>' + esc(nm) + "의 실력을 매긴 게 아니라,<br>지금 배우는 내용의 수준을 보여 드려요.</p>" +
      '<ol class="ladder" aria-label="GV 라이팅 레벨별 수준">' + ladder + "</ol>" +
      '<div class="lv-detail"><div><span>LV ' + d.level + ' 대표 문장</span><p class="ex">' + esc(lv.rep) + "</p></div>" +
      "<div><span>LV " + d.level + "에서 익히는 문법</span><p>" + esc(lv.grammar) + "</p></div>" +
      "<div><span>학교 영어와 비교하면</span><p>" + esc(lv.school) + " 학년(" + esc(lv.grade) + ")은 참고로만 봐 주세요. 레벨이 학년과 딱 맞아떨어지지는 않거든요.</p></div>" +
      (nx ? "<div><span>LV " + (d.level + 1) + "에서 새로 배우는 것</span><p>" + esc(nx.title) + "로 넘어가요.</p></div>" : "") +
      "</div></div></div></div>";
  }

  /* ---------- 수정 샘플 틀: 평가 항목(성취도 · 참여도 · 성장 추세)을 학부모가 바로 읽을 수 있게 ---------- */
  var AI_NOTE = '<p class="ai-note">본 학습 리포트는 리얼 아카데미<br>AI 학습 관리 시스템을 통해 분석 및 작성되었습니다.</p>';
  function dots(n, of, cls) {
    var s = "";
    for (var i = 0; i < of; i++) s += "<i" + (i < n ? ' class="on"' : "") + "></i>";
    return '<span class="dots' + (cls ? " " + cls : "") + '" aria-hidden="true">' + s + "</span>";
  }
  function how(t) { return t ? '<p class="how">' + rich(t) + "</p>" : ""; }
  function growCards(G, d) {
    return (G.compares || []).map(function (c) {
        return '<section class="card stat" data-item="' + esc(c.key) + '" data-name="' + esc(c.title) + '"><div class="stat-h"><b>' + esc(c.title) + '</b><span class="up-tag">' + esc(c.tag) + "</span></div>" +
          '<div class="ba"><div><span>처음</span>' + dots(c.a, c.of, "dim") + "<em>" + c.a + "/" + c.of + '</em></div><div class="now"><span>지금</span>' + dots(c.b, c.of) + "<em>" + c.b + "/" + c.of + "</em></div></div>" +
          '<p class="say">' + rich(c.say) + "</p>" + how(c.how) + "</section>";
      }).join("") +
      (G.topic ? '<section class="card stat" data-item="grow-topic" data-name="쓰는 글의 주제"><div class="stat-h"><b>쓰는 글의 주제</b></div><div class="topic"><span>' + esc(G.topic[0]) + "</span>" + ARROW + "<span class=\"now\">" + esc(G.topic[1]) + '</span></div><p class="say">' + rich(G.topic[2]) + "</p></section>" : "") +
      (d.then && d.now ? '<section class="card" style="padding-bottom:16px" data-item="grow-notes" data-name="처음 글과 지금 글"><span class="eyebrow">직접 쓴 글</span><h2>처음 쓴 글과 지금 쓴 글</h2><p class="lead">피드백을 받기 전, 처음 쓴 그대로예요.<br>작은 글씨는 쓰려고 했던 뜻이에요.</p></section>' + note("then", d.then) + note("now", d.now) : "");
  }
  function renderSheet(id, d) {
    var lv = LEVELS[d.level] || LEVELS[1], nm = d.name || "학생", S = d.skill || {}, G = d.grow || {}, N = d.next || {};
    var tabs = [["summary", "한눈에"], ["skill", S.tab || "실력"]].concat(d.grow ? [["grow", "성장"]] : []).concat([["next", "다음 학습"]]);
    var h = '<div class="app sheet-tpl"><header class="top pad"><img src="img/logo_dark.png" alt="리얼 아카데미"><i class="rule"></i><span>GV 라이팅 리포트</span>' +
      '<button type="button" class="test" id="chatOpen" aria-haspopup="dialog">피드백 <b id="chatCount">0</b></button></header>' +
      '<nav class="tabbar pad" aria-label="리포트 탭"><div class="tabs" role="tablist">' +
      tabs.map(function (t, i) { return '<button type="button" role="tab" id="t-' + t[0] + '" aria-controls="p-' + t[0] + '" aria-selected="' + (i ? "false" : "true") + '"' + (i ? ' tabindex="-1"' : "") + ">" + t[1] + "</button>"; }).join("") +
      '</div></nav><main class="pad">';

    /* 한눈에 */
    h += '<div class="panel" role="tabpanel" id="p-summary" aria-labelledby="t-summary" tabindex="0">' +
      '<section class="card s-cover" data-item="sum-cover" data-name="표지"><p class="who">' + esc(nm + " · " + d.period) + "</p><h1>" + rich(d.headline, "em") + "</h1>" +
      '<button type="button" class="level-strip" id="lvOpen" aria-haspopup="dialog"><span class="ls-lv">LV ' + d.level + '</span><span class="ls-txt"><b>' + esc(lv.title) + "</b><small>CEFR " + esc(lv.cefr) + " · 눌러서 자세히 보기</small></span>" + CHEV + "</button></section>" +
      '<section class="card" data-item="sum-results" data-name="영역별 결과"><span class="eyebrow">' + (["", "한 가지로", "두 가지로", "세 가지로"][(d.results || []).length] || "나눠서") + ' 봤어요</span><div class="res">' +
      (d.results || []).map(function (r) {
        var tag = r.go ? "button" : "div";
        return "<" + tag + (r.go ? ' type="button" data-go="' + esc(r.go) + '"' : "") + ' class="res-i ' + esc(r.tone || "mid") + '"><span class="res-k">' + esc(r.area) + '</span><b class="res-v">' + rich(r.value) + "</b>" +
          '<span class="res-s">' + rich(r.line) + "</span>" + (r.go ? CHEV : "") + "</" + tag + ">";
      }).join("") + "</div></section>" +
      '<section class="card next-one" data-item="sum-next" data-name="다음에 연습할 것"><span class="eyebrow">다음에 연습할 것</span><p>' + rich(d.goal) + "</p>" +
      '<button type="button" class="btn ghost" data-go="next" style="margin-top:14px">추천 학습 보기</button>' + AI_NOTE + "</section></div>";

    /* 실력 */
    h += '<div class="panel" role="tabpanel" id="p-skill" aria-labelledby="t-skill" tabindex="0" hidden>' +
      '<section class="card" style="padding-bottom:16px"><span class="eyebrow">학습 성취도</span><h2>' + rich(S.title) + '</h2><p class="lead">' + rich(S.lead) + "</p></section>" +
      (S.cards || []).map(function (c) {
        return '<section class="card stat" data-item="' + esc(c.key) + '" data-name="' + esc(c.title) + '"><div class="stat-h"><b>' + esc(c.title) + '</b><span class="stat-n">' + c.n + "<small>/" + c.of + "</small></span></div>" +
          dots(c.n, c.of) + '<p class="say">' + rich(c.say) + "</p>" + how(c.how) + "</section>";
      }).join("") +
      (S.grow ? '<section class="card" style="padding-bottom:16px" data-item="skill-grow" data-name="처음보다 늘어난 점"><span class="eyebrow">처음과 비교하면</span><h2>' + rich(S.grow.title) + '</h2><p class="lead">' + rich(S.grow.lead) + "</p></section>" + growCards(S.grow, d) : "") + "</div>";

    /* 성장 (따로 탭이 있을 때만) */
    if (d.grow) h += '<div class="panel" role="tabpanel" id="p-grow" aria-labelledby="t-grow" tabindex="0" hidden>' +
      '<section class="card" style="padding-bottom:16px"><span class="eyebrow">성장 추세</span><h2>' + rich(G.title) + '</h2><p class="lead">' + rich(G.lead) + "</p></section>" + growCards(G, d) + "</div>";

    /* 다음 학습 */
    h += '<div class="panel" role="tabpanel" id="p-next" aria-labelledby="t-next" tabindex="0" hidden>' +
      (N.focus && N.focus.length ? '<section class="card" data-item="next-focus" data-name="연습할 문장"><span class="eyebrow">연습할 문장</span><h2>' + rich(N.focus_title) + '</h2><div class="focus">' +
        N.focus.map(function (it) {
          return '<div class="fx"><div class="fx-top"><b>' + esc(it[0]) + "</b><span>" + esc(it[1]) + '</span></div><div class="pair"><span class="was">' + rich(it[2]) + '</span><span class="is">' + rich(it[3], "u") + "</span></div></div>";
        }).join("") + "</div></section>" : "") +
      '<section class="card" data-item="next-recs" data-name="추천 학습"><span class="eyebrow">추천 학습</span><h2>' + rich(N.title) + "</h2>" +
      (N.recs || []).map(function (r) {
        return '<div class="srec"><div class="srec-h"><b>' + esc(r.name) + "</b>" + (r.tag ? "<span>" + esc(r.tag) + "</span>" : "") + "</div><p>" + rich(r.why) + "</p></div>";
      }).join("") + (N.note ? '<p class="how" style="margin-top:14px">' + rich(N.note) + "</p>" : "") + "</section></div>";

    h += "</main>" +
      '<footer class="pad"><b>내부 검토용 · 학생 ID ' + esc(id) + "</b><span>권한이 있는 팀원 계정으로만 볼 수 있어요. 밖으로 보낼 때는 학생 정보를 꼭 가려 주세요.</span></footer></div>";
    return h + levelSheet(d, nm);
  }


  /* ---------- 지표 전체 보기: 평가 항목 시트의 모든 지표를 순서대로. 값이 없으면 필요한 데이터를 적는다 ---------- */
  function docItem(it) {
    if (it.missing) return '<li class="no"><b>' + esc(it.name) + '</b> — ' + esc(it.missingLabel || "데이터 없음") + '<span>필요한 데이터: ' + esc(it.missing) + "</span></li>";
    return "<li><b>" + esc(it.name) + "</b> — <strong>" + rich(it.value) + "</strong>" +
      (it.basis ? "<span>" + rich(it.basis) + "</span>" : "") + (it.note ? '<span class="nb">※ ' + rich(it.note) + "</span>" : "") + "</li>";
  }
  function countArea(a) {
    var n = 0, t = 0;
    (a.groups || []).forEach(function (g) { g.items.forEach(function (x) { t++; if (!x.missing) n++; }); });
    return [n, t];
  }
  /* 지표 전체 보기: 디자인 없이 텍스트 문서로. 평가 항목 시트 순서 그대로 */
  function renderAll(id, d) {
    var nm = d.name || "학생", A = d.areas || [], all = [0, 0];
    A.forEach(function (a) { var c = countArea(a); all[0] += c[0]; all[1] += c[1]; });
    var h = '<div class="app doc"><header class="top pad"><img src="img/logo_dark.png" alt="리얼 아카데미"><i class="rule"></i><span>지표 전체 보기</span>' +
      '<button type="button" class="test" id="chatOpen" aria-haspopup="dialog">피드백 <b id="chatCount">0</b></button></header><main class="pad doc-body">' +
      '<div data-item="all-cover" data-name="개요"><h1>' + esc(nm) + " · 평가 항목 전체</h1>" +
      '<p class="doc-meta">' + esc(d.period) + " · GV LV " + d.level + (d.lessons == null ? "" : " · 레슨 " + esc(d.lessons) + "개") + "<br>평가 항목 " + all[1] + "개 · 확인값·표본 비교 " + all[0] + "개 · 추가 확인 " + (all[1] - all[0]) + "개</p>" +
      "<p>" + rich(d.intro) + "</p></div>";
    A.forEach(function (a) {
      var c = countArea(a);
      h += '<section data-item="all-' + esc(a.key) + '" data-name="' + esc(a.title) + '"><h2>' + esc(a.title) + " <small>" + c[0] + " / " + c[1] + "</small></h2>" +
        a.groups.map(function (g) { return "<h3>" + esc(g.name) + "</h3><ul>" + g.items.map(docItem).join("") + "</ul>"; }).join("") +
        (a.extra ? "<h3>시트에는 없지만 있는 지표</h3><ul>" + a.extra.map(docItem).join("") + "</ul>" : "") + "</section>";
    });
    h += '<section data-item="all-needs" data-name="필요한 데이터"><h2>더 채우려면 필요한 데이터</h2><ul>' +
      (d.needs || []).map(function (n) { return "<li><b>" + esc(n[0]) + "</b><span>" + esc(n[1]) + "</span></li>"; }).join("") + "</ul></section>" +
      AI_NOTE + "</main>" +
      '<footer class="pad"><b>내부 검토용 · 학생 ID ' + esc(id) + "</b><span>권한이 있는 팀원 계정으로만 볼 수 있어요. 밖으로 보낼 때는 학생 정보를 꼭 가려 주세요.</span></footer></div>";
    return h;
  }

  /* ---------- 새 시안 (요약 · 어휘 · 문법 · 총평) ----------
     데이터는 숫자만 받고, 해설은 아래 규칙으로 만든다. 선은 임시값이고 기준이 정해지면 RULE만 고친다.
     문체: 제목은 지표명, 해설은 합니다체. 질문형 제목, 비유, 감정 표현을 쓰지 않는다. */
  var RULE = {
    lesson: 60,        /* 레벨마다 레슨 수 */
    cur: 10,           /* 이만큼 레슨을 해야 현재 레벨로 본다 */
    gap: 10,           /* 정확도 - 독립 수행률(%p)이 이 이상이면 힌트 사용이 많은 것으로 본다 */
    vLow: 60, gLow: 50 /* 정확도가 이 아래면 정확도 보완 대상 */
  };
  function jo(n, a, b) { return "136780".indexOf(String(n).slice(-1)) >= 0 ? a : b; } /* 숫자 뒤 조사: 1이 2가 */
  function num(n) { return Number(n).toLocaleString(); }
  function p1(x) { return x.toFixed(1) + "%"; }
  function facts(x) {
    var ok = x.ok / x.q * 100, solo = x.solo / x.q * 100;
    return { q: x.q, ok: x.ok, solo: x.solo, okP: ok, soloP: solo, gap: ok - solo };
  }
  function kind(f, low) { return f.gap >= RULE.gap ? "hint" : f.okP < low ? "low" : "solo"; }
  function progress(levels) {
    var L = levels.slice().sort(function (a, b) { return a[0] - b[0]; }), big = L.filter(function (x) { return x[1] >= RULE.cur; });
    var top = big.length ? big[big.length - 1] : L.reduce(function (m, x) { return x[1] > m[1] ? x : m; }), lv = top[0], n = top[1];
    var done = L.filter(function (x) { return x[1] >= RULE.lesson && x[0] < lv; }).map(function (x) { return x[0]; });
    var o = { lv: lv, n: n, full: n >= RULE.lesson, done: done };
    return o;
  }
  function comment(f, k, w) {
    var gap = (Math.round(f.okP * 10) - Math.round(f.soloP * 10)) / 10; /* 화면에 보이는 두 값의 차이와 맞춘다 */
    var left = f.solo === f.ok ? "맞힌 " + w.word + " " + num(f.ok) + "개를 모두 힌트 없이 썼습니다." : "맞힌 " + w.word + " " + num(f.ok) + "개 중 " + num(f.solo) + "개를 힌트 없이 썼습니다.";
    if (k === "hint") return [w.acc + jo4(w.acc) + " " + w.solo + "의 차이는 " + gap.toFixed(1) + "%p입니다.", w.word + jo3(w.word) + " 쓸 때 힌트를 함께 사용하고 있습니다."];
    if (k === "low") return [left, w.word + jo3(w.word) + " 정확하게 쓰는 연습이 더 필요합니다."];
    return [left];
  }
  function jo4(w) { return (w.charCodeAt(w.length - 1) - 44032) % 28 ? "과" : "와"; }
  function jo3(w) { return (w.charCodeAt(w.length - 1) - 44032) % 28 ? "을" : "를"; }
  function verdict(p, v, vk, g, gk) {
    var KE = ["다이어리 (한→영)", "한국어 문장을 보고 영어로 옮겨 쓰는 학습입니다."], FR = ["다이어리 (자유 쓰기)", "자신의 생각을 영어로 쓰는 학습입니다."];
    var DR = ["에코런 단어 연습", "배운 단어를 반복해서 쓰는 학습입니다."], GM = ["GV 마스터", "레슨에서 배운 블록을 복습하는 학습입니다."];
    var ask = "힌트를 열기 전에 먼저 써 보는 연습을 권해 드립니다.", did = p.done.length ? "레벨 " + p.done.join("·") + " 완료, 레벨 " + p.lv + " 레슨 " + p.n + "개" : "레벨 " + p.lv + " 레슨 " + p.n + "개 완료";
    if (vk === "low" || gk === "low") {
      var need = vk === "low" && gk === "low" ? "문장·어휘 정확도" : gk === "low" ? "문장 정확도" : "어휘 정확도", say = ["첫 시도 정확도는 문장 " + p1(g.okP) + ", 단어 " + p1(v.okP) + "입니다."];
      if (vk === "hint") say.push("단어는 힌트 없이 쓴 비율이 " + p1(v.soloP) + "입니다. " + ask);
      if (gk === "hint") say.push("문장은 힌트 없이 완성한 비율이 " + p1(g.soloP) + "입니다. " + ask);
      say.push("새 레슨과 함께 이미 배운 레슨의 복습을 권해 드립니다.");
      return { rows: [["학습 진도", did], ["보완할 점", need]], say: say, recs: [KE, gk === "low" ? GM : DR] };
    }
    if (vk === "hint" && gk === "hint") {
      var most = v.solo < v.ok / 2 && g.solo < g.ok / 2;
      return { rows: [["학습 진도", did], ["보완할 점", "힌트 없이 쓰기"]], say: ["힌트 없이 맞힌 비율은 단어 " + p1(v.soloP) + ", 문장 " + p1(g.soloP) + "입니다.", "힌트를 사용한 답안을 포함하면 단어 " + p1(v.okP) + ", 문장 " + p1(g.okP) + (most ? "로, 힌트를 사용해 맞힌 답안이 더 많습니다." : "입니다."), ask], recs: [KE, g.soloP <= v.soloP ? GM : DR] };
    }
    if (vk === "hint") return { rows: [["강점", "힌트 없는 문장 완성"], ["보완할 점", "힌트 없는 단어 쓰기"]], say: ["배운 문장은 " + p1(g.soloP) + "를 힌트 없이 완성했습니다.", "단어는 힌트 없이 쓴 비율이 " + p1(v.soloP) + "로, 문장보다 힌트를 자주 사용합니다.", "단어를 쓸 때 " + ask], recs: [KE, DR] };
    if (gk === "hint") return { rows: [["강점", "힌트 없는 단어 쓰기"], ["보완할 점", "힌트 없는 문장 완성"]], say: ["배운 단어는 " + p1(v.soloP) + "를 힌트 없이 썼습니다.", "문장은 힌트 없이 완성한 비율이 " + p1(g.soloP) + "로, 단어보다 힌트를 자주 사용합니다.", "문장을 쓸 때 " + ask], recs: [KE, GM] };
    return { rows: [["강점", "힌트 없는 문장·단어 쓰기"], ["다음 단계", "배운 표현으로 생각 쓰기"]], say: ["힌트 없이 쓴 비율은 문장 " + p1(g.soloP) + ", 단어 " + p1(v.soloP) + "입니다.", "배운 표현을 활용해 자신의 생각을 쓰는 연습을 권해 드립니다."], recs: [FR, p.full ? ["레벨 " + (p.lv + 1) + " 레슨", "다음 레벨의 레슨을 학습합니다."] : ["레벨 " + p.lv + " 다음 레슨", "현재 레벨의 레슨을 계속 학습합니다."]] };
  }
  function metric(label, P, n, q, main) {
    return '<div class="mt' + (main ? " main" : "") + '"><div class="mt-h"><span>' + esc(label) + "</span><b>" + p1(P).replace("%", "") + '<small>%</small></b></div><span class="mt-bar" role="img" aria-label="' + esc(label + " " + p1(P)) + '"><i style="width:' + P.toFixed(1) + '%"></i></span><span class="mt-n">' + num(n) + " / " + num(q) + "문항</span></div>";
  }
  function skill(key, title, f, k, w) {
    var c = comment(f, k, w);
    return '<section class="card" data-item="' + key + '" data-name="' + esc(title) + '"><h2>' + esc(title) + '</h2><div class="mts">' + metric(w.solo, f.soloP, f.solo, f.q, true) + metric(w.acc, f.okP, f.ok, f.q) + "</div>" +
      '<div class="cm"><b>해설</b>' + c.map(function (t) { return "<p>" + rich(t) + "</p>"; }).join("") + "</div>" +
      '<ul class="fn"><li><b>' + w.solo + "</b> 힌트를 사용하지 않고 첫 시도에 맞힌 비율</li><li><b>" + w.acc + "</b> 힌트 사용 여부와 관계없이 첫 시도에 맞힌 비율</li></ul></section>";
  }
  function blockCard(key, b, title, sub) {
    return '<section class="card" data-item="' + key + '" data-name="' + esc(title + " 학습 현황") + '"><h2>' + esc(title) + " 학습 현황<small>" + esc(sub) + '</small></h2><div class="kv2"><div><span>획득</span><b>' + num(b[0]) + "<small>개</small></b></div><div><span>마스터</span><b>" + num(b[1]) + "<small>개</small></b></div></div>" +
      '<ul class="fn"><li><b>획득</b> 레슨에서 학습한 기록이 있는 블록</li><li><b>마스터</b> 블록 점수가 80점 이상인 블록. 복습 상황에 따라 달라질 수 있습니다.</li></ul></section>';
  }
  function renderTalk(id, d) {
    var nm = d.name || "학생", p = progress(d.levels), v = facts(d.v), g = facts(d.g), vk = kind(v, RULE.vLow), gk = kind(g, RULE.gLow), end = verdict(p, v, vk, g, gk);
    var lv = LEVELS[p.lv] || LEVELS[1], N = d.notes, VW = { word: "단어", solo: "독립 어휘 작성률", acc: "어휘 정확도" }, GW = { word: "문장", solo: "독립 문장 완성률", acc: "문장 정확도" };
    var others = d.levels.filter(function (x) { return x[0] !== p.lv && x[1] < RULE.lesson; }).map(function (x) { return "레벨 " + x[0] + " " + x[1] + "개"; });
    var tabs = [["summary", "요약"], ["vocab", "어휘"], ["gram", "문법"], ["total", "총평"]];
    var h = '<div class="app sheet-tpl talk"><header class="top pad"><img src="img/logo_dark.png" alt="리얼 아카데미"><i class="rule"></i><span>GV 라이팅 리포트</span>' +
      '<button type="button" class="test" id="chatOpen" aria-haspopup="dialog">피드백 <b id="chatCount">0</b></button></header>' +
      '<nav class="tabbar pad" aria-label="리포트 탭"><div class="tabs" role="tablist">' +
      tabs.map(function (t, i) { return '<button type="button" role="tab" id="t-' + t[0] + '" aria-controls="p-' + t[0] + '" aria-selected="' + (i ? "false" : "true") + '"' + (i ? ' tabindex="-1"' : "") + ">" + t[1] + "</button>"; }).join("") + '</div></nav><main class="pad">';
    function panel(k, body) { return '<div class="panel" role="tabpanel" id="p-' + k + '" aria-labelledby="t-' + k + '" tabindex="0"' + (k === "summary" ? "" : " hidden") + ">" + body + "</div>"; }
    function row(k, val) { return "<div><dt>" + k + "</dt><dd>" + val + "</dd></div>"; }
    function jump(go, k, m, P) { return '<button type="button" class="jump-b" data-go="' + go + '"><span>' + k + "</span><em>" + m + "</em><b>" + p1(P) + "</b>" + CHEV + "</button>"; }
    function pnote(kd, n) { return note(kd, n).replace("영어로 쓰지 못한 부분", "한국어로 쓴 부분").replace("다듬을 부분", "교정할 부분"); }

    h += panel("summary",
      '<section class="card" data-item="talk-sum" data-name="학습 현황"><p class="who">GV 라이팅 학습 리포트</p><p class="stu"><b>' + esc(nm) + "</b><span>" + esc(d.period.join(" – ")) + "</span></p>" +
      '<div class="pgx"><div class="mt-h"><span>레벨 ' + p.lv + " 진도율</span><b>" + (p.n / RULE.lesson * 100).toFixed(1).replace(".0", "") + '<small>%</small></b></div><span class="mt-bar" role="img" aria-label="' + esc("레벨 " + p.lv + " 레슨 " + RULE.lesson + "개 중 " + p.n + "개 완료") + '"><i style="width:' + pct(p.n, RULE.lesson) + '%"></i></span></div>' +
      '<dl class="rows">' + (p.done.length ? row("완료 레벨", "레벨 " + p.done.join("·")) : "") + row("레벨 " + p.lv + " 완료 레슨", p.n + " / " + RULE.lesson + "개") + (others.length ? row("기타 학습 레슨", esc(others.join(", "))) : "") + row("누적 학습일", num(d.days) + "일") + (d.week ? row("주 평균 학습일", "약 " + d.week + "일") : "") + "</dl>" +
      '<ul class="fn"><li>학습일에는 GV 라이팅 외 앱 내 다른 학습일이 포함됩니다.</li></ul></section>' +
      '<section class="card" data-item="talk-level" data-name="현재 학습 수준"><h2>현재 학습 수준</h2><button type="button" class="level-strip" id="lvOpen" aria-haspopup="dialog" style="margin-top:12px"><span class="ls-lv">LV ' + p.lv + '</span><span class="ls-txt"><b>' + esc(lv.title) + "</b><small>CEFR " + esc(lv.cefr) + "</small></span>" + CHEV + "</button></section>" +
      '<section class="card" data-item="talk-areas" data-name="영역별 결과"><h2>영역별 결과</h2><div class="jump">' + jump("vocab", "어휘", VW.solo, v.soloP) + jump("gram", "문법", GW.solo, g.soloP) + "</div></section>");

    h += panel("vocab", skill("talk-vocab", "어휘 학습 결과", v, vk, VW) + blockCard("talk-vblock", d.vb, "V-block", "단어"));

    h += panel("gram", skill("talk-gram", "문법 학습 결과", g, gk, GW) + blockCard("talk-gblock", d.gb, "G-block", "문장 패턴") +
      (N ? '<section class="card" data-item="talk-notes" data-name="작성 문장 비교"><h2>작성 문장 비교</h2><p class="lead">교정 전 처음 제출한 문장입니다.</p><div class="cm"><b>해설</b><p>' + rich(N.say) + "</p></div></section>" + pnote("then", N.first) + pnote("now", N.recent) : ""));

    h += panel("total",
      '<section class="card" data-item="talk-lia" data-name="리아 선생님의 한마디"><h2>리아 선생님의 한마디</h2><div class="op">' + end.say.map(function (s) { return "<p>" + esc(s).replace(/(단어|문장) (\d)/g, "$1&nbsp;$2") + "</p>"; }).join("") + '</div><dl class="rows">' + end.rows.map(function (r) { return row(r[0], esc(r[1])); }).join("") + "</dl></section>" +
      '<section class="card" data-item="talk-recs" data-name="추천 보완 학습"><h2>추천 보완 학습</h2><ul class="rec2">' + end.recs.map(function (r) { return "<li><b>" + esc(r[0]) + "</b><span>" + esc(r[1]) + "</span></li>"; }).join("") + "</ul>" +
      '<p class="how">세부 학습 계획은 학습 상담에서 안내해 드립니다.</p><button type="button" class="btn" id="consultBtn" style="margin-top:16px">학습 상담 신청</button>' + AI_NOTE + "</section>");

    return h + '</main><footer class="pad"><b>내부 검토용 · 학생 ID ' + esc(id) + "</b><span>권한이 있는 팀원 계정으로만 볼 수 있어요. 밖으로 보낼 때는 학생 정보를 꼭 가려 주세요.</span></footer></div>" + formal(levelSheet({ level: p.lv }, nm));
  }
  /* 레벨 팝업을 리포트 문체로 */
  function formal(s) {
    return [["‘누가 무엇을 한다’는 기본 문장, 주어에 맞는 동사 모양, 현재·과거·미래를 나타내는 기초 시제를 배워요.", "주어와 동사의 기본 문장 구조, 주어에 따른 동사 형태, 현재·과거·미래의 기초 시제를 배웁니다."], ["지금 배우는 수준", "레벨별 학습 내용"], [/<p class="lead">레벨마다[\s\S]*?<\/p>/, '<p class="lead">GV 라이팅 레벨별로 배우는 문장의 수준입니다.</p>'], ["<em>지금</em>", "<em>현재</em>"], ["학교 영어와 비교하면", "교과 과정 연계"],
      [/ 학년\(([^)]*)\)은 참고로만[\s\S]*?거든요\./, " 참고 학년은 $1이며, 레벨과 학년이 정확히 일치하지는 않습니다."], [/에서 익히는 문법/, " 학습 문법"], [/에서 새로 배우는 것/, " 학습 내용"], [/로 넘어가요\./, "입니다."], [/단계예요<\/p>/, "단계</p>"],
      [/(LV \d)[은는]<br>/, "$1<br>"], [/배워요/g, "배웁니다"], [/수준이에요/g, "수준입니다"], [/비슷해요/g, "비슷합니다"], [/이어져요/g, "이어집니다"]].reduce(function (a, r) { return a.replace(r[0], r[1]); }, s);
  }

  window.renderReport = function (id, d) {
    if (d.template === "talk") return renderTalk(id, d);
    if (d.template === "all") return renderAll(id, d);
    if (d.template === "sheet") return renderSheet(id, d);
    var lv = LEVELS[d.level] || LEVELS[1], nm = d.name || "학생";
    var hl = d.highlight || {}, w = d.write || {}, pr = d.practice || {}, rw = d.rewrite || {}, fo = d.focus || { items: [] };
    var h = '<div class="app"><header class="top pad"><img src="img/logo_dark.png" alt="리얼 아카데미"><i class="rule"></i><span>GV 라이팅 리포트</span>' +
      '<button type="button" class="test" id="chatOpen" aria-haspopup="dialog">피드백 <b id="chatCount">0</b></button></header>' +
      '<nav class="tabbar pad" aria-label="리포트 탭"><div class="tabs" role="tablist">' +
      '<button type="button" role="tab" id="t-summary" aria-controls="p-summary" aria-selected="true">요약</button>' +
      '<button type="button" role="tab" id="t-writing" aria-controls="p-writing" aria-selected="false" tabindex="-1">글 비교</button>' +
      '<button type="button" role="tab" id="t-skills" aria-controls="p-skills" aria-selected="false" tabindex="-1">활동 기록</button>' +
      '<button type="button" role="tab" id="t-next" aria-controls="p-next" aria-selected="false" tabindex="-1">다음 학습</button>' +
      (d.items ? '<button type="button" role="tab" id="t-items" aria-controls="p-items" aria-selected="false" tabindex="-1">항목별</button>' : "") +
      '</div></nav><main class="pad">';
    if (d.items) h = h.replace('<div class="tabs" role="tablist">', '<div class="tabs five" role="tablist">');

    /* 요약 */
    h += '<div class="panel" role="tabpanel" id="p-summary" aria-labelledby="t-summary" tabindex="0">' +
      '<section class="card cover" data-item="cover"><div class="cover-art"><span class="lesson">LV ' + d.level + " · 레슨 " + d.last_lesson + '까지</span><img src="img/lesson_afternoon.jpg" alt=""></div>' +
      '<div class="cover-body"><p class="who">' + esc(nm + " · ID " + id + " · " + d.period) + "</p><h1>" + rich(d.headline, "em") + "</h1>" +
      '<div class="facts"><div><span>완료한 레슨</span><b>' + d.lessons + '<small>개</small></b></div><div><span>문장 연습</span><b>' + (pr.total || 0).toLocaleString() + '<small>문항</small></b></div><div><span>다시 쓰기</span><b>' + (rw.total || 0).toLocaleString() + "<small>문항</small></b></div></div>" +
      '<button type="button" class="level-strip" id="lvOpen" aria-haspopup="dialog"><span class="ls-lv">LV ' + d.level + '</span><span class="ls-txt"><b>' + esc(lv.title) + "</b><small>CEFR " + esc(lv.cefr) + " · 눌러서 자세히 보기</small></span>" + CHEV + "</button></div></section>" +
      '<section class="card teacher" data-item="lia-message"><div class="t-head"><span class="t-avatar"><svg aria-hidden="true"><use href="#cube"/></svg></span><div><b>리아 선생님</b><small>' + esc(nm) + " 학부모님께</small></div></div>" +
      (d.letter || []).map(function (p) { return "<p>" + rich(p) + "</p>"; }).join("") +
      '<div class="next-goal"><span>다음 목표</span><p>' + esc(d.goal) + "</p></div>" +
      '<p class="ai-note">본 학습 리포트는 리얼 아카데미 AI 학습 관리 시스템을 통해 분석 및 작성되었습니다.</p></section>' +
      '<section class="card" data-item="highlight"><span class="eyebrow">' + (hl.kind === "compare" ? "가장 크게 달라진 점" : "지금 가장 잘하고 있는 점") + "</span><h2>" + rich(hl.title) + "</h2>" +
      (hl.kind === "compare" ? compare(hl.title, hl.a, hl.of_a, hl.b, hl.of_b, hl.unit || "문장") + '<p class="lead">' + esc(hl.lead) + "</p>"
        : '<p class="quote">' + esc(hl.quote) + '</p><p class="lead">' + esc(hl.text) + "</p>") +
      '<button type="button" class="btn ghost" data-go="writing" style="margin-top:16px">처음 쓴 글과 지금 쓴 글 보기</button></section></div>';

    /* 글 비교 */
    h += '<div class="panel" role="tabpanel" id="p-writing" aria-labelledby="t-writing" tabindex="0" hidden>' +
      '<section class="card" style="padding-bottom:16px"><span class="eyebrow">GV 노트</span><h2>' + esc(nm) + "이 직접 쓴 첫 영작이에요</h2>" +
      '<p class="lead">피드백을 받기 전, ' + esc(nm) + "이 처음 쓴 그대로 옮겨 왔어요. 문장 아래 작은 글씨는 쓰려고 했던 뜻이에요.</p></section>" +
      note("then", d.then) + note("now", d.now) +
      '<section class="card change" data-item="before-after"><span class="eyebrow">무엇이 달라졌나요</span>' +
      (d.changes || []).map(function (c) { return '<div class="change-item"><svg width="22" height="22" aria-hidden="true"><use href="#' + (c[0] ? "check" : "dot") + '"/></svg><span>' + rich(c[1], "b") + "</span></div>"; }).join("") + "</section></div>";

    /* 활동 기록 */
    var up = pct(w.b, w.of_b) - pct(w.a, w.of_a);
    h += '<div class="panel" role="tabpanel" id="p-skills" aria-labelledby="t-skills" tabindex="0" hidden>' +
      '<section class="card" style="padding-bottom:16px"><span class="eyebrow">활동 기록</span><h2>수업 속 활동마다<br>어떻게 하고 있는지 볼게요</h2>' +
      '<p class="lead">첫 영작은 처음과 지금을 비교했어요. 문장 연습과 다시 쓰기는 지금까지 한 것을 모두 합쳐서 봤어요.</p></section>' +
      '<section class="card act" data-item="ind-write"><div class="act-head"><span class="act-ico"><img src="img/i_write.png" alt=""></span><div><small>첫 영작</small><b>혼자 영어로 쓰기</b></div>' +
      '<span class="chip ' + (up > 0 ? "up\">늘었어요" : "flat\">비슷해요") + "</span></div>" +
      '<div class="meter" role="img" aria-label="' + esc("처음 " + w.of_a + "문장 중 " + w.a + ", 지금 " + w.of_b + "문장 중 " + w.b) + '">' +
      '<div class="m-row"><span>처음</span><span class="m-track"><i style="width:' + pct(w.a, w.of_a) + '%"></i></span><span class="m-val">' + w.a + "<small> / " + w.of_a + "</small></span></div>" +
      '<div class="m-row now"><span>지금</span><span class="m-track"><i style="width:' + pct(w.b, w.of_b) + '%"></i></span><span class="m-val">' + w.b + "<small> / " + w.of_b + "</small></span></div></div>" +
      '<p class="say">' + esc(w.say) + "</p>" +
      '<details class="basis"><summary>나눠서 자세히 보기<svg width="14" height="14" aria-hidden="true"><use href="#chev"/></svg></summary><div class="basis-body">' +
      (w.crit || []).map(function (c) { return '<div class="crit"><b>' + esc(c[0]) + "</b><span>" + esc(c[1]) + " → <strong>" + esc(c[2]) + "</strong></span><small>" + esc(c[3]) + "</small></div>"; }).join("") +
      '<div class="crit"><b>독립성</b><span><strong>' + pct(pr.pass_, pr.total) + "%</strong> · 지금까지</span><small>문장 연습에서 힌트 없이 한 번에 맞힌 문제</small></div>" +
      '<span class="crit-note">처음 세 번, 최근 세 번 수업의 첫 영작을 한 문장씩 읽고 확인했어요.</span></div></details></section>' +
      '<section class="card act" data-item="ind-blocks"><div class="act-head"><span class="act-ico"><img src="img/i_blocks.png" alt=""></span><div><small>문장 연습</small><b>힌트 없이 완성하기</b></div><span class="chip flat">지금까지</span></div>' +
      '<div class="act-big"><b>' + pct(pr.pass_, pr.total) + "%</b><span>힌트 없이 한 번에 맞혔어요</span></div>" +
      '<div class="single" role="img" aria-label="' + esc(pr.total + "문제 중 힌트 없이 " + pr.pass_ + "문제") + '"><i class="a" style="width:' + (pr.pass_ / pr.total * 100).toFixed(1) + '%"></i>' + (pr.hint ? '<i class="b" style="width:' + (pr.hint / pr.total * 100).toFixed(1) + '%"></i>' : "") + "</div>" +
      '<div class="single-key"><span><i style="background:var(--green)"></i>힌트 없이 ' + pr.pass_.toLocaleString() + "</span>" + (pr.hint ? '<span><i style="background:#BDEFD4"></i>힌트 보고 ' + pr.hint.toLocaleString() + "</span>" : "") + "<span>전체 " + pr.total.toLocaleString() + "문제</span></div>" +
      '<p class="say">' + esc(pr.say) + "</p></section>" +
      '<section class="card act" data-item="ind-fix"><div class="act-head"><span class="act-ico"><img src="img/i_fix.png" alt=""></span><div><small>다시 쓰기</small><b>한 번에 고치기</b></div><span class="chip flat">지금까지</span></div>' +
      '<div class="act-big"><b>' + pct(rw.pass_, rw.total) + "%</b><span>한 번에 바르게 고쳤어요</span></div>" +
      '<div class="single" role="img" aria-label="' + esc(rw.total + "문제 중 " + rw.pass_ + "문제") + '"><i class="a" style="width:' + (rw.pass_ / rw.total * 100).toFixed(1) + '%"></i></div>' +
      '<div class="single-key"><span><i style="background:var(--green)"></i>한 번에 ' + rw.pass_.toLocaleString() + "</span><span>전체 " + rw.total.toLocaleString() + "문제</span></div>" +
      '<p class="say">' + esc(rw.say) + "</p></section>" +
      '<section class="card act" data-item="ind-talk"><div class="act-head"><span class="act-ico"><img src="img/i_speak.png" alt=""></span><div><small>에코 대화</small><b>에코와 대화하기</b></div><span class="chip flat">준비 중</span></div>' +
      '<div class="empty-act"><img src="img/echo_thumb.png" alt=""><span>말하기 기록은 다음 리포트부터 함께 보여 드릴게요.</span></div></section></div>';

    /* 다음 학습 */
    h += '<div class="panel" role="tabpanel" id="p-next" aria-labelledby="t-next" tabindex="0" hidden>' +
      '<section class="card" data-item="focus"><span class="eyebrow">이번 달에 집중할 것</span><h2>' + rich(fo.title) + '</h2><p class="lead">' + esc(fo.lead) + '</p><div class="focus">' +
      fo.items.map(function (it) {
        return '<div class="fx"><div class="fx-top"><b>' + esc(it[0]) + "</b><span>" + esc(it[1]) + "</span></div>" +
          (it[2] ? '<div class="pair"><span class="was">' + rich(it[2]) + '</span><span class="is">' + rich(it[3], "u") + "</span></div>" : '<p class="fx-text">' + esc(it[3]) + "</p>") + "</div>";
      }).join("") + "</div></section>" +
      '<section class="card" data-item="recs"><span class="eyebrow">함께 하면 좋은 학습</span>' +
      (d.recs || []).map(function (r, i) { return '<div class="rec"' + (i ? "" : ' style="padding-top:8px"') + "><b>" + esc(r[0]) + "</b><span>" + esc(r[1]) + "</span><small>" + esc(r[2]) + "</small></div>"; }).join("") + "</section>" +
      '<section class="card praise" data-item="praise-card"><div class="praise-top"><img src="img/echo_cele.png" alt=""><div><b>' + esc(nm) + "에게 칭찬 한마디</b><span>고르신 말은 칭찬 카드로 아이 태블릿에 도착해요</span></div></div>" +
      '<div class="choices" id="praiseChips">' + (d.praise || []).map(function (p) { return '<button type="button" class="choice" aria-pressed="false">' + esc(p) + "</button>"; }).join("") + "</div>" +
      '<button type="button" class="btn" id="praiseSend" disabled>보낼 말을 골라 주세요</button></section>' +
      '<section class="card" data-item="parent-guide"><span class="eyebrow">리포트 보는 법</span><div class="guide">' +
      [["혼자 쓴 문장만 봤어요", "피드백을 받기 전에 아이가 처음 쓴 문장으로만 비교했어요."],
       ["처음과 지금을 나란히 봤어요", "첫 수업 세 번과 최근 수업 세 번을 비교했어요."],
       ["레벨이 오르면 잠깐 주춤할 수 있어요", "문장이 길고 어려워지면서 처음엔 틀리는 곳이 늘 수 있어요. 새 레벨에 익숙해지는 동안 생기는 일이니 너무 걱정하지 않으셔도 돼요."],
       ["힌트를 쓰는 건 괜찮아요", "힌트도 어려운 표현을 배우는 과정이에요. 다음에 비슷한 문장을 쓸 때 힌트 없이 써 내는지를 함께 지켜봐 주세요."]]
        .map(function (g, i) { return '<div class="gi"><span class="n">' + (i + 1) + "</span><div><b>" + g[0] + "</b><span>" + g[1] + "</span></div></div>"; }).join("") +
      "</div></section></div>" + (d.items ? itemsPanel(d.items) : "") + "</main>" +
      '<footer class="pad"><b>내부 검토용 · 학생 ID ' + esc(id) + "</b><span>권한이 있는 팀원 계정으로만 볼 수 있어요. 밖으로 보낼 때는 학생 정보를 꼭 가려 주세요.</span></footer></div>";

    return h + levelSheet(d, nm);
  };
})();
