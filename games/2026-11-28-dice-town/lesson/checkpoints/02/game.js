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

  // ---- 状態 ----
  const S = { playing: false, busy: false };

  function setMsg(t) { ui.msg.textContent = t; }

  // ---- 描画 ----
  let size = 300, cell = 50, dpr = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    size = Math.max(200, Math.floor(Math.min(r.width - 12, r.height - 4)));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size * dpr; cv.height = size * dpr;
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cell = size / 6;
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

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // 中央の芝生
    roundRect(cell, cell, cell * 4, cell * 4, 10); ctx.fillStyle = '#4fae6e'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    for (let i = 0; i < 8; i++) ctx.fillRect(cell + i * cell / 2, cell, cell / 4, cell * 4);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
    });
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  // ---- 進行 ----
  function start() {
    Object.assign(S, { playing: true, busy: false });
    ui.overlay.classList.add('hidden');
    setMsg('「ふる！」でサイコロをふろう');
  }

  ui.start.addEventListener('click', start);
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (!S.playing) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!ui.overlay.classList.contains('hidden')) start(); } return; }
  });
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(loop);
})();
