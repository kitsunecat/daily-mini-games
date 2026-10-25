// ランタン守りの夜 — 夜明けまで生き延びるサバイバー系アクション
(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  let W = 0, H = 0, DPR = 1, zoom = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    zoom = clamp(Math.min(W, H) / 620, 0.55, 1.25);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- 状態 ----------
  let state = 'title'; // title / play

  // ---------- 画面遷移 ----------
  function hideOverlays() {
    for (const id of ['title']) $(id).classList.add('hidden');
  }
  function startGame() {
    hideOverlays();
    state = 'play';
  }

  $('startBtn').addEventListener('click', startGame);
})();
