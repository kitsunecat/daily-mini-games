(() => {
  'use strict';
  const VIEW_W = 360;
  const G = 980;

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
  let running = false;
  let player, anchors, camX, maxX, nextAnchorX, lastT;

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
    anchors.push({ x, y });
    nextAnchorX += gap;
  }

  function newGame() {
    layout();
    anchors = [];
    nextAnchorX = 150;
    for (let i = 0; i < 8; i++) addAnchor();
    player = { x: 40, y: H * 0.3, vx: 300, vy: -260 };
    camX = 0; maxX = 0;
    running = true;
    overlay.classList.add('hidden');
    updateHud();
    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function updateHud() {
    scoreEl.textContent = Math.floor(maxX / 10);
  }

  function die() {
    running = false;
    ovTitle.textContent = 'ゲームオーバー';
    ovText.innerHTML = '距離 <b class="hl">' + Math.floor(maxX / 10) + 'm</b>';
    startBtn.textContent = 'もう一度';
    overlay.classList.remove('hidden');
  }

  function step(dt, time) {
    const p = player;
    p.vy += G * dt;
    p.vx *= (1 - 0.05 * dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 950) { p.vx *= 950 / sp; p.vy *= 950 / sp; }
    if (p.y < -H * 0.6) { p.y = -H * 0.6; if (p.vy < 0) p.vy = 0; }

    if (p.x > maxX) maxX = p.x;
    camX += (p.x - VIEW_W * 0.35 - camX) * Math.min(1, dt * 5);

    while (nextAnchorX < camX + VIEW_W * 2.5) addAnchor();
    anchors = anchors.filter(a => a.x > camX - 300);

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

    // anchors
    for (const a of anchors) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#e8f1ff';
      ctx.beginPath(); ctx.arc(a.x, a.y, 9, 0, 7); ctx.stroke();
      ctx.fillStyle = '#16263f'; ctx.beginPath(); ctx.arc(a.x, a.y, 4, 0, 7); ctx.fill();
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
  startBtn.addEventListener('click', (e) => { e.stopPropagation(); newGame(); });
  window.addEventListener('resize', layout);
  layout();
})();
