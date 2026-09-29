'use strict';
/* =====================================================================
   KAGE-KEN 影拳 · WORLD TOUR
   Juego de peleas en pixel art (jugador vs CPU) — HTML5 Canvas puro.
   Resolución interna 320x180, escalada con nearest-neighbour.
   ===================================================================== */

// ---------------------------------------------------------------- BASE
const W = 320, H = 180;
const FLOOR_TOP = 122, FLOOR_H = 46;      // banda de suelo (profundidad z 0..1)
const cv = document.getElementById('game');
cv.width = W; cv.height = H;
let ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

function fit() {
  const s = Math.max(1, Math.min(innerWidth / W, (innerHeight - 30) / H));
  cv.style.width = Math.floor(W * s) + 'px';
  cv.style.height = Math.floor(H * s) + 'px';
}
addEventListener('resize', fit); fit();

// ---------------------------------------------------------------- UTIL
const rad = d => d * Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
function lcg(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
function limb(x0, y0, x1, y1, th, c) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy), 1) | 0, o = Math.floor(th / 2);
  ctx.fillStyle = c;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + dx * i / n) - o, Math.round(y0 + dy * i / n) - o, th, th);
}
function bands(cols, y0, y1) { const h = (y1 - y0) / cols.length; cols.forEach((c, i) => rect(0, y0 + i * h, W, h + 1, c)); }
function text(s, x, y, c, size, align) {
  ctx.font = (size || 8) + "px 'Press Start 2P','Courier New',monospace";
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = c;
  ctx.fillText(s, Math.round(x), Math.round(y));
}
function textO(s, x, y, c, o, size, align) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) text(s, x + dx, y + dy, o, size, align);
  text(s, x, y, c, size, align);
}
function jp(s, x, y, c, size, align, bold) {
  ctx.font = (bold ? 'bold ' : '') + (size || 9) + "px 'Meiryo','Yu Gothic','MS Gothic','Noto Sans JP',sans-serif";
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = c;
  ctx.fillText(s, Math.round(x), Math.round(y));
}
function jpO(s, x, y, c, o, size, align) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) jp(s, x + dx, y + dy, o, size, align, true);
  jp(s, x, y, c, size, align, true);
}

// ---------------------------------------------------------------- INPUT
const keys = {}, pressed = {};
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'punch', KeyJ: 'punch', KeyX: 'kick', KeyK: 'kick',
  KeyC: 'special', KeyL: 'special', ShiftLeft: 'block', ShiftRight: 'block', KeyV: 'block',
  Enter: 'start', Escape: 'back', KeyM: 'mute'
};
addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  if (k) { if (!keys[k] && !e.repeat) pressed[k] = true; keys[k] = true; e.preventDefault(); }
  audioInit();
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------------------------------------------------------------- AUDIO
let AC = null, noiseBuf = null, muted = false;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    music.next = AC.currentTime + 0.1;
  } catch (e) { AC = null; }
}
function tone(f, t, d, type, g) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), gn = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0005, t + d);
  o.connect(gn); gn.connect(AC.destination); o.start(t); o.stop(t + d + 0.02);
}
function sweep(f0, f1, d, type, g) {
  if (!AC || muted) return;
  const t = AC.currentTime, o = AC.createOscillator(), gn = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
  gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0005, t + d);
  o.connect(gn); gn.connect(AC.destination); o.start(t); o.stop(t + d + 0.02);
}
function noise(t, d, g, hp) {
  if (!AC || muted) return;
  const s = AC.createBufferSource(), gn = AC.createGain(), f = AC.createBiquadFilter();
  s.buffer = noiseBuf; f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp ? 4000 : 900;
  gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0005, t + d);
  s.connect(f); f.connect(gn); gn.connect(AC.destination); s.start(t); s.stop(t + d + 0.02);
}
function sfx(n) {
  if (!AC) return; const t = AC.currentTime;
  switch (n) {
    case 'punch': sweep(220, 70, 0.1, 'square', 0.18); noise(t, 0.07, 0.18); break;
    case 'kick': sweep(140, 40, 0.16, 'square', 0.22); noise(t, 0.11, 0.22); break;
    case 'block': sweep(700, 350, 0.07, 'square', 0.1); noise(t, 0.04, 0.08, true); break;
    case 'swing': noise(t, 0.06, 0.05, true); break;
    case 'jump': sweep(220, 520, 0.14, 'square', 0.08); break;
    case 'fire': sweep(260, 1100, 0.3, 'sawtooth', 0.1); noise(t, 0.25, 0.07); break;
    case 'ko': sweep(420, 45, 0.8, 'sawtooth', 0.22); noise(t, 0.5, 0.2); break;
    case 'sel': sweep(500, 900, 0.06, 'square', 0.08); break;
    case 'ok': tone(660, t, 0.08, 'square', 0.1); tone(990, t + 0.08, 0.14, 'square', 0.1); break;
    case 'gong': sweep(180, 120, 1.4, 'triangle', 0.3); tone(240, t, 1.2, 'sine', 0.2); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.25, 'square', 0.1)); break;
    case 'lose': [440, 370, 311, 220].forEach((f, i) => tone(f, t + i * 0.16, 0.3, 'sawtooth', 0.1)); break;
  }
}
// --- secuenciador de música (escala japonesa "hirajoshi" + pentatónica)
const music = { on: true, next: 0, step: 0, root: 220, tempo: 0.19 };
const LEAD = [0, 3, 5, 7, 10, 7, 5, 3, 0, -1, 3, 5, 7, -1, 12, 10,
              7, 8, 7, 3, 2, 0, -1, -1, 3, 7, 8, 12, 15, 12, 8, 7];
const BASS = [0, -1, 0, 0, 7, -1, 7, 5, 3, -1, 3, 3, 10, -1, 8, 7];
function musicTick() {
  if (!AC || !music.on || muted) return;
  const d = music.tempo;
  while (music.next < AC.currentTime + 0.2) {
    const i = music.step % 32, t = music.next;
    const n = LEAD[i]; if (n >= 0) tone(music.root * 2 * Math.pow(2, n / 12), t, d * 0.85, 'square', 0.035);
    const b = BASS[i % 16]; if (b >= 0) tone(music.root / 2 * Math.pow(2, b / 12), t, d * 0.9, 'triangle', 0.09);
    if (i % 4 === 0) { noise(t, 0.06, 0.07); tone(80, t, 0.08, 'sine', 0.15); }
    else if (i % 2 === 0) noise(t, 0.02, 0.025, true);
    music.next += d; music.step++;
  }
}

// ---------------------------------------------------------------- SPRITES (cabezas 8x9, miran a la derecha)
const HEADS = {
  spiky: [
    '..h..h.h', '.hhhhhh.', 'hhhhhhhh', 'hhhhhhhh', 'hhssssss', '.hsssess', '.hssssss', '..sssss.', '...ssss.'],
  topknot: [
    '...hh...', '..hhhh..', '..hhhh..', '.hhhhhh.', 'hhssssss', '.hsssess', '.hssssss', '..sssss.', '...ssss.'],
  ponytail: [
    '........', '..hhhhh.', '.hhhhhhh', 'hhhhhhhh', 'hhhsssss', 'hhsssess', 'hhssssss', 'hh.sssss', '.hh.sss.'],
  band: [
    '........', '..hhhhh.', '.hhhhhhh', '.bbbbbbb', '.hssssss', '..sssess', '..ssssss', '..sssss.', '...ssss.'],
  bald: [
    '........', '..ssssss', '.sssssss', 'ssssssss', 'ssssssss', '.ssseees', '.sssssss', '..sssss.', '...ssss.'],
  mohawk: [
    '...hh...', '...hh...', '..shhs..', '.sshhss.', 'ssssssss', '.ssssess', '.sssssss', '..sssss.', '...ssss.'],
  beret: [
    '........', '.bbbbbb.', 'bbbbbbbb', 'hhhhhhhh', 'hhhsssss', 'hhsssess', 'hhssssss', 'hh.sssss', 'hh..sss.'],
  oni: [
    '.w....w.', '.w.hh.w.', '.hhhhhh.', 'hhhhhhhh', 'hhssssss', '.hsseses', '.hssssss', '.hsswsss', '..ssss..'],
};

