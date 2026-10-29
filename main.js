// Xochimilco de Muertos — a pseudo-3D lane runner.
// Three.js renders into a 320x180 target that is upscaled with nearest-neighbor
// filtering. Every object in the world is a camera-facing pixel-art sprite.
import * as THREE from 'three';
import { PALETTE, SPRITES, ICONS, gridToCanvas, textWidth, forEachTextPixel } from './sprites.js?v=8';

// ===========================================================================
// CONFIG — every tuning value lives here so it can be tweaked during a demo.
// ===========================================================================
const CONFIG = {
  // Zones. dur is in seconds. rowEvery = seconds between obstacle rows.
  // patterns = weighted obstacle patterns used by the random row spawner.
  zones: [
    { name: 'EMBARCADERO', sub: 'NATIVITAS, 1 DE NOVIEMBRE', dur: 30, rowEvery: 2.4,
      patterns: { traj: 5, traj2: 2, lirio: 1, picado: 0.8, empty: 0.5 }, soulChance: 0.8, highSouls: 0.25, petalChance: 0.6, fogMul: 1, bankWiden: 0 },
    { name: 'CANAL PRINCIPAL', sub: 'CUIDADO CON LAS TRAJINERAS', dur: 45, rowEvery: 1.8,
      patterns: { traj: 5, traj2: 4, mariachi: 1.5, vendor: 2, lirio: 1, picado: 1 }, soulChance: 0.7, highSouls: 0.25, petalChance: 0.9, fogMul: 1, bankWiden: 0 },
    { name: 'ISLA DE LAS MUÑECAS', sub: 'LAS MUÑECAS TE OBSERVAN', dur: 35, rowEvery: 2.4,
      patterns: { dolltree: 6, dolltree2: 3, traj: 1.5, lirio: 2, picado: 1, empty: 0.5 }, soulChance: 1, highSouls: 0.35, petalChance: 0.4, fogMul: 0.55, bankWiden: 0 },
    { name: 'EL LAGO', sub: '¿OYES ESE LLANTO?', dur: 40, rowEvery: 2.1,
      patterns: { traj: 4, traj2: 2, llorona: 7, llorona2: 5, vendor: 1, lirio: 1, empty: 0.2 }, soulChance: 0.8, highSouls: 0.3, petalChance: 0.6, fogMul: 1.1, bankWiden: 5 },
    { name: 'MICTLÁN', sub: 'EL MÁS ALLÁ TE ESPERA', dur: 30, rowEvery: 0,
      patterns: {}, soulChance: 0, highSouls: 0, petalChance: 0, fogMul: 2, bankWiden: 5 },
  ],
  bankBoatEvery: [0.8, 1.8], // seconds between docks (Embarcadero) / moored boats at the lake edge (El Lago)
  bankLloronaEvery: [0.7, 1.6], // seconds between harmless Lloronas on the banks (El Lago only)
  skyLloronaEvery: [1.5, 3.5],  // seconds between Lloronas floating across the sky (El Lago only)
  zoneTimeScale: 1,          // multiply all zone durations (?short=1 sets 0.4)
  titleCardTime: 2.8,

  // Movement
  speedStart: 10,            // world units / second
  speedEnd: 15,
  speedSmoothing: 3,
  laneWidth: 2.4,
  laneSwitchTime: 0.14,
  jumpTime: 0.95,
  jumpHeight: 1.8,
  duckTime: 0.75,

  // Spawning
  spawnZ: -78,
  despawnZ: 8,
  soulLineLength: [3, 5],
  soulSpacing: 1.8,
  blockWindow: 10,           // obstacles closer than this (z) count as one wall; one lane always stays open
  candleEvery: 9,            // seconds: a candle is guaranteed at least this often
  panChance: 0.06,           // per row
  ajoloteChance: 0.05,       // per row
  scenerySpan: 120,

  // Light & fog
  candleDrainPerSec: 1 / 45,
  candleRefill: 0.5,
  fogFarMin: 13,
  fogFarMax: 80,
  fogNearFrac: 0.25,

  // Power-ups & hits
  magnetTime: 5,
  magnetRadius: 9,
  invulnTime: 1.5,
  lirioSlowTime: 1,
  lirioSlowFactor: 0.55,
  hitboxScale: 0.6,          // < 1 = more forgiving collisions
  playerHalfWidth: 0.45,
  allowGameOver: false,      // demo mode: getting hit with 0 souls doesn't end the run
  skipBonusSouls: 8,         // souls granted when skipping ahead with an empty trail

  // Tilt steering (degrees)
  tiltThreshold: 11,
  tiltHysteresis: 3,

  // World
  px: 1 / 48,                // world units per sprite pixel (sprites are high-res)
  bankX: 4.2,
  camera: { fov: 50, pos: [0, 2.1, 7], lookAt: [0, 0.9, -8], follow: 0.3 },
};

const LOW_W = 320, LOW_H = 180;   // HUD resolution
const RT_W = 640, RT_H = 360;     // 3D render resolution
const PX = CONFIG.px;
const params = new URLSearchParams(location.search);
if (params.has('short')) CONFIG.zoneTimeScale = 0.4;
const URL_ZONE = params.has('zone') ? Math.min(5, Math.max(1, parseInt(params.get('zone'), 10) || 1)) - 1 : 0;
const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ===========================================================================
// Renderer: low-res render target, nearest-neighbor upscale, letterboxing.
// ===========================================================================
THREE.ColorManagement.enabled = false; // keep palette colors exact
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
document.body.appendChild(renderer.domElement);

const rt = new THREE.WebGLRenderTarget(RT_W, RT_H, {
  minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true,
});
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.P, 10, 60);
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, RT_W / RT_H, 0.1, 400);
camera.position.set(...CONFIG.camera.pos);

// HUD is drawn with canvas 2D at 320x180 and composited over the 3D frame.
const hudCanvas = document.createElement('canvas');
hudCanvas.width = LOW_W; hudCanvas.height = LOW_H;
const hud = hudCanvas.getContext('2d');
const hudTex = new THREE.CanvasTexture(hudCanvas);
hudTex.magFilter = hudTex.minFilter = THREE.NearestFilter;
hudTex.generateMipmaps = false;

const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadGeo = new THREE.PlaneGeometry(2, 2);
postScene.add(new THREE.Mesh(quadGeo, new THREE.MeshBasicMaterial({ map: rt.texture, depthTest: false, depthWrite: false })));
const hudQuad = new THREE.Mesh(quadGeo, new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false, depthWrite: false }));
hudQuad.renderOrder = 1;
postScene.add(hudQuad);

const viewport = { x: 0, y: 0, w: 1, h: 1 };
const jumpBtn = document.getElementById('jump');
const rotateEl = document.getElementById('rotate');
function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H, false);
  const scale = Math.min(W / 16, H / 9);
  viewport.w = Math.floor(scale * 16); viewport.h = Math.floor(scale * 9);
  viewport.x = Math.floor((W - viewport.w) / 2); viewport.y = Math.floor((H - viewport.h) / 2);
  // Jump button sits in the bottom-right of the game frame.
  const size = Math.max(64, Math.min(110, viewport.h * 0.24));
  Object.assign(jumpBtn.style, {
    width: size + 'px', height: size + 'px',
    right: Math.max(12, W - viewport.x - viewport.w + viewport.w * 0.03) + 'px',
    bottom: Math.max(12, H - viewport.y - viewport.h + viewport.h * 0.06) + 'px',
  });
  rotateEl.style.display = IS_TOUCH && H > W ? 'flex' : 'none';
}
window.addEventListener('resize', resize);
resize();

// ===========================================================================
// Sprite textures & materials (cached; animated sprites swap materials)
// ===========================================================================
const texCache = new Map();
const matCache = new Map();
function spriteTex(name, frame = 0) {
  const key = name + ':' + frame;
  if (!texCache.has(key)) {
    const t = new THREE.CanvasTexture(gridToCanvas(SPRITES[name][frame]));
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    texCache.set(key, t);
  }
  return texCache.get(key);
}
function spriteMat(name, frame = 0, variant = '') {
  const key = name + ':' + frame + ':' + variant;
  if (!matCache.has(key)) {
    const m = new THREE.SpriteMaterial({ map: spriteTex(name, frame), alphaTest: 0.5, fog: variant !== 'nofog' });
    if (variant === 'ghost') { m.transparent = true; m.opacity = 0.7; m.depthWrite = false; }
    matCache.set(key, m);
  }
  return matCache.get(key);
}
/** Creates a bottom-anchored sprite whose world size follows its pixel size. */
function makeSprite(name, scale = 1, variant = '') {
  const g = SPRITES[name][0];
  const s = new THREE.Sprite(spriteMat(name, 0, variant));
  s.center.set(0.5, 0);
  s.scale.set(g.w * PX * scale, g.h * PX * scale, 1);
  s.userData = { name, variant };
  scene.add(s);
  return s;
}
function setFrame(sprite, frame) {
  sprite.material = spriteMat(sprite.userData.name, frame, sprite.userData.variant);
}
const hudIcons = {};
for (const n of ['soul', 'petal', 'candle', 'ajolote', 'pan']) hudIcons[n] = gridToCanvas(ICONS[n][0]);

