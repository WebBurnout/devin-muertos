// sprites.js — every sprite in the game is a string grid with a 1-char palette key.
// Small sprites are written by hand; large ones (boats, bridge, Mictlán gate) are composed
// into the same kind of grid with tiny drawing helpers so they stay editable.

// ---------------------------------------------------------------------------
// Locked 16-color palette
// ---------------------------------------------------------------------------
export const PALETTE = {
  '.': null,       // transparent
  P: '#1a0b2e',    // deep purple
  V: '#2e1a47',    // night violet
  W: '#1f2b4d',    // water
  o: '#ff9800',    // marigold
  O: '#ffc04d',    // marigold light
  m: '#e0218a',    // magenta
  p: '#ff7eb6',    // pink
  t: '#1fb5a3',    // teal
  T: '#6ef0d8',    // turquoise
  b: '#f4ecd8',    // bone white
  w: '#7a4a2a',    // wood brown
  d: '#4a2a17',    // dark wood
  g: '#2f7a3a',    // leaf green
  G: '#6cc24a',    // light green
  y: '#ffe066',    // candle yellow
  k: '#0d0d0d',    // black
};

// ---------------------------------------------------------------------------
// Tiny proportional pixel font (5 px tall). Used for the HUD and for the names
// painted on the trajinera arches.
// ---------------------------------------------------------------------------
const GLYPHS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#', '##', '.#', '.#', '.#'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  ' ': ['..', '..', '..', '..', '..'],
  '.': ['.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '#', '#'],
  '!': ['#', '#', '#', '.', '#'],
  '¡': ['#', '.', '#', '#', '#'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '¿': ['.#.', '...', '.#.', '#..', '.##'],
  ':': ['.', '#', '.', '#', '.'],
  '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  "'": ['#', '#', '.', '.', '.'],
  '(': ['.#', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '#.'],
  '…': ['.....', '.....', '.....', '.....', '#.#.#'],
  '←': ['.....', '.#...', '#####', '.#...', '.....'],
  '→': ['.....', '...#.', '#####', '...#.', '.....'],
  '↑': ['.#.', '###', '.#.', '.#.', '.#.'],
  '↓': ['.#.', '.#.', '.#.', '###', '.#.'],
};
// Accented capitals reuse the base glyph plus a mark drawn 2px above it.
const ACCENTED = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N', 'Ü': 'U' };

export const FONT_HEIGHT = 5;

function glyphFor(ch) {
  const base = ACCENTED[ch] || ch;
  return { rows: GLYPHS[base] || GLYPHS['?'], mark: ACCENTED[ch] ? (ch === 'Ñ' ? 'tilde' : ch === 'Ü' ? 'dots' : 'acute') : null };
}

/** Width in pixels of a string at scale 1. */
export function textWidth(str) {
  let w = 0;
  for (const ch of str.toUpperCase()) w += glyphFor(ch).rows[0].length + 1;
  return Math.max(0, w - 1);
}

/** Calls fn(px, py) for every lit pixel of the string drawn at (x, y). */
export function forEachTextPixel(str, x, y, fn) {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const { rows, mark } = glyphFor(ch);
    const gw = rows[0].length;
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < gw; rx++) if (row[rx] === '#') fn(cx + rx, y + ry);
    });
    if (mark === 'acute') fn(cx + gw - 1, y - 2);
    if (mark === 'tilde') for (let i = 0; i < gw; i++) if (i % 2 === 0 || i === gw - 1) fn(cx + i, y - 2);
    if (mark === 'dots') { fn(cx, y - 2); fn(cx + gw - 1, y - 2); }
    cx += gw + 1;
  }
  return cx - x - 1;
}

// ---------------------------------------------------------------------------
// Grid: a w*h array of palette keys with small drawing helpers.
// ---------------------------------------------------------------------------
export class Grid {
  constructor(w, h, fill = '.') {
    this.w = w; this.h = h;
    this.c = new Array(w * h).fill(fill);
  }
  /** Builds a grid from an array of strings (short rows are padded). */
  static from(rows) {
    const w = Math.max(...rows.map((r) => [...r].length));
    const g = new Grid(w, rows.length);
    rows.forEach((r, y) => [...r].forEach((ch, x) => g.set(x, y, ch)));
    return g;
  }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? '.' : this.c[y * this.w + x]; }
  set(x, y, ch) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = ch;
    return this;
  }
  rect(x, y, w, h, ch) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch);
    return this;
  }
  line(x0, y0, x1, y1, ch) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, ch);
    return this;
  }
  ellipse(cx, cy, rx, ry, ch) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) this.set(x, y, ch);
      }
    return this;
  }
  /** Copies non-transparent pixels of another grid onto this one. */
  stamp(g, x, y) {
    for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
      const ch = g.get(i, j);
      if (ch !== '.') this.set(x + i, y + j, ch);
    }
    return this;
  }
  text(str, x, y, ch) { forEachTextPixel(str, x, y, (px, py) => this.set(px, py, ch)); return this; }
  textCentered(str, cx, y, ch) { return this.text(str, Math.round(cx - textWidth(str) / 2), y, ch); }
  /** Adds a 1px outline around every opaque shape. */
  outline(ch = 'k') {
    const src = this.c.slice();
    const at = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? '.' : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (at(x, y) !== '.') continue;
      if (at(x - 1, y) !== '.' || at(x + 1, y) !== '.' || at(x, y - 1) !== '.' || at(x, y + 1) !== '.') this.set(x, y, ch);
    }
    return this;
  }
  mirrorX() {
    const g = new Grid(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.set(this.w - 1 - x, y, this.get(x, y));
    return g;
  }
  shift(dy) {
    const g = new Grid(this.w, this.h);
    g.stamp(this, 0, dy);
    return g;
  }
  clone() { const g = new Grid(this.w, this.h); g.c = this.c.slice(); return g; }
  toRows() {
    const rows = [];
    for (let y = 0; y < this.h; y++) rows.push(this.c.slice(y * this.w, (y + 1) * this.w).join(''));
    return rows;
  }
}