// ---------------------------------------------------------------- LUCHADORES
const FIGHTERS = [
  { id: 'kenji', name: 'KENJI', jp: '健二', style: 'KARATE', head: 'spiky', hp: 100, spd: 1.55, pow: 1.0,
    desc: 'Equilibrado. Golpes firmes.',
    pal: { skin: '#f2c89a', hair: '#151515', top: '#f5f5f5', topD: '#c4c4c4', belt: '#1a1a1a', sleeve: '#f5f5f5', pants: '#f5f5f5', shoe: '#f2c89a', glove: '#f2c89a', ki: '#4fc3f7', acc: '#d32f2f' } },
  { id: 'sakura', name: 'SAKURA', jp: '桜', style: 'NINJUTSU', head: 'ponytail', hp: 88, spd: 2.0, pow: 0.85,
    desc: 'Muy rápida, poca vida.',
    pal: { skin: '#f6d3b3', hair: '#3a1f3d', top: '#c2185b', topD: '#8e1046', belt: '#ffd54f', sleeve: '#c2185b', pants: '#2d1b3d', shoe: '#2d1b3d', glove: '#f6d3b3', ki: '#f48fb1', acc: '#ffd54f' } },
  { id: 'hiro', name: 'HIRO', jp: '大', style: 'BOXEO', head: 'band', hp: 125, spd: 1.3, pow: 1.25,
    desc: 'Lento, pero pega durísimo.',
    pal: { skin: '#d9a066', hair: '#2b1a0e', top: '#d9a066', topD: '#b8823f', belt: '#1e3a8a', sleeve: '#d9a066', pants: '#1e3a8a', shoe: '#e53935', glove: '#e53935', ki: '#ffb300', acc: '#e53935' } },
  { id: 'aiko', name: 'AIKO', jp: '愛子', style: 'KUNG FU', head: 'topknot', hp: 95, spd: 1.75, pow: 0.95,
    desc: 'Ágil y técnica.',
    pal: { skin: '#f7dcc0', hair: '#111111', top: '#2e7d32', topD: '#1b5e20', belt: '#ffca28', sleeve: '#2e7d32', pants: '#111111', shoe: '#111111', glove: '#f7dcc0', ki: '#69f0ae', acc: '#ffca28' } },
];
const RIVALS = [
  { id: 'goro', name: 'GORO', jp: '五郎', style: 'YAKUZA', head: 'bald', stage: 'tokyo', hp: 100, spd: 1.35, pow: 1.0,
    taunt: 'Este barrio es mío, novato.',
    pal: { skin: '#e0b088', hair: '#e0b088', top: '#1c1c1c', topD: '#000000', belt: '#555555', sleeve: '#1c1c1c', pants: '#1c1c1c', shoe: '#111111', glove: '#e0b088', ki: '#ff5252', acc: '#ffffff' } },
  { id: 'pierre', name: 'PIERRE', jp: 'ピエール', style: 'SAVATE', head: 'beret', stage: 'paris', hp: 95, spd: 1.75, pow: 0.95,
    taunt: 'La elegancia también golpea, mon ami.',
    pal: { skin: '#f5d5b5', hair: '#5d3a1a', top: '#eceff1', topD: '#b0bec5', belt: '#c62828', sleeve: '#eceff1', pants: '#263238', shoe: '#3e2723', glove: '#f5d5b5', ki: '#7e57c2', acc: '#1a237e' } },
  { id: 'brooklyn', name: 'BROOKLYN', jp: 'ブルックリン', style: 'CALLEJERO', head: 'mohawk', stage: 'newyork', hp: 110, spd: 1.45, pow: 1.1,
    taunt: '¿Viniste tan lejos solo para perder?',
    pal: { skin: '#8d5524', hair: '#e53935', top: '#37474f', topD: '#263238', belt: '#ffeb3b', sleeve: '#8d5524', pants: '#1565c0', shoe: '#ffffff', glove: '#8d5524', ki: '#ffeb3b', acc: '#ffeb3b' } },
  { id: 'carlos', name: 'CARLOS', jp: 'カルロス', style: 'CAPOEIRA', head: 'band', stage: 'rio', hp: 100, spd: 1.9, pow: 1.0,
    taunt: '¡Baila conmigo... si puedes seguirme!',
    pal: { skin: '#c68642', hair: '#111111', top: '#c68642', topD: '#a06a2c', belt: '#43a047', sleeve: '#c68642', pants: '#ffffff', shoe: '#c68642', glove: '#c68642', ki: '#43a047', acc: '#ffeb3b' } },
  { id: 'oni', name: 'AKA-ONI', jp: '赤鬼', style: 'DEMONIO', head: 'oni', stage: 'kyoto', hp: 150, spd: 1.35, pow: 1.35,
    taunt: 'Ningún mortal cruza este templo.',
    pal: { skin: '#c62828', hair: '#111111', top: '#4e342e', topD: '#3e2723', belt: '#ffb300', sleeve: '#c62828', pants: '#c62828', shoe: '#c62828', glove: '#c62828', ki: '#ff6f00', acc: '#ffb300', eye: '#ffeb3b' } },
];

// ---------------------------------------------------------------- POSES (ángulos en grados; 0 = hacia abajo, + = hacia delante)
const P = {
  idle:    { torso: 2,   sink: 0,  shift: 0,  armF: [35, 85],   armB: [25, 95],   legF: [10, -5],  legB: [-12, 4],  headX: 0, headY: 0 },
  walk1:   { torso: 3,   sink: 0,  shift: 0,  armF: [15, 80],   armB: [45, 90],   legF: [28, -25], legB: [-22, -15], headX: 0, headY: 0 },
  walk2:   { torso: 3,   sink: 1,  shift: 0,  armF: [45, 90],   armB: [15, 80],   legF: [-22, -15], legB: [28, -25], headX: 0, headY: 0 },
  punchW:  { torso: -4,  sink: 0,  shift: -1, armF: [-30, 60],  armB: [30, 95],   legF: [12, -6],  legB: [-14, 6],  headX: 0, headY: 0 },
  punchH:  { torso: 9,   sink: 0,  shift: 2,  armF: [92, 0],    armB: [20, 100],  legF: [32, -18], legB: [-26, 8],  headX: 1, headY: 0 },
  kickW:   { torso: -6,  sink: 0,  shift: -1, armF: [30, 95],   armB: [-25, 40],  legF: [45, -95], legB: [0, 0],    headX: 0, headY: 0 },
  kickH:   { torso: -13, sink: 0,  shift: 0,  armF: [20, 90],   armB: [-45, 30],  legF: [96, -4],  legB: [-8, 4],   headX: 0, headY: 0 },
  jump:    { torso: 0,   sink: 0,  shift: 0,  armF: [150, 20],  armB: [-60, -20], legF: [40, -75], legB: [28, -60], headX: 0, headY: 0 },
  jumpkick:{ torso: -10, sink: 0,  shift: 0,  armF: [40, 95],   armB: [-35, 30],  legF: [88, -8],  legB: [32, -85], headX: 0, headY: 0 },
  hit:     { torso: -16, sink: 1,  shift: -2, armF: [-45, 20],  armB: [-50, 10],  legF: [14, -8],  legB: [-22, 6],  headX: -1, headY: 0 },
  block:   { torso: -3,  sink: 1,  shift: 0,  armF: [62, 95],   armB: [55, 100],  legF: [16, -8],  legB: [-16, 6],  headX: 0, headY: 0 },
  specW:   { torso: -6,  sink: 1,  shift: -1, armF: [-45, 30],  armB: [-50, 30],  legF: [22, -12], legB: [-22, 8],  headX: 0, headY: 0 },
  specH:   { torso: 11,  sink: 0,  shift: 3,  armF: [92, 0],    armB: [86, 0],    legF: [36, -22], legB: [-32, 10], headX: 1, headY: 0 },
  win:     { torso: -4,  sink: 0,  shift: 0,  armF: [170, 10],  armB: [165, -10], legF: [12, -4],  legB: [-12, 4],  headX: 0, headY: 0 },
  ko:      { torso: -82, sink: 10, shift: -2, armF: [-100, -20], armB: [110, -10], legF: [82, 4],  legB: [76, -6],  headX: -3, headY: 4 },
};
const ATTACKS = {
  punch:    { total: 18, from: 5, to: 10, range: 15, dmg: 7,  stun: 14, kb: 1.2, snd: 'punch' },
  kick:     { total: 28, from: 8, to: 16, range: 21, dmg: 11, stun: 20, kb: 2.2, snd: 'kick' },
  jumpkick: { total: 999, from: 2, to: 60, range: 18, dmg: 9, stun: 18, kb: 2.0, snd: 'kick' },
  special:  { total: 36, from: 999, to: 999, spawn: 12, range: 0, dmg: 15, stun: 22, kb: 2.6, snd: 'kick' },
};

// ---------------------------------------------------------------- DIBUJO DE LUCHADOR
function headColor(ch, pal) {
  switch (ch) {
    case 'h': return pal.hair; case 's': return pal.skin; case 'e': return pal.eye || '#111';
    case 'b': return pal.acc; case 'w': return '#ffffff';
  }
  return null;
}
function drawHead(map, pal, x, y, f, scale) {
  scale = scale || 1;
  for (let r = 0; r < map.length; r++) for (let c = 0; c < 8; c++) {
    const col = headColor(map[r][c], pal); if (!col) continue;
    const cx = f > 0 ? c : 7 - c;
    rect(x + cx * scale, y + r * scale, scale, scale, col);
  }
}
function drawFighter(fg, pose, flash) {
  const p = fg.pal, f = fg.facing;
  const gx = Math.round(fg.x), groundY = Math.round(FLOOR_TOP + fg.z * FLOOR_H), gy = groundY - Math.round(fg.y);
  // sombra
  rect(gx - 6, groundY - 1, 12, 2, 'rgba(0,0,0,0.35)');
  const LU = 6, LL = 6, TH = 9, AU = 5, AL = 5;
  const hipY = gy - (LU + LL) + pose.sink, hipX = gx + f * pose.shift;
  const ta = rad(pose.torso);
  const shX = hipX + f * Math.sin(ta) * TH, shY = hipY - Math.cos(ta) * TH;
  const col = c => flash ? '#ffffff' : c;
  const joint = (x, y, len, ang) => [x + f * Math.sin(rad(ang)) * len, y + Math.cos(rad(ang)) * len];

  function arm(sx, sy, a, dark) {
    const [ex, ey] = joint(sx, sy, AU, a[0]);
    const [hx, hy] = joint(ex, ey, AL, a[0] + a[1]);
    limb(sx, sy, ex, ey, 2, col(dark ? p.topD : p.sleeve));
    limb(ex, ey, hx, hy, 2, col(p.skin));
    rect(hx - 1, hy - 1, 3, 3, col(p.glove));
  }
  function leg(hx, hy, a) {
    const [kx, ky] = joint(hx, hy, LU, a[0]);
    const [fx, fy] = joint(kx, ky, LL, a[0] + a[1]);
    limb(hx, hy, kx, ky, 3, col(p.pants));
    limb(kx, ky, fx, fy, 3, col(p.pants));
    rect(f > 0 ? fx - 1 : fx - 2, fy - 1, 4, 3, col(p.shoe));
  }
  // orden: brazo trasero, pierna trasera, torso, cabeza, pierna delantera, brazo delantero
  arm(shX - f * 1, shY + 1, pose.armB, true);
  leg(hipX - f * 1, hipY, pose.legB);
  limb(hipX, hipY, shX, shY, 6, col(p.top));
  limb(hipX - f * 2, hipY, shX - f * 2, shY, 1, col(p.topD));
  rect(hipX - 3, hipY - 1, 6, 2, col(p.belt));
  px(shX, shY - 1, col(p.skin));
  drawHead(HEADS[fg.def.head], flash ? { skin: '#fff', hair: '#fff', acc: '#fff', eye: '#fff' } : p, shX - 4 + f * pose.headX, shY - 8 + pose.headY, f, 1);
  leg(hipX + f * 1, hipY, pose.legF);
  arm(shX + f * 1, shY + 1, pose.armF, false);
}

