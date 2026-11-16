// Componentes de interfaz reutilizables (botones, paneles, fondo, campos de texto).
import { sfx, unlockAudio } from './audio.js';
import { TS, STARS_TS } from './textures.js';

export const FONT = 'Orbitron, "Exo 2", sans-serif';
export const BODY_FONT = '"Exo 2", sans-serif';

// Factor de nitidez: el lienzo se crea a 800×600 por S y las cámaras hacen zoom S.
export const S = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));

export const COLORS = {
  accent: 0x4fc3f7,
  accentCss: '#4fc3f7',
  gold: '#ffd54f',
  goldNum: 0xffd54f,
  danger: '#ff5252',
  dangerNum: 0xff5252,
  ok: '#69f0ae',
  okNum: 0x69f0ae,
  text: '#e8f4ff',
  dim: '#8fa3bf',
  panel: 0x081024,
  panelEdge: 0x4fc3f7,
};

/** Configura la cámara de la escena para el modo de alta resolución:
 *  todas las coordenadas del juego siguen siendo 0-800 × 0-600. */
export function setupView(scene) {
  const cam = scene.cameras.main;
  cam.setZoom(S);
  cam.centerOn(400, 300);
  return cam;
}

const cssToInt = (c) => (typeof c === 'number' ? c : Phaser.Display.Color.HexStringToColor(c).color);

// Colores de nebulosa y planetas para cada sector (cambian cada 5 oleadas)
const SECTOR_TINTS = [
  [0xffffff, 0x9fa8da, 0xce93d8],
  [0xffab91, 0xff8a65, 0xffcc80],
  [0x80cbc4, 0x4db6ac, 0xa5d6a7],
  [0xf48fb1, 0xf06292, 0xb39ddb],
  [0xfff59d, 0xffd54f, 0x90caf9],
];

/** Fondo espacial: nebulosa, planetas opcionales y tres capas de estrellas en paralaje. */
export function addStarfield(scene, { planets = false } = {}) {
  const nebula = scene.add.image(400, 300, 'nebula').setDisplaySize(800, 600).setAlpha(0.95);
  const haze = scene.add.image(400, 300, 'nebula').setDisplaySize(800, 600)
    .setFlipX(true).setFlipY(true).setAlpha(0.28).setBlendMode(Phaser.BlendModes.ADD);
  const pl = planets ? [
    { img: fit(scene.add.image(640, 170, 'planet0').setAlpha(0.6), 225), speed: 6 },
    { img: fit(scene.add.image(140, 430, 'planet1').setAlpha(0.5), 110), speed: 10 },
  ] : [];
  const layers = [
    scene.add.tileSprite(400, 300, 800, 600, 'stars-far'),
    scene.add.tileSprite(400, 300, 800, 600, 'stars-mid'),
    scene.add.tileSprite(400, 300, 800, 600, 'stars-near'),
  ];
  layers.forEach((l) => l.setTileScale(1 / STARS_TS));
  const speeds = [12, 30, 70];
  let sector = -1;
  let t = Math.random() * 1000;
  const api = {
    nebula,
    update(delta, mul = 1) {
      t += delta;
      layers.forEach((l, i) => { l.tilePositionY -= (speeds[i] * mul * delta) / 1000; });
      // Titileo suave de las estrellas cercanas y respiración de la nebulosa
      layers[2].setAlpha(0.82 + Math.sin(t / 640) * 0.18);
      layers[1].setAlpha(0.88 + Math.sin(t / 910 + 2) * 0.12);
      haze.setAlpha(0.22 + Math.sin(t / 2400) * 0.08);
      for (const p of pl) {
        p.img.y += (p.speed * mul * delta) / 1000;
        if (p.img.y > 600 + p.img.displayHeight / 2) {
          p.img.y = -p.img.displayHeight / 2;
          p.img.x = 80 + Math.random() * 640;
        }
      }
    },
    setSector(k) {
      if (k === sector) return;
      sector = k;
      const [neb, p0, p1] = SECTOR_TINTS[k % SECTOR_TINTS.length];
      nebula.setTint(neb);
      haze.setTint(neb);
      pl[0]?.img.setTint(p0);
      pl[1]?.img.setTint(p1);
    },
  };
  api.setSector(0);
  return api;
}

