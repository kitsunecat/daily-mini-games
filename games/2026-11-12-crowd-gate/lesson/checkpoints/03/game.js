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
  let state = 'title';
  let n, px, targetX, dist, speed, t;

  function crowdRadius(count) { return Math.min(62, 6 + 5.2 * Math.sqrt(Math.min(count, 140))); }

  function reset() {
    n = 1; px = MID; targetX = MID; dist = 0; speed = 150; t = 0;
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
    }
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

    // player crowd
    {
      const r = crowdRadius(n || 1);
      ctx.fillStyle = 'rgba(0,0,0,.15)';
      ctx.beginPath(); ctx.ellipse(px || MID, CROWD_Y + 6, r + 4, (r + 4) * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      if (n > 0) drawPeople(px || MID, CROWD_Y, n, '#3a6dff', '#ffe0b8');
      label(String(n), px || MID, CROWD_Y + r + 18, 20, '#fff');
    }

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