// ---------------------------------------------------------------- CLASE LUCHADOR
class Fighter {
  constructor(def, x, z, isCpu) {
    this.def = def; this.pal = def.pal; this.isCpu = isCpu;
    this.reset(x, z);
    this.wins = 0;
  }
  reset(x, z) {
    this.x = x; this.z = z; this.y = 0; this.vx = 0; this.vy = 0; this.facing = 1;
    this.hp = this.def.hp; this.maxHp = this.def.hp; this.ki = 30;
    this.state = 'idle'; this.t = 0; this.anim = 0; this.attack = null; this.blocking = false;
    this.stun = 0; this.flash = 0; this.ai = { t: 0, next: 0, cur: {} };
  }
  get grounded() { return this.y <= 0 && this.vy <= 0; }
  pose() {
    const t = this.t;
    switch (this.state) {
      case 'idle': return { ...P.idle, sink: ((this.anim / 28) | 0) % 2 };
      case 'walk': return (((this.anim / 7) | 0) % 2) ? P.walk1 : P.walk2;
      case 'jump': return P.jump;
      case 'jumpkick': return P.jumpkick;
      case 'punch': return t < 5 ? P.punchW : t < 13 ? P.punchH : P.idle;
      case 'kick': return t < 8 ? P.kickW : t < 19 ? P.kickH : P.idle;
      case 'special': return t < 12 ? P.specW : P.specH;
      case 'hit': return P.hit;
      case 'block': return P.block;
      case 'ko': return P.ko;
      case 'win': return { ...P.win, sink: ((this.anim / 20) | 0) % 2 };
    }
    return P.idle;
  }
  startAttack(n) {
    const a = ATTACKS[n];
    this.attack = { ...a, name: n, hitDone: false };
    this.state = n; this.t = 0;
    if (n !== 'special') sfx('swing');
  }
  update(inp, opp) {
    this.t++; this.anim++;
    if (this.flash > 0) this.flash--;
    const grounded = this.grounded;
    if (this.state === 'ko' || this.state === 'win') { this.physics(); return; }
    if (this.state === 'hit') {
      if (this.t >= this.stun && grounded) { this.state = 'idle'; this.t = 0; }
      this.physics(); return;
    }
    if (grounded && !this.attack) this.facing = opp.x >= this.x ? 1 : -1;

    if (this.attack) {
      const a = this.attack;
      if (a.name === 'special' && this.t === a.spawn) spawnProjectile(this);
      if (this.t >= a.total && this.state !== 'jumpkick') { this.attack = null; this.state = 'idle'; this.t = 0; }
    } else {
      this.blocking = !!inp.block && grounded;
      if (grounded) {
        if (this.blocking) { this.state = 'block'; }
        else {
          const mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), mz = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
          this.x += mx * this.def.spd; this.z += mz * this.def.spd * 0.022;
          this.state = (mx || mz) ? 'walk' : 'idle';
          if (inp.jump) { this.vy = 3.6; this.vx = mx * this.def.spd * 0.9; this.state = 'jump'; this.t = 0; sfx('jump'); }
          else if (inp.punch) this.startAttack('punch');
          else if (inp.kick) this.startAttack('kick');
          else if (inp.special && this.ki >= 100) { this.ki = 0; this.startAttack('special'); }
        }
      } else if (inp.kick || inp.punch) {
        this.startAttack('jumpkick');
      }
    }
    this.physics();
  }
  physics() {
    if (this.y > 0 || this.vy > 0) {
      this.y += this.vy; this.vy -= 0.2; this.x += this.vx;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0; this.vx = 0;
        if (this.state === 'jump' || this.state === 'jumpkick') { this.state = 'idle'; this.attack = null; this.t = 0; }
      }
    } else {
      this.x += this.vx; this.vx *= 0.8; if (Math.abs(this.vx) < 0.05) this.vx = 0;
    }
    this.x = clamp(this.x, 12, W - 12); this.z = clamp(this.z, 0, 1);
    if (this.state !== 'ko') this.ki = Math.min(100, this.ki + 0.1);
  }
}

// ---------------------------------------------------------------- COMBATE: golpes, proyectiles, partículas
let projs = [], parts = [], shake = 0, hitPause = 0, popups = [];
function spawnProjectile(fg) {
  projs.push({ x: fg.x + fg.facing * 12, z: fg.z, y: fg.y + 13, vx: fg.facing * 2.7, owner: fg,
    dmg: ATTACKS.special.dmg * fg.def.pow, t: 0, col: fg.pal.ki, alive: true });
  sfx('fire');
}
function spark(x, y, col, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(0.5, spd);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5, life: rnd(12, 26), col });
  }
}
function popup(x, y, s, col) { popups.push({ x, y, s, col, life: 40 }); }

function hitFighter(def, att, dmg, stun, kb, dir, name) {
  const hy = FLOOR_TOP + def.z * FLOOR_H - def.y - 14;
  const blocked = def.blocking && def.facing === -dir && def.grounded;
  if (blocked) {
    def.hp -= dmg * 0.12; def.vx = dir * kb * 0.7; def.ki = Math.min(100, def.ki + 6);
    sfx('block'); spark(def.x + dir * -4, hy, '#9be7ff', 5, 1.5); popup(def.x, hy - 10, 'BLOCK', '#9be7ff');
  } else {
    def.hp -= dmg; def.state = 'hit'; def.t = 0; def.stun = stun; def.vx = dir * kb; def.attack = null; def.blocking = false;
    def.flash = 4; def.ki = Math.min(100, def.ki + 9);
    if (att) att.ki = Math.min(100, att.ki + 14);
    if (def.y > 0) def.vy = 1.4;
    sfx(name === 'punch' ? 'punch' : 'kick'); spark(def.x, hy, '#fff176', 8, 2.2); spark(def.x, hy, '#ff7043', 5, 1.5);
    shake = name === 'punch' ? 3 : 5; hitPause = name === 'punch' ? 2 : 4;
    popup(def.x, hy - 12, '-' + Math.round(dmg), '#ffeb3b');
  }
  if (def.hp <= 0) {
    def.hp = 0; def.state = 'ko'; def.t = 0; def.vy = 2.8; def.vx = dir * 2.2; def.attack = null; def.blocking = false;
    sfx('ko'); shake = 10; hitPause = 12; spark(def.x, hy, '#ffffff', 16, 3);
  }
}
function checkHit(a, b) {
  if (!a.attack || a.attack.hitDone) return;
  const at = a.attack; if (a.t < at.from || a.t > at.to) return;
  if (b.state === 'ko') return;
  const dx = (b.x - a.x) * a.facing;
  if (dx < -4 || dx > at.range + 6) return;
  if (Math.abs(b.z - a.z) > 0.14) return;
  if (Math.abs(b.y - a.y) > 20) return;
  at.hitDone = true;
  hitFighter(b, a, at.dmg * a.def.pow, at.stun, at.kb, a.facing, at.name);
}
function updateProjectiles(f1, f2) {
  for (const p of projs) {
    if (!p.alive) continue;
    p.x += p.vx; p.t++;
    if (p.x < -10 || p.x > W + 10) p.alive = false;
    const tgt = p.owner === f1 ? f2 : f1;
    if (tgt.state !== 'ko' && Math.abs(tgt.x - p.x) < 9 && Math.abs(tgt.z - p.z) < 0.14 && Math.abs((tgt.y + 13) - p.y) < 16) {
      p.alive = false;
      hitFighter(tgt, p.owner, p.dmg, ATTACKS.special.stun, ATTACKS.special.kb, Math.sign(p.vx), 'special');
      spark(p.x, FLOOR_TOP + p.z * FLOOR_H - p.y, p.col, 12, 2.5);
    }
    if (Math.random() < 0.6) parts.push({ x: p.x - p.vx * 2, y: FLOOR_TOP + p.z * FLOOR_H - p.y + rnd(-2, 2), vx: -p.vx * 0.3, vy: rnd(-0.3, 0.3), life: rnd(6, 14), col: p.col });
  }
  // dos proyectiles chocan
  for (let i = 0; i < projs.length; i++) for (let j = i + 1; j < projs.length; j++) {
    const a = projs[i], b = projs[j];
    if (a.alive && b.alive && a.owner !== b.owner && Math.abs(a.x - b.x) < 8 && Math.abs(a.z - b.z) < 0.15) {
      a.alive = b.alive = false; spark((a.x + b.x) / 2, FLOOR_TOP + a.z * FLOOR_H - a.y, '#fff', 20, 3); sfx('block');
    }
  }
  projs = projs.filter(p => p.alive);
}
function updateParticles() {
  for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life--; }
  parts = parts.filter(p => p.life > 0);
  for (const p of popups) { p.y -= 0.4; p.life--; }
  popups = popups.filter(p => p.life > 0);
}
function drawProjectile(p) {
  const sx = Math.round(p.x), sy = Math.round(FLOOR_TOP + p.z * FLOOR_H - p.y), d = Math.sign(p.vx);
  const wob = ((p.t / 3) | 0) % 2;
  rect(sx - 4, sy - 2, 8, 5, p.col);
  rect(sx - 3, sy - 3, 6, 7, p.col);
  rect(sx - 2, sy - 1 + wob, 4, 3, '#ffffff');
  rect(sx - d * 6, sy - 1 + wob, 3, 2, p.col);
  rect(sx - d * 8, sy + wob, 2, 1, p.col);
}

