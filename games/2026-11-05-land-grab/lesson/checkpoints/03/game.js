(() => {
  'use strict';
  const N = 40;                 // grid size (N x N)
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), btnStart = $('start');

  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up right down left
  const PALETTE = [
    null,
    { head: '#3a63e6', land: '#9db6ff', trail: 'rgba(58,99,230,.55)', name: 'あなた' },
    { head: '#e2484f', land: '#ffaaa8', trail: 'rgba(226,72,79,.55)', name: 'あか' },
    { head: '#17a57f', land: '#94e2c6', trail: 'rgba(23,165,127,.55)', name: 'みどり' },
    { head: '#e8901a', land: '#ffd08f', trail: 'rgba(232,144,26,.55)', name: 'オレンジ' },
  ];

  let owner, trail, ents, state = 'title', lastT = 0;

  // ---------- canvas sizing ----------
  let S = 360, C = S / N;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    const px = Math.max(200, Math.round(Math.min(r.width, r.height || r.width)));
    cv.width = cv.height = Math.round(px * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = px; C = S / N;
  }
  window.addEventListener('resize', () => { resize(); draw(); });

  // ---------- grid helpers ----------
  const idx = (x, y) => y * N + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

  function claimSquare(e, cx, cy) {
    for (let y = cy - 1; y <= cy + 1; y++)
      for (let x = cx - 1; x <= cx + 1; x++)
        if (inb(x, y)) { owner[idx(x, y)] = e.id; trail[idx(x, y)] = 0; }
  }

  function makeEnt(id, x, y, dir, bot) {
    return { id, x, y, px: x, py: y, dir, next: dir, alive: true, path: [], bot,
      acc: 0, interval: bot ? 0.135 : 0.115, respawn: 0, target: null, maxTrail: 8 };
  }

  // ---------- game flow ----------
  function reset() {
    owner = new Uint8Array(N * N);
    trail = new Uint8Array(N * N);
    ents = [];
    const p = makeEnt(1, N >> 1, N - 8, 0, false);
    ents.push(p); claimSquare(p, p.x, p.y);
  }

  function start() {
    resize();
    reset();
    state = 'play';
    overlay.classList.add('hide');
    lastT = performance.now();
  }

  // ---------- core rules ----------
  function step(e) {
    e.dir = e.next;
    const [dx, dy] = DIRS[e.dir];
    const nx = e.x + dx, ny = e.y + dy;
    e.px = e.x; e.py = e.y;
    if (!inb(nx, ny)) return; // walls stop you
    e.x = nx; e.y = ny;
  }

  // ---------- loop ----------
  function update(dt) {
    for (const e of ents) {
      e.acc += dt;
      while (e.acc >= e.interval) {
        e.acc -= e.interval;
        step(e);
      }
    }
  }

  function draw() {
    if (!owner) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, S, S); return; }
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(0,0,0,.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < N; k++) {
      ctx.moveTo(k * C, 0); ctx.lineTo(k * C, S);
      ctx.moveTo(0, k * C); ctx.lineTo(S, k * C);
    }
    ctx.stroke();
    // land
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const o = owner[idx(x, y)];
      if (o) { ctx.fillStyle = PALETTE[o].land; ctx.fillRect(x * C, y * C, C + 0.5, C + 0.5); }
    }
    // land edge shading
    for (let y = 0; y < N - 1; y++) for (let x = 0; x < N; x++) {
      const o = owner[idx(x, y)];
      if (o && owner[idx(x, y + 1)] !== o) { ctx.fillStyle = PALETTE[o].head; ctx.globalAlpha = 0.35; ctx.fillRect(x * C, y * C + C * 0.75, C + 0.5, C * 0.25); ctx.globalAlpha = 1; }
    }
    // heads
    for (const e of ents) {
      if (!e.alive) continue;
      const f = state === 'play' ? Math.min(1, e.acc / e.interval) : 1;
      const hx = (e.px + (e.x - e.px) * f) * C, hy = (e.py + (e.y - e.py) * f) * C;
      const pad = -C * 0.15, sz = C - pad * 2;
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      roundRect(hx + pad, hy + pad + C * 0.2, sz, sz, C * 0.3); ctx.fill();
      ctx.fillStyle = PALETTE[e.id].head;
      roundRect(hx + pad, hy + pad, sz, sz, C * 0.3); ctx.fill();
      if (!e.bot) { ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, C * 0.18); ctx.stroke(); }
      // eyes looking in direction
      const [dx, dy] = DIRS[e.dir];
      ctx.fillStyle = '#fff';
      const cx = hx + C / 2 + dx * C * 0.15, cy = hy + C / 2 + dy * C * 0.15;
      const ox = dy !== 0 ? C * 0.22 : 0, oy = dx !== 0 ? C * 0.22 : 0;
      ctx.beginPath(); ctx.arc(cx - ox, cy - oy, C * 0.14, 0, 7); ctx.arc(cx + ox, cy + oy, C * 0.14, 0, 7); ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (state === 'play') update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  // ---------- input ----------
  function turn(d) {
    if (state !== 'play') return;
    const p = ents[0];
    p.next = d;
  }
  const KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
  window.addEventListener('keydown', (ev) => {
    if (ev.code in KEYS) { turn(KEYS[ev.code]); ev.preventDefault(); }
    else if ((ev.code === 'Enter' || ev.code === 'Space') && state !== 'play') { start(); ev.preventDefault(); }
  });

  let sx = 0, sy = 0, down = false;
  const SW = 22;
  window.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest && ev.target.closest('a,button')) return;
    down = true; sx = ev.clientX; sy = ev.clientY;
  });
  window.addEventListener('pointermove', (ev) => {
    if (!down) return;
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (Math.abs(dx) < SW && Math.abs(dy) < SW) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    sx = ev.clientX; sy = ev.clientY; // keep swiping to turn again
  });
  const up = () => { down = false; };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  btnStart.addEventListener('click', start);
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) start(); });
  document.addEventListener('touchmove', (ev) => ev.preventDefault(), { passive: false });

  resize();
  reset();
  requestAnimationFrame((t) => { lastT = t; frame(t); });
})();