// ===========================================================================
// Sky: dithered palette gradient with stars and moon. It warms from night to
// dawn over the run, so the sky doubles as a progress bar.
// ===========================================================================
const SKY_RAMP = ['P', 'V', 'm', 'p', 'o', 'O'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const skyCanvas = document.createElement('canvas');
skyCanvas.width = LOW_W; skyCanvas.height = LOW_H;
const skyCtx = skyCanvas.getContext('2d');
const skyImg = skyCtx.createImageData(LOW_W, LOW_H);
const skyTex = new THREE.CanvasTexture(skyCanvas);
skyTex.magFilter = skyTex.minFilter = THREE.NearestFilter;
skyTex.generateMipmaps = false;
scene.background = skyTex;
const STARS = Array.from({ length: 70 }, () => ({ x: Math.floor(Math.random() * LOW_W), y: Math.floor(Math.random() * 80), ph: Math.random() * 6.28 }));
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const RAMP_RGB = SKY_RAMP.map((k) => hexRgb(PALETTE[k]));
const skyWarmth = (yn, p) => Math.min(5, Math.max(0, yn * (1 + 4 * p) + p - 0.2));

function drawSky(p, time) {
  const d = skyImg.data;
  for (let y = 0; y < LOW_H; y++) {
    const w = skyWarmth(y / LOW_H, p);
    const lo = Math.floor(w), frac = w - lo;
    for (let x = 0; x < LOW_W; x++) {
      const idx = frac > BAYER[(y & 3) * 4 + (x & 3)] ? Math.min(5, lo + 1) : lo;
      const c = RAMP_RGB[idx], i = (y * LOW_W + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  // Stars fade out as dawn arrives.
  const star = hexRgb(PALETTE.b), star2 = hexRgb(PALETTE.y);
  for (const s of STARS) {
    if (skyWarmth(s.y / LOW_H, p) > 1.1) continue;
    if (Math.sin(time * 2 + s.ph) < -0.6) continue;
    const c = s.ph > 4 ? star2 : star, i = (s.y * LOW_W + s.x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  }
  // Moon sinks toward the horizon over the run.
  const mx = 250, my = Math.round(18 + p * 50), mr = 9;
  const bone = hexRgb(PALETTE.b), lt = hexRgb(PALETTE.O);
  for (let y = -mr; y <= mr; y++) for (let x = -mr; x <= mr; x++) {
    if (x * x + y * y > mr * mr) continue;
    const px = mx + x, py = my + y;
    if (py < 0 || py >= LOW_H) continue;
    const crater = (x + 3) ** 2 + (y - 2) ** 2 < 5 || (x - 4) ** 2 + (y + 3) ** 2 < 3;
    const c = crater ? lt : bone, i = (py * LOW_W + px) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  }
  skyCtx.putImageData(skyImg, 0, 0);
  skyTex.needsUpdate = true;
  // Fog takes the (smoothly interpolated) horizon color.
  const hw = skyWarmth(0.42, p), lo = Math.floor(hw), f = hw - lo;
  const a = RAMP_RGB[lo], b = RAMP_RGB[Math.min(5, lo + 1)];
  scene.fog.color.setRGB((a[0] + (b[0] - a[0]) * f) / 255, (a[1] + (b[1] - a[1]) * f) / 255, (a[2] + (b[2] - a[2]) * f) / 255);
}

// ===========================================================================
// Water and banks
// ===========================================================================
function pixelCanvasTexture(w, h, base, paint) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.fillStyle = PALETTE[base]; c.fillRect(0, 0, w, h);
  paint((x, y, k) => { c.fillStyle = PALETTE[k]; c.fillRect(x, y, 1, 1); });
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  return t;
}
const WATER_TILE = 4;
const waterTex = pixelCanvasTexture(32, 32, 'W', (dot) => {
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(Math.random() * 32), y = Math.floor(Math.random() * 32), len = 2 + Math.floor(Math.random() * 5);
    for (let j = 0; j < len; j++) dot(x, (y + j) % 32, i < 3 ? 't' : 'V');
  }
  for (let i = 0; i < 3; i++) dot(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32), Math.random() < 0.5 ? 'y' : 'O');
});
waterTex.repeat.set(120 / WATER_TILE, 300 / WATER_TILE);
const water = new THREE.Mesh(new THREE.PlaneGeometry(120, 300), new THREE.MeshBasicMaterial({ map: waterTex }));
water.rotation.x = -Math.PI / 2;
water.position.set(0, 0, -140);
scene.add(water);

const groundTex = pixelCanvasTexture(16, 16, 'g', (dot) => {
  for (let i = 0; i < 30; i++) dot(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), Math.random() < 0.5 ? 'P' : 'G');
});
groundTex.repeat.set(25, 150);
const grounds = [-1, 1].map((side) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(50, 300), new THREE.MeshBasicMaterial({ map: groundTex }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(side * (CONFIG.bankX + 25), 0.02, -140);
  m.userData.side = side;
  scene.add(m);
  return m;
});

// ===========================================================================
// Recycled bank scenery: chinampas, ahuejote trees and (Isla) hanging dolls.
// ===========================================================================
const scenery = [];
function addScenery(name, frameCount, side, off, spacing, scale = 1, yOff = 0) {
  for (let z = CONFIG.despawnZ; z > CONFIG.despawnZ - CONFIG.scenerySpan; z -= spacing) {
    const s = makeSprite(name, scale);
    setFrame(s, Math.floor(Math.random() * frameCount));
    const item = { s, name, frameCount, side, off, baseOff: off, z: z - Math.random() * spacing * 0.5, yOff, doll: null };
    if (name === 'ahuejote') {
      item.doll = makeSprite('doll', 1);
      item.doll.visible = false;
      item.dollY = 1.0 + Math.random() * 0.9;
    }
    scenery.push(item);
  }
}
for (const side of [-1, 1]) {
  addScenery('chinampa', 3, side, 0.7, 1.6);
  addScenery('ahuejote', 3, side, 1.8, 3.2, 1.1);
  addScenery('ahuejote', 3, side, 4.5, 4.5, 1.25);
}
function recycleScenery(item) {
  item.z -= CONFIG.scenerySpan;
  setFrame(item.s, Math.floor(Math.random() * item.frameCount));
  if (item.name === 'ahuejote') {
    item.off = item.baseOff + Math.random() * 1.2;
    item.doll.visible = false; // the dolls live on trees in the water now
  }
}

// ===========================================================================
// Player: xolo + canoa (two sprites so the dog can leap off the boat)
// ===========================================================================
const canoe = makeSprite('canoe', 1);
const dog = makeSprite('dog', 1);
dog.userData.name = 'dog';

// ===========================================================================
// Audio — everything synthesized with Web Audio.
// ===========================================================================
const Sound = {
  ctx: null, master: null, muted: false, noiseBuf: null, drone: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  },
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.02);
  },
  get ok() { return !!this.ctx; },
  tone({ f, f2, dur = 0.2, type = 'sine', vol = 0.15, at = 0, attack = 0.005, vibrato = 0, filter = 0 }) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    if (vibrato) {
      const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
      lfo.frequency.value = 6; lg.gain.value = vibrato;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) { const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = filter; o.connect(lp); node = lp; }
    node.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise({ dur = 0.2, freq = 1000, q = 1, vol = 0.1, at = 0, type = 'bandpass', freq2 }) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.noiseBuf;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  },
  splash(v = 0.05) { this.noise({ dur: 0.18, freq: 900 + Math.random() * 600, q: 0.8, vol: v, freq2: 400 }); },
  soul(i = 0) {
    const scale = [880, 988, 1175, 1319, 1568, 1760];
    const f = scale[i % scale.length];
    this.tone({ f, dur: 0.25, type: 'triangle', vol: 0.12 });
    this.tone({ f: f * 1.5, dur: 0.3, type: 'sine', vol: 0.06, at: 0.06 });
  },
  petal() { this.tone({ f: 2200 + Math.random() * 400, dur: 0.05, type: 'square', vol: 0.03 }); },
  pickup() { [660, 880, 1320].forEach((f, i) => this.tone({ f, dur: 0.15, type: 'triangle', vol: 0.1, at: i * 0.06 })); },
  jump() { this.tone({ f: 300, f2: 700, dur: 0.18, type: 'triangle', vol: 0.08 }); this.splash(0.04); },
  land() { this.splash(0.07); },
  duck() { this.noise({ dur: 0.15, freq: 2500, freq2: 800, q: 2, vol: 0.05 }); },
  lane() { this.noise({ dur: 0.1, freq: 1800, q: 3, vol: 0.03 }); },
  hit() {
    this.tone({ f: 140, f2: 45, dur: 0.35, type: 'sine', vol: 0.4 });
    this.noise({ dur: 0.25, freq: 300, q: 0.7, vol: 0.25, type: 'lowpass' });
  },
  shieldBreak() { this.tone({ f: 1200, f2: 300, dur: 0.3, type: 'square', vol: 0.06 }); this.noise({ dur: 0.2, freq: 3000, vol: 0.08 }); },
  slow() { this.noise({ dur: 0.35, freq: 500, q: 1, vol: 0.1, type: 'lowpass' }); },
  // Short "trumpet" fanfare: two detuned saws in thirds through a lowpass.
  mariachi() {
    const notes = [[392, 0, 0.14], [523, 0.16, 0.14], [659, 0.32, 0.14], [784, 0.5, 0.7], [659, 1.25, 0.12], [784, 1.4, 0.5]];
    for (const [f, at, dur] of notes) {
      this.tone({ f, dur, at, type: 'sawtooth', vol: 0.07, attack: 0.02, vibrato: 5, filter: 2400 });
      this.tone({ f: f * 1.26, dur, at, type: 'sawtooth', vol: 0.045, attack: 0.02, vibrato: 5, filter: 2200 });
    }
  },
  // Rising ghostly wail for La Llorona.
  wail() {
    this.tone({ f: 330, f2: 880, dur: 1.9, type: 'sine', vol: 0.14, attack: 0.5, vibrato: 18 });
    this.tone({ f: 335, f2: 870, dur: 1.9, type: 'triangle', vol: 0.05, attack: 0.6, vibrato: 14 });
    this.noise({ dur: 1.8, freq: 1200, freq2: 2400, q: 6, vol: 0.05 });
  },
  chime(i) {
    const scale = [523, 587, 659, 784, 880];
    const f = scale[i % 5] * (1 + Math.floor(i / 5) % 3);
    this.tone({ f, dur: 0.9, vol: 0.12 });
    this.tone({ f: f * 2.76, dur: 0.5, vol: 0.03 });
  },
  winFanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, dur: 0.6, type: 'triangle', vol: 0.1, at: i * 0.12 })); },
  gameOver() { [392, 330, 262, 196].forEach((f, i) => this.tone({ f, dur: 0.5, type: 'triangle', vol: 0.1, at: i * 0.22 })); },
  // Low eerie drone for the Isla de las Muñecas.
  startDrone() {
    if (!this.ok || this.drone) return;
    const c = this.ctx, g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 380;
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 2);
    const oscs = [55, 55.7, 82.4, 110.3].map((f, i) => {
      const o = c.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'sine'; o.frequency.value = f; o.connect(lp); o.start(); return o;
    });
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 0.15; lg.gain.value = 200; lfo.connect(lg).connect(lp.frequency); lfo.start();
    lp.connect(g).connect(this.master);
    this.drone = { g, oscs: [...oscs, lfo] };
  },
  stopDrone() {
    if (!this.drone) return;
    const { g, oscs } = this.drone, t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0.0001, t, 0.5);
    oscs.forEach((o) => o.stop(t + 3));
    this.drone = null;
  },
};

