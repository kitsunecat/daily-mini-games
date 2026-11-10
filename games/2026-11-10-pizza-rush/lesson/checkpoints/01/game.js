(() => {
  'use strict';
  const W = 360, H = 600;
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const $ = (id) => document.getElementById(id);
  const elCoins = $('coins'), elScore = $('score'), elBest = $('best'), elMiss = $('miss');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), btn = $('start');

  // ---------- layout ----------
  const COUNTER_Y = 120, COUNTER_H = 26;
  const SLOTS = [90, 180, 270];
  const OVEN_X = [70, 180, 290];
  const OVEN_Y = 528;

  // ---------- state ----------
  let running = false;

  // ---------- sizing ----------
  function resize() {
    const r = stage.getBoundingClientRect();
    const s = Math.max(0.3, Math.min((r.width - 16) / W, (r.height - 8) / H));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.style.width = Math.floor(W * s) + 'px';
    cv.style.height = Math.floor(H * s) + 'px';
    cv.width = Math.floor(W * s * dpr);
    cv.height = Math.floor(H * s * dpr);
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    if (!running) draw();
  }
  addEventListener('resize', resize);

  // ---------- game flow ----------
  function start() {
    running = true;
    overlay.classList.add('hidden');
  }
  btn.addEventListener('click', start);

  // ---------- drawing ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawFloor() {
    // street
    ctx.fillStyle = '#9fb3c4'; ctx.fillRect(0, 0, W, COUNTER_Y);
    ctx.fillStyle = '#b2c4d3';
    for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 20, COUNTER_Y);
    // kitchen tiles
    for (let y = COUNTER_Y; y < H; y += 30) {
      for (let x = 0; x < W; x += 30) {
        ctx.fillStyle = ((x + y) / 30) % 2 === 0 ? '#f1e2c6' : '#e5cfa9';
        ctx.fillRect(x, y, 30, 30);
      }
    }
    // counter
    ctx.fillStyle = '#7a3e1f'; rr(24, COUNTER_Y, W - 48, COUNTER_H, 6); ctx.fill();
    ctx.fillStyle = '#a65a2e'; rr(24, COUNTER_Y, W - 48, 10, 5); ctx.fill();
    SLOTS.forEach((x) => { ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(x - 30, COUNTER_Y + 13, 60, 9, 4); ctx.fill(); });
    // serve zone hint
    ctx.fillStyle = 'rgba(255,190,80,.18)';
    ctx.fillRect(30, COUNTER_Y + COUNTER_H, W - 60, 48);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawFloor();
    // counter front edge over customers' legs
    ctx.fillStyle = '#7a3e1f'; rr(24, COUNTER_Y + 10, W - 48, COUNTER_H - 10, 4); ctx.fill();
  }

  resize();
})();