/** Draws a grid into a new canvas (1 grid cell = 1 canvas pixel). */
export function gridToCanvas(grid) {
  const cv = document.createElement('canvas');
  cv.width = grid.w; cv.height = grid.h;
  const ctx = cv.getContext('2d');
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
    const col = PALETTE[grid.get(x, y)];
    if (!col) continue;
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  }
  return cv;
}

// Deterministic RNG so procedural sprites look the same on every load.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mirrors 16-char left halves into symmetric 32-wide rows. */
function sym(halves) {
  return halves.map((h) => h + [...h].reverse().join(''));
}

// ---------------------------------------------------------------------------
// Player: xolo (back view) + canoa. Drawn as two sprites so the dog can leap.
// ---------------------------------------------------------------------------
const DOG_HALF = [
  '................', // 0
  '................',
  '........k.......',
  '........kk......',
  '........kVk.....',
  '........kpVk....', // 5
  '........kpVk....',
  '........kVVk...k',
  '........kkVkkkkV',
  '.........kkkkkkk',
  '.........kVkkkkk', // 10
  '.........kVkkkkk',
  '..........kkkkkk',
  '..........oooooo',
  '.........kkkkkkk',
  '........kVkkkkkk', // 15
  '.......kVVkkkkkk',
  '.......kVkkkkkkk',
  '.......kVkkkkkkk',
  '.......kVkkkkkkk',
  '.......kVkkkkkkk', // 20
  '.......kkkkkkkkk',
  '........kkkkkkkk', // 22 (sits on the rim)
  '................',
  '................',
  '................',
  '................', // 26
];
const LEGS_HALF = [
  '.........kk..kk.',
  '.........kV..kV.',
  '.........kV..kV.',
  '.........kk..kk.',
];
const CANOE_HALF = [
  '..dd............', // 0 (row 19 of the original 32x32 sprite)
  '..dwd...........',
  '..dwwd..........',
  '..dwwwd.........',
  '..dddddddddddddd', // rim
  '..dwwwwwwwwwwwww',
  '..dwOwwwwwwwwwww',
  '...dwmmmmmmmmmmm',
  '...dwwwwwwwwwwww',
  '....dwwwwwwwwwww',
  '.....ddddddddddd',
  '................',
  '................',
];

function dogFrames() {
  const normal = Grid.from(sym(DOG_HALF));
  // Ear twitch frame: ear tips fold slightly.
  const twitch = normal.clone();
  twitch.set(8, 2, '.'); twitch.set(23, 2, '.');
  twitch.set(9, 2, 'k'); twitch.set(22, 2, 'k');
  // Jump frame: legs stretched out below the body.
  const jump = normal.clone();
  jump.stamp(Grid.from(sym(LEGS_HALF)), 0, 23);
  // Duck frame: head and shoulders lowered to the rim, ears flattened back.
  const duck = new Grid(32, 27);
  const upper = new Grid(32, 11);
  for (let y = 7; y <= 17; y++) for (let x = 0; x < 32; x++) upper.set(x, y - 7, normal.get(x, y));
  for (let x = 0; x < 32; x++) { upper.set(x, 0, '.'); }
  duck.stamp(upper, 0, 12);
  duck.rect(9, 12, 3, 1, 'k').rect(20, 12, 3, 1, 'k');
  duck.set(7, 13, 'k').set(8, 13, 'V').set(24, 13, 'k').set(23, 13, 'V');
  return { normal, twitch, jump, duck };
}

function canoeFrames() {
  const base = Grid.from(sym(CANOE_HALF));
  const a = base.clone();
  // Oar on the left, splash at the blade.
  a.line(6, 0, 1, 9, 'w');
  a.rect(0, 9, 2, 2, 'd');
  a.set(0, 11, 'T').set(1, 12, 'b').set(2, 11, 'T').set(3, 12, 'T');
  a.set(12, 11, 'T').set(20, 12, 'T');
  const b = a.mirrorX();
  return [a, b];
}

