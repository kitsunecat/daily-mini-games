// ランタン守りの夜 — 夜明けまで生き延びるサバイバー系アクション
(() => {
  'use strict';

  const WORLD = 3200;        // ワールドの一辺

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  let W = 0, H = 0, DPR = 1, zoom = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    zoom = clamp(Math.min(W, H) / 620, 0.55, 1.25);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- 状態 ----------
  let state = 'title'; // title / play
  let P;
  let t;

  function reset() {
    P = {
      x: WORLD / 2, y: WORLD / 2, r: 16,
      face: 1, walk: 0,
    };
    t = 0;
  }
  reset();

  // ---------- 更新 ----------
  function update(dt) {
    t += dt;
  }

  // ---------- 画面遷移 ----------
  function hideOverlays() {
    for (const id of ['title']) $(id).classList.add('hidden');
  }
  function startGame() {
    reset();
    hideOverlays();
    state = 'play';
  }

  $('startBtn').addEventListener('click', startGame);

  // ---------- 描画 ----------
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function drawGround(camX, camY, vw, vh) {
    ctx.fillStyle = 'rgb(20,30,46)';
    ctx.fillRect(camX, camY, vw, vh);
    const T = 64;
    const x0 = Math.floor(camX / T), y0 = Math.floor(camY / T);
    const x1 = Math.ceil((camX + vw) / T), y1 = Math.ceil((camY + vh) / T);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const h = hash(ix, iy);
        const px = ix * T + hash(iy, ix) * 40, py = iy * T + h * 40;
        if (h < 0.35) {
          ctx.strokeStyle = 'rgba(90,140,110,.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py); ctx.lineTo(px - 4, py - 9);
          ctx.moveTo(px + 4, py); ctx.lineTo(px + 5, py - 11);
          ctx.moveTo(px + 8, py); ctx.lineTo(px + 12, py - 8);
          ctx.stroke();
        } else if (h < 0.42) {
          ctx.fillStyle = 'rgba(120,120,150,.35)';
          ctx.beginPath(); ctx.ellipse(px, py, 9, 6, 0, 0, TAU); ctx.fill();
        } else if (h < 0.46) {
          ctx.fillStyle = h < 0.44 ? 'rgba(255,190,220,.55)' : 'rgba(255,240,160,.55)';
          for (let k = 0; k < 5; k++) {
            const a = k * TAU / 5;
            ctx.beginPath(); ctx.arc(px + Math.cos(a) * 3.5, py + Math.sin(a) * 3.5, 2.4, 0, TAU); ctx.fill();
          }
        }
      }
    }
    // ワールドの外側（深い森）
    ctx.fillStyle = 'rgba(5,8,14,.85)';
    if (camX < 0) ctx.fillRect(camX, camY, -camX, vh);
    if (camY < 0) ctx.fillRect(camX, camY, vw, -camY);
    if (camX + vw > WORLD) ctx.fillRect(WORLD, camY, camX + vw - WORLD, vh);
    if (camY + vh > WORLD) ctx.fillRect(camX, WORLD, vw, camY + vh - WORLD);
  }

  function drawPlayer() {
    const x = P.x, y = P.y, f = P.face;
    const bob = P.moving ? Math.sin(P.walk) * 2 : 0;
    ctx.save();
    ctx.translate(x, y + bob);
    // 影
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(0, 16 - bob, 15, 5, 0, 0, TAU); ctx.fill();
    ctx.scale(f, 1);
    // しっぽ
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath(); ctx.ellipse(-16, 4, 11, 6, -0.6 + Math.sin(P.walk * 0.5) * 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff3e0';
    ctx.beginPath(); ctx.ellipse(-24, -1, 4, 3.5, -0.6, 0, TAU); ctx.fill();
    // 体
    ctx.fillStyle = '#ff9a4d';
    ctx.beginPath(); ctx.ellipse(0, 4, 12, 11, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff3e0';
    ctx.beginPath(); ctx.ellipse(2, 7, 6, 6, 0, 0, TAU); ctx.fill();
    // 頭
    ctx.fillStyle = '#ffa55c';
    ctx.beginPath(); ctx.arc(3, -9, 10, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-5, -14); ctx.lineTo(-3, -25); ctx.lineTo(3, -17); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, -17); ctx.lineTo(11, -25); ctx.lineTo(12, -13); ctx.fill();
    ctx.fillStyle = '#fff3e0';
    ctx.beginPath(); ctx.ellipse(8, -6, 5, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2b1a10';
    ctx.beginPath(); ctx.arc(7, -11, 1.8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(12.5, -7, 1.6, 0, TAU); ctx.fill();
    // ランタン
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(11, 2); ctx.lineTo(16, -4); ctx.stroke();
    ctx.fillStyle = '#ffd56b';
    ctx.shadowColor = '#ffb030'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(13, -3, 9, 11, 3) : ctx.rect(13, -3, 9, 11); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#8a5a2e';
    ctx.fillRect(12, -4, 11, 2); ctx.fillRect(12, 7, 11, 2);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const vw = W / zoom, vh = H / zoom;
    let camX = P.x - vw / 2, camY = P.y - vh / 2;
    const toWorld = () => ctx.setTransform(DPR * zoom, 0, 0, DPR * zoom, -camX * DPR * zoom, -camY * DPR * zoom);
    toWorld();
    drawGround(camX, camY, vw, vh);

    drawPlayer();
  }

  // ---------- ループ ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'play') update(dt);
    else if (state === 'title') { P.walk += dt * 4; t += dt * 0.2; }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
