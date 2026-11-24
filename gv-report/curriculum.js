/* 리얼 아카데미 커리큘럼 팝업 (브로슈어 커리큘럼-ⓐ_260928). 문구는 브로슈어 그대로이니 고치지 않는다. 배치만 단계별로 다시 했다 */
(function () {
  var G = [["저학년", "(미취학 ~ 초등 1학년)"], ["저학년 ~ 고학년", "(초등 1학년 ~ 3학년)"], ["고학년", "(초등 3학년 이상)"]];
  var L = [
    { n: "Starter", g: 0, c: "Pre - A1", ge: "Pre - K", t: [["-"]], live: "알파벳과 단어를 익히고 말해 보며 영어의 기초를 다져요.", e: ["d"], m: ["초급"] },
    { n: "Beginner", g: 1, c: "A1 Basic ~ A1 Plus", ge: "Grade K - 1", t: [["TOEFL Primary Step 1", "(R+L 202~212)"]], gv: [0, 1], live: "기초 문장 패턴을 익히고 친숙한 주제로 말해요.", e: ["d", "c"], m: ["초급"] },
    { n: "Intermediate", g: 2, c: "A2 Basic ~ A2 Plus", ge: "Grade 2 - 3", t: [["TOEFL Primary Step 1", "(R+L 213~218)"], ["TOEFL Primary Step 2", "(R+L 208~218)"]], gv: [2, 3], live: "다양한 문법과 생활 영어를 활용해 더 풍부한 문장으로 말해요.", e: ["d", "c"], m: ["중급"] },
    { n: "Advanced", g: 2, c: "B1 Basic ~ B1 Plus", ge: "Grade 4 - 5", t: [["TOEFL Primary Step 2", "(R+L 219~230)"], ["TOEFL Junior Basic", "(R+L+LF 700~784)"]], gv: [4], live: "긴 글과 대화를 이해하고, 주제에 대해 자신의 생각을 표현해요.", e: ["d", "c"], m: ["중급", "고급"], ml: ["레벨 5", "레벨 6"] },
    { n: "Master", g: 2, c: "B2 Basic ~ B2 Plus", ge: "Grade 6+", t: [["TOEFL Junior Intermediate", "(R+L+LF 785~849)"], ["TOEFL Junior Advanced", "(R+L+LF 850+)"]], gv: [5, 6], live: "고난도 학업 영어를 이해하고 논리적으로 의견을 나눠요.", e: ["c"], m: ["고급"] }];
  var GV = [[[["레벨 1", "문장 기초"]], "자기소개<br>일상생활"], [[["레벨 2", "문장 강화"]], "취미와 여가<br>학교 생활"], [[["레벨 3", "단락 기초"]], "선택과 그 이유<br>상상과 미래"], [[["레벨 4", "단락 강화"]], "스토리 요약 정리<br>인물의 성격 분석"], [[["레벨 5", "에세이 기초"], ["레벨 6", "에세이 강화"]], "환경을 보호하는 방법<br>미래 세상 상상하기"], [[["레벨 7", "에세이 응용"], ["레벨 8", "에세이 완성"]], "기술과 미디어가 사회에 미치는 영향<br>사회와 환경의 상호 관계"], [[["레벨 9", "에세이 마스터"]], "사회 문제에 대한 나만의 결론 도출"]];
  var E = { d: ["드릴링", "단어만 바꿔 같은 패턴을 반복하며 문장 구조를 몸에 익히는 연습"], c: ["체이닝", "짧은 문장에 표현을 하나씩 덧붙여 점점 긴 문장을 완성해가는 연습"] };
  var M = { "초급": "나를 소개하며 첫 대화를 시작하는 단계", "중급": "주제를 정해 묻고 답하며 대화를 이어가는 단계", "고급": "다양한 주제에 대해서 자유롭게 대화하는 단계" };
  var X = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function h3(t, img) { return "<h3>" + (img ? '<img src="img/cur_' + img + '.png" alt="">' : "") + t + "</h3>"; }
  function box(t, p, x) { return '<div class="cu-bx"><h4>' + t + (x ? "<i>" + x + "</i>" : "") + "</h4>" + p + "</div>"; }
  function gv(i) { return '<div class="cu-gv"><div>' + GV[i][0].map(function (x) { return "<p><b>" + x[0] + "</b><span>" + x[1] + "</span></p>"; }).join("") + '</div><p class="cu-tp">' + GV[i][1] + "</p></div>"; }
  function panel(l, i, on) {
    return '<div class="cu-pn" id="cup-' + i + '" style="--c:var(--cu' + (i + 1) + ')"' + (on ? "" : " hidden") + '><div class="cu-top"><div><h4>' + l.n + "</h4><p>" + G[l.g][0] + ' <span>' + G[l.g][1] + '</span></p></div><i><img src="img/cur_i' + (i + 1) + '.png" alt=""></i></div>' +
      '<dl class="cu-dl"><div><dt>CEFR<span>(유럽 기준)</span></dt><dd>' + l.c + "</dd></div><div><dt>GE<span>(미국 학년)</span></dt><dd>" + l.ge + "</dd></div><div><dt>TOEFL<span>(토플)</span></dt><dd>" + l.t.map(function (x) { return "<p>" + x[0] + (x[1] ? "<small>" + x[1] + "</small>" : "") + "</p>"; }).join("") + "</dd></div></dl>" +
      h3("아웃풋 프로그램", "book") + (l.gv ? '<p class="cu-gvt">GV 라이팅</p><div class="cu-gvs">' + l.gv.map(gv).join("") + "</div>" : box("GV 스피킹", "<p>읽고, 듣고, 따라 말하며 3번 익히는 영어 애니 그림책 학습</p><p>페파피그, 코니, 아서, 추피, 파자마삼총사, 무민밸리</p>")) +
      h3("라이브", "cam") + box(l.n, "<p>" + l.live + "</p>") + '<a class="cu-qr" href="https://realacademy.link/4fmQkg9?r=qr" target="_blank" rel="noopener noreferrer"><img src="img/cur_qr.png" alt="학기별 수업 시간표 QR"><span><b>학기별 수업 시간표</b>학기별 수업 시간표는 QR에서 확인해 주세요.</span></a>' +
      h3("에코런") + l.e.map(function (k) { return box(E[k][0], "<p>" + E[k][1] + "</p>"); }).join("") +
      h3("스피킹 메이트") + l.m.map(function (k, n) { return box(k, "<p>" + M[k] + "</p>", l.ml && l.ml[n]); }).join("") + "</div>";
  }
  window.curriculumPopup = function (lv) {
    var cur = lv <= 2 ? 1 : lv <= 4 ? 2 : lv <= 6 ? 3 : 4;
    return '<div class="sheet-bg" id="curBg" data-popclose="cur" hidden></div><div class="sheet cu" id="curSheet" role="dialog" aria-modal="true" aria-labelledby="curTitle" hidden><div class="sheet-in"><div class="sheet-head"><img src="img/cur_logo.png" alt=""><b id="curTitle">리얼 아카데미 커리큘럼</b><button type="button" data-popclose="cur" aria-label="닫기">' + X + '</button></div><div class="sheet-body">' +
      '<div class="cu-tb" role="group" aria-label="단계">' + L.map(function (x, k) { return '<button type="button" data-cur="' + k + '" aria-controls="cup-' + k + '" aria-pressed="' + (k === cur) + '" style="--c:var(--cu' + (k + 1) + ')">' + x.n + "</button>"; }).join("") + "</div>" +
      L.map(function (l, i) { return panel(l, i, i === cur); }).join("") + '<p class="cu-fn">※ 레벨표의 학년은 가이드라인이며, 학습자의 개별 성취도에 따라 다를 수 있습니다.</p></div></div></div>';
  };
})();
