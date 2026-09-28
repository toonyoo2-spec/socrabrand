// KWAN Agency 3D 사무실 (Three.js)
// 평면도 좌표(평면 px, agency.html의 ROOMS3·DESKS3…)를 그대로 받아 실제 3D로 그린다. 1 평면 px = 0.01 월드 단위.
// 페이지는 Office3D.mount → setDesk/setLabel(상태) → walk/place(사람 이동)만 부른다. 동선 계산은 페이지가 한다.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const U = 0.01; // 평면 px → 월드
const P = (x, y, h = 0) => new THREE.Vector3(x * U, h, y * U);
const SKIN = 0xf7d9bd;

function mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02, ...opts }); }
function rbox(w, h, d, r, material) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), material);
  m.castShadow = true; m.receiveShadow = true; return m;
}

const Office3D = {
  ready: false,
  mount(container, L) {
    if (this.ready && this.container === container) return true;
    const test = document.createElement("canvas");
    if (!(test.getContext("webgl2") || test.getContext("webgl"))) return false;
    this.container = container; this.L = L; this.people = {}; this.desks = {}; this.labels = {};
    container.innerHTML = ""; container.classList.add("gl");

    const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(renderer.domElement);
    const labels = this.labelRenderer = new CSS2DRenderer();
    labels.domElement.className = "o3d-labels"; container.appendChild(labels.domElement);

    const scene = this.scene = new THREE.Scene();
    const cx = (L.ISO.W / 2) * U, cz = (L.ISO.H / 2) * U; this.center = new THREE.Vector3(cx, 0, cz);
    const cam = this.camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 200);
    cam.position.set(cx + 16, 17, cz + 16); cam.lookAt(this.center);

    // 조명: 하늘빛 + 따뜻한 햇빛(그림자)
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xdcd2c0, 1.25); scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff4e6, 1.55);
    sun.position.set(cx - 6, 16, cz + 10); sun.target.position.copy(this.center);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 50 });
    scene.add(sun, sun.target);

    this.buildWorld();

    const controls = this.controls = new OrbitControls(cam, labels.domElement);
    controls.target.copy(this.center); controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minZoom = 0.8; controls.maxZoom = 3.2; controls.screenSpacePanning = true;
    controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.05;
    const az = Math.PI / 4; controls.minAzimuthAngle = az - 0.6; controls.maxAzimuthAngle = az + 0.6;
    controls.update();

    // 사람·책상 클릭
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
    labels.domElement.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; });
    labels.domElement.addEventListener("pointerup", e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
      if (e.target.closest && e.target.closest(".plate3")) return; // 이름표는 페이지가 처리
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const hits = ray.intersectObjects(Object.values(this.people).map(p => p.group).filter(g => g.visible), true);
      if (hits.length) { let o = hits[0].object; while (o && !o.userData.code) o = o.parent; if (o && this.onPick) this.onPick(o.userData.code); }
    });

    this.fit(); new ResizeObserver(() => this.fit()).observe(container);
    this.clock = new THREE.Clock(); this.ready = true;
    const loop = () => { this.raf = requestAnimationFrame(loop); if (document.hidden || !container.isConnected || container.offsetParent === null) return; this.tick(); };
    loop();
    return true;
  },

  fit() {
    const c = this.container; const w = c.clientWidth || 800; const h = Math.max(320, Math.round(Math.min(760, w * 0.58)));
    c.style.height = h + "px";
    this.renderer.setSize(w, h); this.labelRenderer.setSize(w, h);
    // 평면 전체가 보이도록 직교 카메라의 시야를 맞춘다
    const cam = this.camera, L = this.L; cam.updateMatrixWorld();
    const pts = []; for (const x of [0, L.ISO.W + 80]) for (const z of [0, L.ISO.H]) for (const y of [0, 0.8]) pts.push(P(x, z, y).applyMatrix4(cam.matrixWorldInverse));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    const pad = 0.4; minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    const aspect = w / h, cxv = (minX + maxX) / 2, cyv = (minY + maxY) / 2;
    let hw = (maxX - minX) / 2, hh = (maxY - minY) / 2; if (hw / hh > aspect) hh = hw / aspect; else hw = hh * aspect;
    Object.assign(cam, { left: cxv - hw, right: cxv + hw, top: cyv + hh, bottom: cyv - hh });
    if (!this.zoomed) { cam.zoom = w < 640 ? 1.9 : 1.22; this.zoomed = true; }
    cam.updateProjectionMatrix();
  },

  night(on) {
    if (!this.ready || this._night === on) return; this._night = on;
    this.hemi.color.set(on ? 0x9fb0ff : 0xffffff); this.hemi.groundColor.set(on ? 0x1c2238 : 0xe9dfcd); this.hemi.intensity = on ? 0.55 : 1.25;
    this.sun.color.set(on ? 0x8fa2ff : 0xfff1dc); this.sun.intensity = on ? 0.6 : 1.55;
    this.base.material.color.set(on ? 0x2b3350 : 0xefe7d8);
  },

  buildWorld() {
    const L = this.L, s = this.scene;
    // 바닥 판
    const baseW = (L.ISO.W + 120) * U, baseD = (L.ISO.H + 60) * U;
    this.base = rbox(baseW, 0.24, baseD, 0.12, mat(0xefe7d8));
    this.base.position.set(baseW / 2 - 0.3, -0.12, baseD / 2 - 0.3); this.base.castShadow = false; s.add(this.base);
    const wallM = mat(0xfbf8f2), rimM = mat(0xf1ece2), deskM = mat(0xf3ede3), legM = mat(0xd7c9b0), chairM = mat(0x8e98ad);
    L.ROOMS3.forEach(r => {
      const floor = rbox(r.w * U, 0.04, r.h * U, 0.02, mat(new THREE.Color(r.tone)));
      floor.position.copy(P(r.x + r.w / 2, r.y + r.h / 2, 0.02)); floor.castShadow = false; s.add(floor);
      const [side, at] = r.door; const g0 = at - 34, g1 = at + 34, T = 8;
      const wall = (x0, y0, x1, y1, h, m) => { const w = Math.max(1, x1 - x0), d = Math.max(1, y1 - y0); const b = rbox(w * U, h, d * U, 0.02, m); b.position.copy(P(x0 + w / 2, y0 + d / 2, h / 2)); s.add(b); };
      // 뒤쪽(북·서) 벽은 높게, 앞쪽(남·동)은 낮은 턱. 문은 복도 쪽에 뚫는다
      if (side === "n") { wall(r.x - T, r.y - T, r.x + g0, r.y, 0.6, wallM); wall(r.x + g1, r.y - T, r.x + r.w + T, r.y, 0.6, wallM); }
      else wall(r.x - T, r.y - T, r.x + r.w + T, r.y, 0.6, wallM);
      wall(r.x - T, r.y, r.x, r.y + r.h, 0.6, wallM);
      if (side === "s") { wall(r.x, r.y + r.h, r.x + g0, r.y + r.h + 6, 0.1, rimM); wall(r.x + g1, r.y + r.h, r.x + r.w + T, r.y + r.h + 6, 0.1, rimM); }
      else wall(r.x, r.y + r.h, r.x + r.w + T, r.y + r.h + 6, 0.1, rimM);
      wall(r.x + r.w, r.y, r.x + r.w + T, r.y + r.h, 0.1, rimM);
      // 방 이름(바닥 글씨)
      const lab = document.createElement("div"); lab.className = "o3d-room"; lab.textContent = r.name;
      const lo = new CSS2DObject(lab); lo.position.copy(P(r.x + 70, r.y + 26, 0.05)); s.add(lo);
    });
    // 책상·모니터·의자
    Object.entries(L.DESKS3).forEach(([code, d]) => {
      const g = new THREE.Group(); g.position.copy(P(d.x + L.DESK.w / 2, d.y + L.DESK.d / 2));
      const top = rbox(L.DESK.w * U, 0.05, L.DESK.d * U, 0.02, deskM); top.position.y = 0.34; g.add(top);
      for (const sx of [-1, 1]) { const leg = rbox(0.05, 0.32, L.DESK.d * U * 0.85, 0.015, legM); leg.position.set(sx * (L.DESK.w * U / 2 - 0.06), 0.16, 0); g.add(leg); }
      const screenM = new THREE.MeshStandardMaterial({ color: 0x1d2027, emissive: 0x000000, roughness: 0.4 });
      const mon = rbox(0.44, 0.27, 0.035, 0.015, mat(0x2a2d35)); mon.position.set(0, 0.56, 0.1); g.add(mon);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.22), screenM); scr.position.set(0, 0.56, 0.08); scr.rotation.y = Math.PI; g.add(scr);
      const glow = new THREE.PointLight(0x19d27f, 0, 0.9); glow.position.set(0, 0.56, -0.05); g.add(glow);
      const stand = rbox(0.05, 0.12, 0.05, 0.01, mat(0x2a2d35)); stand.position.set(0, 0.42, 0.1); g.add(stand);
      const kb = rbox(0.26, 0.015, 0.08, 0.005, mat(0xdedad2)); kb.position.set(0, 0.375, -0.07); g.add(kb);
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 16), mat(code === "KWAN" ? 0xfee500 : 0xffffff)); mug.position.set(0.32, 0.4, 0.05); mug.castShadow = true; g.add(mug);
      this.scene.add(g);
      const seat = L.SEATS3[code];
      const ch = new THREE.Group(); ch.position.copy(P(seat.x, seat.y - 4));
      const cs = rbox(0.3, 0.06, 0.28, 0.03, chairM); cs.position.y = 0.2; ch.add(cs);
      const cb = rbox(0.3, 0.3, 0.05, 0.03, chairM); cb.position.set(0, 0.36, -0.13); ch.add(cb);
      const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 10), mat(0x5b6273)); cp.position.y = 0.09; ch.add(cp);
      this.scene.add(ch);
      this.desks[code] = { screen: screenM, glow, pos: P(d.x + L.DESK.w / 2, d.y + L.DESK.d / 2) };
    });
    // 회의 탁자와 의자
    const T3 = L.TABLE3;
    const table = rbox(T3.w * U, 0.07, T3.h * U, 0.34, mat(0xead3ad)); table.position.copy(P(T3.x + T3.w / 2, T3.y + T3.h / 2, 0.34)); s.add(table);
    const tleg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.32, 20), mat(0xcdb48a)); tleg.position.copy(P(T3.x + T3.w / 2, T3.y + T3.h / 2, 0.16)); tleg.castShadow = true; s.add(tleg);
    L.MSLOTS3.forEach(p => { const c = rbox(0.24, 0.05, 0.24, 0.05, mat(0xf2b880)); c.position.copy(P(p.x, p.y, 0.2)); s.add(c); });
    // 화분·소파·입구 매트
    const pot = mat(0xd9a57a), leaf = new THREE.MeshStandardMaterial({ color: 0x5fb37a, roughness: 0.9, flatShading: true });
    [[20, 410], [L.ISO.W - 40, 350], [L.ISO.W - 40, 470], [360, 800], [845, 800]].forEach(([x, y]) => {
      const g = new THREE.Group(); g.position.copy(P(x, y));
      const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.16, 16), pot); pm.position.y = 0.08; pm.castShadow = true; g.add(pm);
      [[0, 0.32, 0, 0.17], [0.08, 0.24, 0.05, 0.12], [-0.07, 0.26, -0.04, 0.12]].forEach(([a, b, c, r]) => { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf); f.position.set(a, b, c); f.castShadow = true; g.add(f); });
      s.add(g);
    });
    const sofa = new THREE.Group(); sofa.position.copy(P(700, 400));
    const sb = rbox(1.1, 0.16, 0.36, 0.06, mat(0x7fa6e8)); sb.position.y = 0.12; sofa.add(sb);
    const sback = rbox(1.1, 0.26, 0.1, 0.05, mat(0x6b93d6)); sback.position.set(0, 0.26, -0.15); sofa.add(sback);
    s.add(sofa);
    const matE = rbox(0.8, 0.02, 0.7, 0.05, mat(0x9fd3b5)); matE.position.copy(P(L.DOOR3.x - 20, L.DOOR3.y, 0.01)); matE.castShadow = false; s.add(matE);
    const sign = document.createElement("div"); sign.className = "o3d-sign"; sign.textContent = "입구";
    const so = new CSS2DObject(sign); so.position.copy(P(L.DOOR3.x, L.DOOR3.y - 40, 0.9)); s.add(so);
  },

  // 책상 이름표(HTML)와 모니터 상태
  setDesk(code, status, labelHtml) {
    const d = this.desks[code]; if (!d) return;
    const on = status === "working";
    d.screen.emissive.set(on ? 0x19d27f : status === "idle" ? 0x16372c : 0x000000);
    d.screen.emissiveIntensity = on ? 1.4 : 1; d.glow.intensity = on ? 0.9 : 0;
    let lb = this.labels[code];
    if (!lb) { const el = document.createElement("div"); el.className = "o3d-plate"; lb = this.labels[code] = new CSS2DObject(el); lb.position.copy(d.pos).setY(1.05); this.scene.add(lb); }
    if (lb.element.innerHTML !== labelHtml) lb.element.innerHTML = labelHtml;
  },

  person(code, look) {
    let p = this.people[code]; if (p) return p;
    const g = new THREE.Group(); g.userData.code = code; g.visible = false;
    const body = rbox(0.24, 0.26, 0.18, 0.08, mat(look.team)); body.position.y = 0.3; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 18), mat(SKIN)); head.position.y = 0.58; head.castShadow = true; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.158, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(look.hair)); hair.position.y = 0.6; hair.rotation.x = -0.25; hair.castShadow = true; g.add(hair);
    const eyeM = mat(0x1d1d1d);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), eyeM); e.position.set(sx * 0.055, 0.585, 0.138); g.add(e);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.025, 12), new THREE.MeshBasicMaterial({ color: 0xf5a3a3, transparent: true, opacity: 0.7 })); blush.position.set(sx * 0.085, 0.545, 0.142); g.add(blush); }
    const legs = [];
    for (const sx of [-1, 1]) { const lg = rbox(0.075, 0.18, 0.075, 0.03, mat(0x3b3f4c)); lg.geometry.translate(0, -0.09, 0); lg.position.set(sx * 0.06, 0.18, 0); g.add(lg); legs.push(lg); }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; g.add(shadow);
    g.scale.setScalar(1.45);
    const tagEl = document.createElement("div"); tagEl.className = "o3d-tag"; const tag = new CSS2DObject(tagEl); tag.position.y = 0.95; g.add(tag);
    this.scene.add(g);
    p = this.people[code] = { group: g, legs, body, head, tag, path: null, t: 0, sit: false, phase: Math.random() * 6 };
    return p;
  },
  setTag(code, html) { const p = this.people[code]; if (p && p.tag.element.innerHTML !== html) p.tag.element.innerHTML = html; },
  place(code, look, pt, visible, mode) {
    const p = this.person(code, look); p.path = null; p.group.visible = visible; p.sit = mode === "seat" || mode === "meet"; p.work = mode === "seat" && look.working;
    p.group.position.copy(P(pt.x, pt.y)); p.group.rotation.y = mode === "seat" ? 0 : mode === "meet" ? this.faceTable(pt) : 0;
  },
  faceTable(pt) { const T3 = this.L.TABLE3; return Math.atan2((T3.x + T3.w / 2 - pt.x), (T3.y + T3.h / 2 - pt.y)); },
  walk(code, look, pts, speed, delay, mode, onDone) {
    const p = this.person(code, look); p.sit = false; p.pending = { pts: pts.map(q => P(q.x, q.y)), speed: speed * U, mode, onDone, start: performance.now() + delay, target: pts[pts.length - 1] };
    p.path = null;
  },
  tick() {
    const dt = Math.min(0.12, this.clock.getDelta()), now = performance.now(), t = now / 1000;
    Object.values(this.people).forEach(p => {
      const g = p.group;
      if (p.pending && now >= p.pending.start) { p.path = p.pending; p.pending = null; p.seg = 0; g.visible = true; g.position.copy(p.path.pts[0]); }
      if (p.path) {
        const a = g.position, b = p.path.pts[p.seg + 1];
        if (!b) { const done = p.path; p.path = null; p.sit = done.mode === "seat" || done.mode === "meet"; if (done.mode === "seat") g.rotation.y = 0; if (done.mode === "meet") g.rotation.y = this.faceTable(done.target); if (done.mode === "door") g.visible = false; done.onDone && done.onDone(); }
        else {
          const dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz), step = p.path.speed * dt;
          const want = Math.atan2(dx, dz); let dr = want - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 12);
          if (dist <= step) { a.set(b.x, 0, b.z); p.seg++; } else { a.x += dx / dist * step; a.z += dz / dist * step; }
          const sw = Math.sin(t * 14 + p.phase) * 0.55; p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw;
          g.position.y = Math.abs(Math.sin(t * 14 + p.phase)) * 0.03; p.body.rotation.z = Math.sin(t * 7 + p.phase) * 0.04;
          return;
        }
      }
      // 서 있거나 앉아 있을 때: 숨쉬기, 일할 때 살짝 흔들기
      p.legs.forEach(l => l.rotation.x = p.sit ? -1.35 : 0);
      g.position.y = p.sit ? 0.06 : 0; p.body.rotation.z = 0;
      p.head.position.y = 0.58 + Math.sin(t * 2 + p.phase) * (p.work ? 0.012 : 0.006);
      p.head.rotation.y = p.work ? Math.sin(t * 1.3 + p.phase) * 0.25 : 0;
    });
    this.controls.update();
    this.renderer.render(this.scene, this.camera); this.labelRenderer.render(this.scene, this.camera);
  },
};
window.Office3D = Office3D;
window.dispatchEvent(new Event("office3d-ready"));
