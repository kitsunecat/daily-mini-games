(() => {
  'use strict';
  const W = 360, H = 600;           // 論理サイズ
  const M = 16;                     // コースの外枠
  const BALL_R = 7, CUP_R = 11;
  const MAX_SPEED = 950, MAX_PULL = 150;
  const START_BALLS = 10;
  const BEST_KEY = 'pocket-putt-best';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  const ui = {
    hole: $('hole'), balls: $('balls'), score: $('score'), best: $('best'),
    par: $('par'), strokes: $('strokes'), overlay: $('overlay'),
    title: $('ov-title'), text: $('ov-text'), start: $('start'), toast: $('toast'),
  };

  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
  ui.best.textContent = best;

  // ---------- 音 ----------
  let ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  function noise(dur, vol = 0.2) {
    const a = audio(); if (!a) return;
    const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    s.buffer = buf; g.gain.value = vol; s.connect(f).connect(g).connect(a.destination); s.start();
  }
  const sfx = {
    hit: p => tone(300 + p * 500, 0.08, 'triangle', 0.2),
    wall: () => tone(180, 0.05, 'square', 0.06),
    cup: () => { tone(520, 0.12, 'sine', 0.2); setTimeout(() => tone(780, 0.18, 'sine', 0.2), 110); },
    splash: () => noise(0.4, 0.25),
    over: () => tone(330, 0.5, 'sawtooth', 0.1, -200),
  };

  // ---------- 乱数 ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));

  // ---------- 状態 ----------
  let state = 'title';   // title | aim | roll | sink | over
  let hole = 1, balls = START_BALLS, score = 0, strokes = 0, par = 2;
  let course = null;
  const ball = { x: 0, y: 0, vx: 0, vy: 0, lastX: 0, lastY: 0, scale: 1 };
  let aim = { active: false, sx: 0, sy: 0, dx: 0, dy: 0 };
  let keyAim = { angle: -Math.PI / 2, power: 0.5, shown: false };
  let ripples = [], time = 0, sinkT = 0;

  function overlap(a, b, pad = 0) {
    return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
  }
  function circleRectFree(cx, cy, r, rects) {
    return rects.every(q => {
      const nx = Math.max(q.x, Math.min(cx, q.x + q.w)), ny = Math.max(q.y, Math.min(cy, q.y + q.h));
      return (cx - nx) ** 2 + (cy - ny) ** 2 > r * r;
    });
  }

  function makeCourse(n) {
    const c = { walls: [], water: [], sand: [], movers: [] };
    c.tee = { x: rnd(M + 50, W - M - 50), y: H - M - 50 };
    c.cup = { x: rnd(M + 40, W - M - 40), y: rnd(M + 50, M + 120) };
    const keepOut = [
      { x: c.tee.x - 34, y: c.tee.y - 34, w: 68, h: 68 },
      { x: c.cup.x - 30, y: c.cup.y - 30, w: 60, h: 60 },
    ];
    const all = [];
    function place(kind, count, wMin, wMax, hMin, hMax) {
      for (let i = 0, tries = 0; i < count && tries < 200; tries++) {
        const w = rnd(wMin, wMax), h = rnd(hMin, hMax);
        const r = { x: rnd(M, W - M - w), y: rnd(M + 30, H - M - 90 - h), w, h };
        if (keepOut.some(k => overlap(k, r))) continue;
        if (all.some(k => overlap(k, r, 18))) continue;
        all.push(r); c[kind].push(r); i++;
      }
    }
    const lv = Math.min(n, 12);
    place('walls', 1 + Math.floor(lv / 2), 50, 150, 14, 22);
    if (n >= 2) place('walls', Math.floor(lv / 4), 14, 22, 60, 130);
    if (n >= 3) place('sand', 1 + Math.floor(lv / 5), 60, 110, 40, 70);
    if (n >= 4) place('water', 1 + Math.floor(lv / 6), 60, 120, 36, 60);
    if (n >= 5) {
      const count = n >= 9 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const w = rnd(60, 90), y = rnd(170, 400);
        const m = { x: M, y, w, h: 14, min: M, max: W - M - w, speed: rnd(50, 90) * (Math.random() < .5 ? -1 : 1) };
        if (all.some(k => overlap(k, { x: M, y: y - 10, w: W - 2 * M, h: 34 }))) continue;
        m.x = rnd(m.min, m.max); c.movers.push(m); all.push({ x: M, y: y - 10, w: W - 2 * M, h: 34 });
      }
    }
    c.par = 2 + (n >= 3 ? 1 : 0) + (n >= 7 && c.water.length + c.walls.length >= 6 ? 1 : 0);
    return c;
  }

  function startHole() {
    course = makeCourse(hole);
    par = course.par; strokes = 0;
    ball.x = ball.lastX = course.tee.x; ball.y = ball.lastY = course.tee.y;
    ball.vx = ball.vy = 0; ball.scale = 1;
    keyAim.angle = Math.atan2(course.cup.y - ball.y, course.cup.x - ball.x);
    state = 'aim';
    updateHud();
  }

  function newGame() {
    hole = 1; balls = START_BALLS; score = 0;
    ui.overlay.classList.add('hide');
    audio();
    startHole();
  }

  function updateHud() {
    ui.hole.textContent = hole; ui.balls.textContent = balls; ui.score.textContent = score;
    ui.par.textContent = 'PAR ' + par; ui.strokes.textContent = '今の打数 ' + strokes;
    ui.balls.style.color = balls <= 2 ? '#ff8a7a' : '';
  }

  let toastTimer = 0;
  function toast(msg) {
    ui.toast.textContent = msg; ui.toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1100);
  }

  function shoot(dx, dy, power) {
    if (state !== 'aim' || balls <= 0) return;
    const len = Math.hypot(dx, dy) || 1;
    const sp = Math.pow(power, 1.6) * MAX_SPEED; // 弱いパットを細かく調整できるように
    ball.vx = dx / len * sp; ball.vy = dy / len * sp;
    ball.lastX = ball.x; ball.lastY = ball.y;
    balls--; strokes++;
    state = 'roll';
    sfx.hit(power);
    updateHud();
  }

  function sinkName(s, p) {
    if (s === 1) return 'ホールインワン！';
    const d = s - p;
    return { '-3': 'アルバトロス！', '-2': 'イーグル！', '-1': 'バーディー！', '0': 'パー', '1': 'ボギー', '2': 'ダブルボギー' }[d] || (d < 0 ? 'すごい！' : 'カップイン');
  }

  function onSink() {
    state = 'sink'; sinkT = 0;
    sfx.cup();
    const refund = par - 1 + (strokes === 1 ? 2 : 0);
    balls += refund;
    const pts = Math.max(20, 100 + (par - strokes) * 60) + (strokes === 1 ? 200 : 0);
    score += pts;
    toast(sinkName(strokes, par) + ' +' + pts);
    updateHud();
    setTimeout(() => { hole++; startHole(); }, 1300);
  }

  function gameOver() {
    state = 'over'; sfx.over();
    let isBest = false;
    if (score > best) {
      best = score; isBest = true;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* 保存できなくても続行 */ }
    }
    ui.best.textContent = best;
    ui.title.textContent = 'ゲームオーバー';
    ui.text.innerHTML = `ホール ${hole} で打ち切り<br>スコア <b class="hl">${score}</b>${isBest ? '<br><b class="hl">ハイスコア更新！</b>' : ''}<br>ベスト ${best}`;
    ui.start.textContent = 'もう一度';
    ui.overlay.classList.remove('hide');
  }

  // ---------- 物理 ----------
  function inRect(x, y, r) { return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h; }

  function collideRect(q, bounce) {
    const nx = Math.max(q.x, Math.min(ball.x, q.x + q.w)), ny = Math.max(q.y, Math.min(ball.y, q.y + q.h));
    let dx = ball.x - nx, dy = ball.y - ny, d2 = dx * dx + dy * dy;
    if (d2 >= BALL_R * BALL_R) return false;
    let d = Math.sqrt(d2);
    if (d < 1e-6) { // 中心が中に入った：一番近い辺へ押し出す
      const opts = [[ball.x - q.x, -1, 0], [q.x + q.w - ball.x, 1, 0], [ball.y - q.y, 0, -1], [q.y + q.h - ball.y, 0, 1]];
      opts.sort((a, b) => a[0] - b[0]);
      dx = opts[0][1]; dy = opts[0][2]; d = 1;
      ball.x += dx * (opts[0][0] + BALL_R); ball.y += dy * (opts[0][0] + BALL_R);
    } else {
      dx /= d; dy /= d;
      ball.x = nx + dx * BALL_R; ball.y = ny + dy * BALL_R;
    }
    const vn = ball.vx * dx + ball.vy * dy;
    if (vn < 0) {
      ball.vx -= (1 + bounce) * vn * dx; ball.vy -= (1 + bounce) * vn * dy;
      if (-vn > 60) sfx.wall();
    }
    if (q.speed && state === 'roll') { ball.vx += q.speed * 0.1; }
    return true;
  }

  function step(dt) {
    time += dt;
    for (const m of course ? course.movers : []) {
      m.x += m.speed * dt;
      if (m.x < m.min) { m.x = m.min; m.speed *= -1; }
      if (m.x > m.max) { m.x = m.max; m.speed *= -1; }
    }
    ripples = ripples.filter(r => (r.t += dt) < 0.8);

    if (state === 'sink') {
      sinkT += dt;
      ball.x += (course.cup.x - ball.x) * Math.min(1, dt * 12);
      ball.y += (course.cup.y - ball.y) * Math.min(1, dt * 12);
      ball.scale = Math.max(0, 1 - sinkT * 3);
      return;
    }
    if (state === 'aim' && course) {   // 止まっているボールを動く壁が押す
      for (const m of course.movers) if (collideRect(m, 0)) { ball.vx = ball.vy = 0; }
      ball.x = Math.max(M + BALL_R, Math.min(W - M - BALL_R, ball.x));
    }
    if (state !== 'roll') return;

    const sub = 6, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const inSand = course.sand.some(s => inRect(ball.x, ball.y, s));
      const fr = inSand ? 3.2 : 0.95;               // 指数減衰
      const k = Math.exp(-fr * h);
      ball.vx *= k; ball.vy *= k;
      const sp = Math.hypot(ball.vx, ball.vy);
      if (sp > 0) {                                  // 一定の転がり抵抗
        const dec = Math.min(sp, (inSand ? 260 : 70) * h);
        ball.vx -= ball.vx / sp * dec; ball.vy -= ball.vy / sp * dec;
      }
      ball.x += ball.vx * h; ball.y += ball.vy * h;

      // 外枠
      if (ball.x < M + BALL_R) { ball.x = M + BALL_R; ball.vx = Math.abs(ball.vx) * 0.8; sfx.wall(); }
      if (ball.x > W - M - BALL_R) { ball.x = W - M - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.8; sfx.wall(); }
      if (ball.y < M + BALL_R) { ball.y = M + BALL_R; ball.vy = Math.abs(ball.vy) * 0.8; sfx.wall(); }
      if (ball.y > H - M - BALL_R) { ball.y = H - M - BALL_R; ball.vy = -Math.abs(ball.vy) * 0.8; sfx.wall(); }
      for (const w of course.walls) collideRect(w, 0.8);
      for (const m of course.movers) collideRect(m, 0.9);

      // カップ
      const cdx = course.cup.x - ball.x, cdy = course.cup.y - ball.y, cd = Math.hypot(cdx, cdy);
      const v = Math.hypot(ball.vx, ball.vy);
      if (cd < CUP_R) {
        if (v < 430) { onSink(); return; }
        ball.vx += cdx / cd * 900 * h; ball.vy += cdy / cd * 900 * h; // ふちで少し曲がる
      }

      // 池
      if (course.water.some(wt => inRect(ball.x, ball.y, wt))) {
        ripples.push({ x: ball.x, y: ball.y, t: 0 });
        sfx.splash();
        ball.x = ball.lastX; ball.y = ball.lastY; ball.vx = ball.vy = 0;
        balls--; strokes++;
        toast('池ポチャ！ 1打罰');
        updateHud();
        endRoll();
        return;
      }
    }
    if (Math.hypot(ball.vx, ball.vy) < 6) { ball.vx = ball.vy = 0; endRoll(); }
  }

  function endRoll() {
    // 動く壁に重なって止まったら少しずらす
    if (!circleRectFree(ball.x, ball.y, BALL_R, course.movers)) ball.y += BALL_R * 2.5;
    if (balls <= 0) { state = 'over-wait'; setTimeout(gameOver, 500); return; }
    state = 'aim';
  }

  // ---------- 描画 ----------
  function rrect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function wallRect(q, col1, col2) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; rrect(q.x + 2, q.y + 4, q.w, q.h, 5); ctx.fill();
    const g = ctx.createLinearGradient(0, q.y, 0, q.y + q.h); g.addColorStop(0, col1); g.addColorStop(1, col2);
    ctx.fillStyle = g; rrect(q.x, q.y, q.w, q.h, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(q.x + 4, q.y + 2.5); ctx.lineTo(q.x + q.w - 4, q.y + 2.5); ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 外枠（木）
    ctx.fillStyle = '#7a4b25'; rrect(0, 0, W, H, 14); ctx.fill();
    ctx.fillStyle = '#a5683a'; rrect(4, 4, W - 8, H - 8, 11); ctx.fill();
    // 芝
    ctx.save(); rrect(M, M, W - 2 * M, H - 2 * M, 6); ctx.clip();
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? '#3a9a50' : '#349148';
      ctx.fillRect(M, M + i * (H - 2 * M) / 14, W - 2 * M, (H - 2 * M) / 14 + 1);
    }
    if (course) {
      for (const s of course.sand) {
        ctx.fillStyle = '#e8d39a'; rrect(s.x, s.y, s.w, s.h, 18); ctx.fill();
        ctx.fillStyle = 'rgba(160,120,60,.35)';
        for (let i = 0; i < s.w * s.h / 120; i++) {
          const px = s.x + 6 + ((i * 37) % (s.w - 12)), py = s.y + 6 + ((i * 53) % (s.h - 12));
          ctx.fillRect(px, py, 2, 2);
        }
      }
      for (const wt of course.water) {
        ctx.fillStyle = '#2d7fd0'; rrect(wt.x, wt.y, wt.w, wt.h, 16); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
        for (let j = 0; j < 2; j++) {
          const yy = wt.y + wt.h * (0.35 + j * 0.3);
          ctx.beginPath();
          for (let xx = wt.x + 12; xx < wt.x + wt.w - 12; xx += 4) {
            const y2 = yy + Math.sin(xx * 0.15 + time * 3 + j) * 2;
            xx === wt.x + 12 ? ctx.moveTo(xx, y2) : ctx.lineTo(xx, y2);
          }
          ctx.stroke();
        }
      }
      // ティー
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.arc(course.tee.x, course.tee.y, 16, 0, Math.PI * 2); ctx.fill();
      // カップ
      const c = course.cup;
      ctx.fillStyle = '#2a7a3c'; ctx.beginPath(); ctx.arc(c.x, c.y, CUP_R + 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(c.x, c.y, CUP_R, 0, Math.PI * 2); ctx.fill();
      for (const w of course.walls) wallRect(w, '#c98a4f', '#8d5528');
      for (const m of course.movers) wallRect(m, '#e46b5f', '#a63a32');
      for (const r of ripples) {
        ctx.strokeStyle = `rgba(255,255,255,${1 - r.t / 0.8})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(r.x, r.y, 6 + r.t * 30, 0, Math.PI * 2); ctx.stroke();
      }
      // ボール
      if (ball.scale > 0) {
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath(); ctx.arc(ball.x + 2, ball.y + 3, BALL_R * ball.scale, 0, Math.PI * 2); ctx.fill();
        const g = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, BALL_R);
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#cfd6dc');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R * ball.scale, 0, Math.PI * 2); ctx.fill();
      }
      // 旗
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - 42); ctx.stroke();
      const wave = Math.sin(time * 4) * 3;
      ctx.fillStyle = '#ff5a4f';
      ctx.beginPath(); ctx.moveTo(c.x, c.y - 42); ctx.lineTo(c.x + 24, c.y - 35 + wave); ctx.lineTo(c.x, c.y - 28); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(hole, c.x + 9, c.y - 32 + wave / 2);

      if (state === 'aim') drawAim();
    }
    ctx.restore();
  }

  function currentAim() {
    if (aim.active) {
      const dx = aim.sx - aim.dx, dy = aim.sy - aim.dy, len = Math.hypot(dx, dy);
      return { dx, dy, power: Math.min(1, len / MAX_PULL), ok: len > 8 };
    }
    if (keyAim.shown) return { dx: Math.cos(keyAim.angle), dy: Math.sin(keyAim.angle), power: keyAim.power, ok: true };
    return null;
  }

  function drawAim() {
    const a = currentAim();
    if (!a) {
      // 待機中のガイド
      const p = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + p * 0.4})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R + 6 + p * 4, 0, Math.PI * 2); ctx.stroke();
      return;
    }
    if (!a.ok) return;
    const len = Math.hypot(a.dx, a.dy) || 1, ux = a.dx / len, uy = a.dy / len;
    const L = 30 + a.power * 150;
    const col = a.power < 0.5 ? `rgb(${Math.round(120 + a.power * 270)},230,90)` : `rgb(255,${Math.round(230 - (a.power - 0.5) * 360)},70)`;
    ctx.fillStyle = col;
    for (let d = BALL_R + 8; d < L; d += 11) {
      ctx.globalAlpha = 1 - d / (L + 30);
      ctx.beginPath(); ctx.arc(ball.x + ux * d, ball.y + uy * d, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 引っぱり側の線
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ball.x - ux * a.power * 50, ball.y - uy * a.power * 50); ctx.stroke();
    // パワーバー
    const bx = W - M - 14, by = H - M - 110;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rrect(bx, by, 8, 100, 4); ctx.fill();
    ctx.fillStyle = col; rrect(bx, by + 100 * (1 - a.power), 8, 100 * a.power, 4); ctx.fill();
  }

  // ---------- 入力 ----------
  function toLogical(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  cv.addEventListener('pointerdown', e => {
    if (state !== 'aim') return;
    e.preventDefault(); audio();
    const p = toLogical(e);
    aim = { active: true, sx: p.x, sy: p.y, dx: p.x, dy: p.y };
    keyAim.shown = false;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  });
  cv.addEventListener('pointermove', e => {
    if (!aim.active) return;
    const p = toLogical(e); aim.dx = p.x; aim.dy = p.y;
  });
  function release() {
    if (!aim.active) return;
    const a = currentAim(); aim.active = false;
    if (a && a.ok && a.power > 0.06) shoot(a.dx, a.dy, a.power);
  }
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', () => { aim.active = false; });

  window.addEventListener('keydown', e => {
    if (state === 'title' || state === 'over') {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); newGame(); }
      return;
    }
    if (state !== 'aim') return;
    const k = e.key;
    if (k === 'ArrowLeft') { keyAim.angle -= e.shiftKey ? 0.12 : 0.04; keyAim.shown = true; e.preventDefault(); }
    else if (k === 'ArrowRight') { keyAim.angle += e.shiftKey ? 0.12 : 0.04; keyAim.shown = true; e.preventDefault(); }
    else if (k === 'ArrowUp') { keyAim.power = Math.min(1, keyAim.power + 0.05); keyAim.shown = true; e.preventDefault(); }
    else if (k === 'ArrowDown') { keyAim.power = Math.max(0.08, keyAim.power - 0.05); keyAim.shown = true; e.preventDefault(); }
    else if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      if (!keyAim.shown) { keyAim.shown = true; return; }
      shoot(Math.cos(keyAim.angle), Math.sin(keyAim.angle), keyAim.power);
    }
  });

  ui.start.addEventListener('click', newGame);
  ui.overlay.addEventListener('pointerdown', e => { if (e.target === ui.overlay) newGame(); });

  // ---------- サイズ ----------
  function resize() {
    const stage = $('stage');
    const aw = stage.clientWidth - 16, ah = stage.clientHeight - 8;
    const s = Math.max(0.3, Math.min(aw / W, ah / H));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px';
    cv.width = Math.round(W * s * dpr); cv.height = Math.round(H * s * dpr);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // タイトル背景用のコース
  course = makeCourse(4);
  ball.x = course.tee.x; ball.y = course.tee.y;

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    step(dt); draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
