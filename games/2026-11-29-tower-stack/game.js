(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const $score = document.getElementById('score');
  const $combo = document.getElementById('combo');
  const $best = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');
  const toast = document.getElementById('toast');

  const BASE = 100;      // base block size
  const BH = 22;         // block height
  const RANGE = 150;     // slide range from center
  const PERFECT = 4;     // tolerance
  const KEY = 'tower-stack-best';
  const C30 = Math.cos(Math.PI / 6), S30 = 0.5;

  let W = 0, H = 0, DPR = 1, baseScale = 1, scale = 1;
  let best = 0;
  try { best = parseInt(localStorage.getItem(KEY), 10) || 0; } catch (e) { best = 0; }
  $best.textContent = best;

  let stack = [], cur = null, debris = [], flashes = [];
  let state = 'title'; // title | play | over
  let score = 0, combo = 0, camY = 0, hue0 = 0, toastT = 0, last = 0;

  // ---------- audio ----------
  let ac = null;
  function tone(freq, dur, type, vol) {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.06, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    baseScale = Math.min(W * 0.5 / (BASE * 2 * C30), H * 0.42 / (BASE + BH * 3));
    if (state !== 'over') scale = baseScale;
  }
  window.addEventListener('resize', resize);

  const color = (i, l) => 'hsl(' + ((hue0 + i * 9) % 360) + ',70%,' + l + '%)';

  function reset() {
    hue0 = Math.floor(Math.random() * 360);
    stack = [{ x: -BASE / 2, z: -BASE / 2, w: BASE, d: BASE, y: -BH * 4, h: BH * 4, i: 0 }];
    debris = []; flashes = [];
    score = 0; combo = 0; camY = 0; scale = baseScale;
    $score.textContent = 0; $combo.textContent = 0;
    spawn();
  }

  function spawn() {
    const top = stack[stack.length - 1];
    const n = stack.length;
    const axis = n % 2 ? 'x' : 'z';
    cur = { x: top.x, z: top.z, w: top.w, d: top.d, y: top.y + top.h, h: BH, i: n, axis, dir: 1, speed: Math.min(130 + n * 5, 330) };
    const from = Math.random() < 0.5 ? -1 : 1;
    cur[axis] = top[axis] + from * RANGE;
    cur.dir = -from;
  }

  function place() {
    if (state !== 'play' || !cur) return;
    const top = stack[stack.length - 1];
    const ax = cur.axis, sz = ax === 'x' ? 'w' : 'd';
    const delta = cur[ax] - top[ax];
    const overlap = top[sz] - Math.abs(delta);
    if (overlap <= 0) {
      debris.push(Object.assign({}, cur, { vy: 0, a: 1 }));
      cur = null;
      gameOver();
      return;
    }
    let placed;
    if (Math.abs(delta) <= PERFECT) {
      placed = Object.assign({}, cur, { x: top.x, z: top.z });
      combo++;
      if (combo >= 3) {
        const grow = Math.min(8, BASE - placed[sz]);
        if (grow > 0) { placed[sz] += grow; placed[ax] -= grow / 2; }
      }
      flashes.push({ b: placed, t: 0 });
      tone(440 * Math.pow(2, Math.min(combo, 12) / 12), 0.18, 'triangle', 0.07);
      showToast(combo >= 3 ? 'ぴったり ×' + combo + '！ 大きくなった' : 'ぴったり！' + (combo > 1 ? ' ×' + combo : ''));
    } else {
      combo = 0;
      placed = Object.assign({}, cur);
      placed[sz] = overlap;
      const piece = Object.assign({}, cur, { vy: 0, a: 1 });
      if (delta > 0) {
        placed[ax] = cur[ax];
        piece[ax] = top[ax] + top[sz];
        piece[sz] = delta;
      } else {
        placed[ax] = top[ax];
        piece[ax] = cur[ax];
        piece[sz] = -delta;
      }
      debris.push(piece);
      tone(260, 0.1, 'square', 0.04);
    }
    delete placed.dir; delete placed.speed;
    stack.push(placed);
    score++;
    $score.textContent = score;
    $combo.textContent = combo;
    spawn();
  }

  function showToast(t) { toast.textContent = t; toast.classList.add('show'); toastT = 1.0; }

  function update(dt) {
    if (state === 'play' && cur) {
      const top = stack[stack.length - 1];
      const ax = cur.axis;
      cur[ax] += cur.dir * cur.speed * dt;
      const off = cur[ax] - top[ax];
      if (off > RANGE) { cur[ax] = top[ax] + RANGE; cur.dir = -1; }
      if (off < -RANGE) { cur[ax] = top[ax] - RANGE; cur.dir = 1; }
    }
    for (const d of debris) { d.vy += 900 * dt; d.y -= d.vy * dt; d.a -= dt * 0.9; }
    debris = debris.filter(d => d.a > 0);
    for (const f of flashes) f.t += dt;
    flashes = flashes.filter(f => f.t < 0.5);
    const topY = stack[stack.length - 1].y + BH;
    if (state === 'over') {
      // zoom out to show the whole tower
      const towerH = topY + BH * 4;
      const fit = Math.min(baseScale, H * 0.7 / (towerH + BASE));
      scale += (fit - scale) * Math.min(1, dt * 3);
      camY += ((topY - BH * 4) / 2 - camY) * Math.min(1, dt * 3);
    } else {
      camY += (Math.max(0, topY - BH * 2) - camY) * Math.min(1, dt * 6);
    }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast.classList.remove('show'); }
  }

  // ---------- draw ----------
  function P(x, y, z) {
    return [W / 2 + (x - z) * C30 * scale, H * 0.6 + (x + z) * S30 * scale - (y - camY) * scale];
  }
  function poly(pts, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
  }
  function box(b, alpha) {
    const { x, y, z, w, d, h } = b;
    ctx.globalAlpha = alpha == null ? 1 : Math.max(0, alpha);
    const t = y + h;
    poly([P(x, y, z + d), P(x + w, y, z + d), P(x + w, t, z + d), P(x, t, z + d)], color(b.i, 42)); // front-left (+z)
    poly([P(x + w, y, z), P(x + w, y, z + d), P(x + w, t, z + d), P(x + w, t, z)], color(b.i, 52)); // front-right (+x)
    poly([P(x, t, z), P(x + w, t, z), P(x + w, t, z + d), P(x, t, z + d)], color(b.i, 66)); // top
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const lv = stack.length;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'hsl(' + ((hue0 + lv * 9 + 180) % 360) + ',45%,22%)');
    g.addColorStop(1, 'hsl(' + ((hue0 + lv * 9 + 220) % 360) + ',40%,12%)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const behind = debris.filter(d => d.x + d.w / 2 + d.z + d.d / 2 < 0);
    const front = debris.filter(d => d.x + d.w / 2 + d.z + d.d / 2 >= 0);
    for (const d of behind) box(d, d.a);
    for (const b of stack) {
      const p = P(0, b.y + b.h, 0);
      if (p[1] > H + 400 * scale) continue;
      box(b);
    }
    if (cur) box(cur);
    for (const d of front) box(d, d.a);
    for (const f of flashes) {
      const b = f.b, e = 4 + f.t * 40, t = b.y + b.h;
      ctx.globalAlpha = 1 - f.t / 0.5;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      const pts = [P(b.x - e, t, b.z - e), P(b.x + b.w + e, t, b.z - e), P(b.x + b.w + e, t, b.z + b.d + e), P(b.x - e, t, b.z + b.d + e)];
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (state === 'play') {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = 'bold 56px system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(score), W / 2, 76);
    }
  }

  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hide');
    tone(523, 0.1, 'triangle', 0.05);
  }

  function gameOver() {
    state = 'over';
    let nb = false;
    if (score > best) { best = score; nb = true; try { localStorage.setItem(KEY, String(best)); } catch (e) { /* ignore */ } }
    $best.textContent = best;
    tone(180, 0.4, 'sawtooth', 0.05);
    ovTitle.textContent = 'ゲームオーバー';
    ovText.innerHTML = '<b class="hl">' + score + '</b> 段まで積み上げた！' + (nb ? '<br><b class="hl">ハイスコア更新！</b>' : '<br>ベスト ' + best + ' 段');
    startBtn.textContent = 'もう一度';
    setTimeout(() => { if (state === 'over') overlay.classList.remove('hide'); }, 1200);
  }

  stage.addEventListener('pointerdown', e => {
    if (overlay.contains(e.target)) return;
    e.preventDefault();
    place();
  });
  window.addEventListener('keydown', e => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (e.repeat) return;
    if (state === 'play') place();
    else if (!overlay.classList.contains('hide')) start();
  });
  startBtn.addEventListener('click', start);

  resize();
  reset();
  requestAnimationFrame(loop);
})();