// ===========================================================================
// Game state
// ===========================================================================
let state = 'title'; // 'title' | 'play' | 'over' | 'win'
const G = {};
const entities = [];
const trail = [];          // collected souls following the canoa
const xHistory = [];       // recent player x positions, sampled at 60 Hz
const particles = [];      // HUD-space confetti for the win screen
const zoneStart = [];
let totalDur = 0;
function computeZoneTimes() {
  totalDur = 0;
  CONFIG.zones.forEach((z, i) => { zoneStart[i] = totalDur; totalDur += z.dur * CONFIG.zoneTimeScale; });
}
computeZoneTimes();

function resetRun() {
  for (const e of entities) scene.remove(e.s);
  entities.length = 0;
  for (const t of trail) scene.remove(t.s);
  trail.length = 0;
  particles.length = 0;
  Object.assign(G, {
    time: 0, runTime: 0, zone: -1, zoneTime: 0, zoneDur: 1,
    speed: CONFIG.speedStart, lane: 1, laneFrom: 1, laneT: 1, x: 0,
    jumpT: -1, duckT: -1, dogH: 0, slowT: 0, invulnT: 0, magnetT: 0, shield: false,
    candle: 1, petals: 0, delivered: 0, sinceCandle: 0, rowTimer: 1.2, tutorialStep: 0,
    events: [], hint: null, hintT: 0, hintsShown: {}, titleCardT: 0, decorT: 0, floatT: 0, buntingT: 6,
    bankX: CONFIG.bankX, finale: null, endT: 0, paddleT: 0, paddleFrame: 0, fogMul: 1, skyP: 0,
  });
  xHistory.length = 0;
  for (const it of scenery) if (it.doll) it.doll.visible = false;
}

function zoneIndexAt(t) {
  for (let i = CONFIG.zones.length - 1; i >= 0; i--) if (t >= zoneStart[i]) return i;
  return 0;
}

function enterZone(i) {
  G.zone = i;
  G.zoneDur = CONFIG.zones[i].dur * CONFIG.zoneTimeScale;
  G.titleCardT = CONFIG.titleCardTime;
  G.rowTimer = Math.min(G.rowTimer, 1.5);
  if (i === 2) Sound.startDrone(); else Sound.stopDrone();
  if (i === 4) startFinale();
}

/** Cheat / demo helper: jump straight to a zone. */
function skipToZone(i) {
  i = Math.max(0, Math.min(CONFIG.zones.length - 1, i));
  if (state !== 'play') return;
  for (const e of entities) scene.remove(e.s);
  entities.length = 0;
  G.events.length = 0;
  for (const t of trail) delete t.flying;
  G.finale = null;
  G.runTime = zoneStart[i] + 0.001;
  G.zoneTime = 0;
  G.candle = 1;
  G.tutorialStep = 99;
  while (trail.length < CONFIG.skipBonusSouls) addTrailSoul();
  enterZone(i);
}

function startGame(zone = 0) {
  Sound.init();
  requestTilt();
  resetRun();
  state = 'play';
  if (zone > 0) {
    G.tutorialStep = 99;
    G.runTime = zoneStart[zone] + 0.001;
    while (trail.length < CONFIG.skipBonusSouls) addTrailSoul();
  }
  enterZone(zone);
  calibrateTilt();
}

// ===========================================================================
// Entities
// ===========================================================================
const laneX = (l) => (l - 1) * CONFIG.laneWidth;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function weightedPick(weights) {
  const entries = Object.entries(weights);
  let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return entries[0][0];
}

/** Spawns a world entity. kind decides how it collides. */
function spawn(kind, name, x, z, opts = {}) {
  const s = makeSprite(name, opts.scale || 1, opts.variant || '');
  const g = SPRITES[name][0];
  const e = Object.assign({
    kind, name, s, x, y: 0, z, vx: 0, vz: 0, frames: SPRITES[name].length, fps: 4, phase: Math.random() * 10,
    hw: (g.w * PX * (opts.scale || 1)) / 2, hd: 0.6, dead: false,
  }, opts);
  entities.push(e);
  return e;
}

function spawnSoul(x, z, high = false) {
  return spawn('soul', 'soul', x, z, { y: high ? 1.9 : 0.35, high, hw: 0.5, hd: 0.7, fps: 3, scale: 0.9 });
}
function spawnSoulLine(lane, z, high) {
  const n = Math.floor(rand(CONFIG.soulLineLength[0], CONFIG.soulLineLength[1] + 1));
  for (let i = 0; i < n; i++) spawnSoul(laneX(lane), z - i * CONFIG.soulSpacing, high);
}
function spawnPetalLine(lane, z) {
  for (let i = 0; i < 5; i++) spawn('petal', 'petal', laneX(lane), z - i * 1.4, { y: 0.35, hw: 0.45, hd: 0.6 });
}
function spawnCandle(lane, z) { G.sinceCandle = 0; return spawn('candle', 'candle', laneX(lane), z, { y: 0.15, hw: 0.45, hd: 0.6, fps: 6, variant: 'nofog', scale: 1.25 }); }

const laneOf = (x) => Math.max(0, Math.min(2, Math.round(x / CONFIG.laneWidth) + 1));
/** Lanes blocked by static obstacles near z, plus how many lane-crossing obstacles are there. */
function blockersNear(z, win = CONFIG.blockWindow) {
  const lanes = new Set();
  let movers = 0;
  for (const e of entities) {
    if (e.dead || (e.kind !== 'solid' && e.kind !== 'duck') || Math.abs(e.z - z) > win) continue;
    if (e.vx) movers++;
    else if (e.hw > 50) [0, 1, 2].forEach((l) => lanes.add(l));
    else lanes.add(laneOf(e.x));
  }
  return { lanes, movers };
}

/** La Llorona stands in a lane and drifts at you like a trajinera; her wail announces her. */
function spawnLlorona(lane, z) {
  if (G.time - (G.lastWail || -9) > 1.5) { Sound.wail(); G.lastWail = G.time; }
  return spawn('solid', 'llorona', laneX(lane), z, {
    variant: 'ghost', y: 0.25, vz: -1.2, hd: 0.8, hw: 0.6, fps: 1, llorona: true, scale: 1.6,
  });
}

function spawnTrajinera(lane, z, mariachi = false) {
  const name = mariachi ? 'mariachi' : pick(['traj0', 'traj1', 'traj2']);
  return spawn('solid', name, laneX(lane), z, { y: -0.12, vz: -1.2, hd: 1.0, hw: 1.33 * CONFIG.hitboxScale });
}

