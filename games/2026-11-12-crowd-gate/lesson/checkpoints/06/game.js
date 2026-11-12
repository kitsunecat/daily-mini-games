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

  // ---------- audio ----------
  let actx = null;
  function beep(freq, dur, type, vol) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.06, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  // ---------- state ----------
  let state = 'title';
  let n, px, targetX, dist, speed, objs, nextAt, plan, stage, kills, particles, shake, t;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));

  function crowdRadius(count) { return Math.min(62, 6 + 5.2 * Math.sqrt(Math.min(count, 140))); }

  function reset() {
    n = 1; px = MID; targetX = MID; dist = 0; speed = 150; objs = []; nextAt = 260;
    plan = []; stage = 1; kills = 0; particles = []; shake = 0; t = 0;
  }

  // ---------- level generation ----------
  function goodOp() {
    const r = Math.random();
    if (r < 0.18) return { op: 'x', v: Math.random() < 0.8 ? 2 : 3 };
    return { op: '+', v: randi(4, 10) + stage * randi(2, 5) };
  }
  function badOp() {
    const r = Math.random();
    if (r < 0.25 && n > 8) return { op: '÷', v: 2 };
    return { op: '-', v: randi(3, 8) + stage * randi(2, 4) };
  }
  function makePlan() {
    const p = [];
    const len = 5 + Math.min(stage, 4);
    for (let i = 0; i < len; i++) {
      p.push('gate');
      if (i > 0) p.push(Math.random() < 0.55 ? 'enemy' : 'saw');
    }
    return p;
  }

  function spawn(kind, d) {
    if (kind === 'gate') {
      let a, b;
      if (Math.random() < 0.4) { a = goodOp(); b = goodOp(); } else { a = goodOp(); b = badOp(); }
      if (Math.random() < 0.5) [a, b] = [b, a];
      objs.push({ kind, d, left: a, right: b, used: false });
      return 150;
    }
    if (kind === 'enemy') {
      const m = Math.max(3, Math.round(n * rand(0.2, 0.55)) + randi(0, stage * 3));
      const r = crowdRadius(m);
      objs.push({ kind, d, m, r, x: rand(ROAD_L + r, ROAD_R - r), vx: Math.random() < 0.5 ? 0 : rand(-30, 30), used: false });
      return 170;
    }
    if (kind === 'saw') {
      const w = rand(70, 120);
      objs.push({ kind, d, w, x: rand(ROAD_L + w / 2, ROAD_R - w / 2), vx: (Math.random() < 0.5 ? -1 : 1) * rand(40, 70 + stage * 10), used: false, rot: 0 });
      return 150;
    }
    return 150;
  }

  function ensureSpawns() {
    while (nextAt < dist + H) {
      if (plan.length === 0) plan = makePlan();
      const kind = plan.shift();
      nextAt += spawn(kind, nextAt);
    }
  }

  // ---------- effects ----------
  function burst(x, y, color, k) {
    for (let i = 0; i < k; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(40, 180);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.7), color });
    }
  }

  function loseMembers(k, color) {
    k = Math.min(n, Math.max(0, Math.round(k)));
    if (k <= 0) return;
    n -= k;
    burst(px, CROWD_Y, color || '#4d7cff', Math.min(30, k + 4));
    shake = 0.2;
    if (n <= 0) gameOver();
  }

  // ---------- update ----------
  function update(dt) {
    t += dt;
    if (state === 'play') {
      speed = Math.min(300, 150 + dist / 60);
      dist += speed * dt;
      const keyV = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
      if (keyV) targetX += keyV * 280 * dt;
      const r = crowdRadius(n);
      targetX = Math.max(ROAD_L + r, Math.min(ROAD_R - r, targetX));
      px += (targetX - px) * Math.min(1, dt * 14);
      ensureSpawns();

      for (const o of objs) {
        const y = CROWD_Y - (o.d - dist);
        if (o.kind === 'enemy') {
          o.x += o.vx * dt;
          if (o.x < ROAD_L + o.r || o.x > ROAD_R - o.r) o.vx *= -1;
          if (!o.used && Math.abs(y - CROWD_Y) < o.r + r * 0.6 && Math.abs(o.x - px) < o.r + r * 0.8) {
            o.used = true;
            const fight = Math.min(n, o.m);
            kills += fight;
            burst(o.x, y, '#ff4d5e', Math.min(30, o.m + 4));
            beep(180, 0.15, 'sawtooth', 0.07);
            loseMembers(o.m, '#4d7cff');
            if (state !== 'play') return;
          }
        } else if (o.kind === 'saw') {
          o.x += o.vx * dt; o.rot += dt * 12;
          if (o.x < ROAD_L + o.w / 2) { o.x = ROAD_L + o.w / 2; o.vx *= -1; }
          if (o.x > ROAD_R - o.w / 2) { o.x = ROAD_R - o.w / 2; o.vx *= -1; }
          if (!o.used && y >= CROWD_Y) {
            o.used = true;
            const a = Math.max(px - r, o.x - o.w / 2), b = Math.min(px + r, o.x + o.w / 2);
            const frac = Math.max(0, b - a) / (2 * r);
            if (frac > 0) {
              beep(320, 0.12, 'sawtooth', 0.06);
              loseMembers(Math.max(1, Math.ceil(n * frac * 0.6)), '#4d7cff');
              if (state !== 'play') return;
            }
          }
        } else if (o.kind === 'gate') {
          if (!o.used && y >= CROWD_Y) {
            o.used = true;
            const g = px < MID ? o.left : o.right;
            o.chosen = px < MID ? 'L' : 'R';
            const before = n;
            if (g.op === '+') n += g.v;
            else if (g.op === 'x') n *= g.v;
            else if (g.op === '-') n -= g.v;
            else if (g.op === '÷') n = Math.floor(n / g.v);
            n = Math.min(n, 99999);
            if (n > before) { beep(660, 0.1, 'square', 0.05); setTimeout(() => beep(880, 0.1, 'square', 0.05), 70); }
            else { beep(220, 0.18, 'triangle', 0.08); shake = 0.15; }
            if (n <= 0) { n = 0; gameOver(); return; }
          }
        }
      }
      objs = objs.filter(o => CROWD_Y - (o.d - dist) < H + 120);
    }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
    if (shake > 0) shake -= dt;
    countEl.textContent = n;
  }

  // ---------- draw ----------
  function drawPeople(cx, cy, count, body, head) {
    const shown = Math.min(count, 140);
    const bob = Math.sin(t * 14);
    for (let i = shown - 1; i >= 0; i--) {
      const a = i * 2.39996, rr = 5.2 * Math.sqrt(i);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.8 + (i % 2 ? bob : -bob) * 1.2;
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(x, y + 2, 3.6, 4.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = head;
      ctx.beginPath(); ctx.arc(x, y - 4, 2.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  function label(text, x, y, size, color) {
    ctx.font = 'bold ' + size + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }

  function opText(g) { return (g.op === 'x' ? '×' : g.op) + g.v; }
  function opGood(g) { return g.op === '+' || g.op === 'x'; }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-3, 3), rand(-3, 3));
    // ground
    ctx.fillStyle = '#5a9a4f'; ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.fillStyle = '#d9c7a3'; ctx.fillRect(ROAD_L, -10, ROAD_R - ROAD_L, H + 20);
    ctx.fillStyle = '#c4af86'; ctx.fillRect(ROAD_L - 6, -10, 6, H + 20); ctx.fillRect(ROAD_R, -10, 6, H + 20);
    // stripes
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    const off = (dist || 0) % 60;
    for (let y = -60 + off; y < H; y += 60) ctx.fillRect(MID - 2, y, 4, 28);

    if (objs) for (const o of objs) {
      const y = CROWD_Y - (o.d - dist);
      if (y < -80 || y > H + 80) continue;
      if (o.kind === 'gate') {
        const sides = [[ROAD_L, MID, o.left, 'L'], [MID, ROAD_R, o.right, 'R']];
        for (const [a, b, g, s] of sides) {
          const good = opGood(g);
          const dim = o.used && o.chosen !== s;
          ctx.globalAlpha = o.used ? (dim ? 0.25 : 0.55) : 0.85;
          ctx.fillStyle = good ? '#3fb0ff' : '#ff5a6a';
          ctx.fillRect(a + 4, y - 22, b - a - 8, 34);
          ctx.globalAlpha = 1;
          ctx.fillStyle = good ? '#1d6fb8' : '#b5303e';
          ctx.fillRect(a + 2, y - 30, 8, 46); ctx.fillRect(b - 10, y - 30, 8, 46);
          if (!dim) label(opText(g), (a + b) / 2, y - 5, 26, '#fff');
        }
      } else if (o.kind === 'enemy' && !o.used) {
        ctx.fillStyle = 'rgba(0,0,0,.15)';
        ctx.beginPath(); ctx.ellipse(o.x, y + 6, o.r + 4, (o.r + 4) * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        drawPeople(o.x, y, o.m, '#e0394c', '#ffb3ba');
        label(String(o.m), o.x, y - o.r - 14, 18, '#ffd0d5');
      } else if (o.kind === 'saw') {
        ctx.fillStyle = '#6b6b78';
        ctx.fillRect(ROAD_L, y - 3, ROAD_R - ROAD_L, 6);
        ctx.save(); ctx.translate(o.x, y);
        ctx.fillStyle = 'rgba(255,80,80,.25)';
        ctx.fillRect(-o.w / 2, -10, o.w, 20);
        const k = Math.max(2, Math.round(o.w / 34));
        for (let i = 0; i < k; i++) {
          const sx = -o.w / 2 + o.w * (i + 0.5) / k;
          ctx.save(); ctx.translate(sx, 0); ctx.rotate(o.rot * (i % 2 ? -1 : 1));
          ctx.fillStyle = '#cfd3dc'; ctx.beginPath();
          for (let j = 0; j < 16; j++) {
            const ang = j * Math.PI / 8, rr = j % 2 ? 9 : 15;
            ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
          }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#7a7f8c'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
    }

    // player crowd
    {
      const r = crowdRadius(n || 1);
      ctx.fillStyle = 'rgba(0,0,0,.15)';
      ctx.beginPath(); ctx.ellipse(px || MID, CROWD_Y + 6, r + 4, (r + 4) * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      if (n > 0) drawPeople(px || MID, CROWD_Y, n, '#3a6dff', '#ffe0b8');
      label(String(n), px || MID, CROWD_Y + r + 18, 20, '#fff');
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 1.6);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // ---------- loop ----------
  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000);
    last = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- flow ----------
  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hidden');
    beep(440, 0.08);
  }
  function gameOver() {
    if (state !== 'play') return;
    state = 'over';
    n = 0;
    beep(150, 0.4, 'triangle', 0.1);
    setTimeout(() => {
      ovTitle.textContent = 'ゲームオーバー';
      ovText.innerHTML = '仲間がいなくなってしまった…<br>もう一度挑戦しよう！';
      startBtn.textContent = 'もう一度';
      overlay.classList.remove('hidden');
    }, 700);
  }

  // ---------- input ----------
  const keys = { left: false, right: false };
  let dragging = false, lastPX = 0;
  function toLocalX(clientX) { return clientX / scale; }
  cv.addEventListener('pointerdown', e => {
    dragging = true; lastPX = toLocalX(e.clientX);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  cv.addEventListener('pointermove', e => {
    if (!dragging || state !== 'play') return;
    const x = toLocalX(e.clientX);
    targetX += (x - lastPX) * 1.3;
    lastPX = x;
    e.preventDefault();
  });
  const endDrag = () => { dragging = false; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; e.preventDefault(); }
    else if ((k === 'Enter' || k === ' ') && state !== 'play' && !overlay.classList.contains('hidden')) { e.preventDefault(); start(); }
  });
  window.addEventListener('keyup', e => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
  });
  startBtn.addEventListener('click', start);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) start(); });

  reset();
  resize();
  requestAnimationFrame(loop);
})();