// ---------------------------------------------------------------------------
// Souls & pickups
// ---------------------------------------------------------------------------
const SOUL = Grid.from([
  '....tttt....',
  '..ttTTTTtt..',
  '.tTTbbbbTTt.',
  '.tTbbmmbbTt.',
  'tTbkkbbkkbTt',
  'tTbkkbbkkbTt',
  'tTbbbkkbbbTt',
  'tTTbbbbbbTTt',
  '.tTbkbkbkTt.',
  '.tTTbbbbTTt.',
  '..ttTTTTtt..',
  '....tttt....',
]);

const PETAL = Grid.from([
  '..o.o...',
  '.oOoOo..',
  'oOOyOOo.',
  '.oyOyo..',
  'oOOyOOo.',
  '.oOoOo..',
  '..o.o...',
  '........',
]);

const CANDLE_A = Grid.from([
  '...y....',
  '..yOy...',
  '..yOy...',
  '...o....',
  '...k....',
  '..bbbb..',
  '..bbbp..',
  '..bbbb..',
  '..bbbb..',
  '..bbbb..',
  '.wwwwww.',
  '.dddddd.',
]);
const CANDLE_B = Grid.from([
  '....y...',
  '...yO...',
  '..yOy...',
  '...o....',
  '...k....',
  '..bbbb..',
  '..bbbp..',
  '..bbbb..',
  '..bbbb..',
  '..bbbb..',
  '.wwwwww.',
  '.dddddd.',
]);

function panDeMuerto() {
  const g = new Grid(12, 12);
  g.ellipse(5.5, 7, 5, 4, 'o');
  g.ellipse(5.5, 6, 4, 2.5, 'O');
  g.rect(1, 10, 10, 1, 'w');
  // huesitos (bone-shaped dough) in a cross
  g.line(2, 5, 9, 9, 'w').line(2, 9, 9, 5, 'w');
  g.set(2, 5, 'b').set(9, 9, 'b').set(2, 9, 'b').set(9, 5, 'b');
  g.ellipse(5.5, 3, 1.5, 1.2, 'w');
  g.set(5, 2, 'O');
  g.set(3, 7, 'b').set(8, 6, 'b').set(6, 8, 'y');
  return g.outline('d');
}

const AJOLOTE = Grid.from([
  'm..............m',
  '.m.m.pppppp.m.m.',
  '..mmppppppppmm..',
  '.m.mpkppppkpm.m.',
  'm...pppppppp...m',
  '....ppmmmmpp....',
  '.....pppppp.....',
  '....p.pppp.p....',
  '...p...pp...p...',
  '.......pp.......',
]);

const SPARKLE_A = Grid.from([
  '...b...',
  '...T...',
  '.......',
  'bT.y.Tb',
  '.......',
  '...T...',
  '...b...',
]);
const SPARKLE_B = Grid.from([
  '.......',
  '.b...b.',
  '..T.T..',
  '...y...',
  '..T.T..',
  '.b...b.',
  '.......',
]);

// Floating cempasúchil blossom on a lily pad (ambient decor; not a pickup).
const FLOAT_FLOWER_A = Grid.from([
  '..oOo...',
  '.oOyOo..',
  '.mOOOm..',
  '..oOo...',
  'gGgggGg.',
  '.gggggg.',
  '..T..T..',
  '........',
]);
const FLOAT_FLOWER_B = Grid.from([
  '..oOo...',
  '.oOyOo..',
  '.mOOOm..',
  '..oOo...',
  'gGgggGg.',
  '.gggggg.',
  '...T..T.',
  '........',
]);
// ---------------------------------------------------------------------------
// Boats
// ---------------------------------------------------------------------------
function trajinera({ name, arch, trim, text, hull, stripe, roof }, mariachi = false) {
  const g = new Grid(64, 40);
  // Hull (stern view): trapezoid narrowing to the waterline.
  for (let y = 29; y <= 38; y++) {
    const inset = Math.floor((y - 29) / 3);
    g.rect(1 + inset, y, 62 - 2 * inset, 1, hull);
  }
  g.rect(1, 29, 62, 1, 'd');
  g.rect(2, 32, 60, 2, stripe);
  for (let x = 4; x < 60; x += 6) g.set(x, 35, trim);
  // Under the canopy: dark interior, posts.
  g.rect(2, 14, 60, 15, 'P');
  for (const px of [3, 20, 42, 59]) g.rect(px, 14, 2, 15, 'd');
  if (mariachi) {
    const instruments = ['guitar', 'trumpet', 'violin', 'trumpet', 'guitar', 'violin'];
    [6, 13, 24, 32, 45, 52].forEach((x, i) => mariachiFigure(g, x, 18, instruments[i]));
  } else {
    // Party on board: a table and a few guests in bright shirts.
    g.rect(14, 24, 36, 2, 'm');
    g.rect(14, 26, 36, 1, 'p');
    for (let x = 16; x < 48; x += 5) { g.set(x, 23, 'y'); }
    [[8, 'T'], [24, 'o'], [36, 'G'], [53, 'p']].forEach(([x, shirt]) => {
      g.rect(x, 19, 3, 3, 'w');
      g.rect(x - 1, 22, 5, 5, shirt);
    });
  }
  // Roof.
  g.rect(0, 12, 64, 3, roof);
  g.rect(0, 14, 64, 1, 'd');
  // Painted arch with the boat's name.
  const insets = [12, 7, 5, 3, 2, 2, 1, 1, 1, 1, 1, 1];
  for (let y = 0; y < 12; y++) g.rect(insets[y], y, 64 - 2 * insets[y], 1, arch);
  for (let y = 0; y < 12; y++) {
    g.set(insets[y], y, trim); g.set(63 - insets[y], y, trim);
  }
  g.rect(insets[0], 0, 64 - 2 * insets[0], 1, trim);
  // Flowers along the top edge of the arch.
  const flowerCols = ['o', 'm', 'y', 'p', 'T'];
  let fi = 0;
  for (let x = insets[0] + 1; x < 64 - insets[0] - 1; x += 4) g.set(x, 0, flowerCols[fi++ % flowerCols.length]);
  g.textCentered(name, 32, 5, text);
  return g.outline('k');
}

