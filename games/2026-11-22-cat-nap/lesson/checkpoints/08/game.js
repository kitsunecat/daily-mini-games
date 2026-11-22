(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const scoreEl = $('score'), bestEl = $('best'), levelEl = $('level'), timeEl = $('time'), fillEl = $('timefill'), msgEl = $('msg');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');
  const BEST_KEY = 'catnap-best';
  const START_TIME = 120, MAX_TIME = 180, HINT_COST = 10;
  const COLORS = ['#ffb3ba', '#ffdfa3', '#fff3a8', '#b9f0c2', '#a8e4f0', '#b8c4ff', '#dcb8ff', '#ffc4e8'];
  const CAT_COLORS = ['#f4a24c', '#6b6b78', '#f2f2f2', '#2f2f36', '#d9b38c'];

  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
  bestEl.textContent = best;

  // ---------- puzzle generation ----------
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function placeCats(N) {
    const cols = [], used = new Array(N).fill(false);
    (function rec(r) {
      if (r === N) return true;
      for (const c of shuffle([...Array(N).keys()])) {
        if (used[c] || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue;
        used[c] = true; cols[r] = c;
        if (rec(r + 1)) return true;
        used[c] = false;
      }
      return false;
    })(0);
    return cols;
  }
  function growRegions(N, cols) {
    const reg = new Array(N * N).fill(-1);
    cols.forEach((c, r) => { reg[r * N + c] = r; });
    let left = N * N - N;
    while (left > 0) {
      const k = Math.random() * N | 0, cand = [];
      for (let i = 0; i < N * N; i++) {
        if (reg[i] !== k) continue;
        const r = i / N | 0, c = i % N;
        for (const [dr, dc] of DIRS) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < N && cc < N && reg[rr * N + cc] === -1) cand.push(rr * N + cc);
        }
      }
      if (!cand.length) continue;
      reg[cand[Math.random() * cand.length | 0]] = k; left--;
    }
    return reg;
  }
  function solve(N, reg, limit) {
    const sols = [], uc = new Array(N).fill(false), ur = new Array(N).fill(false), cols = [];
    (function rec(r) {
      if (sols.length >= limit) return;
      if (r === N) { sols.push(cols.slice()); return; }
      for (let c = 0; c < N; c++) {
        if (uc[c] || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue;
        const g = reg[r * N + c];
        if (ur[g]) continue;
        uc[c] = ur[g] = true; cols[r] = c;
        rec(r + 1);
        uc[c] = ur[g] = false;
      }
    })(0);
    return sols;
  }
  function connected(N, reg, k) {
    let start = -1, tot = 0;
    for (let i = 0; i < N * N; i++) if (reg[i] === k) { tot++; if (start < 0) start = i; }
    if (!tot) return false;
    const seen = new Set([start]), st = [start];
    while (st.length) {
      const i = st.pop(), r = i / N | 0, c = i % N;
      for (const [dr, dc] of DIRS) {
        const rr = r + dr, cc = c + dc, j = rr * N + cc;
        if (rr >= 0 && cc >= 0 && rr < N && cc < N && reg[j] === k && !seen.has(j)) { seen.add(j); st.push(j); }
      }
    }
    return seen.size === tot;
  }
  function generate(N) {
    let fallback = null;
    for (let a = 0; a < 60; a++) {
      const sol = placeCats(N), reg = growRegions(N, sol);
      const isSol = (i) => sol[i / N | 0] === i % N;
      fallback = { sol, reg };
      for (let step = 0; step < 300; step++) {
        const s = solve(N, reg, 2);
        if (s.length === 1) return { sol, reg };
        const alt = s.find((x) => x.some((c, r) => c !== sol[r]));
        const cells = shuffle(alt.map((c, r) => r * N + c).filter((i) => !isSol(i)));
        let moved = false;
        for (const i of cells) {
          const r = i / N | 0, c = i % N, old = reg[i];
          for (const [dr, dc] of shuffle(DIRS.slice())) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
            const nk = reg[rr * N + cc];
            if (nk === old) continue;
            reg[i] = nk;
            if (connected(N, reg, old)) { moved = true; break; }
            reg[i] = old;
          }
          if (moved) break;
        }
        if (!moved) break;
      }
    }
    return fallback; // any valid answer is accepted anyway
  }

  // ---------- state ----------
  let N = 5, puzzle = null, cells = [], catColor = [];
  let state = 'title', score = 0, level = 1, timeLeft = START_TIME, lastT = 0, levelStart = 0;
  let cursor = -1, conflicts = new Set(), clearAnim = 0, pops = [];
  const sizeFor = (lv) => (lv <= 1 ? 5 : lv <= 3 ? 6 : lv <= 6 ? 7 : 8);

  function newLevel() {
    N = sizeFor(level);
    puzzle = generate(N);
    cells = new Array(N * N).fill(0); // 0 empty, 1 x-mark, 2 cat
    catColor = cells.map(() => CAT_COLORS[Math.random() * CAT_COLORS.length | 0]);
    conflicts = new Set(); clearAnim = 0; cursor = -1;
    levelStart = performance.now();
    levelEl.textContent = 'ステージ ' + level;
    updateMsg();
  }

  function check() {
    conflicts = new Set();
    const cats = [];
    for (let i = 0; i < N * N; i++) if (cells[i] === 2) cats.push(i);
    for (let a = 0; a < cats.length; a++) for (let b = a + 1; b < cats.length; b++) {
      const i = cats[a], j = cats[b];
      const ri = i / N | 0, ci = i % N, rj = j / N | 0, cj = j % N;
      if (ri === rj || ci === cj || puzzle.reg[i] === puzzle.reg[j] || (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) {
        conflicts.add(i); conflicts.add(j);
      }
    }
    updateMsg(cats.length);
    if (cats.length === N && conflicts.size === 0) win();
  }
  function updateMsg(n) {
    if (n === undefined) n = cells.filter((v) => v === 2).length;
    msgEl.textContent = conflicts.size ? 'ぶつかっているねこがいるよ' : 'ねこ ' + n + ' / ' + N;
  }

  function win() {
    state = 'clear';
    const secs = (performance.now() - levelStart) / 1000;
    const gain = N * 100 + Math.max(0, Math.round((N * 12 - secs) * 10));
    score += gain;
    scoreEl.textContent = score;
    timeLeft = Math.min(MAX_TIME, timeLeft + 15 + N * 2);
    clearAnim = 0.0001;
    msgEl.textContent = 'クリア！ +' + gain;
    beep([660, 880, 1100], 0.09);
    setTimeout(() => { if (state === 'clear') { level++; newLevel(); state = 'play'; } }, 1300);
  }

  function setCell(i, v) {
    if (cells[i] === v) return;
    cells[i] = v;
    if (v === 2) { pops.push({ i, t: 0 }); beep([520 + (i % N) * 30], 0.05); }
    else if (v === 1) beep([300], 0.025);
    check();
  }
  function cycle(i) { setCell(i, (cells[i] + 1) % 3); }

  function hint() {
    if (state !== 'play') return;
    // find a region whose correct cell has no cat
    const todo = [];
    for (let r = 0; r < N; r++) { const i = r * N + puzzle.sol[r]; if (cells[i] !== 2) todo.push(i); }
    if (!todo.length) return;
    // remove cats that disagree with the answer first
    for (let i = 0; i < N * N; i++) if (cells[i] === 2 && puzzle.sol[i / N | 0] !== i % N) cells[i] = 0;
    const i = todo[Math.random() * todo.length | 0];
    timeLeft = Math.max(1, timeLeft - HINT_COST);
    cursor = i;
    setCell(i, 2);
  }
  function resetBoard() {
    if (state !== 'play') return;
    cells.fill(0); check();
  }

  function startGame() {
    initAudio();
    score = 0; level = 1; timeLeft = START_TIME;
    scoreEl.textContent = 0;
    newLevel();
    state = 'play';
    overlay.classList.add('hidden');
  }
  function gameOver() {
    state = 'over';
    beep([400, 300, 200], 0.15);
    let isBest = false;
    if (score > best) {
      best = score; isBest = true;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* ignore */ }
      bestEl.textContent = best;
    }
    ovTitle.textContent = 'タイムアップ！';
    ovText.innerHTML = 'ステージ ' + level + ' まで到達<br>スコア <b class="hl">' + score + '</b>' + (isBest ? '<br>ハイスコア更新！' : '');
    startBtn.textContent = 'もういちど';
    overlay.classList.remove('hidden');
  }

  // ---------- layout & drawing ----------
  let W = 0, H = 0, dpr = 1, ox = 0, oy = 0, cs = 40;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function layout() {
    const size = Math.max(100, Math.min(W - 24, H - 24));
    cs = Math.floor(size / N);
    ox = Math.round((W - cs * N) / 2); oy = Math.round((H - cs * N) / 2);
  }

  function drawCat(x, y, s, color, bad, scale) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(scale, scale);
    const dark = color === '#2f2f36' || color === '#6b6b78';
    // body (curled)
    ctx.fillStyle = bad ? '#ff6b7a' : color;
    ctx.strokeStyle = 'rgba(40,30,50,.55)'; ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.36, s * 0.24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // tail
    ctx.beginPath(); ctx.lineWidth = s * 0.08; ctx.strokeStyle = bad ? '#e04a5a' : color;
    ctx.arc(0, s * 0.12, s * 0.34, 0.2, 1.4); ctx.stroke();
    // head
    ctx.lineWidth = s * 0.04; ctx.strokeStyle = 'rgba(40,30,50,.55)';
    ctx.fillStyle = bad ? '#ff6b7a' : color;
    ctx.beginPath();
    ctx.moveTo(-s * 0.26, -s * 0.02);
    ctx.lineTo(-s * 0.24, -s * 0.34); ctx.lineTo(-s * 0.1, -s * 0.22);
    ctx.lineTo(s * 0.1, -s * 0.22); ctx.lineTo(s * 0.24, -s * 0.34);
    ctx.lineTo(s * 0.26, -s * 0.02);
    ctx.quadraticCurveTo(s * 0.26, s * 0.16, 0, s * 0.16);
    ctx.quadraticCurveTo(-s * 0.26, s * 0.16, -s * 0.26, -s * 0.02);
    ctx.fill(); ctx.stroke();
    // sleepy eyes
    ctx.strokeStyle = dark ? '#f5f0ff' : '#3a2f45'; ctx.lineWidth = s * 0.035; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.06, s * 0.05, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.1, -s * 0.06, s * 0.05, 0.2, Math.PI - 0.2); ctx.stroke();
    // nose
    ctx.fillStyle = '#ff8fa3';
    ctx.beginPath(); ctx.arc(0, s * 0.03, s * 0.025, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!puzzle) {
      // title backdrop: a sleeping cat pattern
      return;
    }
    layout();
    const reg = puzzle.reg;
    // board shadow
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    roundRect(ox - 6, oy - 2, cs * N + 12, cs * N + 12, 14); ctx.fill();
    ctx.fillStyle = '#3a3154';
    roundRect(ox - 6, oy - 6, cs * N + 12, cs * N + 12, 14); ctx.fill();
    for (let i = 0; i < N * N; i++) {
      const r = i / N | 0, c = i % N, x = ox + c * cs, y = oy + r * cs;
      ctx.fillStyle = COLORS[reg[i]];
      ctx.fillRect(x, y, cs, cs);
    }
    // thin grid
    ctx.strokeStyle = 'rgba(60,40,80,.18)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < N; k++) {
      ctx.moveTo(ox + k * cs + 0.5, oy); ctx.lineTo(ox + k * cs + 0.5, oy + N * cs);
      ctx.moveTo(ox, oy + k * cs + 0.5); ctx.lineTo(ox + N * cs, oy + k * cs + 0.5);
    }
    ctx.stroke();
    // thick region borders
    ctx.strokeStyle = '#3a3154'; ctx.lineWidth = Math.max(2.5, cs * 0.06); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const i = r * N + c, x = ox + c * cs, y = oy + r * cs;
      if (c < N - 1 && reg[i] !== reg[i + 1]) { ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); }
      if (r < N - 1 && reg[i] !== reg[i + N]) { ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); }
    }
    ctx.stroke();
    ctx.strokeRect(ox, oy, cs * N, cs * N);
    // marks & cats
    for (let i = 0; i < N * N; i++) {
      const r = i / N | 0, c = i % N, cx = ox + c * cs + cs / 2, cy = oy + r * cs + cs / 2;
      if (cells[i] === 1) {
        ctx.strokeStyle = 'rgba(70,55,95,.55)'; ctx.lineWidth = Math.max(2, cs * 0.06); ctx.lineCap = 'round';
        const d = cs * 0.14;
        ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();
      } else if (cells[i] === 2) {
        const p = pops.find((q) => q.i === i);
        let sc = 1;
        if (p) sc = 1 + Math.sin(Math.min(1, p.t / 0.25) * Math.PI) * 0.25;
        if (clearAnim > 0) sc *= 1 + Math.sin(clearAnim * 10 + c) * 0.08;
        const bob = Math.sin(t / 600 + i) * cs * 0.015;
        drawCat(cx, cy + bob, cs * 0.9, catColor[i], conflicts.has(i), sc);
        if (clearAnim > 0 || (state === 'play' && !conflicts.has(i) && Math.sin(t / 900 + i * 1.7) > 0.96)) {
          ctx.fillStyle = 'rgba(70,55,95,.7)'; ctx.font = 'bold ' + Math.round(cs * 0.22) + 'px sans-serif';
          ctx.fillText('z', cx + cs * 0.22, cy - cs * 0.25 - (clearAnim * 20) % (cs * 0.2));
        }
      }
    }
    // cursor (keyboard)
    if (cursor >= 0 && state === 'play') {
      const r = cursor / N | 0, c = cursor % N;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.strokeRect(ox + c * cs + 3, oy + r * cs + 3, cs - 6, cs - 6);
    }
    if (clearAnim > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, 0.5 - clearAnim) + ')';
      ctx.fillRect(ox, oy, cs * N, cs * N);
      ctx.fillStyle = '#ffd36b'; ctx.strokeStyle = '#5b2f6b'; ctx.lineWidth = 6;
      ctx.font = 'bold ' + Math.round(cs * N * 0.13) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeText('おやすみ〜', W / 2, H / 2); ctx.fillText('おやすみ〜', W / 2, H / 2);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function loop(t) {
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
    lastT = t;
    if (state === 'play') {
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; gameOver(); }
    }
    if (clearAnim > 0) clearAnim += dt;
    pops.forEach((p) => { p.t += dt; });
    pops = pops.filter((p) => p.t < 0.3);
    timeEl.textContent = Math.ceil(timeLeft);
    fillEl.style.width = (timeLeft / MAX_TIME * 100) + '%';
    fillEl.classList.toggle('low', timeLeft < 15);
    draw(t);
    requestAnimationFrame(loop);
  }

  // ---------- input ----------
  let drag = null;
  function cellAt(e) {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left - ox, y = e.clientY - r.top - oy;
    if (x < 0 || y < 0 || x >= cs * N || y >= cs * N) return -1;
    return (y / cs | 0) * N + (x / cs | 0);
  }
  cv.addEventListener('pointerdown', (e) => {
    if (state !== 'play') return;
    const i = cellAt(e);
    if (i < 0) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    cursor = -1;
    drag = { start: i, moved: false, mode: cells[i] === 0 ? 1 : cells[i] === 1 ? 0 : -1 };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || state !== 'play') return;
    const i = cellAt(e);
    if (i < 0 || (i === drag.start && !drag.moved)) return;
    if (drag.mode < 0) return; // started on a cat: no painting
    if (!drag.moved) { drag.moved = true; if (cells[drag.start] !== 2) setCell(drag.start, drag.mode); }
    if (cells[i] !== 2) setCell(i, drag.mode);
  });
  const endDrag = () => {
    if (drag && !drag.moved && state === 'play') cycle(drag.start);
    drag = null;
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', () => { drag = null; });

  window.addEventListener('keydown', (e) => {
    if (state === 'title' || state === 'over') {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(); }
      return;
    }
    if (state !== 'play') return;
    const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (mv) {
      e.preventDefault();
      if (cursor < 0) cursor = 0;
      else {
        const r = Math.min(N - 1, Math.max(0, (cursor / N | 0) + mv[0]));
        const c = Math.min(N - 1, Math.max(0, cursor % N + mv[1]));
        cursor = r * N + c;
      }
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault(); if (cursor < 0) cursor = 0; else cycle(cursor);
    } else if (e.key === 'x' || e.key === 'X') {
      if (cursor >= 0) setCell(cursor, cells[cursor] === 1 ? 0 : 1);
    } else if (e.key === 'h' || e.key === 'H') hint();
  });

  startBtn.addEventListener('click', startGame);
  $('hintbtn').addEventListener('click', hint);
  $('clearbtn').addEventListener('click', resetBoard);
  window.addEventListener('resize', resize);

  // ---------- sound ----------
  let ac = null;
  function initAudio() {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
  }
  function beep(freqs, len) {
    if (!ac) return;
    try {
      const now = ac.currentTime;
      freqs.forEach((f, k) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        const s = now + k * len;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.12, s + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, s + len * 1.6);
        o.connect(g); g.connect(ac.destination);
        o.start(s); o.stop(s + len * 1.8);
      });
    } catch (e) { /* ignore */ }
  }

  resize();
  requestAnimationFrame(loop);
  // expose for tests
  window.__catnap = { get puzzle() { return puzzle; }, get N() { return N; }, get state() { return state; } };
})();