// ---------------------------------------------------------------- IA DE LA CPU
function aiInput(me, opp, diff) {
  const ai = me.ai; ai.t++;
  const inp = ai.cur;
  // los ataques son "pulsaciones": se consumen tras un frame
  const out = { ...inp };
  inp.punch = inp.kick = inp.special = inp.jump = false;
  if (ai.t < ai.next) return out;

  const dx = (opp.x - me.x), adx = Math.abs(dx), dz = opp.z - me.z;
  const toward = dx > 0 ? 'right' : 'left', away = dx > 0 ? 'left' : 'right';
  const cur = {};
  ai.next = ai.t + (diff.react + Math.random() * diff.react) | 0;

  // alinear profundidad
  if (Math.abs(dz) > 0.07 && Math.random() < 0.8) cur[dz > 0 ? 'down' : 'up'] = true;

  // proyectil viniendo hacia mí
  const incoming = projs.find(p => p.owner !== me && Math.sign(p.vx) === Math.sign(me.x - p.x) && Math.abs(p.x - me.x) < 60 && Math.abs(p.z - me.z) < 0.15);
  if (incoming && Math.random() < diff.block + 0.3) { cur[Math.random() < 0.5 ? 'jump' : 'block'] = true; if (cur.jump) cur[toward] = true; ai.cur = cur; return out; }

  const oppAttacking = opp.attack && opp.state !== 'special';
  if (oppAttacking && adx < 34 && Math.random() < diff.block) { cur.block = true; ai.next = ai.t + 14; }
  else if (adx > 26) {
    const r = Math.random();
    if (adx > 90 && me.ki >= 100 && r < 0.55) cur.special = true;
    else if (r < diff.aggro + 0.3) { cur[toward] = true; if (Math.random() < diff.jump) cur.jump = true; }
    else if (r < diff.aggro + 0.4) cur[away] = true;
    else if (Math.random() < 0.3) cur[Math.random() < 0.5 ? 'up' : 'down'] = true;
  } else {
    const r = Math.random();
    if (r < diff.aggro) cur[Math.random() < 0.55 ? 'punch' : 'kick'] = true;
    else if (r < diff.aggro + 0.15) { cur[away] = true; ai.next = ai.t + 10; }
    else if (r < diff.aggro + 0.28) cur.block = true;
    else if (r < diff.aggro + 0.34) { cur.jump = true; cur[toward] = true; cur.kick = true; }
    else if (me.ki >= 100 && r < diff.aggro + 0.45) cur.special = true;
  }
  ai.cur = cur;
  return out;
}
function difficulty(i) { return { react: Math.max(6, 26 - 4 * i), aggro: 0.34 + 0.09 * i, block: 0.22 + 0.13 * i, jump: 0.06 + 0.03 * i }; }

