// Audio sintetizado con WebAudio: efectos y música procedural (no usa archivos).
let ctx = null;
let master = null;
let muted = false;
try { muted = localStorage.getItem('astro.muted') === '1'; } catch { /* ignorar */ }

const last = {};

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.25;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('astro.muted', muted ? '1' : '0'); } catch { /* ignorar */ }
  if (master) master.gain.value = muted ? 0 : 0.25;
  return muted;
}
export const isMuted = () => muted;

function throttle(name, ms) {
  const now = performance.now();
  if (last[name] && now - last[name] < ms) return false;
  last[name] = now;
  return true;
}

function tone(f0, f1, dur, type = 'square', vol = 0.2, delay = 0, dest = master) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol, cutoff, delay = 0, dest = master) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t);
}

const arp = (notes, step, type, vol) => notes.forEach((f, i) => tone(f, f, step * 1.6, type, vol, i * step));

export const sfx = {
  shoot: () => throttle('shoot', 60) && tone(900, 240, 0.08, 'square', 0.1),
  eshot: () => throttle('eshot', 90) && tone(320, 140, 0.12, 'sawtooth', 0.045),
  hit: () => throttle('hit', 40) && tone(1400, 700, 0.04, 'square', 0.05),
  boom: (size = 1) => throttle('boom' + size, 50) && noise(0.25 + size * 0.35, 0.5 + size * 0.15, 1800 - size * 400),
  phit: () => { tone(500, 60, 0.45, 'sawtooth', 0.25); noise(0.3, 0.3, 900); },
  shieldBreak: () => { tone(1800, 600, 0.25, 'triangle', 0.2); tone(2400, 900, 0.2, 'sine', 0.12, 0.03); },
  power: () => arp([520, 780, 1040], 0.06, 'triangle', 0.16),
  level: () => arp([523, 659, 784, 1046, 1318], 0.06, 'square', 0.1),
  bomb: () => { noise(1.4, 0.9, 2600); tone(180, 30, 1.2, 'sine', 0.5); },
  warn: () => { for (let i = 0; i < 4; i++) { tone(660, 660, 0.22, 'square', 0.12, i * 0.5); tone(440, 440, 0.22, 'square', 0.12, i * 0.5 + 0.25); } },
  laser: () => { tone(90, 140, 1.6, 'sawtooth', 0.12); tone(1800, 1200, 1.6, 'sine', 0.04); },
  combo: (mult) => tone(400 + mult * 160, 600 + mult * 200, 0.12, 'square', 0.1),
  card: () => arp([784, 1046, 1318], 0.07, 'triangle', 0.14),
  revive: () => arp([392, 523, 659, 784], 0.08, 'triangle', 0.14),
  wave: () => { tone(330, 330, 0.15, 'triangle', 0.2); tone(495, 495, 0.25, 'triangle', 0.2, 0.15); },
  sector: () => arp([523, 659, 784, 1046], 0.15, 'triangle', 0.2),
  record: () => arp([523, 659, 784, 1046, 1318, 1568], 0.12, 'triangle', 0.2),
  lose: () => [0, 0.25, 0.5].forEach((d, i) => tone([392, 330, 262][i], [380, 310, 200][i], 0.35, 'sawtooth', 0.15, d)),
  click: () => tone(700, 900, 0.05, 'triangle', 0.1),
};

// ====================================================================== música
// Secuenciador de 16 pasos: bajo + arpegio + batería. La intensidad (0-3)
// sube con las oleadas; durante los jefes cambia a una progresión oscura.
const semis = (root, s) => root * 2 ** (s / 12);
const PROG = {
  normal: [[110, [0, 3, 7]], [87.31, [0, 4, 7]], [130.81, [0, 4, 7]], [98, [0, 4, 7]]],
  boss: [[110, [0, 3, 7]], [116.54, [0, 4, 7]], [110, [0, 3, 7]], [82.41, [0, 4, 7]]],
};
const BASS_STEPS = new Set([0, 3, 6, 8, 10, 11, 14]);

class Music {
  constructor() {
    this.on = false;
    this.step = 0;
    this.intensity = 0;
    this.boss = false;
  }

  start() {
    unlockAudio();
    if (!ctx || this.on) return;
    this.on = true;
    this.out = ctx.createGain();
    this.out.gain.value = 0.55;
    this.out.connect(master);
    this.step = 0;
    this.next = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (!this.on) return;
    this.on = false;
    clearInterval(this.timer);
    const out = this.out;
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => out.disconnect(), 1000);
  }

  set(intensity, boss) {
    this.intensity = Math.max(0, Math.min(3, intensity));
    this.boss = boss;
  }

  schedule() {
    while (this.next < ctx.currentTime + 0.12) {
      this.play(this.step, this.next);
      const bpm = this.boss ? 150 : 108 + this.intensity * 10;
      this.next += 60 / bpm / 4;
      this.step = (this.step + 1) % 64;
    }
  }

  note(freq, t, dur, type, vol, cutoff = 0) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = o.connect(g);
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      node = node.connect(f);
    }
    node.connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  play(step, t) {
    if (muted) return;
    const s16 = step % 16;
    const [root, chord] = (this.boss ? PROG.boss : PROG.normal)[Math.floor(step / 16)];
    const sixteenth = 60 / (this.boss ? 150 : 108 + this.intensity * 10) / 4;

    if (BASS_STEPS.has(s16)) this.note(s16 % 8 === 0 ? root : root * 2, t, sixteenth * 1.8, 'square', 0.05, 700);
    if (s16 % 2 === 0) {
      const tone2 = chord[(s16 / 2) % chord.length] + (s16 >= 8 ? 12 : 0);
      this.note(semis(root * 4, tone2), t, sixteenth * 1.5, 'triangle', 0.035 + this.intensity * 0.006);
    }
    if (this.intensity >= 1 || this.boss) { // caja/hi-hat
      if (s16 % 4 === 2) this.hat(t, 0.025);
      if (s16 === 4 || s16 === 12) this.hat(t, 0.06, 1800);
    }
    if ((this.intensity >= 2 || this.boss) && s16 % 4 === 0) { // bombo
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + 0.2);
    }
    if (this.intensity >= 3 && !this.boss && s16 === 0) { // pad en la zona crítica
      for (const sem of chord) this.note(semis(root * 2, sem), t, sixteenth * 14, 'sawtooth', 0.012, 1200);
    }
  }

  hat(t, vol, cutoff = 7000) {
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = cutoff > 5000 ? 'highpass' : 'bandpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
  }
}

export const music = new Music();
