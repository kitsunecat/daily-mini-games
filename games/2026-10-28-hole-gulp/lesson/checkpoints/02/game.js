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
  let hole;
  let cam = { x: 0, y: 0, zoom: 1 };

  // ---------- 画面サイズ ----------
  function resize() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    draw();
  }
  window.addEventListener('resize', resize);

  // ---------- ゲーム進行 ----------
  function reset() {
    hole = { x: WORLD_W / 2, y: WORLD_H / 2, r: 20 };
    cam.x = hole.x; cam.y = hole.y; cam.zoom = targetZoom();
  }

  function targetZoom() {
    const short = Math.min(W, H);
    return short / (hole.r * 11 + 160);
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

    ctx.restore();
  }

  startBtn.addEventListener('click', () => overlay.classList.add('hidden'));

  resize();
  reset();
  draw();
})();