function mariachiFigure(g, x, y, instrument) {
  const fig = Grid.from([
    '..OOO..',
    '..OmO..',
    'OOOOOOO',
    '..www..',
    '..wkw..',
    '.kkbkk.',
    'kkkbkkk',
    '.kOkOk.',
    '.kkkkk.',
    '.k...k.',
  ]);
  g.stamp(fig, x, y);
  if (instrument === 'guitar') g.ellipse(x + 2, y + 7, 1.5, 1, 'o').line(x + 3, y + 6, x + 6, y + 4, 'w');
  if (instrument === 'trumpet') g.line(x + 3, y + 4, x + 7, y + 4, 'y').set(x + 7, y + 3, 'y').set(x + 7, y + 5, 'y');
  if (instrument === 'violin') g.line(x + 4, y + 5, x + 6, y + 6, 'w').line(x + 2, y + 3, x + 7, y + 7, 'b');
}

function vendorCanoe() {
  const g = new Grid(32, 20);
  // Long canoe, side view.
  g.rect(2, 14, 28, 1, 'd');
  g.rect(2, 15, 28, 1, 'w');
  g.rect(4, 16, 24, 1, 'w');
  g.rect(7, 17, 18, 1, 'd');
  g.set(1, 13, 'd').set(30, 13, 'd');
  // Mountain of cempasúchil and terciopelo flowers at the bow.
  g.ellipse(9, 10, 6, 4, 'o');
  const r = rng(7);
  for (let i = 0; i < 18; i++) g.set(4 + r() * 11, 7 + r() * 7, r() < 0.5 ? 'O' : r() < 0.6 ? 'm' : 'o');
  g.set(6, 6, 'G').set(11, 6, 'G').set(9, 5, 'O');
  // Flower seller with straw hat and rebozo.
  g.rect(19, 3, 5, 2, 'O');
  g.rect(17, 5, 9, 1, 'O');
  g.rect(20, 6, 3, 2, 'w');
  g.rect(19, 8, 5, 6, 'm');
  g.rect(19, 10, 5, 1, 'p');
  g.set(18, 9, 'w').set(24, 9, 'w');
  // Pole.
  g.line(26, 2, 29, 18, 'd');
  return g.outline('k');
}

function lirio(seed) {
  const g = new Grid(32, 12);
  const r = rng(seed);
  for (let i = 0; i < 9; i++) {
    const cx = 3 + r() * 26, cy = 6 + r() * 4;
    g.ellipse(cx, cy, 2 + r() * 2, 1 + r(), 'g');
    g.set(cx - 1, cy - 1, 'G');
  }
  for (let i = 0; i < 5; i++) {
    const cx = Math.round(4 + r() * 24), cy = Math.round(2 + r() * 4);
    g.set(cx, cy, 'p').set(cx - 1, cy, 'm').set(cx + 1, cy, 'm').set(cx, cy - 1, 'm').set(cx, cy + 1, 'y');
  }
  return g.outline('P');
}

// ---------------------------------------------------------------------------
// Duck obstacles
// ---------------------------------------------------------------------------
function bridge() {
  const W = 240, H = 60, g = new Grid(W, H);
  // Bank supports.
  g.rect(0, 14, 14, 46, 'd').rect(W - 14, 14, 14, 46, 'd');
  for (const x of [3, 9, W - 11, W - 5]) g.rect(x, 16, 1, 44, 'w');
  // Railing.
  g.rect(0, 14, W, 2, 'w').rect(0, 16, W, 1, 'd');
  for (let x = 0; x < W; x += 16) g.rect(x, 14, 2, 10, 'd');
  for (let x = 8; x < W; x += 32) { g.set(x, 11, 'y').set(x, 12, 'O').rect(x, 13, 1, 1, 'b'); }
  // Deck planks.
  g.rect(0, 24, W, 8, 'w');
  for (let x = 0; x < W; x += 6) g.rect(x, 24, 1, 8, 'd');
  g.rect(0, 24, W, 1, 'O');
  g.rect(0, 31, W, 2, 'd');
  // Marigold garland swags hanging under the deck.
  for (let s = 14; s < W - 14; s += 24) {
    for (let i = 0; i <= 24; i++) {
      const y = 33 + Math.round(3 * Math.sin((Math.PI * i) / 24));
      g.set(s + i, y, i % 3 === 0 ? 'O' : i % 7 === 0 ? 'm' : 'o');
    }
  }
  return g;
}

