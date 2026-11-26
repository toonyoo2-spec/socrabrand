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
     데이터는 숫자와 학생이 쓴 문장만 받고, 화면 문구는 아래 규칙으로 만든다.
     문체: 제목은 짧은 명사형, 문장은 담백한 해요체(월간 학습점검 리포트 참고). 은유·번역체·분석 용어를 쓰지 않는다.
     레벨 설명은 「GV 라이팅 레벨 가이드」 PDF 문장을 따른다. */
  var RULE = {
    lesson: 60,        /* 레벨마다 레슨 수 */
    cur: 10,           /* 완료 레슨이 이 수 이하인 레벨은 대표 레벨로 보지 않는다 (11/23 합의) */
    near: 10,          /* 레슨 수 차이가 이 이하면 더 높은 레벨을 대표로 (11/20 합의) */
    gap: 10,           /* 정확도 - 독립 수행률(%p)이 이 이상이면 힌트 사용이 많은 것으로 본다 (임시) */
    vLow: 60, gLow: 50, /* 정확도가 이 아래면 복습을 먼저 권한다 (임시) */
    good: 70           /* 대표 레벨 독립 문장 완성률이 이 이상이면 ‘아주 훌륭해요’, 아니면 ‘잘하고 있어요’ (LX팀 11/24) */
  };
  var STAGES = [[1, 3, "문장에서 짧은 문단으로"], [4, 5, "구체적인 표현과 생각의 연결"], [6, 8, "원인·이슈·제안으로 확장"], [9, 9, "예정"]];
  var GUIDE = {
    1: { ko: "저는 달리기를 좋아해요. 언니와 함께 달려요.", goal: "기본 어순을 이해하고 자신과 일상을 짧고 완결된 문장으로 표현해요.", gr: "기본 문장 구조, 주어에 따른 동사 형태, 현재·과거·미래 시제" },
    2: { ko: "저는 남동생과 동물원에 갔어요. 우리는 그곳에서 두 시간 동안 머물렀어요.", goal: "시간·장소·빈도 등의 정보를 더해 의미가 구체적인 문장으로 표현해요.", gr: "부사와 부사구, 현재·과거·미래 시제와 진행형" },
    3: { ko: "제가 가장 좋아하는 계절은 겨울이에요. 눈 속에서 놀 수 있어서 겨울을 좋아해요. 예를 들어, 친구들과 눈사람 만드는 것을 좋아해요.", goal: "이유·예시·대조의 연결 표현을 활용해 하나의 주제로 이어지는 짧은 문단을 완성해요.", gr: "접속사와 접속부사(이유·대조·예시)" },
    4: { ko: "리아는 쿠키를 가지려고 하다가, 어떻게 된 건지도 모르게 아주 높이 올라가요.", goal: "특징, 행동의 이유와 결과를 덧붙인 문장을 쓰고 이를 이어 짧은 글로 구성해요.", gr: "to부정사와 동명사, 시간·이유·대조 접속 표현" },
    5: { ko: "일찍 일어나는 사람들은 시간이 더 많아서 스트레스를 덜 받아요.", goal: "의견을 이유로 뒷받침하고 도입-본문-결론의 흐름에 맞게 표현해요.", gr: "이유·조건·대조 접속 표현, 비교급·최상급, 결론을 이끄는 연결어" },
    6: { ko: "효율적인 대중교통은 도로 위 자동차 수를 줄이고, 이는 대기 오염을 낮춥니다.", goal: "원인과 결과를 논리적으로 연결하고 행동이나 경험의 의미와 영향을 설명해요.", gr: "복합적인 절 연결, 가정 표현, 대조·양보 표현" },
    7: { ko: "패스트패션 기업들이 계속 이익을 내는 동안, 그 뒤에서 사람들이 치르는 대가는 외면당하고 있습니다.", goal: "다양한 이슈에 대한 설명과 자신의 의견을 구분해 근거와 함께 표현해요.", gr: "주제별 어휘, 대조·양보 표현, 수동태, 과거완료" },
    8: { ko: "주민과 기술 산업 모두에게 도움이 되도록 규제가 마련되어야 합니다.", goal: "복잡한 내용을 설명하고 원인·목적·기대 효과를 연결해 대응 방향을 제안해요.", gr: "전문 어휘, 조동사 수동태, 분사 수식, 강조구문" }
  };
  function num(n) { return Number(n).toLocaleString(); }
  function p1(x) { return (Math.round(x * 10) / 10).toFixed(1) + "%"; }
  function pc(P) { return p1(P).replace("%", "<small>%</small>"); }
  function facts(x) {
    var ok = x.ok / x.q * 100, solo = x.solo / x.q * 100;
    var a = Math.round(solo * 10), b = Math.round(ok * 10); /* 세 비율의 합과 화면의 두 지표가 서로 맞도록 반올림한 값에서 뺀다 */
    return { q: x.q, ok: x.ok, solo: x.solo, hint: x.ok - x.solo, no: x.q - x.ok, okP: ok, soloP: solo, gap: ok - solo, pct: { solo: a / 10, hint: (b - a) / 10, no: (1000 - b) / 10 } };
  }
  function kind(f, low) { return f.gap >= RULE.gap ? "hint" : f.okP < low ? "low" : "solo"; }
  /* 대표 레벨: 학습 완료한 레벨보다 높은 레벨을 학습 중이면 그 레벨. 아니면 가장 많이 학습한 레벨 */
  function progress(levels) {
    var L = levels.slice().sort(function (a, b) { return a[0] - b[0]; });
    var done = L.filter(function (x) { return x[1] >= RULE.lesson; }).map(function (x) { return x[0]; }), topDone = done.length ? done[done.length - 1] : 0;
    var ing = L.filter(function (x) { return x[1] < RULE.lesson && x[1] > RULE.cur && x[0] > topDone; }), top;
    if (ing.length) {
      var m = Math.max.apply(null, ing.map(function (x) { return x[1]; }));
      top = ing.filter(function (x) { return m - x[1] <= RULE.near; }).pop();
    } else if (topDone) top = L.filter(function (x) { return x[0] === topDone; })[0];
    else top = L.reduce(function (a, x) { return x[1] > a[1] ? x : a; });
    return { lv: top[0], n: top[1], full: top[1] >= RULE.lesson, done: done.filter(function (x) { return x !== top[0]; }), allDone: done,
      others: L.filter(function (x) { return x[0] !== top[0] && x[1] < RULE.lesson; }) };
  }
  function josa(w, a, b) { return (w.charCodeAt(w.length - 1) - 44032) % 28 ? a : b; }
  function months(per) {
    var a = per[0].split("."), b = per[1].split("."), n = (b[0] - a[0]) * 12 + (b[1] - a[1]) - (+b[2] < +a[2] ? 1 : 0);
    return Math.max(1, n);
  }
  function comment(f, k, w) {
    var o = josa(w.word, "을", "를"), s = josa(w.word, "이", "가");
    if (k === "hint") return ["힌트를 활용해 " + w.word + o + " 완성한 경우가 " + (f.hint > f.ok / 2 ? "많았어요." : "있었어요."), "힌트를 열기 전에 먼저 써 보면 스스로 쓰는 " + w.word + s + " 더 늘어날 수 있어요."];
    if (k === "low") return ["새로운 " + w.word + o + " 배우며 레슨을 이어 가고 있어요.", "GV 마스터로 배운 레슨을 복습하면 더 정확하게 쓸 수 있어요."];
    return ["맞힌 " + w.word + josa(w.word, "은", "는") + " 대부분 힌트 없이 썼어요.", "레슨을 마친 뒤 GV 마스터로 복습하면 배운 표현을 더 오래 기억할 수 있어요."];
  }
  /* 추천 학습 (LX팀 11/24 확정). 판단은 대표 레벨의 독립 문장 완성률 s, 독립 어휘 작성률 w 로만 한다.
     라이브 1개 + 이외 학습 최대 2개. 레벨별 값(d.rep)이 없으면 전체 값을 쓴다 */
  var CONSULT = "https://realacademy.link/4xADfX5"; /* 학습 상담 예약 단축 링크 (은비님 11/24) */
  var EXTEND = "https://tally.so/r/PdM7vx"; /* 사전 연장 신청 폼 공개 주소 (은비님 11/25, /edit은 편집 화면이라 쓰지 않음) */
  var LIVE = ["Starter", "Beginner", "Intermediate", "Advanced", "Master"], LIVE_NOTE = "우리 아이에게 어떤 수업이 잘 맞을지 궁금하시면 상담을 신청해 주세요. 학습 기록을 바탕으로 수준에 맞는 강의를 추천해 드려요.";
  function repRate(d, p, v, g) { var r = d.reps && d.reps[p.lv] ? d.reps[p.lv] : d.rep && d.rep.lv === p.lv ? d.rep : {}; /* reps: 자동 생성 리포트의 레벨별 값 */ return { s: r.g != null ? r.g : g.pct.solo, w: r.v != null ? r.v : v.pct.solo }; }
  function live(p, s) {
    var i = p.lv <= 2 ? 1 : p.lv <= 4 ? 2 : p.lv <= 6 ? 3 : 4, nm;
    if (s >= 70 && i < 4) { nm = LIVE[i + 1]; return ["대치라이브 " + nm, nm + " 레벨의 대치라이브에 도전해 더 발전된 표현을 익혀 보세요."]; }
    if (s >= 40) { nm = LIVE[i]; return ["대치라이브 " + nm, nm + " 레벨의 대치라이브에서 배운 문장 패턴을 자신의 것으로 만들어 보세요."]; }
    nm = LIVE[i - 1] + "~" + LIVE[i];
    return ["대치라이브 " + nm, nm + " 레벨의 대치라이브를 들으며 문장 구성 능력을 키워 보세요."];
  }
  function recsOf(p, q) {
    var NX = ["다음 단계 GV 라이팅", "더 높은 수준의 문장에 도전하는 학습이에요. 새로운 표현을 더 다양하게 배울 수 있어요."], RV = ["GV 라이팅 복습", "지금 레벨에서 배운 레슨을 다시 학습해요. 배운 단어와 문장을 한 번 더 써 볼 수 있어요."];
    var GM = ["GV 마스터", "배운 GV 레슨을 복습하는 활동이에요. 문법과 어휘를 오래 기억하는 데 도움이 돼요."], DI = ["다이어리 (내 생각)", "자기 생각을 영어로 표현해 보는 활동이에요. 배운 표현을 다양한 주제에 써 볼 수 있어요."];
    var EW = ["에코런 단어 연습", "단어를 듣고 따라 말하며 익히는 활동이에요. 짧게 자주 해 보면 좋을 것 같아요."], EC = ["에코런 문장 연습", "문장을 조금씩 늘려 가며 따라 말하는 활동이에요. 짧게 자주 해 보면 좋을 것 같아요."];
    if (p.full && p.lv >= 8 && q.s >= 70) NX = RV; /* 다음 단계가 아직 없으면 복습 */
    if (q.s < 40) return q.w < 40 ? [GM, EW] : [GM, EC];
    if (q.w < 40) return [EW, q.s >= 70 ? NX : GM];
    return q.s >= 70 ? [NX, DI] : [RV, GM];
  }
  function verdict(d, p, v, vk, g, gk) {
    var low = vk === "low" || gk === "low", c = low ? "l" : vk === "hint" && gk === "hint" ? "b" : vk === "hint" ? "v" : gk === "hint" ? "g" : "s";
    var nm = d.name || "학생", lvs = d.levels.map(function (x) { return x[0]; }).sort(), q = repRate(d, p, v, g), best = q.s >= RULE.good;
    /* 1) 지금까지 한 것. 숫자는 긍정적으로 말할 수 있는 쪽만 쓴다 */
    var one = nm + josa(nm, "은", "는") + " 지금까지 레벨 " + lvs.join(", ") + "의 총 " + num(d.lessons) + "개 레슨을 학습" + (c === "l" ? "했어요." : "했고, 처음 풀 때 ") +
      { s: p1(v.soloP) + "의 단어와 " + p1(g.soloP) + "의 문장을 힌트 없이 완성했어요.", v: p1(g.soloP) + "의 문장을 힌트 없이 완성했어요.", g: p1(v.soloP) + "의 단어를 힌트 없이 완성했어요.", b: p1(v.okP) + "의 단어와 " + p1(g.okP) + "의 문장을 완성했어요.", l: "" }[c];
    /* 2) 칭찬 */
    var two = (d.notes ? "최근에는 ‘" + d.notes.recent.title + "’ 주제로 영어 문장을 썼어요. " : "") + (best ? "특히 독립 문장 작성률이 " + RULE.good + "% 이상으로 아주 훌륭해요." :
      { s: "배운 단어와 문장을 힌트 없이 쓰며 잘하고 있어요.", v: "특히 문장을 힌트 없이 쓰며 잘하고 있어요.", g: "특히 단어를 힌트 없이 쓰며 잘하고 있어요.", b: "필요한 순간에는 힌트를 활용해 끝까지 완성하며 잘하고 있어요.", l: "새로운 단어와 문장을 배우며 잘하고 있어요." }[c]);
    /* 3) 다음 한 걸음 */
    var three = { s: best ? "이제 더 높은 수준의 학습을 추천해요. 배운 표현으로 자기 생각을 영어로 표현해 보면 좋을 것 같아요." : "이제 배운 표현으로 자기 생각을 영어로 표현해 보면 좋을 것 같아요.",
      v: "단어를 쓸 때도 힌트를 열기 전에 먼저 써 보면, 배운 단어를 더 잘 기억할 수 있어요.", g: "문장을 쓸 때도 힌트를 열기 전에 먼저 써 보면, 배운 문장을 더 잘 기억할 수 있어요.", b: "이제 힌트를 열기 전에 먼저 써 보면, 스스로 쓰는 단어와 문장이 더 늘어날 수 있어요.", l: "새 레슨과 함께 배운 레슨을 복습하면, 헷갈리는 표현을 더 정확하게 쓸 수 있어요." }[c];
    return { say: [one, two, three],
      head: { s: "단어와 문장을 힌트 없이 쓰는 경우가 많아요.", v: "문장은 힌트 없이 쓰는 경우가 많고, 단어는 힌트를 함께 보고 있어요.", g: "단어는 힌트 없이 쓰는 경우가 많고, 문장은 힌트를 함께 보고 있어요.", b: "힌트를 활용해 단어와 문장을 완성하고 있어요.", l: "새로운 단어와 문장을 배우며 레슨을 이어 가고 있어요." }[c],
      good: ["잘하고 있어요", { s: "힌트 없이 단어와 문장 쓰기", v: "힌트 없이 문장 쓰기", g: "힌트 없이 단어 쓰기", b: v.okP >= g.okP ? "단어 완성하기" : "문장 완성하기", l: "레슨 " + num(d.lessons) + "개 학습" }[c]],
      next: ["다음 한 걸음", { s: "배운 표현으로 생각 말하기", v: "힌트 없이 단어 쓰기", g: "힌트 없이 문장 쓰기", b: "힌트 보기 전에 먼저 쓰기", l: "배운 레슨 복습하기" }[c]],
      recs: recsOf(p, q).concat([live(p, q.s)]) };
  }
  /* 첫 시도 결과 막대: 힌트 없이 정답 · 힌트 사용 정답 · 오답을 한 줄로 */
  var SEG = [["solo", "힌트 없이 정답"], ["hint", "힌트 사용 정답"]], ALL = [["solo"], ["hint"], ["no"]];
  function stack(f, big) {
    return '<span class="stk' + (big ? " big" : "") + '" role="img" aria-label="' + esc(SEG.map(function (s) { return s[1] + " " + p1(f.pct[s[0]]); }).join(", ")) + '">' +
      ALL.map(function (s) { return f[s[0]] ? '<i class="' + s[0] + '" style="flex-grow:' + f[s[0]] + '"></i>' : ""; }).join("") + "</span>";
  }
  function sec(key, name, title, sub, body) {
    return '<section class="sec" data-item="' + key + '" data-name="' + esc(name) + '"><h2>' + secIcon(key) + esc(title) + "</h2>" + (sub ? '<p class="sub">' + sub + "</p>" : "") + body + "</section>";
  }
  function skill(key, title, f, k, w) {
    return sec(key, title, title, w.block + " " + num(f.q) + "문항을 처음 풀었을 때의 결과예요.",
      '<div class="figs"><div class="on"><span>' + w.acc + "</span><b>" + pc(f.okP) + "</b><small>첫 시도에 맞힌 비율</small></div><div><span>" + w.solo + "</span><b>" + pc(f.soloP) + "</b><small>힌트 없이 맞힌 비율</small></div></div>" +
      stack(f, true) + '<table class="stk-t"><caption>' + esc(title) + " 상세</caption><tbody>" +
      SEG.map(function (s) { return '<tr><th scope="row"><i class="' + s[0] + '"></i>' + s[1] + "</th><td>" + num(f[s[0]]) + "문항</td><td>" + p1(f.pct[s[0]]) + "</td></tr>"; }).join("") + "</tbody></table>" +
      '<div class="cmt">' + comment(f, k, w).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div>");
  }
  function blocks(key, b, code, what) {
    return sec(key, code + " 학습 현황", code + " 학습 현황", code + "은 레슨에서 배우는 " + what + (what === "필수 단어" ? "예요." : "이에요."),
      '<div class="figs"><div class="on"><span>마스터</span><b>' + num(b[1]) + "<small>개</small></b></div><div><span>획득</span><b>" + num(b[0]) + "<small>개</small></b></div></div>" +
      '<span class="stk" role="img" aria-label="' + esc("획득 " + b[0] + "개 중 마스터 " + b[1] + "개") + '"><i class="solo" style="flex-grow:' + b[1] + '"></i>' + (b[0] > b[1] ? '<i class="no" style="flex-grow:' + (b[0] - b[1]) + '"></i>' : "") + "</span>" +
      '<dl class="defs"><div><dt>획득</dt><dd>새로운 ' + (code === "V-block" ? "단어를" : "문장 패턴을") + " 배웠어요. 스스로 쓰려면 연습이 더 필요해요.</dd></div><div><dt>마스터</dt><dd>배운 " + (code === "V-block" ? "단어를" : "문장 패턴을") + " 힌트 없이 써서 문장을 만들 수 있어요.</dd></div></dl>" +
      '<div class="tipbox"><b>GV 마스터란</b><p>GV 레슨 하나를 완료하면 진행할 수 있는 복습 프로그램이에요. 헷갈렸거나 틀린 단어와 문장을 복습하면 그 블록을 마스터할 수 있어요.</p></div>');
  }
  function levelPath(d, p) {
    var by = {}; d.levels.forEach(function (x) { by[x[0]] = x[1]; });
    var cells = "", i;
    for (i = 1; i <= 9; i++) cells += '<li class="' + (i === p.lv ? "cur" : "") + '"><i><u style="width:' + Math.min(100, (by[i] || 0) / RULE.lesson * 100).toFixed(1) + '%"></u></i><b>' + i + "</b></li>";
    return '<ol class="path" aria-label="' + esc("GV 라이팅 레벨 1부터 9 중 레벨 " + p.lv) + '">' + cells + '</ol><div class="stages">' +
      STAGES.map(function (s) { return '<span style="grid-column:span ' + (s[1] - s[0] + 1) + '"' + (p.lv >= s[0] && p.lv <= s[1] ? ' class="cur"' : "") + ">" + s[2] + "</span>"; }).join("") + '</div><p class="lv9n">레벨 9는 업데이트 예정이에요.</p>';
  }
  var X = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  /* CEFR 안내 팝업. 이름·6단계는 유럽평의회 기준, Basic·Plus는 따로 설명하지 않고 커리큘럼 팝업으로 보여 준다(지희님 11/24) */
  var CEFR = [["A1", "Breakthrough", "기본적인 의사소통을 하고 간단한 표현을 이해해요."], ["A2", "Waystage", "일상생활에 필요한 간단한 정보를 주고받을 수 있어요."], ["B1", "Threshold", "익숙한 주제의 핵심을 이해하고 경험이나 의견을 표현할 수 있어요."], ["B2", "Vantage", "복잡한 글의 요지를 이해하고 다양한 주제를 논리적으로 표현할 수 있어요."], ["C1", "Effective Operational Proficiency", "길고 복잡한 글을 이해하고 유창하게 의사소통할 수 있어요."], ["C2", "Mastery", "듣고 읽은 내용을 대부분 쉽게 이해하고 미묘한 의미 차이까지 파악할 수 있어요."]];
  function cefrPop(p) {
    var me = LEVELS[p.lv] ? LEVELS[p.lv].cefr.split(" ")[0] : "";
    return '<div class="sheet-bg" id="cefrBg" data-popclose="cefr" hidden></div><div class="sheet lvg" id="cefrSheet" role="dialog" aria-modal="true" aria-labelledby="cefrTitle" hidden><div class="sheet-in"><div class="sheet-head"><b id="cefrTitle">CEFR이란</b><button type="button" data-popclose="cefr" aria-label="닫기">' + X + '</button></div><div class="sheet-body">' +
      '<p class="cefr-t">CEFR(Common European Framework of Reference for Languages)은 유럽평의회가 발표한 외국어 능력 평가 국제 표준이에요. 외국어로 실제로 무엇을 할 수 있는지를 A1부터 C2까지 6단계로 나눠요.</p>' +
      '<ol class="cefr-l">' + CEFR.map(function (c) { return '<li' + (c[0] === me ? ' class="cur" aria-current="step"' : "") + "><i>" + c[0] + '</i><div><b lang="en">' + c[1] + "</b>" + (c[0] === me ? "<em>지금 배우는 단계</em>" : "") + "<p>" + c[2] + "</p></div></li>"; }).join("") + "</ol>" +
      '<button type="button" class="v-lnk" data-pop="cur" aria-haspopup="dialog">리얼 아카데미 커리큘럼</button>' +
      '<p class="fnote">CEFR은 레벨에서 배우는 내용의 수준이며, 시험으로 측정한 결과는 아니에요.</p></div></div></div>';
  }
  function levelGuide(p) {
    return '<div class="sheet-bg" id="lvBg" hidden></div><div class="sheet lvg" id="lvSheet" role="dialog" aria-modal="true" aria-labelledby="lvTitle" hidden><div class="sheet-in">' +
      '<div class="sheet-head"><b id="lvTitle">GV 라이팅 레벨별 학습 내용</b><button type="button" id="lvClose" aria-label="닫기"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>' +
      '<div class="sheet-body" data-item="level">' + STAGES.map(function (s) {
        var h = '<h3>' + (s[0] === 9 ? '업데이트 예정' : s[2]) + '</h3><ul class="lvg-l">', i;
        for (i = s[0]; i <= s[1]; i++) {
          if (!LEVELS[i]) { h += '<li><p class="soon"><b>레벨 ' + i + "</b><span>2027년 상반기에 내용을 안내해 드릴 예정이에요.</span></p></li>"; continue; }
          var st = i === p.lv ? (p.full ? "학습 완료" : "학습 중") : p.allDone.indexOf(i) >= 0 ? "학습 완료" : "";
          h += '<li' + (i === p.lv ? ' class="cur" aria-current="step"' : "") + '><details' + (i === p.lv ? " open" : "") + '><summary><b>레벨 ' + i + '</b><span>' + esc(LEVELS[i].short) + "</span>" + (st ? "<em>" + st + "</em>" : "") + '<svg width="14" height="14" aria-hidden="true"><use href="#chev"/></svg></summary>' +
            '<dl><div><dt>CEFR · 참고 학년</dt><dd>' + esc(LEVELS[i].cefr + " · " + LEVELS[i].grade) + "</dd></div><div><dt>학습 목표</dt><dd>" + esc(GUIDE[i].goal) + "</dd></div><div><dt>주요 문법</dt><dd>" + esc(GUIDE[i].gr) + "</dd></div><div><dt>대표 문장</dt><dd lang=\"en\">" + esc(LEVELS[i].rep) + "<small lang=\"ko\">" + esc(GUIDE[i].ko) + "</small></dd></div></dl></details></li>";
        }
        return h + "</ul>";
      }).join("") + '<p class="fnote">레벨과 학교 학년은 일대일로 맞지 않아요. 학년은 참고로만 봐 주세요.</p></div></div></div>' + cefrPop(p) + window.curriculumPopup(p.lv);
  }
  /* 비포·애프터: GV 노트 모양. 패턴 적용 문장 줄은 KWAN 11/26 요청으로 뺌(데이터 l[2]는 남겨 둠) */
  /* 표시 규칙(모든 학생 공통, KWAN 11/26): {{ }} 한국어로 쓴 부분 = 노란 칸, [[ ]] 철자·문법이 다른 단어 = 물결.
     대소문자·문장부호·숫자로 쓴 것은 표시하지 않는다. 표시가 없는 문장에는 '바르게 썼어요', 표시가 있으면 l[2](레슨 뒤 학생이 다시 쓴 최종 문장)를 '배운 뒤 고쳐 쓴 문장'으로 보여 준다. 설명은 카드 아래 한 번만, 항상 두 줄 모두 */
  function wrote(kd, n) {
    return '<div class="note' + (kd === "now" ? " now" : "") + '"><div class="note-top"><div><span class="eyebrow">' + (kd === "now" ? "지금" : "처음") + "</span><h3>" + esc(n.title) + '</h3></div><span class="stamp">' + esc(n.date + " · " + n.lesson) + '</span></div><ul class="lines">' + n.lines.map(function (l) {
      var ok = !l[2]; /* 고친 문장이 없으면 처음부터 바르게 쓴 문장 */
      return '<li><span class="en" lang="en">' + rich(l[0]) + '</span><span class="ko">' + esc(l[1]) + "</span>" + (ok ? '<span class="okline">바르게 쓴 문장이에요.</span>' : l[2] ? '<span class="fixline"><em>리아 선생님과 함께 고친 문장</em><b lang="en">' + esc(l[2]) + "</b></span>" : "") + "</li>";
    }).join("") + "</ul></div>";
  }
  var NOTE_KEY = '<div class="legend"><p class="lg-t">처음엔 어려웠던 곳도 리아 선생님과 함께 고치며 배웠어요.</p><span><i class="k1"></i>노란 칸: 영어 대신 한국어로 쓴 곳</span><span><i class="k2"></i>물결: 리아 선생님과 함께 고친 곳</span></div>';
  /* 학생 원문 (지희님 11/24): AI 개입 없는 데이터. 레벨 1~4는 Stage 2 첫 입력, 레벨 5 이상은 Stage 3 1차 에세이와 G-block 조건 달성 여부.
     data.orig = { lv, lesson, lines: [[학생 원문, G-block 패턴]] } 또는 { lv, lesson, essay, gs: [[G-block 패턴, 달성 여부(true/false)]] } */
  function origin(o) {
    var at = "레벨 " + o.lv + " 레슨 " + o.lesson;
    return '<p class="v-tx">' + (o.essay ? at + "에서 학생이 1차로 쓴 에세이예요." : "힌트를 가장 많이 사용한 레슨에서 학생이 직접 입력한 문장이에요.") + '</p><div class="noteband"><div class="note now"><div class="note-top"><div><span class="eyebrow">학생 원문</span></div><span class="stamp">' + at + "</span></div>" +
      (o.essay ? '<p class="og-e" lang="en">' + esc(o.essay) + '</p></div></div><ul class="og-g"><li class="og-h">G-block 패턴</li>' + o.gs.map(function (g) { return '<li><span lang="en">' + esc(g[0]) + "</span><b" + (g[1] ? ' class="ok"' : "") + ">" + (g[1] ? "달성" : "미달성") + "</b></li>"; }).join("") + "</ul>" :
        '<ul class="lines">' + o.lines.map(function (l) { return '<li><span class="en" lang="en">' + esc(l[0]) + '</span><span class="aft" lang="en"><em lang="ko">G-block 패턴</em>' + esc(l[1]) + "</span></li>"; }).join("") + "</ul></div></div>");
  }
  /* 총평: 처음과 지금 비교(성장 한눈에). data.growth = { early, recent } (리대시 3928, 처음 60일 / 최근 60일, 첫 시도 힌트 없이 정답 비율).
     문항이 30개 미만인 기간은 믿기 어려워 그 줄은 빼고, 레벨이 올랐으면 레벨 변화를 먼저 보여 준다 */
  function growthOf(d) {
    var G = d.growth, rows = [], best = null, low = null;
    if (G && G.early && G.recent) {
      [["v", "단어", "vq"], ["g", "문장", "gq"]].forEach(function (k) {
        var a = G.early, b = G.recent; if (a[k[2]] < 30 || b[k[2]] < 30) return;
        rows.push({ k: k[0], w: k[1], a: a[k[0]], b: b[k[0]], dl: Math.round((b[k[0]] - a[k[0]]) * 10) / 10 });
      });
      rows.forEach(function (r) { if (r.dl >= 5 && (!best || r.dl > best.dl)) best = r; if (!low || r.b < low.b) low = r; });
    }
    var lv0 = G ? G.early.lv : 0, lv1 = G ? G.recent.lv : 0, up = !!G && lv1 > lv0, ups = rows.filter(function (r) { return r.dl >= 5; });
    /* 제목 규칙 (에이전시 검수 11/26): +5%p 이상 오른 것만 '늘었어요', 내려간 항목은 제목에 쓰지 않는다 */
    var head;
    if (rows.length && ups.length && !up) head = "힌트 없이 " + best.w + " 쓰기가, 늘었어요";
    else if (rows.length && up && ups.length === rows.length) head = "레벨이 " + (lv1 - lv0) + "단계 오르고, 힌트 없이 쓰기도 늘었어요";
    else if (rows.length && up && ups.length) head = "레벨이 오르고, 힌트 없이 " + best.w + " 쓰기도 늘었어요";
    else if (up) head = "레벨 " + lv0 + "에서 " + lv1 + "까지, 올라왔어요";
    else head = num(d.lessons) + "레슨을, 꾸준히 학습했어요";
    return { G: G, rows: rows, best: best, low: low, up: up, lv0: lv0, lv1: lv1, head: head };
  }
  function growthCard(d, p, gr) {
    /* 오른 항목만 막대로 보여 준다. 내려간 항목은 숫자를 보여 주지 않는다 (11/26 KWAN) */
    var G = gr.G, rows = gr.rows.filter(function (r) { return r.dl > 0; });
    var bar = function (lbl, v, cls) { return '<div class="gw-b"><span>' + lbl + '</span><i><u class="' + cls + '" style="width:' + Math.max(2, Math.min(100, v)) + '%"></u></i><b>' + p1(v) + "</b></div>"; };
    var h = '<div class="gw-tiles"><div><b>' + num(d.lessons) + '</b><span>레슨 학습</span></div><div><b>' + num(d.vb[0]) + '</b><span>모은 단어</span></div><div><b>' + num(d.gb[0]) + '</b><span>익힌 문장 패턴</span></div></div>';
    if (gr.up) h += '<div class="gw-lv"><span>레벨</span><b>' + gr.lv0 + '</b><i aria-hidden="true">→</i><b class="on">' + gr.lv1 + '</b><em>' + (gr.lv1 - gr.lv0) + "단계 올라갔어요</em></div>";
    if (rows.length) {
      h += '<p class="gw-cap">처음 두 달(' + esc(G.early.s.replace(/-/g, ".")) + "부터)과 최근 두 달, 처음 풀었을 때 힌트 없이 맞힌 비율이에요.</p>";
      h += rows.map(function (r) {
        return '<div class="gw-row' + (gr.best === r ? " best" : "") + '"><div class="gw-h"><b>' + r.w + " 스스로 쓰기</b>" + (gr.best === r ? '<span class="gw-tag">가장 많이 자랐어요</span>' : "") + '<em class="up">+' + r.dl.toFixed(1) + "%p</em></div>" +
          bar("처음 (레벨 " + G.early.lv + ")", r.a, "a") + bar("지금 (레벨 " + G.recent.lv + ")", r.b, "b") + "</div>";
      }).join("");
    }
    h += '<p class="gw-next"><b>다음 목표</b> ' + (gr.low ? gr.low.w + (gr.low.w === "문장" ? "을" : "를") : "단어와 문장을") + " 힌트 없이 먼저 써 보기</p>";
    return '<section class="v-sec gw" data-item="b-growth" data-name="성장 한눈에"><h2>' + secIcon("b-areas") + (gr.best || gr.up ? "처음보다 이만큼 자랐어요" : "지금까지 이만큼 배웠어요") + "</h2>" + h + "</section>";
  }

  /* 추천 학습 아이콘: 앱 디자인 라이브러리 [RA] PAGE UI_All > menuicon 원본(피그마, 160px) */
  function appIcon(t) { var f = /라이브/.test(t) ? "ic_live" : /다이어리/.test(t) ? "ic_diary" : /마스터/.test(t) ? "ic_gvmaster" : /에코런/.test(t) ? "ic_ecorun" : /GV/.test(t) ? "ic_gv" : ""; return f ? '<i class="appic"><img src="img/' + f + '.png" alt="" width="40" height="40"></i>' : recIcon(t); }
  function recIcon(t) {
    var k = /라이브/.test(t) ? '<path d="M3 6h12v12H3zM15 10.5l6-3.5v10l-6-3.5"/>' : /다이어리/.test(t) ? '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12.5h5"/>' : /에코런/.test(t) ? '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9a4 4 0 010 6M19 6.5a8 8 0 010 11"/>' : /마스터|복습/.test(t) ? '<path d="M20 12a8 8 0 11-2.6-5.9"/><path d="M20 3v4.5h-4.5"/>' : '<path d="M5 12h14M13 6l6 6-6 6"/>';
    return '<i><svg viewBox="0 0 24 24" aria-hidden="true">' + k + "</svg></i>";
  }
  /* 소제목 아이콘 (A·B 공통) */
  var SICON = { level: '<path d="M4 19h4v-5H4zM10 19h4V9h-4zM16 19h4V4h-4z"/>', days: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>', areas: '<path d="M12 3a9 9 0 109 9h-9z"/><path d="M15 3.5A9 9 0 0120.5 9H15z"/>', vocab: '<path d="M3 18L8 6l5 12M4.7 14h6.6"/><path d="M21 18v-6a3 3 0 10-.1 3.5"/>', gram: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>', block: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>', notes: '<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h3"/>', lia: '<path d="M4 5h16v11H9l-5 4z"/>', next: '<path d="M5 12h14M13 6l6 6-6 6"/>', recs: '<path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z"/>' };
  function secIcon(key) { var k = key.replace(/^(b|talk)-/, "").replace(/^[vg]block$/, "block").replace(/^rec-peek$/, "recs"); return SICON[k] ? '<i class="si"><svg viewBox="0 0 24 24" aria-hidden="true">' + SICON[k] + "</svg></i>" : ""; }

  /* ---------- B안: 탭마다 초록 첫 화면에 그림 하나, 아래 흰 지면에 설명 ----------
     레슨 길 · 원형 · 레벨 줄이 모두 같은 둥근 선. 문구와 숫자는 A안과 같은 규칙을 쓴다. 클래스는 모두 v- 로 시작 */
  function roadMap(n) {
    var X0 = 22, X1 = 342, Y0 = 92, G = 38, R = G / 2, W = X1 - X0, arc = Math.PI * R, total = 6 * W + 5 * arc, gap = total / 59;
    function at(s) { for (var k = 0; k < 6; k++) { if (s <= W + .001 || k === 5) return [k % 2 ? X1 - s : X0 + s, Y0 + k * G]; s -= W; if (s < arc) { var a = s / R; return [k % 2 ? X0 - Math.sin(a) * R : X1 + Math.sin(a) * R, Y0 + k * G + R - Math.cos(a) * R]; } s -= arc; } }
    var d = "M" + X0 + " " + Y0, k; for (k = 0; k < 6; k++) { var y = Y0 + k * G, right = k % 2 === 0; d += "H" + (right ? X1 : X0); if (k < 5) d += "A" + R + " " + R + " 0 0 " + (right ? 1 : 0) + " " + (right ? X1 : X0) + " " + (y + G); }
    var dots = "", i; for (i = 1; i <= 60; i++) { var q = at((i - 1) * gap), ok = i <= n; dots += i % 10 === 0 ? '<text x="' + q[0].toFixed(1) + '" y="' + (q[1] + 4).toFixed(1) + '" class="' + (ok ? "on" : "off") + '">' + i + "</text>" : '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="2.4" class="' + (ok ? "on" : "off") + '"/>'; }
    var e = at((n - 1) * gap), w = 58, h = w * 1.47, ex = Math.max(4, Math.min(364 - w - 4, e[0] - w / 2)), top = n <= 12 ? 0 : n <= 24 ? 30 : 64;
    return '<div class="v-road"><svg viewBox="0 ' + top + " 364 " + (Y0 + 5 * G + 20 - top) + '" role="img" aria-label="레슨 60개 중 ' + n + '개 완료"><path class="base" d="' + d + '"/><path class="done" d="' + d + '" stroke-dasharray="' + Math.max(1, (n - 1) * gap).toFixed(1) + ' 5000"/>' + dots + '<image href="img/echo_thumb.png" x="' + ex.toFixed(1) + '" y="' + (e[1] - h + 6).toFixed(1) + '" width="' + w + '" height="' + h.toFixed(1) + '"/></svg></div>';
  }
  function ring(f, size, th, c, label) {
    var r = (size - th) / 2, C = 2 * Math.PI * r, g = 3, a = f.pct.solo / 100 * C, b = f.pct.hint / 100 * C, m = size / 2;
    function arc(len, off, col) { return len > 1 ? '<circle cx="' + m + '" cy="' + m + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + th + '" stroke-dasharray="' + Math.max(1, len - g).toFixed(1) + " " + C.toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '"/>' : ""; }
    return '<div class="v-ring"><svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' + esc("힌트 없이 " + f.pct.solo + "%, 힌트 사용 " + f.pct.hint + "%") + '"><circle cx="' + m + '" cy="' + m + '" r="' + r + '" fill="none" stroke="' + c[2] + '" stroke-width="' + th + '"/>' + arc(a, 0, c[0]) + arc(b, a, c[1]) + "</svg>" + (label ? "<p>" + pc(f.okP) + "</p>" : "") + "</div>";
  }
  function renderB(id, d) {
    var nm = d.name || "학생", p = progress(d.levels), v = facts(d.v), g = facts(d.g), vk = kind(v, RULE.vLow), gk = kind(g, RULE.gLow), end = verdict(d, p, v, vk, g, gk), GR = growthOf(d);
    var lv = LEVELS[p.lv] || { title: "레벨 " + p.lv + " 과정", cefr: "안내 예정" }, gd = GUIDE[p.lv] || { goal: "" }, nx = LEVELS[p.lv + 1], N = d.notes;
    var VW = { word: "단어", acc: "어휘 작성률", solo: "독립 어휘 작성률", code: "V-block", what: "필수 단어예요", obj: "단어를", k: "v" }, GW = { word: "문장", acc: "문장 작성률", solo: "독립 문장 작성률", code: "G-block", what: "문장 패턴이에요", obj: "문장 패턴을", k: "g" };
    var ON = ["var(--v-on)", "var(--v-hint-on)", "var(--v-dark)"], WH = ["var(--green)", "var(--v-hint)", "#E6EDE9"];
    var tabs = [["summary", "요약"], ["vocab", "어휘"], ["gram", "문법"], ["total", "총평"]];
    function sec(key, name, body, tt) { return '<section class="v-sec" data-item="b-' + key + '" data-name="' + esc(name) + '"><h2>' + secIcon("b-" + key) + esc(tt || name) + "</h2>" + body + "</section>"; }
    function panel(k, hero, body) { return '<div class="panel v-panel" role="tabpanel" id="p-' + k + '" aria-labelledby="t-' + k + '" tabindex="0"' + (k === "summary" ? "" : " hidden") + ">" + hero + '<div class="v-sheet">' + body + "</div></div>"; }
    function skill(key, title, f, k, w, b) {
      return ['<section class="v-hero" data-item="b-' + key + '" data-name="' + esc(title) + '"><p class="v-who">' + title + '</p><div class="v-hring"><div><p class="v-big">' + pc(f.okP) + '</p><p class="v-s"><b>' + w.acc + "</b><br>" + num(f.q) + "문항을 처음 풀었을 때<br>맞힌 비율이에요.</p></div>" + ring(f, 144, 22, ON) + '</div><ul class="v-hleg"><li><i style="background:var(--v-on)"></i>힌트 없이 <b>' + num(f.solo) + '</b></li><li><i style="background:var(--v-hint-on)"></i>힌트 사용 <b>' + num(f.hint) + "</b></li><li>" + w.solo + " <b>" + p1(f.soloP) + "</b></li></ul></section>",
        '<section class="v-sec"><div class="v-say">' + comment(f, k, w).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div></section>" +
        sec(w.k + "block", w.code + " 학습 현황", '<p class="v-blk"><b>' + num(b[1]) + "</b><span>개 마스터 · <strong>" + num(b[0]) + '개</strong> 획득</span></p><div class="v-ln" role="img" aria-label="획득 ' + b[0] + "개 중 마스터 " + b[1] + '개"><i style="width:' + (b[0] ? b[1] / b[0] * 100 : 0).toFixed(1) + '%"></i></div><dl class="v-defs"><div><dt>획득</dt><dd>새로운 ' + w.obj + " 배웠어요. 스스로 쓰려면 연습이 더 필요해요.</dd></div><div><dt>마스터</dt><dd>배운 " + w.obj + ' 힌트 없이 써서 문장을 만들 수 있어요.</dd></div></dl><div class="v-tip"><b>GV 마스터란</b><p>GV 레슨 하나를 완료하면 진행할 수 있는 복습 프로그램이에요. 헷갈렸거나 틀린 단어와 문장을 복습하면 그 블록을 마스터할 수 있어요.</p></div>')];
    }
    var l9 = "", i; for (i = 1; i <= 9; i++) l9 += '<li class="' + (i === p.lv ? "me" : p.allDone.indexOf(i) >= 0 ? "ok" : i === 9 ? "yet" : "") + '"' + (i === p.lv ? ' aria-current="step"' : "") + "><b>" + i + "</b></li>";
    var h = '<div class="app vb"><header class="top pad"><img src="img/logo_dark.png" alt="리얼 아카데미"><span>GV 라이팅</span><button type="button" class="test" id="chatOpen" aria-haspopup="dialog">피드백 <b id="chatCount">0</b></button></header>' +
      '<nav class="tabbar pad" aria-label="리포트 탭"><div class="v-tabs" role="tablist">' + tabs.map(function (t, i) { return '<button type="button" role="tab" id="t-' + t[0] + '" aria-controls="p-' + t[0] + '" aria-selected="' + (i ? "false" : "true") + '"' + (i ? ' tabindex="-1"' : "") + ">" + t[1] + "</button>"; }).join("") + "</div></nav><main>";
    h += panel("summary", '<section class="v-hero" data-item="b-sum" data-name="종합 결과"><p class="v-who">' + esc(nm) + '</p><h1 class="v-h">' + months(d.period) + "개월 동안, 우리&nbsp;자녀의 <b>영어로 표현하는&nbsp;힘</b>은 어떻게 성장해&nbsp;왔을까요?</h1>" + roadMap(p.n) + '<p class="v-cap"><span>레벨 ' + p.lv + " 레슨</span><span><b>" + p.n + "</b> / " + RULE.lesson + "개</span></p></section>",
      sec("level", "학습 레벨", '<ol class="v-lv9" aria-label="레벨 1부터 9">' + l9 + '</ol><p class="lv9n">레벨 9는 업데이트 예정이에요.</p><p class="v-lvt">' + esc(lv.title) + '</p><p class="v-tx">' + esc(gd.goal) + '</p><dl class="v-facts">' + (p.done.length ? "<div><dt>학습 완료</dt><dd>레벨 " + p.done.join(" · ") + "</dd></div>" : "") + "<div><dt>CEFR <button type='button' class='qm' data-pop='cefr' aria-label='CEFR 설명 보기' aria-haspopup='dialog'>?</button></dt><dd>" + esc(lv.cefr) + "</dd></div></dl>" + (p.others.length ? '<p class="v-sm">이 밖에 ' + p.others.map(function (x) { return "레벨 " + x[0] + " 레슨 " + x[1] + "개"; }).join(", ") + "를 학습했어요.</p>" : "") + '<button type="button" class="v-lnk" id="lvOpen" aria-haspopup="dialog">레벨별 학습 내용</button><button type="button" class="v-lnk" data-pop="cur" aria-haspopup="dialog">리얼 아카데미 커리큘럼</button>') +
      sec("areas", "영역별 결과", '<p class="v-tx">' + esc(end.head) + '</p><div class="v-rings"><button type="button" data-go="vocab">' + ring(v, 116, 15, WH, true) + "<b>어휘 (V-block)</b><span>" + VW.acc + '</span></button><button type="button" data-go="gram">' + ring(g, 116, 15, WH, true) + "<b>문법 (G-block)</b><span>" + GW.acc + '</span></button></div><p class="v-leg"><span><i style="background:var(--green)"></i>힌트 없이 정답</span><span><i style="background:var(--v-hint)"></i>힌트 사용 정답</span></p><p class="v-sm v-first">퍼센트는 문항을 처음 풀었을 때 맞힌 비율이에요.</p>') +
      sec("days", "학습 참여", '<p class="v-blk"><b>' + num(d.days) + "</b><span>일 학습" + (d.access ? " · 앱 접속 <strong>" + num(d.access) + "일</strong> 중" : "") + "</span></p>" + (d.access ? '<div class="v-ln"><i style="width:' + (d.days / d.access * 100).toFixed(1) + '%"></i></div>' : "") + '<p class="v-sm" style="margin-top:10px">' + esc(d.period.join(" – ")) + " 기준이며, GV 라이팅이 아닌 학습을 한 날도 포함돼요.</p>") +
      sec("rec-peek", "추천 학습", '<button type="button" class="rx-peek" data-go="total"><span class="rx-pill dark">가장 먼저 추천</span><b>' + esc(end.recs[0][0]) + "</b>" + end.recs.slice(1).map(function (r) { return "<i>" + esc(r[0]) + "</i>"; }).join("") + '<em>자세히 보기 →</em></button>'));
    var V = skill("vocab", "어휘 학습 결과", v, vk, VW, d.vb), Q = skill("gram", "문법 학습 결과", g, gk, GW, d.gb);
    h += panel("vocab", V[0], V[1]);
    h += panel("gram", Q[0], Q[1] + (d.orig ? sec("notes", "학생 원문", origin(d.orig)) : N ? sec("notes", "작성 문장 비교", '<div class="v-lead">' + N.say.split("\n").map(function (t) { return "<p>" + rich(t) + "</p>"; }).join("") + '</div><div class="noteband">' + wrote("then", N.first) + wrote("now", N.recent) + NOTE_KEY + "</div>") : ""));
    h += panel("total", '<section class="v-hero v-lia" data-item="b-lia" data-name="리아 선생님의 한마디"><div><p class="v-who">리아 선생님의 한마디</p><h2 class="v-h">' + (function (t) { var i = t.indexOf(", "); return i < 0 ? "<b>" + esc(t) + "</b>" : esc(t.slice(0, i + 1)) + "<br><b>" + esc(t.slice(i + 2)) + "</b>"; })(GR.head) + '</h2></div><svg class="v-stamp" viewBox="0 0 140 140" role="img" aria-label="Great Work! 도장"><defs><filter id="ink" x="-4%" y="-4%" width="108%" height="108%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" result="d"/><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="1" seed="4" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.9 1.45" result="m"/><feComposite in="d" in2="m" operator="in"/></filter><path id="stTop" d="M25 70a45 45 0 0 1 90 0"/><path id="stBot" d="M18 70a52 52 0 0 0 104 0"/></defs><g filter="url(#ink)" fill="#C33A2C" stroke="#C33A2C"><path d="M138.40 70.00 L137.83 71.48 L136.44 72.90 L135.02 74.26 L134.35 75.63 L134.77 77.09 L135.93 78.68 L137.05 80.32 L137.36 81.88 L136.54 83.24 L134.92 84.39 L133.29 85.49 L132.40 86.72 L132.55 88.23 L133.42 90.00 L134.24 91.81 L134.27 93.39 L133.23 94.59 L131.44 95.45 L129.64 96.24 L128.55 97.30 L128.44 98.82 L128.99 100.71 L129.48 102.63 L129.24 104.20 L128.00 105.20 L126.09 105.73 L124.18 106.20 L122.92 107.05 L122.55 108.53 L122.76 110.48 L122.91 112.46 L122.40 113.97 L121.01 114.73 L119.03 114.93 L117.07 115.06 L115.68 115.68 L115.06 117.07 L114.93 119.03 L114.73 121.01 L113.97 122.40 L112.46 122.91 L110.48 122.76 L108.53 122.55 L107.05 122.92 L106.20 124.18 L105.73 126.09 L105.20 128.00 L104.20 129.24 L102.63 129.48 L100.71 128.99 L98.82 128.44 L97.30 128.55 L96.24 129.64 L95.45 131.44 L94.59 133.23 L93.39 134.27 L91.81 134.24 L90.00 133.42 L88.23 132.55 L86.72 132.40 L85.49 133.29 L84.39 134.92 L83.24 136.54 L81.88 137.36 L80.32 137.05 L78.68 135.93 L77.09 134.77 L75.63 134.35 L74.26 135.02 L72.90 136.44 L71.48 137.83 L70.00 138.40 L68.52 137.83 L67.10 136.44 L65.74 135.02 L64.37 134.35 L62.91 134.77 L61.32 135.93 L59.68 137.05 L58.12 137.36 L56.76 136.54 L55.61 134.92 L54.51 133.29 L53.28 132.40 L51.77 132.55 L50.00 133.42 L48.19 134.24 L46.61 134.27 L45.41 133.23 L44.55 131.44 L43.76 129.64 L42.70 128.55 L41.18 128.44 L39.29 128.99 L37.37 129.48 L35.80 129.24 L34.80 128.00 L34.27 126.09 L33.80 124.18 L32.95 122.92 L31.47 122.55 L29.52 122.76 L27.54 122.91 L26.03 122.40 L25.27 121.01 L25.07 119.03 L24.94 117.07 L24.32 115.68 L22.93 115.06 L20.97 114.93 L18.99 114.73 L17.60 113.97 L17.09 112.46 L17.24 110.48 L17.45 108.53 L17.08 107.05 L15.82 106.20 L13.91 105.73 L12.00 105.20 L10.76 104.20 L10.52 102.63 L11.01 100.71 L11.56 98.82 L11.45 97.30 L10.36 96.24 L8.56 95.45 L6.77 94.59 L5.73 93.39 L5.76 91.81 L6.58 90.00 L7.45 88.23 L7.60 86.72 L6.71 85.49 L5.08 84.39 L3.46 83.24 L2.64 81.88 L2.95 80.32 L4.07 78.68 L5.23 77.09 L5.65 75.63 L4.98 74.26 L3.56 72.90 L2.17 71.48 L1.60 70.00 L2.17 68.52 L3.56 67.10 L4.98 65.74 L5.65 64.37 L5.23 62.91 L4.07 61.32 L2.95 59.68 L2.64 58.12 L3.46 56.76 L5.08 55.61 L6.71 54.51 L7.60 53.28 L7.45 51.77 L6.58 50.00 L5.76 48.19 L5.73 46.61 L6.77 45.41 L8.56 44.55 L10.36 43.76 L11.45 42.70 L11.56 41.18 L11.01 39.29 L10.52 37.37 L10.76 35.80 L12.00 34.80 L13.91 34.27 L15.82 33.80 L17.08 32.95 L17.45 31.47 L17.24 29.52 L17.09 27.54 L17.60 26.03 L18.99 25.27 L20.97 25.07 L22.93 24.94 L24.32 24.32 L24.94 22.93 L25.07 20.97 L25.27 18.99 L26.03 17.60 L27.54 17.09 L29.52 17.24 L31.47 17.45 L32.95 17.08 L33.80 15.82 L34.27 13.91 L34.80 12.00 L35.80 10.76 L37.37 10.52 L39.29 11.01 L41.18 11.56 L42.70 11.45 L43.76 10.36 L44.55 8.56 L45.41 6.77 L46.61 5.73 L48.19 5.76 L50.00 6.58 L51.77 7.45 L53.28 7.60 L54.51 6.71 L55.61 5.08 L56.76 3.46 L58.12 2.64 L59.68 2.95 L61.32 4.07 L62.91 5.23 L64.37 5.65 L65.74 4.98 L67.10 3.56 L68.52 2.17 L70.00 1.60 L71.48 2.17 L72.90 3.56 L74.26 4.98 L75.63 5.65 L77.09 5.23 L78.68 4.07 L80.32 2.95 L81.88 2.64 L83.24 3.46 L84.39 5.08 L85.49 6.71 L86.72 7.60 L88.23 7.45 L90.00 6.58 L91.81 5.76 L93.39 5.73 L94.59 6.77 L95.45 8.56 L96.24 10.36 L97.30 11.45 L98.82 11.56 L100.71 11.01 L102.63 10.52 L104.20 10.76 L105.20 12.00 L105.73 13.91 L106.20 15.82 L107.05 17.08 L108.53 17.45 L110.48 17.24 L112.46 17.09 L113.97 17.60 L114.73 18.99 L114.93 20.97 L115.06 22.93 L115.68 24.32 L117.07 24.94 L119.03 25.07 L121.01 25.27 L122.40 26.03 L122.91 27.54 L122.76 29.52 L122.55 31.47 L122.92 32.95 L124.18 33.80 L126.09 34.27 L128.00 34.80 L129.24 35.80 L129.48 37.37 L128.99 39.29 L128.44 41.18 L128.55 42.70 L129.64 43.76 L131.44 44.55 L133.23 45.41 L134.27 46.61 L134.24 48.19 L133.42 50.00 L132.55 51.77 L132.40 53.28 L133.29 54.51 L134.92 55.61 L136.54 56.76 L137.36 58.12 L137.05 59.68 L135.93 61.32 L134.77 62.91 L134.35 64.37 L135.02 65.74 L136.44 67.10 L137.83 68.52Z" fill="none" stroke-width="2.4"/><circle cx="70" cy="70" r="59.5" fill="none" stroke-width="1.1"/><circle cx="70" cy="70" r="40.5" fill="none" stroke-width="1.6"/><circle cx="70" cy="70" r="37.5" fill="none" stroke-width=".7"/><text stroke="none" font-size="10.5" font-weight="800" letter-spacing="3" text-anchor="middle" style="font-family:var(--nu)"><textPath href="#stTop" startOffset="50%">REAL ACADEMY</textPath></text><text stroke="none" font-size="8.5" font-weight="800" letter-spacing="2.6" text-anchor="middle" style="font-family:var(--nu)"><textPath href="#stBot" startOffset="50%">GV WRITING</textPath></text><text stroke="none" font-size="8" text-anchor="middle" x="21.5" y="72.8">★</text><text stroke="none" font-size="8" text-anchor="middle" x="118.5" y="72.8">★</text><image href="img/stamp_r.png" x="61" y="36.5" width="18" height="20.2"/><path stroke="none" fill-opacity=".72" d="M6 64h20v22H6l5-11z M134 64h-20v22h20l-5-11z"/><path stroke="none" fill-opacity=".9" d="M14 86l12-4v4z M126 86l-12-4v4z"/><rect x="14" y="60" width="112" height="22" rx="1.5" stroke="none"/><rect x="17" y="62.5" width="106" height="17" rx="1" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".7" stroke-dasharray="2 1.6"/><text x="70" y="76.4" font-size="14.5" font-weight="900" fill="#fff" stroke="none" text-anchor="middle" letter-spacing=".6" style="font-family:var(--nu)">GREAT WORK!</text><text stroke="none" font-size="8.5" text-anchor="middle" letter-spacing="2.2" x="70" y="98">★★★</text></g></svg></section>',
      growthCard(d, p, GR) +
      
      (p.lv < 9 ? sec("next", "다음 학습 과정", '<div class="v-step"><i class="a">' + p.lv + '</i><p class="v-sm">' + (p.full ? "레벨 " + p.lv + " 레슨을 모두 마쳤어요." : "레벨 " + p.lv + "의 남은 레슨은 " + (RULE.lesson - p.n) + "개예요.") + '</p><span class="bar"></span><span></span><i class="z">' + (p.lv + 1) + "</i><b>" + (nx ? esc(nx.title) : "2027년 상반기에 안내해 드릴 예정이에요.") + "</b></div>" + (nx ? '<div class="v-ex"><span>이런 표현을 배워요</span><p lang="en">' + esc(nx.rep) + "</p><small>" + esc(GUIDE[p.lv + 1].ko) + "</small></div>" : "")) : "") +
      (function () {
        var R = end.recs.slice(), li = R.findIndex(function (r) { return /라이브/.test(r[0]); });
        if (li > 1) R.splice(1, 0, R.splice(li, 1)[0]); /* 대치라이브를 두 번째로 */
        var hero = R[0], rest = R.slice(1);
        return '<section class="v-sec rx" data-item="b-recs" data-name="추천 학습"><h2>다음 학습 추천</h2><p class="rx-lead">' + esc(nm) + '의 학습 기록을 보고 고른 학습이에요.</p>' +
          '<div class="rx-hero"><div><span class="rx-pill">가장 먼저 추천</span><b>' + esc(hero[0]) + "</b><p>" + esc(hero[1]) + "</p></div>" + appIcon(hero[0]) + "</div>" +
          '<ul class="rx-list">' + rest.map(function (r) { var lv = /라이브/.test(r[0]); return "<li>" + appIcon(r[0]) + '<div><span class="rx-tag' + (lv ? " live" : "") + '">' + (lv ? "라이브 수업" : "앱 학습") + "</span><b>" + esc(r[0]) + "</b><p>" + esc(r[1]) + "</p></div></li>"; }).join("") + "</ul>" +
          '<p class="rx-ask">추천 학습이 맞을지 리얼 코칭 상담에서 정해 보세요.</p></section>';
      })() + AI_NOTE);
    return h + '</main><div class="minibar" id="miniBar"><div class="mb-in"><a class="mb1" href="' + EXTEND + '" target="_blank" rel="noopener noreferrer">사전 연장 신청</a><a class="mb2" href="' + CONSULT + '" target="_blank" rel="noopener noreferrer">리얼 코칭 상담</a></div></div><div class="ctabar" data-item="b-cta" data-name="사전 연장·리얼 코칭 상담 버튼"><a class="cta" id="extendBtn" href="' + EXTEND + '" target="_blank" rel="noopener noreferrer">사전 연장 신청</a><a class="cta cta2" id="consultBtn" href="' + CONSULT + '" target="_blank" rel="noopener noreferrer"><span>리얼 코칭 상담<small>선생님의 자세한 피드백을 듣고, 학습 방향성을 정해 보세요.</small></span></a></div><footer class="pad"><b>내부 검토용 · 학생 ID ' + esc(id) + "</b><span>권한이 있는 팀원 계정으로만 볼 수 있어요. 밖으로 보낼 때는 학생 정보를 꼭 가려 주세요.</span></footer></div>" + levelGuide(p);
  }

  function renderTalk(id, d) {
    var nm = d.name || "학생", p = progress(d.levels), v = facts(d.v), g = facts(d.g), vk = kind(v, RULE.vLow), gk = kind(g, RULE.gLow), end = verdict(d, p, v, vk, g, gk), GR = growthOf(d);
    var lv = LEVELS[p.lv] || { title: "레벨 " + p.lv + " 과정", cefr: "안내 예정" }, gd = GUIDE[p.lv] || { goal: "" }, nx = LEVELS[p.lv + 1], N = d.notes;
    var VW = { word: "단어", block: "레슨에서 배운 단어", solo: "독립 어휘 작성률", acc: "어휘 작성률" }, GW = { word: "문장", block: "레슨에서 배운 문장", solo: "독립 문장 작성률", acc: "문장 작성률" };
    var tabs = [["summary", "요약"], ["vocab", "어휘"], ["gram", "문법"], ["total", "총평"]];
    var h = '<div class="app rp"><header class="top pad"><img src="img/logo_dark.png" alt="리얼 아카데미"><i class="rule"></i><span>GV 라이팅</span>' +
      '<button type="button" class="test" id="chatOpen" aria-haspopup="dialog">피드백 <b id="chatCount">0</b></button></header>' +
      '<nav class="tabbar pad" aria-label="리포트 탭"><div class="tabs" role="tablist">' +
      tabs.map(function (t, i) { return '<button type="button" role="tab" id="t-' + t[0] + '" aria-controls="p-' + t[0] + '" aria-selected="' + (i ? "false" : "true") + '"' + (i ? ' tabindex="-1"' : "") + ">" + t[1] + "</button>"; }).join("") + "</div></nav><main>";
    function panel(k, body) { return '<div class="panel" role="tabpanel" id="p-' + k + '" aria-labelledby="t-' + k + '" tabindex="0"' + (k === "summary" ? "" : " hidden") + ">" + body + "</div>"; }
    function area(go, k, f, w) {
      return '<button type="button" class="area" data-go="' + go + '"><span class="area-h"><b>' + k + "</b><span>" + w.acc + " <strong>" + p1(f.okP) + "</strong></span>" + CHEV + "</span>" + stack(f) + "</button>";
    }
    var stat = '<div class="stats">' + (d.access ? "<div><span>앱 접속일</span><b>" + num(d.access) + "<small>일</small></b></div>" : "") + "<div><span>학습일</span><b>" + num(d.days) + "<small>일</small></b></div>" +
      (d.access ? '<div><span>학습일 비율</span><b>' + pc(d.days / d.access * 100) + "</b></div>" : "") + "</div>";

    h += panel("summary",
      '<section class="hero" data-item="talk-sum" data-name="종합 결과"><div class="hero-t"><div><p class="hero-k">GV 라이팅 학습 리포트</p><h1>' + esc(nm) + '</h1><p class="hero-s">' + months(d.period) + '개월 동안, 우리&nbsp;자녀의 <b>영어로 표현하는&nbsp;힘</b>은 어떻게 성장해&nbsp;왔을까요?</p></div><img src="img/echo_thumb.png" alt="" width="82" height="120"></div>' +
      '<dl><div><dt>현재 레벨</dt><dd>레벨 ' + p.lv + " " + (p.full ? "학습 완료" : "학습 중") + "</dd></div><div><dt>학습 기간</dt><dd>" + esc(d.period.join(" – ")) + "</dd></div></dl></section>" +
      sec("talk-level", "학습 레벨", "학습 레벨", "", levelPath(d, p) +
        '<div class="lvnow"><p class="lvnow-t"><b>레벨 ' + p.lv + "</b>" + esc(lv.title) + '</p><p class="lvnow-g">' + esc(gd.goal) + "</p></div>" +
        '<dl class="rows">' + (p.done.length ? "<div><dt>학습 완료</dt><dd>레벨 " + p.done.join(" · ") + "</dd></div>" : "") +
        "<div><dt>레벨 " + p.lv + " 진도</dt><dd>" + RULE.lesson + "개 레슨 중 " + p.n + "개 <em>" + p1(p.n / RULE.lesson * 100).replace(".0%", "%") + "</em></dd></div>" + (d.levels.length > 1 ? "<div><dt>누적 완료 레슨</dt><dd>" + num(d.lessons) + "개</dd></div>" : "") + "<div><dt>CEFR <button type=\"button\" class=\"qm\" data-pop=\"cefr\" aria-label=\"CEFR 설명 보기\" aria-haspopup=\"dialog\">?</button></dt><dd>" + esc(lv.cefr) + "</dd></div></dl>" +
        (p.others.length ? '<p class="cap">이 밖에 ' + p.others.map(function (x) { return "레벨 " + x[0] + " 레슨 " + x[1] + "개"; }).join(", ") + "를 학습했어요.</p>" : "") +
        '<button type="button" class="lnk" id="lvOpen" aria-haspopup="dialog">레벨별 학습 내용<svg width="14" height="14" aria-hidden="true"><use href="#chev"/></svg></button>') +
      sec("talk-days", "학습 참여", "학습 참여", "", stat + '<p class="cap">학습일 비율은 앱에 접속한 날 중 학습한 날의 비율이에요. GV 라이팅이 아닌 학습을 한 날도 포함돼요.</p>') +
      sec("talk-areas", "영역별 결과", "영역별 결과", esc(end.head), area("vocab", "어휘 (V-block)", v, VW) + area("gram", "문법 (G-block)", g, GW) +
        '<p class="lgd">' + SEG.map(function (s) { return '<span><i class="' + s[0] + '"></i>' + s[1] + "</span>"; }).join("") + "</p>"));

    h += panel("vocab", skill("talk-vocab", "어휘 학습 결과", v, vk, VW) + blocks("talk-vblock", d.vb, "V-block", "필수 단어"));

    h += panel("gram", skill("talk-gram", "문법 학습 결과", g, gk, GW) + blocks("talk-gblock", d.gb, "G-block", "문장 패턴") +
      (N ? sec("talk-notes", "작성 문장 비교", "작성 문장 비교", "피드백을 받기 전, 처음 제출한 문장이에요.",
        '<div class="noteband">' + wrote("then", N.first) + wrote("now", N.recent) + '</div><div class="cmt">' + N.say.split("\n").map(function (t) { return "<p>" + rich(t) + "</p>"; }).join("") + "</div>") : ""));

    h += panel("total",
      sec("talk-lia", "리아 선생님의 한마디", "리아 선생님의 한마디", "", '<div class="v-memo">' + end.say.map(function (s) { return "<p>" + esc(s).replace(/(단어|문장) (\d)/g, "$1&nbsp;$2").replace(/(\d+(?:\.\d+)?%의 (?:단어|문장)|아주 훌륭해요|더 높은 수준의 학습|잘하고 있어요|힌트를 열기 전에 먼저 써 보면|배운 레슨을 복습하면)/g, "<mark>$1</mark>") + "</p>"; }).join("") + "</div>" +
        '<div class="pair2"><div><span>' + end.good[0] + "</span><b>" + esc(end.good[1]) + '</b></div><div class="nx"><span>' + end.next[0] + "</span><b>" + esc(end.next[1]) + "</b></div></div>") +
      (p.lv < 9 ? sec("talk-next", "다음 학습 과정", "다음 학습 과정", "", nx ?
        '<div class="lvnow"><p class="lvnow-t"><b>레벨 ' + (p.lv + 1) + "</b>" + esc(nx.title) + '</p><p class="lvnow-g">' + esc(GUIDE[p.lv + 1].goal) + '</p></div><div class="exbox"><span>이런 표현을 배워요</span><p lang="en">' + esc(nx.rep) + "</p><small>" + esc(GUIDE[p.lv + 1].ko) + "</small></div>" +
        (p.full ? "" : '<p class="cap">레벨 ' + p.lv + "의 남은 레슨은 " + (RULE.lesson - p.n) + "개예요.</p>") : '<p class="lvnow-g">레벨 9의 학습 내용은 2027년 상반기에 안내해 드릴 예정이에요.</p>') : "") +
      sec("talk-recs", "추천 학습", "추천 학습", "", '<ol class="recs">' + end.recs.map(function (r) { return "<li>" + recIcon(r[0]) + "<b>" + esc(r[0]) + "</b><span>" + esc(r[1]) + "</span></li>"; }).join("") + '</ol><p class="live-n">' + LIVE_NOTE + "</p>" + AI_NOTE));

    return h + '</main><div class="ctabar" data-item="talk-cta" data-name="학습 상담 버튼"><a class="cta" id="consultBtn" href="' + CONSULT + '" target="_blank" rel="noopener noreferrer">학습 상담 신청</a></div><footer class="pad"><b>내부 검토용 · 학생 ID ' + esc(id) + "</b><span>권한이 있는 팀원 계정으로만 볼 수 있어요. 밖으로 보낼 때는 학생 정보를 꼭 가려 주세요.</span></footer></div>" + levelGuide(p);
  }

  function jo(n, a, b) { return "136780".indexOf(String(n).slice(-1)) >= 0 ? a : b; } /* 숫자 뒤 조사 */

  window.renderReport = function (id, d) {
    if (d.template === "talk") return renderB(id, d); /* B안 확정. A안(renderTalk)은 예비로 남겨 둔다 */
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
