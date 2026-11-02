(() => {
  'use strict';
  const W = 360, H = 600, R = 20, D = R * 2, COLS = 9;
  const RH = R * Math.sqrt(3);
  const DEAD_ROW = 13;                       // 14段目に入ったらアウト
  const DEAD_Y = R + DEAD_ROW * RH + R + 2;
  const SX = W / 2, SY = H - 46;             // 発射台
  const COLORS = [
    { c: '#ff5f7e', g: 'heart' },
    { c: '#ffc94a', g: 'star' },
    { c: '#4fd6a0', g: 'leaf' },
    { c: '#5ab0ff', g: 'drop' },
    { c: '#b98cff', g: 'moon' },
    { c: '#ff9a4a', g: 'dot' },
  ];

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score'), bestEl = $('best'), shotsEl = $('shots');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start'), toast = $('toast');

  let rows, numColors, running = false;

  // ---------- グリッド ----------
  const rowLen = (row) => (row.off ? COLS - 1 : COLS);
  const cellX = (row, c) => R + c * D + (row.off ? R : 0);
  const cellY = (r) => R + r * RH;

  function makeRow(off, fill) {
    const row = { off, cells: [] };
    for (let c = 0; c < rowLen(row); c++) row.cells.push(fill ? randColor() : -1);
    return row;
  }
  function randColor() { return Math.floor(Math.random() * numColors); }

  function fillStart() {
    rows = [];
    for (let r = 0; r < 7; r++) {
      const row = makeRow(r % 2 === 1, false);
      for (let c = 0; c < rowLen(row); c++) {
        // 近くの色を引きつぐと塊ができて遊びやすい
        let col = randColor();
        if (Math.random() < 0.3 && c > 0) col = row.cells[c - 1];
        else if (Math.random() < 0.25 && r > 0) col = rows[r - 1].cells[Math.min(c, rowLen(rows[r - 1]) - 1)];
        row.cells[c] = col;
      }
      rows.push(row);
    }
  }

  // ---------- 進行 ----------
  function start() {
    numColors = 4;
    fillStart();
    running = true;
    overlay.classList.add('hide');
  }

  // ---------- 描画 ----------
  function drawGlyph(x, y, g, s) {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    switch (g) {
      case 'heart':
        ctx.moveTo(x, y + s * 0.6);
        ctx.bezierCurveTo(x - s * 1.2, y - s * 0.2, x - s * 0.5, y - s, x, y - s * 0.35);
        ctx.bezierCurveTo(x + s * 0.5, y - s, x + s * 1.2, y - s * 0.2, x, y + s * 0.6);
        break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? s * 0.4 : s * 0.9;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        break;
      case 'leaf':
        ctx.ellipse(x, y, s * 0.45, s * 0.85, Math.PI / 4, 0, Math.PI * 2);
        break;
      case 'drop':
        ctx.moveTo(x, y - s * 0.9);
        ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.1, x, y + s * 0.7);
        ctx.quadraticCurveTo(x - s * 0.8, y + s * 0.1, x, y - s * 0.9);
        break;
      case 'moon':
        ctx.arc(x, y, s * 0.75, Math.PI * 0.3, Math.PI * 1.7);
        ctx.arc(x + s * 0.35, y, s * 0.55, Math.PI * 1.6, Math.PI * 0.4, true);
        break;
      default:
        ctx.arc(x, y, s * 0.4, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawBubble(x, y, col, rad = R - 1, alpha = 1) {
    const k = COLORS[col];
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.25, k.c);
    g.addColorStop(1, shade(k.c));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    drawGlyph(x + rad * 0.1, y + rad * 0.12, k.g, rad * 0.42);
    ctx.globalAlpha = 1;
  }
  const shadeCache = {};
  function shade(hex) {
    if (shadeCache[hex]) return shadeCache[hex];
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.floor(v * 0.55);
    return (shadeCache[hex] = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`);
  }

  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // デッドライン
    ctx.strokeStyle = 'rgba(255,95,126,.55)';
    ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, DEAD_Y); ctx.lineTo(W, DEAD_Y); ctx.stroke();
    ctx.setLineDash([]);

    if (rows) rows.forEach((row, r) => row.cells.forEach((v, c) => { if (v >= 0) drawBubble(cellX(row, c), cellY(r), v); }));

    // 発射台
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.arc(SX, SY, R + 10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- 入力 ----------
  startBtn.addEventListener('click', () => { start(); });

  // タイトル画面用に盤面を用意しておく
  numColors = 4; fillStart();
  requestAnimationFrame(loop);
})();