function papelPicadoFlag(g, x, y, w, h, col) {
  g.rect(x, y, w, h, col);
  // Cut-out pattern.
  for (let j = 2; j < h - 2; j++) for (let i = 1; i < w - 1; i++) if ((i + j) % 3 === 0 && (i * j) % 2 === 0) g.set(x + i, y + j, '.');
  // Zig-zag bottom edge.
  for (let i = 0; i < w; i += 2) g.set(x + i, y + h - 1, '.');
}

function banner() {
  const g = new Grid(64, 56);
  g.rect(1, 4, 2, 52, 'd').rect(61, 4, 2, 52, 'd');
  g.rect(1, 2, 2, 2, 'O').rect(61, 2, 2, 2, 'O');
  for (let x = 3; x <= 60; x++) g.set(x, 19 + Math.round(2 * Math.sin((Math.PI * (x - 3)) / 57)), 'b');
  const cols = ['m', 'o', 'T', 'p', 'y', 'G', 'm'];
  for (let i = 0; i < 7; i++) {
    const fx = 4 + i * 8;
    const ry = 20 + Math.round(2 * Math.sin((Math.PI * (fx + 3 - 3)) / 57));
    papelPicadoFlag(g, fx, ry, 7, 12, cols[i]);
  }
  return g;
}