function spawnDollTree(lane, z) {
  return spawn('solid', pick(['dollTree', 'dollTreeB', 'dollTreeC']), laneX(lane) + rand(-0.15, 0.15), z, { y: -0.25, hd: 0.6, hw: 0.55, fps: 0 });
}

/** Spawns one row of obstacles plus souls / pickups in the free lanes. */
function spawnRow(kind) {
  const zc = CONFIG.zones[G.zone];
  const z = CONFIG.spawnZ;
  let free = [0, 1, 2];
  const take = (l) => { free = free.filter((f) => f !== l); return l; };
  let hint = null;
  let soulsOK = true;

  // Never wall off the canal: at least one lane must stay open near this row.
  const near = blockersNear(z);
  free = free.filter((l) => !near.lanes.has(l));
  const canBlock = (n) => near.lanes.size + n <= (near.movers ? 1 : 2);
  if (['traj', 'dolltree', 'llorona', 'mariachi', 'lirio'].includes(kind) && (!free.length || (kind !== 'lirio' && !canBlock(1)))) kind = 'empty';
  // Papel picado spans the canal (you duck under it), so it only goes where nothing else is near.
  if (kind === 'picado' && (near.lanes.size || near.movers)) kind = 'empty';
  if (kind === 'traj2' && !canBlock(2)) kind = canBlock(1) && free.length ? 'traj' : 'empty';
  if (kind === 'llorona2' && !canBlock(2)) kind = canBlock(1) && free.length ? 'llorona' : 'empty';
  if (kind === 'dolltree2' && !canBlock(2)) kind = canBlock(1) && free.length ? 'dolltree' : 'empty';
  if (kind === 'vendor' && near.lanes.size + near.movers > 1) kind = canBlock(1) && free.length ? 'traj' : 'empty';

  switch (kind) {
    case 'traj': { const l = take(pick(free)); spawnTrajinera(l, z); break; }
    case 'traj2': { const a = take(pick(free)), b = take(pick(free)); spawnTrajinera(a, z); spawnTrajinera(b, z - 3); break; }
    case 'mariachi': {
      // The trumpet cue plays now; the boat appears 2s later.
      Sound.mariachi();
      const l = pick(free);
      G.events.push({ t: G.time + 2, fn: () => {
        const n = blockersNear(CONFIG.spawnZ);
        if (!n.lanes.has(l) && n.lanes.size + 1 <= (n.movers ? 1 : 2)) spawnTrajinera(l, CONFIG.spawnZ, true);
      } });
      take(l);
      break;
    }
    case 'vendor': {
      const side = Math.random() < 0.5 ? -1 : 1;
      spawn('solid', side < 0 ? 'vendorR' : 'vendorL', side * CONFIG.laneWidth * 1.6, z, { vx: -side * 1.9, y: -0.05, hd: 0.5, hw: 0.6 * CONFIG.hitboxScale + 0.1 });
      soulsOK = false;
      break;
    }
    case 'lirio': {
      const l = take(pick(free));
      spawn('lirio', pick([0, 1]) ? 'lirio' : 'lirio', laneX(l), z, { y: 0, hw: 0.9, hd: 0.8, frames: 1 });
      setFrame(entities[entities.length - 1].s, Math.floor(Math.random() * 2));
      if (Math.random() < 0.5) for (let i = 0; i < 3; i++) spawnSoul(laneX(l), z - 0.5 - i * 1.3, true);
      break;
    }
    case 'dolltree': spawnDollTree(take(pick(free)), z); break;
    case 'dolltree2': {
      const a = take(pick(free)), b = take(pick(free));
      spawnDollTree(a, z);
      spawnDollTree(b, z - 2);
      break;
    }
    case 'picado': spawn('duck', 'picado', 0, z, { hw: 99, hd: 0.35 }); soulsOK = false; break;
    case 'llorona': spawnLlorona(take(pick(free)), z); break;
    case 'llorona2': {
      const a = take(pick(free)), b = take(pick(free));
      spawnLlorona(a, z);
      spawnLlorona(b, z - 3);
      break;
    }
    // Tutorial-only patterns
    case 'tut-souls': free = []; spawnSoulLine(1, z, false); hint = 'souls'; break;
    case 'tut-lane': take(1); spawnTrajinera(1, z); spawnSoulLine(0, z - 2, false); hint = 'lane'; soulsOK = false; break;
    case 'tut-jump': free = []; for (let i = 0; i < 4; i++) spawnSoul(laneX(G.lane), z - i * 1.5, true); hint = 'jump'; break;
    case 'tut-lirio': {
      for (const l of [0, 1, 2]) spawn('lirio', 'lirio', laneX(l), z, { hw: 0.9, hd: 0.8 });
      free = []; hint = 'lirio'; break;
    }
    case 'tut-duck': spawn('duck', 'picado', 0, z, { hw: 99, hd: 0.35 }); hint = 'duck'; soulsOK = false; break;
    case 'tut-candle': free = []; spawnCandle(0, z); spawnCandle(1, z); spawnCandle(2, z); hint = 'candle'; break;
    default: break; // 'empty'
  }
  if (hint) entities[entities.length - 1].hint = hint;

  // Fill free lanes with souls, petals and power-ups.
  if (!soulsOK) free = free.slice(0, 1);
  free.sort(() => Math.random() - 0.5);
  if (free.length && G.sinceCandle > CONFIG.candleEvery) spawnCandle(free.pop(), z);
  if (free.length && Math.random() < CONFIG.panChance) spawn('pan', 'pan', laneX(free.pop()), z, { y: 0.15, hw: 0.5, hd: 0.6 });
  if (free.length && !G.shield && Math.random() < CONFIG.ajoloteChance) spawn('ajolote', 'ajolote', laneX(free.pop()), z, { y: 0.15, hw: 0.5, hd: 0.6 });
  if (free.length && Math.random() < zc.soulChance) spawnSoulLine(free.pop(), z - 1, Math.random() < zc.highSouls);
  if (free.length && Math.random() < zc.petalChance) spawnPetalLine(free.pop(), z - 1);
}

const TUTORIAL = ['tut-souls', 'tut-lane', 'tut-jump', 'tut-lirio', 'tut-duck', 'tut-candle'];
const HINTS = {
  souls: () => 'COLLECT THE LOST SOULS',
  lane: () => (tilt.active ? 'TILT YOUR PHONE TO STEER' : IS_TOUCH ? 'SWIPE ← → TO STEER' : '← → OR A D TO STEER'),
  jump: () => (IS_TOUCH ? 'TAP JUMP TO GRAB HIGH SOULS' : 'SPACE / ↑ TO JUMP FOR HIGH SOULS'),
  lirio: () => 'JUMP OVER THE LIRIOS OR THEY SLOW YOU',
  duck: () => (IS_TOUCH ? 'SWIPE DOWN TO DUCK' : '↓ OR S TO DUCK UNDER PAPEL PICADO'),
  candle: () => 'CANDLES KEEP YOUR LIGHT BURNING',
};

// ===========================================================================
// Souls trail
// ===========================================================================
function addTrailSoul() {
  const s = makeSprite('soul', 0.45);
  s.material = spriteMat('soul', 0, 'nofog');
  s.userData.variant = 'nofog';
  trail.push({ s, phase: Math.random() * 6 });
}
function historyX(delay) {
  const i = xHistory.length - 1 - Math.round(delay * 60);
  return xHistory.length ? xHistory[Math.max(0, i)] : G.x;
}
function updateTrail() {
  const t = G.time;
  trail.forEach((tr, i) => {
    if (tr.flying) return;
    const z = 1.4 + 3.6 * (1 - Math.exp(-(i + 1) / 10));
    const y = 0.1 + Math.min(i, 30) * 0.01 + 0.1 * Math.sin(t * 3 - i * 0.7);
    const x = historyX(0.05 + i * 0.07) + 0.2 * Math.sin(t * 2.2 - i * 0.55);
    tr.s.position.set(x, y, z);
    setFrame(tr.s, Math.floor(t * 3 + tr.phase) % 2);
  });
}
/** Hit: half of the trail scatters ahead onto the water, re-collectable. */
function scatterSouls() {
  const n = Math.ceil(trail.length / 2);
  for (let i = 0; i < n; i++) {
    const tr = trail.pop();
    scene.remove(tr.s);
    const e = spawnSoul(G.x, 0.5);
    e.y = 1;
    e.vy = rand(3, 5);
    e.vz = -rand(10, 22);
    e.vx = rand(-3, 3);
    e.flyT = 0.9;
  }
}

