/* 싹둑 — 잔잔한 크리스마스 캐롤 (고요한 밤, 오르골 + 부드러운 패드)
 * 소리 파일 없이 Web Audio로 직접 연주한다. 곡은 저작권이 만료된 캐롤이다.
 * 오른쪽 아래 버튼으로 켜고 끄며, 선택은 이 브라우저에 기억한다. */
(function () {
  'use strict';
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  var KEY = 'ssakduk-bgm';
  var EIGHTH = 0.42;                    // 8분음표 길이(초). 느리고 차분하게
  var BAR = EIGHTH * 6;                 // 6/8박자 한 마디
  var REST_BARS = 2;                    // 곡이 끝나면 쉬었다가 반복

  var SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function hz(n) {
    var m = /^([A-G])(#?)(\d)$/.exec(n);
    var midi = 12 * (parseInt(m[3], 10) + 1) + SEMI[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  var CHORDS = {
    C: ['C3', 'E3', 'G3', 'C4'], F: ['F2', 'A2', 'C3', 'F3'], G: ['G2', 'B2', 'D3', 'G3'], Am: ['A2', 'C3', 'E3', 'A3']
  };
  /* [화음, [[음, 8분음표 길이], ...]] */
  var SONG = [
    ['C', [['G4', 3], ['A4', 1], ['G4', 2]]], ['C', [['E4', 6]]],
    ['C', [['G4', 3], ['A4', 1], ['G4', 2]]], ['C', [['E4', 6]]],
    ['G', [['D5', 3], ['D5', 1], ['B4', 2]]], ['C', [['C5', 3], ['C5', 1], ['G4', 2]]],
    ['F', [['A4', 3], ['A4', 1], ['C5', 2]]], ['C', [['B4', 3], ['A4', 1], ['G4', 2]]],
    ['C', [['G4', 3], ['A4', 1], ['G4', 2]]], ['C', [['E4', 6]]],
    ['F', [['A4', 3], ['A4', 1], ['C5', 2]]], ['C', [['B4', 3], ['A4', 1], ['G4', 2]]],
    ['C', [['G4', 3], ['A4', 1], ['G4', 2]]], ['C', [['E4', 6]]],
    ['G', [['D5', 3], ['D5', 1], ['F5', 2]]], ['G', [['D5', 3], ['B4', 1], ['G4', 2]]],
    ['C', [['C5', 3], ['E5', 1], ['C5', 2]]], ['C', [['G4', 3], ['E4', 1], ['G4', 2]]],
    ['G', [['F4', 3], ['D4', 3]]], ['C', [['C4', 6]]]
  ];

  var ctx = null, master = null, wet = null, analyser = null;
  var on = false, timer = 0, bar = 0, nextT = 0, closeTimer = 0;

  function impulse(c, secs) {
    var len = Math.floor(c.sampleRate * secs), buf = c.createBuffer(2, len, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  function build() {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    var rev = ctx.createConvolver(); rev.buffer = impulse(ctx, 3.2);
    wet = ctx.createGain(); wet.gain.value = .5;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    wet.connect(rev); rev.connect(master);
    lp.connect(master); lp.connect(wet);
    lp._in = lp;
    master.connect(analyser); analyser.connect(ctx.destination);
    ctx._bus = lp;
  }

  function bell(freq, t, vol) {
    var bus = ctx._bus, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    g.connect(bus);
    [[1, 1], [2, .28], [3.01, .07], [5.4, .03]].forEach(function (p, i) {
      var o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq * p[0];
      og.gain.value = p[1];
      if (i >= 2) { og.gain.setValueAtTime(p[1], t); og.gain.exponentialRampToValueAtTime(0.0001, t + .5); }
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + 2.5);
    });
  }

  function pad(names, t, dur) {
    var bus = ctx._bus;
    names.forEach(function (n, i) {
      [-3, 3].forEach(function (cents) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = hz(n); o.detune.value = cents;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(i === 0 ? .03 : .018, t + .9);
        g.gain.setValueAtTime(i === 0 ? .03 : .018, t + dur - .2);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.2);
        o.connect(g); g.connect(bus);
        o.start(t); o.stop(t + dur + 1.3);
      });
    });
  }

  function scheduleBar(i, t) {
    var b = SONG[i], off = 0;
    pad(CHORDS[b[0]], t, BAR);
    b[1].forEach(function (nt) {
      bell(hz(nt[0]), t + off * EIGHTH, .2);
      off += nt[1];
    });
  }

  function tick() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 1.6) {
      scheduleBar(bar, nextT);
      nextT += BAR;
      bar++;
      if (bar >= SONG.length) { bar = 0; nextT += BAR * REST_BARS; }
    }
  }

  function start() {
    clearTimeout(closeTimer);
    if (!ctx) { build(); bar = 0; nextT = 0; }
    var go = function () {
      if (nextT < ctx.currentTime + .2) nextT = ctx.currentTime + .25;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(.62, ctx.currentTime, .6);
      clearInterval(timer); tick(); timer = setInterval(tick, 400);
    };
    if (ctx.state === 'suspended') ctx.resume().then(go, go); else go();
  }

  function stop() {
    clearInterval(timer); timer = 0;
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, .35);
    var c = ctx;
    closeTimer = setTimeout(function () { try { c.close(); } catch (e) { } if (ctx === c) { ctx = null; } }, 2200);
  }

  /* ───── 버튼 ───── */
  var css = document.createElement('style');
  css.textContent =
    '.bgm{position:fixed;z-index:60;right:max(14px,env(safe-area-inset-right,0px));bottom:max(14px,env(safe-area-inset-bottom,0px));display:inline-flex;align-items:center;gap:9px;padding:10px 16px 10px 14px;border-radius:999px;border:1.5px solid rgba(255,246,228,.55);background:rgba(13,42,33,.86);color:#fff6e4;font:700 14px/1 "Noto Sans KR","Malgun Gothic",system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 22px -8px rgba(0,0,0,.6);backdrop-filter:blur(6px);transition:transform .15s,background .2s}' +
    '.bgm:hover{transform:translateY(-2px)}.bgm:focus-visible{outline:3px solid #f4c453;outline-offset:3px}' +
    '.bgm[aria-pressed="true"]{background:#c9372c;border-color:#ffd9d2}' +
    '.bgm .ico{font-size:17px;line-height:1}' +
    '.bgm .eq{display:none;align-items:flex-end;gap:2px;height:14px}.bgm[aria-pressed="true"] .eq{display:inline-flex}' +
    '.bgm .eq i{display:block;width:3px;background:#fff6e4;border-radius:2px;animation:bgmeq 1s ease-in-out infinite}' +
    '.bgm .eq i:nth-child(2){animation-delay:.25s}.bgm .eq i:nth-child(3){animation-delay:.5s}' +
    '@keyframes bgmeq{0%,100%{height:4px}50%{height:14px}}' +
    '@media (prefers-reduced-motion:reduce){.bgm .eq i{animation:none;height:9px}}' +
    '@media (max-width:480px){.bgm{padding:10px 13px}.bgm .txt{display:none}}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'bgm';
  btn.title = '잔잔한 캐롤 · 고요한 밤 (오르골)';
  btn.innerHTML = '<span class="ico" aria-hidden="true">🎵</span><span class="txt"></span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>';

  function render() {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '캐롤 끄기' : '캐롤 켜기');
    btn.querySelector('.txt').textContent = on ? '캐롤 끄기' : '캐롤 듣기';
  }
  function save() { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { } }

  btn.addEventListener('click', function () {
    on = !on; render(); save();
    if (on) start(); else stop();
  });

  function mount() { document.body.appendChild(btn); render(); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  /* 지난번에 켜 두었다면, 브라우저 규칙상 첫 클릭·터치 때 이어서 재생 */
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { }
  if (saved === 'on') {
    on = true;
    var kick = function (e) {
      if (btn.contains(e.target)) { cleanup(); return; }
      cleanup(); if (on) start();
    };
    var cleanup = function () { ['pointerdown', 'keydown'].forEach(function (t) { document.removeEventListener(t, kick, true); }); };
    ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, kick, true); });
  }

  /* 탭이 가려지면 조용히 멈추고, 돌아오면 이어서 */
  document.addEventListener('visibilitychange', function () {
    if (!ctx || !on) return;
    if (document.hidden) { ctx.suspend(); clearInterval(timer); timer = 0; }
    else { ctx.resume().then(function () { nextT = Math.max(nextT, ctx.currentTime + .2); timer = setInterval(tick, 400); }); }
  });

  window.SsakdukBGM = {
    get on() { return on; },
    level: function () {
      if (!analyser) return 0;
      var d = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(d);
      var s = 0; for (var i = 0; i < d.length; i++) s += d[i] * d[i];
      return Math.sqrt(s / d.length);
    },
    get state() { return ctx ? ctx.state : 'none'; }
  };
})();