// High decorative string of papel picado across the whole canal.
function bunting() {
  const W = 240, g = new Grid(W, 18);
  for (let x = 0; x < W; x++) g.set(x, 2 + Math.round(3 * Math.sin((Math.PI * x) / W)), 'b');
  const cols = ['m', 'o', 'T', 'p', 'y', 'G'];
  for (let i = 0, fx = 3; fx < W - 8; fx += 10, i++) {
    papelPicadoFlag(g, fx, 3 + Math.round(3 * Math.sin((Math.PI * (fx + 3)) / W)), 7, 10, cols[i % cols.length]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Scenery
// ---------------------------------------------------------------------------
function ahuejote(seed) {
  const g = new Grid(16, 64), r = rng(seed);
  g.rect(7, 48, 2, 16, 'd');
  g.rect(7, 50, 1, 14, 'w');
  for (let y = 0; y < 54; y++) {
    const t = y / 53;
    const hw = 6 * Math.pow(Math.sin(Math.PI * Math.min(0.97, Math.pow(t, 0.75))), 0.8) + 0.4;
    const j = r() < 0.4 ? (r() < 0.5 ? -1 : 1) : 0;
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5;
      if (Math.abs(dx) > hw + j) continue;
      let ch = 'g';
      if (dx < -hw * 0.25 && r() < 0.3) ch = 'G';
      if (dx > hw * 0.3 && r() < 0.35) ch = 'P';
      g.set(x, y, ch);
    }
  }
  return g;
}

function chinampa(seed) {
  const g = new Grid(48, 20), r = rng(seed);
  g.rect(0, 9, 48, 11, 'd');
  for (let x = 0; x < 48; x++) {
    if (r() < 0.5) g.set(x, 13, 'w');
    if (r() < 0.3) g.set(x, 17, 'w');
  }
  for (let x = 3; x < 48; x += 8) g.rect(x, 8, 2, 12, 'w').rect(x + 1, 9, 1, 11, 'd');
  g.rect(0, 7, 48, 3, 'g');
  for (let x = 0; x < 48; x++) if (r() < 0.4) g.set(x, 7 + Math.floor(r() * 2), 'G');
  // Beds of cempasúchil.
  for (let i = 0; i < 11; i++) {
    const cx = 2 + r() * 44, cy = 3 + r() * 3;
    g.set(cx, cy + 2, 'G').set(cx - 1, cy + 3, 'g');
    g.ellipse(cx, cy, 1.4, 1.2, 'o');
    g.set(cx, cy, 'O');
  }
  return g;
}

function dock() {
  const g = new Grid(48, 28);
  for (const x of [2, 15, 28, 41]) g.rect(x, 12, 3, 16, 'd').rect(x, 12, 1, 16, 'w');
  g.rect(0, 12, 48, 4, 'w');
  for (let x = 0; x < 48; x += 6) g.rect(x, 12, 1, 3, 'd');
  g.rect(0, 15, 48, 1, 'd');
  g.rect(4, 1, 40, 9, 'm');
  g.rect(4, 1, 40, 1, 'O').rect(4, 9, 40, 1, 'O').rect(4, 1, 1, 9, 'O').rect(43, 1, 1, 9, 'O');
  g.textCentered('NATIVITAS', 24, 3, 'b');
  g.rect(9, 10, 1, 2, 'd').rect(38, 10, 1, 2, 'd');
  for (const x of [3, 42]) g.set(x, 10, 'y').set(x, 11, 'O');
  for (let x = 1; x < 47; x += 5) g.set(x, 27, 'T');
  return g.outline('k');
}

const DOLL = Grid.from([
  '....b.....',
  '....b.....',
  '...OOO....',
  '..ObbbO...',
  '..bkbtb...',
  '..bbbbb...',
  '...bpb....',
  '..pppppp..',
  '.bpmpmpb..',
  '..pppppp..',
  '..ppmppp..',
  '..pppppp..',
  '...b..b...',
  '...b..b...',
  '..kk..kk..',
  '..........',
]);

function llorona() {
  const g = new Grid(24, 40);
  // Flowing dress, widening to wispy tatters.
  for (let y = 12; y < 40; y++) {
    const hw = Math.round(3.5 + (y - 12) * 0.28);
    for (let x = 12 - hw; x < 12 + hw; x++) {
      if (y > 33 && (x + y) % 3 === 0) continue;
      g.set(x, y, (x === 12 - hw || x === 11 + hw || (x - 12) % 4 === 0) && y > 16 ? 'T' : 'b');
    }
  }
  // Outstretched sleeves.
  g.rect(5, 13, 14, 2, 'b');
  g.rect(2, 14, 4, 2, 'b').rect(18, 14, 4, 2, 'b');
  g.rect(1, 16, 3, 3, 'T').rect(20, 16, 3, 3, 'T');
  g.set(1, 19, 'T').set(22, 19, 'T');
  // Long dark hair, framing the face and falling over the dress.
  g.rect(7, 1, 10, 3, 'k');
  g.rect(6, 3, 3, 22, 'k').rect(15, 3, 3, 22, 'k');
  g.set(6, 25, 'k').set(17, 25, 'k').set(7, 26, 'k').set(16, 26, 'k');
  // Pale face with hollow eyes.
  g.rect(9, 4, 6, 7, 'b');
  g.rect(10, 6, 1, 2, 'k').rect(13, 6, 1, 2, 'k');
  g.rect(11, 9, 2, 1, 'V');
  return g;
}

/** A waving calavera (skeleton) with marigolds in its raised hands. */
function calaca(g, x, y) {
  g.ellipse(x, y - 13, 2.5, 2.5, 'b');
  g.set(x - 1, y - 13, 'k').set(x + 1, y - 13, 'k').set(x, y - 11, 'k');
  g.rect(x, y - 10, 1, 6, 'b');
  for (let i = 0; i < 3; i++) g.rect(x - 2, y - 9 + i * 2, 5, 1, 'b');
  g.line(x - 2, y - 9, x - 5, y - 14, 'b').line(x + 2, y - 9, x + 5, y - 14, 'b');
  g.set(x - 5, y - 15, 'o').set(x + 5, y - 15, 'o').set(x - 5, y - 16, 'O').set(x + 5, y - 16, 'O');
  g.line(x, y - 4, x - 2, y, 'b').line(x, y - 4, x + 2, y, 'b');
}

/** The gates of Mictlán: a marigold arch around a glowing portal, between stepped pyramids. */
function mictlan() {
  const W = 128, H = 80, g = new Grid(W, H), r = rng(91), cx = 64;
  // Floating island of dark stone, dripping light.
  for (let y = 62; y < H; y++) {
    const inset = Math.floor((y - 62) * 1.7);
    g.rect(8 + inset, y, W - 16 - 2 * inset, 1, (y + inset) % 4 === 0 ? 'P' : 'V');
  }
  g.rect(8, 60, W - 16, 2, 'V').rect(8, 60, W - 16, 1, 'T');
  for (let x = 12; x < W - 12; x += 2) if (r() < 0.35) g.rect(x, 63 + Math.floor(r() * 6), 1, 1 + Math.floor(r() * 3), 'T');
  // Stepped pyramids with skull racks (tzompantli) and a shrine on top.
  for (const px of [20, 108]) {
    for (let s = 0; s < 5; s++) {
      const hw = 17 - s * 3, top = 60 - (s + 1) * 6;
      g.rect(px - hw, top, hw * 2, 6, s % 2 ? 'W' : 'V').rect(px - hw, top, hw * 2, 1, 'T');
      for (let x = px - hw + 2; x < px + hw - 2; x += 4) g.rect(x, top + 2, 2, 2, 'b').set(x, top + 3, 'k').set(x + 1, top + 3, 'k');
    }
    g.rect(px - 4, 22, 8, 8, 'm').rect(px - 5, 21, 10, 2, 'o').rect(px - 1, 25, 2, 5, 'k');
    g.set(px, 18, 'y').set(px, 19, 'O').set(px, 20, 'o');
  }
  // Portal: rings of cold light swirling inward.
  const rings = ['t', 'T', 'b', 'T', 't', 'W', 't', 'T', 'b', 'y'];
  rings.forEach((c, i) => g.ellipse(cx, 36, 25 - i * 2.4, 25 - i * 2.4, c));
  for (let a = 0; a < 26; a += 0.18) {
    const rr = 23 - a * 0.85;
    if (rr > 1) g.set(cx + Math.cos(a) * rr, 36 + Math.sin(a) * rr, 'b');
  }
  // Marigold arch around the portal.
  for (let y = 0; y <= 60; y++) for (let x = 0; x < W; x++) {
    const dx = (x - cx) / 32, dy = (y - 60) / 58;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= 1 && d >= 0.86) g.set(x, y, r() < 0.15 ? 'm' : r() < 0.35 ? 'O' : 'o');
  }
  // Papel picado strung across the top of the arch.
  const cols = ['m', 'T', 'y', 'p', 'G', 'o'];
  for (let x = 40; x < 89; x++) g.set(x, 8 + Math.round(2 * Math.sin((Math.PI * (x - 40)) / 48)), 'b');
  for (let i = 0, fx = 42; fx < 84; fx += 8, i++) papelPicadoFlag(g, fx, 9 + Math.round(2 * Math.sin((Math.PI * (fx - 38)) / 48)), 5, 7, cols[i % cols.length]);
  // Stairway of light up into the portal, strewn with cempasúchil petals.
  for (let s = 0; s < 8; s++) {
    const y = 59 - s * 2, hw = 14 - s;
    g.rect(cx - hw, y, hw * 2, 2, s % 2 ? 'T' : 'b');
    for (let x = cx - hw + 1; x < cx + hw - 1; x += 3) if (r() < 0.6) g.set(x, y, 'o');
  }
  // Calaveras welcoming the souls.
  calaca(g, 44, 59); calaca(g, 84, 59);
  for (let i = 0; i < 18; i++) g.set(10 + r() * 108, 2 + r() * 20, r() < 0.5 ? 'y' : 'b');
  return g;
}

// ---------------------------------------------------------------------------
// Export: name -> array of frames (Grids)
// ---------------------------------------------------------------------------
const dogs = dogFrames();
const canoes = canoeFrames();
const TRAJ_STYLES = [
  { name: 'LUPITA', arch: 'm', trim: 'O', text: 'b', hull: 't', stripe: 'o', roof: 'o' },
  { name: 'XÓCHITL', arch: 't', trim: 'y', text: 'b', hull: 'o', stripe: 'm', roof: 'm' },
  { name: 'LA GUADALUPANA', arch: 'o', trim: 'm', text: 'k', hull: 'm', stripe: 'T', roof: 't' },
];
const vendor = vendorCanoe();

const BASE = {
  dog: [dogs.normal, dogs.twitch],
  dogJump: [dogs.jump],
  dogDuck: [dogs.duck],
  canoe: canoes,
  soul: [SOUL, SOUL.shift(-1)],
  traj0: [trajinera(TRAJ_STYLES[0])],
  traj1: [trajinera(TRAJ_STYLES[1])],
  traj2: [trajinera(TRAJ_STYLES[2])],
  mariachi: [trajinera({ name: 'MARIACHI', arch: 'V', trim: 'O', text: 'O', hull: 'w', stripe: 'm', roof: 'm' }, true)],
  vendorL: [vendor],
  vendorR: [vendor.mirrorX()],
  lirio: [lirio(11), lirio(23)],
  bridge: [bridge()],
  banner: [banner()],
  bunting: [bunting()],
  ahuejote: [ahuejote(1), ahuejote(2), ahuejote(3)],
  chinampa: [chinampa(5), chinampa(9), chinampa(13)],
  dock: [dock()],
  petal: [PETAL],
  candle: [CANDLE_A, CANDLE_B],
  floatFlower: [FLOAT_FLOWER_A, FLOAT_FLOWER_B],
  pan: [panDeMuerto()],
  ajolote: [AJOLOTE],
  sparkle: [SPARKLE_A, SPARKLE_B],
  llorona: [llorona()],
  doll: [DOLL],
  afterlife: [mictlan()],
};

// ---------------------------------------------------------------------------
// High-res pass: every sprite is doubled with EPX (smooths diagonals and
// curves), then rim-lit and textured using only palette colors.
// ---------------------------------------------------------------------------
const LIGHT = { o: 'O', O: 'y', m: 'p', t: 'T', d: 'w', g: 'G', T: 'b', p: 'b', y: 'b', w: 'o' };
const DARK = { O: 'o', o: 'w', y: 'O', T: 't', t: 'W', p: 'm', m: 'V', G: 'g', g: 'd', w: 'd', d: 'k', V: 'P', W: 'P', b: 'T' };

function epx(src) {
  const g = new Grid(src.w * 2, src.h * 2);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const P = src.get(x, y), A = src.get(x, y - 1), B = src.get(x + 1, y), C = src.get(x - 1, y), D = src.get(x, y + 1);
    let p1 = P, p2 = P, p3 = P, p4 = P;
    if (C === A && C !== D && A !== B) p1 = A;
    if (A === B && A !== C && B !== D) p2 = B;
    if (D === C && D !== B && C !== A) p3 = C;
    if (B === D && B !== A && D !== C) p4 = D;
    g.set(2 * x, 2 * y, p1).set(2 * x + 1, 2 * y, p2).set(2 * x, 2 * y + 1, p3).set(2 * x + 1, 2 * y + 1, p4);
  }
  return g;
}

