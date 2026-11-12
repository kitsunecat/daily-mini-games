(() => {
  'use strict';
  const W = 360, H = 600;
  const ROAD_L = 30, ROAD_R = 330, MID = (ROAD_L + ROAD_R) / 2;
  const CROWD_Y = 470;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stageEl = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');
  const countEl = document.getElementById('count');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');

  // ---------- canvas sizing ----------
  let scale = 1;
  function resize() {
    const r = stageEl.getBoundingClientRect();
    const availW = Math.max(100, r.width - 16), availH = Math.max(100, r.height - 8);
    const s = Math.min(availW / W, availH / H);
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = Math.floor(W * s) + 'px';
    cv.style.height = Math.floor(H * s) + 'px';
    cv.width = Math.floor(W * s * dpr);
    cv.height = Math.floor(H * s * dpr);
    scale = s;
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
  }
  window.addEventListener('resize', () => { resize(); draw(); });

  // ---------- state ----------
  let dist;

  function reset() {
    dist = 0;
  }

  // ---------- draw ----------
  function draw() {
    ctx.save();
    // ground
    ctx.fillStyle = '#5a9a4f'; ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.fillStyle = '#d9c7a3'; ctx.fillRect(ROAD_L, -10, ROAD_R - ROAD_L, H + 20);
    ctx.fillStyle = '#c4af86'; ctx.fillRect(ROAD_L - 6, -10, 6, H + 20); ctx.fillRect(ROAD_R, -10, 6, H + 20);
    // stripes
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    const off = (dist || 0) % 60;
    for (let y = -60 + off; y < H; y += 60) ctx.fillRect(MID - 2, y, 4, 28);

    ctx.restore();
  }

  // ---------- flow ----------
  function start() {
    reset();
    overlay.classList.add('hidden');
  }

  // ---------- input ----------
  startBtn.addEventListener('click', start);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) start(); });

  reset();
  resize();
  draw();
})();