// ===========================================================================
// Afterlife (Mictlán) finale
// ===========================================================================
function startFinale() {
  for (const e of entities) if (e.kind !== 'soul' && e.kind !== 'petal' && e.kind !== 'decor') e.dead = true;
  const o = spawn('decor', 'afterlife', 0, -95, { scale: 2.6, variant: 'nofog', y: -9 });
  G.finale = { gate: o, stage: 'approach', nextT: 0, idx: 0 };
}
function updateFinale(dt) {
  const f = G.finale;
  const o = f.gate;
  o.y = Math.min(0, o.y + dt * 2.5); // rises out of the water
  if (f.stage === 'approach' && o.z > -21) { f.stage = 'deliver'; f.nextT = G.time + 0.6; }
  if (f.stage === 'deliver' && G.time >= f.nextT) {
    const tr = trail.find((t) => !t.flying);
    if (tr) {
      tr.flying = { t: 0, from: tr.s.position.clone() };
      f.nextT = G.time + Math.min(0.3, 6 / Math.max(1, trail.length));
    } else if (!trail.length) {
      f.stage = 'done'; G.endT = G.time + 2.2;
    }
  }
  // Animate souls flying into the portal.
  for (let i = trail.length - 1; i >= 0; i--) {
    const tr = trail[i];
    if (!tr.flying) continue;
    tr.flying.t += dt / 0.9;
    const k = Math.min(1, tr.flying.t);
    const to = new THREE.Vector3((Math.random() - 0.5) * 0.5, 4.2, o.z + 0.5);
    const p = tr.flying.from.clone().lerp(to, k);
    p.y += Math.sin(k * Math.PI) * 2.5;
    tr.s.position.copy(p);
    if (k >= 1) {
      scene.remove(tr.s);
      trail.splice(i, 1);
      Sound.chime(G.delivered++);
      spawn('fx', 'sparkle', to.x + rand(-1.5, 1.5), o.z + 1, { y: rand(1.5, 5), life: 0.5, fps: 10, scale: 2 });
    }
  }
  if (f.stage === 'done' && G.time > G.endT) winGame();
}

// ===========================================================================
// Hits & pickups
// ===========================================================================
function onHit() {
  if (G.invulnT > 0) return;
  G.invulnT = CONFIG.invulnTime;
  if (G.shield) { G.shield = false; Sound.shieldBreak(); return; }
  Sound.hit();
  G.shake = 0.3;
  if (trail.length > 0) scatterSouls();
  else if (CONFIG.allowGameOver) gameOver();
}
function collect(e) {
  e.dead = true;
  switch (e.kind) {
    case 'soul': addTrailSoul(); Sound.soul(trail.length); break;
    case 'petal': G.petals++; Sound.petal(); return;
    case 'candle': G.candle = Math.min(1, G.candle + CONFIG.candleRefill); Sound.pickup(); break;
    case 'pan': G.magnetT = CONFIG.magnetTime; Sound.pickup(); break;
    case 'ajolote': G.shield = true; Sound.pickup(); break;
    default: break;
  }
  spawn('fx', 'sparkle', e.x, e.z + 0.2, { y: e.y, life: 0.35, fps: 10 });
}
function gameOver() {
  state = 'over'; G.endT = 0;
  Sound.stopDrone(); Sound.gameOver();
}
function winGame() {
  state = 'win'; G.endT = 0;
  Sound.stopDrone(); Sound.winFanfare();
  for (let i = 0; i < 160; i++) particles.push(newPetalParticle(true));
}
function newPetalParticle(burst) {
  return {
    x: burst ? 160 + rand(-10, 10) : rand(0, LOW_W), y: burst ? 90 : -5,
    vx: burst ? rand(-90, 90) : rand(-10, 10), vy: burst ? rand(-110, -20) : rand(15, 35),
    c: pick(['o', 'O', 'o', 'm', 'y']), spin: Math.random() * 6,
  };
}

// ===========================================================================
// Input: keyboard, touch (tilt + jump button + swipes), mouse
// ===========================================================================
function tryJump() {
  if (state !== 'play' || G.jumpT >= 0) return;
  G.jumpT = 0; G.duckT = -1; Sound.jump();
}
function tryDuck() {
  if (state !== 'play' || G.jumpT >= 0) return;
  if (G.duckT < 0) Sound.duck();
  G.duckT = 0;
}
function moveLane(d) {
  if (state !== 'play') return;
  setLane(G.lane + d);
}
function setLane(l) {
  l = Math.max(0, Math.min(2, l));
  if (l === G.lane) return;
  G.laneFrom = G.x; G.lane = l; G.laneT = 0;
  Sound.lane();
}
function primaryAction(zone = URL_ZONE) {
  Sound.init();
  if (state === 'title') startGame(zone);
  else if ((state === 'over' || state === 'win') && G.endT > 1.2) startGame(0);
}

window.addEventListener('keydown', (ev) => {
  const k = ev.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) ev.preventDefault();
  if (ev.repeat) return;
  if (k === 'm' || k === 'M') { Sound.init(); Sound.toggleMute(); return; }
  // Zone cheats: match on the physical key so they work on any layout and on the numpad, in any state.
  const digit = /^(Digit|Numpad)([1-5])$/.exec(ev.code || '') || /^([1-5])$/.exec(k);
  if (digit) {
    const zi = parseInt(digit[digit.length - 1], 10) - 1;
    if (state === 'play') skipToZone(zi); else startGame(zi);
    return;
  }
  if (state === 'play') {
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') moveLane(-1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') moveLane(1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') tryJump();
    else if (k === 'ArrowDown' || k === 's' || k === 'S') tryDuck();
    else if (k === 'n' || k === 'N') skipToZone(G.zone + 1);
    else if (k === 'Escape') { state = 'title'; resetRun(); Sound.stopDrone(); }
  } else if (k === ' ' || k === 'Enter') {
    primaryAction();
  } else if (k === 'Escape') { state = 'title'; resetRun(); }
});

/** Converts a client point to low-res frame coordinates. */
function toLowRes(cx, cy) {
  return { x: ((cx - viewport.x) / viewport.w) * LOW_W, y: ((cy - viewport.y) / viewport.h) * LOW_H };
}
const MUTE_BTN = { x: 304, y: 13, w: 14, h: 11 };
const SKIP_BTN = { x: 288, y: 13, w: 14, h: 11 };
const ZONE_BTNS = CONFIG.zones.map((_, i) => ({ x: 6 + i * 62, y: 150, w: 60, h: 14 }));
const ZONE_LABELS = ['EMBARCADERO', 'CANAL', 'MUÑECAS', 'EL LAGO', 'MICTLÁN'];
const inBox = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

/** Handles a tap/click in low-res coordinates. Returns true if consumed. */
function handlePoint(p) {
  if (inBox(p, MUTE_BTN)) { Sound.init(); Sound.toggleMute(); return true; }
  if (state === 'play' && inBox(p, SKIP_BTN)) { skipToZone(G.zone + 1); return true; }
  if (state === 'title') {
    const zi = ZONE_BTNS.findIndex((b) => inBox(p, b));
    primaryAction(zi >= 0 ? zi : URL_ZONE);
    return true;
  }
  if (state === 'over' || state === 'win') { primaryAction(); return true; }
  return false;
}

renderer.domElement.addEventListener('mousedown', (ev) => {
  if (IS_TOUCH && ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents) return;
  handlePoint(toLowRes(ev.clientX, ev.clientY));
});

