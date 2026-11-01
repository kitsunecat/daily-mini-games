(() => {
  'use strict';
  const CAP = 4;
  const COLORS = ['#ff5a7a', '#ffc93c', '#4cd3ff', '#6ee07a', '#b07aff', '#ff9a3c', '#f7f7f7', '#3c6bff', '#ff7ad9', '#27b39b'];
  const BEST_KEY = 'dmg-color-pour-best';
  const UNDO_MAX = 3;

  const $ = (id) => document.getElementById(id);
  const board = $('board'), overlay = $('overlay');
  const elLevel = $('level'), elScore = $('score'), elBest = $('best');
  const elFill = $('timefill'), elTime = $('timetext'), elToast = $('toast');
  const btnUndo = $('undo'), btnReset = $('reset'), elUndoLeft = $('undoLeft');

  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) {}
  elBest.textContent = best;

  let tubes = [], initial = [], history = [], undoLeft = UNDO_MAX;
  let level = 1, score = 0, sel = -1, cursor = 0;
  let timeMax = 60, timeLeft = 60, playing = false, lastTs = 0, busy = false;
  let audio = null;

  function beep(freq, dur = 0.08, type = 'sine', vol = 0.12) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur);
    } catch (e) {}
  }

  // ---------- puzzle logic ----------
  const top = (t) => t[t.length - 1];
  function runLen(t) {
    let n = 0; const c = top(t);
    for (let i = t.length - 1; i >= 0 && t[i] === c; i--) n++;
    return n;
  }
  function canPour(a, b) {
    if (a === b || !a.length || b.length >= CAP) return false;
    return !b.length || top(b) === top(a);
  }
  const isDoneTube = (t) => t.length === CAP && t.every((c) => c === t[0]);
  const isSolved = (ts) => ts.every((t) => !t.length || isDoneTube(t));

  function solvable(start) {
    const seen = new Set();
    let nodes = 0;
    const key = (ts) => ts.map((t) => t.join(',')).sort().join('|');
    function dfs(ts) {
      if (isSolved(ts)) return true;
      if (++nodes > 40000) return false;
      const k = key(ts);
      if (seen.has(k)) return false;
      seen.add(k);
      for (let i = 0; i < ts.length; i++) {
        const a = ts[i];
        if (!a.length || isDoneTube(a)) continue;
        const r = runLen(a);
        let triedEmpty = false;
        for (let j = 0; j < ts.length; j++) {
          const b = ts[j];
          if (!canPour(a, b)) continue;
          if (!b.length) {
            if (r === a.length || triedEmpty) continue; // pointless
            triedEmpty = true;
          }
          const n = Math.min(r, CAP - b.length);
          const next = ts.map((t) => t.slice());
          for (let m = 0; m < n; m++) next[j].push(next[i].pop());
          if (dfs(next)) return true;
        }
      }
      return false;
    }
    return dfs(start);
  }

  function makeLevel(lv) {
    const nColors = Math.min(3 + Math.floor((lv - 1) / 2), COLORS.length - 1);
    const empties = lv >= 9 ? 1 : 2;
    for (let tries = 0; tries < 200; tries++) {
      const pool = [];
      for (let c = 0; c < nColors; c++) for (let k = 0; k < CAP; k++) pool.push(c);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const ts = [];
      for (let c = 0; c < nColors; c++) ts.push(pool.slice(c * CAP, c * CAP + CAP));
      if (ts.some((t) => isDoneTube(t) || runLen(t) >= 3)) continue;
      for (let e = 0; e < empties; e++) ts.push([]);
      if (solvable(ts)) return ts;
    }
    // fallback: always solvable with two empties for tiny boards
    return makeLevel(1);
  }

  // ---------- rendering ----------
  function layout() {
    const n = tubes.length;
    const stage = $('stage');
    const W = stage.clientWidth - 12, H = stage.clientHeight - 12;
    const rows = n <= 6 ? 1 : 2;
    const perRow = Math.ceil(n / rows);
    const gapX = 12;
    const tw = Math.max(30, Math.min(54, (W - gapX * (perRow - 1)) / perRow));
    const rowH = (H - 26 * rows) / rows;
    const seg = Math.max(22, Math.min(40, (rowH - 30) / CAP, tw * 0.85));
    board.style.setProperty('--tw', tw + 'px');
    board.style.setProperty('--seg', seg + 'px');
    board.style.maxWidth = (perRow * tw + (perRow - 1) * gapX + 2) + 'px';
  }

  function render(pourTo = -1, pourN = 0) {
    board.innerHTML = '';
    tubes.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'tube' + (i === sel ? ' sel' : '') + (isDoneTube(t) ? ' done' : '') + (i === cursor && kbMode ? ' cursor' : '');
      el.dataset.i = i;
      const num = document.createElement('span');
      num.className = 'num'; num.textContent = (i + 1) % 10;
      el.appendChild(num);
      t.forEach((c, k) => {
        const s = document.createElement('div');
        s.className = 'seg' + (i === pourTo && k >= t.length - pourN ? ' new' : '');
        s.style.background = `linear-gradient(90deg, ${COLORS[c]}, ${COLORS[c]}cc)`;
        el.appendChild(s);
      });
      board.appendChild(el);
    });
  }

  function hud() {
    elLevel.textContent = level;
    elScore.textContent = score;
    elBest.textContent = best;
    elUndoLeft.textContent = undoLeft;
    btnUndo.disabled = !playing || !history.length || undoLeft <= 0;
    btnReset.disabled = !playing;
  }

  function toast(msg) {
    elToast.textContent = msg;
    elToast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => elToast.classList.remove('show'), 900);
  }

  // ---------- game flow ----------
  let kbMode = false;

  function startLevel() {
    tubes = makeLevel(level);
    initial = tubes.map((t) => t.slice());
    history = []; undoLeft = UNDO_MAX; sel = -1; cursor = 0; busy = false;
    const nColors = tubes.filter((t) => t.length).length;
    timeMax = 30 + nColors * 10;
    timeLeft = timeMax;
    layout(); render(); hud();
  }

  function startGame() {
    level = 1; score = 0; playing = true;
    overlay.classList.add('hide');
    startLevel();
    beep(660, 0.1, 'triangle');
    lastTs = performance.now();
  }

  function gameOver() {
    playing = false; sel = -1;
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
    hud(); render();
    $('ov-title').textContent = 'タイムアップ！';
    $('ov-text').innerHTML = `レベル ${level} まで到達<br>スコア <b>${score}</b>（ベスト ${best}）`;
    $('start').textContent = 'もう一度あそぶ';
    overlay.classList.remove('hide');
    beep(220, 0.3, 'sawtooth', 0.08);
  }

  function clearLevel() {
    busy = true;
    const bonus = 100 * level + Math.ceil(timeLeft) * 5;
    score += bonus;
    toast(`クリア！ +${bonus}`);
    [523, 659, 784, 1046].forEach((f, k) => setTimeout(() => beep(f, 0.12, 'triangle'), k * 90));
    hud();
    setTimeout(() => { if (playing) { level++; startLevel(); } }, 1100);
  }

  function tap(i) {
    if (!playing || busy || i < 0 || i >= tubes.length) return;
    if (sel < 0) {
      if (!tubes[i].length || isDoneTube(tubes[i])) { shake(i); return; }
      sel = i; beep(520, 0.05); render(); return;
    }
    if (sel === i) { sel = -1; render(); return; }
    const a = tubes[sel], b = tubes[i];
    if (!canPour(a, b)) {
      // switch selection if tapping another pourable tube
      if (b.length && !isDoneTube(b)) { sel = i; beep(520, 0.05); render(); }
      else { shake(i); }
      return;
    }
    history.push(tubes.map((t) => t.slice()));
    const n = Math.min(runLen(a), CAP - b.length);
    for (let m = 0; m < n; m++) b.push(a.pop());
    sel = -1;
    beep(300 + b.length * 90, 0.12, 'sine', 0.1);
    if (isDoneTube(b)) setTimeout(() => beep(880, 0.1, 'triangle'), 120);
    render(i, n); hud();
    if (isSolved(tubes)) clearLevel();
  }

  function shake(i) {
    beep(150, 0.08, 'square', 0.05);
    const el = board.children[i];
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }

  function undo() {
    if (!playing || busy || !history.length || undoLeft <= 0) return;
    tubes = history.pop(); undoLeft--; sel = -1;
    beep(400, 0.06); render(); hud();
  }

  function reset() {
    if (!playing || busy) return;
    tubes = initial.map((t) => t.slice());
    history = []; sel = -1;
    timeLeft = Math.max(0, timeLeft - 5);
    toast('やり直し −5秒');
    render(); hud();
  }

  function loop(ts) {
    const dt = Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;
    if (playing && !busy) {
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; gameOver(); }
    }
    const r = timeMax ? timeLeft / timeMax : 1;
    elFill.style.width = (r * 100) + '%';
    elFill.classList.toggle('low', r < 0.25);
    elTime.textContent = Math.ceil(timeLeft);
    requestAnimationFrame(loop);
  }

  // ---------- input ----------
  board.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.tube');
    if (!el) return;
    kbMode = false;
    tap(+el.dataset.i);
  });
  $('start').addEventListener('click', startGame);
  btnUndo.addEventListener('click', undo);
  btnReset.addEventListener('click', reset);

  window.addEventListener('keydown', (e) => {
    if (!playing) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(); }
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      const i = e.key === '0' ? 9 : +e.key - 1;
      kbMode = false; tap(i); return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault(); kbMode = true;
      cursor = (cursor + (e.key === 'ArrowRight' ? 1 : -1) + tubes.length) % tubes.length;
      render(); return;
    }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kbMode = true; tap(cursor); render(); return; }
    if (e.key === 'z' || e.key === 'Z') undo();
    if (e.key === 'r' || e.key === 'R') reset();
    if (e.key === 'Escape') { sel = -1; render(); }
  });

  window.addEventListener('resize', () => { if (tubes.length) { layout(); render(); } });

  hud();
  requestAnimationFrame((ts) => { lastTs = ts; loop(ts); });
})();