function shade(g) {
  const s = g.clone();
  const open = (x, y) => { const c = s.get(x, y); return c === '.' || c === 'k'; };
  const hash = (x, y) => (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = s.get(x, y);
    if (c === '.') continue;
    let n = c;
    if (c === 'k') { if (s.get(x, y - 1) === '.') n = 'V'; }
    else if (open(x, y - 1) && LIGHT[c]) n = LIGHT[c];
    else if ((open(x, y + 1) || open(x + 1, y)) && DARK[c]) n = DARK[c];
    else {
      const h = hash(x, y);
      if (c === 'w' && (y * 7 + (x >> 2) * 5) % 9 === 0 && h % 3) n = 'd';
      else if (c === 'g' && h % 11 === 0) n = 'G';
      else if (c === 'o' && h % 13 === 0) n = 'O';
      else if (c === 'm' && h % 19 === 0) n = 'p';
    }
    g.set(x, y, n);
  }
  return g;
}

export function hires(grid) { return shade(epx(grid)); }

/** La Llorona, drawn natively at high resolution (48x80). */
function lloronaHD() {
  const W = 48, H = 80, cx = 24, g = new Grid(W, H);
  // Flowing gown that widens into ragged, ghostly tatters.
  for (let y = 24; y < H; y++) {
    const hw = 7 + (y - 24) * 0.3 + Math.sin(y * 0.35) * 1.2;
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      if (y > 62) {
        const strand = Math.floor((x + 99) / 3);
        if (y > 64 + ((strand * 7) % 14)) continue;
      }
      const edge = x <= cx - hw + 1 || x >= cx + hw - 2;
      const fold = Math.round(x - cx + Math.sin(y * 0.2) * 1.5) % 6 === 0;
      g.set(x, y, edge || fold ? 'T' : y > 56 && (x + y) % 7 === 0 ? 'T' : 'b');
    }
  }
  // Outstretched arms with long drooping sleeves.
  for (let x = 5; x < 43; x++) g.rect(x, 26 + Math.abs(x - cx) * 0.12, 1, 3, 'b');
  for (const [x0, x1] of [[5, 18], [30, 43]]) {
    for (let x = x0; x < x1; x++) {
      const len = 4 + ((x * 5) % 8);
      g.rect(x, 29 + Math.abs(x - cx) * 0.12, 1, len, x % 3 === 0 ? 'T' : 'b');
    }
  }
  // Bony, reaching hands.
  for (const [hx, dir] of [[4, -1], [43, 1]]) {
    g.rect(hx - (dir > 0 ? 0 : 2), 28, 3, 3, 'b');
    for (let f = 0; f < 3; f++) g.line(hx + dir, 28 + f, hx + dir * 4, 30 + f * 2, f === 1 ? 'b' : 'T');
  }
  // Long black hair, strands catching violet moonlight.
  g.ellipse(cx - 0.5, 10, 9.5, 8, 'k');
  for (let x = cx - 10; x <= cx + 9; x++) {
    if (Math.abs(x - cx + 0.5) < 5) continue;
    const len = 24 + ((x * 11) % 9) + (Math.abs(x - cx + 0.5) > 7 ? 10 : 0);
    g.rect(x, 12, 1, len, 'k');
    if ((x * 7) % 3 === 0) g.rect(x, 14 + ((x * 5) % 6), 1, len - 10, 'V');
  }
  // Marigold crown.
  for (const fx of [16, 20, 24, 28, 32]) {
    const fy = 3 + Math.round(Math.abs(fx - cx) * 0.25);
    g.set(fx, fy, 'O').set(fx - 1, fy, 'o').set(fx + 1, fy, 'o').set(fx, fy - 1, 'o').set(fx, fy + 1, 'o');
  }
  g.rect(20, 18, 8, 8, 'b');
  // Pale face: hollow eyes with a cold glow, tear streaks, open wailing mouth.
  g.ellipse(cx - 0.5, 15, 4.5, 6.5, 'b');
  g.rect(19, 12, 3, 3, 'k').rect(26, 12, 3, 3, 'k');
  g.set(20, 13, 'T').set(27, 13, 'T');
  g.rect(20, 15, 1, 4, 'T').rect(27, 15, 1, 4, 'T');
  g.ellipse(cx - 0.5, 19.5, 1.5, 2, 'k');
  g.set(23, 18, 'V').set(24, 18, 'V');
  g.rect(20, 10, 2, 1, 'T').rect(26, 10, 2, 1, 'T');
  return g;
}

/** Low-res originals, used for the 320x180 HUD icons. */
export const ICONS = BASE;
export const SPRITES = Object.fromEntries(Object.entries(BASE).map(([k, frames]) => [k, frames.map(hires)]));
SPRITES.llorona = [lloronaHD()];
