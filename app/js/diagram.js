/* 싹둑 — 재단도(SVG) + 가위 애니메이션
 * 좌표는 cm. x = 포장지 폭 방향, y = 길이 방향. 도면은 포장지 "뒷면"(자르는 면)을 보여 준다. */
(function (g) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var INK = '#26352e', CREAM = '#f6efde', CHALK = '#f4ead1', RED = '#c9372c';
  var anim = { raf: 0, run: null };

  function el(name, attrs, parent, text) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function f1(v) { var r = Math.round(v * 10) / 10; return (r % 1 === 0) ? String(r) : r.toFixed(1); }
  function niceStep(v) { var s = [1, 2, 5, 10, 20, 50]; for (var i = 0; i < s.length; i++) if (s[i] >= v) return s[i]; return 100; }
  function ease(t) { t = Math.max(0, Math.min(1, t)); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function stop() { if (anim.raf) cancelAnimationFrame(anim.raf); anim.raf = 0; }

  function render(svg, opt, o) {
    stop();
    o = o || {};
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var need = opt.need, f = opt.fit, fl = opt.folds;
    var nx = f.needX, ny = f.needY;
    var sx = f.sheetX, sy = f.sheetY;
    var isRoll = f.paperType === 'roll', isNone = f.paperType === 'none';
    var rollExtra = isRoll ? Math.max(8, ny * 0.16) : 0;

    /* ── 보이는 영역 ── */
    var cw = Math.max(sx, nx), ch = Math.max(sy + rollExtra, ny);
    var span = Math.max(cw, ch * 1.25);
    var Ue = span * .0125, shX = f.shortX > .05, shY = f.shortY > .05;
    var parts = [];
    if (shX) parts.push('폭 ' + f1(Math.ceil(f.shortX * 2) / 2));
    if (shY) parts.push('길이 ' + f1(Math.ceil(f.shortY * 2) / 2));
    var shortMsg = (shX || shY) ? '😱 ' + parts.join(' · ') + ' cm 모자라요!' : '';
    var pillW = Ue * (9 + shortMsg.length * 2.25);
    var padL = span * 0.18, padT = span * 0.17, padR = span * 0.08 + (shX ? pillW + Ue * 7 : 0), padB = span * 0.15 + (shY ? Ue * 12 : 0);
    var vx = -padL, vy = -padT, vw = cw + padL + padR, vh = ch + padT + padB;
    svg.setAttribute('viewBox', [vx, vy, vw, vh].join(' '));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('data-ar', String(vw / vh));
    var U = Ue;                                     // 글자·선 굵기 기준 단위
    var cwPx = svg.clientWidth || 640, chPx = svg.clientHeight || 400;
    var pxCm = Math.min(cwPx / vw, chPx / vh);

    function P(u, v) { return f.orient === 1 ? [u, v] : [v, u]; }
    function RC(u0, u1, v0, v1) {
      var a = P(u0, v0), b = P(u1, v1);
      return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
    }
    function rect(parent, r, attrs) { var a = { x: r.x, y: r.y, width: r.w, height: r.h }; for (var k in attrs) a[k] = attrs[k]; return el('rect', a, parent); }
    function line(parent, p1, p2, attrs) { var a = { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] }; for (var k in attrs) a[k] = attrs[k]; return el('line', a, parent); }
    function text(parent, t, x, y, size, attrs) {
      var a = { x: x, y: y, 'font-size': size, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Gaegu, "Noto Sans KR", sans-serif', 'font-weight': 700, fill: INK };
      for (var k in attrs) a[k] = attrs[k];
      return el('text', a, parent, t);
    }

    /* ── defs ── */
    var defs = el('defs', null, svg);
    var gridMinor = vw > 90 ? 5 : (vw > 36 ? 2 : 1);
    var gridMajor = gridMinor * 5;
    var pg = el('pattern', { id: 'mat-grid', width: gridMajor, height: gridMajor, patternUnits: 'userSpaceOnUse' }, defs);
    for (var i = 0; i < gridMajor / gridMinor; i++) {
      var q = i * gridMinor, major = i === 0;
      el('line', { x1: q, y1: 0, x2: q, y2: gridMajor, stroke: '#f4ead1', 'stroke-opacity': major ? .22 : .09, 'stroke-width': major ? U * .1 : U * .06 }, pg);
      el('line', { x1: 0, y1: q, x2: gridMajor, y2: q, stroke: '#f4ead1', 'stroke-opacity': major ? .22 : .09, 'stroke-width': major ? U * .1 : U * .06 }, pg);
    }
    var pp = el('pattern', { id: 'paper-grid', width: 5, height: 5, patternUnits: 'userSpaceOnUse' }, defs);
    for (var j = 0; j < 5; j++) {
      el('line', { x1: j, y1: 0, x2: j, y2: 5, stroke: '#5e8aa0', 'stroke-opacity': j === 0 ? .28 : .13, 'stroke-width': U * (j === 0 ? .09 : .05) }, pp);
      el('line', { x1: 0, y1: j, x2: 5, y2: j, stroke: '#5e8aa0', 'stroke-opacity': j === 0 ? .28 : .13, 'stroke-width': U * (j === 0 ? .09 : .05) }, pp);
    }
    var hatch = el('pattern', { id: 'hatch', width: U * 1.5, height: U * 1.5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: U * 1.5, stroke: INK, 'stroke-opacity': .38, 'stroke-width': U * .35 }, hatch);
    var hatchRed = el('pattern', { id: 'hatch-red', width: U * 1.6, height: U * 1.6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: U * 1.6, height: U * 1.6, fill: RED, 'fill-opacity': .12 }, hatchRed);
    el('line', { x1: 0, y1: 0, x2: 0, y2: U * 1.6, stroke: RED, 'stroke-opacity': .75, 'stroke-width': U * .4 }, hatchRed);
    var fade = el('linearGradient', { id: 'roll-fade', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': CREAM, 'stop-opacity': 1 }, fade);
    el('stop', { offset: 1, 'stop-color': CREAM, 'stop-opacity': 0 }, fade);
    var sh = el('filter', { id: 'shadow', x: '-10%', y: '-10%', width: '125%', height: '130%' }, defs);
    el('feDropShadow', { dx: U * .35, dy: U * .5, stdDeviation: U * .5, 'flood-color': '#000', 'flood-opacity': .38 }, sh);
    var sh2 = el('filter', { id: 'lift', x: '-10%', y: '-10%', width: '125%', height: '130%' }, defs);
    el('feDropShadow', { dx: U * .7, dy: U * 1.1, stdDeviation: U * .9, 'flood-color': '#000', 'flood-opacity': .5 }, sh2);

    /* ── 매트 ── */
    el('rect', { x: -2000, y: -2000, width: 4000, height: 4000, fill: 'url(#mat-grid)' }, svg);

    /* ── 포장지(가진 것) ── */
    var gSheet = el('g', { filter: 'url(#shadow)' }, svg);
    var gLeft = el('g', null, svg);                    // 자투리(잘리고 남는 쪽)
    if (!isNone) {
      var sheetR = { x: 0, y: 0, w: sx, h: isRoll ? sy : sy };
      rect(gSheet, sheetR, { fill: CREAM });
      rect(gSheet, sheetR, { fill: 'url(#paper-grid)' });
      if (isRoll) {
        rect(svg, { x: 0, y: sy, w: sx, h: rollExtra }, { fill: 'url(#roll-fade)' });
        rect(svg, { x: 0, y: sy, w: sx, h: rollExtra }, { fill: 'url(#paper-grid)', opacity: .55, 'mask': '' });
        text(svg, '롤은 계속 이어져요', sx / 2, sy + rollExtra * .55, U * 2.6, { fill: CHALK, opacity: .75 });
      }
      // 자투리 표시
      var lx = Math.max(0, sx - nx), ly = Math.max(0, sy - ny);
      if (lx > 0.05) {
        var lr = { x: Math.min(nx, sx), y: 0, w: lx, h: isRoll ? sy : Math.min(ny, sy) };
        rect(gLeft, lr, { fill: 'url(#hatch)' });
        if (lr.w * pxCm > 38) text(gLeft, '자투리', lr.x + lr.w / 2, lr.y + Math.min(lr.h / 2, U * 6), U * 2.6, { fill: INK, opacity: .8 });
      }
      if (!isRoll && ly > 0.05) {
        var lr2 = { x: 0, y: Math.min(ny, sy), w: sx, h: ly };
        rect(gLeft, lr2, { fill: 'url(#hatch)' });
        if (lr2.h * pxCm > 30) text(gLeft, '자투리', lr2.x + lr2.w / 2, lr2.y + lr2.h / 2, U * 2.6, { fill: INK, opacity: .8 });
      }
    }

    /* ── 필요한 종이 (도면) ── */
    var gNeed = el('g', { id: 'need' }, svg);
    var needR = { x: 0, y: 0, w: nx, h: ny };
    var base = el('g', { filter: isNone ? 'url(#shadow)' : '' }, gNeed);
    rect(base, needR, { fill: CREAM });
    rect(base, needR, { fill: 'url(#paper-grid)' });
    // 가진 포장지보다 모자란 곳
    if (f.shortX > 0.05) rect(gNeed, { x: sx, y: 0, w: nx - sx, h: ny }, { fill: 'url(#hatch-red)' });
    if (f.shortY > 0.05) rect(gNeed, { x: 0, y: sy, w: nx, h: ny - sy }, { fill: 'url(#hatch-red)' });

    var gZones = el('g', null, gNeed);
    var gFolds = el('g', { id: 'folds', style: o.folds === false ? 'display:none' : '' }, gNeed);
    var gText = el('g', null, gNeed);

    function zone(u0, u1, v0, v1, color, alpha, label, sub, minPx) {
      var r = RC(u0, u1, v0, v1);
      rect(gZones, r, { fill: color, 'fill-opacity': alpha });
      if (label && Math.min(r.w, r.h) * pxCm > (minPx || 30) && Math.max(r.w, r.h) * pxCm > 60) {
        var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        var fs = Math.min(U * 3.3, Math.min(r.w, r.h) * .42);
        text(gText, label, cx, cy - (sub ? fs * .55 : 0), fs, { fill: INK });
        if (sub) text(gText, sub, cx, cy + fs * .65, fs * .82, { fill: INK, opacity: .72 });
      }
    }
    var A = opt.around, L = opt.along;
    var TOP = '#3f7fc4', SIDE = '#2f9a6c', FLOOR = '#d69a2a', FLAP = '#c9372c', GATH = '#b24d9b';

    if (need.square && need.shape === 'box') {
      /* 일본식 대각선 · 보자기: 상자 축이 마름모(회전한 정사각형)의 대각선과 나란하다 */
      var Sq = need.S, axl = need.axis, pwd = need.p, qh = need.q, cxm = Sq / 2, R2 = Math.SQRT1_2, ZH = axl / 2, ZP = pwd / 2, BIG = Sq * 2;
      var cp = el('clipPath', { id: 'sheetclip' }, defs); el('rect', { x: 0, y: 0, width: nx, height: ny }, cp);
      gZones.setAttribute('clip-path', 'url(#sheetclip)'); gFolds.setAttribute('clip-path', 'url(#sheetclip)');
      var Bp = function (bx, bz) { return [cxm + (bx - bz) * R2, cxm + (bx + bz) * R2]; };
      var bpoly = function (parent, x0, x1, z0, z1, attrs) {
        var pts = [Bp(x0, z0), Bp(x1, z0), Bp(x1, z1), Bp(x0, z1)].map(function (q) { return q[0] + ',' + q[1]; }).join(' ');
        var a = { points: pts }; for (var k in attrs) a[k] = attrs[k];
        return el('polygon', a, parent);
      };
      var blabel = function (bx, bz, t1, t2, minCm) {
        var c = Bp(bx, bz);
        if (c[0] < Sq * .04 || c[0] > Sq * .96 || c[1] < Sq * .04 || c[1] > Sq * .96) return;
        var fs = Math.min(U * 3.3, Sq * .045);
        if (minCm * pxCm < 26) return;
        text(gText, t1, c[0], c[1] - (t2 ? fs * .55 : 0), fs, { fill: INK });
        if (t2) text(gText, t2, c[0], c[1] + fs * .65, fs * .8, { fill: INK, opacity: .72 });
      };
      bpoly(gZones, -ZH, ZH, -ZP, ZP, { fill: FLOOR, 'fill-opacity': .34 });
      [1, -1].forEach(function (sg) {
        bpoly(gZones, -ZH, ZH, sg * ZP, sg * (ZP + qh), { fill: SIDE, 'fill-opacity': .28 });
        bpoly(gZones, -ZH, ZH, sg * (ZP + qh), sg * (ZP + qh + pwd), { fill: TOP, 'fill-opacity': .22 });
        bpoly(gZones, -ZH, ZH, sg * (ZP + qh + pwd), sg * BIG, { fill: SIDE, 'fill-opacity': .1 });
        bpoly(gZones, sg * ZH, sg * (ZH + qh), -ZP, ZP, { fill: FLAP, 'fill-opacity': .2 });
        bpoly(gZones, sg * (ZH + qh), sg * BIG, -ZP, ZP, { fill: FLAP, 'fill-opacity': .1 });
        [ZP, ZP + qh, ZP + qh + pwd].forEach(function (z) {
          var a1 = Bp(-BIG, sg * z), a2 = Bp(BIG, sg * z);
          line(gFolds, a1, a2, { stroke: '#1c5aa0', 'stroke-width': U * .26, 'stroke-dasharray': (U * 1.4) + ' ' + (U * .8), 'stroke-linecap': 'round', opacity: .85 });
        });
        [ZH, ZH + qh].forEach(function (x) {
          var a1 = Bp(sg * x, -BIG), a2 = Bp(sg * x, BIG);
          line(gFolds, a1, a2, { stroke: '#1c5aa0', 'stroke-width': U * .26, 'stroke-dasharray': (U * 1.4) + ' ' + (U * .8), 'stroke-linecap': 'round', opacity: .85 });
        });
        blabel(0, sg * (ZP + qh / 2), '옆면', f1(qh), qh);
        blabel(0, sg * (ZP + qh + pwd / 2), '윗면', f1(pwd), pwd);
        blabel(sg * (ZH + qh / 2), 0, '끝 접기', f1(qh), qh);
      });
      blabel(0, 0, '바닥', f1(axl) + '×' + f1(pwd), Math.min(axl, pwd));
      var fp = [Bp(-ZH, -ZP), Bp(ZH, -ZP), Bp(ZH, ZP), Bp(-ZH, ZP)].map(function (q) { return q[0] + ',' + q[1]; }).join(' ');
      el('polygon', { points: fp, fill: 'none', stroke: INK, 'stroke-opacity': .55, 'stroke-width': U * .22, 'stroke-dasharray': (U * .8) + ' ' + (U * .6) }, gText);
      if (need.kind === 'cloth') {
        [[Sq * .09, Sq * .09], [Sq * .91, Sq * .09], [Sq * .91, Sq * .91], [Sq * .09, Sq * .91]].forEach(function (c, i) {
          el('circle', { cx: c[0], cy: c[1], r: U * 2.4, fill: '#e0ad3a', 'fill-opacity': .85, stroke: INK, 'stroke-width': U * .2 }, gText);
          text(gText, '매듭', c[0], c[1] + (c[1] < Sq / 2 ? U * 5 : -U * 5), U * 2.6, { fill: INK });
        });
      }
    } else if (need.shape === 'ball') {
      var bcx = nx / 2, br = need.r, ring = Math.PI * br;
      el('circle', { cx: bcx, cy: bcx, r: nx / 2, fill: RED, 'fill-opacity': .07 }, gZones);
      el('circle', { cx: bcx, cy: bcx, r: ring, fill: SIDE, 'fill-opacity': .2 }, gZones);
      el('circle', { cx: bcx, cy: bcx, r: br, fill: FLOOR, 'fill-opacity': .4 }, gZones);
      el('circle', { cx: bcx, cy: bcx, r: nx / 2, fill: 'none', stroke: RED, 'stroke-width': U * .3, 'stroke-dasharray': (U * 1.6) + ' ' + (U * 1) }, gFolds);
      el('circle', { cx: bcx, cy: bcx, r: ring, fill: 'none', stroke: '#1c5aa0', 'stroke-width': U * .26, 'stroke-dasharray': (U * 1.4) + ' ' + (U * .8) }, gFolds);
      text(gText, '공 놓는 자리', bcx, bcx - (br > U * 4 ? 0 : U * 3), Math.min(U * 3.2, br * .5 + U), { fill: INK });
      if (ring * pxCm > 40) text(gText, '여기까지 공을 덮어요', bcx, bcx + ring * .72, U * 2.8, { fill: INK, opacity: .8 });
      var gat = nx / 2 - ring;
      if (gat * pxCm > 22) text(gText, '모아서 묶는 끝', bcx, bcx - (ring + gat / 2), Math.min(U * 2.8, gat * .55), { fill: INK, opacity: .85 });
      text(gText, '둥글게 잘라요 (지름 ' + f1(nx) + ')', bcx, ny + U * 3.4, U * 3, { fill: CHALK });
    } else if (need.shape === 'prism') {
      var sp = need.s, ov = need.ovl, Ep = need.E, Lp = need.L, m0 = Ep, m1 = Ep + Lp;
      zone(0, ov, m0, m1, TOP, .24, '겹침', f1(ov), 22);
      zone(ov, ov + sp, m0, m1, SIDE, .28, '옆면', f1(sp), 30);
      zone(ov + sp, ov + 2 * sp, m0, m1, FLOOR, .32, '바닥', f1(sp), 30);
      zone(ov + 2 * sp, ov + 3 * sp, m0, m1, SIDE, .28, '옆면', f1(sp), 30);
      zone(0, A, 0, Ep, FLAP, .15, '끝 접기', f1(Ep), 34);
      zone(0, A, m1, L, FLAP, .15, '끝 접기', f1(Ep), 34);
      foldLines(fl.around.map(function (u) { return [P(u, 0), P(u, L)]; }));
      foldLines(fl.along.map(function (v) { return [P(0, v), P(A, v)]; }));
    } else if (need.shape === 'box') {
      var t = need.t, q2 = need.q, p = need.p, E = need.E, ax = need.axis;
      var main0 = E, main1 = E + ax;
      zone(0, t, main0, main1, TOP, .22, '윗면', f1(t));
      zone(t, t + q2, main0, main1, SIDE, .26, '옆면', f1(q2));
      zone(t + q2, t + q2 + p, main0, main1, FLOOR, .3, '바닥', f1(p));
      zone(t + q2 + p, t + 2 * q2 + p, main0, main1, SIDE, .26, '옆면', f1(q2));
      zone(A - t, A, main0, main1, TOP, .22, '윗면', f1(t));
      zone(0, A, 0, E, FLAP, .15, '끝 접기', f1(E), 34);
      zone(0, A, main1, L, FLAP, .15, '끝 접기', f1(E), 34);
      // 상자 자리
      var fr = RC(t + q2, t + q2 + p, main0, main1);
      rect(gText, { x: fr.x + U * .5, y: fr.y + U * .5, w: Math.max(0, fr.w - U), h: Math.max(0, fr.h - U) }, { fill: 'none', stroke: INK, 'stroke-opacity': .5, 'stroke-width': U * .22, 'stroke-dasharray': (U * .8) + ' ' + (U * .6), rx: U * .6 });
      foldLines(fl.around.map(function (u) { return [P(u, E), P(u, L - E)]; }).concat(fl.around.map(function (u) { return [P(u, 0), P(u, E)]; })).concat(fl.around.map(function (u) { return [P(u, L - E), P(u, L)]; })));
      foldLines(fl.along.map(function (v) { return [P(0, v), P(A, v)]; }));
      // 겹침 안내
      var ov = RC(0, 0.0001, 0, 0);
    } else {
      var Ee = need.shape === 'cyl' ? need.E : need.Eb;
      var top0 = Ee + need.h;
      var topLen = L - top0;
      var bodyLabel = need.shape === 'cyl' ? '몸통 · 둘레' : '병 몸통 · 둘레';
      zone(0, A, Ee, top0, SIDE, .22, bodyLabel + ' ' + f1(A - need.ovl), '(겹침 ' + f1(need.ovl) + ' 별도)', 30);
      zone(0, A, 0, Ee, need.shape === 'cyl' ? GATH : FLAP, .18, need.shape === 'cyl' ? '묶는 부분' : '바닥 접기', f1(Ee), 22);
      zone(0, A, top0, L, need.shape === 'cyl' ? GATH : GATH, .18, need.shape === 'cyl' ? '묶는 부분' : '병목 위', f1(topLen), 22);
      // 이음 겹침 띠
      var sr = RC(A - need.ovl, A, 0, L);
      rect(gZones, sr, { fill: 'url(#hatch)', opacity: .75 });
      foldLines(fl.along.map(function (v) { return [P(0, v), P(A, v)]; }));
      foldLines([[P(A - need.ovl, 0), P(A - need.ovl, L)]]);
    }
    function foldLines(list) {
      list.forEach(function (s) {
        line(gFolds, s[0], s[1], { stroke: '#1c5aa0', 'stroke-width': U * .26, 'stroke-dasharray': (U * 1.4) + ' ' + (U * .8), 'stroke-linecap': 'round', opacity: .85 });
      });
    }

    /* ── 눈금자 ── */
    var gRuler = el('g', null, svg);
    var tickMajor = niceStep(Math.max(nx, ny) / 7);
    var tickMinor = tickMajor / (tickMajor >= 5 ? 5 : (tickMajor >= 2 ? 2 : 1));
    var rcol = CHALK;
    for (var xv = 0; xv <= nx + 1e-6; xv += tickMinor) {
      var isMaj = Math.abs(xv / tickMajor - Math.round(xv / tickMajor)) < 1e-6;
      line(gRuler, [xv, 0], [xv, -U * (isMaj ? 1.6 : .8)], { stroke: rcol, 'stroke-width': U * .13, opacity: .75 });
      if (isMaj) text(gRuler, String(Math.round(xv)), xv, -U * 2.9, U * 1.9, { fill: rcol, opacity: .8, 'font-family': 'JetBrains Mono, monospace', 'font-weight': 500 });
    }
    for (var yv = 0; yv <= ny + 1e-6; yv += tickMinor) {
      var isMaj2 = Math.abs(yv / tickMajor - Math.round(yv / tickMajor)) < 1e-6;
      line(gRuler, [0, yv], [-U * (isMaj2 ? 1.6 : .8), yv], { stroke: rcol, 'stroke-width': U * .13, opacity: .75 });
      if (isMaj2 && yv > 0) text(gRuler, String(Math.round(yv)), -U * 3.2, yv, U * 1.9, { fill: rcol, opacity: .8, 'font-family': 'JetBrains Mono, monospace', 'font-weight': 500 });
    }

    /* ── 치수선 ── */
    var gDim = el('g', null, svg);
    var dimY = -U * 6.4, dimX = -U * 8.6;
    arrow(gDim, [0, dimY], [nx, dimY]);
    text(gDim, f1(nx) + ' cm', nx / 2, dimY - U * 2.3, U * 4, { fill: CHALK });
    arrow(gDim, [dimX, 0], [dimX, ny]);
    var ty = el('text', { x: dimX - U * 2.6, y: ny / 2, 'font-size': U * 4, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Gaegu, "Noto Sans KR", sans-serif', 'font-weight': 700, fill: CHALK, transform: 'rotate(-90 ' + (dimX - U * 2.6) + ' ' + (ny / 2) + ')' }, gDim, f1(ny) + ' cm');
    function arrow(parent, a, b) {
      var s = { stroke: CHALK, 'stroke-width': U * .2, opacity: .85 };
      line(parent, a, b, s);
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, h = U * 1.3;
      [[a, 1], [b, -1]].forEach(function (e) {
        var p0 = e[0], sg = e[1];
        var bx = p0[0] + ux * h * sg, by = p0[1] + uy * h * sg;
        line(parent, p0, [bx - uy * h * .5, by + ux * h * .5], s);
        line(parent, p0, [bx + uy * h * .5, by - ux * h * .5], s);
      });
      line(parent, [a[0] - uy * U, a[1] + ux * U], [a[0] + uy * U, a[1] - ux * U], s);
      line(parent, [b[0] - uy * U, b[1] + ux * U], [b[0] + uy * U, b[1] - ux * U], s);
    }

    /* ── 모자람 표시 ── */
    if (shX || shY) {
      var pw = pillW, ph = U * 6.4, px, py, hx, hy, ex, ey;
      if (shX) { px = nx + U * 5; py = ny * .5 - ph / 2; hx = sx + (nx - sx) / 2; hy = ny * .5; ex = px; ey = ny * .5; }
      else { px = nx / 2 - pw / 2; py = ny + U * 9; hx = nx / 2; hy = sy + (ny - sy) / 2; ex = nx / 2; ey = py; }
      line(svg, [hx, hy], [ex, ey], { stroke: RED, 'stroke-width': U * .35, 'stroke-linecap': 'round' });
      el('circle', { cx: hx, cy: hy, r: U * .9, fill: RED, stroke: '#fff', 'stroke-width': U * .25 }, svg);
      el('rect', { x: px, y: py, width: pw, height: ph, rx: ph / 2, fill: RED, stroke: '#fff', 'stroke-width': U * .3 }, svg);
      text(svg, shortMsg, px + pw / 2, py + ph / 2 + U * .1, U * 3.7, { fill: '#fff' });
    }

    /* ── 재단선 ── */
    var cutD = '', needCut = true;
    var cutRight = nx < sx - 1e-6 && !isNone;
    var cutBottom = (isRoll || ny < sy - 1e-6) && !isNone;
    if (isNone) {
      cutD = 'M0 0 H' + nx + ' V' + ny + ' H0 Z';
    } else if (cutRight && cutBottom) {
      cutD = 'M' + nx + ' 0 V' + ny + ' H0';
    } else if (cutRight) {
      cutD = 'M' + nx + ' 0 V' + ny;
    } else if (cutBottom) {
      cutD = 'M' + Math.min(nx, sx) + ' ' + ny + ' H0';
    } else needCut = false;

    // 윤곽(항상 보임: 접는 선과 구분되는 빨간 점선)
    el('rect', { x: 0, y: 0, width: nx, height: ny, fill: 'none', stroke: RED, 'stroke-width': U * .32, 'stroke-dasharray': (U * 1.6) + ' ' + (U * 1.0), 'stroke-linecap': 'round', opacity: needCut ? .95 : .55 }, gNeed);
    var cutPath = null, cutDone = null, scissors = null;
    if (needCut) {
      cutPath = el('path', { d: cutD, fill: 'none', stroke: 'none' }, svg);
      cutDone = el('path', { d: cutD, fill: 'none', stroke: RED, 'stroke-width': U * .55, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, svg);
      scissors = makeScissors(svg, U * 1.15);
      scissors.root.setAttribute('opacity', 0);
    }

    // 자를 곳 설명 꼬리표
    if (needCut && cutBottom && ny * pxCm > 70) {
      var lbx = nx / 2, lby = ny + U * 3.4;
      var lab = text(svg, isRoll ? '여기를 싹둑!' : '여기를 자르세요', lbx, lby, U * 3.6, { fill: '#ffd9d2' });
      lab.setAttribute('opacity', 0); lab.id = 'cut-label';
    }

    var cutLen = cutPath ? cutPath.getTotalLength() : 0;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var label = svg.querySelector('#cut-label');

    function frame(t) {
      // t: 초. 0~0.7 가위 등장, 0.7~4.0 자르기, 4.0~4.9 마무리
      var prog = ease((t - 0.7) / 3.3);
      var done = t > 4.0;
      if (cutPath) {
        var d = cutLen * prog;
        cutDone.setAttribute('stroke-dasharray', d + ' ' + (cutLen + 1));
        cutDone.setAttribute('opacity', prog > 0 ? 1 : 0);
        var pt = cutPath.getPointAtLength(Math.min(cutLen, d));
        var pt2 = cutPath.getPointAtLength(Math.min(cutLen, d + U * .6));
        var ang = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
        if (d + U * .6 > cutLen) { var pt0 = cutPath.getPointAtLength(Math.max(0, d - U * .6)); ang = Math.atan2(pt.y - pt0.y, pt.x - pt0.x) * 180 / Math.PI; }
        var open = 9 + 7 * Math.sin(t * 17) * (done ? 0 : 1);
        scissors.root.setAttribute('transform', 'translate(' + pt.x + ' ' + pt.y + ') rotate(' + ang + ')');
        scissors.bA.setAttribute('transform', 'rotate(' + open + ')');
        scissors.bB.setAttribute('transform', 'rotate(' + (-open) + ')');
        scissors.root.setAttribute('opacity', Math.max(0, Math.min(1, t / .5)) * (t > 4.5 ? Math.max(0, 1 - (t - 4.5) / .4) : 1));
        if (label) label.setAttribute('opacity', ease((t - 3.9) / .6));
        var lift = ease((t - 4.0) / .9);
        gNeed.setAttribute('transform', 'translate(' + (-U * .35 * lift) + ' ' + (-U * .45 * lift) + ')');
        gNeed.setAttribute('filter', lift > 0.02 ? 'url(#lift)' : '');
        gLeft.setAttribute('opacity', 1 - .35 * lift);
      }
    }

    anim.run = { frame: frame, end: 5.2 };
    if (reduce || !needCut || o.still) { frame(9); } else { play(); }
  }

  function play() {
    stop();
    var r = anim.run; if (!r) return;
    var t0 = performance.now();
    (function tick(now) {
      var t = (now - t0) / 1000;
      r.frame(t);
      if (t < r.end) anim.raf = requestAnimationFrame(tick); else { anim.raf = 0; r.frame(9); }
    })(t0);
  }

  function makeScissors(parent, s) {
    var root = el('g', null, parent);
    var sc = el('g', { transform: 'scale(' + (s / 8) + ')' }, root);
    function blade() {
      var b = el('g', null, sc);
      el('path', { d: 'M0 -1.5 L30 0 L0 1.5 Z', fill: '#e8eef1', stroke: '#7b8991', 'stroke-width': .5, 'stroke-linejoin': 'round' }, b);
      el('path', { d: 'M0 0 L-12 0', stroke: RED, 'stroke-width': 3, 'stroke-linecap': 'round' }, b);
      el('circle', { cx: -17, cy: 0, r: 5.2, fill: 'none', stroke: RED, 'stroke-width': 2.6 }, b);
      return b;
    }
    var bA = blade(), bB = blade();
    el('circle', { cx: 0, cy: 0, r: 1.6, fill: '#5a666d' }, sc);
    return { root: root, bA: bA, bB: bB };
  }

  g.Diagram = { render: render, replay: play, stop: stop };
})(window);
