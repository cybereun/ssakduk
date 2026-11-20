/* 싹둑 — 3D 포장 미리보기 (Three.js r149)
 * 장면은 시간 t(초)의 순수 함수로 그린다. 그래서 슬라이더로 앞뒤로 끌어도 항상 맞는 모습이 나온다.
 * 좌표: x = 상자/통의 축 방향, y = 위, z = 포장지가 감싸는 방향. 단위 cm. */
(function (g) {
  'use strict';
  var T = g.THREE;
  var PI = Math.PI;

  /* ───────── 작은 도구들 ───────── */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function sm(x) { return x * x * (3 - 2 * x); }
  function eio(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function outBack(x) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function outElastic(x) { if (x <= 0) return 0; if (x >= 1) return 1; var c4 = 2 * PI / 3; return Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * c4) + 1; }
  function outBounce(x) {
    var n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + .75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + .9375;
    return n1 * (x -= 2.625 / d1) * x + .984375;
  }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function srgb(tex) { tex.encoding = T.sRGBEncoding; return tex; }

  /* ───────── 텍스처 ───────── */
  var TILE = 512, TILE_CM = 12;
  var patCache = {};

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }

  function drawTiled(ctx, fn) {
    for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
      ctx.save(); ctx.translate(dx * TILE, dy * TILE); fn(); ctx.restore();
    }
  }
  function star5(ctx, x, y, R, r) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -PI / 2 + i * PI / 5, rr = i % 2 ? r : R;
      ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
    }
    ctx.closePath(); ctx.fill();
  }
  function flake(ctx, x, y, R) {
    ctx.lineWidth = Math.max(2, R * .13); ctx.lineCap = 'round';
    for (var i = 0; i < 6; i++) {
      var a = i * PI / 3, c = Math.cos(a), s = Math.sin(a);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + c * R, y + s * R);
      var bx = x + c * R * .62, by = y + s * R * .62;
      ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + .7) * R * .32, by + Math.sin(a + .7) * R * .32);
      ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - .7) * R * .32, by + Math.sin(a - .7) * R * .32);
      ctx.stroke();
    }
  }
  function tri(ctx, x, y, w, h) { ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w / 2, y); ctx.lineTo(x - w / 2, y); ctx.closePath(); ctx.fill(); }

  var PATTERNS = {
    kraft: function (ctx) {
      ctx.fillStyle = '#c59c6e'; ctx.fillRect(0, 0, TILE, TILE);
      var R = rng(7);
      drawTiled(ctx, function () {
        for (var i = 0; i < 520; i++) {
          var x = R() * TILE, y = R() * TILE, l = 8 + R() * 26, a = R() * PI;
          ctx.strokeStyle = R() < .5 ? 'rgba(92,60,28,.10)' : 'rgba(255,236,200,.13)'; ctx.lineWidth = .8 + R();
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
        }
      });
      ctx.fillStyle = 'rgba(70,42,20,.35)';
      for (var gx = 0; gx < 4; gx++) for (var gy = 0; gy < 4; gy++) {
        drawTiled(ctx, function () { star5(ctx, gx * 128 + 64 + (gy % 2) * 0, gy * 128 + 64, 9, 4); });
      }
    },
    red: function (ctx) {
      ctx.fillStyle = '#b1242a'; ctx.fillRect(0, 0, TILE, TILE);
      drawTiled(ctx, function () {
        for (var gx = 0; gx < 4; gx++) for (var gy = 0; gy < 4; gy++) {
          var ox = (gy % 2) * 64;
          ctx.fillStyle = '#f0c75e'; star5(ctx, gx * 128 + 64 + ox, gy * 128 + 64, 17, 7.5);
          ctx.fillStyle = 'rgba(255,245,230,.85)';
          ctx.beginPath(); ctx.arc(gx * 128 + ox, gy * 128 + 0, 4.5, 0, PI * 2); ctx.fill();
        }
      });
    },
    snow: function (ctx) {
      ctx.fillStyle = '#1b3a72'; ctx.fillRect(0, 0, TILE, TILE);
      drawTiled(ctx, function () {
        ctx.strokeStyle = '#f2f6ff'; ctx.fillStyle = '#f2f6ff';
        var pts = [[64, 64, 30], [192, 48, 16], [320, 96, 26], [448, 56, 14], [128, 192, 18], [256, 224, 32], [400, 200, 18], [48, 320, 24], [180, 330, 14], [320, 350, 22], [450, 330, 30], [90, 450, 16], [240, 460, 20], [380, 450, 14]];
        pts.forEach(function (p) { flake(ctx, p[0], p[1], p[2]); });
        [[10, 140], [150, 120], [260, 140], [350, 260], [30, 240], [470, 130], [200, 400], [410, 410], [120, 270]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, PI * 2); ctx.fill(); });
      });
    },
    stripe: function (ctx) {
      ctx.fillStyle = '#f7f1e4'; ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#c2272d';
      var p = 128;
      for (var k = -6; k < 12; k++) {
        ctx.beginPath();
        ctx.moveTo(k * p, 0); ctx.lineTo(k * p + p / 2, 0); ctx.lineTo(k * p + p / 2 - TILE, TILE); ctx.lineTo(k * p - TILE, TILE);
        ctx.closePath(); ctx.fill();
      }
    },
    plaid: function (ctx) {
      ctx.fillStyle = '#b3262b'; ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = 'rgba(15,10,10,.62)';
      ctx.fillRect(128, 0, 128, TILE); ctx.fillRect(384, 0, 128, TILE);
      ctx.fillRect(0, 128, TILE, 128); ctx.fillRect(0, 384, TILE, 128);
      ctx.fillStyle = 'rgba(255,240,225,.55)';
      [0, 256].forEach(function (o) { ctx.fillRect(o + 126, 0, 3, TILE); ctx.fillRect(0, o + 126, TILE, 3); });
    },
    pine: function (ctx) {
      ctx.fillStyle = '#1d5841'; ctx.fillRect(0, 0, TILE, TILE);
      drawTiled(ctx, function () {
        for (var gx = 0; gx < 4; gx++) for (var gy = 0; gy < 4; gy++) {
          var ox = (gy % 2) * 64, cx = gx * 128 + 64 + ox, cy = gy * 128 + 78;
          ctx.fillStyle = (gx + gy) % 3 === 0 ? '#e8bf5a' : '#dfe9d2';
          tri(ctx, cx, cy - 16, 22, 22); tri(ctx, cx, cy, 30, 26);
          ctx.fillStyle = '#7a4a2b'; ctx.fillRect(cx - 3, cy, 6, 8);
        }
      });
    }
  };

  function patternTex(name) {
    if (patCache[name]) return patCache[name];
    var c = canvas(TILE), ctx = c.getContext('2d');
    (PATTERNS[name] || PATTERNS.red)(ctx);
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8; srgb(t);
    patCache[name] = t;
    return t;
  }

  var matTexCache = null;
  function matTex() {
    if (matTexCache) return matTexCache;
    var S = 1000, c = canvas(S), ctx = c.getContext('2d');   // 50cm
    ctx.fillStyle = '#134636'; ctx.fillRect(0, 0, S, S);
    var R = rng(3);
    for (var i = 0; i < 2600; i++) { ctx.fillStyle = 'rgba(0,0,0,' + (R() * .05) + ')'; ctx.fillRect(R() * S, R() * S, 2 + R() * 3, 2 + R() * 3); }
    for (var k = 0; k <= 50; k++) {
      var major10 = k % 10 === 0, major5 = k % 5 === 0;
      ctx.fillStyle = 'rgba(244,234,209,' + (major10 ? .34 : major5 ? .2 : .085) + ')';
      var w = major10 ? 3 : major5 ? 2 : 1.2, p = k * 20 - w / 2;
      ctx.fillRect(p, 0, w, S); ctx.fillRect(0, p, S, w);
    }
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; srgb(t);
    matTexCache = t;
    return t;
  }

  var glowTexCache = null;
  function glowTex() {
    if (glowTexCache) return glowTexCache;
    var c = canvas(64), ctx = c.getContext('2d');
    var gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,238,190,.8)'); gr.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(32, 6); ctx.lineTo(32, 58); ctx.moveTo(6, 32); ctx.lineTo(58, 32); ctx.stroke();
    glowTexCache = srgb(new T.CanvasTexture(c));
    return glowTexCache;
  }

  function mugTex() {
    var c = canvas(512, 256), ctx = c.getContext('2d');
    ctx.fillStyle = '#ece8dc'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#c9372c'; ctx.fillRect(0, 40, 512, 26); ctx.fillRect(0, 190, 512, 26);
    ctx.fillStyle = '#1c5a46';
    for (var i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(32 + i * 64, 128, 16, 0, PI * 2); ctx.fill(); }
    var t = new T.CanvasTexture(c); t.wrapS = T.RepeatWrapping; srgb(t); return t;
  }
  function bottleLabelTex() {
    var c = canvas(256, 256), ctx = c.getContext('2d');
    ctx.fillStyle = '#17382a'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#efe6cf'; ctx.fillRect(0, 86, 256, 84);
    ctx.fillStyle = '#7a1f25'; ctx.fillRect(0, 96, 256, 4); ctx.fillRect(0, 156, 256, 4);
    ctx.fillStyle = '#c59a3a'; star5(ctx, 64, 128, 14, 6); star5(ctx, 192, 128, 14, 6);
    var t = new T.CanvasTexture(c); t.wrapS = T.RepeatWrapping; srgb(t); return t;
  }

  /* ───────── 상태 ───────── */
  var S = {
    ok: false, container: null, renderer: null, scene: null, camera: null,
    w: 10, h: 10, cur: null, t: 0, playing: false, speed: 1, auto: true,
    cam: { az: .6, el: .9, d: 1, tx: 0, ty: 0, tz: 0 },
    dirty: true, visible: false, last: 0, onFrame: null, onUserCam: null, raf: 0
  };

  function init(container) {
    S.container = container;
    try {
      var r = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.outputEncoding = T.sRGBEncoding;
      r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
      r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
      r.setClearColor(0x0d3229, 1);
      container.appendChild(r.domElement);
      S.renderer = r;
      S.camera = new T.PerspectiveCamera(34, 1, .5, 4000);
      S.ok = true;
    } catch (e) { S.ok = false; return false; }
    bindPointer(r.domElement);
    if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(container);
    window.addEventListener('resize', resize);
    resize();
    S.last = performance.now();
    S.raf = requestAnimationFrame(loop);
    return true;
  }

  function resize() {
    if (!S.ok) return;
    var w = S.container.clientWidth, h = S.container.clientHeight;
    if (w < 4 || h < 4) return;
    S.w = w; S.h = h;
    S.renderer.setSize(w, h, false);
    S.camera.aspect = w / h; S.camera.updateProjectionMatrix();
    S.dirty = true;
  }

  function bindPointer(dom) {
    var pts = {}, lastD = 0;
    function count() { return Object.keys(pts).length; }
    dom.addEventListener('pointerdown', function (e) { dom.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY }; lastD = 0; });
    dom.addEventListener('pointermove', function (e) {
      var p = pts[e.pointerId]; if (!p) return;
      if (count() === 1) {
        var dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (Math.abs(dx) + Math.abs(dy) > 0) {
          touchCam();
          S.cam.az -= dx * .0085; S.cam.el = clamp(S.cam.el + dy * .0065, .12, 1.5);
          S.dirty = true;
        }
      } else if (count() === 2) {
        var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]];
        if (e.pointerId == ids[0]) { a = { x: e.clientX, y: e.clientY }; } else { b = { x: e.clientX, y: e.clientY }; }
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastD) { touchCam(); S.cam.d = clamp(S.cam.d * (lastD / d), .35, 2.4); S.dirty = true; }
        lastD = d;
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    function up(e) { delete pts[e.pointerId]; lastD = 0; }
    dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
    dom.addEventListener('wheel', function (e) {
      e.preventDefault(); touchCam();
      S.cam.d = clamp(S.cam.d * (1 + e.deltaY * .001), .35, 2.4); S.dirty = true;
    }, { passive: false });
  }
  function touchCam() { if (S.auto) { S.auto = false; if (S.onUserCam) S.onUserCam(); } }

  /* ───────── 공통 부품 ───────── */
  function setupScene(span, ctr) {
    var sc = new T.Scene();
    sc.background = new T.Color(0x0d3229);
    var M = Math.max(span * 5, 120);
    sc.fog = new T.Fog(0x0d3229, span * 3.3, span * 6.4);
    var top = new T.MeshStandardMaterial({ map: matTex().clone(), roughness: .92, metalness: 0 });
    top.map = matTex(); top.map.repeat.set(M / 50, M / 50); top.map.needsUpdate = true;
    var edge = new T.MeshStandardMaterial({ color: 0x0b2a22, roughness: 1 });
    var mat = new T.Mesh(new T.BoxGeometry(M, 1, M), [edge, edge, top, edge, edge, edge]);
    mat.position.set(ctr ? ctr.x : 0, -.5, ctr ? ctr.z : 0);
    mat.receiveShadow = true;
    sc.add(mat);

    var hemi = new T.HemisphereLight(0xfff2dc, 0x0d3229, .78);
    sc.add(hemi);
    var sun = new T.DirectionalLight(0xfff6e6, 1.25);
    sun.position.set(span * .55, span * 1.25, span * .7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var sh = sun.shadow.camera, e = span * .95;
    sh.left = -e; sh.right = e; sh.top = e; sh.bottom = -e; sh.near = 1; sh.far = span * 5;
    sun.shadow.bias = -.0006; sun.shadow.normalBias = Math.max(.03, span * .0012); sun.shadow.radius = 4;
    sun.target.position.set(ctr ? ctr.x : 0, 0, ctr ? ctr.z : 0);
    sc.add(sun); sc.add(sun.target);
    var rim = new T.PointLight(0xffb27a, .55, span * 4, 1.6);
    rim.position.set(-span * .8, span * .5, -span * .6);
    sc.add(rim);
    return sc;
  }

  function paperMats(style) {
    var cache = {};
    var back = patternTex(style.pattern);
    return function (layer) {
      if (cache[layer]) return cache[layer];
      var po = { polygonOffset: true, polygonOffsetFactor: -layer * 1.2, polygonOffsetUnits: -layer * 1.2 };
      var a = new T.MeshStandardMaterial({ color: 0xe9e0ca, roughness: .92, side: T.FrontSide, shadowSide: T.DoubleSide });
      var b = new T.MeshStandardMaterial({ map: back, roughness: .62, metalness: .02, side: T.BackSide, shadowSide: T.DoubleSide });
      for (var k in po) { a[k] = po[k]; b[k] = po[k]; }
      return (cache[layer] = [a, b]);
    };
  }

  /* 평평하게 펼친 직사각형 한 장(앞=종이 안쪽 크림색, 뒤=무늬) */
  function panel(parent, rc, pv, layer, getMats) {
    var x0 = rc.x0, x1 = rc.x1, z0 = rc.z0, z1 = rc.z1;
    if (Math.abs(x1 - x0) < 1e-4 || Math.abs(z1 - z0) < 1e-4) return null;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array([x0 - pv.x, 0, z0 - pv.z, x0 - pv.x, 0, z1 - pv.z, x1 - pv.x, 0, z0 - pv.z, x1 - pv.x, 0, z1 - pv.z]);
    var uv = new Float32Array([x0 / TILE_CM, z0 / TILE_CM, x0 / TILE_CM, z1 / TILE_CM, x1 / TILE_CM, z0 / TILE_CM, x1 / TILE_CM, z1 / TILE_CM]);
    // 가로 x0<x1, 세로 z0<z1 이 아닐 수 있으므로 감는 방향 보정
    var flip = ((x1 - x0) * (z1 - z0)) < 0;
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geo.setIndex(flip ? [0, 2, 1, 2, 3, 1] : [0, 1, 2, 2, 1, 3]);
    geo.computeVertexNormals();
    var m = getMats(layer);
    var A = new T.Mesh(geo, m[0]), B = new T.Mesh(geo, m[1]);
    A.castShadow = B.castShadow = true; A.receiveShadow = B.receiveShadow = true;
    parent.add(A); parent.add(B);
    return A;
  }

  function hinge(parent, pv) {
    var gr = new T.Group();
    var ppv = parent.userData.pv;
    gr.position.set(pv.x - ppv.x, 0, pv.z - ppv.z);
    gr.userData.pv = { x: pv.x, z: pv.z };
    parent.add(gr);
    return gr;
  }

  /* 둥근 사각 경로 (맨 위 가운데에서 시계 방향) → [{a,b}] a=가로, b=세로 */
  function roundRectPath(hw, hh, cr, n) {
    var pts = [], per = n || 14;
    cr = Math.min(cr, hw, hh);
    function line(ax, ay, bx, by) { for (var i = 0; i < per; i++) { var t = i / per; pts.push({ a: lerp(ax, bx, t), b: lerp(ay, by, t) }); } }
    function arc(cx, cy, a0, a1) { for (var i = 0; i < 6; i++) { var t = a0 + (a1 - a0) * i / 6; pts.push({ a: cx + cr * Math.cos(t), b: cy + cr * Math.sin(t) }); } }
    line(0, hh, hw - cr, hh); arc(hw - cr, hh - cr, PI / 2, 0);
    line(hw, hh - cr, hw, -hh + cr); arc(hw - cr, -hh + cr, 0, -PI / 2);
    line(hw - cr, -hh, -hw + cr, -hh); arc(-hw + cr, -hh + cr, -PI / 2, -PI);
    line(-hw, -hh + cr, -hw, hh - cr); arc(-hw + cr, hh - cr, PI, PI / 2);
    line(-hw + cr, hh, 0, hh);
    pts.push(pts[0]);
    return pts;
  }

  function ribbonStrip(pts3, widthDir, width, mat) {
    var n = pts3.length, pos = new Float32Array(n * 6), idx = [];
    for (var i = 0; i < n; i++) {
      var p = pts3[i];
      pos.set([p.x - widthDir.x * width / 2, p.y - widthDir.y * width / 2, p.z - widthDir.z * width / 2, p.x + widthDir.x * width / 2, p.y + widthDir.y * width / 2, p.z + widthDir.z * width / 2], i * 6);
      if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    var m = new T.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    m.userData.total = idx.length;
    return m;
  }
  function revealStrip(m, f) { m.geometry.setDrawRange(0, Math.floor(m.userData.total * clamp(f, 0, 1) / 6) * 6); m.visible = f > 0.001; }

  function ribbonMat(color) {
    return new T.MeshStandardMaterial({ color: color, roughness: .36, metalness: .18, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  }

  function makeBow(color, s) {
    var grp = new T.Group();
    var mat = new T.MeshStandardMaterial({ color: color, roughness: .34, metalness: .2, side: T.DoubleSide });
    function loop(R, rotY, ox, oy, tilt) {
      var m = new T.Mesh(new T.TorusGeometry(R, .13, 10, 44), mat);
      m.scale.set(1, .72, 6.2);
      var h = new T.Group(); m.position.set(ox, oy, 0); m.rotation.z = tilt; h.add(m); h.rotation.y = rotY;
      m.castShadow = true; grp.add(h);
    }
    loop(1.9, 0, 2.0, .9, .35); loop(1.9, PI, 2.0, .9, .35);
    loop(1.35, PI / 2, 1.5, .55, .5); loop(1.35, -PI / 2, 1.5, .55, .5);
    var knot = new T.Mesh(new T.SphereGeometry(.62, 16, 12), mat); knot.scale.set(1.15, .9, 1.4); knot.position.y = .35; knot.castShadow = true; grp.add(knot);
    function tail(rotY, len) {
      var m = new T.Mesh(new T.BoxGeometry(.85, len, .06), mat); m.geometry.translate(0, -len / 2, 0);
      m.position.set(0, .2, .35); m.rotation.set(.2, 0, .32); m.castShadow = true;
      var h = new T.Group(); h.add(m); h.rotation.y = rotY; grp.add(h);
    }
    tail(.5, 4.2); tail(-.5 + PI, 4.6);
    grp.scale.setScalar(s);
    return grp;
  }

  function makeSparkles(count, seed) {
    var R = rng(seed), geo = new T.BufferGeometry();
    var pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    var info = [];
    for (var i = 0; i < count; i++) info.push({ th: R() * PI * 2, ph: (R() * .9 + .05) * PI / 2, sp: 4 + R() * 9, dl: R() * .8, hot: R() });
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    var mat = new T.PointsMaterial({ size: 1.9, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false;
    pts.userData.update = function (tau, cx, cy, cz, rad) {
      for (var i = 0; i < count; i++) {
        var o = info[i], k = tau - o.dl, v = k > 0 ? k : 0;
        var rr = rad * .55 + o.sp * v * (1 - v * .16);
        pos[i * 3] = cx + Math.cos(o.th) * Math.cos(o.ph) * rr;
        pos[i * 3 + 1] = cy + Math.sin(o.ph) * rr * .9 + v * 1.5;
        pos[i * 3 + 2] = cz + Math.sin(o.th) * Math.cos(o.ph) * rr;
        var a = k > 0 ? Math.max(0, 1 - v / 2.1) * (.55 + .45 * Math.sin(v * 22 + i)) : 0;
        col[i * 3] = a * 1; col[i * 3 + 1] = a * (.8 + .2 * o.hot); col[i * 3 + 2] = a * (.5 + .4 * o.hot);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    };
    return pts;
  }

  /* 카메라 키프레임 보간 */
  function camAt(keys, t) {
    if (t <= keys[0].t) return keys[0];
    for (var i = 1; i < keys.length; i++) {
      if (t <= keys[i].t) {
        var a = keys[i - 1], b = keys[i], k = sm(clamp((t - a.t) / Math.max(1e-6, b.t - a.t), 0, 1));
        return { az: lerp(a.az, b.az, k), el: lerp(a.el, b.el, k), d: lerp(a.d, b.d, k) };
      }
    }
    return keys[keys.length - 1];
  }
  function captionAt(list, t) { var out = list[0]; for (var i = 0; i < list.length; i++) if (t >= list[i].t) out = list[i]; return out; }

  function fmt(v) { var r = Math.round(v * 10) / 10; return r % 1 === 0 ? String(r) : r.toFixed(1); }

  /* ───────── 상자 ───────── */
  function buildBox(opt, style) {
    var need = opt.need, f = opt.fit;
    var p = need.p, q = need.q, a = need.axis, ovl = need.ovl;
    var Wa = f.orient === 1 ? Math.min(f.needX, f.sheetX) : Math.min(f.needY, f.sheetY);
    var Xa = f.orient === 1 ? Math.min(f.needY, f.sheetY) : Math.min(f.needX, f.sheetX);
    var shortAround = Math.max(0, need.around - Wa), shortAlong = Math.max(0, need.along - Xa);
    var bad = shortAround > .05 || shortAlong > .05;

    var HP = p / 2, HA = a / 2;
    var xm = Math.min(HA, Xa / 2), Ea = Math.max(0, Xa / 2 - HA);
    var zb = Math.min(HP, Wa / 2);
    var zl = Math.max(0, Wa / 2 - zb);
    var sL = Math.min(q, zl), tL = Math.max(0, zl - sL);
    var span = Math.max(need.around, need.along, 18);

    var sc = setupScene(span);
    var world = new T.Group(); sc.add(world);
    var sheet = new T.Group(); sheet.position.y = .06; world.add(sheet);
    var root = new T.Group(); root.userData.pv = { x: 0, z: 0 }; sheet.add(root);
    var getMats = paperMats(style);

    panel(root, { x0: -xm, x1: xm, z0: -zb, z1: zb }, root.userData.pv, 0, getMats);
    var gBp = hinge(root, { x: xm, z: 0 }), gBm = hinge(root, { x: -xm, z: 0 });
    panel(gBp, { x0: xm, x1: xm + Ea, z0: -zb, z1: zb }, gBp.userData.pv, 2, getMats);
    panel(gBm, { x0: -xm - Ea, x1: -xm, z0: -zb, z1: zb }, gBm.userData.pv, 2, getMats);

    function side(sign) {
      var gS = hinge(root, { x: 0, z: sign * zb });
      var zS0 = sign * zb, zS1 = sign * (zb + sL);
      panel(gS, { x0: -xm, x1: xm, z0: Math.min(zS0, zS1), z1: Math.max(zS0, zS1) }, gS.userData.pv, 0, getMats);
      var gSp = hinge(gS, { x: xm + .02, z: zS0 }), gSm = hinge(gS, { x: -xm - .02, z: zS0 });
      panel(gSp, { x0: xm, x1: xm + Ea, z0: Math.min(zS0, zS1), z1: Math.max(zS0, zS1) }, gSp.userData.pv, 1, getMats);
      panel(gSm, { x0: -xm - Ea, x1: -xm, z0: Math.min(zS0, zS1), z1: Math.max(zS0, zS1) }, gSm.userData.pv, 1, getMats);
      var gT = hinge(gS, { x: 0, z: zS1 });
      var zT1 = sign * (zb + sL + tL), lay = sign < 0 ? 1 : 2;
      panel(gT, { x0: -xm, x1: xm, z0: Math.min(zS1, zT1), z1: Math.max(zS1, zT1) }, gT.userData.pv, lay, getMats);
      var gTp = hinge(gT, { x: xm + .05, z: zS1 }), gTm = hinge(gT, { x: -xm - .05, z: zS1 });
      panel(gTp, { x0: xm, x1: xm + Ea, z0: Math.min(zS1, zT1), z1: Math.max(zS1, zT1) }, gTp.userData.pv, 3 + (sign > 0 ? 1 : 0), getMats);
      panel(gTm, { x0: -xm - Ea, x1: -xm, z0: Math.min(zS1, zT1), z1: Math.max(zS1, zT1) }, gTm.userData.pv, 3 + (sign > 0 ? 1 : 0), getMats);
      return { S: gS, T: gT, Sp: gSp, Sm: gSm, Tp: gTp, Tm: gTm };
    }
    var L = side(-1), Rr = side(1);

    // 상자
    var bw = Math.max(.1, a - .2), bh = Math.max(.1, q - .2), bd = Math.max(.1, p - .2);
    var boxMat = new T.MeshStandardMaterial({ color: 0xb4875a, roughness: .85 });
    var box = new T.Mesh(new T.BoxGeometry(bw, bh, bd), boxMat);
    box.castShadow = true; box.receiveShadow = true;
    var boxY = .06 + .1 + bh / 2;
    world.add(box);
    // 상자 윗면에 작은 "선물" 문구 대신 모서리 하이라이트만(깔끔하게)

    // 테이프
    var tapeMat = new T.MeshStandardMaterial({ color: 0xfff1c9, roughness: .3, transparent: true, opacity: .62, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
    var topY = .06 + q + .03;
    var tapeTop = new T.Mesh(new T.PlaneGeometry(1, 1), tapeMat);
    tapeTop.geometry.translate(.5, 0, 0);
    tapeTop.rotation.x = -PI / 2; tapeTop.position.set(-xm, topY, 0);
    tapeTop.scale.set(Math.max(.01, 2 * xm), 2.2, 1); tapeTop.userData.len = 2 * xm;
    world.add(tapeTop);
    function endTape(sign) {
      var m = new T.Mesh(new T.PlaneGeometry(1, 1), tapeMat);
      m.geometry.translate(.5, 0, 0);
      m.rotation.y = sign > 0 ? PI / 2 : -PI / 2;
      var yy = .06 + Math.max(.4, q - Ea) ;
      // 위 날개 아래쪽 끝선에 붙인다. 평면은 -z → +z 방향으로 자란다.
      m.rotation.y = sign > 0 ? -PI / 2 : PI / 2;
      m.position.set(sign * (xm + .12), yy, sign > 0 ? -zb * .7 : zb * .7);
      m.scale.set(Math.max(.01, zb * 1.4), 2.2, 1);
      m.userData.len = zb * 1.4;
      world.add(m);
      return m;
    }
    var tapeXp = endTape(1), tapeXm = endTape(-1);

    // 리본
    var rc = style.ribbon, rmat = ribbonMat(rc);
    var rw = Math.max(.9, Math.min(2.2, Math.min(p, q) * .12));
    var yTop = .06 + q + .24, yBot = .02, hz = zb + .32, hx = xm + .3;
    function pts1() { return roundRectPath(hz, (yTop - yBot) / 2, .7, 16).map(function (o) { return new T.Vector3(0, (yTop + yBot) / 2 + o.b, o.a); }); }
    function pts2() { return roundRectPath(hx, (yTop + .16 - yBot) / 2, .7, 18).map(function (o) { return new T.Vector3(o.a, (yTop + .16 + yBot) / 2 + o.b, 0); }); }
    var band1 = ribbonStrip(pts1(), new T.Vector3(1, 0, 0), rw, rmat);
    var band2 = ribbonStrip(pts2(), new T.Vector3(0, 0, 1), rw, rmat);
    world.add(band1); world.add(band2);
    var bow = makeBow(rc, Math.max(.6, Math.min(1.8, Math.min(p, a) / 9)));
    bow.position.set(0, yTop + .32, 0);
    world.add(bow);
    var spark = makeSparkles(70, 11); world.add(spark);

    var TS = {
      sheetIn: [0, .9], drop: [.8, 2.0], sides: [2.3, 3.5], topL: [3.6, 4.6], topR: [4.2, 5.2], tape: [5.3, 6.0],
      xpS: [6.1, 6.8], xpB: [6.8, 7.4], xpT: [7.4, 8.1], xpTape: [8.1, 8.5],
      xmS: [9.3, 9.8], xmB: [9.8, 10.3], xmT: [10.3, 10.8], xmTape: [10.8, 11.1],
      rib1: [11.4, 12.7], rib2: [12.7, 13.9], bow: [13.9, 14.9], fin: 14.9
    };
    var TOTAL = 17.2, HALF = PI / 2;
    function ang(r) { return eio(seg(r[0], r[0], r[1])); }
    function A(t, r) { return eio(seg(t, r[0], r[1])); }

    var shortMsg = shortAround > .05 && shortAlong > .05 ? ('😱 둘레 ' + fmt(shortAround) + 'cm · 끝 접기 ' + fmt(shortAlong) + 'cm 모자라요')
      : shortAround > .05 ? ('😱 둘레 방향 ' + fmt(shortAround) + ' cm 모자라요') : ('😱 끝 접기 ' + fmt(shortAlong) + ' cm 모자라요');
    var caps = [
      { t: 0, s: '포장지를 쫙 펼쳐요' }, { t: .9, s: '상자를 가운데에 올려요' }, { t: 2.3, s: '양옆을 위로 감싸요' },
      { t: 3.6, s: '윗면에서 겹쳐요' }, { t: 5.3, s: '이음새에 테이프 쭉' }, { t: 6.1, s: '오른쪽 끝: 옆날개부터 접어요' },
      { t: 6.8, s: '아래 날개를 올리고' }, { t: 7.4, s: '위 날개를 덮어요' }, { t: 8.1, s: '테이프로 꾹' },
      { t: 8.6, s: '반대쪽도 똑같이' }, { t: 9.3, s: '옆날개 → 아래 → 위' }, { t: 11.1, s: '' },
      { t: 11.4, s: '리본을 둘러요' }, { t: 13.9, s: '매듭 뿅!' }, { t: 14.9, s: bad ? shortMsg : '완성! 🎁', bad: bad }
    ];
    var camKeys = [
      { t: 0, az: .75, el: .95, d: 1.05 }, { t: 2.3, az: .55, el: .85, d: .95 }, { t: 4.6, az: .1, el: 1.1, d: .85 },
      { t: 5.9, az: .15, el: 1.0, d: .85 }, { t: 6.4, az: 1.15, el: .55, d: .78 }, { t: 8.5, az: 1.1, el: .6, d: .78 },
      { t: 9.2, az: -1.1, el: .55, d: .78 }, { t: 11.1, az: -1.15, el: .6, d: .78 }, { t: 11.5, az: -.1, el: .9, d: .88 },
      { t: 14.0, az: .45, el: .8, d: .78 }, { t: 14.9, az: .6, el: .72, d: .8 }
    ];

    function update(t) {
      var sIn = outBack(seg(t, TS.sheetIn[0], TS.sheetIn[1]));
      sheet.scale.setScalar(Math.max(.001, sIn)); sheet.visible = t > .001;
      // 드롭
      var dk = seg(t, TS.drop[0], TS.drop[1]);
      var dropH = (1 - outBounce(dk)) * (q * 2.2 + 14);
      box.visible = t >= TS.drop[0];
      box.position.set(0, boxY + dropH, 0);
      box.rotation.z = (1 - dk) * .18;
      // 감싸기
      var th1 = A(t, TS.sides) * HALF;
      L.S.rotation.x = th1; Rr.S.rotation.x = -th1;
      L.T.rotation.x = A(t, TS.topL) * HALF; Rr.T.rotation.x = -A(t, TS.topR) * HALF;
      // 끝 접기
      var ps = A(t, TS.xpS) * HALF, pb = A(t, TS.xpB) * HALF, pt = A(t, TS.xpT) * HALF;
      L.Sp.rotation.z = ps; Rr.Sp.rotation.z = ps; gBp.rotation.z = pb; L.Tp.rotation.z = pt; Rr.Tp.rotation.z = pt;
      var ms = A(t, TS.xmS) * HALF, mb = A(t, TS.xmB) * HALF, mt = A(t, TS.xmT) * HALF;
      L.Sm.rotation.z = -ms; Rr.Sm.rotation.z = -ms; gBm.rotation.z = -mb; L.Tm.rotation.z = -mt; Rr.Tm.rotation.z = -mt;
      // 테이프
      var k0 = seg(t, TS.tape[0], TS.tape[1]); tapeTop.visible = k0 > 0; tapeTop.scale.x = Math.max(.001, tapeTop.userData.len * eio(k0));
      var k1 = seg(t, TS.xpTape[0], TS.xpTape[1]); tapeXp.visible = k1 > 0 && Ea > .2; tapeXp.scale.x = Math.max(.001, tapeXp.userData.len * eio(k1));
      var k2 = seg(t, TS.xmTape[0], TS.xmTape[1]); tapeXm.visible = k2 > 0 && Ea > .2; tapeXm.scale.x = Math.max(.001, tapeXm.userData.len * eio(k2));
      // 리본
      revealStrip(band1, eio(seg(t, TS.rib1[0], TS.rib1[1])));
      revealStrip(band2, eio(seg(t, TS.rib2[0], TS.rib2[1])));
      var bk = seg(t, TS.bow[0], TS.bow[1]);
      bow.visible = bk > 0; bow.scale.setScalar(Math.max(.001, bow.userData.base * outElastic(bk)));
      // 반짝이
      var fin = t - TS.fin;
      spark.visible = fin > 0 && !bad;
      if (spark.visible) spark.userData.update(fin, 0, q * .8, 0, Math.min(p, a) * .45);
    }
    bow.userData.base = bow.scale.x;

    return {
      scene: sc, update: update, total: TOTAL, bad: bad, span: span,
      caps: caps, camKeys: camKeys, finalT: TS.fin, capAt: function (t) { return captionAt(caps, t); },
      spanAt: function (t) { var objSpan = Math.max(a, p, q * 1.6) * 1.1 + 6; return lerp(span, Math.min(span, objSpan), sm(seg(t, 3.4, 5.6))); },
      target: function () { return { x: 0, y: q * .35, z: 0 }; },
      steps: [{ n: '놓기', t: 0.9 }, { n: '감싸기', t: 2.3 }, { n: '윗면', t: 3.6 }, { n: '끝 접기', t: 6.1 }, { n: '리본', t: 11.4 }, { n: '완성', t: 14.9 }],
      turntable: true
    };
  }

  /* ───────── 원통 · 병 ───────── */
  function buildTube(opt, style) {
    var need = opt.need, f = opt.fit, isBottle = need.shape === 'bottle';
    var r = need.r, h = need.h, rp = r + .07, ovl = need.ovl;
    var Wa = f.orient === 1 ? Math.min(f.needX, f.sheetX) : Math.min(f.needY, f.sheetY);
    var Xa = f.orient === 1 ? Math.min(f.needY, f.sheetY) : Math.min(f.needX, f.sheetX);
    var shortAround = Math.max(0, need.around - Wa), shortAlong = Math.max(0, need.along - Xa);
    var bad = shortAround > .05 || shortAlong > .05;
    var span = Math.max(need.around, need.along, 18);
    var yc = rp + .06, z0 = -Wa / 2, rho = .32;

    var EloN = isBottle ? need.Eb : need.E, EhiN = isBottle ? need.T : need.E;
    var xlo, xhi, over = Xa - h;
    if (over >= 0) { xlo = -Xa / 2 + over * EloN / (EloN + EhiN); xhi = xlo + h; } else { xlo = -h / 2; xhi = h / 2; }
    var Elo = Math.max(0, xlo + Xa / 2), Ehi = Math.max(0, Xa / 2 - xhi);

    var sc = setupScene(span, { x: 0, z: Wa * .15 });
    var world = new T.Group(); sc.add(world);
    var getMats = paperMats(style);

    /* 종이 격자 */
    var nu = 200, nx = clamp(Math.ceil(Xa / .45), 30, 170);
    var cnt = nu * nx;
    var posA = new Float32Array(cnt * 3), uvA = new Float32Array(cnt * 2);
    var rows = [];
    var neckR = Math.max(.9, r * .3) + .35;
    var xTaper = xhi - Math.min(h * .42, 15), xTie = xhi - 1.2;
    for (var i = 0; i < nx; i++) {
      var xs = -Xa / 2 + Xa * i / (nx - 1);
      var row = { xs: xs, kind: 0, xf: xs, Rf: rp, rip: 0, amp: 0, k: 12, tw: 0 };
      var s, E;
      if (xs < xlo - 1e-6) {                          // 아래(−x) 끝: 오므림
        s = xlo - xs; row.kind = 1; endCurve(row, s, Elo, -1, xlo);
      } else if (xs > xhi + 1e-6 && !isBottle) {      // 원통 위(+x) 끝
        s = xs - xhi; row.kind = 2; endCurve(row, s, Ehi, 1, xhi);
      } else if (isBottle && xs > xTaper) {           // 병 어깨·목·위로 올라오는 부분
        row.kind = 2;
        if (xs <= xTie) { var w = sm(clamp((xs - xTaper) / (xTie - xTaper), 0, 1)); row.Rf = rp + (neckR - rp) * w; row.amp = .05 * w; row.k = 12; }
        else { var d = xs - xTie; row.Rf = neckR + Math.min(d, 9) * .27; row.amp = .07 + .018 * Math.min(d, 9); row.k = 10; }
      }
      rows.push(row);
      for (var j = 0; j < nu; j++) {
        var k = i * nu + j;
        uvA[k * 2] = (Wa * j / (nu - 1)) / TILE_CM; uvA[k * 2 + 1] = xs / TILE_CM;
      }
    }
    function endCurve(row, s, E, sign, base) {
      if (s <= r) {
        var t = s / r;
        row.Rf = rho + (rp - rho) * (1 - t); row.xf = base + sign * .14; row.rip = sign * .45 * Math.sin(PI * t); row.amp = .06; row.k = 14;
      } else {
        var d = s - r;
        row.xf = base + sign * d; row.Rf = rho; row.tw = 2.1 * d; row.amp = .32; row.k = 4;
        var fr = Math.min(2.2, E - r);
        if (fr > .3 && s > E - fr) {
          var u = (s - (E - fr)) / fr;
          row.Rf = rho + 1.35 * u * u; row.amp = .28 + .2 * u; row.k = 9;
        }
      }
    }
    var idx = [];
    for (var a = 0; a < nx - 1; a++) for (var b = 0; b < nu - 1; b++) {
      var i0 = a * nu + b, i1 = i0 + 1, i2 = i0 + nu, i3 = i2 + 1;
      idx.push(i0, i1, i2, i1, i3, i2);
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(posA, 3));
    geo.setAttribute('uv', new T.BufferAttribute(uvA, 2));
    geo.setIndex(idx);
    var m = getMats(0);
    var inner = new T.Mesh(geo, m[0]), outer = new T.Mesh(geo, m[1]);
    inner.frustumCulled = outer.frustumCulled = false;
    inner.castShadow = outer.castShadow = true; inner.receiveShadow = outer.receiveShadow = true;
    world.add(inner); world.add(outer);

    /* 안에 든 물건 */
    var obj = new T.Group(); world.add(obj);
    var mid = (xlo + xhi) / 2;
    if (!isBottle) {
      var mt = mugTex(); mt.repeat.set(1, 1);
      var body = new T.Mesh(new T.CylinderGeometry(r - .02, r - .02, h, 48), [new T.MeshStandardMaterial({ map: mt, roughness: .35 }), new T.MeshStandardMaterial({ color: 0xece8dc, roughness: .5 }), new T.MeshStandardMaterial({ color: 0xece8dc, roughness: .5 })]);
      body.rotation.z = PI / 2; body.position.x = mid; body.castShadow = true;
      obj.add(body);
    } else {
      var rn = Math.max(.8, r * .3), pts = [];
      var bh = h, shoulder0 = bh * .58, shoulder1 = bh * .74;
      pts.push(new T.Vector2(0, 0)); pts.push(new T.Vector2(r * .86, 0)); pts.push(new T.Vector2(r, r * .22));
      pts.push(new T.Vector2(r, shoulder0));
      for (var q = 1; q <= 10; q++) { var tt = q / 10, w2 = sm(tt); pts.push(new T.Vector2(lerp(r, rn, w2), lerp(shoulder0, shoulder1, tt))); }
      pts.push(new T.Vector2(rn, bh * .96)); pts.push(new T.Vector2(rn * 1.14, bh)); pts.push(new T.Vector2(0, bh));
      var lathe = new T.LatheGeometry(pts, 40);
      lathe.rotateZ(-PI / 2);
      var lt = bottleLabelTex();
      var bm = new T.MeshPhysicalMaterial({ map: lt, roughness: .18, metalness: 0, clearcoat: .8, clearcoatRoughness: .15 });
      var bot = new T.Mesh(lathe, bm);
      bot.position.x = xlo; bot.castShadow = true; obj.add(bot);
    }
    obj.visible = false;

    /* 리본 고리와 매듭 */
    var rc = style.ribbon, rmat = ribbonMat(rc);
    var ringHi = new T.Mesh(new T.TorusGeometry(1, .16, 10, 32), rmat), ringLo = new T.Mesh(new T.TorusGeometry(1, .16, 10, 32), rmat);
    ringHi.rotation.y = ringLo.rotation.y = PI / 2; ringHi.scale.set(1, 1, 1.5); ringLo.scale.set(1, 1, 1.5);
    ringHi.castShadow = ringLo.castShadow = true;
    var tieHiX = isBottle ? xTie : xhi + r + .9, tieLoX = xlo - r - .9;
    var tieHiR = isBottle ? neckR : rho;
    var bowHi = makeBow(rc, isBottle ? Math.max(.7, Math.min(1.3, r / 4.5)) : .62);
    var bowLo = makeBow(rc, .62);
    bowHi.rotation.y = PI / 2; bowLo.rotation.y = PI / 2;
    bowHi.userData.base = bowHi.scale.x; bowLo.userData.base = bowLo.scale.x;
    world.add(ringHi); world.add(bowHi);
    if (!isBottle) { world.add(ringLo); world.add(bowLo); }
    var spark = makeSparkles(70, 5); world.add(spark);

    var TS = {
      sheetIn: [0, .9], drop: [.8, 2.0], roll: [2.3, 6.6], gHi: [7.2, 9.2], gLo: [9.8, 11.8], ring: [12.0, 12.7], bow: [12.7, 13.7], fin: 13.7
    };
    var TOTAL = 16.0;
    var phiMax = Wa / r;
    function phiAt(t) { return phiMax * eio(seg(t, TS.roll[0], TS.roll[1])); }
    function zcAt(t) { return z0 + r * phiAt(t); }

    var shortMsg = shortAround > .05 && shortAlong > .05 ? ('😱 둘레 ' + fmt(shortAround) + 'cm · 끝 ' + fmt(shortAlong) + 'cm 모자라요')
      : shortAround > .05 ? ('😱 둘레 ' + fmt(shortAround) + ' cm 모자라서 틈이 벌어져요') : ('😱 끝 쪽 ' + fmt(shortAlong) + ' cm 모자라요');
    var caps = [
      { t: 0, s: '포장지를 쫙 펼쳐요' }, { t: .9, s: isBottle ? '병을 가장자리에 올려요' : '통을 가장자리에 올려요' }, { t: 2.3, s: '돌돌 말아요' },
      { t: 6.6, s: '끝을 모아 줄 차례예요' }, { t: 7.2, s: isBottle ? '병 목 쪽을 모아 쥐어요' : '한쪽 끝을 오므려요' },
      { t: 9.4, s: '' }, { t: 9.8, s: isBottle ? '바닥은 접어 눌러요' : '반대쪽도 오므려요' }, { t: 11.9, s: '' },
      { t: 12.0, s: '리본으로 묶어요' }, { t: 12.7, s: '매듭 뿅!' }, { t: 13.7, s: bad ? shortMsg : '완성! 🎁', bad: bad }
    ];
    var camKeys = [
      { t: 0, az: .55, el: .95, d: 1.05 }, { t: 2.3, az: .5, el: .85, d: .92 }, { t: 6.6, az: .35, el: .8, d: .9 },
      { t: 7.4, az: isBottle ? .75 : 1.1, el: .55, d: .78 }, { t: 9.2, az: isBottle ? .8 : 1.1, el: .58, d: .78 },
      { t: 9.9, az: -1.1, el: .55, d: .78 }, { t: 11.8, az: -1.1, el: .58, d: .78 }, { t: 12.3, az: .1, el: .8, d: .8 },
      { t: 13.7, az: .5, el: .72, d: .78 }
    ];

    var lastKey = '';
    function update(t) {
      var sIn = outBack(seg(t, TS.sheetIn[0], TS.sheetIn[1]));
      var vis = t > .001;
      inner.visible = outer.visible = vis;
      world.scale.setScalar(Math.max(.001, sIn));
      var phi = phiAt(t), zc = z0 + r * phi;
      var gh = eio(seg(t, TS.gHi[0], TS.gHi[1])), gl = eio(seg(t, TS.gLo[0], TS.gLo[1]));
      // 드롭
      var dk = seg(t, TS.drop[0], TS.drop[1]);
      obj.visible = t >= TS.drop[0];
      obj.position.set(0, yc + (1 - outBounce(dk)) * (r * 2.5 + 14), zc);
      obj.rotation.x = phi;
      obj.visible = obj.visible && (t < TS.gHi[0] || phi < phiMax - .01 || true);

      var key = phi.toFixed(4) + '|' + gh.toFixed(3) + '|' + gl.toFixed(3);
      if (key !== lastKey) {
        lastKey = key;
        var TWO = PI * 2, rB = r * phi;
        for (var i = 0; i < nx; i++) {
          var row = rows[i];
          var g2 = row.kind === 1 ? gl : (row.kind === 2 ? gh : 0);
          var xx = lerp(row.xs, row.xf, g2);
          var dR = (row.Rf - rp) * g2, amp = row.amp * g2, tw = row.tw * g2, rip = row.rip * g2;
          for (var j = 0; j < nu; j++) {
            var u = Wa * j / (nu - 1), beta = (rB - u) / r, k = (i * nu + j) * 3;
            if (beta < 0) {
              posA[k] = row.xs; posA[k + 1] = .06; posA[k + 2] = z0 + u;
            } else {
              var lay = beta > TWO ? .08 * sm(clamp((beta - TWO) / .3, 0, 1)) : 0;
              var R = rp + lay + dR;
              var b2 = beta + tw;
              var sn = Math.sin(row.k * b2);
              R *= 1 + amp * sn;
              posA[k] = xx + rip * (.55 + .45 * sn);
              posA[k + 1] = yc - R * Math.cos(b2);
              posA[k + 2] = zc - R * Math.sin(b2);
            }
          }
        }
        geo.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();
      }
      // 리본
      var rk = seg(t, TS.ring[0], TS.ring[1]), bk = seg(t, TS.bow[0], TS.bow[1]);
      var zF = z0 + Wa;
      var zEnd = zF;
      ringHi.visible = rk > 0; ringLo.visible = rk > 0;
      var rs = Math.max(.001, outBack(rk));
      ringHi.position.set(tieHiX, yc, zEnd); ringHi.scale.set(rs * (tieHiR + .22), rs * (tieHiR + .22), rs * (tieHiR + .22) * 1.5);
      ringLo.position.set(tieLoX, yc, zEnd); ringLo.scale.set(rs * (rho + .22), rs * (rho + .22), rs * (rho + .22) * 1.5);
      bowHi.visible = bk > 0; bowLo.visible = bk > 0;
      bowHi.position.set(tieHiX, yc + tieHiR + .25, zEnd); bowLo.position.set(tieLoX, yc + rho + .25, zEnd);
      var be = Math.max(.001, outElastic(bk));
      bowHi.scale.setScalar(bowHi.userData.base * be); bowLo.scale.setScalar(bowLo.userData.base * be);
      var fin = t - TS.fin;
      spark.visible = fin > 0 && !bad;
      if (spark.visible) spark.userData.update(fin, mid, yc + 1, zEnd, Math.max(r, 3) * 1.1);
    }

    return {
      scene: sc, update: update, total: TOTAL, bad: bad, span: span,
      caps: caps, camKeys: camKeys, finalT: TS.fin, capAt: function (t) { return captionAt(caps, t); },
      spanAt: function (t) { var objSpan = Math.max(Xa, rp * 2.6) * .85 + 6; return lerp(span, Math.min(span, objSpan), sm(seg(t, 5.2, 7.0))); },
      target: function (t) { return { x: mid * .3, y: yc * .8, z: zcAt(t) }; },
      steps: [{ n: '놓기', t: 0.9 }, { n: '말기', t: 2.3 }, { n: '끝 모으기', t: 7.2 }, { n: '리본', t: 12.0 }, { n: '완성', t: 13.7 }],
      turntable: true
    };
  }

  /* ───────── 외부 API ───────── */
  function dispose(sc) {
    if (!sc) return;
    sc.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.dispose(); }); }
    });
  }

  function show(opt, style) {
    if (!S.ok) return false;
    if (S.cur) dispose(S.cur.scene);
    S.cur = opt.need.shape === 'box' ? buildBox(opt, style) : buildTube(opt, style);
    S.cam.az = .6; S.cam.el = .9; S.cam.d = 1;
    applyT(true);
    S.dirty = true;
    return true;
  }

  function applyT(force) {
    var c = S.cur; if (!c) return;
    c.update(S.t);
    if (S.auto) {
      var k = camAt(c.camKeys, S.t);
      var extra = S.t > c.finalT ? (S.t - c.finalT) * .42 : 0;
      S.cam.az = k.az + extra; S.cam.el = k.el; S.cam.d = k.d;
    }
    var tg = c.target(S.t); S.cam.tx = tg.x; S.cam.ty = tg.y; S.cam.tz = tg.z;
    S.dirty = true;
  }

  function placeCamera() {
    var c = S.cur; if (!c) return;
    var aspect = S.w / S.h;
    var fovRad = S.camera.fov * PI / 180;
    var sp = c.spanAt ? c.spanAt(S.t) : c.span;
    var base = (sp * .95) / Math.tan(fovRad / 2) * (aspect < 1.2 ? 1.2 / Math.max(.55, aspect) * .92 : 1);
    var D = base * S.cam.d;
    var cam = S.cam, ce = Math.cos(cam.el);
    S.camera.position.set(cam.tx + D * Math.sin(cam.az) * ce, cam.ty + D * Math.sin(cam.el), cam.tz + D * Math.cos(cam.az) * ce);
    S.camera.lookAt(cam.tx, cam.ty, cam.tz);
  }

  function loop(now) {
    S.raf = requestAnimationFrame(loop);
    var dt = Math.min(.1, (now - S.last) / 1000); S.last = now;
    if (!S.ok || !S.cur) return;
    if (S.playing) {
      S.t += dt * S.speed;
      if (S.t >= S.cur.total) { S.t = S.cur.total; S.playing = false; }
      applyT();
      notify();
    }
    if (S.visible && S.dirty) {
      placeCamera();
      S.renderer.render(S.cur.scene, S.camera);
      S.dirty = false;
    }
  }

  function notify() {
    if (!S.onFrame || !S.cur) return;
    var c = S.cur.capAt(S.t);
    S.onFrame({ t: S.t, total: S.cur.total, playing: S.playing, caption: c.s, bad: !!c.bad });
  }

  g.Stage = {
    init: init, show: show, resize: resize,
    patternThumb: function (name, size) {
      var c = canvas(TILE), ctx = c.getContext('2d'); (PATTERNS[name] || PATTERNS.red)(ctx);
      var o = canvas(size || 88); o.getContext('2d').drawImage(c, 0, 0, TILE, TILE, 0, 0, o.width, o.height); return o;
    },
    get ok() { return S.ok; },
    setVisible: function (v) { S.visible = v; if (v) { resize(); S.dirty = true; } },
    play: function () { if (!S.cur) return; if (S.t >= S.cur.total - .01) S.t = 0; S.playing = true; if (!S.auto && S.cur) { /* 수동 카메라 유지 */ } notify(); },
    pause: function () { S.playing = false; notify(); },
    toggle: function () { if (S.playing) this.pause(); else this.play(); return S.playing; },
    seek: function (sec) { if (!S.cur) return; S.t = clamp(sec, 0, S.cur.total); applyT(); notify(); },
    restart: function () { S.t = 0; S.playing = true; applyT(); notify(); },
    setSpeed: function (v) { S.speed = v; },
    setAuto: function (v) { S.auto = !!v; S.autoPref = !!v; applyT(); },
    get total() { return S.cur ? S.cur.total : 1; },
    get steps() { return S.cur ? S.cur.steps : []; },
    get playing() { return S.playing; },
    get time() { return S.t; },
    onFrame: function (fn) { S.onFrame = fn; },
    onUserCam: function (fn) { S.onUserCam = fn; },
    peek: function () { return S; }
  };
})(window);
