(() => {
  'use strict';
  const CAP = 4;
  const COLORS = ['#ff5a7a', '#ffc93c', '#4cd3ff', '#6ee07a', '#b07aff', '#ff9a3c', '#f7f7f7', '#3c6bff', '#ff7ad9', '#27b39b'];

  const $ = (id) => document.getElementById(id);
  const board = $('board'), overlay = $('overlay');
  const elLevel = $('level'), elScore = $('score');
  const elToast = $('toast');

  let tubes = [];
  let level = 1, score = 0, sel = -1;
  let playing = false, busy = false;

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
      el.className = 'tube' + (i === sel ? ' sel' : '') + (isDoneTube(t) ? ' done' : '');
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
  }

  function toast(msg) {
    elToast.textContent = msg;
    elToast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => elToast.classList.remove('show'), 900);
  }

  // ---------- game flow ----------
  function startLevel() {
    tubes = makeLevel(level);
    sel = -1; busy = false;
    layout(); render(); hud();
  }

  function startGame() {
    level = 1; score = 0; playing = true;
    overlay.classList.add('hide');
    startLevel();
  }

  function clearLevel() {
    busy = true;
    const bonus = 100 * level;
    score += bonus;
    toast(`クリア！ +${bonus}`);
    hud();
    setTimeout(() => { if (playing) { level++; startLevel(); } }, 1100);
  }

  function tap(i) {
    if (!playing || busy || i < 0 || i >= tubes.length) return;
    if (sel < 0) {
      if (!tubes[i].length || isDoneTube(tubes[i])) { shake(i); return; }
      sel = i; render(); return;
    }
    if (sel === i) { sel = -1; render(); return; }
    const a = tubes[sel], b = tubes[i];
    if (!canPour(a, b)) {
      // switch selection if tapping another pourable tube
      if (b.length && !isDoneTube(b)) { sel = i; render(); }
      else { shake(i); }
      return;
    }
    const n = Math.min(runLen(a), CAP - b.length);
    for (let m = 0; m < n; m++) b.push(a.pop());
    sel = -1;
    render(i, n); hud();
    if (isSolved(tubes)) clearLevel();
  }

  function shake(i) {
    const el = board.children[i];
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }

  // ---------- input ----------
  board.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.tube');
    if (!el) return;
    tap(+el.dataset.i);
  });
  $('start').addEventListener('click', startGame);

  window.addEventListener('resize', () => { if (tubes.length) { layout(); render(); } });

  hud();
})();
