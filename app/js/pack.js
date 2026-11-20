/* 싹둑 — 여러 선물을 한 롤에 배치 (스카이라인 방식, 회전 허용)
 * 좌표: x = 롤 폭 방향(0..R), y = 롤 길이 방향. 단위 cm. */
(function (g) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var INK = '#26352e', CREAM = '#f6efde', CHALK = '#f4ead1', RED = '#c9372c';

  function el(name, attrs, parent, text) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function f1(v) { var r = Math.round(v * 10) / 10; return (r % 1 === 0) ? String(r) : r.toFixed(1); }
  function niceStep(v) { var s = [5, 10, 20, 25, 50, 100, 200, 500]; for (var i = 0; i < s.length; i++) if (s[i] >= v) return s[i]; return 1000; }

  /* ───── 배치 ───── */
  function packOnce(pieces, R) {
    var sky = [{ x: 0, w: R, y: 0 }], placed = [], i, j;
    function yAt(x, w) {
      var y = 0;
      for (var k = 0; k < sky.length; k++) {
        var s = sky[k];
        if (s.x < x + w - 1e-9 && s.x + s.w > x + 1e-9) y = Math.max(y, s.y);
      }
      return y;
    }
    function insert(x, w, y) {
      var out = [];
      sky.forEach(function (s) {
        var a0 = s.x, a1 = s.x + s.w;
        if (a1 <= x + 1e-9 || a0 >= x + w - 1e-9) { out.push(s); return; }
        if (a0 < x - 1e-9) out.push({ x: a0, w: x - a0, y: s.y });
        if (a1 > x + w + 1e-9) out.push({ x: x + w, w: a1 - (x + w), y: s.y });
      });
      out.push({ x: x, w: w, y: y });
      out.sort(function (p, q) { return p.x - q.x; });
      var merged = [];
      out.forEach(function (s) {
        var last = merged[merged.length - 1];
        if (last && Math.abs(last.y - s.y) < 1e-9 && Math.abs(last.x + last.w - s.x) < 1e-9) last.w += s.w; else merged.push(s);
      });
      sky = merged;
    }
    for (i = 0; i < pieces.length; i++) {
      var pc = pieces[i], best = null;
      [[pc.w, pc.h, false], [pc.h, pc.w, true]].forEach(function (rot) {
        var pw = rot[0], ph = rot[1];
        if (pw > R + 1e-9) return;
        var xs = [R - pw];
        sky.forEach(function (s) { xs.push(s.x); if (s.x + s.w - pw >= 0) xs.push(s.x + s.w - pw); });
        xs.forEach(function (x) {
          if (x < -1e-9 || x + pw > R + 1e-9) return;
          var y = yAt(x, pw), top = y + ph;
          if (!best || top < best.top - 1e-9 || (Math.abs(top - best.top) < 1e-9 && (y < best.y - 1e-9 || (Math.abs(y - best.y) < 1e-9 && x < best.x)))) {
            best = { x: Math.max(0, x), y: y, w: pw, h: ph, top: top, rot: rot[2] };
          }
        });
      });
      if (!best) continue;
      insert(best.x, best.w, best.top);
      placed.push({ x: best.x, y: best.y, w: best.w, h: best.h, rot: best.rot, it: pc.it, n: pc.n });
    }
    var len = 0;
    placed.forEach(function (p) { len = Math.max(len, p.y + p.h); });
    return { placed: placed, length: len };
  }

  function compute(items, R) {
    var pieces = [], bad = [];
    items.forEach(function (it) {
      for (var n = 0; n < it.qty; n++) {
        if (!it.ok || Math.min(it.w, it.h) > R + 1e-9) bad.push(it);
        else pieces.push({ it: it, w: it.w, h: it.h, n: n + 1 });
      }
    });
    var orders = [
      function (a, b) { return Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h; },
      function (a, b) { return b.w * b.h - a.w * a.h; },
      function (a, b) { return Math.min(b.w, b.h) - Math.min(a.w, a.h) || b.w * b.h - a.w * a.h; }
    ];
    var best = null;
    orders.forEach(function (cmp) {
      var r = packOnce(pieces.slice().sort(cmp), R);
      if (!best || r.length < best.length - 1e-9) best = r;
    });
    best = best || { placed: [], length: 0 };
    var used = 0;
    best.placed.forEach(function (p) { used += p.w * p.h; });
    return { placed: best.placed, length: best.length, usedArea: used, eff: best.length > 0 ? used / (R * best.length) : 0, bad: bad, R: R };
  }

  /* ───── 그리기 ───── */
  function render(svg, res, o) {
    o = o || {};
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var R = o.R, len = Math.max(res.length, 10);
    var rollLen = o.rollLen > 0 ? o.rollLen : 0;
    var showLen = Math.max(len, rollLen && rollLen < len * 3 ? Math.min(rollLen, len * 2) : 0);
    var extra = Math.max(10, len * .1);
    var cw = R, ch = showLen + extra;
    var span = Math.max(cw, ch * 1.1);
    var Ue = span * .0125, U = Ue;
    var padL = span * .15, padT = span * .17, padR = span * .15, padB = span * .06;
    var vx = -padL, vy = -padT, vw = cw + padL + padR, vh = ch + padT + padB;
    svg.setAttribute('viewBox', [vx, vy, vw, vh].join(' '));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('data-ar', String(vw / vh));
    var pxCm = Math.min((svg.clientWidth || 640) / vw, (svg.clientHeight || 400) / vh);

    var defs = el('defs', null, svg);
    var step = vw > 90 ? 5 : (vw > 36 ? 2 : 1), major = step * 5;
    var pg = el('pattern', { id: 'pk-grid', width: major, height: major, patternUnits: 'userSpaceOnUse' }, defs);
    for (var i = 0; i < 5; i++) {
      var q = i * step, m = i === 0;
      el('line', { x1: q, y1: 0, x2: q, y2: major, stroke: CHALK, 'stroke-opacity': m ? .22 : .09, 'stroke-width': m ? U * .1 : U * .06 }, pg);
      el('line', { x1: 0, y1: q, x2: major, y2: q, stroke: CHALK, 'stroke-opacity': m ? .22 : .09, 'stroke-width': m ? U * .1 : U * .06 }, pg);
    }
    var pp = el('pattern', { id: 'pk-paper', width: 5, height: 5, patternUnits: 'userSpaceOnUse' }, defs);
    for (var j = 0; j < 5; j++) {
      el('line', { x1: j, y1: 0, x2: j, y2: 5, stroke: '#5e8aa0', 'stroke-opacity': j === 0 ? .28 : .13, 'stroke-width': U * (j === 0 ? .09 : .05) }, pp);
      el('line', { x1: 0, y1: j, x2: 5, y2: j, stroke: '#5e8aa0', 'stroke-opacity': j === 0 ? .28 : .13, 'stroke-width': U * (j === 0 ? .09 : .05) }, pp);
    }
    var fade = el('linearGradient', { id: 'pk-fade', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': CREAM, 'stop-opacity': 1 }, fade);
    el('stop', { offset: 1, 'stop-color': CREAM, 'stop-opacity': 0 }, fade);
    var hatch = el('pattern', { id: 'pk-hatch', width: U * 1.6, height: U * 1.6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: U * 1.6, height: U * 1.6, fill: RED, 'fill-opacity': .14 }, hatch);
    el('line', { x1: 0, y1: 0, x2: 0, y2: U * 1.6, stroke: RED, 'stroke-opacity': .8, 'stroke-width': U * .4 }, hatch);
    var sh = el('filter', { id: 'pk-shadow', x: '-10%', y: '-5%', width: '120%', height: '115%' }, defs);
    el('feDropShadow', { dx: U * .3, dy: U * .45, stdDeviation: U * .5, 'flood-color': '#000', 'flood-opacity': .38 }, sh);

    el('rect', { x: -2000, y: -2000, width: 4000, height: 4000, fill: 'url(#pk-grid)' }, svg);

    // 롤
    var bodyLen = rollLen && rollLen < showLen ? rollLen : showLen;
    var g1 = el('g', { filter: 'url(#pk-shadow)' }, svg);
    el('rect', { x: 0, y: 0, width: R, height: bodyLen, fill: CREAM }, g1);
    el('rect', { x: 0, y: 0, width: R, height: bodyLen, fill: 'url(#pk-paper)' }, g1);
    if (!rollLen || rollLen >= showLen) {
      el('rect', { x: 0, y: showLen, width: R, height: extra, fill: 'url(#pk-fade)' }, svg);
    }
    if (rollLen && rollLen < len) {           // 롤이 모자란 부분
      el('rect', { x: 0, y: rollLen, width: R, height: Math.max(0, len - rollLen), fill: 'url(#pk-hatch)' }, svg);
      el('line', { x1: -U * 2, y1: rollLen, x2: R + U * 2, y2: rollLen, stroke: RED, 'stroke-width': U * .45, 'stroke-dasharray': (U * 1.6) + ' ' + (U * 1) }, svg);
      el('text', { x: R + U * 3, y: rollLen, 'font-size': U * 3.2, 'dominant-baseline': 'central', 'font-family': 'Gaegu, "Noto Sans KR", sans-serif', 'font-weight': 700, fill: '#ffb4a8' }, svg, '롤 끝 ' + f1(rollLen));
    } else if (rollLen && rollLen >= len && rollLen <= showLen + extra) {
      el('line', { x1: -U * 2, y1: rollLen, x2: R + U * 2, y2: rollLen, stroke: '#9ee0b8', 'stroke-width': U * .35, 'stroke-dasharray': (U * 1.6) + ' ' + (U * 1) }, svg);
    }

    // 조각
    var gp = el('g', null, svg);
    res.placed.forEach(function (p, idx) {
      var col = p.it.color;
      var gg = el('g', { style: o.anim ? ('--drop:' + (U * 7) + 'px;animation:pkdrop .55s cubic-bezier(.2,.9,.3,1.2) both;animation-delay:' + (idx * 0.14) + 's') : '' }, gp);
      el('rect', { x: p.x + .15, y: p.y + .15, width: Math.max(.1, p.w - .3), height: Math.max(.1, p.h - .3), fill: col, 'fill-opacity': .55, stroke: col, 'stroke-width': U * .3, rx: U * .5 }, gg);
      el('rect', { x: p.x + .15, y: p.y + .15, width: Math.max(.1, p.w - .3), height: Math.max(.1, p.h - .3), fill: 'none', stroke: '#fff', 'stroke-opacity': .7, 'stroke-width': U * .12, 'stroke-dasharray': (U * 1.2) + ' ' + (U * .8), rx: U * .5 }, gg);
      var cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      var fs = Math.min(U * 3.4, p.w * .16, p.h * .3);
      if (p.w * pxCm > 30 && p.h * pxCm > 17 && fs > U * .9) {
        var t1 = el('text', { x: cx, y: cy - fs * .55, 'font-size': fs, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Gaegu, "Noto Sans KR", sans-serif', 'font-weight': 700, fill: INK }, gg, p.it.name);
        el('text', { x: cx, y: cy + fs * .7, 'font-size': fs * .8, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'JetBrains Mono, monospace', 'font-weight': 500, fill: INK, 'fill-opacity': .78 }, gg, f1(p.w) + '×' + f1(p.h));
      }
    });

    // 눈금자(왼쪽)와 폭 치수(위)
    var tick = niceStep(len / 7);
    for (var yv = 0; yv <= bodyLen + 1e-6; yv += tick) {
      el('line', { x1: 0, y1: yv, x2: -U * 1.6, y2: yv, stroke: CHALK, 'stroke-width': U * .13, opacity: .8 }, svg);
      el('text', { x: -U * 3.2, y: yv, 'font-size': U * 1.9, 'text-anchor': 'end', 'dominant-baseline': 'central', 'font-family': 'JetBrains Mono, monospace', 'font-weight': 500, fill: CHALK, opacity: .85 }, svg, String(Math.round(yv)));
    }
    var dy = -U * 5.5;
    el('line', { x1: 0, y1: dy, x2: R, y2: dy, stroke: CHALK, 'stroke-width': U * .2, opacity: .85 }, svg);
    [0, R].forEach(function (x) { el('line', { x1: x, y1: dy - U, x2: x, y2: dy + U, stroke: CHALK, 'stroke-width': U * .2, opacity: .85 }, svg); });
    el('text', { x: R / 2, y: dy - U * 2.4, 'font-size': U * 4, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Gaegu, "Noto Sans KR", sans-serif', 'font-weight': 700, fill: CHALK }, svg, '롤 폭 ' + f1(R) + ' cm');

    // 총 길이(오른쪽)
    if (res.placed.length) {
      var bx = R + U * 3.2, by = res.length;
      el('line', { x1: bx, y1: 0, x2: bx, y2: by, stroke: '#ffd98a', 'stroke-width': U * .3 }, svg);
      [0, by].forEach(function (y) { el('line', { x1: bx - U * 1, y1: y, x2: bx + U * 1, y2: y, stroke: '#ffd98a', 'stroke-width': U * .3 }, svg); });
      var tx = bx + U * 3.2;
      el('text', { x: tx, y: by / 2, 'font-size': U * 4, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Gaegu, "Noto Sans KR", sans-serif', 'font-weight': 700, fill: '#ffd98a', transform: 'rotate(90 ' + tx + ' ' + (by / 2) + ')' }, svg, '필요한 길이 ' + f1(Math.ceil(res.length)) + ' cm');
    } else {
      el('text', { x: R / 2, y: bodyLen / 2, 'font-size': U * 4, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Gaegu, "Noto Sans KR", sans-serif', 'font-weight': 700, fill: INK, opacity: .6 }, svg, '선물을 담아 보세요');
    }
  }

  g.Pack = { compute: compute, render: render };
})(window);
