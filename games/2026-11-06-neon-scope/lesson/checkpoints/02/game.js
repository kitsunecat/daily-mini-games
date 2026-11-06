(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), btnStart = $('start');

  let W = 0, H = 0, dpr = 1;
  let stars = [], backBldg = [], bldg = [], windows = [];
  let state = 'title';
  let t = 0;

  // ---------- city ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  function buildCity() {
    stars = [];
    for (let i = 0; i < 70; i++) stars.push({ x: Math.random() * W, y: Math.random() * H * 0.5, r: Math.random() * 1.2 + 0.3, p: Math.random() * 6 });
    backBldg = [];
    for (let x = -10; x < W + 10;) {
      const w = rand(30, 70), h = rand(H * 0.35, H * 0.7);
      backBldg.push({ x, w, top: H - h });
      x += w + rand(0, 6);
    }
    bldg = []; windows = [];
    const ground = H - 18;
    for (let x = rand(-20, 0); x < W + 10;) {
      const w = Math.round(rand(56, 96));
      const h = Math.round(rand(H * 0.28, H * 0.7));
      const b = { x: Math.round(x), w, top: ground - h, hue: rand(215, 245) };
      bldg.push(b);
      const cols = Math.floor((w - 8) / 18), rows = Math.floor((h - 26) / 28);
      const ox = b.x + (w - cols * 18) / 2 + 3;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const win = { x: ox + c * 18, y: b.top + 14 + r * 28, w: 12, h: 20, lit: Math.random() < 0.55, busy: false };
        if (win.x > 2 && win.x + win.w < W - 2 && win.y > 30) windows.push(win);
        b.wins = (b.wins || 0) + 1;
      }
      x += w + rand(4, 12);
    }
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height));
    cv.width = W * dpr; cv.height = H * dpr;
    buildCity();
  }

  // ---------- drawing ----------
  function drawWorld() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060a1c'); g.addColorStop(0.6, '#1a1f48'); g.addColorStop(1, '#3a2a5c');
    ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3);
    for (const s of stars) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s.p);
      ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff4d0';
    ctx.beginPath(); ctx.arc(W * 0.8, H * 0.12, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e1b40';
    for (const b of backBldg) ctx.fillRect(b.x, b.top, b.w, H);
    for (const b of bldg) {
      ctx.fillStyle = `hsl(${b.hue},30%,13%)`;
      ctx.fillRect(b.x, b.top, b.w, H);
      ctx.fillStyle = `hsl(${b.hue},30%,20%)`;
      ctx.fillRect(b.x, b.top, b.w, 3);
    }
    for (const w of windows) {
      ctx.fillStyle = w.lit ? '#f7d58a' : '#18213d';
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }
    ctx.fillStyle = '#0a0c18'; ctx.fillRect(-W, H - 18, W * 3, H);
    ctx.fillStyle = '#ff6fd8';
    ctx.fillRect(0, H - 18, W, 1.5);
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWorld();
  }

  // ---------- game ----------
  function update(dt) {
    t += dt;
  }

  function start() {
    resize();
    state = 'play';
    overlay.classList.add('hide');
  }

  // ---------- input ----------
  btnStart.addEventListener('click', start);
  window.addEventListener('resize', () => { if (state !== 'play') resize(); });

  // ---------- loop ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(loop);
  }
  resize();
  requestAnimationFrame(loop);
})();
