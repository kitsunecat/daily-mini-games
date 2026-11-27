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
  const PELLETS = 700;
  const AI_COUNT = 11;
  const PAL = [
    ['#ff6b6b', '#ffb3b3'], ['#4dabf7', '#a5d8ff'], ['#ffd43b', '#fff3bf'], ['#b197fc', '#e5dbff'],
    ['#69db7c', '#d3f9d8'], ['#ff922b', '#ffd8a8'], ['#f783ac', '#ffdeeb'], ['#3bc9db', '#c5f6fa'],
    ['#a9e34b', '#e9fac8'], ['#e599f7', '#f8f0fc'], ['#ffa8a8', '#fff5f5'], ['#74c0fc', '#e7f5ff'],
  ];
  const NAMES = ['にょろ太', 'ぺこ', 'スピン', 'ミント', 'ごま', 'トマト', 'ルル', 'ぽてと', 'ジグ', 'サバ', 'もち', 'くるり', 'ポン', 'ラムネ'];
  const PELLET_COLORS = ['#ff8787', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ffa94d', '#63e6be', '#f783ac'];

  let snakes = [], pellets = [], player = null;
  let state = 'title';   // title | play | dying | over
  let lastT = 0;
  let camX = 0, camY = 0, camS = 1;
  const input = { ang: 0, boost: false, left: false, right: false, keyBoost: false, mouseDown: false };

  const rand = (a, b) => a + Math.random() * (b - a);
  const radiusOf = (m) => Math.min(24, 7 + Math.sqrt(m) * 0.55);
  const segCountOf = (m) => Math.floor(10 + m * 0.45);
  function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

  function randInArena(margin) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (R - margin);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  }
  function addPellet(x, y, v, c) {
    if (x === undefined) { const p = randInArena(30); x = p.x; y = p.y; v = Math.random() < 0.1 ? 2 : 1; }
    pellets.push({ x, y, v, r: 3 + Math.sqrt(v) * 2.2, c: c || PELLET_COLORS[(Math.random() * PELLET_COLORS.length) | 0], ph: Math.random() * 6 });
  }

  function pickName() {
    const used = new Set(snakes.filter((o) => o.alive).map((o) => o.name));
    const free = NAMES.filter((n) => !used.has(n));
    const pool = free.length ? free : NAMES;
    return pool[(Math.random() * pool.length) | 0];
  }
  function makeSnake(isPlayer, idx) {
    let pos;
    for (let tries = 0; tries < 30; tries++) {
      pos = isPlayer ? randInArena(500) : randInArena(250);
      if (isPlayer || !player || Math.hypot(pos.x - player.segs[0].x, pos.y - player.segs[0].y) > 450) break;
    }
    const pal = isPlayer ? ['#7dffb0', '#e6fff0'] : PAL[idx % PAL.length];
    const mass = isPlayer ? 20 : rand(14, 90);
    const ang = Math.atan2(-pos.y, -pos.x) + rand(-0.8, 0.8);
    const s = {
      isPlayer, name: isPlayer ? 'あなた' : pickName(),
      c1: pal[0], c2: pal[1], mass, ang, target: ang, boost: false, alive: true, kills: 0,
      segs: [], dropT: 0, think: 0, wander: ang, aggro: 0,
    };
    const n = segCountOf(mass), sp = radiusOf(mass) * 0.55;
    for (let i = 0; i < n; i++) s.segs.push({ x: pos.x - Math.cos(ang) * sp * i, y: pos.y - Math.sin(ang) * sp * i });
    return s;
  }

  function reset() {
    snakes = []; pellets = [];
    for (let i = 0; i < PELLETS; i++) addPellet();
    player = makeSnake(true, 0);
    snakes.push(player);
    for (let i = 0; i < AI_COUNT; i++) snakes.push(makeSnake(false, i));
    input.ang = player.ang; player.target = player.ang;
    camX = player.segs[0].x; camY = player.segs[0].y;
  }

  // ---- AI ----
  function dangerAt(s, x, y, pad) {
    if (Math.hypot(x, y) > R - 40) return true;
    for (const o of snakes) {
      if (!o.alive || o === s) continue;
      const or = radiusOf(o.mass) + pad;
      const h = o.segs[0];
      if (Math.abs(h.x - x) > 600 || Math.abs(h.y - y) > 600) {
        // quick reject using head distance vs length bound
        const bound = o.segs.length * radiusOf(o.mass) * 0.55 + 40;
        if (Math.hypot(h.x - x, h.y - y) > bound) continue;
      }
      for (let i = 0; i < o.segs.length; i += 2) {
        const g = o.segs[i];
        const dx = g.x - x, dy = g.y - y;
        if (dx * dx + dy * dy < or * or) return true;
      }
    }
    return false;
  }

  function aiThink(s, dt) {
    const h = s.segs[0];
    const r = radiusOf(s.mass);
    s.think -= dt;
    if (s.think <= 0) {
      s.think = rand(0.15, 0.35);
      s.boost = false;
      const dc = Math.hypot(h.x, h.y);
      if (dc > R - 220) {
        s.target = Math.atan2(-h.y, -h.x) + rand(-0.4, 0.4);
      } else {
        // hunt the player sometimes when bigger
        let goal = null;
        if (player.alive && s.mass > player.mass * 0.8) {
          const ph = player.segs[0];
          const d = Math.hypot(ph.x - h.x, ph.y - h.y);
          if (d < 260 && Math.random() < 0.35) {
            goal = { x: ph.x + Math.cos(player.ang) * 90, y: ph.y + Math.sin(player.ang) * 90 };
            if (s.mass > 30 && Math.random() < 0.4) s.boost = true;
          }
        }
        if (!goal) {
          let bestScore = -1;
          for (const p of pellets) {
            const dx = p.x - h.x, dy = p.y - h.y;
            if (Math.abs(dx) > 320 || Math.abs(dy) > 320) continue;
            const d = Math.hypot(dx, dy) + 1;
            const a = Math.abs(angDiff(s.ang, Math.atan2(dy, dx)));
            const sc = (p.v * p.v) / (d * (1 + a));
            if (sc > bestScore) { bestScore = sc; goal = p; }
          }
          if (goal && goal.v >= 3 && s.mass > 25 && Math.random() < 0.25) s.boost = true;
        }
        if (goal) s.target = Math.atan2(goal.y - h.y, goal.x - h.x);
        else { s.wander += rand(-0.6, 0.6); s.target = s.wander; }
      }
    }
    // avoidance each frame
    let blocked = false;
    for (const k of [r * 2.2, r * 4.5, r * 7]) {
      if (dangerAt(s, h.x + Math.cos(s.ang) * k, h.y + Math.sin(s.ang) * k, r + 4)) { blocked = true; break; }
    }
    if (blocked) {
      const opts = [0.9, -0.9, 1.8, -1.8, 2.8];
      let chosen = null;
      for (const o of opts) {
        const a = s.ang + o;
        if (!dangerAt(s, h.x + Math.cos(a) * r * 4, h.y + Math.sin(a) * r * 4, r + 4)) { chosen = a; break; }
      }
      s.target = chosen === null ? s.ang + 2.5 : chosen;
      s.think = 0.25;
      s.boost = false;
    }
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
    const target = segCountOf(s.mass);
    while (s.segs.length < target) { const t = s.segs[s.segs.length - 1]; s.segs.push({ x: t.x, y: t.y }); }
    while (s.segs.length > target && s.segs.length > 10) s.segs.pop();
  }

  function eat(s) {
    const h = s.segs[0], r = radiusOf(s.mass);
    const reach = r + 30;
    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i];
      const dx = h.x - p.x, dy = h.y - p.y;
      if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
      const d = Math.hypot(dx, dy);
      if (d < r + p.r) {
        s.mass += p.v;
        pellets[i] = pellets[pellets.length - 1]; pellets.pop();
      } else if (d < reach) {
        const k = Math.min(1, 160 / d) * 0.06; // magnet
        p.x += dx * k; p.y += dy * k;
      }
    }
  }

  function update(dt) {
    if (state === 'play') {
      if (input.left) input.ang -= 3.6 * dt;
      if (input.right) input.ang += 3.6 * dt;
      player.target = input.ang;
    }
    for (const s of snakes) if (s.alive && !s.isPlayer) aiThink(s, dt);
    for (const s of snakes) if (s.alive && (state === 'play' || !s.isPlayer)) moveSnake(s, dt);
    for (const s of snakes) if (s.alive) eat(s);
    while (pellets.length < PELLETS) addPellet();
    if (pellets.length > 1800) pellets.splice(0, pellets.length - 1800);

    if (state === 'play') {
      const m = Math.floor(player.mass);
      scoreEl.textContent = m;
    }
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

    // pellets
    for (const p of pellets) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const pulse = 1 + Math.sin(t * 0.004 + p.ph) * 0.15;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }

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
    if (!s.isPlayer && s.segs[0].x > x0 && s.segs[0].x < x1 && s.segs[0].y > y0 && s.segs[0].y < y1) {
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.name, h.x, h.y - r - 8);
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
  function steerTo(clientX, clientY) {
    const r = cv.getBoundingClientRect();
    const x = clientX - r.left - r.width / 2, y = clientY - r.top - r.height / 2;
    if (x * x + y * y > 16) input.ang = player.ang + angDiff(player.ang, Math.atan2(y, x));
  }
  const touches = new Set();
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state !== 'play') return;
    if (e.pointerType === 'mouse') { if (e.button === 0) input.mouseDown = true; }
    else touches.add(e.pointerId);
    steerTo(e.clientX, e.clientY);
  });
  cv.addEventListener('pointermove', (e) => {
    if (state !== 'play') return;
    if (e.pointerType === 'mouse' || touches.has(e.pointerId)) steerTo(e.clientX, e.clientY);
  });
  const endPtr = (e) => { if (e.pointerType === 'mouse') input.mouseDown = false; touches.delete(e.pointerId); };
  window.addEventListener('pointerup', endPtr);
  window.addEventListener('pointercancel', endPtr);
  startBtn.addEventListener('click', start);
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) { e.preventDefault(); start(); } });
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if ((k === 'Enter' || k === ' ') && state !== 'play' && state !== 'dying') { e.preventDefault(); start(); return; }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { input.left = true; e.preventDefault(); }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') { input.right = true; e.preventDefault(); }
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { input.keyBoost = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = false;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = false;
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') input.keyBoost = false;
  });
  window.addEventListener('blur', () => { input.left = input.right = input.keyBoost = input.boost = input.mouseDown = false; });

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