function fit(img, target) { fitSprite(img, target); return img; }

/** Título con degradado vertical y halo luminoso. */
export function title(scene, x, y, text, size = 48, color = COLORS.text, glow = '#4fc3f7') {
  const t = scene.add.text(x, y, text, {
    fontFamily: FONT, fontSize: `${size}px`, fontStyle: '900', color: '#ffffff',
    stroke: '#060d22', strokeThickness: Math.max(2, size / 9),
    shadow: { offsetX: 0, offsetY: 0, color: glow, blur: size / 2.4, fill: true, stroke: true },
  }).setOrigin(0.5);
  const base = cssToInt(color);
  const top = Phaser.Display.Color.ValueToColor(base).clone().lighten(30).color;
  t.setTint(top, top, base, base);
  return t;
}

export function label(scene, x, y, text, size = 16, color = COLORS.text, opts = {}) {
  return scene.add.text(x, y, text, {
    fontFamily: opts.body ? BODY_FONT : FONT, fontSize: `${size}px`, color,
    align: opts.align || 'center', wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
    fontStyle: opts.bold ? '700' : 'normal',
  }).setOrigin(opts.ox ?? 0.5, opts.oy ?? 0.5);
}

/** Panel de "vidrio": fondo translúcido, borde con acento y esquinas marcadas. */
export function glassPanel(scene, x, y, w, h, { color = COLORS.accent, alpha = 0.72, radius = 14, corners = true } = {}) {
  const g = scene.add.graphics();
  const col = cssToInt(color);
  const L = x - w / 2, T = y - h / 2;
  g.fillStyle(COLORS.panel, alpha);
  g.fillRoundedRect(L, T, w, h, radius);
  g.fillStyle(0xffffff, 0.03);
  g.fillRoundedRect(L, T, w, Math.max(radius * 2, h * 0.38), { tl: radius, tr: radius, bl: 0, br: 0 });
  g.lineStyle(1.5, col, 0.45);
  g.strokeRoundedRect(L, T, w, h, radius);
  if (corners) {
    const k = Math.min(16, radius + 6);
    g.lineStyle(2.5, col, 0.95);
    g.beginPath();
    g.moveTo(L, T + k); g.lineTo(L, T + radius); g.arc(L + radius, T + radius, radius, Math.PI, Math.PI * 1.5); g.lineTo(L + k, T);
    g.moveTo(L + w - k, T); g.lineTo(L + w - radius, T); g.arc(L + w - radius, T + radius, radius, -Math.PI / 2, 0); g.lineTo(L + w, T + k);
    g.moveTo(L + w, T + h - k); g.lineTo(L + w, T + h - radius); g.arc(L + w - radius, T + h - radius, radius, 0, Math.PI / 2); g.lineTo(L + w - k, T + h);
    g.moveTo(L + k, T + h); g.lineTo(L + radius, T + h); g.arc(L + radius, T + h - radius, radius, Math.PI / 2, Math.PI); g.lineTo(L, T + h - k);
    g.strokePath();
  }
  return g;
}

