(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const stage = $('stage');
  const ui = {
    score: $('score'), best: $('best'), coins: $('coins'), dice: $('dice'), msg: $('msg'),
    mult: $('mult'), roll: $('roll'), build: $('build'), cost: $('cost'),
    overlay: $('overlay'), ovTitle: $('ov-title'), ovText: $('ov-text'), start: $('start'),
  };
  const START_DICE = 40;

  // ---- 盤（6x6 の外周 20 マス。右下 GO から反時計回り） ----
  const TILES = [
    { t: 'go' }, { t: 'prop', v: 20 }, { t: 'chance' }, { t: 'prop', v: 30 }, { t: 'tax' },
    { t: 'dice' }, { t: 'prop', v: 40 }, { t: 'prop', v: 45 }, { t: 'chance' }, { t: 'prop', v: 55 },
    { t: 'bonus' }, { t: 'prop', v: 60 }, { t: 'thief' }, { t: 'prop', v: 70 }, { t: 'chance' },
    { t: 'dice' }, { t: 'prop', v: 80 }, { t: 'tax' }, { t: 'prop', v: 100 }, { t: 'chance' },
  ];
  const PROP_COLORS = ['#7fd3ff', '#7fd3ff', '#9fe07a', '#9fe07a', '#9fe07a', '#ffb36b', '#ffb36b', '#ff8fb1', '#ff8fb1', '#c9a0ff'];
  const POS = [];
  for (let i = 0; i <= 5; i++) POS.push([5 - i, 5]);
  for (let r = 4; r >= 0; r--) POS.push([0, r]);
  for (let c = 1; c <= 5; c++) POS.push([c, 0]);
  for (let r = 1; r <= 4; r++) POS.push([5, r]);
  let propIdx = 0;
  TILES.forEach((tile) => { if (tile.t === 'prop') tile.color = PROP_COLORS[propIdx++]; });

  // ---- 効果音（Web Audio） ----
  let actx = null;
  function beep(freq, dur = 0.08, type = 'square', vol = 0.06, delay = 0) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + delay;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* 音が出なくても続行 */ }
  }
  const sfx = {
    step: () => beep(660, 0.04, 'triangle', 0.05),
    coin: () => { beep(988, 0.07, 'square', 0.05); beep(1319, 0.12, 'square', 0.05, 0.07); },
    bad: () => { beep(220, 0.15, 'sawtooth', 0.05); beep(160, 0.2, 'sawtooth', 0.05, 0.12); },
    build: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.12, 'triangle', 0.07, i * 0.08)),
    dice: () => beep(300 + Math.random() * 300, 0.03, 'square', 0.03),
  };

  // ---- 状態 ----
  const S = {
    playing: false, busy: false, dice: 0, mult: 1, pos: 0,
    tokenX: 0, tokenY: 0, hop: 0, faces: [1, 1], rolling: false,
  };

  function setMsg(t) { ui.msg.textContent = t; }

  function updateUI() {
    ui.dice.textContent = S.dice;
    const can = S.playing && !S.busy;
    ui.roll.disabled = !can || S.dice < 1;
  }

  // ---- 描画 ----
  let size = 300, cell = 50, dpr = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    size = Math.max(200, Math.floor(Math.min(r.width - 12, r.height - 4)));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size * dpr; cv.height = size * dpr;
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cell = size / 6;
    const [cx, cy] = tileCenter(S.pos);
    S.tokenX = cx; S.tokenY = cy;
  }
  function tileCenter(i) { const [c, r] = POS[i]; return [(c + 0.5) * cell, (r + 0.5) * cell]; }

  function roundRect(x, y, w, h, rad) {
    ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
  }

  function tileLabel(tile) {
    switch (tile.t) {
      case 'go': return ['GO', '#ffcc33', '#3a2a00'];
      case 'chance': return ['?', '#ffffff', '#d23c6c'];
      case 'tax': return ['税', '#5a5f73', '#fff'];
      case 'dice': return ['🎲', '#ffe8b0', '#000'];
      case 'bonus': return ['💰', '#fff3b0', '#000'];
      case 'thief': return ['🦝', '#3b3f52', '#fff'];
      default: return [String(tile.v), '#fffaf0', '#2b4a3a'];
    }
  }

  function drawDie(x, y, s, n) {
    ctx.save(); ctx.translate(x, y);
    roundRect(-s / 2, -s / 2, s, s, s * 0.18); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#c9d6cf'; ctx.stroke();
    ctx.fillStyle = n === 1 ? '#d23c3c' : '#222';
    const p = s * 0.26, d = s * (n === 1 ? 0.11 : 0.085);
    const pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
    pips.forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a * p, b * p, d, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // 中央の芝生
    roundRect(cell, cell, cell * 4, cell * 4, 10); ctx.fillStyle = '#4fae6e'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    for (let i = 0; i < 8; i++) ctx.fillRect(cell + i * cell / 2, cell, cell / 4, cell * 4);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // サイコロ
    if (S.playing || S.rolling) {
      const ds = cell * 0.66;
      drawDie(cell * 2.55, cell * 4.45, ds, S.faces[0]);
      drawDie(cell * 3.45, cell * 4.45, ds, S.faces[1]);
    }

    // マス
    TILES.forEach((tile, i) => {
      const [c, r] = POS[i];
      const x = c * cell + 2, y = r * cell + 2, w = cell - 4;
      const [label, bg, fg] = tileLabel(tile);
      roundRect(x, y, w, w, 8); ctx.fillStyle = bg; ctx.fill();
      if (tile.t === 'prop') {
        ctx.save(); roundRect(x, y, w, w, 8); ctx.clip();
        ctx.fillStyle = tile.color; ctx.fillRect(x, y, w, w * 0.28); ctx.restore();
        ctx.fillStyle = fg; ctx.font = `bold ${cell * 0.26}px sans-serif`;
        ctx.fillText(label, x + w / 2, y + w * 0.62);
        ctx.font = `${cell * 0.16}px sans-serif`; ctx.fillText('🪙', x + w / 2, y + w * 0.86);
      } else {
        ctx.fillStyle = fg; ctx.font = `bold ${cell * (label.length > 1 && tile.t === 'go' ? 0.34 : 0.4)}px sans-serif`;
        ctx.fillText(label, x + w / 2, y + w / 2 + 1);
      }
      if (i === S.pos && S.playing) { ctx.lineWidth = 3; ctx.strokeStyle = '#ffe27a'; roundRect(x, y, w, w, 8); ctx.stroke(); }
    });

    // コマ
    if (S.playing) {
      const tx = S.tokenX, ty = S.tokenY - S.hop * cell * 0.35;
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(S.tokenX, S.tokenY + cell * 0.22, cell * 0.2 * (1 - S.hop * 0.3), cell * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8384f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(tx - cell * 0.17, ty + cell * 0.2); ctx.lineTo(tx + cell * 0.17, ty + cell * 0.2);
      ctx.lineTo(tx + cell * 0.08, ty - cell * 0.02); ctx.lineTo(tx - cell * 0.08, ty - cell * 0.02); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(tx, ty - cell * 0.12, cell * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  function tween(ms, fn) {
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => { const k = Math.min(1, (now - t0) / ms); fn(k); if (k < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step);
    });
  }

  // ---- 進行 ----
  async function moveSteps(n) {
    for (let s = 0; s < n; s++) {
      const from = tileCenter(S.pos);
      S.pos = (S.pos + 1) % TILES.length;
      const to = tileCenter(S.pos);
      sfx.step();
      await tween(130, (k) => {
        S.tokenX = from[0] + (to[0] - from[0]) * k; S.tokenY = from[1] + (to[1] - from[1]) * k;
        S.hop = Math.sin(k * Math.PI);
      });
      S.hop = 0;
    }
  }

  async function roll() {
    if (!S.playing || S.busy || S.dice < 1) return;
    S.busy = true; S.dice -= S.mult; updateUI();
    S.rolling = true;
    for (let i = 0; i < 9; i++) {
      S.faces = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      sfx.dice(); await wait(45 + i * 6);
    }
    S.rolling = false;
    const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
    S.faces = [a, b];
    setMsg(`${a} + ${b} = ${a + b} マス！`);
    await wait(220);
    await moveSteps(a + b);
    S.busy = false;
    updateUI();
    if (S.dice <= 0) setMsg('サイコロがなくなった！');
  }

  function start() {
    Object.assign(S, { playing: true, busy: false, dice: START_DICE, mult: 1, pos: 0, faces: [1, 1] });
    const [x, y] = tileCenter(0); S.tokenX = x; S.tokenY = y;
    ui.overlay.classList.add('hidden');
    setMsg('「ふる！」でサイコロをふろう');
    beep(784, 0.1, 'triangle', 0.06);
    updateUI();
  }

  ui.start.addEventListener('click', start);
  ui.roll.addEventListener('click', roll);
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (!S.playing) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!ui.overlay.classList.contains('hidden')) start(); } return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); roll(); }
  });
  window.addEventListener('resize', resize);
  resize(); updateUI();
  requestAnimationFrame(loop);
})();
