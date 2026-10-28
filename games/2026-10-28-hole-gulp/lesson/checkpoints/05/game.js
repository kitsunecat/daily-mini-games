(() => {
  'use strict';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  const WORLD_W = 1600, WORLD_H = 2400;
  const BLOCK = 400, ROAD = 64;

  // 物の種類：s は半径の目安（これより穴が大きければ飲みこめる）
  const KINDS = {
    cone:     { s: 6,   value: 1,   color: '#ff8a3d' },
    person:   { s: 7,   value: 2,   color: '#ffd166' },
    bin:      { s: 9,   value: 2,   color: '#5c7a8a' },
    bench:    { s: 12,  value: 3,   color: '#a0673a' },
    tree:     { s: 16,  value: 5,   color: '#3fae5a' },
    car:      { s: 22,  value: 10,  color: null },
    bus:      { s: 32,  value: 18,  color: '#f2c230' },
    house:    { s: 44,  value: 30,  color: null },
    building: { s: 66,  value: 60,  color: null },
    tower:    { s: 95,  value: 120, color: '#7d8fb0' },
  };
  const CAR_COLORS = ['#e94f4f', '#3f8cff', '#f5f5f5', '#2ec4b6', '#9b5de5'];
  const ROOF_COLORS = ['#d9534f', '#5b8def', '#e0a43a', '#6cbf6c'];
  const BLD_COLORS = ['#8d99ae', '#a3b1c6', '#b8a99a', '#9fb4a8'];

  let W = 0, H = 0, dpr = 1;
  let state = 'title';
  let hole, objects;
  let cam = { x: 0, y: 0, zoom: 1 };
  let lastT = 0;
  const input = { dx: 0, dy: 0, active: false, sx: 0, sy: 0 };
  const keys = {};

  // ---------- 画面サイズ ----------
  function resize() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    if (state !== 'play') draw();
  }
  window.addEventListener('resize', resize);

  // ---------- 街の生成 ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function addObj(kind, x, y, extra = {}) {
    const k = KINDS[kind];
    objects.push(Object.assign({
      kind, x, y, s: k.s, value: k.value,
      color: k.color || (kind === 'car' ? pick(CAR_COLORS) : kind === 'house' ? pick(ROOF_COLORS) : pick(BLD_COLORS)),
      rot: 0,
    }, extra));
  }
  function free(x, y, s) {
    for (const o of objects) {
      const d = s + o.s + 4;
      if (Math.abs(o.x - x) < d && Math.abs(o.y - y) < d) return false;
    }
    return true;
  }
  function tryPlace(kind, x0, y0, x1, y1, tries = 30, extra) {
    const s = KINDS[kind].s;
    for (let i = 0; i < tries; i++) {
      const x = rand(x0 + s, x1 - s), y = rand(y0 + s, y1 - s);
      if (free(x, y, s)) { addObj(kind, x, y, extra); return true; }
    }
    return false;
  }

  function buildCity() {
    objects = [];
    const cols = WORLD_W / BLOCK, rows = WORLD_H / BLOCK;
    // 道路の車・バス
    for (let i = 0; i <= cols; i++) {
      const x = i * BLOCK;
      for (let n = 0; n < 4; n++) tryPlace(Math.random() < 0.18 ? 'bus' : 'car', x - ROAD / 2 + 4, 0, x + ROAD / 2 - 4, WORLD_H, 20, { rot: Math.PI / 2 });
    }
    for (let j = 0; j <= rows; j++) {
      const y = j * BLOCK;
      for (let n = 0; n < 3; n++) tryPlace(Math.random() < 0.18 ? 'bus' : 'car', 0, y - ROAD / 2 + 4, WORLD_W, y + ROAD / 2 - 4, 20);
    }
    // 各ブロック
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x0 = i * BLOCK + ROAD / 2, y0 = j * BLOCK + ROAD / 2;
        const x1 = (i + 1) * BLOCK - ROAD / 2, y1 = (j + 1) * BLOCK - ROAD / 2;
        // 中心から遠いほど大きい建物
        const far = Math.hypot((i + 0.5) * BLOCK - WORLD_W / 2, (j + 0.5) * BLOCK - WORLD_H / 2) / 1000;
        if (far > 0.75 && Math.random() < 0.5) tryPlace('tower', x0 + 20, y0 + 20, x1 - 20, y1 - 20);
        const nb = far > 0.4 ? 2 : 0;
        for (let n = 0; n < nb; n++) tryPlace('building', x0 + 16, y0 + 16, x1 - 16, y1 - 16);
        for (let n = 0; n < 3; n++) tryPlace('house', x0 + 14, y0 + 14, x1 - 14, y1 - 14);
        for (let n = 0; n < 5; n++) tryPlace('tree', x0, y0, x1, y1);
        for (let n = 0; n < 3; n++) tryPlace('bench', x0, y0, x1, y1);
        for (let n = 0; n < 4; n++) tryPlace('bin', x0, y0, x1, y1);
        for (let n = 0; n < 8; n++) tryPlace('person', x0, y0, x1, y1, 10, { wander: rand(0, 6.28) });
        for (let n = 0; n < 6; n++) tryPlace('cone', x0, y0, x1, y1);
      }
    }
    // スタート地点の周りは小物を多めに
    for (let n = 0; n < 40; n++) {
      tryPlace(pick(['cone', 'cone', 'person', 'bin']), WORLD_W / 2 - 180, WORLD_H / 2 - 180, WORLD_W / 2 + 180, WORLD_H / 2 + 180, 10, { wander: rand(0, 6.28) });
    }
  }

  // ---------- ゲーム進行 ----------
  function reset() {
    buildCity();
    hole = { x: WORLD_W / 2, y: WORLD_H / 2, r: 20 };
    cam.x = hole.x; cam.y = hole.y; cam.zoom = targetZoom();
  }

  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hidden');
    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function targetZoom() {
    const short = Math.min(W, H);
    return short / (hole.r * 11 + 160);
  }

  function update(dt) {
    // 入力
    let dx = input.dx, dy = input.dy;
    const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
    const ky = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); dx = kx / l; dy = ky / l; }
    const speed = 170 + hole.r * 1.6;
    hole.x = Math.max(hole.r * 0.5, Math.min(WORLD_W - hole.r * 0.5, hole.x + dx * speed * dt));
    hole.y = Math.max(hole.r * 0.5, Math.min(WORLD_H - hole.r * 0.5, hole.y + dy * speed * dt));

    // カメラ
    cam.x += (hole.x - cam.x) * Math.min(1, dt * 6);
    cam.y += (hole.y - cam.y) * Math.min(1, dt * 6);
    cam.zoom += (targetZoom() - cam.zoom) * Math.min(1, dt * 2);
  }

  // ---------- 描画 ----------
  function drawObj(o, scale = 1) {
    const s = o.s * scale;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot);
    // 影
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.ellipse(s * 0.25, s * 0.3, s, s * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    switch (o.kind) {
      case 'cone':
        ctx.fillStyle = o.color;
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, s); ctx.lineTo(-s, s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(-s * 0.5, 0, s, s * 0.3);
        break;
      case 'person':
        ctx.fillStyle = '#4a6fa5'; ctx.beginPath(); ctx.arc(0, s * 0.2, s * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(0, -s * 0.3, s * 0.5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'bin':
        ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3c5260'; ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2); ctx.fill();
        break;
      case 'bench':
        ctx.fillStyle = o.color; ctx.fillRect(-s, -s * 0.4, s * 2, s * 0.8);
        ctx.fillStyle = '#6b4224'; ctx.fillRect(-s, -s * 0.05, s * 2, s * 0.1);
        break;
      case 'tree':
        ctx.fillStyle = '#2a7d40'; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.2, s * 0.7, 0, Math.PI * 2); ctx.fill();
        break;
      default:
        // 大きな物は次のステップで描く。いまは仮の四角
        ctx.fillStyle = o.color; ctx.fillRect(-s, -s, s * 2, s * 2);
    }
    ctx.restore();
  }

  function draw() {
    if (!hole) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d1a26';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // 地面と道路
    ctx.fillStyle = '#9ccc8a';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = '#4b5563';
    for (let x = 0; x <= WORLD_W; x += BLOCK) ctx.fillRect(x - ROAD / 2, 0, ROAD, WORLD_H);
    for (let y = 0; y <= WORLD_H; y += BLOCK) ctx.fillRect(0, y - ROAD / 2, WORLD_W, ROAD);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 18]);
    ctx.beginPath();
    for (let x = 0; x <= WORLD_W; x += BLOCK) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); }
    for (let y = 0; y <= WORLD_H; y += BLOCK) { ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); }
    ctx.stroke();
    ctx.setLineDash([]);

    // 穴
    const r = hole.r;
    const grd = ctx.createRadialGradient(hole.x, hole.y, r * 0.2, hole.x, hole.y, r);
    grd.addColorStop(0, '#000');
    grd.addColorStop(0.8, '#0a0f1a');
    grd.addColorStop(1, '#1d2b45');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(hole.x, hole.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4fd1ff';
    ctx.lineWidth = Math.max(3, r * 0.08);
    ctx.stroke();

    // 街の物（画面内だけ）
    const vw = W / 2 / cam.zoom + 120, vh = H / 2 / cam.zoom + 120;
    for (const o of objects) {
      if (Math.abs(o.x - cam.x) > vw || Math.abs(o.y - cam.y) > vh) continue;
      drawObj(o);
    }
    ctx.restore();

    // 操作スティックの表示
    if (input.active && state === 'play') {
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(input.sx, input.sy, 40, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath(); ctx.arc(input.sx + input.dx * 40, input.sy + input.dy * 40, 14, 0, Math.PI * 2); ctx.fill();
    }
  }

  function loop(t) {
    if (state !== 'play') { draw(); return; }
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    update(dt);
    draw();
    if (state === 'play') requestAnimationFrame(loop);
  }

  // ---------- 入力 ----------
  function localPos(e) {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  cv.addEventListener('pointerdown', (e) => {
    const p = localPos(e);
    input.active = true; input.sx = p.x; input.sy = p.y; input.dx = 0; input.dy = 0;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!input.active) return;
    const p = localPos(e);
    let dx = p.x - input.sx, dy = p.y - input.sy;
    const l = Math.hypot(dx, dy);
    if (l > 40) { input.sx = p.x - dx / l * 40; input.sy = p.y - dy / l * 40; dx = dx / l * 40; dy = dy / l * 40; }
    const m = Math.hypot(dx, dy);
    const k = m < 6 ? 0 : Math.min(1, m / 40) / m;
    input.dx = dx * k; input.dy = dy * k;
  });
  const end = () => { input.active = false; input.dx = 0; input.dy = 0; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (state !== 'play' && (k === 'Enter' || k === ' ')) { e.preventDefault(); start(); return; }
    keys[k] = true;
    if (k.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k] = false;
  });

  startBtn.addEventListener('click', start);

  resize();
  reset();
  draw();
})();
