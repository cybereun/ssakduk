/* 싹둑 — 사진으로 크기 재기 (A4 용지 기준, 대략)
 * 1) A4 모서리 4곳을 눌러 사진 속 평면을 실제 cm 좌표로 바꾸는 변환(호모그래피)을 만든다.
 * 2) 같은 평면 위의 두 점을 누르면 그 사이 거리를 cm로 알려 준다.
 * 사진은 이 기기 안에서만 처리하고 어디로도 보내지 않는다. */
(function (g) {
  'use strict';
  var A4W = 21, A4H = 29.7;
  var $ = function (id) { return document.getElementById(id); };

  /* ───── 수학 ───── */
  function solve(M, b) {                     // 가우스 소거법 (8x8)
    var n = b.length, i, j, k;
    for (i = 0; i < n; i++) {
      var piv = i;
      for (j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[piv][i])) piv = j;
      var tm = M[i]; M[i] = M[piv]; M[piv] = tm; var tb = b[i]; b[i] = b[piv]; b[piv] = tb;
      if (Math.abs(M[i][i]) < 1e-12) return null;
      for (j = i + 1; j < n; j++) {
        var f = M[j][i] / M[i][i];
        for (k = i; k < n; k++) M[j][k] -= f * M[i][k];
        b[j] -= f * b[i];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  }
  function homography(src, dst) {
    var M = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], X = dst[i][0], Y = dst[i][1];
      M.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
      M.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
    }
    var h = solve(M, b);
    return h ? [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] : null;
  }
  function mapPt(H, x, y) {
    var w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  }
  function dist(H, p, q) {
    var a = mapPt(H, p[0], p[1]), b = mapPt(H, q[0], q[1]);
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  /* ───── 화면 ───── */
  var S = null;       // 진행 상태

  function open(opts) {
    var ground = opts.fields.filter(function (f) { return f.plane === 'ground'; });
    var side = opts.fields.filter(function (f) { return f.plane === 'side'; });
    S = {
      opts: opts, photos: [], values: {}, photoIdx: 0, steps: [], stepIdx: 0, pts: [], H: null, img: null, view: null,
      plan: [{ plane: 'ground', fields: ground }].concat(side.length ? [{ plane: 'side', fields: side }] : []).filter(function (p) { return p.fields.length; })
    };
    $('photo-overlay').hidden = false;
    document.body.style.overflow = 'hidden';
    $('photo-result').hidden = true; $('photo-canvas-wrap').hidden = true; $('photo-actions').hidden = true;
    $('photo-fields').innerHTML = '';
    promptPhoto();
  }
  function close() {
    $('photo-overlay').hidden = true; document.body.style.overflow = '';
    S = null;
  }

  function promptPhoto() {
    var ph = S.plan[S.photoIdx];
    var msg = ph.plane === 'ground'
      ? '① 위에서 찍은 사진을 골라 주세요. 바닥에 놓인 선물과 A4 용지가 함께 보여야 해요.'
      : '② 옆에서 찍은 사진을 골라 주세요(높이를 잴 때). A4 용지를 선물 옆면에 바짝 세워 대고 찍어요. 건너뛰어도 돼요.';
    $('photo-step').textContent = msg;
    $('photo-skip').hidden = S.photoIdx === 0;
    $('photo-actions').hidden = S.photoIdx === 0;
    $('photo-canvas-wrap').hidden = true; S.img = null; S.H = null;
    $('photo-file').value = ''; updateList();
  }

  function loadFile(file) {
    if (!file || !S) return;
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      S.img = img;
      var ph = S.plan[S.photoIdx];
      S.steps = [{ type: 'cal' }].concat(ph.fields.map(function (f) { return { type: 'm', field: f }; }));
      S.stepIdx = 0; S.pts = []; S.H = null;
      var cv = $('photo-canvas'), maxW = 1100, sc = Math.min(1, maxW / img.naturalWidth);
      cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc);
      S.view = { sc: sc };
      $('photo-canvas-wrap').hidden = false; $('photo-actions').hidden = false;
      draw(); say();
      URL.revokeObjectURL(url);
    };
    img.onerror = function () { $('photo-step').textContent = '사진을 열 수 없어요. 다른 사진을 골라 주세요.'; };
    img.src = url;
  }

  function stepPoints(i) { return S.steps[i].type === 'cal' ? 4 : 2; }

  function say() {
    var st = S.steps[S.stepIdx], n = S.pts.length, t;
    if (st.type === 'cal') {
      var hints = ['A4의 한 모서리', 'A4의 다음 모서리 (짧은 변 21cm 방향)', 'A4의 세 번째 모서리 (시계 방향)', 'A4의 마지막 모서리'];
      t = '① 기준 만들기: A4 용지 모서리 4곳을 눌러요 (' + (n + 1) + '/4) — ' + hints[n] + '. 4곳을 다 누르면 A4 크기를 기준으로 삼아요(이 단계에서는 길이가 나오지 않아요).';
    } else {
      t = '“' + st.field.label + '”의 양 끝 두 점을 눌러요 (' + (n + 1) + '/2). ' + (S.plan[S.photoIdx].plane === 'ground' ? '선물이 바닥에 닿은 가장자리를 따라 눌러요.' : 'A4와 같은 면에서 위아래 끝을 눌러요.');
    }
    if (S.flash) { t = S.flash + ' ' + t; S.flash = ''; }
    $('photo-step').textContent = t;
    updateList();
  }

  function updateList() {
    var ul = $('photo-list'); if (!ul) return;
    ul.innerHTML = '';
    var ph = S.plan[S.photoIdx]; if (!ph || !S.img) return;
    var calOk = !!S.H;
    var li0 = document.createElement('li'); li0.className = calOk ? 'ok' : 'now';
    li0.textContent = (calOk ? '✓ ' : '• ') + 'A4 기준 ' + (calOk ? '완료' : '(4점)');
    ul.appendChild(li0);
    ph.fields.forEach(function (f, i) {
      var li = document.createElement('li'), v = S.values[f.k];
      var cur = S.steps[S.stepIdx] && S.steps[S.stepIdx].field === f;
      li.className = v != null ? 'ok' : (cur ? 'now' : '');
      li.textContent = (v != null ? '✓ ' : '• ') + f.label + ' ' + (v != null ? v.toFixed(1) + ' cm' : '(2점)');
      ul.appendChild(li);
    });
    var any = ph.fields.some(function (f) { return S.values[f.k] != null; });
    $('photo-finish').hidden = !any;
  }

  function draw() {
    var cv = $('photo-canvas'), ctx = cv.getContext('2d'), sc = S.view.sc;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(S.img, 0, 0, cv.width, cv.height);
    var r = Math.max(5, cv.width / 130);
    ctx.lineWidth = Math.max(2, r / 2.5); ctx.font = 'bold ' + Math.round(r * 2.2) + 'px sans-serif';
    // 확정된 단계들 + 현재
    var all = S.done || [];
    function mark(p, label, color) {
      ctx.fillStyle = color; ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.arc(p[0] * sc, p[1] * sc, r, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText(label, p[0] * sc + r + 3, p[1] * sc - r); ctx.fillText(label, p[0] * sc + r + 3, p[1] * sc - r); ctx.lineWidth = Math.max(2, r / 2.5);
    }
    all.forEach(function (d) {
      if (d.type === 'cal') {
        ctx.strokeStyle = '#ff5b4a'; ctx.beginPath();
        d.pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0] * sc, p[1] * sc); else ctx.moveTo(p[0] * sc, p[1] * sc); });
        ctx.closePath(); ctx.stroke();
        d.pts.forEach(function (p, i) { mark(p, String(i + 1), '#ff5b4a'); });
      } else {
        ctx.strokeStyle = '#4db8ff'; ctx.beginPath(); ctx.moveTo(d.pts[0][0] * sc, d.pts[0][1] * sc); ctx.lineTo(d.pts[1][0] * sc, d.pts[1][1] * sc); ctx.stroke();
        d.pts.forEach(function (p) { mark(p, '', '#4db8ff'); });
        var mx = (d.pts[0][0] + d.pts[1][0]) / 2 * sc, my = (d.pts[0][1] + d.pts[1][1]) / 2 * sc;
        var tx = d.field.label + ' ' + d.cm.toFixed(1) + 'cm';
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeText(tx, mx + 6, my - 6); ctx.fillText(tx, mx + 6, my - 6);
        ctx.lineWidth = Math.max(2, r / 2.5);
      }
    });
    var st = S.steps[S.stepIdx];
    if (st) S.pts.forEach(function (p, i) { mark(p, st.type === 'cal' ? String(i + 1) : '', st.type === 'cal' ? '#ff5b4a' : '#4db8ff'); });
  }

  function onTap(e) {
    if (!S || !S.img) return;
    var cv = $('photo-canvas'), rc = cv.getBoundingClientRect();
    var x = (e.clientX - rc.left) / rc.width * cv.width / S.view.sc, y = (e.clientY - rc.top) / rc.height * cv.height / S.view.sc;
    S.done = S.done || [];
    S.pts.push([x, y]);
    var st = S.steps[S.stepIdx];
    if (S.pts.length >= stepPoints(S.stepIdx)) {
      if (st.type === 'cal') {
        var H = homography(S.pts, [[0, 0], [A4W, 0], [A4W, A4H], [0, A4H]]);
        if (!H) { S.pts = []; $('photo-step').textContent = 'A4 모서리를 다시 눌러 주세요(점이 한 줄에 놓이면 안 돼요).'; draw(); return; }
        S.H = H; S.done.push({ type: 'cal', pts: S.pts.slice() });
        S.flash = '✓ A4 기준이 잡혔어요!';
      } else {
        var cm = dist(S.H, S.pts[0], S.pts[1]);
        S.values[st.field.k] = Math.round(cm * 10) / 10;
        S.flash = '✓ ' + st.field.label + ' ' + (Math.round(cm * 10) / 10).toFixed(1) + ' cm로 쟀어요.';
        S.done.push({ type: 'm', field: st.field, pts: S.pts.slice(), cm: cm });
      }
      S.pts = []; S.stepIdx++;
      if (S.stepIdx >= S.steps.length) { nextPhotoOrFinish(); draw(); return; }
    }
    draw(); say();
  }

  function nextPhotoOrFinish() {
    S.photoIdx++;
    S.done = [];
    if (S.photoIdx < S.plan.length) { promptPhoto(); }
    else finish();
  }

  function finish() {
    $('photo-step').textContent = '측정이 끝났어요. 숫자는 직접 고칠 수 있어요.';
    var host = $('photo-fields'); host.innerHTML = '';
    S.opts.fields.forEach(function (f) {
      var measured = S.values[f.k] != null, v = measured ? S.values[f.k] : S.opts.current[f.k];
      var row = document.createElement('div'); row.className = 'field'; row.style.gridTemplateColumns = '56px minmax(0,1fr)';
      row.innerHTML = '<label for="ph-' + f.k + '">' + f.label + '</label><div style="display:flex;align-items:center;gap:8px"><span class="num"><input id="ph-' + f.k + '" type="number" step="0.1" min="' + f.min + '" max="' + f.max + '" value="' + v + '"></span><span class="unit-tag">' + (measured ? '사진에서 잰 값(대략)' : '그대로 두기') + '</span></div>';
      host.appendChild(row);
    });
    $('photo-result').hidden = false;
    var rs = $('photo-result'); if (rs.scrollIntoView) rs.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function resetPoints() {
    if (!S || !S.img) return;
    var ph = S.plan[S.photoIdx];
    ph.fields.forEach(function (f) { delete S.values[f.k]; });
    S.stepIdx = 0; S.pts = []; S.H = null; S.done = []; S.flash = '모든 점을 지웠어요. 처음부터 다시 눌러 주세요.';
    $('photo-result').hidden = true;
    draw(); say();
  }

  function earlyFinish() {
    if (!S) return;
    S.done = []; S.pts = []; S.photoIdx = S.plan.length;
    finish();
  }

  function undo() {
    if (!S || !S.img) return;
    if (S.pts.length) { S.pts.pop(); draw(); say(); return; }
    if (S.done && S.done.length) {
      var d = S.done.pop(); S.stepIdx = Math.max(0, S.stepIdx - 1);
      if (d.type === 'm') delete S.values[d.field.k];
      S.pts = d.pts.slice(0, d.pts.length - 1); draw(); say();
    }
  }

  function init() {
    $('photo-file').addEventListener('change', function () { loadFile(this.files && this.files[0]); });
    $('photo-canvas').addEventListener('click', onTap);
    $('photo-undo').addEventListener('click', undo);
    $('photo-reset').addEventListener('click', resetPoints);
    $('photo-finish').addEventListener('click', earlyFinish);
    $('photo-skip').addEventListener('click', function () { if (!S) return; S.photoIdx = S.plan.length; S.done = []; finish(); });
    $('photo-close').addEventListener('click', close);
    $('photo-overlay').addEventListener('click', function (e) { if (e.target === this) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S) close(); });
    $('photo-apply').addEventListener('click', function () {
      if (!S) return;
      var vals = {};
      S.opts.fields.forEach(function (f) {
        var inp = $('ph-' + f.k); var v = inp ? parseFloat(inp.value) : NaN;
        if (!isNaN(v)) vals[f.k] = Math.max(f.min, Math.min(f.max, Math.round(v * 10) / 10));
      });
      var cb = S.opts.onApply; close(); if (cb) cb(vals);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  g.Photo = { open: open, _homography: homography, _map: mapPt, _dist: dist };
})(window);