// ---------------------------------------------------------------- ESCENARIOS
const STAGES = {
  tokyo: { name: 'TOKIO', jp: '東京', sub: 'SHIBUYA · NOCHE', draw: drawTokyo, anim: animTokyo, root: 220, tempo: 0.19 },
  paris: { name: 'PARÍS', jp: 'パリ', sub: 'MONTMARTRE · ATARDECER', draw: drawParis, anim: null, root: 246.9, tempo: 0.21 },
  newyork: { name: 'NUEVA YORK', jp: 'ニューヨーク', sub: 'BROOKLYN · MEDIODÍA', draw: drawNewYork, anim: animNewYork, root: 196, tempo: 0.17 },
  rio: { name: 'RÍO DE JANEIRO', jp: 'リオ', sub: 'COPACABANA · TARDE', draw: drawRio, anim: animRio, root: 261.6, tempo: 0.18 },
  kyoto: { name: 'KIOTO', jp: '京都', sub: 'TEMPLO DEL ONI · CREPÚSCULO', draw: drawKyoto, anim: animKyoto, root: 174.6, tempo: 0.2 },
};
const bgCache = {};
function bgCanvas(id) {
  if (bgCache[id]) return bgCache[id];
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const save = ctx; ctx = g; STAGES[id].draw(); ctx = save;
  bgCache[id] = c; return c;
}
function bld(x, w, h, col, winCol, lit, seed) {
  rect(x, FLOOR_TOP - h, w, h, col);
  const r = lcg(seed);
  for (let wy = FLOOR_TOP - h + 3; wy < FLOOR_TOP - 5; wy += 5)
    for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r() < lit) rect(wx, wy, 2, 3, winCol);
}
function tower(x, top, base, c1, c2) {
  const h = base - top;
  for (let y = top; y < base; y++) {
    const p = (y - top) / h, w = 2 + p * p * 46;
    const col = (((y - top) / 9) | 0) % 2 ? c2 : c1;
    if ((y - top) % 3 === 0) rect(x - w / 2, y, w, 1, col);
    else { rect(x - w / 2, y, 2, 1, col); rect(x + w / 2 - 2, y, 2, 1, col); px(x, y, col); }
  }
  rect(x - 12, top + h * 0.45, 24, 3, c1); rect(x - 22, top + h * 0.82, 44, 3, c1);
  rect(x, top - 12, 1, 12, c2); px(x, top - 13, '#ff5252');
}
function drawTokyo() {
  bands(['#070a1e', '#0d1236', '#161c52', '#232a6b'], 0, FLOOR_TOP);
  const r = lcg(7); for (let i = 0; i < 45; i++) px(r() * W, r() * 75, r() < 0.3 ? '#fff' : '#9fa8da');
  rect(40, 18, 8, 8, '#fff7c2'); rect(42, 16, 4, 12, '#fff7c2'); rect(38, 20, 12, 4, '#fff7c2');
  for (let i = 0; i < 15; i++) bld(i * 23 - 6, 18 + (i * 7) % 12, 34 + ((i * 13) % 44), '#0c1030', '#ffe082', 0.45, i + 3);
  tower(262, 24, FLOOR_TOP, '#e64a19', '#fbe9e7');
  bld(0, 62, 58, '#1a1f4a', '#80deea', 0.35, 11); bld(62, 40, 46, '#141838', '#ffab91', 0.4, 12);
  bld(102, 54, 66, '#1d2250', '#fff59d', 0.3, 13); bld(156, 44, 40, '#141838', '#80deea', 0.5, 14);
  bld(300, 30, 52, '#1a1f4a', '#ffe082', 0.4, 15);
  // letreros de neón
  rect(8, 70, 12, 44, '#111'); jp('寿司', 14, 72, '#ff4081', 9, 'center'); jp('屋', 14, 96, '#ff4081', 9, 'center');
  rect(66, 78, 32, 10, '#0d0d1a'); jp('ラーメン', 82, 79, '#18ffff', 7, 'center');
  rect(110, 60, 40, 10, '#0d0d1a'); jp('カラオケ', 130, 61, '#ffeb3b', 7, 'center');
  rect(160, 88, 12, 28, '#111'); jp('酒', 166, 92, '#ff5252', 9, 'center');
  rect(304, 76, 12, 30, '#111'); jp('薬', 310, 82, '#69f0ae', 9, 'center');
  // farolillos
  for (let x = 20; x < W; x += 34) { rect(x, 30, 1, 6, '#333'); rect(x - 2, 36, 5, 6, '#ff7043'); rect(x - 1, 37, 3, 4, '#ffab91'); }
  // suelo: asfalto mojado + paso de cebra
  rect(0, FLOOR_TOP, W, FLOOR_H, '#2b2b38'); rect(0, FLOOR_TOP, W, 3, '#3a3a4a');
  for (let x = 12; x < W; x += 26) rect(x, FLOOR_TOP + 26, 14, 14, '#c9c9c0');
  rect(0, FLOOR_TOP + 6, W, 1, '#3d3d4c');
  const r2 = lcg(99); for (let i = 0; i < 40; i++) px(r2() * W, FLOOR_TOP + 8 + r2() * 36, '#3f3f52');
}
function animTokyo(t) {
  if (((t / 30) | 0) % 4 === 0) rect(66, 78, 32, 10, '#0d0d1a');
  if (((t / 45) | 0) % 3 === 0) { rect(110, 60, 40, 10, '#0d0d1a'); jp('カラオケ', 130, 61, '#fff', 7, 'center'); }
  // lluvia ligera
  const r = lcg(t | 0); for (let i = 0; i < 12; i++) { const x = r() * W, y = r() * FLOOR_TOP; rect(x, y, 1, 3, 'rgba(180,200,255,0.25)'); }
}
function drawParis() {
  bands(['#3d2a5c', '#6f3f6e', '#b25a6e', '#e2795d', '#f4a45c', '#fbd58a', '#fde9b5'], 0, FLOOR_TOP);
  rect(200, 78, 16, 16, '#fff3c4'); rect(198, 82, 20, 8, '#fff3c4');
  // Torre Eiffel
  const ex = 100, top = 14;
  for (let y = top; y < FLOOR_TOP; y++) {
    const p = (y - top) / (FLOOR_TOP - top), w = 3 + p * p * 60;
    const c = '#2e1f2a';
    if ((y - top) % 4 === 0) rect(ex - w / 2, y, w, 1, c);
    else { rect(ex - w / 2, y, 2, 1, c); rect(ex + w / 2 - 2, y, 2, 1, c); px(ex, y, c); }
  }
  rect(ex - 10, 46, 20, 3, '#2e1f2a'); rect(ex - 24, 82, 48, 3, '#2e1f2a'); rect(ex - 34, 116, 68, 6, '#2e1f2a');
  rect(ex, top - 10, 1, 10, '#2e1f2a');
  // edificios Haussmann
  const hb = (x, w, h) => {
    rect(x, FLOOR_TOP - h, w, h, '#e9dcc3'); rect(x, FLOOR_TOP - h - 6, w, 6, '#546e7a'); rect(x + 2, FLOOR_TOP - h - 9, w - 4, 3, '#455a64');
    for (let wy = FLOOR_TOP - h + 4; wy < FLOOR_TOP - 6; wy += 8) for (let wx = x + 3; wx < x + w - 3; wx += 6) { rect(wx, wy, 2, 4, '#4a3b3b'); rect(wx - 1, wy + 4, 4, 1, '#333'); }
    for (let cx = x + 2; cx < x + w; cx += 12) rect(cx, FLOOR_TOP - h - 12, 2, 3, '#455a64');
  };
  hb(0, 46, 60); hb(46, 30, 52); hb(196, 40, 56); hb(236, 50, 62); hb(286, 40, 58);
  rect(0, FLOOR_TOP - 4, W, 4, '#cbbd9e');
  // café
  rect(238, FLOOR_TOP - 36, 46, 36, '#5d4037');
  for (let i = 0; i < 9; i++) rect(240 + i * 5, FLOOR_TOP - 40, 5, 6, i % 2 ? '#fff' : '#c62828');
  rect(242, FLOOR_TOP - 30, 18, 18, '#8d6e63'); rect(262, FLOOR_TOP - 30, 18, 18, '#3e2723'); rect(264, FLOOR_TOP - 28, 14, 14, '#ffe0b2');
  text('CAFE', 261, FLOOR_TOP - 24, '#c62828', 6, 'center');
  rect(226, FLOOR_TOP - 12, 8, 2, '#333'); rect(229, FLOOR_TOP - 10, 2, 10, '#333');
  // farola
  rect(176, FLOOR_TOP - 40, 2, 40, '#2e2e2e'); rect(172, FLOOR_TOP - 48, 10, 8, '#2e2e2e'); rect(174, FLOOR_TOP - 46, 6, 5, '#ffe082');
  // suelo adoquín
  rect(0, FLOOR_TOP, W, FLOOR_H, '#8d8578');
  for (let y = FLOOR_TOP; y < H; y += 4) for (let x = ((y / 4) | 0) % 2 ? 0 : 3; x < W; x += 6) rect(x, y, 5, 3, ((x + y) % 5) ? '#9a9184' : '#7f776b');
}
function drawNewYork() {
  bands(['#4f9fe0', '#6cb3ea', '#8fc8f2', '#b4dcf7'], 0, FLOOR_TOP);
  for (const [x, y, w] of [[30, 20, 30], [120, 12, 24], [230, 26, 36]]) { rect(x, y, w, 6, '#fff'); rect(x + 6, y - 4, w - 12, 4, '#fff'); rect(x - 4, y + 2, w + 8, 3, '#fff'); }
  // skyline
  bld(0, 30, 70, '#607d8b', '#cfd8dc', 0.8, 21); bld(30, 22, 54, '#78909c', '#cfd8dc', 0.8, 22); bld(52, 34, 84, '#546e7a', '#cfd8dc', 0.7, 23);
  bld(86, 26, 62, '#78909c', '#cfd8dc', 0.8, 24); bld(112, 20, 96, '#607d8b', '#cfd8dc', 0.7, 25);
  // Empire State
  rect(150, 60, 30, 62, '#546e7a'); rect(154, 40, 22, 20, '#546e7a'); rect(158, 26, 14, 14, '#607d8b'); rect(162, 14, 6, 12, '#607d8b'); rect(164, 2, 2, 12, '#37474f');
  for (let wy = 44; wy < 118; wy += 5) for (let wx = 152; wx < 178; wx += 4) if ((wx + wy) % 3) rect(wx, wy, 2, 3, '#cfd8dc');
  bld(180, 24, 78, '#78909c', '#cfd8dc', 0.8, 26); bld(204, 30, 58, '#607d8b', '#cfd8dc', 0.7, 27); bld(234, 28, 90, '#546e7a', '#cfd8dc', 0.6, 28);
  bld(262, 24, 66, '#78909c', '#cfd8dc', 0.8, 29); bld(286, 34, 48, '#607d8b', '#cfd8dc', 0.8, 30);
  // edificio de ladrillo con escalera de incendios
  rect(0, FLOOR_TOP - 60, 40, 60, '#a0522d');
  for (let y = FLOOR_TOP - 56; y < FLOOR_TOP; y += 4) for (let x = ((y / 4) | 0) % 2 ? 0 : 2; x < 40; x += 4) rect(x, y, 3, 3, '#8b4513');
  for (let i = 0; i < 3; i++) { rect(4, FLOOR_TOP - 54 + i * 18, 30, 1, '#222'); rect(4, FLOOR_TOP - 54 + i * 18, 1, 8, '#222'); rect(33, FLOOR_TOP - 54 + i * 18, 1, 8, '#222'); rect(8, FLOOR_TOP - 50 + i * 18, 6, 7, '#263238'); rect(22, FLOOR_TOP - 50 + i * 18, 6, 7, '#263238'); }
  // taxi
  rect(232, FLOOR_TOP - 12, 30, 8, '#f9c80e'); rect(238, FLOOR_TOP - 17, 16, 6, '#f9c80e'); rect(240, FLOOR_TOP - 16, 5, 4, '#90caf9'); rect(247, FLOOR_TOP - 16, 5, 4, '#90caf9');
  rect(236, FLOOR_TOP - 5, 5, 4, '#222'); rect(253, FLOOR_TOP - 5, 5, 4, '#222'); rect(244, FLOOR_TOP - 19, 4, 2, '#222'); rect(232, FLOOR_TOP - 9, 30, 1, '#111');
  // hidrante + señal
  rect(60, FLOOR_TOP - 10, 5, 10, '#d32f2f'); rect(59, FLOOR_TOP - 12, 7, 2, '#d32f2f'); rect(58, FLOOR_TOP - 7, 9, 2, '#d32f2f');
  rect(290, FLOOR_TOP - 34, 2, 34, '#333'); rect(282, FLOOR_TOP - 42, 20, 10, '#1b5e20'); text('SUBWAY', 292, FLOOR_TOP - 40, '#fff', 4, 'center');
  rect(0, FLOOR_TOP - 3, W, 3, '#9e9e9e');
  // calle
  rect(0, FLOOR_TOP, W, FLOOR_H, '#3c3c3c'); rect(0, FLOOR_TOP, W, 2, '#555');
  rect(0, FLOOR_TOP + 22, W, 1, '#f6c50f'); rect(0, FLOOR_TOP + 24, W, 1, '#f6c50f');
  rect(200, FLOOR_TOP + 34, 18, 6, '#2a2a2a'); rect(202, FLOOR_TOP + 35, 14, 4, '#444');
  const r = lcg(5); for (let i = 0; i < 30; i++) px(r() * W, FLOOR_TOP + r() * FLOOR_H, '#4a4a4a');
}
function animNewYork(t) {
  // vapor de alcantarilla
  const r = lcg((t / 4) | 0);
  for (let i = 0; i < 5; i++) rect(204 + r() * 10, FLOOR_TOP + 30 - r() * 22 - (t % 20), 2, 2, 'rgba(255,255,255,0.2)');
}
function drawRio() {
  bands(['#1e88e5', '#42a5f5', '#7fc4f7', '#b3e0fb'], 0, 92);
  rect(266, 14, 12, 12, '#fff59d'); rect(263, 17, 18, 6, '#fff59d'); rect(269, 11, 6, 18, '#fff59d');
  // montañas (Pan de Azúcar) y Corcovado
  const hump = (cx, base, w, h, col) => { for (let y = base - h; y < base; y++) { const p = (y - (base - h)) / h, hw = Math.sqrt(1 - (1 - p) * (1 - p)) * w / 2; rect(cx - hw, y, hw * 2, 1, col); } };
  hump(60, 92, 70, 48, '#3f7a48'); hump(110, 92, 50, 30, '#4a8a52'); hump(255, 92, 90, 52, '#2f6b3a');
  rect(254, 34, 2, 8, '#fff'); rect(249, 36, 12, 1, '#fff'); px(255, 33, '#fff');
  // mar
  rect(0, 92, W, 30, '#1976b8');
  for (let y = 94; y < 122; y += 4) for (let x = (y % 8) ? 0 : 6; x < W; x += 12) rect(x, y, 6, 1, '#3aa0d8');
  for (let x = 0; x < W; x += 17) rect(x + (x % 3) * 2, 116, 8, 1, '#e6f7ff');
  // palmeras
  const palm = (x, h) => {
    for (let i = 0; i < h; i++) rect(x + Math.sin(i / 8) * 3, FLOOR_TOP - i, 3, 1, '#6d4c41');
    const tx = x + Math.sin(h / 8) * 3 + 1, ty = FLOOR_TOP - h;
    for (const [dx, dy] of [[-14, 6], [-10, -2], [-4, -8], [4, -8], [10, -2], [14, 6]]) limb(tx, ty, tx + dx, ty + dy, 2, '#2e7d32');
    for (const [dx, dy] of [[-12, 4], [-6, -4], [6, -4], [12, 4]]) limb(tx, ty, tx + dx, ty + dy, 1, '#66bb6a');
    rect(tx - 1, ty, 3, 2, '#8d6e63');
  };
  palm(18, 44); palm(292, 52); palm(306, 38);
  // sombrilla y silla
  rect(150, FLOOR_TOP - 30, 1, 30, '#5d4037'); for (let i = 0; i < 6; i++) rect(138 + i * 4, FLOOR_TOP - 34, 4, 4, i % 2 ? '#fff' : '#e53935'); rect(140, FLOOR_TOP - 36, 20, 2, '#e53935');
  rect(158, FLOOR_TOP - 8, 12, 2, '#ffca28'); rect(158, FLOOR_TOP - 14, 2, 6, '#ffca28'); rect(158, FLOOR_TOP - 6, 1, 4, '#333'); rect(169, FLOOR_TOP - 6, 1, 4, '#333');
  // arena
  rect(0, FLOOR_TOP, W, FLOOR_H, '#f2dfa7'); rect(0, FLOOR_TOP, W, 6, '#d9c48a');
  const r = lcg(3); for (let i = 0; i < 60; i++) px(r() * W, FLOOR_TOP + 8 + r() * 36, r() < 0.5 ? '#e6d29a' : '#fff3c4');
}
function animRio(t) {
  const o = Math.sin(t / 40) * 3;
  rect(0, FLOOR_TOP + 2 + o, W, 1, '#ffffff'); for (let x = 0; x < W; x += 9) rect(x + ((t / 6) | 0) % 9, FLOOR_TOP + 1 + o, 4, 1, '#e6f7ff');
}
let petals = [];
function drawKyoto() {
  bands(['#d9a4c4', '#e8b4cf', '#f2c9dc', '#f9dfe9', '#fbe9ef'], 0, FLOOR_TOP);
  rect(60, 16, 10, 10, '#fff'); rect(58, 18, 14, 6, '#fff'); // luna
  const tri = (cx, base, w, h, col) => { for (let y = base - h; y < base; y++) { const hw = (y - (base - h)) / h * w / 2; rect(cx - hw, y, hw * 2, 1, col); } };
  tri(50, 100, 160, 62, '#a993d1'); tri(150, 100, 140, 48, '#b8a4da'); tri(260, 100, 180, 70, '#9a86c8'); rect(0, 96, W, 26, '#8e7cc3');
  // pagoda
  const pag = (x, base) => {
    let y = base;
    for (let i = 0; i < 5; i++) {
      const w = 44 - i * 6;
      rect(x - w / 2 + 5, y - 10, w - 10, 10, '#5d4037'); rect(x - w / 2 + 6, y - 9, 3, 8, '#c62828'); rect(x + w / 2 - 9, y - 9, 3, 8, '#c62828');
      rect(x - w / 2, y - 13, w, 3, '#3e2723'); rect(x - w / 2 - 2, y - 12, 2, 1, '#3e2723'); rect(x + w / 2, y - 12, 2, 1, '#3e2723');
      y -= 13;
    }
    rect(x, y - 10, 1, 10, '#3e2723'); rect(x - 2, y - 6, 5, 1, '#ffb300');
  };
  pag(70, 108);
  // torii
  rect(210, 62, 5, 60, '#c62828'); rect(258, 62, 5, 60, '#c62828');
  rect(202, 56, 68, 5, '#b71c1c'); rect(200, 53, 72, 3, '#212121'); rect(207, 66, 58, 3, '#c62828'); rect(233, 61, 6, 5, '#212121');
  // cerezos
  const tree = (x, s) => {
    rect(x - 1, FLOOR_TOP - 20 * s, 3, 20 * s, '#4e342e');
    for (const [dx, dy, w, h, c] of [[-14, -30, 30, 14, '#f48fb1'], [-10, -36, 22, 12, '#f8bbd0'], [-6, -40, 14, 8, '#fce4ec'], [-18, -24, 12, 8, '#f48fb1'], [6, -26, 14, 8, '#f8bbd0']])
      rect(x + dx * s, FLOOR_TOP + dy * s, w * s, h * s, c);
  };
  tree(150, 1.1); tree(300, 1); tree(20, 0.8);
  // linterna de piedra
  rect(180, FLOOR_TOP - 16, 6, 16, '#9e9e9e'); rect(177, FLOOR_TOP - 22, 12, 6, '#757575'); rect(179, FLOOR_TOP - 21, 8, 4, '#ffe082'); rect(175, FLOOR_TOP - 25, 16, 3, '#616161');
  // camino de piedra
  rect(0, FLOOR_TOP, W, FLOOR_H, '#9e9e9e');
  for (let y = FLOOR_TOP; y < H; y += 8) for (let x = ((y / 8) | 0) % 2 ? 0 : 8; x < W; x += 16) rect(x + 1, y + 1, 14, 6, '#8a8a8a');
  const r = lcg(12); for (let i = 0; i < 40; i++) rect(r() * W, FLOOR_TOP + r() * FLOOR_H, 2, 1, '#f8bbd0');
  petals = []; for (let i = 0; i < 30; i++) petals.push({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-0.4, -0.1), vy: rnd(0.2, 0.5), p: rnd(0, 6) });
}
function animKyoto(t) {
  for (const p of petals) {
    p.x += p.vx + Math.sin(t / 20 + p.p) * 0.3; p.y += p.vy;
    if (p.y > H) { p.y = -2; p.x = rnd(0, W + 40); } if (p.x < -2) p.x = W + 2;
    rect(p.x, p.y, 2, 1, '#f8bbd0'); px(p.x, p.y + 1, '#f48fb1');
  }
}

