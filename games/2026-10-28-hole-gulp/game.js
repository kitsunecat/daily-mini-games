import * as THREE from './lib/three.module.min.js';

const cv = document.getElementById('cv');
const stage = document.getElementById('stage');
const stickEl = document.getElementById('stick');
const knobEl = document.getElementById('knob');
const timeEl = document.getElementById('time');
const sizeEl = document.getElementById('size');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const popEl = document.getElementById('pop');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ov-title');
const ovText = document.getElementById('ov-text');
const startBtn = document.getElementById('start');

const BEST_KEY = 'hole-gulp-best';
const GAME_TIME = 45;
const WORLD_W = 3200, WORLD_H = 3200;
const BLOCK = 400, ROAD = 64;
// 飲みこんだ物の大きさ（s×s）にこの係数をかけた分だけ穴の面積が増える
const GROW = 0.18;
// 穴の半径がこの値を超えるごとにサイズアップ
const LEVELS = [0, 28, 40, 56, 78, 105, 140, 190, 250];

// 物の種類：s は半径の目安（これより穴が大きければ飲みこめる）
const KINDS = {
  cone:     { s: 6,   value: 1   },
  person:   { s: 7,   value: 2   },
  bin:      { s: 9,   value: 2   },
  bench:    { s: 12,  value: 3   },
  tree:     { s: 16,  value: 5   },
  car:      { s: 22,  value: 10  },
  bus:      { s: 32,  value: 18  },
  house:    { s: 44,  value: 30  },
  building: { s: 66,  value: 60  },
  tower:    { s: 95,  value: 120 },
};
const SHIRT_COLORS = ['#e94f4f', '#3f8cff', '#2ec4b6', '#9b5de5', '#f28c28'];
const CAR_COLORS = ['#e94f4f', '#3f8cff', '#f5f5f5', '#2ec4b6', '#9b5de5'];
const ROOF_COLORS = ['#d9534f', '#5b8def', '#e0a43a', '#6cbf6c'];
const BLD_COLORS = ['#8d99ae', '#a3b1c6', '#c8b6a2', '#9fc4b0'];
const LEAF_COLORS = ['#3fae5a', '#4cbf62', '#2f9a4c'];

let W = 1, H = 1;
let state = 'title';
let hole, objects, eating;
let score = 0, best = 0, timeLeft = GAME_TIME, level = 1;
const cam = { x: 0, y: 0, dist: 600 };
let lastT = 0;
const input = { dx: 0, dy: 0, active: false, sx: 0, sy: 0 };
const keys = {};

try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
bestEl.textContent = best;

// ---------- サウンド（Web Audio で生成） ----------
let actx = null;
function audio() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}
const gulpSound = (s) => tone(900 - Math.min(700, s * 7), 0.18, 'triangle', 0.1, 0.45);
const levelSound = () => { tone(523, 0.12, 'square', 0.07); setTimeout(() => tone(784, 0.2, 'square', 0.07), 110); };

// ---------- 3D の準備 ----------
// 街の x,y 座標は 3D では x,z（y が高さ）
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#8fc7e8');
scene.fog = new THREE.Fog('#8fc7e8', 800, 2000);
const camera = new THREE.PerspectiveCamera(45, 1, 5, 20000);
const PITCH = 50 * Math.PI / 180;

scene.add(new THREE.HemisphereLight('#e8f6ff', '#5d7a52', 1.6));
const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
sun.position.set(-0.6, 1.4, 0.8);
scene.add(sun);

// 穴の上だけ地面を描かない（discard）ようにするマテリアル
const holeUniform = { value: new THREE.Vector3(0, 0, 0) };
function holeCutMaterial(params) {
  const m = new THREE.MeshLambertMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHole = holeUniform;
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform vec3 uHole;\nvarying vec3 vWPos;\n' + sh.fragmentShader.replace(
      'void main() {',
      'void main() {\nif (distance(vWPos.xz, uHole.xy) < uHole.z) discard;');
  };
  return m;
}

