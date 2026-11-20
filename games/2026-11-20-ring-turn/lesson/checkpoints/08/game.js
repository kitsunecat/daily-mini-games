(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $score = document.getElementById('score');
  const $moves = document.getElementById('moves');
  const $best = document.getElementById('best');
  const $overlay = document.getElementById('overlay');
  const $title = document.getElementById('ov-title');
  const $text = document.getElementById('ov-text');
  const $start = document.getElementById('start');
  const $hint = document.getElementById('hint');

  const BEST_KEY = 'dmg-ring-turn-best';
  const N = 8;           // sectors per ring
  const RINGS = 3;
  const START_MOVES = 20;
  const COLORS = ['#ff5a6e', '#ffc93c', '#4fd18b', '#4aa8ff', '#c77dff', '#ff8f3c'];
  const SHAPES = ['circle', 'tri', 'square', 'diamond', 'star', 'plus'];

  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { best = 0; }
  $best.textContent = best;

  let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 0;
  let grid = [];       // grid[ring][sector] = color index
  let scale = [];      // per slot scale for pop / spawn animation
  let rot = [0, 0, 0]; // animated rotation offset in sector units
  let anim = null;     // {ring, dir, t}
  let state = 'title'; // title | play | over
  let score = 0, moves = START_MOVES, nColors = 4, chain = 0;
  let busy = false;
  let popups = [];
  let flashes = [];
  let audio = null;

  function beep(freq, dur, type, vol) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.08, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W / 2; cy = H / 2;
    R = Math.min(W, H) * 0.46;
  }
  window.addEventListener('resize', resize);

  const ringRadius = (i) => R * (0.34 + 0.29 * i);
  const ballRadius = (i) => Math.min(R * 0.12, ringRadius(i) * Math.sin(Math.PI / N) * 0.78);

  function rnd() { return Math.floor(Math.random() * nColors); }

  function newBoard() {
    grid = []; scale = [];
    for (let i = 0; i < RINGS; i++) {
      grid.push([]); scale.push([]);
      for (let k = 0; k < N; k++) { grid[i].push(rnd()); scale[i].push(1); }
    }
    // remove initial matches
    for (let guard = 0; guard < 100; guard++) {
      const m = findMatches();
      if (!m.length) break;
      m.forEach(k => { grid[1][k] = rnd(); });
    }
  }

  function findMatches() {
    const out = [];
    for (let k = 0; k < N; k++) {
      const c = grid[0][k];
      if (c >= 0 && grid[1][k] === c && grid[2][k] === c) out.push(k);
    }
    return out;
  }

  function updateHud() {
    $score.textContent = score;
    $moves.textContent = moves;
    $moves.parentElement.classList.toggle('low', moves <= 5);
    $best.textContent = best;
  }

  function start() {
    score = 0; moves = START_MOVES; nColors = 4; chain = 0; busy = false; anim = null;
    rot = [0, 0, 0]; popups = []; flashes = [];
    newBoard();
    state = 'play';
    $overlay.classList.add('hidden');
    $hint.textContent = '右側タップで時計回り、左側タップで反時計回り';
    updateHud();
    beep(520, 0.12, 'triangle');
  }

  function gameOver() {
    state = 'over';
    let isBest = false;
    if (score > best) {
      best = score; isBest = true;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* ignore */ }
    }
    updateHud();
    $title.textContent = 'ゲームオーバー';
    $text.innerHTML = 'スコア <b class="hl">' + score + '</b>' + (isBest ? '<br>ハイスコア更新！' : '<br>ベスト ' + best);
    $start.textContent = 'もう一度';
    $overlay.classList.remove('hidden');
    beep(200, 0.4, 'sawtooth', 0.06);
  }

  function turn(ring, dir) {
    if (state !== 'play' || busy) return;
    busy = true;
    moves--;
    updateHud();
    anim = { ring, dir, t: 0 };
    beep(300 + ring * 90, 0.06, 'square', 0.04);
  }

  function finishTurn() {
    const { ring, dir } = anim;
    const old = grid[ring].slice();
    for (let k = 0; k < N; k++) grid[ring][(k + dir + N) % N] = old[k];
    rot[ring] = 0;
    anim = null;
    chain = 0;
    resolve();
  }

  function resolve() {
    const m = findMatches();
    if (!m.length) {
      busy = false;
      if (score >= 600 && nColors < 5) { nColors = 5; $hint.textContent = '新しい色が増えた！'; }
      if (score >= 2000 && nColors < 6) { nColors = 6; $hint.textContent = 'さらに色が増えた！'; }
      if (moves <= 0) setTimeout(gameOver, 300);
      return;
    }
    chain++;
    const gain = m.length * 30 * chain + (m.length >= 2 ? 20 * m.length : 0);
    score += gain;
    moves += m.length * 2 + (chain >= 2 ? 1 : 0);
    updateHud();
    m.forEach(k => {
      const a = angleOf(k, 0);
      const col = COLORS[grid[0][k]];
      flashes.push({ a, t: 0, col });
    });
    popups.push({ text: '+' + gain + (chain >= 2 ? '  ×' + chain + ' 連鎖' : ''), t: 0 });
    beep(600 + chain * 120, 0.18, 'triangle', 0.09);
    $hint.textContent = chain >= 2 ? chain + ' 連鎖！' : 'そろった！手数 +' + (m.length * 2);
    // pop animation
    let t = 0;
    const popStep = () => {
      t += 1 / 12;
      m.forEach(k => { for (let i = 0; i < RINGS; i++) scale[i][k] = Math.max(0, 1 - t); });
      if (t < 1) { requestAnimationFrame(popStep); return; }
      m.forEach(k => { for (let i = 0; i < RINGS; i++) { grid[i][k] = rnd(); scale[i][k] = 0; } });
      let s = 0;
      const growStep = () => {
        s += 1 / 10;
        m.forEach(k => { for (let i = 0; i < RINGS; i++) scale[i][k] = Math.min(1, s); });
        if (s < 1) { requestAnimationFrame(growStep); return; }
        setTimeout(resolve, 80);
      };
      requestAnimationFrame(growStep);
    };
    requestAnimationFrame(popStep);
  }

  function angleOf(k, r) { return (k + r) * (Math.PI * 2 / N) - Math.PI / 2; }

  // input
  function handlePoint(x, y) {
    if (state !== 'play') return;
    const dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    let ring = -1, bestD = Infinity;
    for (let i = 0; i < RINGS; i++) {
      const dd = Math.abs(d - ringRadius(i));
      if (dd < bestD) { bestD = dd; ring = i; }
    }
    if (d < ringRadius(0) * 0.45 || bestD > R * 0.2) return;
    turn(ring, dx >= 0 ? 1 : -1);
  }

  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    handlePoint(e.clientX - r.left, e.clientY - r.top);
  });
  $start.addEventListener('click', (e) => { e.stopPropagation(); start(); });
  window.addEventListener('keydown', (e) => {
    if (state !== 'play') {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); }
      return;
    }
    const map = { q: [0, 1], w: [1, 1], e: [2, 1], a: [0, -1], s: [1, -1], d: [2, -1] };
    const v = map[e.key.toLowerCase()];
    if (v) { e.preventDefault(); turn(v[0], v[1]); }
  });

  // drawing
  function drawShape(shape, x, y, r) {
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
    else if (shape === 'tri') { for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.05 + r * 0.12); } ctx.closePath(); }
    else if (shape === 'square') ctx.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
    else if (shape === 'diamond') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
    else if (shape === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
    else { const t = r * 0.35; ctx.rect(x - t, y - r, t * 2, r * 2); ctx.rect(x - r, y - t, r * 2, t * 2); }
    ctx.fill();
  }

  function drawBall(x, y, r, c) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(0.3, COLORS[c]);
    g.addColorStop(1, shade(COLORS[c]));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    drawShape(SHAPES[c], x, y, r * 0.42);
  }

  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(v * 0.55);
    return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // background
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#33275a'); bg.addColorStop(1, '#1a1330');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // sector guide lines
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 2;
    for (let k = 0; k < N; k++) {
      const a = angleOf(k, 0);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * ringRadius(0) * 0.6, cy + Math.sin(a) * ringRadius(0) * 0.6);
      ctx.lineTo(cx + Math.cos(a) * (ringRadius(2) + R * 0.16), cy + Math.sin(a) * (ringRadius(2) + R * 0.16));
      ctx.stroke();
    }

    // flashes for cleared sectors
    flashes = flashes.filter(f => f.t < 1);
    flashes.forEach(f => {
      f.t += 0.04;
      ctx.save();
      ctx.globalAlpha = 1 - f.t;
      ctx.strokeStyle = f.col;
      ctx.lineWidth = R * 0.22 * (1 - f.t * 0.5);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(f.a) * ringRadius(0), cy + Math.sin(f.a) * ringRadius(0));
      ctx.lineTo(cx + Math.cos(f.a) * ringRadius(2), cy + Math.sin(f.a) * ringRadius(2));
      ctx.stroke();
      ctx.restore();
    });

    // rings
    for (let i = 0; i < RINGS; i++) {
      const rr = ringRadius(i);
      ctx.strokeStyle = (anim && anim.ring === i) ? 'rgba(255,207,74,.55)' : 'rgba(255,255,255,.12)';
      ctx.lineWidth = ballRadius(i) * 2.4;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      const br = ballRadius(i);
      for (let k = 0; k < N; k++) {
        const s = scale[i][k];
        if (s <= 0.01) continue;
        const a = angleOf(k, rot[i]);
        drawBall(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, br * s, grid[i][k]);
      }
    }

    // hub
    const hr = ringRadius(0) * 0.5;
    ctx.fillStyle = '#2a2050';
    ctx.beginPath(); ctx.arc(cx, cy, hr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,207,74,.6)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffcf4a';
    ctx.font = 'bold ' + Math.round(hr * 0.42) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('↻', cx + hr * 0.38, cy);
    ctx.fillText('↺', cx - hr * 0.38, cy);

    // popups
    popups = popups.filter(p => p.t < 1);
    popups.forEach(p => {
      p.t += 0.018;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - p.t) * 2);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.round(R * 0.11) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, cx, cy - R * 1.02 + (1 - p.t) * 18 + R * 0.06);
      ctx.restore();
    });
  }

  function loop() {
    if (anim) {
      anim.t += 1 / 9;
      const e = Math.min(1, anim.t);
      rot[anim.ring] = anim.dir * (1 - Math.pow(1 - e, 3));
      if (anim.t >= 1) finishTurn();
    }
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  newBoard();
  loop();
})();
