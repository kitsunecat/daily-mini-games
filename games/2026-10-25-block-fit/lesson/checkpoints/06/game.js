(() => {
  const N = 8;
  const COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa', '#f783ac'];
  const SHAPES = [
    [[0, 0]],
    [[0, 0], [0, 1]], [[0, 0], [1, 0]],
    [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
    [[0, 0], [1, 0], [1, 1]], [[0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 0], [0, 1], [0, 2], [1, 0]], [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 2], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 1], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [1, 1], [1, 2]], [[0, 1], [1, 0], [1, 1], [2, 0]],
  ];

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');

  let board, tray, score, combo, playing = false;
  let drag = null;       // { idx, x, y, offY }
  let flashes = [];      // { r, c, t }
  let popups = [];       // { text, x, y, t }
  let layout = {};

  // ---- layout ----
  function resize() {
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(rect.width * dpr);
    cv.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height;
    const pad = 14;
    // board takes width, tray needs ~ board*0.42 below
    const boardSize = Math.min(W - pad * 2, (H - pad * 3) / 1.45);
    const cell = boardSize / N;
    const bx = (W - boardSize) / 2;
    const by = pad;
    const trayY = by + boardSize + pad;
    const trayH = Math.max(H - trayY - pad, cell * 3);
    layout = { W, H, cell, bx, by, boardSize, trayY, trayH, mini: cell * 0.55 };
    draw();
  }

  // ---- game logic ----
  function randomPiece() {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const rows = Math.max(...shape.map(p => p[0])) + 1;
    const cols = Math.max(...shape.map(p => p[1])) + 1;
    return { shape, rows, cols, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
  }

  function canPlace(piece, r, c) {
    for (const [dr, dc] of piece.shape) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N || board[rr][cc]) return false;
    }
    return true;
  }

  function refillTray() {
    tray = [randomPiece(), randomPiece(), randomPiece()];
  }

  function place(idx, r, c) {
    const piece = tray[idx];
    for (const [dr, dc] of piece.shape) board[r + dr][c + dc] = piece.color;
    tray[idx] = null;
    let gained = piece.shape.length;

    const fullRows = [], fullCols = [];
    for (let i = 0; i < N; i++) {
      if (board[i].every(v => v)) fullRows.push(i);
      if (board.every(row => row[i])) fullCols.push(i);
    }
    const lines = fullRows.length + fullCols.length;
    if (lines > 0) {
      combo++;
      const now = performance.now();
      for (const rr of fullRows) for (let cc = 0; cc < N; cc++) { flashes.push({ r: rr, c: cc, color: board[rr][cc], t: now }); }
      for (const cc of fullCols) for (let rr = 0; rr < N; rr++) { flashes.push({ r: rr, c: cc, color: board[rr][cc], t: now }); }
      for (const rr of fullRows) for (let cc = 0; cc < N; cc++) board[rr][cc] = null;
      for (const cc of fullCols) for (let rr = 0; rr < N; rr++) board[rr][cc] = null;
      const bonus = lines * 10 * lines * combo;
      gained += bonus;
      const { bx, by, cell } = layout;
      popups.push({
        text: (combo > 1 ? `COMBO x${combo}  ` : '') + `+${bonus}`,
        x: bx + (c + piece.cols / 2) * cell,
        y: by + (r + piece.rows / 2) * cell,
        t: now,
      });
    } else {
      combo = 0;
    }
    score += gained;
    scoreEl.textContent = score;

    if (tray.every(p => !p)) refillTray();
  }

  function start() {
    board = Array.from({ length: N }, () => Array(N).fill(null));
    refillTray();
    score = 0; combo = 0;
    scoreEl.textContent = 0;
    flashes = []; popups = []; drag = null;
    playing = true;
    overlay.classList.add('hidden');
  }

  // ---- input ----
  function traySlot(i) {
    const { W, trayY, trayH } = layout;
    const w = W / 3;
    return { x: w * i, y: trayY, w, h: trayH };
  }

  function pieceAtTray(x, y) {
    for (let i = 0; i < 3; i++) {
      const s = traySlot(i);
      if (tray[i] && x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return i;
    }
    return -1;
  }

  // top-left cell where dragged piece would snap
  function dragTarget() {
    if (!drag) return null;
    const p = tray[drag.idx];
    const { bx, by, cell } = layout;
    const px = drag.x - (p.cols * cell) / 2;
    const py = drag.y - drag.offY - (p.rows * cell) / 2;
    const c = Math.round((px - bx) / cell);
    const r = Math.round((py - by) / cell);
    return { r, c, ok: canPlace(p, r, c), px, py };
  }

  function pos(e) {
    const rect = cv.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  cv.addEventListener('pointerdown', e => {
    if (!playing) return;
    const { x, y } = pos(e);
    const i = pieceAtTray(x, y);
    if (i < 0) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    drag = { idx: i, x, y, offY: e.pointerType === 'mouse' ? 0 : layout.cell * 1.6 };
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const { x, y } = pos(e);
    drag.x = x; drag.y = y;
  });
  function endDrag() {
    if (!drag) return;
    const t = dragTarget();
    if (t && t.ok && playing) place(drag.idx, t.r, t.c);
    drag = null;
  }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', () => { drag = null; });

  startBtn.addEventListener('click', start);
  window.addEventListener('resize', resize);

  // ---- drawing ----
  function block(x, y, s, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    const g = 2;
    ctx.fillStyle = color;
    roundRect(x + g / 2, y + g / 2, s - g, s - g, s * 0.18);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(x + s * 0.15, y + s * 0.12, s * 0.7, s * 0.2, s * 0.08);
    ctx.fill();
    ctx.globalAlpha = 1;
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

  function draw() {
    const { W, H, cell, bx, by, boardSize, mini } = layout;
    if (!W) return;
    ctx.clearRect(0, 0, W, H);

    // board bg
    ctx.fillStyle = '#262b52';
    roundRect(bx - 6, by - 6, boardSize + 12, boardSize + 12, 12);
    ctx.fill();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = bx + c * cell, y = by + r * cell;
        if (board && board[r][c]) block(x, y, cell, board[r][c]);
        else {
          ctx.fillStyle = '#323868';
          roundRect(x + 2, y + 2, cell - 4, cell - 4, cell * 0.15);
          ctx.fill();
        }
      }
    }

    if (!board) return;

    // ghost preview
    let ghost = null;
    if (drag) {
      const t = dragTarget();
      if (t.ok) ghost = { piece: tray[drag.idx], r: t.r, c: t.c, ok: true };
    }
    if (ghost) {
      for (const [dr, dc] of ghost.piece.shape) {
        const x = bx + (ghost.c + dc) * cell, y = by + (ghost.r + dr) * cell;
        if (ghost.ok) block(x, y, cell, ghost.piece.color, 0.4);
        else { ctx.fillStyle = 'rgba(255,60,60,0.45)'; roundRect(x + 2, y + 2, cell - 4, cell - 4, cell * 0.15); ctx.fill(); }
      }
    }

    // flashes
    const now = performance.now();
    flashes = flashes.filter(f => now - f.t < 350);
    for (const f of flashes) {
      const k = (now - f.t) / 350;
      const s = cell * (1 - k * 0.6);
      const x = bx + f.c * cell + (cell - s) / 2, y = by + f.r * cell + (cell - s) / 2;
      block(x, y, s, '#ffffff', 1 - k);
    }

    // tray
    for (let i = 0; i < 3; i++) {
      const p = tray[i];
      if (!p || (drag && drag.idx === i)) continue;
      const s = traySlot(i);
      const sz = Math.min(mini, (s.w - 16) / p.cols);
      const ox = s.x + (s.w - p.cols * sz) / 2;
      const oy = s.y + (Math.min(s.h, sz * 5 + 20) - p.rows * sz) / 2;
      for (const [dr, dc] of p.shape) block(ox + dc * sz, oy + dr * sz, sz, p.color);
    }

    // dragged piece
    if (drag) {
      const p = tray[drag.idx];
      const t = dragTarget();
      for (const [dr, dc] of p.shape) block(t.px + dc * cell, t.py + dr * cell, cell, p.color, 0.95);
    }

    // popups
    popups = popups.filter(p => now - p.t < 900);
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(cell * 0.5)}px system-ui, sans-serif`;
    for (const p of popups) {
      const k = (now - p.t) / 900;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#1b1f3a';
      ctx.lineWidth = 4;
      ctx.strokeText(p.text, p.x, p.y - k * 40);
      ctx.fillText(p.text, p.x, p.y - k * 40);
      ctx.globalAlpha = 1;
    }
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
