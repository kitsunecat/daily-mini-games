(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), btnStart = $('start');

  let W = 0, H = 0, dpr = 1;
  let stars = [], backBldg = [], bldg = [], windows = [];
  let targets = [];
  let state = 'title';
  let elapsed = 0, spawnTimer = 0, t = 0;

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
    targets = [];
    buildCity();
  }

  // ---------- drawing ----------
  function drawFigure(f) {
    const x = f.x, y = f.y;
    const enemy = f.kind === 'enemy';
    ctx.fillStyle = enemy ? '#e8323c' : '#3ba3ff';
    ctx.fillRect(x - 3, y - 11, 6, 11);
    ctx.fillStyle = enemy ? '#2b0b10' : '#0d2340';
    ctx.fillRect(x - 3, y - 4, 6, 4);
    ctx.fillStyle = '#f1c9a5';
    ctx.beginPath(); ctx.arc(x, y - 14, 3, 0, Math.PI * 2); ctx.fill();
    if (enemy) {
      ctx.fillStyle = '#111';
      ctx.fillRect(x - 3, y - 17.5, 6, 2); // cap
      // gun
      ctx.fillStyle = '#222';
      ctx.fillRect(x + 2, y - 9, 6, 2);
    }
  }

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
    // targets in windows (clipped), roof walkers free
    for (const f of targets) {
      if (f.win) {
        ctx.save();
        ctx.beginPath(); ctx.rect(f.win.x, f.win.y, f.win.w, f.win.h); ctx.clip();
        drawFigure(f);
        ctx.restore();
        ctx.fillStyle = 'rgba(40,30,20,.35)';
        ctx.fillRect(f.win.x, f.win.y + f.win.h / 2 - 0.5, f.win.w, 1);
      } else drawFigure(f);
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
  function spawn() {
    const civ = Math.random() < Math.min(0.4, 0.2 + elapsed * 0.004);
    const kind = civ ? 'civ' : 'enemy';
    const lifeT = civ ? rand(2.5, 4.5) : Math.max(2.0, 5.2 - elapsed * 0.045) + rand(0, 0.8);
    if (Math.random() < 0.25 && bldg.length) {
      const b = bldg[Math.floor(Math.random() * bldg.length)];
      if (b.x < 4 || b.x + b.w > W - 4) return;
      targets.push({ kind, x: rand(b.x + 6, b.x + b.w - 6), y: b.top, minX: b.x + 5, maxX: b.x + b.w - 5, vx: rand(12, 26) * (Math.random() < 0.5 ? -1 : 1), life: lifeT, max: lifeT });
    } else {
      const free = windows.filter((w) => w.lit && !w.busy);
      if (!free.length) return;
      const w = free[Math.floor(Math.random() * free.length)];
      w.busy = true;
      targets.push({ kind, win: w, x: w.x + w.w / 2, y: w.y + w.h + 18, rise: 18, life: lifeT, max: lifeT, vx: 0 });
    }
  }

  function removeTarget(f) {
    if (f.win) f.win.busy = false;
    targets.splice(targets.indexOf(f), 1);
  }

  function update(dt) {
    t += dt;
    if (state !== 'play') return;
    elapsed += dt;
    spawnTimer -= dt;
    const maxActive = Math.min(7, 2 + Math.floor(elapsed / 12));
    if (spawnTimer <= 0 && targets.length < maxActive) {
      spawn();
      spawnTimer = Math.max(0.55, 1.8 - elapsed * 0.018) * rand(0.7, 1.3);
    }
    for (let i = targets.length - 1; i >= 0; i--) {
      const f = targets[i];
      f.life -= dt;
      if (f.win) {
        const goingOut = f.life < 0.25;
        f.rise = goingOut ? Math.min(18, f.rise + 80 * dt) : Math.max(0, f.rise - 80 * dt);
        f.y = f.win.y + f.win.h + f.rise;
      } else {
        f.x += f.vx * dt;
        if (f.x < f.minX || f.x > f.maxX) { f.vx *= -1; f.x = Math.max(f.minX, Math.min(f.maxX, f.x)); }
      }
      if (f.life <= 0) removeTarget(f);
    }
  }

  function start() {
    resize();
    state = 'play';
    elapsed = 0; spawnTimer = 0.6;
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