// 地面（道路はキャンバスに描いてテクスチャにする）
function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 2048;
  const g = c.getContext('2d');
  const k = c.width / WORLD_W;
  g.scale(k, k);
  g.fillStyle = '#9ccc8a';
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  g.fillStyle = '#c9c2b0';
  for (let x = 0; x <= WORLD_W; x += BLOCK) g.fillRect(x - ROAD / 2 - 8, 0, ROAD + 16, WORLD_H);
  for (let y = 0; y <= WORLD_H; y += BLOCK) g.fillRect(0, y - ROAD / 2 - 8, WORLD_W, ROAD + 16);
  g.fillStyle = '#4b5563';
  for (let x = 0; x <= WORLD_W; x += BLOCK) g.fillRect(x - ROAD / 2, 0, ROAD, WORLD_H);
  for (let y = 0; y <= WORLD_H; y += BLOCK) g.fillRect(0, y - ROAD / 2, WORLD_W, ROAD);
  g.strokeStyle = 'rgba(255,255,255,.6)';
  g.lineWidth = 4;
  g.setLineDash([24, 20]);
  g.beginPath();
  for (let x = 0; x <= WORLD_W; x += BLOCK) { g.moveTo(x, 0); g.lineTo(x, WORLD_H); }
  for (let y = 0; y <= WORLD_H; y += BLOCK) { g.moveTo(0, y); g.lineTo(WORLD_W, y); }
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_H), holeCutMaterial({ map: groundTexture() }));
ground.rotation.x = -Math.PI / 2;
ground.position.set(WORLD_W / 2, 0, WORLD_H / 2);
scene.add(ground);
const outside = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W * 20, WORLD_H * 20), holeCutMaterial({ color: '#4f6a58' }));
outside.rotation.x = -Math.PI / 2;
outside.position.set(WORLD_W / 2, -0.5, WORLD_H / 2);
scene.add(outside);

// 穴：内側の壁（裏面だけ描く筒）と底、ふちのリング
const holeGroup = new THREE.Group();
{
  const wall = new THREE.CylinderGeometry(1, 1, 3, 48, 1, true);
  wall.translate(0, -1.5, 0);
  const cols = [];
  const pos = wall.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = -pos.getY(i) / 3; // 0 = 地面, 1 = 底
    cols.push(0.08 * (1 - t), 0.14 * (1 - t), 0.24 * (1 - t));
  }
  wall.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  holeGroup.add(new THREE.Mesh(wall, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: '#000', fog: false }));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = -3;
  holeGroup.add(bottom);
  const rim = new THREE.Mesh(new THREE.RingGeometry(1, 1.07, 64), new THREE.MeshBasicMaterial({ color: '#4fd1ff', fog: false }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.01;
  holeGroup.add(rim);
}
scene.add(holeGroup);

// ---------- 物の形（部品の組み合わせ、大きさ 1 で作って s 倍する） ----------
function windowTexture(cols, rows) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#8fb4cf';
  const gw = 64 / cols, gh = 128 / rows;
  for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) g.fillRect(a * gw + gw * 0.22, b * gh + gh * 0.25, gw * 0.56, gh * 0.5);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const box = (w, h, d, y = 0, x = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const cyl = (rt, rb, h, seg, y = 0) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, y + h / 2, 0);
