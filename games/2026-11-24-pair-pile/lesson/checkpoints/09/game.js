(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const boardEl = $('board'), wrap = $('board-wrap');
  const UX = 22, UY = 29, LX = 4, LY = -5; // half-unit size, per-layer offset
  const BEST_KEY = 'pair-pile-best';

  // ---- shapes (SVG) ----
  const COLORS = ['#d9433a', '#2e8b57', '#2f6fd6', '#c98a10'];
  const SHAPES = [
    (c) => `<circle cx="16" cy="16" r="11" fill="${c}"/>`,
    (c) => `<polygon points="16,4 29,27 3,27" fill="${c}"/>`,
    (c) => `<rect x="6" y="6" width="20" height="20" rx="3" fill="${c}"/>`,
    (c) => `<polygon points="16,2 30,16 16,30 2,16" fill="${c}"/>`,
    (c) => `<polygon points="16,2 19.8,11.6 30,12 22,18.6 24.8,29 16,23 7.2,29 10,18.6 2,12 12.2,11.6" fill="${c}"/>`,
    (c) => `<path d="M16 28 C4 20 2 13 6 8 C10 4 14 6 16 10 C18 6 22 4 26 8 C30 13 28 20 16 28Z" fill="${c}"/>`,
    (c) => `<path d="M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9z" fill="${c}"/>`,
    (c) => `<circle cx="16" cy="16" r="10" fill="none" stroke="${c}" stroke-width="5"/>`,
    (c) => `<polygon points="16,3 28,10 28,22 16,29 4,22 4,10" fill="${c}"/><circle cx="16" cy="16" r="4" fill="#fffaf0"/>`,
  ];
  const kindSvg = (k) => `<svg viewBox="0 0 32 32">${SHAPES[k % 9](COLORS[Math.floor(k / 9) % 4])}</svg>`;

  // ---- layouts (x,y in half units; tile = 2x2) ----
  function rect(out, l, x0, y0, cols, rows) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * 2, y: y0 + r * 2, l });
  }
  const LAYOUTS = [
    () => { const o = []; rect(o, 0, 0, 0, 8, 6); rect(o, 1, 2, 2, 6, 4); rect(o, 2, 4, 4, 4, 2); rect(o, 3, 6, 5, 2, 1); return o; },
    () => { const o = []; [4, 6, 8, 8, 6, 4].forEach((w, i) => rect(o, 0, 8 - w, i * 2, w, 1));
      [3, 5, 7, 5, 3].forEach((w, i) => rect(o, 1, 8 - w, 1 + i * 2, w, 1));
      rect(o, 2, 6, 3, 2, 1); rect(o, 2, 6, 5, 2, 1); rect(o, 3, 7, 4, 1, 1); return o; },
    () => { const o = []; rect(o, 0, 0, 0, 8, 6); rect(o, 1, 0, 2, 3, 4); rect(o, 1, 10, 2, 3, 4);
      rect(o, 2, 1, 3, 2, 2); rect(o, 2, 11, 3, 2, 2); rect(o, 3, 2, 4, 1, 1); rect(o, 3, 12, 4, 1, 1); return o; },
    () => { const o = []; rect(o, 0, 0, 0, 8, 2); rect(o, 0, 0, 8, 8, 2); rect(o, 0, 0, 4, 2, 2); rect(o, 0, 12, 4, 2, 2);
      rect(o, 0, 5, 5, 3, 1); rect(o, 1, 1, 1, 7, 1); rect(o, 1, 1, 9, 7, 1); rect(o, 1, 6, 5, 2, 1);
      rect(o, 2, 3, 1, 5, 1); rect(o, 2, 3, 9, 5, 1); rect(o, 2, 7, 5, 1, 1); rect(o, 3, 7, 4, 1, 1); return o; },
  ];

  // ---- state ----
  let tiles = [], stage = 1, score = 0, best = 0, timeLeft = 0, timeMax = 1;
  let selected = null, hints = 3, shuffles = 2, running = false, lastMatch = 0, combo = 0, lastTick = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
  $('best').textContent = best;

  const overlaps = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
  function isFree(t, list) {
    let left = false, right = false;
    for (const o of list) {
      if (o === t) continue;
      if (o.l > t.l && overlaps(o, t)) return false;
      if (o.l === t.l && Math.abs(o.y - t.y) < 2) {
        if (o.x - t.x === -2) left = true; else if (o.x - t.x === 2) right = true;
      }
    }
    return !(left && right);
  }
  const shuffleArr = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // assign kinds so that a full solution exists (simulate removal)
  function assignKinds(list, kindCount) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const rem = list.slice(), pairs = [];
      let ok = true;
      while (rem.length) {
        const free = rem.filter((t) => isFree(t, rem));
        if (free.length < 2) { ok = false; break; }
        shuffleArr(free);
        const a = free[0], b = free[1];
        pairs.push([a, b]);
        rem.splice(rem.indexOf(a), 1); rem.splice(rem.indexOf(b), 1);
      }
      if (!ok) continue;
      const kinds = shuffleArr([...Array(36).keys()]).slice(0, kindCount);
      pairs.forEach((p, i) => { const k = kinds[i % kinds.length]; p[0].kind = k; p[1].kind = k; });
      return true;
    }
    return false;
  }

  function buildStage() {
    boardEl.innerHTML = '';
    let list = LAYOUTS[(stage - 1) % LAYOUTS.length]();
    if (list.length % 2) list.pop();
    tiles = list.map((p) => ({ ...p, kind: 0, el: null, alive: true }));
    assignKinds(tiles, Math.min(36, 12 + stage * 6));
    let maxX = 0, maxY = 0;
    tiles.forEach((t) => { maxX = Math.max(maxX, t.x); maxY = Math.max(maxY, t.y); });
    tiles.sort((a, b) => a.l - b.l || a.x - b.x || a.y - b.y);
    tiles.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'tile';
      el.style.left = (t.x * UX + t.l * LX + 6) + 'px';
      el.style.top = (t.y * UY + t.l * LY + 20) + 'px';
      el.style.zIndex = t.l * 1000 + t.x * 10 + (40 - t.y);
      el.innerHTML = kindSvg(t.kind);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(t); });
      t.el = el;
      boardEl.appendChild(el);
    });
    boardEl.style.width = ((maxX + 2) * UX + 30) + 'px';
    boardEl.style.height = ((maxY + 2) * UY + 30) + 'px';
    fit();
    timeMax = timeLeft = Math.max(90, 60 + tiles.length * 1.6 - (stage - 1) * 8);
    selected = null;
    refresh();
  }

  function fit() {
    const w = parseFloat(boardEl.style.width) || 1, h = parseFloat(boardEl.style.height) || 1;
    const s = Math.min((wrap.clientWidth - 8) / w, (wrap.clientHeight - 8) / h, 1.6);
    boardEl.style.transform = `scale(${s}) translate(-50%,-50%)`;
  }
  window.addEventListener('resize', fit);

  const alive = () => tiles.filter((t) => t.alive);
  function freePairs() {
    const al = alive(), free = al.filter((t) => isFree(t, al)), res = [];
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) if (free[i].kind === free[j].kind) res.push([free[i], free[j]]);
    return res;
  }

  function refresh() {
    const al = alive();
    al.forEach((t) => { t.el.classList.toggle('blocked', !isFree(t, al)); });
    $('left').textContent = '残り ' + al.length;
    $('score').textContent = score;
    $('stageNo').textContent = stage;
    $('hintN').textContent = hints; $('shufN').textContent = shuffles;
    $('hintbtn').disabled = !running || hints <= 0;
    $('shufbtn').disabled = !running || shuffles <= 0;
  }

  function setMsg(t) { $('msg').textContent = t; }
  function clearHints() { tiles.forEach((t) => t.el && t.el.classList.remove('hint')); }

  function tap(t) {
    if (!running || !t.alive) return;
    if (!isFree(t, alive())) { t.el.classList.remove('shake'); void t.el.offsetWidth; t.el.classList.add('shake'); beep(160, 0.06); return; }
    if (selected === t) { t.el.classList.remove('sel'); selected = null; return; }
    if (!selected) { selected = t; t.el.classList.add('sel'); beep(520, 0.04); return; }
    if (selected.kind !== t.kind) {
      selected.el.classList.remove('sel'); selected = t; t.el.classList.add('sel'); beep(380, 0.04); return;
    }
    // match!
    const a = selected; selected = null;
    clearHints();
    [a, t].forEach((x) => { x.alive = false; x.el.classList.remove('sel'); x.el.classList.add('gone'); });
    const now = performance.now();
    combo = now - lastMatch < 3500 ? Math.min(combo + 1, 5) : 1;
    lastMatch = now;
    score += 10 * combo;
    if (combo > 1) showCombo('COMBO ×' + combo);
    chord(combo);
    refresh();
    if (alive().length === 0) { stageClear(); return; }
    checkStuck();
  }

  function checkStuck() {
    if (freePairs().length) { setMsg('同じ絵柄をペアで消そう'); return; }
    if (shuffles > 0) setMsg('手づまり！ シャッフルしよう');
    else gameOver('手づまり…');
  }

  function showCombo(t) {
    const c = $('combo'); c.textContent = t; c.classList.add('show');
    clearTimeout(showCombo.tm); showCombo.tm = setTimeout(() => c.classList.remove('show'), 700);
  }

  function doHint() {
    if (!running || hints <= 0) return;
    const p = freePairs();
    if (!p.length) { setMsg('取れるペアがない！ シャッフルしよう'); return; }
    hints--; clearHints();
    p[0].forEach((t) => t.el.classList.add('hint'));
    refresh();
  }

  function doShuffle() {
    if (!running || shuffles <= 0) return;
    shuffles--; clearHints();
    if (selected) { selected.el.classList.remove('sel'); selected = null; }
    const al = alive();
    const kinds = shuffleArr(al.map((t) => t.kind));
    // re-pair remaining tiles so a solution exists, reusing the kinds present
    const pairKinds = []; const cnt = {};
    kinds.forEach((k) => { cnt[k] = (cnt[k] || 0) + 1; });
    Object.keys(cnt).forEach((k) => { for (let i = 0; i < cnt[k] / 2; i++) pairKinds.push(+k); });
    shuffleArr(pairKinds);
    for (let attempt = 0; attempt < 300; attempt++) {
      const rem = al.slice(), pairs = []; let ok = true;
      while (rem.length) {
        const free = shuffleArr(rem.filter((t) => isFree(t, rem)));
        if (free.length < 2) { ok = false; break; }
        pairs.push([free[0], free[1]]); rem.splice(rem.indexOf(free[0]), 1); rem.splice(rem.indexOf(free[1]), 1);
      }
      if (!ok) continue;
      pairs.forEach((p, i) => { p[0].kind = p[1].kind = pairKinds[i]; });
      break;
    }
    al.forEach((t) => { t.el.innerHTML = kindSvg(t.kind); });
    beep(300, 0.08); setTimeout(() => beep(450, 0.08), 80);
    refresh(); checkStuck();
  }

  function stageClear() {
    running = false;
    const bonus = Math.ceil(timeLeft) * 5;
    score += bonus;
    saveBest();
    refresh();
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.12), i * 110));
    showOverlay('ステージ ' + stage + ' クリア！', `残り時間ボーナス <b class="hl">+${bonus}</b><br>スコア ${score}<br>次はもっと絵柄が増えるよ`, '次のステージへ', () => {
      stage++; hints = Math.min(hints + 1, 5); shuffles = Math.min(shuffles + 1, 4); startStage();
    });
  }

  function gameOver(reason) {
    running = false;
    const isBest = saveBest();
    refresh();
    [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.15), i * 150));
    showOverlay('ゲームオーバー', `${reason}<br>ステージ ${stage} ・ スコア <b class="hl">${score}</b>${isBest ? '<br><b class="hl">ハイスコア更新！</b>' : ''}`, 'もう一度あそぶ', newGame);
  }

  function saveBest() {
    if (score > best) {
      best = score; $('best').textContent = best;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* ignore */ }
      return true;
    }
    return false;
  }

  let overlayAction = null;
  function showOverlay(title, html, btn, action) {
    $('ov-title').textContent = title; $('ov-text').innerHTML = html; $('start').textContent = btn;
    document.querySelector('#overlay .keys').style.display = 'none';
    overlayAction = action;
    $('overlay').classList.remove('hide');
  }

  function startStage() {
    $('overlay').classList.add('hide');
    buildStage();
    running = true; combo = 0; lastMatch = 0; $('combo').classList.remove('show');
    lastTick = performance.now();
    setMsg('同じ絵柄をペアで消そう');
    refresh(); checkStuck();
  }
  function newGame() { stage = 1; score = 0; hints = 3; shuffles = 2; startStage(); }
  overlayAction = newGame;

  function tick() {
    const now = performance.now();
    if (running) {
      timeLeft -= (now - lastTick) / 1000;
      if (timeLeft <= 0) { timeLeft = 0; gameOver('時間切れ…'); }
    }
    lastTick = now;
    const f = $('timefill');
    f.style.width = (100 * timeLeft / timeMax) + '%';
    f.classList.toggle('low', timeLeft < 20);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  $('start').addEventListener('click', () => { ensureAudio(); overlayAction && overlayAction(); });
  $('hintbtn').addEventListener('click', doHint);
  $('shufbtn').addEventListener('click', doShuffle);
  window.addEventListener('keydown', (e) => {
    if (!$('overlay').classList.contains('hide')) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('start').click(); }
      return;
    }
    if (e.key === 'h' || e.key === 'H') doHint();
    if (e.key === 's' || e.key === 'S') doShuffle();
  });

  // ---- sound ----
  let ac = null;
  function ensureAudio() {
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; }
  }
  function beep(freq, dur) {
    if (!ac) return;
    try {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.12, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur + 0.05);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur + 0.06);
    } catch (e) { /* ignore */ }
  }
  function chord(c) { const base = 520 + c * 60; beep(base, 0.08); setTimeout(() => beep(base * 1.5, 0.1), 60); }

  // initial preview board behind the title
  buildStage(); running = false; refresh();
})();