/** Botón con estados claros de reposo, selección y pulsado. */
export function button(scene, x, y, text, onClick, { width = 300, height = 50, color = COLORS.accent, size = 18 } = {}) {
  const col = cssToInt(color);
  const c = scene.add.container(x, y);
  const glow = scene.add.image(0, 0, 'glow').setDisplaySize(width * 1.45, height * 2.8)
    .setTint(col).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  const g = scene.add.graphics();
  const r = Math.min(12, height / 2 - 3);
  const w2 = width / 2, h2 = height / 2;
  const draw = (state) => { // 0 reposo · 1 encima · 2 pulsado
    g.clear();
    g.fillStyle(0x0c1736, state ? 0.96 : 0.88);
    g.fillRoundedRect(-w2, -h2, width, height, r);
    if (state) { g.fillStyle(col, state === 2 ? 0.42 : 0.2); g.fillRoundedRect(-w2, -h2, width, height, r); }
    g.fillStyle(0xffffff, 0.05);
    g.fillRoundedRect(-w2, -h2, width, h2, { tl: r, tr: r, bl: 0, br: 0 });
    g.lineStyle(state ? 2.5 : 1.8, col, state ? 1 : 0.7);
    g.strokeRoundedRect(-w2, -h2, width, height, r);
    g.fillStyle(col, state ? 1 : 0.75);
    g.fillRect(-w2 + 7, -4, 3, 8);
    g.fillRect(w2 - 10, -4, 3, 8);
  };
  draw(0);
  const t = scene.add.text(0, 0, text, {
    fontFamily: FONT, fontSize: `${size}px`, fontStyle: '700', color: '#eef7ff',
  }).setOrigin(0.5);
  c.add([glow, g, t]);
  c.setSize(width, height);
  c.setInteractive({ useHandCursor: true });
  let pressed = false;
  c.on('pointerover', () => {
    draw(1);
    scene.tweens.add({ targets: c, scale: 1.035, duration: 110, ease: 'Sine.easeOut' });
    scene.tweens.add({ targets: glow, alpha: 0.5, duration: 140 });
  });
  c.on('pointerout', () => {
    pressed = false;
    draw(0);
    scene.tweens.add({ targets: c, scale: 1, duration: 110 });
    scene.tweens.add({ targets: glow, alpha: 0, duration: 140 });
  });
  c.on('pointerdown', () => { pressed = true; draw(2); c.setScale(0.97); });
  c.on('pointerup', () => {
    draw(1);
    scene.tweens.add({ targets: c, scale: 1.035, duration: 90 });
    if (pressed) { pressed = false; unlockAudio(); sfx.click(); onClick(); }
  });
  c.label = t;
  return c;
}

/** Campo de texto HTML dentro del canvas (Phaser DOM). */
export function textInput(scene, x, y, { placeholder = '', value = '', maxLength = 16, upper = false } = {}) {
  const el = document.createElement('input');
  el.className = 'astro-input';
  el.type = 'text';
  el.placeholder = placeholder;
  el.value = value;
  el.maxLength = maxLength;
  el.autocomplete = 'off';
  el.spellcheck = false;
  if (upper) el.addEventListener('input', () => { el.value = el.value.toUpperCase(); });
  scene.add.dom(x, y, el);
  return el;
}

/** Texto temporal grande en el centro (oleadas, avisos). */
export function banner(scene, text, color = COLORS.text, size = 40, ms = 1600) {
  const t = title(scene, 400, 260, text, size, color).setAlpha(0).setDepth(50).setScale(0.82);
  scene.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: t, alpha: 1, y: 240, duration: 250, yoyo: true, hold: ms, ease: 'Sine.easeOut',
    onComplete: () => t.destroy(),
  });
  return t;
}

/** Aparición escalonada de elementos de interfaz (deslizan y aparecen). */
export function reveal(scene, items, { dy = 16, delay = 45, duration = 240 } = {}) {
  items.forEach((it, i) => {
    if (!it || typeof it.setAlpha !== 'function') return;
    const ty = it.y;
    it.y = ty + dy;
    it.setAlpha(0);
    scene.tweens.add({ targets: it, y: ty, alpha: 1, duration, delay: i * delay, ease: 'Cubic.easeOut' });
  });
}

/** Ajusta un sprite a un diámetro objetivo respetando la proporción del dibujo. */
export function fitSprite(sprite, target) {
  const f = sprite.frame;
  const s = target / Math.max(f.realWidth, f.realHeight);
  sprite.setScale(s);
  return s;
}

export { TS };