let touchStart = null;
renderer.domElement.addEventListener('touchstart', (ev) => {
  ev.preventDefault();
  if (ev.touches.length >= 3) { skipToZone(G.zone + 1); touchStart = null; return; }
  const t = ev.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY, time: performance.now() };
}, { passive: false });
renderer.domElement.addEventListener('touchend', (ev) => {
  ev.preventDefault();
  if (!touchStart) return;
  const t = ev.changedTouches[0];
  const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
  const dist = Math.hypot(dx, dy);
  const ts = touchStart; touchStart = null;
  if (dist < 25) {
    if (!handlePoint(toLowRes(ts.x, ts.y)) && state === 'play') tryJump();
    return;
  }
  if (state !== 'play') { handlePoint(toLowRes(ts.x, ts.y)); return; }
  if (Math.abs(dy) > Math.abs(dx)) { if (dy > 0) tryDuck(); else tryJump(); }
  else if (!tilt.active) moveLane(dx > 0 ? 1 : -1);
}, { passive: false });
['touchstart', 'mousedown'].forEach((evName) => jumpBtn.addEventListener(evName, (ev) => {
  ev.preventDefault(); ev.stopPropagation();
  jumpBtn.classList.add('down');
  tryJump();
}, { passive: false }));
['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach((evName) => jumpBtn.addEventListener(evName, () => jumpBtn.classList.remove('down')));

// --- Tilt steering ---------------------------------------------------------
// The device's "up" vector is reconstructed from beta/gamma and projected onto
// the screen's x axis, so steering works both holding the phone flat and like
// a steering wheel, in either landscape orientation.
const tilt = { active: false, value: 0, neutral: 0, requested: false, listening: false };
function screenAngle() {
  return (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
}
function onOrientation(ev) {
  if (ev.beta == null || ev.gamma == null) return;
  const b = THREE.MathUtils.degToRad(ev.beta), g = THREE.MathUtils.degToRad(ev.gamma);
  const ux = -Math.sin(g) * Math.cos(b), uy = Math.sin(b);
  const a = ((screenAngle() % 360) + 360) % 360;
  const sx = a === 90 ? -uy : a === 270 ? uy : a === 180 ? -ux : ux;
  tilt.value = THREE.MathUtils.radToDeg(-Math.asin(Math.max(-1, Math.min(1, sx))));
  if (!tilt.active && IS_TOUCH) { tilt.active = true; calibrateTilt(); }
}
function listenTilt() {
  if (tilt.listening) return;
  tilt.listening = true;
  window.addEventListener('deviceorientation', onOrientation);
}
function requestTilt() {
  if (!IS_TOUCH || tilt.requested) return;
  tilt.requested = true;
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    DOE.requestPermission().then((r) => { if (r === 'granted') listenTilt(); }).catch(() => {});
  } else if (DOE) listenTilt();
}
function calibrateTilt() { tilt.neutral = Math.abs(tilt.value) < 25 ? tilt.value : 0; }
function updateTiltLane() {
  if (!tilt.active || state !== 'play') return;
  const v = tilt.value - tilt.neutral, T = CONFIG.tiltThreshold, H = CONFIG.tiltHysteresis;
  let target = G.lane;
  if (G.lane === 1) { if (v > T + H) target = 2; else if (v < -T - H) target = 0; }
  else if (G.lane === 2) { if (v < -T - H) target = 0; else if (v < T - H) target = 1; }
  else if (G.lane === 0) { if (v > T + H) target = 2; else if (v > -T + H) target = 1; }
  setLane(target);
}

// ===========================================================================
// Update
// ===========================================================================
const easeOut = (t) => 1 - (1 - t) * (1 - t);

function updatePlay(dt) {
  G.time += dt;
  G.runTime += dt;
  const progress = Math.min(1, G.runTime / totalDur);
  const zi = zoneIndexAt(G.runTime);
  if (zi !== G.zone && !G.finale) enterZone(zi);
  G.zoneTime = G.runTime - zoneStart[G.zone];
  const zc = CONFIG.zones[G.zone];

  // Scheduled events (mariachi / Llorona arrivals).
  for (let i = G.events.length - 1; i >= 0; i--) if (G.time >= G.events[i].t) { G.events[i].fn(); G.events.splice(i, 1); }

  // Speed.
  let target = THREE.MathUtils.lerp(CONFIG.speedStart, CONFIG.speedEnd, progress);
  if (G.slowT > 0) target *= CONFIG.lirioSlowFactor;
  if (G.finale) {
    const oz = G.finale.gate.z;
    target = G.finale.stage === 'approach' ? Math.max(3, Math.min(CONFIG.speedStart, (-21 - oz) * 0.6 + 3)) : 0;
  }
  G.speed += (target - G.speed) * Math.min(1, dt * CONFIG.speedSmoothing);

  // Timers.
  G.slowT -= dt; G.invulnT -= dt; G.magnetT -= dt; G.titleCardT -= dt; G.hintT -= dt;
  G.sinceCandle += dt;
  if (!G.finale) G.candle = Math.max(0, G.candle - CONFIG.candleDrainPerSec * dt);
  else G.candle = Math.min(1, G.candle + dt * 0.3);

  // Lane tween, jump arc, duck.
  updateTiltLane();
  G.laneT = Math.min(1, G.laneT + dt / CONFIG.laneSwitchTime);
  G.x = THREE.MathUtils.lerp(G.laneFrom, laneX(G.lane), easeOut(G.laneT));
  xHistory.push(G.x);
  if (xHistory.length > 600) xHistory.shift();
  if (G.jumpT >= 0) {
    G.jumpT += dt / CONFIG.jumpTime;
    if (G.jumpT >= 1) { G.jumpT = -1; Sound.land(); }
  }
  G.dogH = G.jumpT >= 0 ? Math.sin(G.jumpT * Math.PI) * CONFIG.jumpHeight : 0;
  if (G.duckT >= 0) { G.duckT += dt / CONFIG.duckTime; if (G.duckT >= 1) G.duckT = -1; }
  const ducking = G.duckT >= 0;

  // Paddling animation + splash.
  if (G.speed > 2) {
    G.paddleT += dt * (G.speed / 10);
    if (G.paddleT > 0.4) { G.paddleT = 0; G.paddleFrame ^= 1; Sound.splash(0.025); }
  }

  // Row spawner.
  if (zc.rowEvery > 0 && !G.finale) {
    G.rowTimer -= dt;
    if (G.rowTimer <= 0) {
      G.rowTimer = zc.rowEvery;
      if (G.zone === 0 && G.tutorialStep < TUTORIAL.length) spawnRow(TUTORIAL[G.tutorialStep++]);
      else spawnRow(weightedPick(zc.patterns));
    }
  }
  updateDecorSpawns(dt);

  // Move & collide entities.
  const magnet = G.magnetT > 0;
  for (const e of entities) {
    if (e.dead) continue;
    e.z += (G.speed + e.vz) * dt;
    e.x += e.vx * dt;
    if (e.flyT > 0) {
      // Scattered souls arc ahead and splash down.
      e.flyT -= dt;
      e.vy -= 12 * dt;
      e.y = Math.max(0.35, e.y + e.vy * dt);
      e.vz *= 1 - dt * 1.5;
      e.x = Math.max(-CONFIG.laneWidth, Math.min(CONFIG.laneWidth, e.x));
      if (e.flyT <= 0) { e.vz = 0; e.vx = 0; e.y = 0.35; e.x = laneX(Math.round(e.x / CONFIG.laneWidth) + 1); }
    }
    if (e.kind === 'fx') { e.life -= dt; if (e.life <= 0) e.dead = true; }
    if (e.llorona) e.y = (e.baseY ?? 0.25) + Math.sin(G.time * 2 + e.phase) * 0.15;
    if (magnet && (e.kind === 'soul' || e.kind === 'petal') && !(e.flyT > 0) && e.z > -CONFIG.magnetRadius * 1.5 && e.z < 1) {
      e.x += (G.x - e.x) * Math.min(1, dt * 6);
      e.z += (0 - e.z) * Math.min(1, dt * 3);
      if (e.high) e.y += (0.35 - e.y) * Math.min(1, dt * 6);
    }
    if (e.hint && !G.hintsShown[e.hint] && e.z > -32) {
      G.hintsShown[e.hint] = true; G.hint = HINTS[e.hint](); G.hintT = 3;
    }
    // Collisions with the player at z = 0.
    if (Math.abs(e.z) < e.hd && Math.abs(e.x - G.x) < e.hw + CONFIG.playerHalfWidth) {
      if (e.kind === 'solid') onHit();
      else if (e.kind === 'duck') { if (!ducking) onHit(); }
      else if (e.kind === 'lirio') { if (G.dogH < 0.4 && G.slowT <= 0 && !e.used) { e.used = true; G.slowT = CONFIG.lirioSlowTime; Sound.slow(); } }
      else if (e.kind === 'soul' && !(e.flyT > 0)) { if (e.high ? G.dogH > 0.6 || magnet : G.dogH < 1.1) collect(e); }
      else if (['petal', 'candle', 'pan', 'ajolote'].includes(e.kind) && G.dogH < 1.2) collect(e);
    }
    if (e.z > CONFIG.despawnZ || Math.abs(e.x) > 30) e.dead = true;
  }
  for (let i = entities.length - 1; i >= 0; i--) if (entities[i].dead) { scene.remove(entities[i].s); entities.splice(i, 1); }

  if (G.finale) updateFinale(dt);
  updateTrail();

  // Zone-driven environment.
  G.fogMul += (zc.fogMul - G.fogMul) * Math.min(1, dt * 0.8);
  G.bankX += (CONFIG.bankX + zc.bankWiden - G.bankX) * Math.min(1, dt * 0.4);
  G.skyP = G.finale ? Math.min(1, G.skyP + dt * 0.08) : Math.pow(progress, 1.7) * 0.8;
}

/** Ambient decor: floating marigolds, bunting, docks and parked trajineras. */
function updateDecorSpawns(dt) {
  G.floatT -= dt;
  if (G.floatT <= 0) {
    G.floatT = rand(0.5, 1.4);
    // Keep them along the banks, outside the three lanes.
    const x = pick([-1, 1]) * rand(CONFIG.laneWidth * 1.6, Math.max(CONFIG.laneWidth * 1.7, G.bankX - 0.4));
    spawn('decor', 'floatFlower', x, CONFIG.spawnZ + rand(0, 20), { y: -0.05, fps: 2 });
  }
  // Doll trees also stand in the shallows along the banks at the doll island.
  if (state === 'play' && G.zone === 2) {
    G.dollTreeT = (G.dollTreeT || 0) - dt;
    if (G.dollTreeT <= 0) {
      G.dollTreeT = rand(0.6, 1.3);
      const x = pick([-1, 1]) * rand(CONFIG.laneWidth * 1.65, G.bankX + 0.3);
      spawn('decor', pick(['dollTree', 'dollTreeB', 'dollTreeC']), x, CONFIG.spawnZ, { y: -0.25, fps: 0, scale: rand(0.9, 1.2) });
    }
  }
  G.buntingT -= dt;
  if (G.buntingT <= 0 && !G.finale) {
    G.buntingT = rand(8, 14);
    spawn('decor', 'bunting', 0, CONFIG.spawnZ, { y: 3.4 });
  }
  // Docks at the embarcadero; on El Lago, moored boats float in the water along the far edges.
  G.decorT -= dt;
  if (G.decorT <= 0) {
    G.decorT = rand(CONFIG.bankBoatEvery[0], CONFIG.bankBoatEvery[1]);
    const side = pick([-1, 1]);
    if (G.zone === 0 && Math.random() < 0.35) spawn('decor', 'dock', side * (G.bankX + 0.6), CONFIG.spawnZ, { y: -0.2 });
    else if (G.zone === 3 && G.bankX > 6.5) spawn('decor', pick(['traj0', 'traj1', 'traj2', 'mariachi']), side * (G.bankX - 1.4), CONFIG.spawnZ, { y: -0.12 });
  }
  // Harmless Lloronas haunt the banks (more of them deeper into the night)...
  if (state === 'play' && G.zone === 3) {
    G.ghostT = (G.ghostT || 0) - dt;
    if (G.ghostT <= 0) {
      G.ghostT = rand(CONFIG.bankLloronaEvery[0], CONFIG.bankLloronaEvery[1]);
      const side = pick([-1, 1]);
      spawn('decor', 'llorona', side * (G.bankX - rand(0.3, 1.2)), CONFIG.spawnZ, { variant: 'ghost', y: 0.25, fps: 1, llorona: true, scale: 1.6 });
    }
  }
  // ...and drift across the sky from the doll island onward.
  if (state === 'play' && G.zone === 3) {
    G.skyGhostT = (G.skyGhostT || 2) - dt;
    if (G.skyGhostT <= 0) {
      G.skyGhostT = rand(CONFIG.skyLloronaEvery[0], CONFIG.skyLloronaEvery[1]);
      const side = pick([-1, 1]);
      spawn('decor', 'llorona', side * rand(6, 10), CONFIG.spawnZ * rand(0.5, 0.9), { variant: 'ghost', baseY: rand(3.5, 6), vx: -side * rand(2, 4), fps: 1, llorona: true, scale: rand(1.2, 2) });
    }
  }
  // Out on the open lake (and at Mictlán) extra boats drift between the lanes and the banks.
  const open = G.bankX - CONFIG.laneWidth * 2.1;
  if (open > 1.2) {
    G.driftT = (G.driftT || 0) - dt;
    if (G.driftT <= 0) {
      G.driftT = rand(0.9, 1.8);
      const side = pick([-1, 1]);
      spawn('decor', pick(['traj0', 'traj1', 'traj2', 'mariachi']), side * (CONFIG.laneWidth * 2.1 + rand(0.4, open)), CONFIG.spawnZ, { y: -0.12, vz: -rand(0.5, 2) });
    }
  }
}

function updateWorld(dt, speed) {
  waterTex.offset.y += (speed * dt) / WATER_TILE;
  groundTex.offset.y += (speed * dt) / 2;
  for (const g of grounds) g.position.x = g.userData.side * ((G.bankX || CONFIG.bankX) + 25);
  for (const it of scenery) {
    it.z += speed * dt;
    if (it.z > CONFIG.despawnZ) recycleScenery(it);
    const x = it.side * ((G.bankX || CONFIG.bankX) + it.off);
    it.s.position.set(x, it.yOff, it.z);
    if (it.doll) it.doll.position.set(x - it.side * 0.25, it.dollY, it.z + 0.1);
  }
}

function updatePlayerSprites() {
  const bob = Math.sin(G.time * 4) * 0.03;
  canoe.position.set(G.x, -0.06 + bob, 0);
  setFrame(canoe, G.paddleFrame);
  dog.position.set(G.x, -0.06 + bob + 5 * PX + G.dogH, 0);
  if (G.jumpT >= 0) setFrame(dog, 0), dog.material = spriteMat('dogJump');
  else if (G.duckT >= 0) dog.material = spriteMat('dogDuck');
  else dog.material = spriteMat('dog', G.paddleFrame);
  const flicker = G.invulnT > 0 && Math.floor(G.invulnT * 12) % 2 === 0;
  canoe.visible = dog.visible = !flicker;
}

function updateEntitySprites() {
  for (const e of entities) {
    e.s.position.set(e.x, e.y + (e.kind === 'soul' && !(e.flyT > 0) ? Math.sin(G.time * 3 + e.phase) * 0.08 : 0), e.z);
    if (e.frames > 1) setFrame(e.s, Math.floor(G.time * e.fps + e.phase) % e.frames);
    if (e.llorona) e.s.material.opacity = 0.75 + Math.sin(G.time * 7) * 0.15;
  }
}

function updateCamera(dt) {
  const c = CONFIG.camera;
  let cx = (G.x || 0) * c.follow;
  if (state === 'title') cx = Math.sin(G.time * 0.25) * 1.2;
  const shake = G.shake > 0 ? (G.shake -= dt, (Math.random() - 0.5) * 0.15) : 0;
  camera.position.set(cx + shake, c.pos[1] + shake, c.pos[2]);
  camera.lookAt(cx * 0.8, c.lookAt[1], c.lookAt[2]);
}

function updateFog() {
  const light = G.candle ?? 1;
  const far = THREE.MathUtils.lerp(CONFIG.fogFarMin, CONFIG.fogFarMax, Math.pow(light, 0.7)) * (G.fogMul || 1);
  scene.fog.far = far;
  scene.fog.near = far * CONFIG.fogNearFrac;
}

// ===========================================================================
// HUD & screens (drawn into the 320x180 canvas)
// ===========================================================================
function text(str, x, y, color, scale = 1, align = 'left', shadow = null) {
  const w = textWidth(str) * scale;
  const x0 = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  const draw = (ox, oy, col) => {
    hud.fillStyle = PALETTE[col];
    forEachTextPixel(str, 0, 0, (px, py) => hud.fillRect(x0 + px * scale + ox, y + py * scale + oy, scale, scale));
  };
  if (shadow) draw(scale > 1 ? scale / 2 : 1, scale > 1 ? scale / 2 : 1, shadow);
  draw(0, 0, color);
}
function box(x, y, w, h, fill, border) {
  hud.fillStyle = PALETTE[border]; hud.fillRect(x, y, w, h);
  hud.fillStyle = PALETTE[fill]; hud.fillRect(x + 1, y + 1, w - 2, h - 2);
}
function drawBunting2D(t) {
  const cols = ['m', 'o', 'T', 'p', 'y', 'G'];
  for (let row = 0; row < 2; row++) {
    const y0 = 2 + row * 12, sag = 6;
    hud.fillStyle = PALETTE.b;
    for (let x = 0; x < LOW_W; x++) hud.fillRect(x, Math.round(y0 + sag * Math.sin((Math.PI * x) / LOW_W)), 1, 1);
    for (let i = 0, x = 4 + row * 5; x < LOW_W - 6; x += 11, i++) {
      const y = Math.round(y0 + sag * Math.sin((Math.PI * (x + 3)) / LOW_W)) + 1;
      const sway = Math.round(Math.sin(t * 2 + i) * 0.6);
      hud.fillStyle = PALETTE[cols[(i + row * 2) % cols.length]];
      hud.fillRect(x + sway, y, 7, 8);
      hud.clearRect(x + sway + 2, y + 2, 1, 1); hud.clearRect(x + sway + 4, y + 4, 1, 1);
      for (let k = 0; k < 7; k += 2) hud.clearRect(x + sway + k, y + 7, 1, 1);
    }
  }
}
function drawSkipButton() {
  const b = SKIP_BTN;
  hud.fillStyle = PALETTE.V; hud.fillRect(b.x, b.y, b.w, b.h);
  hud.fillStyle = PALETTE.O;
  for (const ox of [3, 7]) for (let i = 0; i < 4; i++) hud.fillRect(b.x + ox + i, b.y + 2 + i, 1, 7 - 2 * i);
}
function drawMuteButton() {
  const b = MUTE_BTN;
  hud.fillStyle = PALETTE.V; hud.fillRect(b.x, b.y, b.w, b.h);
  hud.fillStyle = PALETTE.b;
  hud.fillRect(b.x + 2, b.y + 4, 2, 3); hud.fillRect(b.x + 4, b.y + 3, 1, 5); hud.fillRect(b.x + 5, b.y + 2, 1, 7);
  hud.fillStyle = Sound.muted ? PALETTE.m : PALETTE.T;
  if (Sound.muted) for (let i = 0; i < 5; i++) { hud.fillRect(b.x + 7 + i, b.y + 3 + i, 1, 1); hud.fillRect(b.x + 11 - i, b.y + 3 + i, 1, 1); }
  else { hud.fillRect(b.x + 8, b.y + 4, 1, 3); hud.fillRect(b.x + 10, b.y + 3, 1, 5); }
}

function drawHUD() {
  document.body.classList.toggle('playing', state !== 'title');
  hud.clearRect(0, 0, LOW_W, LOW_H);
  if (state === 'title') { drawTitle(); drawMuteButton(); return; }

  // Progress bar to Mictlán.
  hud.fillStyle = PALETTE.V; hud.fillRect(0, 0, LOW_W, 2);
  hud.fillStyle = PALETTE.o; hud.fillRect(0, 0, Math.round(LOW_W * Math.min(1, G.runTime / totalDur)), 2);
  for (let i = 1; i < CONFIG.zones.length; i++) { hud.fillStyle = PALETTE.b; hud.fillRect(Math.round((zoneStart[i] / totalDur) * LOW_W), 0, 1, 2); }

  // Souls (top-left).
  hud.drawImage(hudIcons.soul, 3, 5);
  text(String(trail.length + (G.finale ? G.delivered : 0)), 18, 9, 'T', 1, 'left', 'k');
  if (G.finale) text('CRUZARON ' + G.delivered, 4, 33, 'O', 1, 'left', 'k');

  // Candle meter under the souls count.
  hud.drawImage(hudIcons.candle, 4, 19);
  box(14, 23, 44, 5, 'P', 'k');
  const low = G.candle < 0.25 && Math.floor(G.time * 4) % 2 === 0;
  hud.fillStyle = PALETTE[low ? 'm' : G.candle < 0.25 ? 'o' : 'y'];
  hud.fillRect(15, 24, Math.round(42 * G.candle), 3);
  let ix = 62;
  if (G.shield) { hud.drawImage(hudIcons.ajolote, ix, 19); ix += 19; }
  if (G.magnetT > 0) {
    hud.drawImage(hudIcons.pan, ix, 18);
    hud.fillStyle = PALETTE.O; hud.fillRect(ix, 31, Math.round(12 * (G.magnetT / CONFIG.magnetTime)), 1);
  }

  // Current level (top-center).
  {
    const label = `ZONA ${G.zone + 1}/${CONFIG.zones.length}  ${CONFIG.zones[G.zone].name}`;
    const w = textWidth(label) + 8;
    box(Math.round(160 - w / 2), 4, w, 11, 'P', 'o');
    text(label, 160, 7, 'O', 1, 'center');
  }

  // Petals (top-right).
  hud.drawImage(hudIcons.petal, LOW_W - 11, 4);
  text(String(G.petals), LOW_W - 14, 5, 'O', 1, 'right', 'k');
  drawMuteButton();
  if (state === 'play') drawSkipButton();

  // Zone title card.
  if (G.titleCardT > 0 && state === 'play') {
    const t = CONFIG.titleCardTime - G.titleCardT;
    const a = Math.min(1, t * 3, G.titleCardT * 2);
    hud.globalAlpha = a;
    const zc = CONFIG.zones[G.zone];
    hud.fillStyle = PALETTE.P; hud.fillRect(0, 46, LOW_W, 36);
    hud.fillStyle = PALETTE.o; hud.fillRect(0, 46, LOW_W, 1); hud.fillRect(0, 81, LOW_W, 1);
    text(`ZONA ${G.zone + 1}`, 160, 50, 'p', 1, 'center');
    text(zc.name, 160, 58, 'O', 2, 'center', 'm');
    text(zc.sub, 160, 72, 'b', 1, 'center');
    hud.globalAlpha = 1;
  }

  // Control hints.
  if (G.hintT > 0 && G.hint && state === 'play') {
    const w = textWidth(G.hint) + 10;
    if (Math.floor(G.hintT * 3) % 4 !== 0 || G.hintT < 2) {
      box(Math.round(160 - w / 2), 136, w, 11, 'P', 'o');
      text(G.hint, 160, 139, 'y', 1, 'center');
    }
  }
  if (G.slowT > 0 && state === 'play') text('LIRIOS!', 160, 120, 'G', 1, 'center', 'k');

  if (state === 'over') drawGameOver();
  if (state === 'win') drawWin();
}

function drawTitle() {
  const t = G.time;
  drawBunting2D(t);
  text('XOCHIMILCO', 160, 34, 'O', 4, 'center', 'm');
  text('DE MUERTOS', 160, 60, 'p', 3, 'center', 'P');
  text('UN XOLO, UNA CANOA Y LAS ALMAS PERDIDAS', 160, 82, 'b', 1, 'center', 'k');
  if (Math.floor(t * 2) % 2 === 0) text(IS_TOUCH ? 'TAP TO START' : 'PRESS SPACE / TAP TO START', 160, 112, 'y', 1, 'center', 'k');
  text('OR START AT ZONE:', 160, 140, 'T', 1, 'center', 'k');
  ZONE_BTNS.forEach((b, i) => {
    box(b.x, b.y, b.w, b.h, 'P', i === URL_ZONE ? 'O' : 'o');
    text(`${i + 1}`, b.x + 3, b.y + 5, 'p');
    text(ZONE_LABELS[i], b.x + b.w / 2 + 3, b.y + 5, 'b', 1, 'center');
  });
  text(IS_TOUCH ? 'TILT TO STEER  -  TAP TO JUMP  -  SWIPE DOWN TO DUCK' : '← → STEER   SPACE JUMP   ↓ DUCK   M MUTE   1-5 / N SKIP', 160, 170, 'b', 1, 'center', 'k');
}

function drawOverlay() { hud.globalAlpha = 0.6; hud.fillStyle = PALETTE.P; hud.fillRect(0, 0, LOW_W, LOW_H); hud.globalAlpha = 1; }
function drawGameOver() {
  drawOverlay();
  text('LAS ALMAS SE PERDIERON', 160, 55, 'T', 2, 'center', 'P');
  text('EN EL AGUA…', 160, 70, 'T', 2, 'center', 'P');
  text(`PÉTALOS: ${G.petals}`, 160, 100, 'O', 1, 'center');
  if (G.endT > 1.2 && Math.floor(G.time * 2) % 2 === 0) text(IS_TOUCH ? 'TAP TO RETRY' : 'SPACE / TAP TO RETRY', 160, 130, 'y', 1, 'center');
}
function drawWin() {
  drawOverlay();
  for (const p of particles) {
    hud.fillStyle = PALETTE[p.c];
    const w = Math.abs(Math.sin(p.spin)) > 0.5 ? 2 : 1;
    hud.fillRect(Math.round(p.x), Math.round(p.y), w, 3 - w);
  }
  text('¡LLEGASTE AL MICTLÁN!', 160, 48, 'O', 2, 'center', 'm');
  text(G.delivered > 0 ? `ALMAS QUE CRUZARON: ${G.delivered}` : 'NINGUNA ALMA CRUZÓ ESTA NOCHE…', 160, 80, 'T', 1, 'center', 'k');
  text(`PÉTALOS: ${G.petals}`, 160, 92, 'O', 1, 'center', 'k');
  text(`PUNTOS: ${G.delivered * 10 + G.petals}`, 160, 104, 'b', 1, 'center', 'k');
  if (G.endT > 1.2 && Math.floor(G.time * 2) % 2 === 0) text(IS_TOUCH ? 'TAP TO PLAY AGAIN' : 'SPACE / TAP TO PLAY AGAIN', 160, 134, 'y', 1, 'center', 'k');
}
function updateParticles(dt) {
  if (state === 'win' && G.endT < 6 && Math.random() < 0.6) particles.push(newPetalParticle(false));
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += 60 * dt; p.vx *= 1 - dt * 0.8;
    if (p.vy > 30) p.vy = 30;
    p.x += p.vx * dt; p.y += p.vy * dt; p.spin += dt * 8;
    if (p.y > LOW_H + 4) particles.splice(i, 1);
  }
}

