(() => {
  'use strict';
  const LANES = 4;
  const ROWS = 4; // visible rows

  const $ = (id) => document.getElementById(id);
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  const msgEl = $('msg');
  const overlay = $('overlay'), startBtn = $('start');

  let W = 0, H = 0, dpr = 1, laneW = 0, rowH = 0;
  let tiles = [], nextRow = 0, scroll = 0;
  let state = 'title';
  let bgStars = [];

  // ---------- layout ----------
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const oldRowH = rowH;
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    laneW = W / LANES; rowH = H / ROWS;
    if (oldRowH > 0) scroll = scroll / oldRowH * rowH;
    bgStars = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6 }));
    draw();
  }
  window.addEventListener('resize', resize);

  // ---------- tiles ----------
  function addRow() {
    const prev = tiles[tiles.length - 1];
    let lane;
    do { lane = Math.floor(Math.random() * LANES); } while (prev && lane === prev.lane && Math.random() < 0.7);
    const len = 1;
    tiles.push({ lane, row: nextRow, len, st: 'pending' });
    nextRow += len;
  }
  // 画面上の y（タイル下端）
  const tileBottom = (t) => H - (t.row * rowH - scroll);
  const tileTop = (t) => tileBottom(t) - t.len * rowH;

  function reset() {
    tiles = []; nextRow = 0;
    scroll = -rowH * 0.6; // 最初のタイルが下から少し上に見える
    while (nextRow < ROWS + 3) addRow();
    tiles[0].start = true;
  }

  startBtn.addEventListener('click', start);

  function msg(s) { msgEl.textContent = s; }

  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hidden');
    msg('いちばん下のタイルからタップ！');
    draw();
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

  function draw(now) {
    const time = (now || 0) / 1000;
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a2f6b'); g.addColorStop(1, '#f0e9ff');
    ctx.fillStyle = '#f4f1ff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.18; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    for (const s of bgStars) {
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 2 + s.p);
      ctx.fillStyle = '#7b86d8';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // レーン線
    ctx.strokeStyle = 'rgba(90,100,170,.25)'; ctx.lineWidth = 1;
    for (let i = 1; i < LANES; i++) {
      ctx.beginPath(); ctx.moveTo(i * laneW + 0.5, 0); ctx.lineTo(i * laneW + 0.5, H); ctx.stroke();
    }
    // タイル
    const pad = 2;
    for (const t of tiles) {
      const y0 = tileTop(t), y1 = tileBottom(t);
      if (y1 < -2 || y0 > H + 2) continue;
      const x = t.lane * laneW + pad, w = laneW - pad * 2, h = y1 - y0 - pad * 2;
      const tg = ctx.createLinearGradient(0, y0, 0, y1);
      tg.addColorStop(0, '#2b2f55'); tg.addColorStop(1, '#14172e');
      ctx.fillStyle = tg;
      roundRect(x, y0 + pad, w, h, 6); ctx.fill();
      if (t.start && state === 'play' && t.st === 'pending') {
        ctx.fillStyle = '#ffd56b';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('START', t.lane * laneW + laneW / 2, (y0 + y1) / 2);
      }
    }
  }

  resize();
  reset();
  draw();
})();
