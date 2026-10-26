(() => {
  'use strict';

  const LANE_GAP = 2.2;      // レーンの間隔（ワールド単位）
  const DEPTH = 28;          // 遠近感の強さ

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('score');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  let W = 0, H = 0, dpr = 1;

  let state = 'title';
  let player, dist, speed, lastTime;
  let skyline = [];

  // ---------- 画面サイズ ----------
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    skyline = [];
    let x = -10;
    while (x < W + 10) {
      const w = 18 + Math.random() * 34;
      skyline.push({ x, w, h: 20 + Math.random() * 70, lit: Math.random() });
      x += w + 2;
    }
  }
  window.addEventListener('resize', () => { resize(); draw(); });

  // ---------- 投影 ----------
  const horizon = () => H * 0.3;
  const groundY = () => H * 0.86;
  const unitPx = () => Math.min(W, H * 0.6) * 0.3 / LANE_GAP;
  function proj(x, y, z) {
    const t = 1 / (1 + Math.max(z, -DEPTH * 0.4) / DEPTH);
    return {
      x: W / 2 + x * unitPx() * t,
      y: horizon() + (groundY() - horizon()) * t - y * unitPx() * t,
      s: t,
    };
  }

  // ---------- ゲーム開始 ----------
  function reset() {
    player = { lane: 0, x: 0, y: 0, vy: 0, slide: 0, run: 0 };
    dist = 0;
    speed = 13;
    updateHud();
  }

  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hidden');
    lastTime = performance.now();
  }

  const calcScore = () => Math.floor(dist);
  function updateHud() {
    scoreEl.textContent = calcScore();
  }

  startBtn.addEventListener('click', (e) => { e.stopPropagation(); start(); });

  // ---------- 更新 ----------
  function update(dt) {
    if (state !== 'play') return;

    speed = Math.min(34, 13 + dist / 90);
    const dz = speed * dt;
    dist += dz;
    player.run += dz;

    updateHud();
  }

  // ---------- 描画 ----------
  function draw() {
    if (!W) return;
    const hz = horizon(), gy = groundY();

    // 空
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#1a1145');
    sky.addColorStop(1, '#ff7aa8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz + 1);
    ctx.fillStyle = 'rgba(255,230,160,0.9)';
    ctx.beginPath();
    ctx.arc(W * 0.78, hz * 0.45, Math.min(W, H) * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // ビル群
    skyline.forEach((b) => {
      ctx.fillStyle = '#2a1d55';
      ctx.fillRect(b.x, hz - b.h, b.w, b.h);
      if (b.lit > 0.4) {
        ctx.fillStyle = 'rgba(255,224,120,0.55)';
        for (let yy = hz - b.h + 6; yy < hz - 6; yy += 10) {
          for (let xx = b.x + 4; xx < b.x + b.w - 4; xx += 8) {
            if (((xx * 7 + yy * 3) | 0) % 5 < 2) ctx.fillRect(xx, yy, 3, 4);
          }
        }
      }
    });

    // 地面
    ctx.fillStyle = '#1e2a3a';
    ctx.fillRect(0, hz, W, H - hz);
    const farL = proj(-LANE_GAP * 1.6, 0, 400), farR = proj(LANE_GAP * 1.6, 0, 400);
    const nearL = proj(-LANE_GAP * 1.6, 0, -6), nearR = proj(LANE_GAP * 1.6, 0, -6);
    ctx.fillStyle = '#3a3f58';
    ctx.beginPath();
    ctx.moveTo(farL.x, farL.y); ctx.lineTo(farR.x, farR.y);
    ctx.lineTo(nearR.x, nearR.y); ctx.lineTo(nearL.x, nearL.y);
    ctx.closePath();
    ctx.fill();

    // 枕木（流れるしま模様）
    const off = (player ? player.run : 0) % 4;
    for (let z = -off; z < 120; z += 4) {
      if (z < -6) continue;
      const a = proj(-LANE_GAP * 1.55, 0, z), b = proj(LANE_GAP * 1.55, 0, z);
      const c = proj(LANE_GAP * 1.55, 0, z + 1.2);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(a.x, c.y, b.x - a.x, a.y - c.y);
    }
    // レーン線
    ctx.strokeStyle = 'rgba(120,240,255,0.55)';
    ctx.lineWidth = 2;
    [-0.5, 0.5].forEach((k) => {
      const f = proj(k * LANE_GAP, 0, 400), n = proj(k * LANE_GAP, 0, -6);
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(n.x, n.y); ctx.stroke();
    });

    // 遠景フォグ
    const fog = ctx.createLinearGradient(0, hz, 0, hz + (gy - hz) * 0.25);
    fog.addColorStop(0, 'rgba(255,122,168,0.55)');
    fog.addColorStop(1, 'rgba(255,122,168,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, hz, W, (gy - hz) * 0.25);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - (lastTime || now)) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  reset();
  requestAnimationFrame(loop);
})();
