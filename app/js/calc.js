/* 싹둑 — 포장지 계산 엔진
 * 모든 길이는 cm. "around"는 상자/통을 한 바퀴 감싸는 방향, "along"은 축 방향(양끝 마감 포함).
 * 근사값이므로 실제 포장 습관에 따라 ±1cm 정도 차이가 날 수 있다. */
(function (g) {
  'use strict';
  var PI = Math.PI;
  var TUCK = 1;            // 상자 끝면에서 접어 겹치는 여분
  var GATHER = 3;          // 원통 끝을 묶고 남기는 꽃잎 길이
  var BOTTLE_TOP = 9;      // 병 목 위로 올라오는 길이

  function round1(v) { return Math.round(v * 10) / 10; }
  function ceilHalf(v) { return Math.ceil(v * 2 - 1e-9) / 2; }   // 0.5cm 단위 올림

  /* ───── 모양별 "이상적인" 필요 종이 ───── */
  function needBox(dims, axisIdx, ovl) {
    var axis = dims[axisIdx];
    var cross = dims.filter(function (_, i) { return i !== axisIdx; }).sort(function (x, y) { return y - x; });
    var p = cross[0], q = cross[1];
    var E = q / 2 + TUCK;
    return {
      shape: 'box', axisIdx: axisIdx, axis: axis, p: p, q: q, E: E,
      t: (p + ovl) / 2, ovl: ovl,
      around: 2 * (p + q) + ovl,
      along: axis + 2 * E,
      surface: 2 * (dims[0] * dims[1] + dims[1] * dims[2] + dims[0] * dims[2])
    };
  }

  function needCyl(d, h, ovl) {
    var r = d / 2, E = r + GATHER;
    return {
      shape: 'cyl', d: d, r: r, h: h, E: E, ovl: ovl,
      around: PI * d + ovl,
      along: h + 2 * E,
      surface: 2 * PI * r * r + PI * d * h
    };
  }

  function needBottle(d, h, ovl) {
    var r = d / 2, Eb = r + TUCK;
    return {
      shape: 'bottle', d: d, r: r, h: h, Eb: Eb, T: BOTTLE_TOP, ovl: ovl,
      around: PI * d + ovl,
      along: h + Eb + BOTTLE_TOP,
      surface: PI * r * r + PI * d * h
    };
  }

  /* ───── 가진 포장지에 올려 보기 ─────
   * 그림에서 x = 포장지 폭 방향, y = 포장지 길이 방향.
   * orient 1: around가 x, along이 y / orient 2: 반대 */
  function fit(need, paper) {
    var A = need.around, L = need.along;
    var res;
    function make(orient, shortX, shortY, sheetX, sheetY, cutLen) {
      var nx = orient === 1 ? A : L, ny = orient === 1 ? L : A;
      return {
        orient: orient, needX: nx, needY: ny,
        shortX: shortX, shortY: shortY, short: shortX + shortY,
        sheetX: sheetX, sheetY: sheetY, cutLen: cutLen,
        ok: shortX + shortY < 1e-6
      };
    }
    if (!paper || paper.type === 'none') {
      res = make(1, 0, 0, A, L, L);
      res.paperType = 'none';
      res.used = A * L;
    } else if (paper.type === 'roll') {
      var R = paper.R;
      var f1 = make(1, Math.max(0, A - R), 0, R, L, L);
      var f2 = make(2, Math.max(0, L - R), 0, R, A, A);
      res = f1.short < f2.short - 1e-9 ? f1 : f2.short < f1.short - 1e-9 ? f2 : (f1.cutLen <= f2.cutLen ? f1 : f2);
      res.paperType = 'roll';
      res.used = res.sheetX * res.sheetY;       // 롤에서 잘라 내는 면적
      res.R = R;
    } else {
      var W = paper.W, H = paper.H;
      var s1 = make(1, Math.max(0, A - W), Math.max(0, L - H), W, H, H);
      var s2 = make(2, Math.max(0, L - W), Math.max(0, A - H), W, H, H);
      res = s1.short <= s2.short ? s1 : s2;
      res.paperType = 'sheet';
      res.used = W * H;
    }
    res.leftover = Math.max(0, res.sheetX * res.sheetY - res.needX * res.needY);
    return res;
  }

  /* 상자가 요구하는 한 번 더 자르기 위치(접는 선) */
  function folds(need) {
    if (need.shape === 'box') {
      var t = need.t, q = need.q, p = need.p;
      return {
        around: [t, t + q, t + q + p, t + 2 * q + p],
        along: [need.E, need.E + need.axis]
      };
    }
    if (need.shape === 'cyl') return { around: [], along: [need.E, need.E + need.h] };
    return { around: [], along: [need.Eb, need.Eb + need.h] };
  }

  function planOption(need, paper) {
    var f = fit(need, paper);
    var aroundNeed = need.around, alongNeed = need.along;
    var covered = Math.max(0, 1 - f.short / Math.max(1e-6, f.needX + f.needY));
    return {
      need: need, fit: f, folds: folds(need),
      around: aroundNeed, along: alongNeed,
      eff: Math.min(1, need.surface / (aroundNeed * alongNeed)),
      coverage: covered
    };
  }

  var AXIS_NAMES = ['가로 방향', '세로 방향', '높이 방향'];

  /* spec: {shape:'box'|'cyl'|'bottle', a,b,h,d, ovl, paper:{type,R,W,H}, axisPick:'auto'|0|1|2} */
  function plan(spec) {
    var ovl = spec.ovl == null ? 3 : spec.ovl;
    var opts = [];
    if (spec.shape === 'box') {
      var dims = [spec.a, spec.b, spec.h];
      for (var i = 0; i < 3; i++) {
        var o = planOption(needBox(dims, i, ovl), spec.paper);
        o.label = AXIS_NAMES[i];
        o.axisIdx = i;
        opts.push(o);
      }
    } else if (spec.shape === 'cyl') {
      opts.push(planOption(needCyl(spec.d, spec.h, ovl), spec.paper));
    } else {
      opts.push(planOption(needBottle(spec.d, spec.h, ovl), spec.paper));
    }
    var bestIdx = 0;
    for (var k = 1; k < opts.length; k++) {
      if (better(opts[k], opts[bestIdx])) bestIdx = k;
    }
    var pick = spec.axisPick;
    var chosen = (typeof pick === 'number' && opts[pick]) ? pick : bestIdx;
    return { options: opts, bestIdx: bestIdx, chosenIdx: chosen, chosen: opts[chosen], spec: spec };
  }

  function better(x, y) {
    if (x.fit.ok !== y.fit.ok) return x.fit.ok;
    if (!x.fit.ok) return x.fit.short < y.fit.short - 1e-9;
    var ux = x.fit.paperType === 'sheet' ? x.around * x.along : x.fit.used;
    var uy = y.fit.paperType === 'sheet' ? y.around * y.along : y.fit.used;
    return ux < uy - 1e-6;
  }

  g.Calc = { plan: plan, round1: round1, ceilHalf: ceilHalf, TUCK: TUCK, GATHER: GATHER, BOTTLE_TOP: BOTTLE_TOP };
})(window);
