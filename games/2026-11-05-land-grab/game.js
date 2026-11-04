(() => {
  'use strict';
  const N = 40;                 // grid size (N x N)
  const ROUND = 90;             // seconds
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const elTime = $('time'), elScore = $('score'), elBest = $('best');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), btnStart = $('start');
  const toast = $('toast');

  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up right down left
  const PALETTE = [
    null,
    { head: '#3a63e6', land: '#9db6ff', trail: 'rgba(58,99,230,.55)', name: 'あなた' },
    { head: '#e2484f', land: '#ffaaa8', trail: 'rgba(226,72,79,.55)', name: 'あか' },
    { head: '#17a57f', land: '#94e2c6', trail: 'rgba(23,165,127,.55)', name: 'みどり' },
    { head: '#e8901a', land: '#ffd08f', trail: 'rgba(232,144,26,.55)', name: 'オレンジ' },
  ];

  let owner, trail, ents, state = 'title', timeLeft = ROUND, lastT = 0, best = 0, toastTimer = 0;
  try { best = parseFloat(localStorage.getItem('land-grab-best')) || 0; } catch (e) { best = 0; }
  elBest.textContent = best.toFixed(1) + '%';

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

  // ---------- audio ----------
  let ac = null;
  function beep(freq, dur, type = 'sine', vol = 0.08) {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  // ---------- grid helpers ----------
  const idx = (x, y) => y * N + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

  function claimSquare(e, cx, cy) {
    for (let y = cy - 1; y <= cy + 1; y++)
      for (let x = cx - 1; x <= cx + 1; x++)
        if (inb(x, y)) { owner[idx(x, y)] = e.id; trail[idx(x, y)] = 0; }
  }

  function countOwned(id) {
    let c = 0;
    for (let i = 0; i < owner.length; i++) if (owner[i] === id) c++;
    return c;
  }

  function makeEnt(id, x, y, dir, bot) {
    return { id, x, y, px: x, py: y, dir, next: dir, alive: true, path: [], bot,
      acc: 0, interval: bot ? 0.135 : 0.115, respawn: 0, target: null, maxTrail: 8 };
  }

  function spawnSpot() {
    for (let tries = 0; tries < 200; tries++) {
      const x = 3 + Math.floor(Math.random() * (N - 6)), y = 3 + Math.floor(Math.random() * (N - 6));
      let ok = true;
      for (let yy = y - 2; yy <= y + 2 && ok; yy++)
        for (let xx = x - 2; xx <= x + 2; xx++)
          if (owner[idx(xx, yy)] || trail[idx(xx, yy)]) { ok = false; break; }
      if (ok && !ents.some(e => e.alive && Math.abs(e.x - x) + Math.abs(e.y - y) < 6)) return [x, y];
    }
    return [3 + Math.floor(Math.random() * (N - 6)), 3 + Math.floor(Math.random() * (N - 6))];
  }

  // ---------- game flow ----------
  function reset() {
    owner = new Uint8Array(N * N);
    trail = new Uint8Array(N * N);
    ents = [];
    const p = makeEnt(1, N >> 1, N - 8, 0, false);
    ents.push(p); claimSquare(p, p.x, p.y);
    const starts = [[7, 7, 1], [N - 8, 8, 2], [8, N - 16, 0]];
    for (let i = 0; i < 3; i++) {
      const [x, y, d] = starts[i];
      const b = makeEnt(i + 2, x, y, d, true);
      ents.push(b); claimSquare(b, x, y);
    }
    timeLeft = ROUND;
    updateHud();
  }

  function start() {
    resize();
    reset();
    state = 'play';
    overlay.classList.add('hide');
    beep(520, 0.12, 'triangle');
    lastT = performance.now();
  }

  function end(reason) {
    state = 'over';
    const pct = percent(1);
    let rec = '';
    if (pct > best) {
      best = pct;
      try { localStorage.setItem('land-grab-best', String(best)); } catch (e) { /* ignore */ }
      rec = '<br><b style="color:#ffe27a">ハイスコア更新！</b>';
    }
    elBest.textContent = best.toFixed(1) + '%';
    ovTitle.textContent = reason === 'time' ? 'タイムアップ！' : 'やられた！';
    ovText.innerHTML = `あなたの陣地は <b style="font-size:22px">${pct.toFixed(1)}%</b>${rec}<br>ベスト ${best.toFixed(1)}%`;
    btnStart.textContent = 'もう一度';
    overlay.classList.remove('hide');
    beep(reason === 'time' ? 660 : 180, 0.4, reason === 'time' ? 'triangle' : 'sawtooth');
  }

  const percent = (id) => countOwned(id) / (N * N) * 100;

  function updateHud() {
    elTime.textContent = Math.ceil(timeLeft);
    elScore.textContent = percent(1).toFixed(1) + '%';
  }

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 900);
  }

  // ---------- core rules ----------
  function kill(e, by) {
    if (!e.alive) return;
    e.alive = false;
    for (const i of e.path) if (trail[i] === e.id) trail[i] = 0;
    e.path = [];
    if (e.bot) {
      for (let i = 0; i < owner.length; i++) if (owner[i] === e.id) owner[i] = 0;
      e.respawn = 2.5;
      if (by === 1) { showToast(`${PALETTE[e.id].name}をたおした！`); beep(880, 0.2, 'square', 0.06); }
    } else {
      end('dead');
    }
  }

  function capture(e) {
    for (const i of e.path) { owner[i] = e.id; if (trail[i] === e.id) trail[i] = 0; }
    e.path = [];
    // flood from the border through cells not owned by e; anything unreached is enclosed
    const seen = new Uint8Array(N * N);
    const q = [];
    for (let k = 0; k < N; k++) {
      for (const [x, y] of [[k, 0], [k, N - 1], [0, k], [N - 1, k]]) {
        const i = idx(x, y);
        if (!seen[i] && owner[i] !== e.id) { seen[i] = 1; q.push(i); }
      }
    }
    while (q.length) {
      const i = q.pop(), x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (!seen[j] && owner[j] !== e.id) { seen[j] = 1; q.push(j); }
      }
    }
    let gained = 0;
    for (let i = 0; i < owner.length; i++) {
      if (!seen[i] && owner[i] !== e.id) { owner[i] = e.id; gained++; }
    }
    // an enemy whose head got enclosed loses
    for (const o of ents) {
      if (o !== e && o.alive && owner[idx(o.x, o.y)] === e.id && o.path.length) kill(o, e.id);
    }
    // a bot left without land is out
    for (const o of ents) if (o.bot && o.alive && countOwned(o.id) === 0) kill(o, e.id);
    if (e.id === 1) beep(440 + Math.min(gained, 120) * 4, 0.18, 'triangle');
  }

  function step(e) {
    if ((e.next + 2) % 4 !== e.dir || e.path.length === 0) e.dir = e.next;
    const [dx, dy] = DIRS[e.dir];
    const nx = e.x + dx, ny = e.y + dy;
    e.px = e.x; e.py = e.y;
    if (!inb(nx, ny)) return; // walls stop you
    const i = idx(nx, ny);
    const t = trail[i];
    if (t === e.id) { kill(e, e.id); return; }
    if (t) { const o = ents[t - 1]; kill(o, e.id); }
    e.x = nx; e.y = ny;
    if (owner[i] === e.id) {
      if (e.path.length) capture(e);
    } else {
      trail[i] = e.id;
      e.path.push(i);
    }
  }

  // ---------- bot brain ----------
  function nearestOwn(e) {
    let bd = 1e9, bx = e.x, by = e.y;
    for (let i = 0; i < owner.length; i++) {
      if (owner[i] !== e.id) continue;
      const x = i % N, y = (i / N) | 0, d = Math.abs(x - e.x) + Math.abs(y - e.y);
      if (d < bd) { bd = d; bx = x; by = y; }
    }
    return [bx, by];
  }

  function think(e) {
    const here = owner[idx(e.x, e.y)] === e.id;
    const p = ents[0];
    // hunt: player's trail close by
    let hunt = null;
    if (p.alive && p.path.length && Math.random() < 0.35) {
      for (const i of p.path) {
        const x = i % N, y = (i / N) | 0;
        if (Math.abs(x - e.x) + Math.abs(y - e.y) <= 4) { hunt = [x, y]; break; }
      }
    }
    // danger: player head near my trail -> go home
    let danger = false;
    if (e.path.length && p.alive) {
      for (const i of e.path) {
        const x = i % N, y = (i / N) | 0;
        if (Math.abs(x - p.x) + Math.abs(y - p.y) <= 3) { danger = true; break; }
      }
    }
    if (hunt) e.target = hunt;
    else if (e.path.length >= e.maxTrail || danger) e.target = nearestOwn(e);
    else if (here && !e.path.length && (!e.target || (e.target[0] === e.x && e.target[1] === e.y) || owner[idx(e.target[0], e.target[1])] === e.id)) {
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 6;
      e.target = [Math.max(0, Math.min(N - 1, Math.round(e.x + Math.cos(a) * r))),
                  Math.max(0, Math.min(N - 1, Math.round(e.y + Math.sin(a) * r)))];
      e.maxTrail = 6 + Math.floor(Math.random() * 12);
    } else if (!here && e.target && e.target[0] === e.x && e.target[1] === e.y) {
      e.target = nearestOwn(e);
    }
    if (!e.target) e.target = nearestOwn(e);

    let bestD = -1, bestS = 1e9;
    for (let d = 0; d < 4; d++) {
      if (d === (e.dir + 2) % 4 && e.path.length) continue;
      const nx = e.x + DIRS[d][0], ny = e.y + DIRS[d][1];
      if (!inb(nx, ny) || trail[idx(nx, ny)] === e.id) continue;
      let s = Math.abs(nx - e.target[0]) + Math.abs(ny - e.target[1]) + Math.random() * 1.6;
      if (d === e.dir) s -= 0.4;
      if (s < bestS) { bestS = s; bestD = d; }
    }
    if (bestD >= 0) e.next = bestD;
  }

  // ---------- loop ----------
  function update(dt) {
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; updateHud(); end('time'); return; }
    for (const e of ents) {
      if (!e.alive) {
        if (e.bot) {
          e.respawn -= dt;
          if (e.respawn <= 0) {
            const [x, y] = spawnSpot();
            Object.assign(e, { x, y, px: x, py: y, alive: true, path: [], target: null, acc: 0 });
            claimSquare(e, x, y);
          }
        }
        continue;
      }
      e.acc += dt;
      while (e.alive && e.acc >= e.interval && state === 'play') {
        e.acc -= e.interval;
        if (e.bot) think(e);
        step(e);
      }
      if (state !== 'play') return;
    }
    updateHud();
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
    // trails
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = trail[idx(x, y)];
      if (t) { ctx.fillStyle = PALETTE[t].trail; ctx.fillRect(x * C + C * 0.15, y * C + C * 0.15, C * 0.7, C * 0.7); }
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
    if ((d + 2) % 4 === p.dir && p.path.length) return; // no instant U-turn into own line
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
