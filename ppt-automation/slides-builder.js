/*
 * 슬라이드 계획 → Google Slides batchUpdate 요청 만들기 (네트워크 없음, 순수 함수)
 *
 * 템플릿 규칙
 *  - 원본 슬라이드마다 발표자 노트에 #유형 (예: #word_q) 을 적는다.
 *  - 바뀔 글자 자리에 {{토큰}} 을 적는다. 글꼴·색·위치는 템플릿 그대로 유지된다.
 *  - 정답 슬라이드의 "정답 강조 박스"는 {{answer}}(또는 {{letter}}) 를 담고, 아무 보기 위에 올려 둔다.
 *    생성할 때 맞는 보기({{c1}}~{{c4}}) 위치로 옮긴다.
 *  - 이미지 자리는 {{image}} 라고 적은 도형으로 둔다.
 */
(function (root, factory) {
  const api = factory(root.PPTCore || (typeof require === 'function' ? require('./ppt-core.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SlidesBuilder = api;
})(typeof self !== 'undefined' ? self : this, function (PPTCore) {
  'use strict';

  const TYPES = PPTCore.SLIDE_TYPES;
  const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
  const EMU_PER_PT = 12700;

  // ---------------------------------------------------------------------------
  // 페이지 요소 탐색
  // ---------------------------------------------------------------------------
  function textOf(textObj) {
    if (!textObj || !textObj.textElements) return '';
    return textObj.textElements.map((t) => (t.textRun ? t.textRun.content : t.autoText ? t.autoText.content : '') || '').join('');
  }
  function elementText(el) {
    if (el.shape) return textOf(el.shape.text);
    if (el.table) {
      return (el.table.tableRows || []).map((r) => (r.tableCells || []).map((c) => textOf(c.text)).join('\t')).join('\n');
    }
    if (el.elementGroup) return (el.elementGroup.children || []).map(elementText).join('\n');
    return '';
  }
  function walk(elements, fn, parents) {
    (elements || []).forEach((el) => {
      fn(el, parents || []);
      if (el.elementGroup) walk(el.elementGroup.children, fn, (parents || []).concat([el]));
    });
  }
  function tokensIn(text) {
    const out = new Set();
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(text))) out.add(m[1]);
    return out;
  }
  function notesInfo(slide) {
    const np = slide.slideProperties && slide.slideProperties.notesPage;
    if (!np) return null;
    const body = (np.pageElements || []).find((e) => e.shape && e.shape.placeholder && e.shape.placeholder.type === 'BODY');
    if (!body) return null;
    return { objectId: body.objectId, text: textOf(body.shape.text) };
  }
  const TAG_RE = /#([a-z][a-z0-9_]*)/g;
  function slideTag(slide) {
    const n = notesInfo(slide);
    if (!n) return null;
    let m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(n.text))) if (TYPES[m[1]]) return m[1];
    return null;
  }

  // ---------------------------------------------------------------------------
  // 템플릿 읽기·점검
  // ---------------------------------------------------------------------------
  function readTemplate(pres) {
    const protos = {}, duplicates = [], untagged = [], unknownTokens = {}, tokens = {};
    (pres.slides || []).forEach((slide, i) => {
      const type = slideTag(slide);
      if (!type) { untagged.push(i + 1); return; }
      if (protos[type]) { duplicates.push({ type, slide: i + 1 }); return; }
      protos[type] = slide;
      const set = new Set();
      walk(slide.pageElements, (el) => { if (!el.elementGroup) tokensIn(elementText(el)).forEach((t) => set.add(t)); });
      tokens[type] = set;
      const allowed = new Set(TYPES[type].tokens.concat(PPTCore.GLOBAL_TOKENS));
      const bad = [...set].filter((t) => !allowed.has(t));
      if (bad.length) unknownTokens[type] = bad;
    });
    return { protos, tokens, duplicates, untagged, unknownTokens };
  }

  function checkTemplate(pres, neededTypes) {
    const t = readTemplate(pres);
    const needed = neededTypes && neededTypes.length ? neededTypes : Object.keys(TYPES);
    return {
      found: Object.keys(t.protos),
      missing: needed.filter((ty) => !t.protos[ty]),
      duplicates: t.duplicates,
      untagged: t.untagged,
      unknownTokens: t.unknownTokens,
      tokens: Object.fromEntries(Object.entries(t.tokens).map(([k, v]) => [k, [...v]])),
    };
  }

  // ---------------------------------------------------------------------------
  // 위치 계산 (그룹 안 요소는 부모 변환을 곱해서 절대 위치를 구한다)
  // ---------------------------------------------------------------------------
  function toMatrix(tf) {
    if (!tf) return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const k = tf.unit === 'PT' ? EMU_PER_PT : 1;
    return { a: tf.scaleX == null ? 1 : tf.scaleX, b: tf.shearY || 0, c: tf.shearX || 0, d: tf.scaleY == null ? 1 : tf.scaleY, e: (tf.translateX || 0) * k, f: (tf.translateY || 0) * k };
  }
  function mul(m1, m2) { // m1 ∘ m2 (m2 먼저)
    return {
      a: m1.a * m2.a + m1.c * m2.b, b: m1.b * m2.a + m1.d * m2.b,
      c: m1.a * m2.c + m1.c * m2.d, d: m1.b * m2.c + m1.d * m2.d,
      e: m1.a * m2.e + m1.c * m2.f + m1.e, f: m1.b * m2.e + m1.d * m2.f + m1.f,
    };
  }
  const apply = (m, x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
  const mag = (dim) => (dim ? (dim.magnitude || 0) * (dim.unit === 'PT' ? EMU_PER_PT : 1) : 0);
  function bbox(el, parentM) {
    const m = mul(parentM, toMatrix(el.transform));
    if (el.elementGroup) {
      let box = null;
      (el.elementGroup.children || []).forEach((ch) => {
        const b = bbox(ch, m);
        if (!b) return;
        box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
      });
      return box;
    }
    const w = mag(el.size && el.size.width), h = mag(el.size && el.size.height);
    const pts = [apply(m, 0, 0), apply(m, w, 0), apply(m, 0, h), apply(m, w, h)];
    return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
  }
  const center = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  function parentMatrix(parents) {
    return parents.reduce((m, p) => mul(m, toMatrix(p.transform)), toMatrix(null));
  }

  // 토큰 하나만 담은 가장 바깥 요소 찾기 (보기 묶음 그룹 전체가 아니라 그 보기 하나)
  function findHolder(slide, token, exclude) {
    let best = null;
    walk(slide.pageElements, (el, parents) => {
      if (best && parents.includes(best.el)) return;
      const toks = tokensIn(elementText(el));
      if (!toks.has(token)) return;
      if (exclude.some((x) => toks.has(x))) return;
      if (!best || parents.length < best.parents.length) best = { el, parents };
    });
    return best;
  }

  // ---------------------------------------------------------------------------
  // 최종 글자 계산 (replaceAllText 후 글자를 미리 계산해 강조 위치를 잡는다)
  // ---------------------------------------------------------------------------
  function renderWithSpans(text, resolve, target) {
    let out = '', last = 0;
    const spans = [];
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(text))) {
      out += text.slice(last, m.index);
      const v = resolve(m[1]);
      const val = v == null ? m[0] : String(v);
      if (m[1] === target) spans.push(out.length);
      out += val;
      last = m.index + m[0].length;
    }
    out += text.slice(last);
    return { text: out, spans };
  }

  function hexToRgb(hex) {
    const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return { red: 0.9, green: 0.22, blue: 0.21 };
    return { red: parseInt(m[1], 16) / 255, green: parseInt(m[2], 16) / 255, blue: parseInt(m[3], 16) / 255 };
  }

  // ---------------------------------------------------------------------------
  // 메인: 계획 → 요청
  // ---------------------------------------------------------------------------
  function buildRequests(pres, plan, opts) {
    opts = opts || {};
    const tpl = readTemplate(pres);
    const missing = [...new Set(plan.map((p) => p.type))].filter((t) => !tpl.protos[t]);
    if (missing.length) {
      const err = new Error('템플릿에 없는 슬라이드 유형: ' + missing.map((t) => `#${t} (${TYPES[t] ? TYPES[t].name : '?'})`).join(', '));
      err.missing = missing;
      throw err;
    }
    const color = { opaqueColor: { rgbColor: hexToRgb(opts.highlightColor) } };
    const highlightBold = opts.highlightBold !== false;
    const prefix = opts.idPrefix || 'auto';
    const duplicates = [], edits = [], warnings = [], imageJobs = [], newSlideIds = [];
    const warnedOverlay = new Set();

    plan.forEach((item, i) => {
      const proto = tpl.protos[item.type];
      const slideId = `${prefix}_${i}_s`;
      newSlideIds.push(slideId);
      const idMap = {};
      idMap[proto.objectId] = slideId;
      let j = 0;
      walk(proto.pageElements, (el) => { idMap[el.objectId] = `${prefix}_${i}_${j++}`; });
      duplicates.push({ duplicateObject: { objectId: proto.objectId, objectIds: idMap } });

      const resolve = (tok) => {
        if (tok === 'image' && item.image) return null; // 이미지 자리는 글자로 바꾸지 않는다
        if (item.values && item.values[tok] != null) return item.values[tok];
        if (item.globals && item.globals[tok] != null) return item.globals[tok];
        return '';
      };
      // 1) 이미지
      const present = tpl.tokens[item.type];
      if (present.has('image')) {
        if (item.image && item.image.url) imageJobs.push({ pageObjectId: slideId, url: item.image.url, token: 'image', index: i });
      }
      // 2) 글자 바꾸기
      present.forEach((tok) => {
        const v = resolve(tok);
        if (v == null) return;
        edits.push({ replaceAllText: { containsText: { text: `{{${tok}}}`, matchCase: true }, replaceText: String(v), pageObjectIds: [slideId] } });
      });
      // 3) 강조 (표현·단어)
      (item.highlights || []).forEach((h) => {
        let hit = false;
        walk(proto.pageElements, (el) => {
          if (!el.shape || !el.shape.text) return;
          const raw = textOf(el.shape.text);
          if (!tokensIn(raw).has(h.token)) return;
          const { spans } = renderWithSpans(raw, resolve, h.token);
          spans.forEach((base) => {
            h.ranges.forEach(([s, e]) => {
              if (e <= s) return;
              hit = true;
              edits.push({
                updateTextStyle: {
                  objectId: idMap[el.objectId],
                  textRange: { type: 'FIXED_RANGE', startIndex: base + s, endIndex: base + e },
                  style: Object.assign({ foregroundColor: color }, highlightBold ? { bold: true } : {}),
                  fields: highlightBold ? 'foregroundColor,bold' : 'foregroundColor',
                },
              });
            });
          });
        });
        if (!hit) warnings.push(`${i + 1}번 슬라이드(#${item.type}): {{${h.token}}} 글상자가 없어 강조를 건너뜀`);
      });
      // 4) 정답 강조 박스를 맞는 보기 위로
      if (item.answer && item.answer.index >= 0) {
        const choiceToks = item.answer.tokens.filter((t) => present.has(t));
        const target = item.answer.tokens[item.answer.index];
        const overlayTok = ['answer', 'letter', 'lieNo'].find((t) => present.has(t) && findHolder(proto, t, choiceToks));
        const overlay = overlayTok && findHolder(proto, overlayTok, choiceToks);
        const holders = choiceToks.map((t) => ({ t, h: findHolder(proto, t, choiceToks.filter((x) => x !== t).concat(['answer', 'letter', 'lieNo'])) }));
        const targetHolder = holders.find((x) => x.t === target);
        if (!overlay || !targetHolder || !targetHolder.h || holders.some((x) => !x.h)) {
          if (!warnedOverlay.has(item.type)) warnings.push(`#${item.type}: 정답 강조 박스나 보기 위치를 찾지 못해 박스를 옮기지 않음`);
          warnedOverlay.add(item.type);
        } else {
          const oc = center(bbox(overlay.el, parentMatrix(overlay.parents)));
          // 지금 박스가 올라가 있는 보기
          let cur = holders[0], best = Infinity;
          holders.forEach((x) => {
            const c = center(bbox(x.h.el, parentMatrix(x.h.parents)));
            const dist = Math.hypot(c[0] - oc[0], c[1] - oc[1]);
            if (dist < best) { best = dist; cur = x; }
          });
          const from = center(bbox(cur.h.el, parentMatrix(cur.h.parents)));
          const to = center(bbox(targetHolder.h.el, parentMatrix(targetHolder.h.parents)));
          let dx = to[0] - from[0], dy = to[1] - from[1];
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            // 박스가 그룹 안에 있으면 그룹 좌표로 바꾼다
            const pm = parentMatrix(overlay.parents);
            const det = pm.a * pm.d - pm.b * pm.c || 1;
            const lx = (pm.d * dx - pm.c * dy) / det, ly = (-pm.b * dx + pm.a * dy) / det;
            edits.push({
              updatePageElementTransform: {
                objectId: idMap[overlay.el.objectId], applyMode: 'RELATIVE',
                transform: { scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, translateX: Math.round(lx), translateY: Math.round(ly), unit: 'EMU' },
              },
            });
          }
        }
      }
    });

    // 5) 순서 맞추기 → 템플릿 원본 슬라이드 지우기
    const order = newSlideIds.map((id, i) => ({ updateSlidesPosition: { slideObjectIds: [id], insertionIndex: i } }));
    const cleanup = (pres.slides || []).map((s) => ({ deleteObject: { objectId: s.objectId } }));
    return { requests: duplicates.concat(edits, order, cleanup), imageJobs, warnings, slideIds: newSlideIds };
  }

  // 이미지 넣기 요청 (이미지는 실패할 수 있어 하나씩 따로 보낸다)
  function imageRequest(job) {
    return [{ replaceAllShapesWithImage: { imageUrl: job.url, imageReplaceMethod: 'CENTER_INSIDE', containsText: { text: `{{${job.token}}}`, matchCase: true }, pageObjectIds: [job.pageObjectId] } }];
  }
  function imageFallbackRequest(job) {
    return [{ replaceAllText: { containsText: { text: `{{${job.token}}}`, matchCase: true }, replaceText: '', pageObjectIds: [job.pageObjectId] } }];
  }

  // 생성된 덱에서 발표자 노트의 #유형 표시 지우기
  function notesCleanupRequests(pres) {
    const reqs = [];
    (pres.slides || []).forEach((slide) => {
      const n = notesInfo(slide);
      if (!n) return;
      const ranges = [];
      let m;
      TAG_RE.lastIndex = 0;
      while ((m = TAG_RE.exec(n.text))) {
        if (!TYPES[m[1]]) continue;
        let s = m.index, e = m.index + m[0].length;
        if (n.text[e] === '\n' && (s === 0 || n.text[s - 1] === '\n')) e += 1; // 표시만 있던 줄은 줄째 지움
        ranges.push([s, e]);
      }
      ranges.reverse().forEach(([s, e]) => {
        if (e > n.text.length - 1) e = n.text.length - 1; // 마지막 줄바꿈은 지울 수 없음
        if (e > s) reqs.push({ deleteText: { objectId: n.objectId, textRange: { type: 'FIXED_RANGE', startIndex: s, endIndex: e } } });
      });
    });
    return reqs;
  }

  // 큰 요청 묶음은 나눠 보낸다 (순서 유지)
  function chunk(requests, size) {
    const out = [];
    for (let i = 0; i < requests.length; i += size || 400) out.push(requests.slice(i, i + (size || 400)));
    return out;
  }

  return { readTemplate, checkTemplate, buildRequests, imageRequest, imageFallbackRequest, notesCleanupRequests, chunk, renderWithSpans, bbox, findHolder };
});