// color が null の部品は物ごとの色（palette から選ぶ）
const SHAPES = {
  cone: { palette: null, parts: [
    { geo: box(1.6, 0.2, 1.6), color: '#e8732c' },
    { geo: new THREE.ConeGeometry(0.75, 2, 10).translate(0, 1.15, 0), color: '#ff8a3d' },
  ] },
  person: { palette: SHIRT_COLORS, parts: [
    { geo: cyl(0.45, 0.55, 1.5, 8), color: null },
    { geo: new THREE.SphereGeometry(0.45, 10, 8).translate(0, 1.95, 0), color: '#ffd6a5' },
  ] },
  bin: { palette: null, parts: [
    { geo: cyl(0.85, 0.7, 1.6, 10), color: '#5c7a8a' },
    { geo: cyl(0.9, 0.9, 0.18, 10, 1.6), color: '#3c5260' },
  ] },
  bench: { palette: null, parts: [
    { geo: box(2, 0.16, 0.8, 0.5), color: '#a0673a' },
    { geo: box(2, 0.6, 0.14, 0.66, 0, -0.35), color: '#a0673a' },
    { geo: box(0.14, 0.5, 0.7, 0, -0.85), color: '#4a4a4a' },
    { geo: box(0.14, 0.5, 0.7, 0, 0.85), color: '#4a4a4a' },
  ] },
  tree: { palette: LEAF_COLORS, parts: [
    { geo: cyl(0.18, 0.26, 1.3, 6), color: '#7a4f2a' },
    { geo: new THREE.IcosahedronGeometry(1, 0).translate(0, 2.1, 0), color: null, flat: true },
  ] },
  car: { palette: CAR_COLORS, parts: [
    { geo: box(2, 0.6, 1.1, 0.2), color: null },
    { geo: box(1.1, 0.48, 0.96, 0.8, -0.1), color: '#cfe0ee' },
    { geo: box(1.5, 0.3, 1.16, 0.05), color: '#222' },
  ] },
  bus: { palette: null, parts: [
    { geo: box(2, 1.1, 1, 0.2), color: '#f2c230' },
    { geo: box(1.84, 0.28, 1.02, 0.85), color: '#35506a' },
    { geo: box(1.5, 0.25, 1.04, 0.02), color: '#222' },
  ] },
  house: { palette: ROOF_COLORS, parts: [
    { geo: box(1.7, 1.2, 1.7), color: '#efe6d2' },
    { geo: new THREE.ConeGeometry(1.42, 0.95, 4).rotateY(Math.PI / 4).translate(0, 1.67, 0), color: null, flat: true },
    { geo: box(0.36, 0.6, 0.04, 0, 0.3, 0.86), color: '#7a4f2a' },
  ] },
  building: { palette: BLD_COLORS, parts: [
    { geo: box(1.9, 2.6, 1.9), color: null, map: windowTexture(4, 6) },
    { geo: box(1.6, 0.2, 1.6, 2.6), color: '#6d7787' },
  ] },
  tower: { palette: BLD_COLORS, parts: [
    { geo: box(1.9, 3.8, 1.9), color: null, map: windowTexture(5, 12) },
    { geo: box(1.5, 0.25, 1.5, 3.8), color: '#6d7787' },
    { geo: cyl(0.04, 0.06, 0.8, 5, 4.05), color: '#ddd' },
  ] },
};

