(() => {
  'use strict';
  const W = 360, H = 600;
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const $ = (id) => document.getElementById(id);
  const elCoins = $('coins'), elScore = $('score'), elBest = $('best'), elMiss = $('miss');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), btn = $('start');

  // ---------- layout ----------
  const COUNTER_Y = 120, COUNTER_H = 26;
  const SLOTS = [90, 180, 270];
  const OVEN_X = [70, 180, 290];
  const OVEN_Y = 528;
  const BAKE_TIME = 2.3, OVEN_MAX = 6;

  // ---------- audio ----------
  let actx = null;
  function beep(freq, dur, type, vol) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.06, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) { /* no audio */ }
  }

  // ---------- state ----------
  let S = null, running = false, last = 0;

  function newState() {
    return {
      t: 0, coins: 0, score: 0,
      p: { x: 180, y: 300, stack: 0, speedLv: 0, capLv: 0, face: 1, bob: 0 },
      ovens: OVEN_X.map((x, i) => ({ x, open: i === 0, count: 1, timer: 0 })),
      slots: [null, null, null],
      leaving: [],
      spawnT: 1.2,
      xferT: 0,
      floats: [],
    };
  }
  const cap = () => 3 + S.p.capLv * 2;
  const speed = () => 125 + S.p.speedLv * 28;

  // ---------- input ----------
  const keys = {};
  const joy = { on: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  function toLocal(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }
  cv.addEventListener('pointerdown', (e) => {
    if (!running) return;
    const q = toLocal(e);
    joy.on = true; joy.id = e.pointerId; joy.ox = q.x; joy.oy = q.y; joy.dx = 0; joy.dy = 0;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!joy.on || e.pointerId !== joy.id) return;
    const q = toLocal(e);
    joy.dx = q.x - joy.ox; joy.dy = q.y - joy.oy;
  });
  const endJoy = (e) => { if (e.pointerId === joy.id) { joy.on = false; joy.dx = joy.dy = 0; } };
  cv.addEventListener('pointerup', endJoy);
  cv.addEventListener('pointercancel', endJoy);

  // ---------- sizing ----------
  function resize() {
    const r = stage.getBoundingClientRect();
    const s = Math.max(0.3, Math.min((r.width - 16) / W, (r.height - 8) / H));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.style.width = Math.floor(W * s) + 'px';
    cv.style.height = Math.floor(H * s) + 'px';
    cv.width = Math.floor(W * s * dpr);
    cv.height = Math.floor(H * s * dpr);
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    if (!running) draw();
  }
  addEventListener('resize', resize);

  // ---------- game flow ----------
  function start() {
    S = newState();
    running = true;
    overlay.classList.add('hidden');
    beep(660, 0.12, 'triangle');
    hud();
    last = performance.now();
    requestAnimationFrame(loop);
  }
  btn.addEventListener('click', start);

  function hud() {
    elCoins.textContent = S.coins;
    elScore.textContent = S.score;
  }

  function float(x, y, text, color) { S.floats.push({ x, y, text, color, life: 1 }); }

  const COLORS = ['#3d7be0', '#36a66b', '#c84fb0', '#e08a2a', '#5a5ad6', '#1f9fa6', '#d0475a'];
  function spawn() {
    const free = [];
    S.slots.forEach((c, i) => { if (!c) free.push(i); });
    if (!free.length) return false;
    const i = free[Math.floor(Math.random() * free.length)];
    const lvl = Math.min(3, Math.floor(S.t / 35));
    const want = 1 + Math.floor(Math.random() * (lvl + 1));
    const pat = Math.max(11, 21 - S.t * 0.05) + want * 2;
    S.slots[i] = {
      x: Math.random() < 0.5 ? -20 : W + 20, y: 40 + Math.random() * 30, tx: SLOTS[i], ty: 96,
      want, got: 0, pat, max: pat, state: 'walk',
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
    return true;
  }

  function update(dt) {
    S.t += dt;
    const p = S.p;

    // spawn
    S.spawnT -= dt;
    if (S.spawnT <= 0) {
      if (spawn()) S.spawnT = Math.max(1.7, 5.2 - S.t * 0.03) * (0.75 + Math.random() * 0.5);
      else S.spawnT = 0.5;
    }

    // move player
    let mx = 0, my = 0;
    if (keys['arrowleft'] || keys['a']) mx -= 1;
    if (keys['arrowright'] || keys['d']) mx += 1;
    if (keys['arrowup'] || keys['w']) my -= 1;
    if (keys['arrowdown'] || keys['s']) my += 1;
    if (joy.on) {
      const len = Math.hypot(joy.dx, joy.dy);
      if (len > 6) { const k = Math.min(1, len / 40); mx += joy.dx / len * k; my += joy.dy / len * k; }
    }
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    p.x += mx * speed() * dt;
    p.y += my * speed() * dt;
    p.x = Math.max(32, Math.min(W - 32, p.x));
    p.y = Math.max(COUNTER_Y + COUNTER_H + 18, Math.min(OVEN_Y - 54, p.y));
    if (ml > 0.1) { p.bob += dt * 12; if (Math.abs(mx) > 0.1) p.face = mx > 0 ? 1 : -1; }

    // ovens bake
    S.ovens.forEach((o) => {
      if (!o.open) return;
      if (o.count < OVEN_MAX) {
        o.timer += dt;
        if (o.timer >= BAKE_TIME) { o.timer = 0; o.count++; }
      } else o.timer = 0;
    });

    // transfers
    S.xferT -= dt;
    if (S.xferT <= 0) {
      let did = false;
      // pick up from oven
      if (p.y > OVEN_Y - 90) {
        for (const o of S.ovens) {
          if (o.open && o.count > 0 && Math.abs(p.x - o.x) < 46 && p.stack < cap()) {
            o.count--; p.stack++; did = true; beep(520 + p.stack * 40, 0.06, 'square', 0.03);
            break;
          }
        }
      }
      // serve
      if (!did && p.stack > 0 && p.y < COUNTER_Y + COUNTER_H + 52) {
        for (const c of S.slots) {
          if (c && c.state === 'wait' && Math.abs(p.x - c.x) < 48 && c.got < c.want) {
            c.got++; p.stack--; did = true; beep(780, 0.06, 'triangle', 0.04);
            if (c.got >= c.want) serve(c);
            break;
          }
        }
      }
      S.xferT = did ? 0.14 : 0;
    }

    // customers
    S.slots.forEach((c, i) => {
      if (!c) return;
      if (c.state === 'walk') {
        const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
        const v = 160 * dt;
        if (d <= v) { c.x = c.tx; c.y = c.ty; c.state = 'wait'; }
        else { c.x += dx / d * v; c.y += dy / d * v; }
      }
    });
    S.leaving = S.leaving.filter((c) => {
      c.y -= 130 * dt; c.x += (c.x < W / 2 ? -1 : 1) * 60 * dt;
      return c.y > -40;
    });

    S.floats = S.floats.filter((f) => { f.life -= dt * 0.9; f.y -= 30 * dt; return f.life > 0; });
  }

  function serve(c) {
    const tip = Math.floor(5 * c.want * (c.pat / c.max));
    const pay = c.want * 10 + tip;
    S.coins += pay; S.score += pay;
    float(c.x, c.y - 40, `+${pay}`, '#d18a00');
    beep(988, 0.08, 'square', 0.04); setTimeout(() => beep(1319, 0.12, 'square', 0.04), 70);
    const i = S.slots.indexOf(c);
    if (i >= 0) S.slots[i] = null;
    c.state = 'happy';
    S.leaving.push(c);
    hud();
  }

  // ---------- drawing ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function pizza(x, y, r, flat) {
    ctx.save(); ctx.translate(x, y); if (flat) ctx.scale(1, 0.45);
    ctx.fillStyle = '#d98b3a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd25e'; ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d2382b';
    [[0.35, 0.2], [-0.3, 0.3], [0.05, -0.4], [-0.25, -0.2], [0.4, -0.25]].forEach(([a, b]) => {
      ctx.beginPath(); ctx.arc(a * r, b * r, r * 0.14, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }
  function text(t, x, y, size, color, align) {
    ctx.font = `bold ${size}px system-ui, -apple-system, "Hiragino Sans", sans-serif`;
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(t, x, y);
  }

  function drawFloor() {
    // street
    ctx.fillStyle = '#9fb3c4'; ctx.fillRect(0, 0, W, COUNTER_Y);
    ctx.fillStyle = '#b2c4d3';
    for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 20, COUNTER_Y);
    // kitchen tiles
    for (let y = COUNTER_Y; y < H; y += 30) {
      for (let x = 0; x < W; x += 30) {
        ctx.fillStyle = ((x + y) / 30) % 2 === 0 ? '#f1e2c6' : '#e5cfa9';
        ctx.fillRect(x, y, 30, 30);
      }
    }
    // counter
    ctx.fillStyle = '#7a3e1f'; rr(24, COUNTER_Y, W - 48, COUNTER_H, 6); ctx.fill();
    ctx.fillStyle = '#a65a2e'; rr(24, COUNTER_Y, W - 48, 10, 5); ctx.fill();
    SLOTS.forEach((x) => { ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(x - 30, COUNTER_Y + 13, 60, 9, 4); ctx.fill(); });
    // serve zone hint
    ctx.fillStyle = 'rgba(255,190,80,.18)';
    ctx.fillRect(30, COUNTER_Y + COUNTER_H, W - 60, 48);
  }

  function drawOvens() {
    S.ovens.forEach((o, i) => {
      const x = o.x - 40, y = OVEN_Y;
      if (!o.open) {
        ctx.fillStyle = 'rgba(0,0,0,.12)'; rr(x, y, 80, 62, 10); ctx.fill();
        text('🔒', o.x, y + 32, 20, '#555');
        return;
      }
      // dome oven
      ctx.fillStyle = '#8c4a2f'; rr(x, y + 10, 80, 54, 8); ctx.fill();
      ctx.fillStyle = '#b5623d'; ctx.beginPath(); ctx.ellipse(o.x, y + 18, 40, 28, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#2a1208'; ctx.beginPath(); ctx.ellipse(o.x, y + 34, 20, 16, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(o.x - 20, y + 34, 40, 8);
      const glow = 0.5 + 0.5 * Math.sin(S.t * 6 + i);
      ctx.fillStyle = `rgba(255,${120 + glow * 60 | 0},40,.9)`; ctx.beginPath(); ctx.ellipse(o.x, y + 38, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
      // bake progress
      ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(x + 10, y + 52, 60, 6, 3); ctx.fill();
      if (o.count < OVEN_MAX) { ctx.fillStyle = '#ffcf3d'; rr(x + 10, y + 52, 60 * (o.timer / BAKE_TIME), 6, 3); ctx.fill(); }
      // table with stack
      ctx.fillStyle = '#c9a274'; rr(o.x - 30, y - 18, 60, 22, 5); ctx.fill();
      for (let k = 0; k < o.count; k++) pizza(o.x, y - 4 - k * 5, 18, true);
    });
  }

  function drawCustomer(c) {
    const bob = c.state === 'walk' || c.state === 'happy' || c.state === 'angry' ? Math.sin(S.t * 14) * 2 : 0;
    const x = c.x, y = c.y + bob;
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 18, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.state === 'angry' ? '#c93b2c' : c.color; rr(x - 14, y - 4, 28, 22, 9); ctx.fill();
    ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(x, y - 14, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(x - 4, y - 15, 1.8, 0, Math.PI * 2); ctx.arc(x + 4, y - 15, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.6; ctx.beginPath();
    if (c.state === 'happy') ctx.arc(x, y - 11, 4, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (c.state === 'angry' || (c.state === 'wait' && c.pat / c.max < 0.3)) ctx.arc(x, y - 6, 4, 1.15 * Math.PI, 1.85 * Math.PI);
    else { ctx.moveTo(x - 3, y - 9); ctx.lineTo(x + 3, y - 9); }
    ctx.stroke();
    if (c.state === 'wait') {
      // bubble
      ctx.fillStyle = '#fff'; rr(x - 24, y - 58, 48, 26, 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 5, y - 33); ctx.lineTo(x + 5, y - 33); ctx.lineTo(x, y - 27); ctx.fill();
      pizza(x - 10, y - 45, 8, false);
      text(`${c.want - c.got}`, x + 10, y - 45, 15, '#5a2a12');
    }
  }

  function drawPlayer() {
    const p = S.p, b = Math.sin(p.bob) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 16, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; rr(p.x - 14, p.y - 4 + b, 28, 22, 9); ctx.fill();
    ctx.fillStyle = '#d2382b'; ctx.fillRect(p.x - 14, p.y + 6 + b, 28, 4);
    ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(p.x, p.y - 14 + b, 12, 0, Math.PI * 2); ctx.fill();
    // chef hat
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x - 6, p.y - 28 + b, 7, 0, Math.PI * 2); ctx.arc(p.x + 6, p.y - 28 + b, 7, 0, Math.PI * 2); ctx.arc(p.x, p.y - 32 + b, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(p.x - 10, p.y - 26 + b, 20, 6);
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(p.x - 4 + p.face * 2, p.y - 14 + b, 1.8, 0, Math.PI * 2); ctx.arc(p.x + 4 + p.face * 2, p.y - 14 + b, 1.8, 0, Math.PI * 2); ctx.fill();
    // carried stack (in front, above hands)
    for (let k = 0; k < p.stack; k++) pizza(p.x + p.face * 16, p.y + 4 + b - k * 5, 13, true);
    if (p.stack >= cap()) text('MAX', p.x + p.face * 16, p.y - 8 + b - p.stack * 5, 10, '#d2382b');
  }

  function drawJoy() {
    if (!joy.on) return;
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 40, 0, Math.PI * 2); ctx.stroke();
    const len = Math.hypot(joy.dx, joy.dy), k = len > 40 ? 40 / len : 1;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.arc(joy.ox + joy.dx * k, joy.oy + joy.dy * k, 16, 0, Math.PI * 2); ctx.fill();
  }

  function draw() {
    if (!S) S = newState();
    ctx.clearRect(0, 0, W, H);
    drawFloor();
    drawOvens();
    S.leaving.forEach(drawCustomer);
    S.slots.forEach((c) => c && drawCustomer(c));
    // counter front edge over customers' legs
    ctx.fillStyle = '#7a3e1f'; rr(24, COUNTER_Y + 10, W - 48, COUNTER_H - 10, 4); ctx.fill();
    drawPlayer();
    S.floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5));
      text(f.text, f.x + 1, f.y + 1, 16, 'rgba(0,0,0,.35)');
      text(f.text, f.x, f.y, 16, f.color);
      ctx.globalAlpha = 1;
    });
    drawJoy();
  }

  function loop(now) {
    if (!running) { draw(); return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    if (running) requestAnimationFrame(loop);
    else draw();
  }

  resize();
})();
