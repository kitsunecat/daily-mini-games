(() => {
  'use strict';
  const VIEW_W = 360;
  const G = 980;
  const MAX_ROPE = 270;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');
  const scoreEl = document.getElementById('score');
  const starsEl = document.getElementById('stars');
  const bestEl = document.getElementById('best');

  let scale = 1, H = 640, dpr = 1;
  let running = false, holding = false;
  let player, anchors, stars, particles, camX, rope, maxX, starCount, nextAnchorX, lastT;

  // ---------- audio ----------
  let actx = null;
  function beep(freq, dur, type, vol, slide) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, actx.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, actx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.12, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  // ---------- layout ----------
  function layout() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    scale = r.width / VIEW_W;
    H = r.height / scale;
    if (!running) draw();
  }

  // ---------- world ----------
  function rand(a, b) { return a + Math.random() * (b - a); }

  function addAnchor() {
    const dist = nextAnchorX / 10;
    const gap = Math.min(rand(120, 165) + dist * 0.12, 230);
    const x = nextAnchorX;
    const y = rand(H * 0.12, H * 0.42);
    const moving = dist > 250 && Math.random() < Math.min(0.5, (dist - 250) / 800);
    anchors.push({ x, y, baseY: y, moving, phase: rand(0, 6.28), amp: rand(25, 55) });
    // star between this and next anchor
    if (Math.random() < 0.75) {
      stars.push({ x: x + gap * rand(0.35, 0.65), y: rand(H * 0.2, H * 0.7), got: false, t: rand(0, 6) });
    }
    nextAnchorX += gap;
  }

  function newGame() {
    layout();
    anchors = []; stars = []; particles = [];
    nextAnchorX = 150;
    for (let i = 0; i < 8; i++) addAnchor();
    player = { x: 40, y: H * 0.3, vx: 300, vy: -260, trail: [] };
    rope = null; camX = 0; maxX = 0; starCount = 0;
    holding = false;
    running = true;
    overlay.classList.add('hidden');
    updateHud();
    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function updateHud() {
    scoreEl.textContent = score();
    starsEl.textContent = starCount;
  }
  function score() { return Math.floor(maxX / 10) + starCount * 5; }

  function attach() {
    if (rope || !running) return;
    let bestA = null, bestD = Infinity;
    for (const a of anchors) {
      if (a.x < player.x - 60) continue;
      const d = Math.hypot(a.x - player.x, a.y - player.y);
      if (d < MAX_ROPE && a.y < player.y + 20) {
        // prefer anchors ahead
        const w = d - (a.x > player.x ? 40 : 0);
        if (w < bestD) { bestD = w; bestA = a; }
      }
    }
    if (bestA) {
      rope = { a: bestA, len: Math.max(50, Math.hypot(bestA.x - player.x, bestA.y - player.y)) };
      beep(520, 0.08, 'triangle', 0.1, 760);
    }
  }
  function release() {
    if (rope) {
      rope = null;
      player.vx *= 1.04; player.vy *= 1.04;
      beep(380, 0.1, 'sine', 0.07, 240);
    }
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), s = rand(60, 220);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.8), color });
    }
  }

  function die() {
    running = false;
    beep(300, 0.5, 'sawtooth', 0.1, 60);
    ovTitle.textContent = 'ゲームオーバー';
    ovText.innerHTML = '距離 <b class="hl">' + Math.floor(maxX / 10) + 'm</b> ／ ★ <b class="hl">' + starCount +
      '</b><br>スコア <b class="hl">' + score() + '</b>';
    startBtn.textContent = 'もう一度';
    overlay.classList.remove('hidden');
  }

  function stepParticles(dt) {
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
  }

  function step(dt, time) {
    for (const a of anchors) if (a.moving) a.y = a.baseY + Math.sin(time * 1.6 + a.phase) * a.amp;
    if (holding && !rope) attach();
    const p = player;
    p.vy += G * dt;
    if (rope) {
      const a = rope.a;
      let nx = p.x - a.x, ny = p.y - a.y;
      let d = Math.hypot(nx, ny) || 1;
      nx /= d; ny /= d;
      // tangent toward forward (+x)
      let tx = -ny, ty = nx;
      if (tx < 0) { tx = -tx; ty = -ty; }
      if (ny > 0) { p.vx += tx * 160 * dt; p.vy += ty * 160 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      nx = p.x - a.x; ny = p.y - a.y; d = Math.hypot(nx, ny) || 1;
      if (d > rope.len) {
        nx /= d; ny /= d;
        p.x = a.x + nx * rope.len; p.y = a.y + ny * rope.len;
        const vr = p.vx * nx + p.vy * ny;
        if (vr > 0) { p.vx -= vr * nx; p.vy -= vr * ny; }
      }
      // shorten slightly when anchor moves
      if (rope.len > 60) rope.len -= 10 * dt;
    } else {
      p.vx *= (1 - 0.05 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 950) { p.vx *= 950 / sp; p.vy *= 950 / sp; }
    if (p.y < -H * 0.6) { p.y = -H * 0.6; if (p.vy < 0) p.vy = 0; }
    p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 18) p.trail.shift();

    if (p.x > maxX) maxX = p.x;
    camX += (p.x - VIEW_W * 0.35 - camX) * Math.min(1, dt * 5);

    while (nextAnchorX < camX + VIEW_W * 2.5) addAnchor();
    anchors = anchors.filter(a => a.x > camX - 300 || (rope && rope.a === a));
    stars = stars.filter(s => s.x > camX - 100);

    for (const s of stars) {
      s.t += dt;
      if (!s.got && Math.hypot(s.x - p.x, s.y - p.y) < 24) {
        s.got = true; starCount++;
        burst(s.x, s.y, '#ffcf4a', 14);
        beep(880, 0.12, 'square', 0.06, 1320);
      }
    }
    stepParticles(dt);
    updateHud();
    if (p.y > H - 26) die();
  }

  // ---------- render ----------
  function draw() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1d3b6b'); sky.addColorStop(0.6, '#3f6fa8'); sky.addColorStop(1, '#f29e6d');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, VIEW_W, H);
    if (!player) return;

    // sun
    ctx.fillStyle = 'rgba(255,220,150,.55)';
    ctx.beginPath(); ctx.arc(270, H * 0.62, 50, 0, 7); ctx.fill();

    // hills parallax
    ctx.fillStyle = '#2b4a6f';
    const hx = camX * 0.3;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = -40; x <= VIEW_W + 40; x += 20) {
      const wx = x + hx;
      ctx.lineTo(x, H - 70 - Math.sin(wx * 0.012) * 30 - Math.sin(wx * 0.031) * 14);
    }
    ctx.lineTo(VIEW_W, H); ctx.fill();

    ctx.save();
    ctx.translate(-camX, 0);

    // distance markers
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    const m0 = Math.floor(camX / 500) * 500;
    for (let mx = m0; mx < camX + VIEW_W + 500; mx += 500) {
      if (mx <= 0) continue;
      ctx.fillRect(mx - 1, H - 60, 2, 30);
      ctx.fillText((mx / 10) + 'm', mx, H - 64);
    }

    // stars
    for (const s of stars) {
      if (s.got) continue;
      drawStar(s.x, s.y + Math.sin(s.t * 3) * 4, 11, 5);
    }

    // anchors
    for (const a of anchors) {
      const inRange = running && !rope && Math.hypot(a.x - player.x, a.y - player.y) < MAX_ROPE && a.x > player.x - 60 && a.y < player.y + 20;
      ctx.lineWidth = 4;
      ctx.strokeStyle = a.moving ? '#ff9f43' : '#e8f1ff';
      ctx.beginPath(); ctx.arc(a.x, a.y, 9, 0, 7); ctx.stroke();
      ctx.fillStyle = '#16263f'; ctx.beginPath(); ctx.arc(a.x, a.y, 4, 0, 7); ctx.fill();
      if (inRange) {
        ctx.strokeStyle = 'rgba(255,207,74,.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(a.x, a.y, 15, 0, 7); ctx.stroke();
      }
    }

    // rope
    if (rope) {
      ctx.strokeStyle = '#ffe9b0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(rope.a.x, rope.a.y); ctx.lineTo(player.x, player.y); ctx.stroke();
    }

    // trail
    const tr = player.trail;
    for (let i = 0; i < tr.length; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (i / tr.length * 0.35) + ')';
      ctx.beginPath(); ctx.arc(tr[i].x, tr[i].y, 3 + i / tr.length * 7, 0, 7); ctx.fill();
    }

    // player
    if (running) {
      ctx.save(); ctx.translate(player.x, player.y);
      ctx.rotate(Math.atan2(player.vy, player.vx) * 0.3);
      ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(4, -3, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(5.5, -3, 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffcf4a'; ctx.fillRect(-12, -6, 6, 3);
      ctx.restore();
    }

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 1.5);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // spikes
    ctx.fillStyle = '#3a1020'; ctx.fillRect(0, H - 14, VIEW_W, 14);
    ctx.fillStyle = '#e74c3c';
    const off = -(camX % 20);
    ctx.beginPath();
    for (let x = off - 20; x < VIEW_W + 20; x += 20) {
      ctx.moveTo(x, H - 12); ctx.lineTo(x + 10, H - 30); ctx.lineTo(x + 20, H - 12);
    }
    ctx.fill();

    // hint
    if (running && !rope && holding) {
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('届くフックがない！', VIEW_W / 2, 24);
    }
  }

  function drawStar(x, y, r, n) {
    ctx.fillStyle = '#ffcf4a';
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = -Math.PI / 2 + i * Math.PI / n;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - lastT) / 1000);
    lastT = now;
    // substeps for stable rope
    for (let i = 0; i < 3; i++) { step(dt / 3, now / 1000); if (!running) break; }
    if (running) { draw(); requestAnimationFrame(loop); }
  }

  // ---------- input ----------
  function down(e) {
    if (!running) return;
    e.preventDefault();
    holding = true; attach();
  }
  function up() { holding = false; release(); }
  cv.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('blur', up);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (!running) { if (!overlay.classList.contains('hidden') && !e.repeat) newGame(); return; }
      if (!e.repeat) { holding = true; attach(); }
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') up();
  });
  startBtn.addEventListener('click', (e) => { e.stopPropagation(); newGame(); });
  window.addEventListener('resize', layout);
  layout();
})();
