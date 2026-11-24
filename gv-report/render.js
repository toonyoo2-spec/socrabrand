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
     문체: 제목은 지표명, 해설은 합니다체. 질문형 제목, 비유, 감정 표현을 쓰지 않는다.
     레벨 설명은 「GV 라이팅 레벨 가이드」 PDF 문장을 따른다. */
  var RULE = {
    lesson: 60,        /* 레벨마다 레슨 수 */
    cur: 10,           /* 완료 레슨이 이 수 이하인 레벨은 대표 레벨로 보지 않는다 (11/23 합의) */
    near: 10,          /* 레슨 수 차이가 이 이하면 더 높은 레벨을 대표로 (11/20 합의) */
    gap: 10,           /* 정확도 - 독립 수행률(%p)이 이 이상이면 힌트 사용이 많은 것으로 본다 (임시) */
    vLow: 60, gLow: 50 /* 정확도가 이 아래면 정확도 보완 대상 (임시) */
  };
  var STAGES = [[1, 3, "문장에서 짧은 문단으로"], [4, 5, "구체적인 표현과 생각의 연결"], [6, 8, "원인·이슈·제안으로 확장"]];
  var GUIDE = {
    1: { ko: "저는 달리기를 좋아해요. 언니와 함께 달려요.", goal: "기본 어순을 이해하고 자신과 일상을 짧고 완결된 문장으로 표현합니다.", gr: "기본 문장 구조, 주어에 따른 동사 형태, 현재·과거·미래 시제" },
    2: { ko: "저는 남동생과 동물원에 갔어요. 우리는 그곳에서 두 시간 동안 머물렀어요.", goal: "시간·장소·빈도 등의 정보를 더해 의미가 구체적인 문장으로 표현합니다.", gr: "부사와 부사구, 현재·과거·미래 시제와 진행형" },
    3: { ko: "제가 가장 좋아하는 계절은 겨울이에요. 눈 속에서 놀 수 있어서 겨울을 좋아해요. 예를 들어, 친구들과 눈사람 만드는 것을 좋아해요.", goal: "이유·예시·대조의 연결 표현을 활용해 하나의 주제로 이어지는 짧은 문단을 완성합니다.", gr: "접속사와 접속부사(이유·대조·예시)" },
    4: { ko: "리아는 쿠키를 가지려고 하다가, 어떻게 된 건지도 모르게 아주 높이 올라가요.", goal: "특징, 행동의 이유와 결과를 덧붙인 문장을 쓰고 이를 이어 짧은 글로 구성합니다.", gr: "to부정사와 동명사, 시간·이유·대조 접속 표현" },
    5: { ko: "일찍 일어나는 사람들은 시간이 더 많아서 스트레스를 덜 받아요.", goal: "의견을 이유로 뒷받침하고 도입-본문-결론의 흐름에 맞게 표현합니다.", gr: "이유·조건·대조 접속 표현, 비교급·최상급, 결론을 이끄는 연결어" },
    6: { ko: "효율적인 대중교통은 도로 위 자동차 수를 줄이고, 이는 대기 오염을 낮춥니다.", goal: "원인과 결과를 논리적으로 연결하고 행동이나 경험의 의미와 영향을 설명합니다.", gr: "복합적인 절 연결, 가정 표현, 대조·양보 표현" },
    7: { ko: "패스트패션 기업들이 계속 이익을 내는 동안, 그 뒤에서 사람들이 치르는 대가는 외면당하고 있습니다.", goal: "다양한 이슈에 대한 설명과 자신의 의견을 구분해 근거와 함께 표현합니다.", gr: "주제별 어휘, 대조·양보 표현, 수동태, 과거완료" },
    8: { ko: "주민과 기술 산업 모두에게 도움이 되도록 규제가 마련되어야 합니다.", goal: "복잡한 내용을 설명하고 원인·목적·기대 효과를 연결해 대응 방향을 제안합니다.", gr: "전문 어휘, 조동사 수동태, 분사 수식, 강조구문" }
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
  function comment(f, k, w) {
    var left = !f.hint ? "정답 " + num(f.ok) + "문항을 모두 힌트 없이 썼습니다." : "정답 " + num(f.ok) + "문항 중 " + num(f.solo) + "문항을 힌트 없이 썼습니다.";
    if (k === "hint") return [left, "힌트를 열기 전에 " + w.word + josa(w.word, "을", "를") + " 먼저 써 보는 연습이 필요합니다."];
    if (k === "low") return [left, "첫 시도에 틀린 " + num(f.no) + "문항을 복습해 정확도를 높이는 단계입니다."];
    return [left, "힌트에 의존하지 않고 " + w.word + josa(w.word, "을", "를") + " 쓰고 있습니다."];
  }
  function verdict(p, v, vk, g, gk) {
    var KE = ["다이어리 (한→영)", "우리말 문장을 보고 힌트 없이 영어로 옮겨 쓰는 연습입니다."], FR = ["다이어리 (자유 쓰기)", "배운 표현으로 자신의 생각을 영어로 쓰는 연습입니다."];
    var DR = ["에코런 단어 연습", "배운 단어를 반복해 쓰며 철자를 익히는 연습입니다."], GM = ["GV 마스터", "레슨에서 배운 문장 패턴과 단어를 다시 쓰는 복습입니다."];
    var did = p.full ? "레벨 " + p.lv + " 학습 완료" : "레벨 " + p.lv + " 레슨 " + p.n + "개 완료";
    if (vk === "low" || gk === "low") {
      var both = vk === "low" && gk === "low", w = both ? "단어와 문장" : gk === "low" ? "문장" : "단어";
      return { head: w + (both ? "을" : josa(w, "을", "를")) + " 정확하게 쓰는 연습이 더 필요합니다.", good: ["학습 진도", did], next: ["보완할 점", w + " 정확도"],
        say: ["첫 시도 정확도는 단어 " + p1(v.okP) + ", 문장 " + p1(g.okP) + "입니다.", "새 레슨과 함께 이미 배운 레슨의 복습을 권해 드립니다."].concat(vk === "hint" || gk === "hint" ? ["답을 쓸 때는 힌트를 열기 전에 먼저 써 보는 연습이 필요합니다."] : []),
        recs: [KE, gk === "low" ? GM : DR] };
    }
    if (vk === "hint" && gk === "hint") return { head: "단어와 문장을 쓸 때 힌트를 함께 사용하고 있습니다.", good: ["학습 진도", did], next: ["보완할 점", "힌트 없이 쓰기"],
      say: ["첫 시도 정확도는 단어 " + p1(v.okP) + ", 문장 " + p1(g.okP) + "입니다.", "힌트 없이 맞힌 비율은 단어 " + p1(v.soloP) + ", 문장 " + p1(g.soloP) + (v.solo < v.ok / 2 && g.solo < g.ok / 2 ? "로, 힌트를 사용해 맞힌 답안이 더 많습니다." : "입니다."), "힌트를 열기 전에 먼저 써 보는 연습을 권해 드립니다."], recs: [KE, g.soloP <= v.soloP ? GM : DR] };
    if (vk === "hint") return { head: "문장은 힌트 없이 쓰고, 단어는 힌트를 함께 사용하고 있습니다.", good: ["강점", "힌트 없이 문장 쓰기"], next: ["보완할 점", "힌트 없이 단어 쓰기"],
      say: ["문장 문항의 " + p1(g.soloP) + "를 힌트 없이 맞혔습니다.", "단어 문항은 힌트 없이 맞힌 비율이 " + p1(v.soloP) + "로, 문장보다 힌트를 자주 사용합니다.", "단어를 쓸 때 힌트를 열기 전에 먼저 써 보는 연습을 권해 드립니다."], recs: [KE, DR] };
    if (gk === "hint") return { head: "단어는 힌트 없이 쓰고, 문장은 힌트를 함께 사용하고 있습니다.", good: ["강점", "힌트 없이 단어 쓰기"], next: ["보완할 점", "힌트 없이 문장 쓰기"],
      say: ["단어 문항의 " + p1(v.soloP) + "를 힌트 없이 맞혔습니다.", "문장 문항은 힌트 없이 맞힌 비율이 " + p1(g.soloP) + "로, 단어보다 힌트를 자주 사용합니다.", "문장을 쓸 때 힌트를 열기 전에 먼저 써 보는 연습을 권해 드립니다."], recs: [KE, GM] };
    return { head: "단어와 문장을 힌트 없이 쓰고 있습니다.", good: ["강점", "힌트 없이 단어·문장 쓰기"], next: ["다음 단계", "배운 표현으로 생각 쓰기"],
      say: ["힌트 없이 맞힌 비율은 단어 " + p1(v.soloP) + ", 문장 " + p1(g.soloP) + "입니다.", "배운 표현을 활용해 자신의 생각을 쓰는 연습을 권해 드립니다."],
      recs: [FR, p.full && p.lv >= 8 ? GM : p.full ? ["레벨 " + (p.lv + 1) + " 레슨", "다음 레벨의 레슨을 학습합니다."] : ["레벨 " + p.lv + " 다음 레슨", "현재 레벨의 남은 레슨 " + (RULE.lesson - p.n) + "개를 이어서 학습합니다."]] };
  }
  /* 첫 시도 결과 막대: 힌트 없이 정답 · 힌트 사용 정답 · 오답을 한 줄로 */
  var SEG = [["solo", "힌트 없이 정답"], ["hint", "힌트 사용 정답"], ["no", "첫 시도 오답"]];
  function stack(f, big) {
    return '<span class="stk' + (big ? " big" : "") + '" role="img" aria-label="' + esc(SEG.map(function (s) { return s[1] + " " + p1(f.pct[s[0]]); }).join(", ")) + '">' +
      SEG.map(function (s) { return f[s[0]] ? '<i class="' + s[0] + '" style="flex-grow:' + f[s[0]] + '" title="' + esc(s[1] + " " + num(f[s[0]]) + "문항 (" + p1(f.pct[s[0]]) + ")") + '"></i>' : ""; }).join("") + "</span>";
  }
  function sec(key, name, title, sub, body) {
    return '<section class="sec" data-item="' + key + '" data-name="' + esc(name) + '"><h2>' + esc(title) + "</h2>" + (sub ? '<p class="sub">' + sub + "</p>" : "") + body + "</section>";
  }
  function skill(key, title, f, k, w) {
    return sec(key, title, title, w.block + " 쓰기 " + num(f.q) + "문항의 첫 시도 결과입니다.",
      '<div class="figs"><div class="on"><span>' + w.solo + "</span><b>" + pc(f.soloP) + "</b><small>힌트 없이 맞힌 비율</small></div><div><span>" + w.acc + "</span><b>" + pc(f.okP) + "</b><small>힌트 사용을 포함한 비율</small></div></div>" +
      stack(f, true) + '<table class="stk-t"><caption>' + esc(title) + " 상세</caption><tbody>" +
      SEG.map(function (s) { return '<tr><th scope="row"><i class="' + s[0] + '"></i>' + s[1] + "</th><td>" + num(f[s[0]]) + "문항</td><td>" + p1(f.pct[s[0]]) + "</td></tr>"; }).join("") + "</tbody></table>" +
      '<div class="cmt">' + comment(f, k, w).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div>");
  }
  function blocks(key, b, code, what) {
    var P = b[0] ? b[1] / b[0] * 100 : 0;
    return sec(key, code + " 학습 현황", code + " 학습 현황", code + "은 레슨에서 배우는 " + what + "입니다.",
      '<div class="figs"><div class="on"><span>마스터</span><b>' + num(b[1]) + "<small>개</small></b><small>블록 점수 80점 이상</small></div><div><span>획득</span><b>" + num(b[0]) + "<small>개</small></b><small>학습 기록이 있는 블록</small></div></div>" +
      '<span class="stk" role="img" aria-label="' + esc("획득 " + b[0] + "개 중 마스터 " + b[1] + "개") + '"><i class="solo" style="flex-grow:' + b[1] + '"></i>' + (b[0] > b[1] ? '<i class="no" style="flex-grow:' + (b[0] - b[1]) + '"></i>' : "") + "</span>" +
      '<p class="cap">획득한 블록의 ' + p1(P) + "를 마스터했습니다. 블록 점수는 복습에 따라 달라질 수 있습니다.</p>");
  }
  function levelPath(d, p) {
    var by = {}; d.levels.forEach(function (x) { by[x[0]] = x[1]; });
    var cells = "", i;
    for (i = 1; i <= 8; i++) cells += '<li class="' + (i === p.lv ? "cur" : "") + '"><i><u style="width:' + Math.min(100, (by[i] || 0) / RULE.lesson * 100).toFixed(1) + '%"></u></i><b>' + i + "</b></li>";
    return '<ol class="path" aria-label="' + esc("GV 라이팅 레벨 1부터 8 중 레벨 " + p.lv) + '">' + cells + '</ol><div class="stages">' +
      STAGES.map(function (s) { return '<span style="grid-column:span ' + (s[1] - s[0] + 1) + '"' + (p.lv >= s[0] && p.lv <= s[1] ? ' class="cur"' : "") + ">" + s[2] + "</span>"; }).join("") + "</div>";
  }
  function levelGuide(p) {
    return '<div class="sheet-bg" id="lvBg" hidden></div><div class="sheet lvg" id="lvSheet" role="dialog" aria-modal="true" aria-labelledby="lvTitle" hidden><div class="sheet-in">' +
      '<div class="sheet-head"><b id="lvTitle">GV 라이팅 레벨별 학습 내용</b><button type="button" id="lvClose" aria-label="닫기"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>' +
      '<div class="sheet-body" data-item="level">' + STAGES.map(function (s) {
        var h = '<h3>' + s[2] + '</h3><ul class="lvg-l">', i;
        for (i = s[0]; i <= s[1]; i++) {
          var st = i === p.lv ? (p.full ? "학습 완료" : "학습 중") : p.allDone.indexOf(i) >= 0 ? "학습 완료" : "";
          h += '<li' + (i === p.lv ? ' class="cur" aria-current="step"' : "") + '><details' + (i === p.lv ? " open" : "") + '><summary><b>레벨 ' + i + '</b><span>' + esc(LEVELS[i].short) + "</span>" + (st ? "<em>" + st + "</em>" : "") + '<svg width="14" height="14" aria-hidden="true"><use href="#chev"/></svg></summary>' +
            '<dl><div><dt>CEFR · 참고 학년</dt><dd>' + esc(LEVELS[i].cefr + " · " + LEVELS[i].grade) + "</dd></div><div><dt>학습 목표</dt><dd>" + esc(GUIDE[i].goal) + "</dd></div><div><dt>주요 문법</dt><dd>" + esc(GUIDE[i].gr) + "</dd></div><div><dt>대표 문장</dt><dd lang=\"en\">" + esc(LEVELS[i].rep) + "<small lang=\"ko\">" + esc(GUIDE[i].ko) + "</small></dd></div></dl></details></li>";
        }
        return h + "</ul>";
      }).join("") + '<p class="fnote">레벨과 학교 학년은 일대일로 대응하지 않습니다. 학년은 참고 기준입니다.</p></div></div></div>';
  }
  function wrote(n) {
    return '<div class="wr"><div class="wr-h"><b>' + esc(n.label) + "</b><span>" + esc(n.lesson + " · " + n.date) + '</span></div><p class="wr-t">' + esc(n.title) + "</p><ol>" + n.lines.map(function (l) {
      return '<li><p class="ko">' + esc(l[1]) + '</p><p class="en" lang="en">' + rich(l[0]) + "</p>" + (l[2] ? '<p class="cor" lang="en"><em lang="ko">교정</em>' + rich(l[2]) + "</p>" : "") + "</li>";
    }).join("") + "</ol></div>";
  }
  function renderTalk(id, d) {
    var nm = d.name || "학생", p = progress(d.levels), v = facts(d.v), g = facts(d.g), vk = kind(v, RULE.vLow), gk = kind(g, RULE.gLow), end = verdict(p, v, vk, g, gk);
    var lv = LEVELS[p.lv] || LEVELS[1], gd = GUIDE[p.lv] || GUIDE[1], N = d.notes;
    var VW = { word: "단어", block: "레슨에서 배운 단어", solo: "독립 어휘 작성률", acc: "어휘 정확도" }, GW = { word: "문장", block: "레슨에서 배운 문장", solo: "독립 문장 완성률", acc: "문장 정확도" };
    var tabs = [["summary", "요약"], ["vocab", "어휘"], ["gram", "문법"], ["total", "총평"]];
    var h = '<div class="app rp"><header class="top pad"><img src="img/logo_dark.png" alt="리얼 아카데미"><i class="rule"></i><span>GV 라이팅</span>' +
      '<button type="button" class="test" id="chatOpen" aria-haspopup="dialog">피드백 <b id="chatCount">0</b></button></header>' +
      '<nav class="tabbar pad" aria-label="리포트 탭"><div class="tabs" role="tablist">' +
      tabs.map(function (t, i) { return '<button type="button" role="tab" id="t-' + t[0] + '" aria-controls="p-' + t[0] + '" aria-selected="' + (i ? "false" : "true") + '"' + (i ? ' tabindex="-1"' : "") + ">" + t[1] + "</button>"; }).join("") + "</div></nav><main>";
    function panel(k, body) { return '<div class="panel" role="tabpanel" id="p-' + k + '" aria-labelledby="t-' + k + '" tabindex="0"' + (k === "summary" ? "" : " hidden") + ">" + body + "</div>"; }
    function area(go, k, f, w) {
      return '<button type="button" class="area" data-go="' + go + '"><span class="area-h"><b>' + k + "</b><span>" + w.solo + " <strong>" + p1(f.soloP) + "</strong></span>" + CHEV + "</span>" + stack(f) + '<span class="area-f">' + "힌트 사용 포함 " + w.acc + " " + p1(f.okP) + "</span></button>";
    }
    var stat = '<div class="stats">' + (d.access ? "<div><span>앱 접속일</span><b>" + num(d.access) + "<small>일</small></b></div>" : "") + "<div><span>학습일</span><b>" + num(d.days) + "<small>일</small></b></div>" +
      (d.access ? '<div><span>학습일 비율</span><b>' + pc(d.days / d.access * 100) + "</b></div>" : "") + "</div>";

    h += panel("summary",
      '<section class="hero" data-item="talk-sum" data-name="종합 결과"><div class="hero-t"><div><p class="hero-k">GV 라이팅 학습 리포트</p><h1>' + esc(nm) + '</h1><p class="hero-s">' + esc(end.head).replace(/힌트 없이/g, "힌트&nbsp;없이").replace(/쓸 때/g, "쓸&nbsp;때") + '</p></div><img src="img/echo_thumb.png" alt="" width="82" height="120"></div>' +
      '<dl><div><dt>현재 레벨</dt><dd>레벨 ' + p.lv + " " + (p.full ? "학습 완료" : "학습 중") + "</dd></div><div><dt>학습 기간</dt><dd>" + esc(d.period.join(" – ")) + "</dd></div></dl></section>" +
      sec("talk-level", "학습 레벨", "학습 레벨", "", levelPath(d, p) +
        '<div class="lvnow"><p class="lvnow-t"><b>레벨 ' + p.lv + "</b>" + esc(lv.title) + '</p><p class="lvnow-g">' + esc(gd.goal) + "</p></div>" +
        '<dl class="rows">' + (p.done.length ? "<div><dt>학습 완료</dt><dd>레벨 " + p.done.join(" · ") + "</dd></div>" : "") +
        "<div><dt>레벨 " + p.lv + " 진도</dt><dd>" + RULE.lesson + "개 레슨 중 " + p.n + "개 <em>" + p1(p.n / RULE.lesson * 100).replace(".0%", "%") + "</em></dd></div>" + (d.levels.length > 1 ? "<div><dt>누적 완료 레슨</dt><dd>" + num(d.lessons) + "개</dd></div>" : "") + "<div><dt>CEFR</dt><dd>" + esc(lv.cefr) + "</dd></div></dl>" +
        (p.others.length ? '<p class="cap">이 밖에 ' + p.others.map(function (x) { return "레벨 " + x[0] + " 레슨 " + x[1] + "개"; }).join(", ") + "를 학습했습니다.</p>" : "") +
        '<button type="button" class="lnk" id="lvOpen" aria-haspopup="dialog">레벨별 학습 내용<svg width="14" height="14" aria-hidden="true"><use href="#chev"/></svg></button>') +
      sec("talk-days", "학습 참여", "학습 참여", "", stat + '<p class="cap">학습일 비율은 앱에 접속한 날 중 학습한 날의 비율이며, 학습일에는 GV 라이팅 외 앱 학습이 포함됩니다.</p>') +
      sec("talk-areas", "영역별 결과", "영역별 결과", "레슨 문항을 처음 풀었을 때의 결과입니다.", area("vocab", "어휘", v, VW) + area("gram", "문법", g, GW) +
        '<p class="lgd">' + SEG.map(function (s) { return '<span><i class="' + s[0] + '"></i>' + s[1] + "</span>"; }).join("") + "</p>"));

    h += panel("vocab", skill("talk-vocab", "어휘 학습 결과", v, vk, VW) + blocks("talk-vblock", d.vb, "V-block", "필수 단어"));

    h += panel("gram", skill("talk-gram", "문법 학습 결과", g, gk, GW) + blocks("talk-gblock", d.gb, "G-block", "문장 패턴") +
      (N ? sec("talk-notes", "작성 문장 비교", "작성 문장 비교", "피드백 전 처음 제출한 문장입니다.",
        '<p class="lgd top">' + (JSON.stringify(N).indexOf("{{") >= 0 ? '<span><i class="mk"></i>한국어로 쓴 부분</span>' : "") + '<span><i class="ul"></i>교정할 부분</span></p>' + wrote(N.first) + wrote(N.recent) + '<div class="cmt">' + N.say.split("\n").map(function (t) { return "<p>" + rich(t) + "</p>"; }).join("") + "</div>") : ""));

    h += panel("total",
      sec("talk-lia", "리아 선생님의 한마디", "리아 선생님의 한마디", "", '<div class="op">' + end.say.map(function (s) { return "<p>" + esc(s).replace(/(단어|문장) (\d)/g, "$1&nbsp;$2") + "</p>"; }).join("") + "</div>" +
        '<div class="pair2"><div><span>' + end.good[0] + "</span><b>" + esc(end.good[1]) + '</b></div><div class="nx"><span>' + end.next[0] + "</span><b>" + esc(end.next[1]) + "</b></div></div>") +
      (LEVELS[p.lv + 1] ? sec("talk-next", "다음 학습 과정", "다음 학습 과정", "", '<div class="lvnow"><p class="lvnow-t"><b>레벨 ' + (p.lv + 1) + "</b>" + esc(LEVELS[p.lv + 1].title) + '</p><p class="lvnow-g">' + esc(GUIDE[p.lv + 1].goal) + "</p></div>" +
        (p.full ? "" : '<p class="cap">레벨 ' + p.lv + "의 남은 레슨 " + (RULE.lesson - p.n) + "개를 마친 뒤 학습하는 과정입니다.</p>")) : "") +
      sec("talk-recs", "추천 보완 학습", "추천 보완 학습", "", '<ol class="recs">' + end.recs.map(function (r) { return "<li><b>" + esc(r[0]) + "</b><span>" + esc(r[1]) + "</span></li>"; }).join("") + "</ol>" +
        '<button type="button" class="cta" id="consultBtn">학습 상담 신청</button><p class="cap c">세부 학습 계획은 학습 상담에서 안내해 드립니다.</p>' + AI_NOTE));

    return h + '</main><footer class="pad"><b>내부 검토용 · 학생 ID ' + esc(id) + "</b><span>권한이 있는 팀원 계정으로만 볼 수 있어요. 밖으로 보낼 때는 학생 정보를 꼭 가려 주세요.</span></footer></div>" + levelGuide(p);
  }

  function jo(n, a, b) { return "136780".indexOf(String(n).slice(-1)) >= 0 ? a : b; } /* 숫자 뒤 조사 */

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
