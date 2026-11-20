/* 싹둑 — 화면 연결 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var Calc = window.Calc, Diagram = window.Diagram, Stage = window.Stage;

  var DIMS = {
    box: [{ k: 'a', label: '가로', min: 2, max: 90 }, { k: 'b', label: '세로', min: 2, max: 90 }, { k: 'h', label: '높이', min: 1, max: 60 }],
    cyl: [{ k: 'd', label: '지름', min: 2, max: 40 }, { k: 'h', label: '높이', min: 2, max: 60 }],
    bottle: [{ k: 'd', label: '지름', min: 3, max: 16 }, { k: 'h', label: '높이', min: 12, max: 50 }]
  };
  var PRESETS = {
    box: [['신발 상자', 33, 20, 12], ['책', 21, 15, 3], ['케이크 상자', 25, 25, 12], ['큰 박스', 60, 40, 30]],
    cyl: [['머그컵', 8.5, 10], ['텀블러', 7.5, 20], ['캔들', 9, 11]],
    bottle: [['와인', 7.5, 30], ['양주', 9, 28], ['소주', 6.5, 21]]
  };
  var PATTERN_NAMES = [['red', '빨강 별'], ['kraft', '크라프트'], ['snow', '눈꽃'], ['stripe', '사탕 줄무늬'], ['plaid', '체크'], ['pine', '전나무']];
  var RIBBONS = [['#d3342a', '빨강'], ['#e0ad3a', '금색'], ['#f4efe4', '흰색'], ['#1f6a4d', '초록']];
  var ROLL_CHIPS = [40, 50, 70, 100];
  var SHEET_CHIPS = [['A2', 42, 59.4], ['A1', 59.4, 84.1], ['50×70', 50, 70], ['전지', 78.8, 109.1]];

  var state = {
    shape: 'box',
    dims: { box: { a: 33, b: 20, h: 12 }, cyl: { d: 8.5, h: 10 }, bottle: { d: 7.5, h: 30 } },
    paper: { type: 'roll', R: 70, W: 59.4, H: 84.1 },
    ovl: 3, axisPick: 'auto', pattern: 'red', ribbon: 1, tab: 'cut', folds: true
  };
  var plan = null, needs3d = true, rebuildTimer = 0, queued = false, queuedAnim = false;

  function f1(v) { var r = Math.round(v * 10) / 10; return (r % 1 === 0) ? String(r) : r.toFixed(1); }
  function up(v) { return Calc.ceilHalf(v); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function el(tag, attrs, html) { var n = document.createElement(tag); if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]); if (html != null) n.innerHTML = html; return n; }

  /* ───────── 테마 ───────── */
  (function theme() {
    var root = document.documentElement, btn = $('theme-btn');
    try { var saved = localStorage.getItem('ssakduk-theme'); if (saved) root.setAttribute('data-theme', saved); } catch (e) { }
    btn.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('ssakduk-theme', next); } catch (e) { }
    });
  })();

  /* ───────── 입력 만들기 ───────── */
  function numField(id, label, val, min, max, step, onChange) {
    var wrap = el('div', { 'class': 'field' });
    var lab = el('label', { 'for': id + '-n' }, label);
    var rng = el('input', { type: 'range', id: id + '-r', min: min, max: max, step: step, value: val, 'aria-label': label + ' 슬라이더' });
    var box = el('div', { 'class': 'num' });
    var minus = el('button', { type: 'button', 'aria-label': label + ' 줄이기' }, '−');
    var inp = el('input', { type: 'number', id: id + '-n', inputmode: 'decimal', min: min, max: max, step: step, value: val });
    var plus = el('button', { type: 'button', 'aria-label': label + ' 늘리기' }, '+');
    box.appendChild(minus); box.appendChild(inp); box.appendChild(plus);
    wrap.appendChild(lab); wrap.appendChild(rng); wrap.appendChild(box);
    function set(v, fromNum) {
      if (isNaN(v)) return;
      v = clamp(Math.round(v * 10) / 10, min, max);
      rng.value = v; if (!fromNum) inp.value = v;
      onChange(v);
    }
    rng.addEventListener('input', function () { set(parseFloat(rng.value)); });
    inp.addEventListener('input', function () { var v = parseFloat(inp.value); if (!isNaN(v) && v >= min && v <= max) set(v, true); });
    inp.addEventListener('blur', function () { var v = parseFloat(inp.value); if (isNaN(v)) v = parseFloat(rng.value); set(v); });
    minus.addEventListener('click', function () { set(parseFloat(inp.value) - step); });
    plus.addEventListener('click', function () { set(parseFloat(inp.value) + step); });
    wrap.setValue = function (v) { rng.value = v; inp.value = v; };
    return wrap;
  }

  var dimEls = {};
  function buildDims() {
    var host = $('dims'); host.innerHTML = ''; dimEls = {};
    DIMS[state.shape].forEach(function (d) {
      var f = numField('dim-' + d.k, d.label, state.dims[state.shape][d.k], d.min, d.max, .5, function (v) {
        state.dims[state.shape][d.k] = v; state.axisPick = 'auto'; refreshPresets(); schedule();
      });
      dimEls[d.k] = f; host.appendChild(f);
    });
    var pr = $('presets'); pr.innerHTML = '';
    PRESETS[state.shape].forEach(function (p, i) {
      var vals = p.slice(1);
      var b = el('button', { type: 'button', 'class': 'chip', 'data-i': i }, esc(p[0]) + '<small>' + vals.join('×') + '</small>');
      b.addEventListener('click', function () {
        var keys = DIMS[state.shape].map(function (d) { return d.k; });
        keys.forEach(function (k, n) { state.dims[state.shape][k] = vals[n]; dimEls[k].setValue(vals[n]); });
        state.axisPick = 'auto'; refreshPresets(); schedule(true);
      });
      pr.appendChild(b);
    });
    refreshPresets();
  }
  function refreshPresets() {
    var keys = DIMS[state.shape].map(function (d) { return d.k; });
    Array.prototype.forEach.call($('presets').children, function (b, i) {
      var p = PRESETS[state.shape][i].slice(1);
      var on = keys.every(function (k, n) { return Math.abs(state.dims[state.shape][k] - p[n]) < 1e-6; });
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function buildPaper() {
    var host = $('paper-fields'); host.innerHTML = '';
    var P = state.paper;
    if (P.type === 'roll') {
      host.appendChild(numField('roll', '폭', P.R, 20, 150, 1, function (v) { P.R = v; refreshChips(); schedule(); }));
      var row = el('div', { 'class': 'presets', style: 'margin-top:2px;padding-top:10px' });
      ROLL_CHIPS.forEach(function (v) {
        var b = el('button', { type: 'button', 'class': 'chip', 'data-v': v }, v + '<small>cm</small>');
        b.addEventListener('click', function () { P.R = v; buildPaper(); schedule(true); });
        row.appendChild(b);
      });
      host.appendChild(row);
      host.appendChild(el('p', { 'class': 'note' }, '롤은 길이를 마음대로 자를 수 있어서 폭만 정하면 돼요.'));
    } else if (P.type === 'sheet') {
      host.appendChild(numField('sw', '가로', P.W, 10, 200, .5, function (v) { P.W = v; refreshChips(); schedule(); }));
      host.appendChild(numField('sh', '세로', P.H, 10, 200, .5, function (v) { P.H = v; refreshChips(); schedule(); }));
      var row2 = el('div', { 'class': 'presets', style: 'margin-top:2px;padding-top:10px' });
      SHEET_CHIPS.forEach(function (s) {
        var b = el('button', { type: 'button', 'class': 'chip', 'data-w': s[1], 'data-h': s[2] }, s[0] + '<small>' + s[1] + '×' + s[2] + '</small>');
        b.addEventListener('click', function () { P.W = s[1]; P.H = s[2]; buildPaper(); schedule(true); });
        row2.appendChild(b);
      });
      host.appendChild(row2);
    } else {
      host.appendChild(el('p', { 'class': 'note' }, '종이 크기를 정하지 않고, 딱 맞는 크기만 계산해요. 가게에서 포장지를 고르기 전에 써 보세요.'));
    }
    refreshChips();
  }
  function refreshChips() {
    var P = state.paper;
    Array.prototype.forEach.call($('paper-fields').querySelectorAll('.chip'), function (b) {
      var on = P.type === 'roll' ? Math.abs(P.R - parseFloat(b.getAttribute('data-v'))) < 1e-6
        : (Math.abs(P.W - parseFloat(b.getAttribute('data-w'))) < 1e-6 && Math.abs(P.H - parseFloat(b.getAttribute('data-h'))) < 1e-6);
      b.classList.toggle('on', on);
    });
  }

  function buildSwatches() {
    var ph = $('patterns'); ph.innerHTML = '';
    PATTERN_NAMES.forEach(function (p) {
      var b = el('button', { type: 'button', 'class': 'sw', role: 'radio', 'aria-checked': p[0] === state.pattern ? 'true' : 'false', title: p[1], 'aria-label': p[1], 'data-p': p[0] });
      try { b.appendChild(Stage.patternThumb(p[0], 88)); } catch (e) { }
      b.addEventListener('click', function () {
        state.pattern = p[0];
        Array.prototype.forEach.call(ph.children, function (c) { c.setAttribute('aria-checked', c === b ? 'true' : 'false'); });
        needs3d = true; schedule3d(true);
      });
      ph.appendChild(b);
    });
    var rh = $('ribbons'); rh.innerHTML = '';
    RIBBONS.forEach(function (r, i) {
      var b = el('button', { type: 'button', 'class': 'sw ribbon', role: 'radio', 'aria-checked': i === state.ribbon ? 'true' : 'false', title: r[1], 'aria-label': r[1] + ' 리본' });
      b.style.setProperty('--c', r[0]); b.appendChild(el('i'));
      b.addEventListener('click', function () {
        state.ribbon = i;
        Array.prototype.forEach.call(rh.children, function (c) { c.setAttribute('aria-checked', c === b ? 'true' : 'false'); });
        needs3d = true; schedule3d(true);
      });
      rh.appendChild(b);
    });
  }

  /* ───────── 이벤트 ───────── */
  $('shapes').addEventListener('click', function (e) {
    var b = e.target.closest('.shape'); if (!b) return;
    state.shape = b.getAttribute('data-shape'); state.axisPick = 'auto';
    Array.prototype.forEach.call($('shapes').children, function (c) { c.setAttribute('aria-checked', c === b ? 'true' : 'false'); });
    buildDims(); schedule(true);
  });
  $('paper-type').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    state.paper.type = b.getAttribute('data-type');
    Array.prototype.forEach.call($('paper-type').children, function (c) { c.setAttribute('aria-checked', c === b ? 'true' : 'false'); });
    buildPaper(); schedule(true);
  });
  $('ovl').addEventListener('input', function () {
    state.ovl = parseFloat(this.value); $('ovl-out').textContent = f1(state.ovl) + ' cm'; schedule();
  });
  $('chk-folds').addEventListener('change', function () {
    state.folds = this.checked;
    var g = document.getElementById('folds'); if (g) g.style.display = this.checked ? '' : 'none';
  });
  $('btn-recut').addEventListener('click', function () { Diagram.replay(); });
  $('tab-cut').addEventListener('click', function () { setTab('cut'); });
  $('tab-wrap').addEventListener('click', function () { setTab('wrap'); });

  /* ───────── 계산 → 화면 ───────── */
  function currentSpec() {
    var d = state.dims[state.shape], P = state.paper;
    var paper = P.type === 'roll' ? { type: 'roll', R: P.R } : P.type === 'sheet' ? { type: 'sheet', W: P.W, H: P.H } : { type: 'none' };
    var s = { shape: state.shape, ovl: state.ovl, paper: paper, axisPick: state.axisPick };
    if (state.shape === 'box') { s.a = d.a; s.b = d.b; s.h = d.h; } else { s.d = d.d; s.h = d.h; }
    return s;
  }

  function schedule(anim) {
    queuedAnim = queuedAnim || !!anim;
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; var a = queuedAnim; queuedAnim = false; update(a); });
  }

  function update(anim) {
    plan = Calc.plan(currentSpec());
    var opt = plan.chosen;
    renderResult(opt);
    renderOptions();
    renderSteps(opt);
    Diagram.render($('cut'), opt, { folds: state.folds, still: !anim });
    fitStage();
    needs3d = true;
    if (state.tab === 'wrap') schedule3d(true);
  }

  function fitStage() {
    var st = $('stage'), svg = $('cut');
    if (state.tab !== 'cut') { st.style.removeProperty('--ar'); st.style.removeProperty('--ar-m'); return; }
    var ar = parseFloat(svg.getAttribute('data-ar')) || 1.6;
    st.style.setProperty('--ar', String(clamp(ar, .75, 1.7)));
    st.style.setProperty('--ar-m', String(clamp(ar, .8, 1.15)));
  }

  function renderResult(opt) {
    var f = opt.fit, need = opt.need;
    $('r-w').textContent = f1(up(f.needX));
    $('r-h').textContent = f1(up(f.needY));
    var st = $('r-status');
    var short = Math.max(f.shortX, f.shortY, f.short);
    if (f.paperType === 'none') { st.className = 'status free'; st.textContent = '크기 제한 없음'; }
    else if (f.ok) { st.className = 'status ok'; st.textContent = '✓ 딱 맞아요'; }
    else { st.className = 'status bad'; st.textContent = '😱 ' + shortWords(f, false) + ' 모자라요'; }

    var eff = Math.round(opt.eff * 100);
    $('r-eff').innerHTML = eff + '<small>%</small>';
    var stars = f.ok || f.paperType === 'none' ? (opt.eff >= .72 ? 3 : opt.eff >= .55 ? 2 : 1) : 0;
    $('r-stars').innerHTML = [0, 1, 2].map(function (i) { return '<span class="' + (i < stars ? '' : 'off') + '">★</span>'; }).join('');

    var leftLabel = '남는 종이', leftVal = '없음';
    if (f.paperType === 'roll') {
      leftLabel = '롤에서 남는 띠';
      var strip = f.sheetX - f.needX;
      leftVal = strip > .5 ? f1(strip) + '<small>cm 폭</small>' : '없음';
    } else if (f.paperType === 'sheet') {
      leftLabel = '낱장에서 남는 종이';
      leftVal = f.leftover > 5 ? Math.round(f.leftover).toLocaleString('ko-KR') + '<small>㎠</small>' : '없음';
    } else { leftLabel = '이용률 기준'; leftVal = '상자 표면적'; }
    $('r-left-label').textContent = leftLabel;
    $('r-left').innerHTML = leftVal;
    if (f.paperType === 'none') $('r-left').style.fontSize = '15px'; else $('r-left').style.fontSize = '';

    // 설명 글
    var N = need, axisTxt = '';
    if (N.shape === 'box') axisTxt = '<b>' + opt.label + '</b>으로 감싸는 방법이에요. ';
    var msg;
    if (f.paperType === 'none') {
      msg = axisTxt + '이 크기로 잘라 쓰면 돼요. 이음새가 ' + f1(N.ovl) + 'cm 겹치도록 계산했어요.';
    } else if (f.paperType === 'roll') {
      if (f.ok) {
        msg = axisTxt + '롤 폭 ' + f1(f.R) + 'cm에서 <b>' + f1(up(f.cutLen)) + 'cm</b>만큼 잘라 쓰세요.' +
          (f.sheetX - f.needX > .5 ? ' 폭은 ' + f1(up(f.needX)) + 'cm만 쓰고 ' + f1(f.sheetX - f.needX) + 'cm가 남아요.' : '');
      } else {
        msg = axisTxt + '롤 폭 ' + f1(f.R) + 'cm로는 <b>' + shortWords(f, true) + ' 모자라요</b>. ' + betterHint(opt);
      }
    } else {
      if (f.ok) msg = axisTxt + f1(f.sheetX) + '×' + f1(f.sheetY) + 'cm 낱장 한 장으로 충분해요.';
      else msg = axisTxt + f1(f.sheetX) + '×' + f1(f.sheetY) + 'cm 한 장으로는 <b>' + shortWords(f, true) + ' 모자라요</b>. ' + betterHint(opt);
    }
    $('r-note').innerHTML = msg;
  }

  function shortWords(f, bold) {
    var p = [];
    if (f.shortX > .05) p.push('폭 ' + f1(Math.ceil(f.shortX * 2) / 2) + 'cm');
    if (f.shortY > .05) p.push('길이 ' + f1(Math.ceil(f.shortY * 2) / 2) + 'cm');
    return p.join(' · ');
  }

  function betterHint(opt) {
    var best = plan.options[plan.bestIdx];
    if (plan.options.length > 1 && best.fit.ok) return '아래에서 <b>' + best.label + '</b>으로 바꾸면 맞아요.';
    var f = opt.fit;
    if (f.paperType === 'roll') {
      var needR = Math.min(opt.around, opt.along);
      return '폭 ' + f1(Math.ceil(needR)) + 'cm 이상 롤을 쓰거나, 두 장을 이어 붙여야 해요.';
    }
    return '더 큰 포장지를 고르거나 두 장을 이어 붙여야 해요.';
  }

  function renderOptions() {
    var card = $('options-card'), host = $('options');
    if (plan.options.length < 2) { card.hidden = true; return; }
    card.hidden = false; host.innerHTML = '';
    plan.options.forEach(function (o, i) {
      var b = el('button', { type: 'button', 'class': 'opt', role: 'radio', 'aria-checked': i === plan.chosenIdx ? 'true' : 'false' });
      var badge = '';
      if (!o.fit.ok) badge = '<span class="o-badge bad">' + shortWords(o.fit) + ' 부족</span>';
      else if (i === plan.bestIdx) badge = '<span class="o-badge">가장 알뜰</span>';
      b.innerHTML = badge + '<span class="o-name">' + o.label + '으로 감싸기</span>' +
        '<span class="o-size">' + f1(up(o.fit.needX)) + ' × ' + f1(up(o.fit.needY)) + '</span>' +
        '<span class="o-sub">이용률 ' + Math.round(o.eff * 100) + '%</span>';
      b.addEventListener('click', function () { state.axisPick = i; schedule(true); });
      host.appendChild(b);
    });
  }

  function renderSteps(opt) {
    var f = opt.fit, N = opt.need, ol = $('steps'), items = [];
    var around = up(opt.around), along = up(opt.along);
    var edge = f.paperType === 'roll' ? '롤 끝' : '종이 모서리';
    items.push('포장지를 <b>무늬 없는 뒷면이 위</b>로 오게 펴 놓아요. 뒷면 격자를 따라 자르면 편해요.');
    if (f.paperType === 'roll') {
      items.push(edge + '에서 <b>' + f1(up(f.cutLen)) + ' cm</b> 되는 곳을 폭 방향으로 가로질러 싹둑 잘라요.' + (f.sheetX - f.needX > .5 ? ' 그다음 폭을 <b>' + f1(up(f.needX)) + ' cm</b>만 남기고 한 번 더 잘라요.' : ''));
    } else if (f.paperType === 'sheet') {
      items.push('낱장의 한쪽 모서리에서 <b>' + f1(up(f.needX)) + ' × ' + f1(up(f.needY)) + ' cm</b> 크기로 선을 그어 잘라요.');
    } else {
      items.push('<b>' + f1(around) + ' × ' + f1(along) + ' cm</b> 크기로 잘라요. 둘레 방향이 <b>' + f1(around) + ' cm</b>예요.');
    }
    if (N.shape === 'box') {
      var t = N.t, q = N.q, p = N.p;
      items.push('둘레 방향 끝에서 <b>' + f1(t) + '</b> · <b>' + f1(t + q) + '</b> · <b>' + f1(t + q + p) + '</b> · <b>' + f1(t + 2 * q + p) + ' cm</b> 지점을 접는 선으로 살짝 접어 자국을 내요.');
      items.push('가운데 칸(폭 <b>' + f1(p) + ' cm</b>)에 상자를 올리고, 양옆을 감싸 윗면에서 <b>' + f1(N.ovl) + ' cm</b> 겹쳐 테이프로 붙여요.');
      items.push('양쪽 끝에는 <b>' + f1(N.E) + ' cm</b>씩 남아요. 옆날개 → 아래 날개 → 위 날개 순서로 접어 테이프로 고정해요.');
      var rib = 2 * (p + q) + 2 * (N.axis + q) + 30;
      items.push('리본은 십자로 두르고 매듭까지 <b>약 ' + f1(Math.ceil(rib / 5) * 5) + ' cm</b> 있으면 돼요.');
    } else if (N.shape === 'cyl') {
      items.push('통을 종이 한쪽 가장자리에 놓고 돌돌 말아요. 끝에서 <b>' + f1(N.ovl) + ' cm</b>는 겹쳐 테이프로 붙여요.');
      items.push('양쪽 끝에 <b>' + f1(N.E) + ' cm</b>씩 남겨 한 점으로 오므리고, 리본으로 묶어요. 묶고 남은 <b>' + f1(Calc.GATHER) + ' cm</b>는 꽃잎처럼 펴져요.');
      items.push('리본은 양쪽 합쳐 <b>약 70 cm</b> 있으면 돼요.');
    } else {
      items.push('병을 종이 한쪽 가장자리에 놓고 돌돌 말아요. 끝에서 <b>' + f1(N.ovl) + ' cm</b>는 겹쳐 붙여요.');
      items.push('바닥 쪽 <b>' + f1(N.Eb) + ' cm</b>는 주름을 잡아 눌러 접고 테이프로 고정해요. 위쪽 <b>' + f1(N.T) + ' cm</b>는 병목에서 모아 리본으로 묶어요.');
      items.push('리본은 <b>약 55 cm</b> 있으면 돼요.');
    }
    ol.innerHTML = items.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    $('steps-sub').textContent = (N.shape === 'box' ? opt.label + ' 기준' : '근사 계산');
  }

  /* ───────── 탭 · 3D ───────── */
  var glReady = false, glFailed = false, dragging = false;

  function setTab(name) {
    state.tab = name;
    var wrap = name === 'wrap';
    $('tab-cut').setAttribute('aria-selected', wrap ? 'false' : 'true');
    $('tab-wrap').setAttribute('aria-selected', wrap ? 'true' : 'false');
    $('panel-cut').hidden = wrap; $('panel-wrap').hidden = !wrap;
    $('tools-cut').hidden = wrap; $('tools-wrap').hidden = !wrap;
    fitStage();
    if (wrap) {
      if (!glReady && !glFailed) {
        glReady = Stage.init($('gl'));
        if (!glReady) glFailed = true;
        else bindPlayer();
      }
      $('gl-fail').hidden = !glFailed;
      $('player').hidden = glFailed; $('step-chips').hidden = glFailed;
      if (glReady) { Stage.setVisible(true); schedule3d(true); }
    } else {
      if (glReady) { Stage.setVisible(false); Stage.pause(); }
      $('player').hidden = true; $('step-chips').hidden = true;
      Diagram.render($('cut'), plan.chosen, { folds: state.folds, still: true });
      fitStage();
    }
  }

  function schedule3d(play) {
    if (state.tab !== 'wrap' || !glReady) return;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(function () { build3d(play); }, 220);
  }

  function build3d(play) {
    if (!plan || !needs3d) return;
    needs3d = false;
    Stage.setAuto($('chk-auto').checked);
    var ok = Stage.show(plan.chosen, { pattern: state.pattern, ribbon: parseInt(RIBBONS[state.ribbon][0].slice(1), 16) });
    if (!ok) return;
    buildStepChips(); buildMarks();
    $('gl-hint').style.opacity = 1;
    setTimeout(function () { $('gl-hint').style.opacity = 0; }, 5000);
    if (play) { Stage.restart(); }
  }

  function buildStepChips() {
    var host = $('step-chips'); host.innerHTML = '';
    Stage.steps.forEach(function (s) {
      var b = el('button', { type: 'button', 'class': 'chip' }, esc(s.n));
      b.addEventListener('click', function () { Stage.seek(s.t); Stage.play(); });
      host.appendChild(b);
    });
  }
  function buildMarks() {
    var host = $('marks'); host.innerHTML = '';
    Stage.steps.forEach(function (s) {
      var i = el('i'); i.style.left = (s.t / Stage.total * 100) + '%'; host.appendChild(i);
    });
  }

  var speeds = [1, 2, .5], speedIdx = 0;
  function bindPlayer() {
    var scrub = $('scrub'), play = $('btn-play');
    Stage.onFrame(function (i) {
      if (!dragging) scrub.value = Math.round(i.t / i.total * 1000);
      $('ico-play').setAttribute('d', i.playing ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z');
      play.setAttribute('aria-label', i.playing ? '일시정지' : '재생');
      var cap = $('cap');
      if (cap.textContent !== i.caption) cap.textContent = i.caption;
      cap.classList.toggle('bad', !!i.bad);
    });
    Stage.onUserCam(function () { $('chk-auto').checked = false; });
    play.addEventListener('click', function () { Stage.toggle(); });
    scrub.addEventListener('input', function () { dragging = true; Stage.pause(); Stage.seek(parseInt(scrub.value, 10) / 1000 * Stage.total); });
    scrub.addEventListener('change', function () { dragging = false; });
    $('btn-restart').addEventListener('click', function () { Stage.restart(); });
    $('btn-speed').addEventListener('click', function () {
      speedIdx = (speedIdx + 1) % speeds.length; Stage.setSpeed(speeds[speedIdx]); this.textContent = speeds[speedIdx] + '×';
    });
    $('chk-auto').addEventListener('change', function () { Stage.setAuto(this.checked); });
    document.addEventListener('keydown', function (e) {
      if (state.tab !== 'wrap') return;
      if (e.code === 'Space' && !/INPUT|BUTTON|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); Stage.toggle(); }
    });
  }

  /* ───────── 시작 ───────── */
  var resizeT = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (state.tab === 'cut' && plan) Diagram.render($('cut'), plan.chosen, { folds: state.folds, still: true }); }, 200);
  });

  buildSwatches(); buildDims(); buildPaper();
  $('ovl-out').textContent = f1(state.ovl) + ' cm';
  update(true);

  // 개발·검증용 진입점: #wrap 으로 열면 바로 포장 탭
  if (location.hash === '#wrap') setTab('wrap');
  window.addEventListener('hashchange', function () { if (location.hash === '#wrap') setTab('wrap'); else if (location.hash === '#cut') setTab('cut'); });
  window.__ssakduk = { state: state, setTab: setTab, update: update, get plan() { return plan; } };
})();