// ---------------------------------------------------------------- ESTADO DEL JUEGO
const G = { screen: 'title', t: 0, sel: 0, stage: 0, player: null, cont: 0 };
let fight = null;

function startMusicFor(stageId) { const s = STAGES[stageId]; music.root = s.root; music.tempo = s.tempo; music.step = 0; }

function newFight() {
  const rival = RIVALS[G.stage];
  const p1 = new Fighter(G.player, 90, 0.5, false);
  const p2 = new Fighter(rival, 230, 0.5, true);
  p2.facing = -1;
  fight = { p1, p2, rival, stageId: rival.stage, round: 1, timer: 60, ft: 0, phase: 'intro', pt: 0, diff: difficulty(G.stage), winner: null };
  projs = []; parts = []; popups = []; shake = 0; hitPause = 0;
  startMusicFor(rival.stage);
}
function newRound() {
  const f = fight;
  f.p1.reset(90, 0.5); f.p2.reset(230, 0.5); f.p2.facing = -1;
  f.timer = 60; f.ft = 0; f.phase = 'intro'; f.pt = 0; f.winner = null;
  projs = []; parts = []; popups = [];
}

// ---------------------------------------------------------------- ACTUALIZAR
function step() {
  G.t++;
  if (pressed.mute) { muted = !muted; }
  switch (G.screen) {
    case 'title':
      if (pressed.start && G.t > 10) { sfx('ok'); G.screen = 'select'; G.t = 0; }
      break;
    case 'select':
      if (pressed.left) { G.sel = (G.sel + 3) % 4; sfx('sel'); }
      if (pressed.right) { G.sel = (G.sel + 1) % 4; sfx('sel'); }
      if (pressed.back) { G.screen = 'title'; }
      if (pressed.start && G.t > 10) { sfx('ok'); G.player = FIGHTERS[G.sel]; G.stage = 0; G.cont = 0; newFight(); G.screen = 'vs'; G.t = 0; }
      break;
    case 'vs':
      if (G.t === 1) sfx('gong');
      if (G.t > 200 || (G.t > 20 && pressed.start)) { G.screen = 'fight'; G.t = 0; }
      break;
    case 'fight': stepFight(); break;
    case 'gameover':
      if (pressed.start && G.t > 20) { sfx('ok'); G.cont++; newFight(); G.screen = 'vs'; G.t = 0; }
      if (pressed.back) { G.screen = 'title'; G.t = 0; }
      break;
    case 'ending':
      if (G.t > 120 && (pressed.start || pressed.back)) { G.screen = 'title'; G.t = 0; }
      if (G.t % 25 === 0) { const x = rnd(30, W - 30), y = rnd(20, 90); spark(x, y, pick(['#ff5252', '#ffeb3b', '#69f0ae', '#40c4ff', '#f48fb1']), 26, 2.6); sfx('block'); }
      updateParticles();
      break;
  }
  for (const k in pressed) pressed[k] = false;
  musicTick();
}
function playerInput() {
  return { left: keys.left, right: keys.right, up: keys.up, down: keys.down, block: keys.block,
    jump: pressed.jump, punch: pressed.punch, kick: pressed.kick, special: pressed.special };
}
function stepFight() {
  const f = fight, p1 = f.p1, p2 = f.p2;
  f.pt++;
  if (shake > 0) shake--;
  if (f.phase === 'intro') {
    p1.anim++; p2.anim++;
    if (f.pt === 70) sfx('ok');
    if (f.pt > 100) { f.phase = 'play'; f.pt = 0; }
    return;
  }
  if (f.phase === 'play') {
    if (hitPause > 0) { hitPause--; return; }
    p1.update(playerInput(), p2);
    p2.update(aiInput(p2, p1, f.diff), p1);
    checkHit(p1, p2); checkHit(p2, p1);
    updateProjectiles(p1, p2);
    // separación suave
    const dx = p2.x - p1.x;
    if (Math.abs(dx) < 10 && Math.abs(p2.z - p1.z) < 0.1 && p1.state !== 'ko' && p2.state !== 'ko') { const s = Math.sign(dx) || 1; p1.x -= s * 0.6; p2.x += s * 0.6; }
    updateParticles();
    f.ft++; if (f.ft % 60 === 0) f.timer--;
    if (p1.state === 'ko' || p2.state === 'ko') {
      f.phase = 'ko'; f.pt = 0; f.winner = p1.state === 'ko' ? p2 : p1; f.winner.wins++;
      if (f.winner === p1) sfx('win'); else sfx('lose');
    } else if (f.timer <= 0) {
      f.phase = 'timeout'; f.pt = 0;
      f.winner = p1.hp >= p2.hp ? p1 : p2; f.winner.wins++;
      if (f.winner === p1) sfx('win'); else sfx('lose');
    }
    return;
  }
  // ko / timeout
  p1.physics(); p2.physics(); p1.anim++; p2.anim++;
  updateParticles(); updateProjectiles(p1, p2);
  if (f.pt === 50) { f.winner.state = 'win'; f.winner.attack = null; f.winner.anim = 0; }
  if (f.pt >= 170) {
    if (p1.wins >= 2) {
      G.stage++;
      if (G.stage >= RIVALS.length) { G.screen = 'ending'; G.t = 0; parts = []; startMusicFor('kyoto'); }
      else { newFight(); G.screen = 'vs'; G.t = 0; }
    } else if (p2.wins >= 2) { G.screen = 'gameover'; G.t = 0; }
    else { f.round++; newRound(); }
  }
}