// ===========================================================================
// Main loop
// ===========================================================================
resetRun();
let last = performance.now();
let skyTimer = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state === 'play') {
    updatePlay(dt);
    updateWorld(dt, G.speed);
  } else {
    G.time += dt;
    G.endT += dt;
    const ambient = state === 'title' ? 5 : state === 'win' ? 0 : 2; // the gate stays put on the win screen
    updateWorld(dt, ambient);
    for (const e of entities) e.z += ambient * dt;
    if (state === 'title') { G.paddleT += dt; if (G.paddleT > 0.5) { G.paddleT = 0; G.paddleFrame ^= 1; } updateDecorSpawns(dt); }
    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      if (e.z > CONFIG.despawnZ || (e.kind === 'fx' && (e.life -= dt) <= 0)) { scene.remove(e.s); entities.splice(i, 1); }
    }
    updateTrail();
    updateParticles(dt);
  }
  updatePlayerSprites();
  updateEntitySprites();
  updateCamera(dt);
  updateFog();
  skyTimer -= dt;
  if (skyTimer <= 0) { skyTimer = 0.25; drawSky(state === 'title' ? 0.05 : G.skyP, G.time); }
  drawHUD();
  hudTex.needsUpdate = true;
  jumpBtn.style.display = IS_TOUCH && state === 'play' ? 'block' : 'none';

  // Render the world at 320x180, then upscale with letterboxing.
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.setViewport(viewport.x, viewport.y, viewport.w, viewport.h);
  renderer.render(postScene, postCam);
}
requestAnimationFrame(frame);

// Debug handle for tweaking CONFIG live from the console.
window.XDM = { CONFIG, G, skipToZone, computeZoneTimes, spawnCandle, spawnRow };