// 種類ごとに部品を InstancedMesh で描く（物が多くても軽い）
let meshes = {};
function buildMeshes() {
  for (const kind in meshes) for (const m of meshes[kind]) { scene.remove(m); m.dispose(); }
  meshes = {};
  const counts = {};
  for (const o of objects) o.idx = (counts[o.kind] = (counts[o.kind] || 0) + 1) - 1;
  for (const kind in SHAPES) {
    const n = counts[kind] || 0;
    if (!n) continue;
    meshes[kind] = SHAPES[kind].parts.map((p) => {
      const mat = new THREE.MeshLambertMaterial({ color: p.color === null ? '#fff' : p.color, map: p.map || null, flatShading: !!p.flat });
      const m = new THREE.InstancedMesh(p.geo, mat, n);
      m.frustumCulled = false;
      m.userData.vary = p.color === null;
      scene.add(m);
      return m;
    });
  }
  for (const o of objects) {
    for (const m of meshes[o.kind]) if (m.userData.vary) m.setColorAt(o.idx, new THREE.Color(o.color));
    placeObj(o);
  }
  for (const kind in meshes) for (const m of meshes[kind]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
function placeObj(o, sink = 0, tilt = 0, scale = 1) {
  tmpE.set(tilt, -o.rot, tilt * 0.6, 'YXZ');
  tmpQ.setFromEuler(tmpE);
  tmpP.set(o.x, -sink, o.y);
  const s = o.s * scale;
  tmpS.set(s, s, s);
  tmpM.compose(tmpP, tmpQ, tmpS);
  for (const m of meshes[o.kind]) { m.setMatrixAt(o.idx, tmpM); m.instanceMatrix.needsUpdate = true; }
}
function hideObj(o) {
  tmpM.makeScale(0, 0, 0);
  for (const m of meshes[o.kind]) { m.setMatrixAt(o.idx, tmpM); m.instanceMatrix.needsUpdate = true; }
}

// 飲みこめる大きい物の上に出す印
const MARK_MAX = 300;
const marks = new THREE.InstancedMesh(
  new THREE.ConeGeometry(1, 2, 6).rotateX(Math.PI),
  new THREE.MeshBasicMaterial({ color: '#4fd1ff', fog: false }), MARK_MAX);
marks.frustumCulled = false;
marks.count = 0;
scene.add(marks);
const MARK_H = { tree: 3.2, car: 1.4, bus: 1.6, house: 2.8, building: 3.0, tower: 5.0 };

// ---------- 画面サイズ ----------
function resize() {
  const r = stage.getBoundingClientRect();
  W = Math.max(1, r.width);
  H = Math.max(1, r.height);
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  if (state !== 'play') draw();
}
window.addEventListener('resize', resize);

// ---------- 街の生成 ----------
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function addObj(kind, x, y, extra = {}) {
  const k = KINDS[kind];
  const pal = SHAPES[kind].palette;
  objects.push(Object.assign({ kind, x, y, s: k.s, value: k.value, color: pal ? pick(pal) : '#fff', rot: 0 }, extra));
}
function free(x, y, s) {
  for (const o of objects) {
    const d = s + o.s + 4;
    if (Math.abs(o.x - x) < d && Math.abs(o.y - y) < d) return false;
  }
  return true;
}
function tryPlace(kind, x0, y0, x1, y1, tries = 30, extra) {
  const s = KINDS[kind].s;
  for (let i = 0; i < tries; i++) {
    const x = rand(x0 + s, x1 - s), y = rand(y0 + s, y1 - s);
    if (free(x, y, s)) { addObj(kind, x, y, extra); return true; }
  }
  return false;
}

function buildCity() {
  objects = [];
  const cols = WORLD_W / BLOCK, rows = WORLD_H / BLOCK;
  const maxD = Math.hypot(WORLD_W, WORLD_H) / 2;
  // 道路の車・バス
  for (let i = 0; i <= cols; i++) {
    const x = i * BLOCK;
    for (let n = 0; n < 5; n++) tryPlace(Math.random() < 0.18 ? 'bus' : 'car', x - ROAD / 2 + 4, 0, x + ROAD / 2 - 4, WORLD_H, 20, { rot: Math.PI / 2 });
  }
  for (let j = 0; j <= rows; j++) {
    const y = j * BLOCK;
    for (let n = 0; n < 5; n++) tryPlace(Math.random() < 0.18 ? 'bus' : 'car', 0, y - ROAD / 2 + 4, WORLD_W, y + ROAD / 2 - 4, 20);
  }
  // 各ブロック
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x0 = i * BLOCK + ROAD / 2, y0 = j * BLOCK + ROAD / 2;
      const x1 = (i + 1) * BLOCK - ROAD / 2, y1 = (j + 1) * BLOCK - ROAD / 2;
      // 中心から遠いほど大きい建物（0 = 中心, 1 = 角）
      const far = Math.hypot((i + 0.5) * BLOCK - WORLD_W / 2, (j + 0.5) * BLOCK - WORLD_H / 2) / maxD;
      if (far > 0.5 && Math.random() < 0.5) tryPlace('tower', x0 + 20, y0 + 20, x1 - 20, y1 - 20);
      const nb = far > 0.28 ? 2 : 0;
      for (let n = 0; n < nb; n++) tryPlace('building', x0 + 16, y0 + 16, x1 - 16, y1 - 16);
      for (let n = 0; n < 3; n++) tryPlace('house', x0 + 14, y0 + 14, x1 - 14, y1 - 14, 30, { rot: pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) });
      for (let n = 0; n < 5; n++) tryPlace('tree', x0, y0, x1, y1, 30, { rot: rand(0, 6.28) });
      for (let n = 0; n < 3; n++) tryPlace('bench', x0, y0, x1, y1, 30, { rot: pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) });
      for (let n = 0; n < 4; n++) tryPlace('bin', x0, y0, x1, y1);
      for (let n = 0; n < 8; n++) tryPlace('person', x0, y0, x1, y1, 10, { wander: rand(0, 6.28) });
      for (let n = 0; n < 6; n++) tryPlace('cone', x0, y0, x1, y1);
    }
  }
  // スタート地点の周りは小物を多めに
  for (let n = 0; n < 40; n++) {
    tryPlace(pick(['cone', 'cone', 'person', 'bin']), WORLD_W / 2 - 180, WORLD_H / 2 - 180, WORLD_W / 2 + 180, WORLD_H / 2 + 180, 10, { wander: rand(0, 6.28) });
  }
  // 歩きまわるのは人だけ
  for (const o of objects) if (o.wander !== undefined && o.kind !== 'person') delete o.wander;
  buildMeshes();
}