// ---------------------------------------------------------------- DIBUJAR
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  switch (G.screen) {
    case 'title': drawTitle(); break;
    case 'select': drawSelect(); break;
    case 'vs': drawVs(); break;
    case 'fight': drawFight(); break;
    case 'gameover': drawFight(); drawGameOver(); break;
    case 'ending': drawEnding(); break;
  }
}
function drawStage(id, t) {
  ctx.drawImage(bgCanvas(id), 0, 0);
  const a = STAGES[id].anim; if (a) a(t);
}
function drawScene() {
  const f = fight;
  drawStage(f.stageId, G.t + f.ft);
  const list = [
    { z: f.p1.z, fn: () => drawFighter(f.p1, f.p1.pose(), f.p1.flash > 0 && f.p1.flash % 2 === 0) },
    { z: f.p2.z, fn: () => drawFighter(f.p2, f.p2.pose(), f.p2.flash > 0 && f.p2.flash % 2 === 0) },
    ...projs.map(p => ({ z: p.z + 0.001, fn: () => drawProjectile(p) })),
  ].sort((a, b) => a.z - b.z);
  for (const it of list) it.fn();
  for (const p of parts) rect(p.x, p.y, p.life > 10 ? 2 : 1, p.life > 10 ? 2 : 1, p.col);
  for (const p of popups) textO(p.s, p.x, p.y, p.col, '#000', 6, 'center');
}
function bar(x, y, w, h, frac, col, back, rtl) {
  rect(x - 1, y - 1, w + 2, h + 2, '#000'); rect(x, y, w, h, back);
  const fw = Math.round(w * clamp(frac, 0, 1));
  rect(rtl ? x + w - fw : x, y, fw, h, col);
}
function drawHUD() {
  const f = fight, p1 = f.p1, p2 = f.p2;
  const hpCol = fr => fr > 0.5 ? '#ffd740' : fr > 0.25 ? '#ff9100' : '#ff1744';
  bar(8, 8, 122, 7, p1.hp / p1.maxHp, hpCol(p1.hp / p1.maxHp), '#5a0000', false);
  bar(W - 130, 8, 122, 7, p2.hp / p2.maxHp, hpCol(p2.hp / p2.maxHp), '#5a0000', true);
  textO(p1.def.name, 9, 17, '#fff', '#000', 6, 'left'); textO(p2.def.name, W - 9, 17, '#fff', '#000', 6, 'right');
  jp(p1.def.jp, 9 + p1.def.name.length * 6 + 8, 16, '#ffd740', 7); jp(p2.def.jp, W - 9 - p2.def.name.length * 6 - 8, 16, '#ffd740', 7, 'right');
  // ki
  const kiCol = k => k >= 100 ? (((G.t / 6) | 0) % 2 ? '#fff' : '#69f0ae') : '#00b0ff';
  bar(8, 26, 60, 3, p1.ki / 100, kiCol(p1.ki), '#003049', false);
  bar(W - 68, 26, 60, 3, p2.ki / 100, kiCol(p2.ki), '#003049', true);
  text('KI', 70, 24, '#8fd3ff', 5); text('KI', W - 76, 24, '#8fd3ff', 5, 'right');
  // rondas ganadas
  for (let i = 0; i < 2; i++) { rect(134 + i * 7, 9, 5, 5, i < p1.wins ? '#ffd740' : '#333'); rect(W - 139 - i * 7, 9, 5, 5, i < p2.wins ? '#ffd740' : '#333'); }
  // temporizador
  const tcol = f.timer <= 10 ? (((G.t / 8) | 0) % 2 ? '#ff1744' : '#fff') : '#fff';
  textO(String(f.timer).padStart(2, '0'), W / 2, 6, tcol, '#000', 12, 'center');
  const st = STAGES[f.stageId]; jp(st.jp, W / 2, 20, '#ffd740', 7, 'center', true);
}
function banner(main, sub, col) {
  rect(0, 62, W, 34, 'rgba(0,0,0,0.55)'); rect(0, 62, W, 1, col); rect(0, 95, W, 1, col);
  textO(main, W / 2, 68, col, '#000', 14, 'center');
  if (sub) jpO(sub, W / 2, 84, '#fff', '#000', 8, 'center');
}
function drawFight() {
  const f = fight;
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-shake, shake) | 0, rnd(-shake, shake) | 0);
  drawScene();
  ctx.restore();
  drawHUD();
  if (f.phase === 'intro') {
    if (f.pt < 65) banner('ROUND ' + f.round, 'ラウンド ' + f.round, '#ffd740');
    else if (f.pt < 100) banner('¡PELEA!', '戦え！', '#ff1744');
  } else if (f.phase === 'ko' && f.pt < 110) {
    const s = f.pt < 10 ? 14 + (10 - f.pt) * 2 : 14;
    rect(0, 62, W, 34, 'rgba(0,0,0,0.55)'); textO('K.O.', W / 2, 66 - (s - 14) / 2, '#ff1744', '#fff', s, 'center'); jpO('一本！', W / 2, 84, '#fff', '#000', 8, 'center');
  } else if (f.phase === 'timeout' && f.pt < 110) {
    banner('TIME OVER', '時間切れ', '#ffd740');
  }
  if ((f.phase === 'ko' || f.phase === 'timeout') && f.pt >= 110) {
    const w = f.winner === f.p1;
    banner(w ? f.p1.def.name + ' GANA' : f.p2.def.name + ' GANA', w ? '勝利！' : '敗北…', w ? '#69f0ae' : '#ff9100');
  }
}
function drawVs() {
  const f = fight, st = STAGES[f.stageId];
  drawStage(f.stageId, G.t);
  // luchadores posando
  f.p1.x = 80; f.p2.x = 240; f.p1.z = f.p2.z = 0.55; f.p1.facing = 1; f.p2.facing = -1;
  drawFighter(f.p1, { ...P.idle, sink: ((G.t / 28) | 0) % 2 }, false);
  drawFighter(f.p2, { ...P.block, sink: ((G.t / 30) | 0) % 2 }, false);
  rect(0, 0, W, 34, 'rgba(0,0,0,0.6)'); rect(0, 34, W, 1, '#ffd740');
  textO('ETAPA ' + (G.stage + 1) + ' · ' + st.name, W / 2, 6, '#ffd740', '#000', 8, 'center');
  jpO(st.jp + '　' + st.sub, W / 2, 18, '#fff', '#000', 8, 'center');
  const vsS = G.t < 30 ? 30 - (G.t / 2) : 16;
  textO('VS', W / 2, 60, '#ff1744', '#fff', vsS, 'center');
  textO(f.p1.def.name, 80, 52, '#69f0ae', '#000', 7, 'center'); textO(f.p2.def.name, 240, 52, '#ff5252', '#000', 7, 'center');
  jpO(f.p1.def.jp, 80, 62, '#fff', '#000', 8, 'center'); jpO(f.p2.def.jp, 240, 62, '#fff', '#000', 8, 'center');
  text(f.p1.def.style, 80, 74, '#fff', 5, 'center'); text(f.rival.style, 240, 74, '#fff', 5, 'center');
  rect(0, H - 22, W, 22, 'rgba(0,0,0,0.7)');
  if (G.t > 40) text('"' + f.rival.taunt + '"', W / 2, H - 15, '#ffe082', 6, 'center');
  if (G.t > 100 && ((G.t / 20) | 0) % 2) text('ENTER', W - 6, H - 30, '#fff', 5, 'right');
}
function drawTitle() {
  drawStage('tokyo', G.t);
  // dos luchadores de demostración
  const a = { def: FIGHTERS[0], pal: FIGHTERS[0].pal, x: 60, z: 0.6, y: 0, facing: 1 };
  const b = { def: RIVALS[4], pal: RIVALS[4].pal, x: 262, z: 0.6, y: 0, facing: -1 };
  drawFighter(a, ((G.t / 40) | 0) % 2 ? P.punchH : P.idle, false);
  drawFighter(b, ((G.t / 50) | 0) % 2 ? P.kickH : P.block, false);
  // sol naciente detrás del título
  ctx.save(); ctx.globalAlpha = 0.35;
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#ff1744' : 'transparent'; ctx.beginPath(); ctx.moveTo(160, 60); ctx.arc(160, 60, 200, (i / 12) * Math.PI * 2 + G.t / 200, ((i + 1) / 12) * Math.PI * 2 + G.t / 200); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  rect(0, 28, W, 60, 'rgba(0,0,0,0.5)'); rect(0, 28, W, 1, '#ff1744'); rect(0, 87, W, 1, '#ff1744');
  textO('KAGE-KEN', W / 2, 36, '#ffd740', '#7a0000', 18, 'center');
  jpO('影拳 ワールドツアー', W / 2, 58, '#fff', '#000', 11, 'center');
  text('WORLD TOUR · PIXEL FIGHTERS', W / 2, 74, '#ff8a80', 6, 'center');
  if (((G.t / 25) | 0) % 2) textO('PRESIONA ENTER', W / 2, 100, '#fff', '#000', 8, 'center');
  rect(0, H - 34, W, 34, 'rgba(0,0,0,0.7)');
  text('MOVER: FLECHAS IZQ/DER   PROFUNDIDAD: ARRIBA/ABAJO   SALTAR: ESPACIO', W / 2, H - 29, '#cfd8dc', 5, 'center');
  text('PUÑO Z   PATADA X   ESPECIAL C (KI LLENO)   BLOQUEO SHIFT', W / 2, H - 20, '#cfd8dc', 5, 'center');
  text('5 RIVALES · 5 CIUDADES · MEJOR DE 3 RONDAS   [M] SILENCIO', W / 2, H - 11, '#90a4ae', 5, 'center');
}
function drawSelect() {
  // fondo estilo bandera del sol naciente
  rect(0, 0, W, H, '#f4ecd8');
  ctx.save(); ctx.fillStyle = '#e53935';
  for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(160, 100); ctx.arc(160, 100, 260, (i / 16) * Math.PI * 2 + G.t / 400, ((i + 0.5) / 16) * Math.PI * 2 + G.t / 400); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  rect(0, 0, W, 26, '#1a1a1a'); textO('ELIGE TU LUCHADOR', W / 2, 5, '#ffd740', '#000', 9, 'center'); jp('選択してください', W / 2, 16, '#fff', 7, 'center');
  const cw = 68, gap = 8, x0 = (W - (cw * 4 + gap * 3)) / 2;
  FIGHTERS.forEach((fd, i) => {
    const x = x0 + i * (cw + gap), y = 34, selc = i === G.sel;
    rect(x - 2, y - 2, cw + 4, 96, selc ? '#ffd740' : '#1a1a1a'); rect(x, y, cw, 92, selc ? '#2a1a2a' : '#1f1f26');
    if (selc) rect(x, y, cw, 92, ((G.t / 10) | 0) % 2 ? '#2f1f30' : '#2a1a2a');
    // retrato
    drawHead(HEADS[fd.head], fd.pal, x + cw / 2 - 12, y + 4, 1, 3);
    rect(x + cw / 2 - 16, y + 30, 32, 8, fd.pal.top); rect(x + cw / 2 - 16, y + 30, 6, 8, fd.pal.topD); rect(x + cw / 2 - 3, y + 30, 6, 2, fd.pal.skin);
    textO(fd.name, x + cw / 2, y + 42, selc ? '#ffd740' : '#fff', '#000', 7, 'center');
    jp(fd.jp, x + cw / 2, y + 52, '#ff8a80', 8, 'center', true);
    text(fd.style, x + cw / 2, y + 63, '#cfd8dc', 5, 'center');
    const stat = (lbl, v, yy, col) => { text(lbl, x + 4, yy, '#90a4ae', 4); bar(x + 26, yy, 38, 3, v, col, '#333', false); };
    stat('VIDA', fd.hp / 130, y + 72, '#ff5252'); stat('VEL', fd.spd / 2.1, y + 79, '#40c4ff'); stat('FUER', fd.pow / 1.3, y + 86, '#ffd740');
  });
  const sel = FIGHTERS[G.sel];
  rect(0, 134, W, 46, '#1a1a1a');
  // vista previa animada del elegido
  const prev = { def: sel, pal: sel.pal, x: 40, z: 0.85, y: 0, facing: 1 };
  const cyc = ((G.t / 30) | 0) % 4; drawFighter(prev, [P.idle, P.punchH, P.idle, P.kickH][cyc], false);
  textO(sel.name + ' · ' + sel.style, 80, 140, '#ffd740', '#000', 7); text(sel.desc, 80, 152, '#fff', 6);
  text('FLECHAS: ELEGIR   ENTER: CONFIRMAR   ESC: VOLVER', 80, 166, '#90a4ae', 5);
}
function drawGameOver() {
  rect(0, 0, W, H, 'rgba(0,0,0,0.6)');
  textO('GAME OVER', W / 2, 50, '#ff1744', '#fff', 16, 'center'); jpO('ゲームオーバー', W / 2, 72, '#fff', '#000', 9, 'center');
  text(fight.rival.name + ' te venció en ' + STAGES[fight.stageId].name, W / 2, 92, '#ffe082', 6, 'center');
  if (((G.t / 25) | 0) % 2) text('ENTER: CONTINUAR    ESC: MENÚ', W / 2, 120, '#fff', 6, 'center');
  text('CONTINUACIONES: ' + G.cont, W / 2, 134, '#90a4ae', 5, 'center');
}
function drawEnding() {
  drawStage('kyoto', G.t);
  const me = { def: G.player, pal: G.player.pal, x: 160, z: 0.75, y: 0, facing: 1 };
  drawFighter(me, { ...P.win, sink: ((G.t / 20) | 0) % 2 }, false);
  RIVALS.forEach((r, i) => drawFighter({ def: r, pal: r.pal, x: 40 + i * 60, z: 0.15, y: 0, facing: i < 2 ? 1 : -1 }, P.ko, false));
  for (const p of parts) rect(p.x, p.y, 2, 2, p.col);
  rect(0, 20, W, 44, 'rgba(0,0,0,0.6)'); rect(0, 20, W, 1, '#ffd740'); rect(0, 63, W, 1, '#ffd740');
  textO('¡CAMPEÓN DEL MUNDO!', W / 2, 26, '#ffd740', '#7a0000', 11, 'center');
  jpO('世界チャンピオン　' + G.player.jp, W / 2, 44, '#fff', '#000', 10, 'center');
  rect(0, H - 30, W, 30, 'rgba(0,0,0,0.7)');
  text(G.player.name + ' derrotó a los 5 rivales y regresó a casa.', W / 2, H - 24, '#fff', 5, 'center');
  text('Continuaciones usadas: ' + G.cont + (G.cont === 0 ? '  ¡PERFECTO!' : ''), W / 2, H - 15, '#ffe082', 5, 'center');
  if (G.t > 120 && ((G.t / 25) | 0) % 2) text('ENTER: VOLVER AL TÍTULO', W / 2, H - 7, '#90a4ae', 5, 'center');
}

// ---------------------------------------------------------------- BUCLE
let last = performance.now(), acc = 0;
function loop(ts) {
  acc += Math.min(60, ts - last); last = ts;
  while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; }
  render();
  requestAnimationFrame(loop);
}
document.fonts && document.fonts.load("8px 'Press Start 2P'").catch(() => {}).finally(() => requestAnimationFrame(loop));
if (!document.fonts) requestAnimationFrame(loop);
