(() => {
  'use strict';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  const WORLD_W = 1600, WORLD_H = 2400;
  const BLOCK = 400, ROAD = 64;

  let W = 0, H = 0, dpr = 1;
  let state = 'title';
  let hole;
  let cam = { x: 0, y: 0, zoom: 1 };
  let lastT = 0;
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

  // ---------- ゲーム進行 ----------
  function reset() {
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
    let dx = 0, dy = 0;
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

    ctx.restore();
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