// ---------- ゲーム進行 ----------
function reset() {
  buildCity();
  hole = { x: WORLD_W / 2, y: WORLD_H / 2, r: 20, area: 400, vr: 20 };
  eating = [];
  score = 0; level = 1; timeLeft = GAME_TIME;
  cam.x = hole.x; cam.y = hole.y; cam.dist = targetDist();
  updateHud();
}

function start() {
  audio();
  reset();
  state = 'play';
  overlay.classList.add('hidden');
  lastT = performance.now();
  requestAnimationFrame(loop);
}

function gameOver() {
  state = 'over';
  hideStick();
  let msg = `スコア ${score}<br>サイズ ${level}`;
  if (score > best) {
    best = score;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* 保存できなくても続行 */ }
    bestEl.textContent = best;
    msg += '<br><b style="color:#fff36e">ハイスコア更新！</b>';
  }
  tone(330, 0.3, 'sawtooth', 0.06, 0.5);
  setTimeout(() => {
    ovTitle.textContent = 'タイムアップ！';
    ovText.innerHTML = msg;
    startBtn.textContent = 'もう一度あそぶ';
    overlay.classList.remove('hidden');
  }, 500);
}

function updateHud() {
  timeEl.textContent = Math.ceil(timeLeft);
  timeEl.classList.toggle('low', timeLeft <= 10);
  sizeEl.textContent = level;
  scoreEl.textContent = score;
}

let popTimer = 0;
function pop(text) {
  popEl.textContent = text;
  popEl.classList.add('show');
  clearTimeout(popTimer);
  popTimer = setTimeout(() => popEl.classList.remove('show'), 900);
}

// 穴の大きさに合わせて、画面の短い辺に (r×7+200) くらいの範囲が映る距離
function targetDist() {
  const view = hole.r * 7 + 200;
  const vf = camera.fov * Math.PI / 180;
  const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  return (view / 2) / Math.tan(Math.min(vf, hf) / 2);
}

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) { timeLeft = 0; updateHud(); gameOver(); return; }

  // 入力
  let dx = input.dx, dy = input.dy;
  const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  const ky = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
  if (kx || ky) { const l = Math.hypot(kx, ky); dx = kx / l; dy = ky / l; }
  const speed = 170 + hole.r * 1.6;
  hole.x = Math.max(hole.r * 0.5, Math.min(WORLD_W - hole.r * 0.5, hole.x + dx * speed * dt));
  hole.y = Math.max(hole.r * 0.5, Math.min(WORLD_H - hole.r * 0.5, hole.y + dy * speed * dt));

  // 歩く人
  for (const o of objects) {
    if (o.wander === undefined) continue;
    o.wander += rand(-1.5, 1.5) * dt;
    o.x = Math.max(4, Math.min(WORLD_W - 4, o.x + Math.cos(o.wander) * 18 * dt));
    o.y = Math.max(4, Math.min(WORLD_H - 4, o.y + Math.sin(o.wander) * 18 * dt));
    o.rot = o.wander;
    placeObj(o);
  }

  // 飲みこみ判定
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.s >= hole.r * 0.92) continue;
    const d = Math.hypot(o.x - hole.x, o.y - hole.y);
    if (d < hole.r - o.s * 0.35) {
      objects.splice(i, 1);
      o.t = 0;
      eating.push(o);
      score += o.value;
      hole.area += o.s * o.s * GROW;
      gulpSound(o.s);
    }
  }
  hole.r = Math.sqrt(hole.area);
  hole.vr += (hole.r - hole.vr) * Math.min(1, dt * 6);

  // サイズアップ
  while (level < LEVELS.length && hole.r >= LEVELS[level]) {
    level++;
    pop(`サイズアップ！ Lv.${level}`);
    levelSound();
  }

  // 飲みこみ中のアニメーション：穴の中心へ寄りながら、かたむいて落ちていく
  for (let i = eating.length - 1; i >= 0; i--) {
    const o = eating[i];
    o.t += dt / 0.6;
    o.x += (hole.x - o.x) * Math.min(1, dt * 5);
    o.y += (hole.y - o.y) * Math.min(1, dt * 5);
    if (o.t >= 1) { eating.splice(i, 1); hideObj(o); continue; }
    const fall = o.t * o.t;
    placeObj(o, fall * (hole.vr * 2.6 + o.s * 3), o.t * 1.4, 1 - o.t * 0.3);
  }

  // カメラ
  cam.x += (hole.x - cam.x) * Math.min(1, dt * 6);
  cam.y += (hole.y - cam.y) * Math.min(1, dt * 6);
  cam.dist += (targetDist() - cam.dist) * Math.min(1, dt * 2);
  updateHud();
}

