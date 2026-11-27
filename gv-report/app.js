/* GV 라이팅 학습 리포트
   - 페이지 파일에는 학생 데이터가 없다. 로그인한 권한 계정만 Supabase에서 리포트 데이터(JSON)를 받고, render.js가 화면을 그린다.
   - 왼쪽: 학생 찾기·만들기와 목록 / 가운데: 리포트 / 오른쪽: 항목별 피드백
   - 로그인 정보는 메인 사이트(socrabrand.cloud)와 같은 저장 키를 써서 함께 유지된다. */
(function () {
  "use strict";
  var API = "https://eoljasmgogdcvnytaoax.supabase.co";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbGphc21nb2dkY3ZueXRhb2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzIwMDEsImV4cCI6MjEwMTQ0ODAwMX0.G8wiFPCgvzoDwGlk__SDkn8SxP6lDMHY6g6pt61-a5o";
  var K = { token: "socra_admin_token", exp: "socra_admin_token_exp", refresh: "socra_refresh_token", uid: "socra_user_id",
            role: "socra_user_role", email: "socra_user_email", name: "socra_user_name", tabs: "socra_visible_tabs" };
  var LIST = "gv_reports?select=id,student_id,status,is_sample,requested_by_name,created_at,name:data->>name,level:data->>level,lessons:data->>lessons,variant:data->>variant,auto:data->>auto,err:data->>build_error&data->>hidden=is.null&order=is_sample.desc,created_at.asc";
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(t) { var d = new Date(t); if (isNaN(d)) return ""; return (d.getMonth() + 1) + "." + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wide = matchMedia("(min-width: 1180px)");
  var toastEl = $("toast"), toastT;
  function toast(m) { toastEl.textContent = m; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2800); }

  /* ---------- 세션 ---------- */
  function token() { return ls(K.token); }
  function saveSession(d) {
    ls(K.token, d.access_token); ls(K.refresh, d.refresh_token);
    ls(K.exp, String(Date.now() + d.expires_in * 1000));
    if (d.user) { ls(K.uid, d.user.id); ls(K.email, d.user.email || ""); }
  }
  async function refresh() {
    var rt = ls(K.refresh); if (!rt) return false;
    try {
      var r = await fetch(API + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: rt }) });
      if (!r.ok) return false;
      saveSession(await r.json()); return true;
    } catch (e) { return false; }
  }
  async function fresh() {
    if (!token()) return false;
    if (Number(ls(K.exp)) - Date.now() < 5 * 60 * 1000) return await refresh();
    return true;
  }
  function clearSession() { Object.keys(K).forEach(function (k) { ls(K[k], null); }); }
  async function api(path, opt) {
    opt = opt || {};
    if (!(await fresh())) throw { auth: true };
    var r = await fetch(API + "/rest/v1/" + path, { method: opt.method || "GET", headers: Object.assign({ apikey: KEY, Authorization: "Bearer " + token(), "Content-Type": "application/json" }, opt.headers || {}), body: opt.body ? JSON.stringify(opt.body) : undefined });
    if (r.status === 401) throw { auth: true };
    if (!r.ok) { var t = await r.text(), j = {}; try { j = JSON.parse(t); } catch (e) {} throw { status: r.status, code: j.code, text: t }; }
    var txt = await r.text();
    return txt ? JSON.parse(txt) : null; /* return=minimal 응답은 본문이 비어 있다 */
  }
  function expired(err) { if (err && err.auth) { clearSession(); showLogin("로그인 시간이 지났어요. 다시 로그인해 주세요."); return true; } return false; }

  /* ---------- 로그인 화면 ---------- */
  function showLogin(err) {
    $("reportWrap").hidden = true; $("gate").hidden = false;
    $("gateLogin").hidden = false; $("gateMsg").hidden = true;
    $("loginErr").textContent = err || ""; setTimeout(function () { $("loginId").focus(); }, 0);
  }
  function showMessage(title, text) {
    $("reportWrap").hidden = true; $("gate").hidden = false;
    $("gateLogin").hidden = true; $("gateMsg").hidden = false;
    $("gateTitle").textContent = title; $("gateText").textContent = text; $("gateList").innerHTML = "";
  }
  function logout() { clearSession(); location.href = location.pathname; }
  $("gateLogout").addEventListener("click", logout);
  $("logoutBtn").addEventListener("click", logout);
  $("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var id = $("loginId").value.trim(), pw = $("loginPw").value;
    if (!id || !pw) { $("loginErr").textContent = "아이디와 비밀번호를 모두 넣어 주세요."; return; }
    if (id.indexOf("@") < 0) id += "@internal.local"; /* 메인 사이트와 같은 규칙 */
    var btn = $("loginBtn"); btn.disabled = true; btn.textContent = "로그인하는 중…"; $("loginErr").textContent = "";
    try {
      var r = await fetch(API + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: id, password: pw }) });
      if (!r.ok) { $("loginErr").textContent = "아이디나 비밀번호가 맞지 않아요. 다시 확인해 주세요."; return; }
      saveSession(await r.json()); $("loginPw").value = "";
      start();
    } catch (err) { $("loginErr").textContent = "인터넷 연결을 확인하고 다시 눌러 주세요."; }
    finally { btn.disabled = false; btn.textContent = "로그인"; }
  });

  /* ---------- 시작 ---------- */
  var reports = [], current = null;
  async function start() {
    if (!token()) return showLogin();
    try { reports = await api(LIST) || []; }
    catch (err) { if (expired(err)) return; return showMessage("목록을 불러오지 못했어요", "잠시 뒤 새로고침해 주세요."); }
    $("gate").hidden = true; $("reportWrap").hidden = false;
    var want = new URLSearchParams(location.search).get("r");
    var first = byId(want) || reports.filter(function (x) { return x.variant === "새 시안"; })[0] || reports.filter(function (x) { return x.is_sample; })[0] || reports.filter(function (x) { return x.status === "ready"; })[0] || reports[0];
    renderList();
    if (first) openReport(first.id, false); else showEmptyCenter();
    pollTimer();
  }
  function byId(id) { return reports.filter(function (x) { return x.id === id; })[0]; }

  /* ---------- 왼쪽: 학생 찾기·만들기와 목록 ---------- */
  var addId = $("addId"), addBtn = $("addBtn"), addMsg = $("addMsg"), rlist = $("rlist"), sampleBox = $("sampleBox");
  var STAR = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l1.9 4 4.3.5-3.2 3 .9 4.3L8 11.1l-3.9 2.2.9-4.3-3.2-3 4.3-.5z" fill="currentColor"/></svg>';
  function say(kind, text) { addMsg.className = "add-msg " + kind; addMsg.textContent = text; addMsg.hidden = !text; }
  function item(x) {
    var ready = x.status === "ready";
    var meta = ready ? "LV " + (x.level || "-") + (x.lessons == null ? "" : " · " + x.lessons + "레슨") : "학습 기록을 기다리는 중";
    return '<li data-row="' + esc(x.id) + '"><button type="button" data-rid="' + esc(x.id) + '"' + (current && current.id === x.id ? ' aria-current="true"' : "") + ">" +
      '<b><span class="nm">' + esc(x.name || "새 학생") + '</span><span class="id">' + esc(x.student_id) + "</span>" + (x.variant && !x.auto ? '<span class="vtag">' + esc(x.variant) + "</span>" : "") + "</b>" +
      '<em class="' + (ready ? "ready" : "wait") + '">' + (ready ? "완성" : "준비 중") + "</em><small>" + esc(meta) + "</small></button>" +
      (x.is_sample || (x.variant === "새 시안" && !x.auto) ? "" : '<button type="button" class="row-del" data-delrow="' + esc(x.id) + '" aria-label="' + esc((x.name || x.student_id) + " 리포트 삭제") + '">삭제</button>') + "</li>";
  }
  function renderList() {
    var isDraft = function (x) { return x.variant === "새 시안" && !x.auto; }; /* 학생 ID로 자동 생성한 리포트는 시안이 아니라 일반 학생 (11/27) */
    var draft = reports.filter(isDraft), others = reports.filter(function (x) { return !isDraft(x); });
    var sample = others.filter(function (x) { return x.is_sample; }), rest = others.filter(function (x) { return !x.is_sample; });
    rest.sort(function (a, b) { return (a.status === b.status ? 0 : a.status === "ready" ? -1 : 1) || String(a.name || "~").localeCompare(String(b.name || "~"), "ko") || a.id.localeCompare(b.id); });
    var draftHtml = draft.length ? '<div class="sample"><span class="sample-tag">' + STAR + "새 시안</span><p>요약·어휘·문법·총평 구성이에요. 학생마다 문구가 어떻게 달라지는지 비교해 보세요.</p><ul class=\"rlist\">" + draft.map(item).join("") + "</ul></div>" : "";
    sampleBox.innerHTML = draftHtml + (sample.length ? '<div class="sample"><span class="sample-tag">' + STAR + (draft.length ? "이전 샘플" : "대표 샘플") + "</span><p>" + (draft.length ? "지난번 시안이에요. 비교할 때 보세요." : "처음 보시는 분은 이 리포트부터 보세요.") + (sample.length > 1 ? " ‘수정 샘플’은 학부모용 화면, ‘지표 전체 보기’는 평가 항목을 모두 펼친 화면이에요." : " 다른 리포트도 같은 기준으로 만들었어요.") + "</p><ul class=\"rlist\">" + sample.map(item).join("") + "</ul></div>" : "");
    $("allLabel").textContent = "전체 학생 " + rest.length + "명"; $("clearAll").hidden = !rest.length;
    rlist.innerHTML = rest.length ? rest.map(item).join("") : '<li class="list-empty">아직 다른 학생이 없어요. 위 칸에 학생 ID를 넣어 만들어 보세요.</li>';
    $("listCount").textContent = "리포트 " + reports.length + "개 · 누르면 가운데에 리포트가 나와요";
    filterList();
  }
  async function delReports(ids, label) {
    if (!confirm(label + "\n지우면 되돌릴 수 없어요.")) return;
    try {
      var n = await api("rpc/gv_reports_delete", { method: "POST", body: { ids: ids } });
      if (current && ids.indexOf(current.id) >= 0) { current = null; showEmptyCenter(); }
      reports = await api(LIST) || []; renderList();
      say("ok", (n || 0) + "명 리포트를 지웠어요.");
    } catch (err) { if (!expired(err)) say("err", "지우지 못했어요. 잠시 뒤 다시 눌러 주세요."); }
  }
  $("listPanel").addEventListener("click", function (e) { var d = e.target.closest("[data-delrow]"); if (!d) return; e.stopPropagation(); var id = d.getAttribute("data-delrow"), x = byId(id); delReports([id], (x && x.name || id) + " (" + (x && x.student_id || id) + ") 리포트를 지울까요?"); }, true);
  /* 전체 학생 모두 삭제: 샘플·새 시안은 남기고, 의견도 함께 지운다 (KWAN 11/27) */
  $("clearAll").addEventListener("click", async function () {
    var ids = reports.filter(function (x) { return !(x.variant === "새 시안" && !x.auto) && !x.is_sample; }).map(function (x) { return x.id; });
    if (!ids.length) return;
    if (!confirm("전체 학생 " + ids.length + "명의 리포트를 모두 지울까요?\n샘플과 새 시안은 남아요. 지우면 되돌릴 수 없어요.")) return;
    var btn = this; btn.disabled = true;
    try {
      var n = await api("rpc/gv_reports_delete", { method: "POST", body: { ids: ids } });
      if (current && ids.indexOf(current.id) >= 0) { current = null; showEmptyCenter(); }
      reports = await api(LIST) || []; renderList();
      say("ok", (n || 0) + "명 리포트를 지웠어요.");
    } catch (err) { if (!expired(err)) say("err", "지우지 못했어요. 잠시 뒤 다시 눌러 주세요."); }
    finally { btn.disabled = false; }
  });
  function filterList() {
    var qs = idsOf(addId.value);
    document.querySelectorAll("#listPanel [data-row]").forEach(function (li) { var row = li.getAttribute("data-row"); li.hidden = qs.length > 0 && !qs.some(function (q) { return row.indexOf(q) >= 0; }); });
  }
  function flashItem(id) {
    var b = document.querySelector('#listPanel [data-rid="' + id + '"]'); if (!b) return;
    b.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
    b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash");
  }
  /* 학생 ID는 쉼표·띄어쓰기·줄바꿈으로 여러 개를 한 번에 넣을 수 있다 (KWAN 11/26) */
  var adding = false; /* 만드는 중에는 다시 누를 수 없게 */
  function syncAddBtn() { var ids = idsOf(addId.value); addBtn.disabled = !ids.length; addBtn.textContent = ids.length > 1 ? ids.length + "명 만들기" : byId(ids[0]) ? "열기" : "만들기"; }
  function idsOf(v) { var seen = {}; return String(v || "").split(/[^0-9]+/).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }); }
  addId.addEventListener("input", function () {
    var v = addId.value; if (/[^0-9,\s]/.test(v)) { v = v.replace(/[^0-9,\s]+/g, ","); addId.value = v; } /* 다른 구분 기호(、 / - .)는 쉼표로 바꿔 ID가 붙지 않게 */
    var ids = idsOf(v);
    if (adding) return; addBtn.disabled = !ids.length; say("", ""); filterList();
    addBtn.textContent = ids.length > 1 ? ids.length + "명 만들기" : byId(ids[0]) ? "열기" : "만들기";
  });
  $("addForm").addEventListener("submit", async function (e) {
    e.preventDefault(); if (adding) return;
    var ids = idsOf(addId.value);
    if (ids.length > 30) { say("err", "한 번에 30명까지 넣어 주세요. 지금 " + ids.length + "명이에요."); return; }
    if (ids.length > 1) { adding = true; try { await addMany(ids); } finally { adding = false; syncAddBtn(); } return; }
    var id = ids[0] || "";
    var have = byId(id) || reports.filter(function (x) { return x.student_id === id; })[0];
    if (have) {
      say("warn", "이미 있는 학생이에요. 새로 만들지 않고 " + (have.name || id) + " 리포트를 열었어요.");
      openReport(have.id, true); flashItem(have.id); return;
    }
    if (!/^[0-9]{4,12}$/.test(id)) { say("err", "학생 ID는 숫자 4~12자리로 넣어 주세요."); addId.focus(); return; }
    adding = true; addBtn.disabled = true; addBtn.textContent = "만드는 중…";
    try {
      await api("gv_reports", { method: "POST", body: { id: id, student_id: id, title: id + " 학생 · GV 라이팅 리포트", status: "requested" }, headers: { Prefer: "return=minimal" } });
      addId.value = ""; filterList();
      say("ok", id + " 학생 리포트를 만들고 있어요. 보통 1분 안에 완성돼요.");
      reports = await api(LIST) || []; renderList(); openReport(id, true); flashItem(id); pollTimer();
    } catch (err) {
      if (expired(err)) return;
      if (err && (err.status === 409 || err.code === "23505")) {
        reports = await api(LIST).catch(function () { return reports; }) || reports; renderList();
        var dup = byId(id); say("warn", dup ? "방금 다른 분이 같은 학생을 먼저 넣었어요. 목록에서 눌러 보세요." : "예전에 만든 리포트가 있어 목록에서 숨긴 학생이에요. 다시 필요하면 브랜드팀에 알려 주세요."); if (dup) flashItem(id);
      } else say("err", "넣지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    } finally { adding = false; syncAddBtn(); }
  });
  async function addMany(ids) {
    var bad = ids.filter(function (x) { return !/^[0-9]{4,12}$/.test(x); });
    if (bad.length) { say("err", "학생 ID는 숫자 4~12자리로 넣어 주세요: " + bad.join(", ")); addId.focus(); return; }
    var have = ids.filter(function (x) { return reports.some(function (r) { return r.id === x || r.student_id === x; }); });
    var todo = ids.filter(function (x) { return have.indexOf(x) < 0; });
    addBtn.disabled = true; addBtn.textContent = "만드는 중…";
    var made = [], hidden = [], failed = [];
    try {
      var post = function (id) {
        return api("gv_reports", { method: "POST", body: { id: id, student_id: id, title: id + " 학생 · GV 라이팅 리포트", status: "requested" }, headers: { Prefer: "return=minimal" } })
          .then(function () { made.push(id); })
          .catch(function (err) { if (err && (err.status === 409 || err.code === "23505")) hidden.push(id); else failed.push(id); });
      };
      for (var k = 0; k < todo.length; k += 4) await Promise.all(todo.slice(k, k + 4).map(post)); /* 4명씩 나눠 보낸다 */
      reports = await api(LIST).catch(function () { return reports; }) || reports; renderList();
      var msg = made.length ? made.length + "명 리포트를 만들고 있어요. 보통 1~2분 안에 완성돼요." : "새로 만든 학생이 없어요.";
      if (have.length) msg += " 이미 있는 " + have.length + "명은 건너뛰었어요.";
      if (hidden.length) msg += " 예전에 만들어 숨긴 학생(" + hidden.join(", ") + ")은 브랜드팀에 알려 주세요.";
      if (failed.length) msg += " 넣지 못한 학생: " + failed.join(", ") + ".";
      say(failed.length ? "warn" : "ok", msg);
      if (!failed.length) { addId.value = ""; filterList(); }
      if (made[0]) { openReport(made[0], true); made.forEach(flashItem); pollTimer(); }
    } catch (err) { if (!expired(err)) say("err", "넣지 못했어요. 잠시 뒤 다시 눌러 주세요."); }
  }
  $("listPanel").addEventListener("click", function (e) {
    var b = e.target.closest("[data-rid]"); if (!b) return;
    openReport(b.getAttribute("data-rid"), true);
    if (!wide.matches) closeSide("listPanel");
  });

  /* ---------- 가운데: 리포트 ---------- */
  /* 2026-11-24 B안으로 확정. A안 의견(talk-)은 B안의 같은 부분(b-)으로 보여 준다 */
  var lastData = null;
  function drawReport() { $("report").innerHTML = window.renderReport(current.student_id, lastData); setupReport(); }
  async function openReport(id, push) {
    var meta = byId(id); if (!meta) return;
    current = meta; renderList();
    if (push) history.replaceState(null, "", "?r=" + encodeURIComponent(id));
    var nm = meta.name || (meta.student_id + " 학생");
    $("barTitle").textContent = nm + " · " + meta.student_id;
    $("fbSub").setAttribute("data-nm", nm); $("fbSub").textContent = fbScope === "all" ? "모든 학생 리포트의 의견 · 새 의견은 " + nm + " 리포트에 남아요" : nm + " 리포트에 남긴 의견";
    document.title = nm + " · GV 라이팅 리포트";
    filterSec = null;
    if (meta.status !== "ready") { showWait(meta); loadFb(); return; }
    var rows;
    try { rows = await api("gv_reports?select=id,data&id=eq." + encodeURIComponent(id)); }
    catch (err) { if (expired(err)) return; toast("리포트를 불러오지 못했어요. 다시 눌러 주세요."); return; }
    if (!current || current.id !== id) return; /* 그 사이 다른 학생을 눌렀으면 무시 */
    var d = rows && rows[0] && rows[0].data;
    if (!d) { showWait(meta); loadFb(); return; }
    lastData = d; drawReport(); window.scrollTo(0, 0); var sc0 = document.querySelector("#report > .app"); if (sc0) sc0.scrollTop = 0;
    loadFb();
  }
  function showWait(meta) {
    $("report").innerHTML = '<div class="app"><header class="top pad"><img src="img/logo_dark.png" alt="리얼 아카데미"><i class="rule"></i><span>GV 라이팅 리포트</span>' +
      '<button type="button" class="test" id="chatOpen" aria-haspopup="dialog">피드백 <b id="chatCount">0</b></button></header>' +
      '<div class="wait-card" role="status"><img src="img/echo_thumb.png" alt="">' + (meta.err
        ? "<h2>" + esc(meta.student_id) + " 학생 리포트를<br>만들지 못했어요</h2><p>" + esc(meta.err) + '</p><button type="button" class="bar-btn" id="rebuildBtn" data-rid="' + esc(meta.id) + '">다시 만들기</button>'
        : "<h2>" + esc(meta.student_id) + ' 학생 리포트를<br>만들고 있어요</h2><p>학습 기록을 불러와 리포트를 채우는 중이에요. 보통 1분 안에 끝나고, 끝나면 이 화면이 저절로 바뀌어요.</p>') +
      "<small>" + (meta.requested_by_name ? esc(meta.requested_by_name) + "님이 " : "") + fmt(meta.created_at) + "에 넣었어요</small></div></div>";
    buildSections();
  }
  function showEmptyCenter() {
    $("report").innerHTML = '<div class="app"><div class="wait-card"><img src="img/echo_thumb.png" alt=""><h2>왼쪽에서 학생을 골라 주세요</h2><p>학생을 누르면 리포트가 여기에 나와요.</p></div></div>';
    $("barTitle").textContent = "GV 라이팅 리포트"; buildSections();
  }

  /* 리포트 안의 동작. 리포트를 바꿔도 한 번만 걸리도록 문서에 위임한다 */
  /* PC에서는 리포트가 휴대폰 크기 프레임 안에서 스크롤된다. 그때는 그 프레임, 아니면 null(창 전체) */
  function scroller() { var a = document.querySelector("#report > .app"); return a && a.scrollHeight > a.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(a).overflowY) ? a : null; }
  /* PC 미리보기 기기: 화면 크기는 CSS 픽셀 기준. 창이 낮으면 휴대폰 비율 그대로 줄인다 */
  var DEV = { galaxy: [360, 780], iphone: [402, 874] }, dev = "iphone"; /* 기본은 아이폰 17 (KWAN 11/26) */
  try { var sd = localStorage.getItem("gv_dev"); if (DEV[sd]) dev = sd; } catch (e) {}
  function fitPhone() {
    var w = $("reportWrap"); if (!w) return; var d = DEV[dev], lab = document.querySelector("#reportWrap .frame-label"), bar = document.querySelector(".dev-bar");
    var top = (bar ? bar.offsetHeight + 10 : 0) + (lab ? lab.offsetHeight + 12 : 0) + 48, z = Math.min(1, Math.max(.55, (window.innerHeight - top - 24) / d[1]));
    w.style.setProperty("--pw", d[0] + "px"); w.style.setProperty("--ph", d[1] + "px"); w.style.setProperty("--pz", z.toFixed(3)); w.style.setProperty("--pwz", Math.round(d[0] * z) + "px");
    document.querySelectorAll(".dev-bar [data-dev]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-dev") === dev)); });
  }
  window.addEventListener("resize", fitPhone);
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest(".dev-bar [data-dev]"); if (!b) return; dev = b.getAttribute("data-dev"); try { localStorage.setItem("gv_dev", dev); } catch (x) {} fitPhone(); });
  function tabIds() { return Array.prototype.map.call(document.querySelectorAll("#report [role=tab]"), function (b) { return b.id.slice(2); }); }
  function showTab(name, scroll) {
    var TABS = tabIds();
    if (TABS.indexOf(name) < 0) name = TABS[0];
    TABS.forEach(function (t) {
      var b = $("t-" + t), p = $("p-" + t); if (!b || !p) return;
      var on = t === name; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; p.hidden = !on;
    });
    if (scroll) {
      var bar = document.querySelector("#report .tabbar"), head = document.querySelector("#report .top"); if (!bar || !head) return;
      var sc = scroller(), now = sc ? sc.scrollTop : window.scrollY;
      var y = sc ? head.offsetTop + head.offsetHeight : Math.round(head.getBoundingClientRect().bottom + window.scrollY - (parseFloat(getComputedStyle(bar).top) || 0));
      if (now > y) { if (sc) sc.scrollTop = y; else window.scrollTo({ top: y, behavior: "instant" }); }
    }
  }
  var stickObs = null, fabObs = null;
  function setupReport() {
    var bar = document.querySelector("#report .tabbar");
    if (stickObs) { stickObs.disconnect(); stickObs = null; }
    if (bar && "IntersectionObserver" in window) {
      var s = document.createElement("div"); s.setAttribute("aria-hidden", "true"); s.style.height = "1px"; s.style.marginBottom = "-1px";
      bar.parentNode.insertBefore(s, bar);
      stickObs = new IntersectionObserver(function (es) { bar.classList.toggle("stuck", !es[0].isIntersecting); }, { rootMargin: "-1px 0px 0px 0px" });
      stickObs.observe(s);
    }
    /* 읽는 동안은 하단에 작은 신청 버튼 두 개가 따라다니고, 맨 아래 큰 버튼이 보이면 숨긴다 */
    if (fabObs) { fabObs.disconnect(); fabObs = null; }
    var cta = document.querySelector("#report .ctabar"), fw = $("miniBar");
    if (cta && fw && "IntersectionObserver" in window) { var seen = new Set(); fabObs = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); }); fw.classList.toggle("off", seen.size > 0); }, { rootMargin: "0px 0px 72px 0px" }); fabObs.observe(cta); var rc = $("recCta"); if (rc) fabObs.observe(rc); } /* 큰 버튼이나 추천 상담 버튼이 보이면 하단 작은 버튼은 숨김 */
    fitPhone();
    var h = location.hash.slice(1); showTab(tabIds().indexOf(h) >= 0 ? h : "summary", false);
    buildSections();
  }
  var popFrom = null; /* 팝업을 연 버튼. 닫으면 그 자리로 돌아간다 */
  function popHide(keep) { ["cefr", "cur"].forEach(function (k) { var s = $(k + "Sheet"); if (!s || s.hidden) return; s.hidden = true; $(k + "Bg").hidden = true; if (!keep && popFrom && popFrom.isConnected) popFrom.focus(); }); }
  function popShow(b) { var k = b.getAttribute("data-pop"), inside = b.closest(".sheet"); popHide(true); if (!inside) popFrom = b; $(k + "Sheet").hidden = false; $(k + "Bg").hidden = false; $(k + "Sheet").querySelector(".sheet-body").scrollTop = 0; $(k + "Sheet").querySelector("[data-popclose]").focus(); }
  function curTab(k) { document.querySelectorAll("#curSheet [data-cur]").forEach(function (b) { var on = b.getAttribute("data-cur") === k; b.setAttribute("aria-pressed", String(on)); $("cup-" + b.getAttribute("data-cur")).hidden = !on; }); $("curSheet").querySelector(".sheet-body").scrollTop = 0; }
  function lvShow() { var s = $("lvSheet"), b = $("lvBg"); if (!s) return; s.hidden = false; b.hidden = false; var body = s.querySelector(".sheet-body"); if (body) body.scrollTop = 0; $("lvClose").focus(); }
  function lvHide() { var s = $("lvSheet"), b = $("lvBg"); if (!s || s.hidden) return; s.hidden = true; b.hidden = true; var o = $("lvOpen"); if (o) o.focus(); }
  document.addEventListener("click", function (e) {
    var t = e.target;
    var tab = t.closest("#report [role=tab]"); if (tab) { showTab(tab.id.slice(2), true); return; }
    var go = t.closest("#report [data-go]"); if (go) { var gn = go.getAttribute("data-go"); showTab(gn, true); var gp = $("p-" + gn); if (gp) { if (!gp.hasAttribute("tabindex")) gp.setAttribute("tabindex", "-1"); gp.focus({ preventScroll: true }); } return; }
    var pop = t.closest("[data-pop]"); if (pop) { popShow(pop); return; }
    var ct = t.closest("[data-cur]"); if (ct) { curTab(ct.getAttribute("data-cur")); return; }
    var pcl = t.closest("[data-popclose]"); if (pcl) { popHide(); return; }
    if (t.closest("#lvOpen")) { lvShow(); return; }
    if (t.closest("#lvClose") || t.closest("#lvBg")) { lvHide(); return; }
    if (t.closest("#chatOpen")) { openSide("fbPanel"); return; }
    var rb = t.closest("#rebuildBtn");
    if (rb) {
      rb.disabled = true; rb.textContent = "다시 만드는 중…";
      api("rpc/gv_report_rebuild", { method: "POST", body: { rid: rb.getAttribute("data-rid") } }).then(function () {
        reports.forEach(function (x) { if (x.id === rb.getAttribute("data-rid")) x.err = null; }); if (current && current.id === rb.getAttribute("data-rid")) { current.err = null; showWait(current); } pollTimer();
      }).catch(function (err) { if (!expired(err)) { toast("다시 만들지 못했어요. 잠시 뒤 눌러 주세요."); rb.disabled = false; rb.textContent = "다시 만들기"; } });
      return;
    }
    var ch = t.closest("#praiseChips .choice");
    if (ch) {
      var on = ch.getAttribute("aria-pressed") !== "true";
      ch.parentNode.querySelectorAll(".choice").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      ch.setAttribute("aria-pressed", String(on));
      var send = $("praiseSend"); if (send) { send.disabled = !on; send.textContent = on ? "칭찬 카드 보내기" : "보낼 말을 골라 주세요"; }
      return;
    }
    if (t.closest("#consultBtn, #extendBtn, #miniBar a, #recCta")) return; /* 새 탭에서 상담 예약, 사전 연장 신청 페이지 */
    if (t.closest("#praiseSend")) { toast("지금은 미리보기예요. 실제 리포트에서는 칭찬 카드가 아이에게 전달돼요."); return; }
    if (wide.matches) { var it = t.closest("#report [data-item]"); if (it) { pickSection(it.getAttribute("data-item"), true); fbText.focus(); } }
  });
  /* 휴대폰에서 좌우로 밀어 탭 넘기기 (KWAN 11/26). 가로 이동이 세로보다 확실히 클 때만, 처음·마지막 탭에서는 멈춘다 */
  var sw = null;
  function swipeOk(t) {
    if (!t.closest || !t.closest("#report main") || t.closest(".sheet, input, textarea, select, [data-noswipe]")) return false;
    if (document.querySelector("#report .sheet:not([hidden])")) return false;
    for (var el = t; el && el.id !== "report"; el = el.parentElement) { /* 가로로 스크롤되는 표·그림 안에서는 그 스크롤을 우선 */
      if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return false;
    }
    return true;
  }
  document.addEventListener("touchstart", function (e) {
    if (window.visualViewport && visualViewport.scale > 1.01) { sw = null; return; } /* 확대해서 보는 중에는 탭을 넘기지 않는다 */
    var x0 = e.touches.length === 1 ? e.touches[0].clientX : -1; /* 화면 가장자리는 브라우저 뒤로 가기 동작에 양보 */
    sw = x0 > 24 && x0 < window.innerWidth - 24 && swipeOk(e.target) ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (!sw) return; var c = e.changedTouches[0], dx = c.clientX - sw.x, dy = c.clientY - sw.y, quick = Date.now() - sw.t < 800; sw = null;
    if (!quick || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    var have = tabIds(), cur = document.querySelector("#report [role=tab][aria-selected=true]"); if (!cur) return;
    var i = have.indexOf(cur.id.slice(2)) + (dx < 0 ? 1 : -1); if (i < 0 || i >= have.length) return;
    showTab(have[i], true);
    var p = $("p-" + have[i]); if (p) { p.classList.remove("sw-l", "sw-r"); void p.offsetWidth; p.classList.add(dx < 0 ? "sw-l" : "sw-r"); p.addEventListener("animationend", function () { p.classList.remove("sw-l", "sw-r"); }, { once: true }); }
  }, { passive: true });
  document.addEventListener("touchcancel", function () { sw = null; }, { passive: true });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { lvHide(); popHide(); closeSide("fbPanel"); closeSide("listPanel"); return; }
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && e.target.closest && e.target.closest("#report [role=tab]")) {
      var have = tabIds();
      var cur = have.indexOf(document.querySelector("#report [role=tab][aria-selected=true]").id.slice(2));
      var nx = have[(cur + (e.key === "ArrowRight" ? 1 : have.length - 1)) % have.length];
      showTab(nx, true); $("t-" + nx).focus();
    }
  });

  /* ---------- 좁은 화면: 목록·피드백을 팝업으로 ---------- */
  var backdrop = $("sideBackdrop"), opener = null;
  function openSide(id) {
    if (wide.matches) { if (id === "fbPanel") fbText.focus(); else addId.focus(); return; }
    opener = document.activeElement;
    ["listPanel", "fbPanel"].forEach(function (x) { $(x).classList.toggle("open", x === id); });
    backdrop.hidden = false;
    var x = $(id).querySelector(".side-x"); if (x) x.focus();
    if (id === "fbPanel") loadFb();
  }
  function closeSide(id) {
    var el = $(id); if (!el.classList.contains("open")) return;
    el.classList.remove("open"); backdrop.hidden = true;
    if (opener && opener.focus) opener.focus();
  }
  document.querySelectorAll("[data-open]").forEach(function (b) { b.addEventListener("click", function () { openSide(b.getAttribute("data-open")); }); });
  document.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", function () { closeSide(b.getAttribute("data-close")); }); });
  backdrop.addEventListener("click", function () { closeSide("fbPanel"); closeSide("listPanel"); });

  /* ---------- 오른쪽: 항목별 피드백 (Supabase에 저장, 새로고침해도 유지) ---------- */
  var NAMES = { "": "리포트 전체", "cover": "표지", "lia-message": "리아 선생님 한마디", "highlight": "가장 크게 달라진 점",
    "note-then": "처음 쓴 노트", "note-now": "지금 쓴 노트", "before-after": "무엇이 달라졌나요", "ind-write": "첫 영작",
    "ind-blocks": "문장 연습", "ind-fix": "다시 쓰기", "ind-talk": "에코 대화", "focus": "이번 달에 집중할 것", "recs": "함께 하면 좋은 학습",
    "praise-card": "칭찬 카드", "parent-guide": "리포트 보는 법", "level": "레벨 설명 팝업", "tabs": "탭 구성",
    "items-intro": "항목별로 보기 안내", "items-ach": "학습 성취도", "items-eng": "학습 참여도", "items-growth": "성장 추세", "items-type": "학생 유형", "items-recs": "추천학습 기준" };
  var TABNAME = { "p-summary": "요약", "p-writing": "글 비교", "p-skills": "활동 기록", "p-next": "다음 학습", "p-items": "항목별" };
  var sections = [], filterSec = null, fbView = "all", fbScope = "all", /* 의견은 모든 학생 리포트에 함께 적용되므로 기본은 모든 학생 보기 (KWAN 11/27) */ fb = { docs: [], loading: false, again: false, pending: null, timer: 0 };
  var groups = $("fbGroups"), sel = $("fbSection"), fbText = $("fbText"), fbSend = $("fbSend");
  function buildSections() {
    sections = [{ id: "", name: NAMES[""], tab: "" }];
    $("report").querySelectorAll("[data-item]").forEach(function (el) {
      var id = el.getAttribute("data-item");
      if (!/^[a-z0-9-]{1,64}$/.test(id) || sections.some(function (x) { return x.id === id; })) return;
      var pn = el.closest(".panel");
      var tb = pn && $("t-" + pn.id.slice(2));
      sections.push({ id: id, name: el.getAttribute("data-name") || NAMES[id] || id, tab: pn ? (tb ? tb.textContent.trim() : (TABNAME[pn.id] || "")) : (id === "level" ? "요약" : ""), panel: pn ? pn.id.slice(2) : (id === "level" ? "summary" : "") });
    });
    sel.innerHTML = sections.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.tab ? x.tab + " · " + x.name : x.name) + "</option>"; }).join("");
  }
  /* 지금 화면에 없는 부분의 이름 (작성 문장이 없는 학생 등) */
  var SECN = { sum: ["요약", "종합 결과"], level: ["요약", "학습 레벨"], days: ["요약", "학습 참여"], areas: ["요약", "영역별 결과"], vocab: ["어휘", "어휘 학습 결과"], vblock: ["어휘", "V-block 학습 현황"], gram: ["문법", "문법 학습 결과"], gblock: ["문법", "G-block 학습 현황"], notes: ["문법", "이렇게 배우고 있어요"], lia: ["총평", "리아 선생님의 한마디"], growth: ["총평", "성장 한눈에"], recs: ["총평", "다음 학습 추천"], next: ["총평", "다음 학습 과정"], "rec-peek": ["요약", "추천 학습 미리보기"], cta: ["", "사전 연장·리얼 코칭 상담 버튼"] };
  function secOf(id) { for (var i = 0; i < sections.length; i++) if (sections[i].id === (id || "")) return sections[i]; var s = SECN[String(id).replace(/^b-/, "")]; return { id: id, name: s ? s[1] : NAMES[id] || id, tab: s ? s[0] : "" }; }
  function pickSection(id, focusThread) {
    if (!sections.some(function (x) { return x.id === (id || ""); })) id = "";
    sel.value = id || "";
    document.querySelectorAll("#report .fb-picked").forEach(function (el) { el.classList.remove("fb-picked"); });
    if (id) { var el = document.querySelector('#report [data-item="' + id + '"]'); if (el) el.classList.add("fb-picked"); }
    if (focusThread) { filterSec = id ? id : null; renderFb(); }
  }
  sel.addEventListener("change", function () { pickSection(sel.value, true); });
  $("fbScope").addEventListener("click", function (e) { var b = e.target.closest("[data-fbscope]"); if (!b || b.getAttribute("data-fbscope") === fbScope) return; fbScope = b.getAttribute("data-fbscope"); var nm0 = $("fbSub").getAttribute("data-nm") || "이 학생"; $("fbSub").textContent = fbScope === "all" ? "모든 학생 리포트의 의견 · 새 의견은 " + nm0 + " 리포트에 남아요" : nm0 + " 리포트에 남긴 의견"; $("fbScope").querySelectorAll("[data-fbscope]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); groups.scrollTop = 0; loadFb(); });
  $("fbTabs").addEventListener("click", function (e) { var b = e.target.closest("[data-fbview]"); if (!b) return; fbView = b.getAttribute("data-fbview"); groups.scrollTop = 0; renderFb(); });
  $("fbAll").addEventListener("click", function () { filterSec = null; pickSection("", false); renderFb(); });
  async function loadFb() {
    if (!current) { groups.innerHTML = ""; return; }
    if (fb.loading) { fb.again = true; return fb.pending; }
    fb.loading = true; var done; fb.pending = new Promise(function (r) { done = r; });
    var rid = current.id;
    try {
      var all = fbScope === "all";
      var docs = await api("gv_report_feedback?select=id,report_id,section,author_id,author_name,body,created_at,done,done_by_name,done_at" + (all ? "" : "&report_id=eq." + encodeURIComponent(rid)) + "&order=created_at.asc");
      if (current && (all || current.id === rid)) { fb.docs = (docs || []).map(function (d) { if (d.section) d.section = d.section.replace(/^talk-/, "b-"); return d; }); renderFb(); }
    } catch (err) { expired(err); }
    finally { fb.loading = false; done(); }
    if (fb.again) { fb.again = false; return loadFb(); }
  }
  function badges(by) {
    document.querySelectorAll("#report [data-fb]").forEach(function (el) { el.removeAttribute("data-fb"); });
    Object.keys(by).forEach(function (k) { if (!k) return; var el = document.querySelector('#report [data-item="' + k + '"]'); var n = openCount(by[k]); if (el && n) el.setAttribute("data-fb", n); });
  }
  function openCount(list) { return list.filter(function (d) { return !d.done; }).length; }
  var CHECK = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function msgHtml(d, me) {
    var mine = d.author_id === me;
    var who = fbScope === "all" && d.report_id ? (function (r) { return r ? (r.name || r.student_id || r.id) : d.report_id; })(byId(d.report_id)) : "";
    return '<div class="msg' + (mine ? " me" : "") + (d.done ? " done" : "") + '"><span class="msg-meta">' + (mine ? "나" : esc(d.author_name || "팀원")) + " · " + fmt(d.created_at) + (who ? ' · <b class="msg-who">' + esc(who) + "</b>" : "") +
      (mine ? '<button type="button" class="msg-del" data-del="' + esc(d.id) + '">지우기</button>' : "") + '</span><div class="msg-bubble">' + esc(d.body) + "</div>" +
      '<button type="button" class="msg-done" data-done="' + esc(d.id) + '" aria-pressed="' + (d.done ? "true" : "false") + '"' + (d.done ? ' title="누르면 남은 의견으로 되돌려요"' : "") + '><span class="box">' + CHECK + "</span>" +
      (d.done ? "반영 완료 · " + esc(d.done_by_name || "팀원") + (d.done_at ? " · " + fmt(d.done_at) : "") : "반영했으면 완료 표시") + "</button></div>";
  }
  function sortDone(list) { return list.slice().sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0); }); }
  function renderFb() {
    var cnt = $("chatCount"); if (cnt) cnt.textContent = openCount(fb.docs);
    var me = ls(K.uid), by = {};
    sortDone(fb.docs).forEach(function (d) { var k = d.section || ""; (by[k] = by[k] || []).push(d); });
    badges(by);
    var flt = $("fbFilter"), pool = filterSec ? (by[filterSec] || []) : fb.docs, nDone = pool.filter(function (d) { return d.done; }).length, nOpen = pool.length - nDone;
    flt.hidden = !filterSec; if (filterSec) $("fbFilterName").textContent = secOf(filterSec).name;
    $("fbTabs").hidden = !pool.length;
    $("fbTabs").querySelectorAll("[data-fbview]").forEach(function (b) {
      var v = b.getAttribute("data-fbview"); b.setAttribute("aria-pressed", String(v === fbView));
      b.querySelector("i").textContent = v === "open" ? nOpen : v === "done" ? nDone : pool.length;
    });
    if (!pool.length) {
      groups.innerHTML = filterSec ? '<p class="empty">이 부분에는 아직 의견이 없어요. 아래 칸에 첫 의견을 적어 주세요.</p>' : '<div class="fb-empty"><b>의견은 이렇게 남겨요</b><ol>' +
        (wide.matches ? "<li>가운데 리포트에서 의견을 남길 부분을 눌러요.</li>" : "<li>아래 ‘의견 남길 곳’에서 부분을 골라요.</li>") +
        "<li>아래 칸에 하고 싶은 말을 적어요.</li><li>위쪽 화살표 버튼을 누르면 저장돼요.</li></ol></div>";
      return;
    }
    var order = sections.map(function (x) { return x.id; });
    Object.keys(by).forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); });
    function block(done) {
      return order.filter(function (k) { return by[k] && (!filterSec || k === filterSec); }).map(function (k) {
        var list = by[k].filter(function (d) { return !!d.done === done; }); if (!list.length) return "";
        var x = secOf(k);
        return '<section class="fb-group' + (done ? " is-done" : "") + '">' + (filterSec ? "" : '<button type="button" class="fb-group-h" data-jump="' + esc(k) + '"><span><b>' + esc(x.name) + "</b>" +
          (x.tab ? "<small>" + esc(x.tab) + " 탭 · 눌러서 그 부분으로 가기</small>" : "") + "</span>" + (done ? "" : "<em>" + list.length + "</em>") + "</button>") +
          list.map(function (d) { return msgHtml(d, me); }).join("") + "</section>";
      }).join("");
    }
    var keep = groups.scrollTop, html = "";
    if (fbView !== "done") html += nOpen ? block(false) : '<p class="empty">남은 의견이 없어요. 모두 반영했어요.</p>';
    if (fbView !== "open" && nDone) html += (fbView === "all" ? '<p class="done-h">' + CHECK + "반영 완료 " + nDone + "건</p>" : "") + block(true);
    if (fbView === "done" && !nDone) html += '<p class="empty">아직 반영 완료로 표시한 의견이 없어요.</p>';
    groups.innerHTML = html;
    groups.scrollTop = keep;
  }
  groups.addEventListener("click", async function (e) {
    var dn = e.target.closest("[data-done]");
    if (dn) {
      var fid = dn.getAttribute("data-done"), on = dn.getAttribute("aria-pressed") !== "true";
      dn.disabled = true;
      try { await api("rpc/gv_feedback_set_done", { method: "POST", body: { fid: fid, val: on } }); await loadFb(); toast(on ? "반영 완료로 옮겼어요" : "남은 의견으로 되돌렸어요"); }
      catch (err) { if (!expired(err)) { toast("저장하지 못했어요. 다시 눌러 주세요."); dn.disabled = false; } }
      return;
    }
    var del = e.target.closest("[data-del]");
    if (del) {
      if (!confirm("이 의견을 지울까요?")) return;
      del.disabled = true;
      try { await api("gv_report_feedback?id=eq." + encodeURIComponent(del.getAttribute("data-del")), { method: "DELETE" }); await loadFb(); }
      catch (err) { if (!expired(err)) { toast("지우지 못했어요. 다시 눌러 주세요."); del.disabled = false; } }
      return;
    }
    var j = e.target.closest("[data-jump]"); if (!j) return;
    var id = j.getAttribute("data-jump"); 
    var x = secOf(id);
    pickSection(id, !!id); if (!id) return;
    closeSide("fbPanel");
    if (id === "level") { showTab("summary", false); lvShow(); return; }
    if (x.panel) showTab(x.panel, false);
    var el = document.querySelector('#report [data-item="' + id + '"]'); if (!el) return;
    el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
    el.classList.remove("fb-flash"); void el.offsetWidth; el.classList.add("fb-flash");
  });
  var fbBusy = false;
  async function fbSubmit() {
    var text = fbText.value.trim(); if (!text || !current || fbBusy) return;
    fbBusy = true; fbSend.disabled = true;
    try {
      await api("gv_report_feedback", { method: "POST", body: { report_id: current.id, section: sel.value || null, body: text }, headers: { Prefer: "return=minimal" } });
      fbText.value = ""; await loadFb();
      groups.scrollTop = groups.scrollHeight;
      toast("의견을 남겼어요.");
    } catch (err) { if (!expired(err)) toast("의견을 남기지 못했어요. 잠시 뒤 다시 보내 주세요."); }
    finally { fbBusy = false; fbSend.disabled = !fbText.value.trim(); }
  }
  fbText.addEventListener("input", function () { fbSend.disabled = fbBusy || !fbText.value.trim(); });
  fbText.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); fbSubmit(); } });
  $("fbForm").addEventListener("submit", function (e) { e.preventDefault(); fbSubmit(); });
  function pollTimer() {
    clearInterval(fb.timer);
    fb.timer = setInterval(async function () {
      if (document.visibilityState !== "visible") return;
      loadFb();
      if (reports.some(function (x) { return x.status !== "ready"; })) {
        try {
          var next = await api(LIST) || [];
          var was = current && current.status, now = current && next.filter(function (x) { return x.id === current.id; })[0];
          reports = next; renderList(); if (!next.some(function (x) { return x.status !== "ready"; })) pollTimer(); /* 다 완성되면 다시 느리게 */
          if (now && was !== "ready" && now.status === "ready") { toast((now.name || now.student_id) + " 리포트가 완성됐어요."); openReport(now.id, false); }
          else if (now && now.status !== "ready" && (now.err || "") !== ((current && current.err) || "")) { current = now; showWait(now); }
        } catch (err) { expired(err); }
      }
    }, reports.some(function (x) { return x.status !== "ready"; }) ? 6000 : 20000); /* 만드는 중인 리포트가 있으면 자주 확인 */
  }

  start();

  /* 학부모 보기: 학생 목록·피드백·기기 전환·상단 바를 숨긴다. 오른쪽 위 버튼이나 Esc로 돌아온다 */
  (function () {
    var btn = $("parentBtn"), ex = $("pvExit"); if (!btn || !ex) return;
    function setPv(on) {
      document.documentElement.classList.toggle("pv", on); ex.hidden = !on;
      if (on) { ["listPanel", "fbPanel"].forEach(function (id) { var el = $(id); if (el) el.classList.remove("open"); }); ex.focus(); } else btn.focus();
      if (typeof fitPhone === "function") fitPhone();
    }
    btn.addEventListener("click", function () { setPv(true); });
    ex.addEventListener("click", function () { setPv(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && document.documentElement.classList.contains("pv")) setPv(false); });
  })();
})();
