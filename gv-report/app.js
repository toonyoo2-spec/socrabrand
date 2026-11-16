/* GV 라이팅 학습 리포트
   - 페이지 파일에는 학생 데이터가 없다. 로그인한 권한 계정만 Supabase에서 리포트를 받는다.
   - 왼쪽: 학생 ID 등록과 리포트 목록 / 가운데: 리포트 / 오른쪽: 항목별 피드백
   - 로그인 정보는 메인 사이트(socrabrand.cloud)와 같은 저장 키를 써서 함께 유지된다. */
(function () {
  "use strict";
  var API = "https://eoljasmgogdcvnytaoax.supabase.co";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbGphc21nb2dkY3ZueXRhb2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzIwMDEsImV4cCI6MjEwMTQ0ODAwMX0.G8wiFPCgvzoDwGlk__SDkn8SxP6lDMHY6g6pt61-a5o";
  var K = { token: "socra_admin_token", exp: "socra_admin_token_exp", refresh: "socra_refresh_token", uid: "socra_user_id",
            role: "socra_user_role", email: "socra_user_email", name: "socra_user_name", tabs: "socra_visible_tabs" };
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

  /* ---------- 시작: 목록 불러오기 ---------- */
  var reports = [], current = null;
  async function start() {
    if (!token()) return showLogin();
    try { reports = await api("gv_reports?select=id,student_id,title,status,requested_by_name,created_at,updated_at&order=created_at.desc"); }
    catch (err) { if (expired(err)) return; return showMessage("목록을 불러오지 못했어요", "잠시 뒤 새로고침해 주세요."); }
    if (!reports) reports = [];
    $("gate").hidden = true; $("reportWrap").hidden = false;
    var want = new URLSearchParams(location.search).get("r");
    var first = reports.filter(function (x) { return x.id === want; })[0] || reports.filter(function (x) { return x.status === "ready"; })[0] || reports[0];
    renderList();
    if (first) openReport(first.id, false); else showEmptyCenter();
    feedbackTimer();
  }

  /* ---------- 왼쪽: 학생 ID 등록과 목록 ---------- */
  var addId = $("addId"), addBtn = $("addBtn"), addMsg = $("addMsg"), rlist = $("rlist");
  function say(kind, text) { addMsg.className = "add-msg " + kind; addMsg.textContent = text; addMsg.hidden = !text; }
  function renderList() {
    if (!reports.length) { rlist.innerHTML = '<li class="list-empty">아직 만든 리포트가 없어요. 위에 학생 ID를 넣어 첫 리포트를 만들어 보세요.</li>'; return; }
    rlist.innerHTML = reports.map(function (x) {
      var ready = x.status === "ready";
      return '<li><button type="button" data-rid="' + esc(x.id) + '"' + (current && current.id === x.id ? ' aria-current="true"' : "") + '><b>' + esc(x.student_id) + "</b>" +
        '<em class="' + (ready ? "ready" : "wait") + '">' + (ready ? "완성" : "만드는 중") + "</em>" +
        "<small>" + (x.requested_by_name ? esc(x.requested_by_name) + " · " : "") + fmt(x.created_at) + "</small></button></li>";
    }).join("");
  }
  function flashItem(id) {
    var b = rlist.querySelector('[data-rid="' + id + '"]'); if (!b) return;
    b.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
    b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash");
  }
  addId.addEventListener("input", function () {
    var v = addId.value.replace(/[^0-9]/g, ""); if (v !== addId.value) addId.value = v;
    addBtn.disabled = !v; say("", "");
  });
  $("addForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var id = addId.value.trim();
    if (!/^[0-9]{4,12}$/.test(id)) { say("err", "학생 ID는 숫자 4~12자리로 넣어 주세요."); addId.focus(); return; }
    var have = reports.filter(function (x) { return x.id === id; })[0];
    if (have) { say("warn", "이미 등록된 학생이에요. 목록에서 " + id + "을(를) 눌러 리포트를 보세요."); flashItem(id); return; }
    addBtn.disabled = true; addBtn.textContent = "등록하는 중…";
    try {
      await api("gv_reports", { method: "POST", body: { id: id, student_id: id, title: id + " 학생 · GV 라이팅 리포트", status: "requested" }, headers: { Prefer: "return=minimal" } });
      addId.value = "";
      say("ok", id + " 학생을 등록했어요. 리포트를 다 만들면 목록에 ‘완성’이라고 표시돼요.");
      reports = await api("gv_reports?select=id,student_id,title,status,requested_by_name,created_at,updated_at&order=created_at.desc") || [];
      renderList(); openReport(id, true); flashItem(id);
    } catch (err) {
      if (expired(err)) return;
      if (err && (err.status === 409 || err.code === "23505")) { say("warn", "이미 등록된 학생이에요. 목록에서 " + id + "을(를) 눌러 리포트를 보세요."); flashItem(id); }
      else say("err", "등록하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    } finally { addBtn.textContent = "리포트 만들기"; addBtn.disabled = !addId.value; }
  });
  rlist.addEventListener("click", function (e) {
    var b = e.target.closest("[data-rid]"); if (!b) return;
    openReport(b.getAttribute("data-rid"), true);
    if (!wide.matches) closeSide("listPanel");
  });

  /* ---------- 가운데: 리포트 ---------- */
  async function openReport(id, push) {
    var meta = reports.filter(function (x) { return x.id === id; })[0]; if (!meta) return;
    current = meta; renderList();
    if (push) history.replaceState(null, "", "?r=" + encodeURIComponent(id));
    $("barTitle").textContent = meta.student_id + " 학생 리포트";
    $("fbSub").textContent = "학생 ID " + meta.student_id;
    document.title = meta.student_id + " 학생 · GV 라이팅 리포트";
    if (meta.status !== "ready") { showWait(meta); loadFb(); return; }
    var rows;
    try { rows = await api("gv_reports?select=id,body_html&id=eq." + encodeURIComponent(id)); }
    catch (err) { if (expired(err)) return; toast("리포트를 불러오지 못했어요. 다시 눌러 주세요."); return; }
    if (!current || current.id !== id) return; /* 그 사이 다른 학생을 눌렀으면 무시 */
    $("report").innerHTML = (rows && rows[0] && rows[0].body_html) || "";
    window.scrollTo(0, 0);
    setupReport();
    loadFb();
  }
  function showWait(meta) {
    $("report").innerHTML = '<div class="app"><header class="top pad"><img src="img/logo_dark.png" alt="리얼 아카데미"><i class="rule"></i><span>GV 라이팅 리포트</span>' +
      '<button type="button" class="test" id="chatOpen" aria-haspopup="dialog">피드백 <b id="chatCount">0</b></button></header>' +
      '<div class="wait-card"><img src="img/echo_thumb.png" alt=""><h2>' + esc(meta.student_id) + ' 학생 리포트를<br>만들고 있어요</h2>' +
      "<p>학생의 학습 기록을 모아서 선생님이 쓴 것처럼 정리하는 중이에요. 다 만들면 왼쪽 목록에 ‘완성’이 뜨고, 여기에서 바로 볼 수 있어요.</p>" +
      "<small>" + (meta.requested_by_name ? esc(meta.requested_by_name) + "님이 " : "") + fmt(meta.created_at) + "에 등록했어요</small></div></div>";
    buildSections();
  }
  function showEmptyCenter() {
    $("report").innerHTML = '<div class="app"><div class="wait-card"><img src="img/echo_thumb.png" alt=""><h2>왼쪽에 학생 ID를 넣어 주세요</h2><p>‘리포트 만들기’를 누르면 그 학생의 리포트가 여기에 나와요.</p></div></div>';
    $("barTitle").textContent = "GV 라이팅 리포트"; buildSections();
  }

  /* 리포트 안의 동작 (탭, 레벨 팝업, 칭찬 카드). 리포트를 바꿔도 한 번만 걸리도록 문서에 위임한다 */
  var TABS = ["summary", "writing", "skills", "next"];
  function showTab(name, scroll) {
    if (TABS.indexOf(name) < 0) name = "summary";
    TABS.forEach(function (t) {
      var b = $("t-" + t), p = $("p-" + t); if (!b || !p) return;
      var on = t === name; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; p.hidden = !on;
    });
    if (scroll) {
      var bar = document.querySelector("#report .tabbar"), head = document.querySelector("#report .top"); if (!bar || !head) return;
      var y = Math.round(head.getBoundingClientRect().bottom + window.scrollY - (parseFloat(getComputedStyle(bar).top) || 0));
      if (window.scrollY > y) window.scrollTo({ top: y, behavior: "instant" });
    }
  }
  var stickObs = null;
  function setupReport() {
    var bar = document.querySelector("#report .tabbar");
    if (stickObs) { stickObs.disconnect(); stickObs = null; }
    if (bar && "IntersectionObserver" in window) {
      var s = document.createElement("div"); s.setAttribute("aria-hidden", "true"); s.style.height = "1px"; s.style.marginBottom = "-1px";
      bar.parentNode.insertBefore(s, bar);
      stickObs = new IntersectionObserver(function (es) { bar.classList.toggle("stuck", !es[0].isIntersecting); }, { rootMargin: "-1px 0px 0px 0px" });
      stickObs.observe(s);
    }
    var h = location.hash.slice(1); showTab(TABS.indexOf(h) >= 0 ? h : "summary", false);
    buildSections();
  }
  function lvShow() { var s = $("lvSheet"), b = $("lvBg"); if (!s) return; s.hidden = false; b.hidden = false; var body = s.querySelector(".sheet-body"); if (body) body.scrollTop = 0; $("lvClose").focus(); }
  function lvHide() { var s = $("lvSheet"), b = $("lvBg"); if (!s || s.hidden) return; s.hidden = true; b.hidden = true; var o = $("lvOpen"); if (o) o.focus(); }
  document.addEventListener("click", function (e) {
    var t = e.target;
    var tab = t.closest("#report [role=tab]"); if (tab) { showTab(tab.id.slice(2), true); return; }
    var go = t.closest("#report [data-go]"); if (go) { showTab(go.getAttribute("data-go"), true); return; }
    if (t.closest("#lvOpen")) { lvShow(); return; }
    if (t.closest("#lvClose") || t.closest("#lvBg")) { lvHide(); return; }
    if (t.closest("#chatOpen")) { openSide("fbPanel"); return; }
    var ch = t.closest("#praiseChips .choice");
    if (ch) {
      var on = ch.getAttribute("aria-pressed") !== "true";
      ch.parentNode.querySelectorAll(".choice").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      ch.setAttribute("aria-pressed", String(on));
      var send = $("praiseSend"); if (send) { send.disabled = !on; send.textContent = on ? "칭찬 카드 보내기" : "보낼 문장을 골라 주세요"; }
      return;
    }
    if (t.closest("#praiseSend")) { toast("지금은 미리보기예요. 실제 리포트에서는 칭찬 카드가 아이에게 전달돼요."); return; }
    if (wide.matches) { var it = t.closest("#report [data-item]"); if (it) pickSection(it.getAttribute("data-item")); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { lvHide(); closeSide("fbPanel"); closeSide("listPanel"); return; }
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && e.target.closest && e.target.closest("#report [role=tab]")) {
      var cur = TABS.indexOf(document.querySelector("#report [role=tab][aria-selected=true]").id.slice(2));
      var nx = TABS[(cur + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
      showTab(nx, true); $("t-" + nx).focus();
    }
  });

  /* ---------- 좁은 화면: 목록·피드백을 팝업으로 ---------- */
  var backdrop = $("sideBackdrop"), opener = null;
  function openSide(id) {
    if (wide.matches) { if (id === "fbPanel") $("fbText").focus(); else addId.focus(); return; }
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
  var NAMES = { "": "리포트 전체", "tabs": "탭 구성", "cover": "표지", "lia-message": "리아 선생님 한마디", "highlight": "가장 크게 달라진 점",
    "note-then": "처음 쓴 노트", "note-now": "지금 쓴 노트", "before-after": "무엇이 달라졌나요", "ind-write": "첫 영작",
    "ind-blocks": "문장 연습", "ind-fix": "다시 쓰기", "ind-talk": "에코 대화", "focus": "이번 달에 집중할 것", "recs": "추천 학습",
    "praise-card": "칭찬 카드", "parent-guide": "리포트 보는 법", "level": "레벨 팝업" };
  var TABNAME = { "p-summary": "요약", "p-writing": "글 비교", "p-skills": "활동 기록", "p-next": "다음 학습" };
  var sections = [], fb = { docs: [], loading: false, again: false, pending: null, timer: 0 };
  var groups = $("fbGroups"), sel = $("fbSection"), fbText = $("fbText"), fbSend = $("fbSend");
  function buildSections() {
    sections = [{ id: "", name: NAMES[""], tab: "" }];
    $("report").querySelectorAll("[data-item]").forEach(function (el) {
      var id = el.getAttribute("data-item");
      if (!/^[a-z0-9-]{1,64}$/.test(id) || sections.some(function (x) { return x.id === id; })) return;
      var pn = el.closest(".panel");
      sections.push({ id: id, name: NAMES[id] || id, tab: pn ? (TABNAME[pn.id] || "") : (id === "level" ? "요약" : "공통"), panel: pn ? pn.id.slice(2) : (id === "level" ? "summary" : "") });
    });
    sel.innerHTML = sections.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.tab ? x.tab + " · " + x.name : x.name) + "</option>"; }).join("");
  }
  function secOf(id) { for (var i = 0; i < sections.length; i++) if (sections[i].id === (id || "")) return sections[i]; return { id: id, name: NAMES[id] || id, tab: "" }; }
  function pickSection(id) {
    if (!sections.some(function (x) { return x.id === (id || ""); })) id = "";
    sel.value = id || "";
    document.querySelectorAll("#report .fb-picked").forEach(function (el) { el.classList.remove("fb-picked"); });
    if (id) { var el = document.querySelector('#report [data-item="' + id + '"]'); if (el) el.classList.add("fb-picked"); }
  }
  sel.addEventListener("change", function () { pickSection(sel.value); });
  async function loadFb() {
    if (!current) { groups.innerHTML = ""; return; }
    if (fb.loading) { fb.again = true; return fb.pending; }
    fb.loading = true; var done; fb.pending = new Promise(function (r) { done = r; });
    var rid = current.id;
    try {
      var docs = await api("gv_report_feedback?select=id,section,author_id,author_name,body,created_at&report_id=eq." + encodeURIComponent(rid) + "&order=created_at.asc");
      if (current && current.id === rid) { fb.docs = docs || []; renderFb(); }
    } catch (err) { expired(err); }
    finally { fb.loading = false; done(); }
    if (fb.again) { fb.again = false; return loadFb(); }
  }
  function renderFb() {
    var cnt = $("chatCount"); if (cnt) cnt.textContent = fb.docs.length;
    if (!fb.docs.length) { groups.innerHTML = '<p class="empty">아직 남긴 의견이 없어요. 아래에서 의견을 남길 부분을 고르고 적어 주세요.</p>'; return; }
    var me = ls(K.uid), by = {};
    fb.docs.forEach(function (d) { var k = d.section || ""; (by[k] = by[k] || []).push(d); });
    var order = sections.map(function (x) { return x.id; });
    Object.keys(by).forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); });
    var keep = groups.scrollTop;
    groups.innerHTML = order.filter(function (k) { return by[k]; }).map(function (k) {
      var x = secOf(k);
      return '<section class="fb-group"><button type="button" class="fb-group-h" data-jump="' + esc(k) + '"><span><b>' + esc(x.name) + "</b>" +
        (x.tab ? "<small>" + esc(x.tab) + "</small>" : "") + "</span><em>" + by[k].length + "</em></button>" +
        by[k].map(function (d) {
          var mine = d.author_id === me;
          return '<div class="msg' + (mine ? " me" : "") + '"><span class="msg-meta">' + (mine ? "나" : esc(d.author_name || "팀원")) + " · " + fmt(d.created_at) +
            (mine ? '<button type="button" class="msg-del" data-del="' + esc(d.id) + '">지우기</button>' : "") + '</span><div class="msg-bubble">' + esc(d.body) + "</div></div>";
        }).join("") + "</section>";
    }).join("");
    groups.scrollTop = keep;
  }
  groups.addEventListener("click", async function (e) {
    var del = e.target.closest("[data-del]");
    if (del) {
      del.disabled = true;
      try { await api("gv_report_feedback?id=eq." + encodeURIComponent(del.getAttribute("data-del")), { method: "DELETE" }); await loadFb(); }
      catch (err) { if (!expired(err)) { toast("지우지 못했어요. 다시 눌러 주세요."); del.disabled = false; } }
      return;
    }
    var j = e.target.closest("[data-jump]"); if (!j) return;
    var id = j.getAttribute("data-jump"), x = secOf(id);
    pickSection(id); if (!id) return;
    closeSide("fbPanel");
    if (id === "level") { showTab("summary", false); lvShow(); return; }
    if (x.panel) showTab(x.panel, false);
    var el = document.querySelector('#report [data-item="' + id + '"]'); if (!el) return;
    el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
    el.classList.remove("fb-flash"); void el.offsetWidth; el.classList.add("fb-flash");
  });
  async function fbSubmit() {
    var text = fbText.value.trim(); if (!text || !current) return;
    fbSend.disabled = true;
    try {
      await api("gv_report_feedback", { method: "POST", body: { report_id: current.id, section: sel.value || null, body: text }, headers: { Prefer: "return=minimal" } });
      fbText.value = ""; await loadFb();
      var g = groups.querySelector('[data-jump="' + (sel.value || "") + '"]');
      if (g && g.parentNode.lastElementChild) g.parentNode.lastElementChild.scrollIntoView({ block: "nearest" });
    } catch (err) { if (!expired(err)) toast("의견을 남기지 못했어요. 잠시 뒤 다시 보내 주세요."); }
    finally { fbSend.disabled = !fbText.value.trim(); }
  }
  fbText.addEventListener("input", function () { fbSend.disabled = !fbText.value.trim(); });
  fbText.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); fbSubmit(); } });
  $("fbForm").addEventListener("submit", function (e) { e.preventDefault(); fbSubmit(); });
  function feedbackTimer() {
    clearInterval(fb.timer);
    fb.timer = setInterval(async function () {
      if (document.visibilityState !== "visible") return;
      loadFb();
      /* 만드는 중인 리포트가 완성됐는지도 함께 확인 */
      if (reports.some(function (x) { return x.status !== "ready"; })) {
        try {
          var fresh2 = await api("gv_reports?select=id,student_id,title,status,requested_by_name,created_at,updated_at&order=created_at.desc") || [];
          var was = current && current.status, now = current && fresh2.filter(function (x) { return x.id === current.id; })[0];
          reports = fresh2; renderList();
          if (now && was !== "ready" && now.status === "ready") { toast(now.student_id + " 학생 리포트가 완성됐어요."); openReport(now.id, false); }
        } catch (err) { expired(err); }
      }
    }, 20000);
  }

  start();
})();
