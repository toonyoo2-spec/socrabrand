/* GV 라이팅 학습 리포트: 페이지에는 학생 데이터가 없고, 로그인한 권한 계정만 Supabase에서 본문을 받는다.
   로그인 정보는 메인 사이트(socrabrand.cloud)와 같은 저장 키를 써서, 한쪽에서 로그인하면 함께 유지된다. */
(function () {
  "use strict";
  var API = "https://eoljasmgogdcvnytaoax.supabase.co";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbGphc21nb2dkY3ZueXRhb2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzIwMDEsImV4cCI6MjEwMTQ0ODAwMX0.G8wiFPCgvzoDwGlk__SDkn8SxP6lDMHY6g6pt61-a5o";
  var K = { token: "socra_admin_token", exp: "socra_admin_token_exp", refresh: "socra_refresh_token", uid: "socra_user_id",
            role: "socra_user_role", email: "socra_user_email", name: "socra_user_name", tabs: "socra_visible_tabs" };
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var toastEl = $("toast"), toastT;
  function toast(m) { toastEl.textContent = m; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2600); }

  /* ---------- 세션 ---------- */
  function token() { return ls(K.token); }
  async function refresh() {
    var rt = ls(K.refresh); if (!rt) return false;
    try {
      var r = await fetch(API + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: rt }) });
      if (!r.ok) return false;
      var d = await r.json(); saveSession(d); return true;
    } catch (e) { return false; }
  }
  function saveSession(d) {
    ls(K.token, d.access_token); ls(K.refresh, d.refresh_token);
    ls(K.exp, String(Date.now() + d.expires_in * 1000));
    if (d.user) { ls(K.uid, d.user.id); ls(K.email, d.user.email || ""); }
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
    if (!r.ok) throw { status: r.status, text: await r.text() };
    var txt = await r.text();
    return txt ? JSON.parse(txt) : null; /* return=minimal 응답은 본문이 비어 있다 */
  }

  /* ---------- 화면 전환 ---------- */
  function showLogin(err) {
    $("reportWrap").hidden = true; $("gate").hidden = false;
    $("gateLogin").hidden = false; $("gateMsg").hidden = true;
    $("loginErr").textContent = err || ""; setTimeout(function () { $("loginId").focus(); }, 0);
  }
  function showMessage(title, text, list) {
    $("reportWrap").hidden = true; $("gate").hidden = false;
    $("gateLogin").hidden = true; $("gateMsg").hidden = false;
    $("gateTitle").textContent = title; $("gateText").textContent = text;
    $("gateList").innerHTML = (list || []).map(function (r) { return '<li><a href="?r=' + encodeURIComponent(r.id) + '"><b>' + esc(r.title) + '</b><small>학생 ID ' + esc(r.student_id) + '</small></a></li>'; }).join("");
  }
  function logout() { clearSession(); location.href = location.pathname + location.search; }
  $("gateLogout").addEventListener("click", logout);
  $("logoutBtn").addEventListener("click", logout);

  $("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var id = $("loginId").value.trim(), pw = $("loginPw").value;
    if (!id || !pw) return;
    if (id.indexOf("@") < 0) id += "@internal.local"; /* 메인 사이트와 같은 규칙 */
    var btn = $("loginBtn"); btn.disabled = true; btn.textContent = "로그인 중…"; $("loginErr").textContent = "";
    try {
      var r = await fetch(API + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: id, password: pw }) });
      if (!r.ok) { $("loginErr").textContent = "아이디나 비밀번호를 확인해 주세요."; return; }
      saveSession(await r.json()); $("loginPw").value = "";
      start();
    } catch (err) { $("loginErr").textContent = "연결에 실패했어요. 잠시 뒤 다시 시도해 주세요."; }
    finally { btn.disabled = false; btn.textContent = "로그인"; }
  });

  /* ---------- 리포트 불러오기 ---------- */
  var report = null;
  async function start() {
    if (!token()) return showLogin();
    var rid = new URLSearchParams(location.search).get("r");
    try {
      if (!rid) {
        var all = await api("gv_reports?select=id,title,student_id&order=updated_at.desc");
        if (!all.length) return showMessage("볼 수 있는 리포트가 없어요", "이 계정에는 리포트 열람 권한이 없어요. 필요하면 관리자에게 요청해 주세요.");
        if (all.length === 1) { history.replaceState(null, "", "?r=" + encodeURIComponent(all[0].id) + location.hash); return start(); }
        return showMessage("리포트를 골라 주세요", "이 계정으로 볼 수 있는 리포트예요.", all);
      }
      var rows = await api("gv_reports?select=id,title,student_id,body_html&id=eq." + encodeURIComponent(rid));
      if (!rows.length) return showMessage("리포트를 열 수 없어요", "주소가 맞는지 확인해 주세요. 이 계정에 열람 권한이 없을 수도 있어요.");
      report = rows[0];
    } catch (err) {
      if (err && err.auth) { clearSession(); return showLogin("로그인이 만료됐어요. 다시 로그인해 주세요."); }
      return showMessage("리포트를 불러오지 못했어요", "잠시 뒤 새로고침해 주세요.");
    }
    $("report").innerHTML = report.body_html;
    $("barTitle").textContent = report.title;
    $("chatSub").textContent = "학생 ID " + report.student_id;
    document.title = report.title;
    $("gate").hidden = true; $("reportWrap").hidden = false;
    initReport();
    loadChat();
  }

  /* ---------- 리포트 동작 (탭, 레벨 팝업, 칭찬 카드, 검토 메모) ---------- */
  var TABS = ["summary", "writing", "skills", "next"];
  function showTab(name, scroll) {
    if (TABS.indexOf(name) < 0) name = "summary";
    TABS.forEach(function (t) {
      var b = $("t-" + t), p = $("p-" + t); if (!b || !p) return;
      var on = t === name; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; p.hidden = !on;
    });
    if (scroll) {
      var bar = document.querySelector(".tabbar"), head = document.querySelector(".top");
      var y = Math.round(head.getBoundingClientRect().bottom + window.scrollY - (parseFloat(getComputedStyle(bar).top) || 0));
      if (window.scrollY > y) window.scrollTo({ top: y, behavior: "instant" });
    }
  }
  function openSheet(sh, bg) { sh.hidden = false; bg.hidden = false; }
  function closeSheet(sh, bg) { sh.hidden = true; bg.hidden = true; }
  function initReport() {
    var tabs = document.querySelector(".tabs");
    if (tabs) {
      tabs.addEventListener("click", function (e) { var b = e.target.closest("[role=tab]"); if (b) showTab(b.id.slice(2), true); });
      tabs.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        var cur = TABS.indexOf(document.querySelector("[role=tab][aria-selected=true]").id.slice(2));
        var nx = TABS[(cur + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
        showTab(nx, true); $("t-" + nx).focus();
      });
    }
    document.addEventListener("click", function (e) { var g = e.target.closest("[data-go]"); if (g) showTab(g.getAttribute("data-go"), true); });
    var bar = document.querySelector(".tabbar");
    if (bar && "IntersectionObserver" in window) {
      var s = document.createElement("div"); s.setAttribute("aria-hidden", "true"); s.style.height = "1px"; s.style.marginBottom = "-1px";
      bar.parentNode.insertBefore(s, bar);
      new IntersectionObserver(function (es) { bar.classList.toggle("stuck", !es[0].isIntersecting); }, { rootMargin: "-1px 0px 0px 0px" }).observe(s);
    }
    /* 레벨 팝업 */
    var lvSheet = $("lvSheet"), lvBg = $("lvBg"), lvOpen = $("lvOpen");
    if (lvSheet && lvOpen) {
      lvOpen.addEventListener("click", function () { openSheet(lvSheet, lvBg); var b = lvSheet.querySelector(".sheet-body"); if (b) b.scrollTop = 0; $("lvClose").focus(); });
      var lvHide = function () { if (lvSheet.hidden) return; closeSheet(lvSheet, lvBg); lvOpen.focus(); };
      $("lvClose").addEventListener("click", lvHide); lvBg.addEventListener("click", lvHide);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") lvHide(); });
    }
    /* 칭찬 카드 */
    var send = $("praiseSend"), box = $("praiseChips");
    if (send && box) {
      box.addEventListener("click", function (e) {
        var b = e.target.closest(".choice"); if (!b) return;
        var on = b.getAttribute("aria-pressed") !== "true";
        box.querySelectorAll(".choice").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", String(on));
        send.disabled = !on; send.textContent = on ? "칭찬 카드 보내기" : "보낼 문장을 골라 주세요";
      });
      send.addEventListener("click", function () { toast("시안이에요. 실제 리포트에서는 칭찬 카드가 전송돼요."); });
    }
    /* 피드백 버튼 */
    var co = $("chatOpen"); if (co) co.addEventListener("click", chatShow);
    var h = location.hash.slice(1); if (TABS.indexOf(h) >= 0) showTab(h, false); else showTab("summary", false);
  }
  $("memoToggle").addEventListener("click", function () {
    var on = this.getAttribute("aria-pressed") !== "true";
    this.setAttribute("aria-pressed", String(on)); document.body.classList.toggle("review", on);
  });

  /* ---------- 피드백 채팅 (Supabase에 저장, 새로고침해도 유지) ---------- */
  var chat = { docs: [], timer: 0, loading: false, again: false };
  var chatSheet = $("chatSheet"), chatBg = $("chatBg"), chatList = $("chatList"), chatText = $("chatText"), chatSend = $("chatSend");
  function fmt(t) { var d = new Date(t); if (isNaN(d)) return ""; return (d.getMonth() + 1) + "." + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  async function loadChat() {
    if (!report) return;
    if (chat.loading) { chat.again = true; return chat.pending; } /* 불러오는 중이면 끝난 뒤 한 번 더 */
    chat.loading = true;
    var done; chat.pending = new Promise(function (r) { done = r; });
    try {
      chat.docs = await api("gv_report_feedback?select=id,author_id,author_name,body,created_at&report_id=eq." + encodeURIComponent(report.id) + "&order=created_at.asc");
      renderChat();
    } catch (err) { if (err && err.auth) { clearSession(); showLogin("로그인이 만료됐어요. 다시 로그인해 주세요."); } }
    finally { chat.loading = false; done(); }
    if (chat.again) { chat.again = false; return loadChat(); }
  }
  function renderChat() {
    var cnt = $("chatCount"); if (cnt) cnt.textContent = chat.docs.length;
    var me = ls(K.uid);
    if (!chat.docs.length) { chatList.innerHTML = '<p class="empty">아직 남긴 의견이 없어요. 이 리포트에서 바꾸면 좋을 점을 편하게 적어 주세요.</p>'; return; }
    var atEnd = chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 80;
    chatList.innerHTML = chat.docs.map(function (d) {
      var mine = d.author_id === me;
      return '<div class="msg' + (mine ? " me" : "") + '"><span class="msg-meta">' + (mine ? "나" : esc(d.author_name || "팀원")) + " · " + fmt(d.created_at) +
        (mine ? '<button type="button" class="msg-del" data-del="' + esc(d.id) + '">삭제</button>' : "") + '</span><div class="msg-bubble">' + esc(d.body) + "</div></div>";
    }).join("");
    if (atEnd) chatList.scrollTop = chatList.scrollHeight;
  }
  function chatShow() {
    openSheet(chatSheet, chatBg); loadChat(); chatList.scrollTop = chatList.scrollHeight; $("chatClose").focus();
    clearInterval(chat.timer); chat.timer = setInterval(loadChat, 15000);
  }
  function chatHide() { if (chatSheet.hidden) return; closeSheet(chatSheet, chatBg); clearInterval(chat.timer); var co = $("chatOpen"); if (co) co.focus(); }
  async function chatSubmit() {
    var text = chatText.value.trim(); if (!text || !report) return;
    chatSend.disabled = true;
    try {
      await api("gv_report_feedback", { method: "POST", body: { report_id: report.id, body: text }, headers: { Prefer: "return=minimal" } });
      chatText.value = ""; await loadChat(); chatList.scrollTop = chatList.scrollHeight;
    } catch (err) { toast(err && err.auth ? "로그인이 만료됐어요. 다시 로그인해 주세요." : "의견을 남기지 못했어요. 잠시 뒤 다시 시도해 주세요."); }
    finally { chatSend.disabled = !chatText.value.trim(); }
  }
  chatList.addEventListener("click", async function (e) {
    var b = e.target.closest("[data-del]"); if (!b) return;
    b.disabled = true;
    try { await api("gv_report_feedback?id=eq." + encodeURIComponent(b.getAttribute("data-del")), { method: "DELETE" }); await loadChat(); }
    catch (err) { toast("삭제하지 못했어요."); b.disabled = false; }
  });
  $("chatClose").addEventListener("click", chatHide);
  chatBg.addEventListener("click", chatHide);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") chatHide(); });
  chatText.addEventListener("input", function () { chatSend.disabled = !chatText.value.trim(); });
  chatText.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); chatSubmit(); } });
  $("chatForm").addEventListener("submit", function (e) { e.preventDefault(); chatSubmit(); });

  start();
})();