// ---------- 描画 ----------
function draw() {
  if (!hole) return;
  const r = hole.vr;
  holeGroup.position.set(hole.x, 0, hole.y);
  holeGroup.scale.set(r, r, r);
  holeUniform.value.set(hole.x, hole.y, r);

  // カメラは南（手前）の斜め上から見下ろす
  camera.position.set(cam.x, Math.sin(PITCH) * cam.dist, cam.y + Math.cos(PITCH) * cam.dist);
  camera.lookAt(cam.x, 0, cam.y - hole.r * 0.6);
  scene.fog.near = cam.dist * 1.1;
  scene.fog.far = cam.dist * 2.6;
  camera.far = cam.dist * 4;
  camera.updateProjectionMatrix();

  // 飲みこめる大きい物に印をつける（画面のまわりだけ）
  let n = 0;
  const near = cam.dist * 1.4;
  const bob = Math.sin(performance.now() / 180) * 0.3;
  for (const o of objects) {
    if (n >= MARK_MAX) break;
    if (o.s < Math.max(16, hole.r * 0.45) || o.s >= hole.r * 0.92) continue;
    if (Math.abs(o.x - cam.x) > near || Math.abs(o.y - cam.y) > near) continue;
    const ms = 4 + o.s * 0.12;
    tmpP.set(o.x, o.s * MARK_H[o.kind] + ms * (2.5 + bob), o.y);
    tmpS.set(ms, ms, ms);
    tmpM.compose(tmpP, tmpQ.identity(), tmpS);
    marks.setMatrixAt(n++, tmpM);
  }
  marks.count = n;
  marks.instanceMatrix.needsUpdate = true;

  renderer.render(scene, camera);
}

function loop(t) {
  if (state !== 'play') { draw(); return; }
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  update(dt);
  draw();
  if (state === 'play') requestAnimationFrame(loop);
}

// ---------- 入力 ----------
function localPos(e) {
  const r = cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function showStick() {
  stickEl.style.display = 'block';
  stickEl.style.left = input.sx + 'px';
  stickEl.style.top = input.sy + 'px';
  knobEl.style.transform = `translate(${input.dx * 40}px, ${input.dy * 40}px)`;
}
function hideStick() { stickEl.style.display = 'none'; }
cv.addEventListener('pointerdown', (e) => {
  const p = localPos(e);
  input.active = true; input.sx = p.x; input.sy = p.y; input.dx = 0; input.dy = 0;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
  if (state === 'play') showStick();
});
cv.addEventListener('pointermove', (e) => {
  if (!input.active) return;
  const p = localPos(e);
  let dx = p.x - input.sx, dy = p.y - input.sy;
  const l = Math.hypot(dx, dy);
  if (l > 40) { input.sx = p.x - dx / l * 40; input.sy = p.y - dy / l * 40; dx = dx / l * 40; dy = dy / l * 40; }
  const m = Math.hypot(dx, dy);
  const k = m < 6 ? 0 : Math.min(1, m / 40) / m;
  input.dx = dx * k; input.dy = dy * k;
  if (state === 'play') showStick();
});
const end = () => { input.active = false; input.dx = 0; input.dy = 0; hideStick(); };
cv.addEventListener('pointerup', end);
cv.addEventListener('pointercancel', end);

window.addEventListener('keydown', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (state !== 'play' && (k === 'Enter' || k === ' ')) { e.preventDefault(); start(); return; }
  keys[k] = true;
  if (k.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys[k] = false;
});

startBtn.addEventListener('click', start);

// タイトル画面の背景用に街を作っておく
reset();
resize();
draw();
