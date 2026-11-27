(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score'), bestEl = $('best'), kcEl = $('kc'), boardEl = $('board');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');
  const boostBtn = $('boost'), msgEl = $('msg');

  let W = 0, H = 0, DPR = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- world ----
  const R = 1300;               // arena radius

  let snakes = [], player = null;
  let state = 'title';   // title | play | dying | over
  let lastT = 0;
  let camX = 0, camY = 0, camS = 1;

  const rand = (a, b) => a + Math.random() * (b - a);
  const radiusOf = (m) => Math.min(24, 7 + Math.sqrt(m) * 0.55);
  const segCountOf = (m) => Math.floor(10 + m * 0.45);
  function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

  function randInArena(margin) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (R - margin);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  }
  function makeSnake(isPlayer, idx) {
    const pos = randInArena(500);
    const pal = ['#7dffb0', '#e6fff0'];
    const mass = 20;
    const ang = Math.atan2(-pos.y, -pos.x) + rand(-0.8, 0.8);
    const s = {
      isPlayer, name: 'あなた',
      c1: pal[0], c2: pal[1], mass, ang, target: ang, boost: false, alive: true, kills: 0,
      segs: [], dropT: 0, think: 0, wander: ang, aggro: 0,
    };
    const n = segCountOf(mass), sp = radiusOf(mass) * 0.55;
    for (let i = 0; i < n; i++) s.segs.push({ x: pos.x - Math.cos(ang) * sp * i, y: pos.y - Math.sin(ang) * sp * i });
    return s;
  }

  function reset() {
    snakes = [];
    player = makeSnake(true, 0);
    snakes.push(player);
    player.target = player.ang;
    camX = player.segs[0].x; camY = player.segs[0].y;
  }

  // ---- simulation ----
  function moveSnake(s, dt) {
    const r = radiusOf(s.mass);
    const turn = 4.2 - Math.min(1.8, s.mass / 160);
    const d = angDiff(s.ang, s.target);
    const mt = turn * dt;
    s.ang += Math.abs(d) < mt ? d : Math.sign(d) * mt;
    const speed = 135;
    const h = s.segs[0];
    h.x += Math.cos(s.ang) * speed * dt;
    h.y += Math.sin(s.ang) * speed * dt;
    const sp = r * 0.55;
    for (let i = 1; i < s.segs.length; i++) {
      const a = s.segs[i - 1], b = s.segs[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dd = Math.hypot(dx, dy);
      if (dd > sp) { const k = sp / dd; b.x = a.x + dx * k; b.y = a.y + dy * k; }
    }
  }

  function update(dt) {
    for (const s of snakes) if (s.alive && (state === 'play' || !s.isPlayer)) moveSnake(s, dt);
    const h = player.segs[0];
    camX += (h.x - camX) * Math.min(1, dt * 8);
    camY += (h.y - camY) * Math.min(1, dt * 8);
    const want = (Math.min(W, H * 0.8) / 380) * Math.max(0.55, 1 - (radiusOf(player.mass) - 9) * 0.028);
    camS += (want - camS) * Math.min(1, dt * 2);
  }

  // ---- drawing ----
  function draw(t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#1a1d3a';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camS, camS);
    ctx.translate(-camX, -camY);
    const vw = W / 2 / camS + 40, vh = H / 2 / camS + 40;
    const x0 = camX - vw, x1 = camX + vw, y0 = camY - vh, y1 = camY + vh;

    // arena floor
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = '#20244a'; ctx.fill();
    // hex dot grid
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(140, 150, 230, .16)';
    const g = 46;
    for (let y = Math.floor(y0 / g) * g; y < y1; y += g) {
      const off = (Math.round(y / g) & 1) ? g / 2 : 0;
      for (let x = Math.floor(x0 / g) * g + off; x < x1; x += g) { ctx.fillRect(x - 2, y - 2, 4, 4); }
    }
    ctx.restore();
    // wall
    ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255, 80, 90, .75)';
    ctx.beginPath(); ctx.arc(0, 0, R + 7, 0, Math.PI * 2); ctx.stroke();

    // snakes (player drawn last)
    const order = snakes.filter((s) => s.alive && !s.isPlayer);
    if (player.alive) order.push(player);
    for (const s of order) drawSnake(s, x0, x1, y0, y1, t);
    ctx.restore();
  }

  function drawSnake(s, x0, x1, y0, y1, t) {
    const r = radiusOf(s.mass);
    const segs = s.segs;
    for (let i = segs.length - 1; i >= 0; i--) {
      const g = segs[i];
      if (g.x < x0 - r || g.x > x1 + r || g.y < y0 - r || g.y > y1 + r) continue;
      const stripe = Math.floor(i / 4) % 2 === 0;
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.arc(g.x + 1.5, g.y + 2.5, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = stripe ? s.c1 : s.c2;
      ctx.beginPath(); ctx.arc(g.x, g.y, r, 0, Math.PI * 2); ctx.fill();
    }
    // head + eyes
    const h = segs[0];
    const ca = Math.cos(s.ang), sa = Math.sin(s.ang);
    ctx.fillStyle = s.c1;
    ctx.beginPath(); ctx.arc(h.x, h.y, r * 1.08, 0, Math.PI * 2); ctx.fill();
    for (const side of [-1, 1]) {
      const ex = h.x + ca * r * 0.35 - sa * r * 0.5 * side;
      const ey = h.y + sa * r * 0.35 + ca * r * 0.5 * side;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1b2e';
      ctx.beginPath(); ctx.arc(ex + ca * r * 0.14, ey + sa * r * 0.14, r * 0.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---- flow ----
  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hidden');
    msgEl.textContent = '進みたい方向をタッチ！';
  }

  // ---- input ----
  startBtn.addEventListener('click', start);
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) { e.preventDefault(); start(); } });
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if ((k === 'Enter' || k === ' ') && state !== 'play' && state !== 'dying') { e.preventDefault(); start(); return; }
  });

  // ---- loop ----
  function frame(t) {
    const dt = Math.min(0.05, (t - (lastT || t)) / 1000);
    lastT = t;
    if (W !== stage.clientWidth || H !== stage.clientHeight) resize();
    update(dt);
    draw(t);
    requestAnimationFrame(frame);
  }
  reset();
  requestAnimationFrame(frame);
})();
