// Texturas generadas por código, dibujadas con supermuestreo para que se vean
// nítidas en pantallas de alta densidad. Sirven de respaldo cuando no existen
// los dibujos originales del equipo en client/assets/ (ver assets/README.md).

export const TS = 3;       // superescala general: cada textura se dibuja a 3× su tamaño lógico
export const STARS_TS = 2; // superescala de las capas de estrellas y la nebulosa

function canvas(scene, key, w, h, draw, scale = TS) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, Math.round(w * scale), Math.round(h * scale));
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(scale, scale);
  draw(ctx, w, h);
  ctx.restore();
  tex.refresh();
}

// Aleatorio determinista para que cada textura sea siempre igual
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ---------------------------------------------------------------- iconografía
// Iconos vectoriales dibujados a mano (nada de glifos del sistema).
function drawIcon(c, name, cx, cy, r, color = '#ffffff') {
  c.save();
  c.translate(cx, cy);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = Math.max(1.6, r * 0.24);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const chevron = (y, dir = -1) => {
    c.beginPath();
    c.moveTo(-r * 0.62, y + r * 0.3 * -dir);
    c.lineTo(0, y + r * 0.3 * dir);
    c.lineTo(r * 0.62, y + r * 0.3 * -dir);
    c.stroke();
  };
  switch (name) {
    case 'up': // arma: cheurones hacia arriba
      chevron(-r * 0.22, -1);
      chevron(r * 0.42, -1);
      break;
    case 'fast': { // rapidez: cheurones hacia la derecha
      c.rotate(-Math.PI / 2);
      chevron(-r * 0.22, -1);
      chevron(r * 0.42, -1);
      break;
    }
    case 'triple': // tres proyectiles en abanico
      for (const a of [-0.5, 0, 0.5]) {
        c.save();
        c.rotate(a);
        c.beginPath();
        c.ellipse(0, -r * 0.18, r * 0.14, r * 0.5, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      break;
    case 'shield': {
      c.beginPath();
      c.moveTo(0, -r * 0.78);
      c.lineTo(r * 0.62, -r * 0.48);
      c.lineTo(r * 0.62, r * 0.1);
      c.quadraticCurveTo(r * 0.62, r * 0.52, 0, r * 0.8);
      c.quadraticCurveTo(-r * 0.62, r * 0.52, -r * 0.62, r * 0.1);
      c.lineTo(-r * 0.62, -r * 0.48);
      c.closePath();
      c.stroke();
      c.beginPath();
      c.moveTo(0, -r * 0.45);
      c.lineTo(0, r * 0.45);
      c.stroke();
      break;
    }
    case 'heart':
      c.beginPath();
      c.moveTo(0, r * 0.65);
      c.bezierCurveTo(-r * 0.95, 0, -r * 0.62, -r * 0.75, 0, -r * 0.28);
      c.bezierCurveTo(r * 0.62, -r * 0.75, r * 0.95, 0, 0, r * 0.65);
      c.closePath();
      c.fill();
      break;
    case 'bomb': {
      c.beginPath();
      c.arc(-r * 0.08, r * 0.2, r * 0.52, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = Math.max(1.4, r * 0.16);
      c.beginPath();
      c.moveTo(r * 0.18, -r * 0.2);
      c.quadraticCurveTo(r * 0.45, -r * 0.55, r * 0.62, -r * 0.42);
      c.stroke();
      // chispa
      c.lineWidth = Math.max(1.2, r * 0.12);
      for (const a of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
        c.beginPath();
        c.moveTo(r * 0.62 + Math.cos(a) * r * 0.1, -r * 0.42 + Math.sin(a) * r * 0.1);
        c.lineTo(r * 0.62 + Math.cos(a) * r * 0.26, -r * 0.42 + Math.sin(a) * r * 0.26);
        c.stroke();
      }
      break;
    }
    case 'bolt':
      c.beginPath();
      c.moveTo(r * 0.18, -r * 0.8);
      c.lineTo(-r * 0.42, r * 0.12);
      c.lineTo(-r * 0.05, r * 0.12);
      c.lineTo(-r * 0.18, r * 0.8);
      c.lineTo(r * 0.42, -r * 0.12);
      c.lineTo(r * 0.05, -r * 0.12);
      c.closePath();
      c.fill();
      break;
    case 'burst': { // estallido de 8 puntas
      c.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = i % 2 ? r * 0.34 : r * 0.82;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath();
      c.fill();
      break;
    }
    case 'pierce': { // flecha que atraviesa una barra
      c.lineWidth = Math.max(1.6, r * 0.2);
      c.beginPath();
      c.moveTo(-r * 0.3, -r * 0.55);
      c.lineTo(r * 0.3, -r * 0.55);
      c.stroke();
      c.beginPath();
      c.moveTo(0, -r * 0.8);
      c.lineTo(0, r * 0.62);
      c.stroke();
      c.beginPath();
      c.moveTo(-r * 0.4, r * 0.2);
      c.lineTo(0, r * 0.72);
      c.lineTo(r * 0.4, r * 0.2);
      c.stroke();
      break;
    }
    case 'magnet': { // imán de herradura
      c.lineWidth = Math.max(2, r * 0.34);
      c.beginPath();
      c.arc(0, -r * 0.12, r * 0.5, Math.PI, 0, false);
      c.moveTo(-r * 0.5, -r * 0.12);
      c.lineTo(-r * 0.5, r * 0.5);
      c.moveTo(r * 0.5, -r * 0.12);
      c.lineTo(r * 0.5, r * 0.5);
      c.stroke();
      c.fillStyle = '#ffffff';
      c.fillRect(-r * 0.5 - r * 0.17, r * 0.42, r * 0.34, r * 0.26);
      c.fillRect(r * 0.5 - r * 0.17, r * 0.42, r * 0.34, r * 0.26);
      break;
    }
    case 'target':
      c.lineWidth = Math.max(1.6, r * 0.18);
      c.beginPath(); c.arc(0, 0, r * 0.7, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(0, 0, r * 0.38, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(0, 0, r * 0.1, 0, Math.PI * 2); c.fill();
      break;
    case 'star': {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const rr = i % 2 ? r * 0.38 : r * 0.85;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath();
      c.fill();
      break;
    }
    case 'wing': { // propulsores: llama con estela
      c.beginPath();
      c.moveTo(0, -r * 0.8);
      c.quadraticCurveTo(r * 0.55, -r * 0.1, r * 0.18, r * 0.5);
      c.quadraticCurveTo(r * 0.08, r * 0.15, 0, r * 0.05);
      c.quadraticCurveTo(-r * 0.08, r * 0.15, -r * 0.18, r * 0.5);
      c.quadraticCurveTo(-r * 0.55, -r * 0.1, 0, -r * 0.8);
      c.closePath();
      c.fill();
      c.lineWidth = Math.max(1.2, r * 0.14);
      c.beginPath(); c.moveTo(-r * 0.45, r * 0.68); c.lineTo(-r * 0.45, r * 0.85); c.stroke();
      c.beginPath(); c.moveTo(0, r * 0.62); c.lineTo(0, r * 0.9); c.stroke();
      c.beginPath(); c.moveTo(r * 0.45, r * 0.68); c.lineTo(r * 0.45, r * 0.85); c.stroke();
      break;
    }
  }
  c.restore();
}

export function generateFallbackTextures(scene) {
  // ---------------------------------------------------- nave del jugador (cohete)
  canvas(scene, 'player', 64, 64, (c) => {
    // aletas
    const fin = c.createLinearGradient(0, 30, 0, 56);
    fin.addColorStop(0, '#ff6f60'); fin.addColorStop(1, '#b71c1c');
    c.fillStyle = fin;
    c.beginPath(); c.moveTo(22, 32); c.quadraticCurveTo(10, 44, 8, 56); c.lineTo(22, 50); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(42, 32); c.quadraticCurveTo(54, 44, 56, 56); c.lineTo(42, 50); c.closePath(); c.fill();
    // cuerpo
    const g = c.createLinearGradient(20, 0, 44, 0);
    g.addColorStop(0, '#8fa6bd'); g.addColorStop(0.42, '#ffffff'); g.addColorStop(0.75, '#c7d6e4'); g.addColorStop(1, '#6d8399');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(32, 3);
    c.bezierCurveTo(47, 16, 45, 40, 41, 55);
    c.lineTo(23, 55);
    c.bezierCurveTo(19, 40, 17, 16, 32, 3);
    c.fill();
    // punta
    const nose = c.createLinearGradient(23, 4, 41, 18);
    nose.addColorStop(0, '#ff8a80'); nose.addColorStop(1, '#c62828');
    c.fillStyle = nose;
    c.beginPath();
    c.moveTo(32, 3); c.bezierCurveTo(39, 9, 41, 13, 41.5, 18); c.lineTo(22.5, 18);
    c.bezierCurveTo(23, 13, 25, 9, 32, 3); c.fill();
    // ventana
    c.fillStyle = '#122344'; c.beginPath(); c.arc(32, 29, 7.5, 0, Math.PI * 2); c.fill();
    const win = c.createRadialGradient(30, 26, 1, 32, 29, 6);
    win.addColorStop(0, '#d8f4ff'); win.addColorStop(0.5, '#4fc3f7'); win.addColorStop(1, '#0d47a1');
    c.fillStyle = win; c.beginPath(); c.arc(32, 29, 5.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(30, 26.6, 1.7, 0, Math.PI * 2); c.fill();
    // remaches y tobera
    c.fillStyle = 'rgba(20,35,60,0.5)';
    c.fillRect(24, 44, 16, 1.4);
    c.fillStyle = '#c62828'; c.fillRect(30.5, 42, 3, 13);
    const noz = c.createLinearGradient(0, 55, 0, 61);
    noz.addColorStop(0, '#546e7a'); noz.addColorStop(1, '#1c2a33');
    c.fillStyle = noz; c.beginPath();
    c.moveTo(25, 55); c.lineTo(39, 55); c.lineTo(41, 61); c.lineTo(23, 61); c.closePath(); c.fill();
  });

  // ---------------------------------------------------- nave alienígena
  canvas(scene, 'enemy', 64, 48, (c) => {
    const dome = c.createRadialGradient(28, 12, 2, 32, 20, 15);
    dome.addColorStop(0, '#eaffea'); dome.addColorStop(0.45, '#66bb6a'); dome.addColorStop(1, '#124116');
    c.fillStyle = dome;
    c.beginPath(); c.arc(32, 22, 13, Math.PI, 0); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath(); c.ellipse(28, 13, 5, 2.4, -0.5, 0, Math.PI * 2); c.fill();
    // ojos del alien
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.ellipse(27, 17, 2.5, 3.5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(37, 17, 2.5, 3.5, 0, 0, Math.PI * 2); c.fill();
    const disc = c.createLinearGradient(0, 18, 0, 38);
    disc.addColorStop(0, '#e3eaee'); disc.addColorStop(0.45, '#78909c'); disc.addColorStop(1, '#1d262b');
    c.fillStyle = disc;
    c.beginPath(); c.ellipse(32, 28, 30, 10, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(32, 26.5, 29, 8.4, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    for (const x of [10, 21, 32, 43, 54]) {
      const lg = c.createRadialGradient(x, 29, 0.4, x, 29, 3.4);
      lg.addColorStop(0, '#fffde7'); lg.addColorStop(0.5, '#ffeb3b'); lg.addColorStop(1, 'rgba(255,235,59,0)');
      c.fillStyle = lg;
      c.beginPath(); c.arc(x, 29, 3.4, 0, Math.PI * 2); c.fill();
    }
    const beam = c.createLinearGradient(0, 36, 0, 47);
    beam.addColorStop(0, 'rgba(118,255,3,0.4)'); beam.addColorStop(1, 'rgba(118,255,3,0.06)');
    c.fillStyle = beam;
    c.beginPath(); c.moveTo(22, 36); c.lineTo(42, 36); c.lineTo(48, 47); c.lineTo(16, 47); c.closePath(); c.fill();
  });

  // ---------------------------------------------------- asteroide
  canvas(scene, 'asteroid', 64, 64, (c) => {
    const rnd = seeded(42);
    const pts = 14;
    const g = c.createRadialGradient(23, 21, 4, 32, 32, 33);
    g.addColorStop(0, '#b89a8c'); g.addColorStop(0.45, '#8d6e63'); g.addColorStop(0.8, '#5d4037'); g.addColorStop(1, '#2e1c16');
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const r = 24 + rnd() * 7;
      const x = 32 + Math.cos(a) * r, y = 32 + Math.sin(a) * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1.6; c.stroke();
    // cráteres con borde iluminado
    for (const [x, y, r] of [[22, 26, 5], [40, 20, 3.5], [38, 40, 6.2], [24, 44, 3.2], [45, 31, 2.4]]) {
      c.fillStyle = 'rgba(30,14,8,0.5)';
      c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0.3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,220,190,0.28)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0.3, Math.PI * 0.75, Math.PI * 1.6); c.stroke();
    }
    // moteado
    c.fillStyle = 'rgba(255,230,210,0.1)';
    for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(10 + rnd() * 44, 10 + rnd() * 44, 0.7 + rnd(), 0, Math.PI * 2); c.fill(); }
  });

  // ---------------------------------------------------- nave nodriza (jefe)
  canvas(scene, 'boss', 200, 120, (c) => {
    // halo inferior
    const halo = c.createRadialGradient(100, 70, 6, 100, 70, 70);
    halo.addColorStop(0, 'rgba(255,64,129,0.25)'); halo.addColorStop(1, 'rgba(255,64,129,0)');
    c.fillStyle = halo; c.fillRect(0, 0, 200, 120);
    // cúpula
    const dome = c.createRadialGradient(88, 28, 4, 100, 48, 44);
    dome.addColorStop(0, '#ffd9ff'); dome.addColorStop(0.45, '#ab47bc'); dome.addColorStop(1, '#30094d');
    c.fillStyle = dome;
    c.beginPath(); c.arc(100, 52, 38, Math.PI, 0); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.beginPath(); c.ellipse(88, 28, 12, 5, -0.5, 0, Math.PI * 2); c.fill();
    // ojos en la cúpula
    c.fillStyle = '#12001f';
    c.beginPath(); c.ellipse(90, 40, 5, 7, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(112, 40, 5, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff1744';
    c.beginPath(); c.ellipse(90, 38, 1.8, 2.6, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(112, 38, 1.8, 2.6, 0, 0, Math.PI * 2); c.fill();
    // casco principal
    const disc = c.createLinearGradient(0, 42, 0, 86);
    disc.addColorStop(0, '#cfd8dc'); disc.addColorStop(0.45, '#607d8b'); disc.addColorStop(1, '#141c20');
    c.fillStyle = disc;
    c.beginPath(); c.ellipse(100, 62, 94, 24, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(100, 62, 94, 24, 0, 0, Math.PI * 2); c.stroke();
    // placas
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(100, 60, 72, 16, 0, Math.PI * 0.08, Math.PI * 0.92); c.stroke();
    // cañones laterales
    c.fillStyle = '#23313a';
    c.beginPath(); c.ellipse(18, 66, 8, 5, -0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(182, 66, 8, 5, 0.2, 0, Math.PI * 2); c.fill();
    // luces
    for (let i = 0; i < 9; i++) {
      const x = 22 + i * 19.5;
      const lg = c.createRadialGradient(x, 66, 0.6, x, 66, 5.4);
      lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.4, '#ff1744'); lg.addColorStop(1, 'rgba(255,23,68,0)');
      c.fillStyle = lg;
      c.beginPath(); c.arc(x, 66, 5.4, 0, Math.PI * 2); c.fill();
    }
    // núcleo inferior
    const core = c.createRadialGradient(100, 92, 1, 100, 92, 20);
    core.addColorStop(0, '#ffffff'); core.addColorStop(0.35, '#ff4081'); core.addColorStop(1, 'rgba(255,64,129,0)');
    c.fillStyle = core; c.beginPath(); c.arc(100, 92, 20, 0, Math.PI * 2); c.fill();
  });

  // ---------------------------------------------------- proyectiles y efectos
  canvas(scene, 'bullet', 14, 32, (c) => {
    const halo = c.createRadialGradient(7, 16, 1, 7, 16, 13);
    halo.addColorStop(0, 'rgba(79,195,247,0.85)'); halo.addColorStop(1, 'rgba(79,195,247,0)');
    c.fillStyle = halo;
    c.beginPath(); c.ellipse(7, 16, 7, 15, 0, 0, Math.PI * 2); c.fill();
    const core = c.createLinearGradient(0, 4, 0, 28);
    core.addColorStop(0, '#ffffff'); core.addColorStop(0.5, '#e1f5fe'); core.addColorStop(1, 'rgba(79,195,247,0.25)');
    c.fillStyle = core;
    c.beginPath(); c.ellipse(7, 16, 2.6, 11, 0, 0, Math.PI * 2); c.fill();
  });
  canvas(scene, 'ebullet', 20, 20, (c) => {
    const g = c.createRadialGradient(10, 10, 0, 10, 10, 10);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#ff8a65'); g.addColorStop(0.62, '#ff1744'); g.addColorStop(1, 'rgba(255,23,68,0)');
    c.fillStyle = g; c.fillRect(0, 0, 20, 20);
    c.strokeStyle = 'rgba(255,255,255,0.65)'; c.lineWidth = 1;
    c.beginPath(); c.arc(10, 10, 4.6, 0, Math.PI * 2); c.stroke();
  });
  canvas(scene, 'bigbullet', 18, 36, (c) => {
    const halo = c.createRadialGradient(9, 18, 1, 9, 18, 15);
    halo.addColorStop(0, 'rgba(224,64,251,0.85)'); halo.addColorStop(1, 'rgba(224,64,251,0)');
    c.fillStyle = halo;
    c.beginPath(); c.ellipse(9, 18, 9, 17, 0, 0, Math.PI * 2); c.fill();
    const core = c.createLinearGradient(0, 5, 0, 31);
    core.addColorStop(0, '#ffffff'); core.addColorStop(0.5, '#f8e7ff'); core.addColorStop(1, 'rgba(224,64,251,0.3)');
    c.fillStyle = core;
    c.beginPath(); c.ellipse(9, 18, 3.6, 13, 0, 0, Math.PI * 2); c.fill();
  });
  canvas(scene, 'particle', 16, 16, (c) => {
    const g = c.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.65)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 16, 16);
  });
  canvas(scene, 'spark', 30, 8, (c) => {
    const g = c.createLinearGradient(0, 0, 30, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(15, 4, 14, 1.7, 0, 0, Math.PI * 2); c.fill();
  });
  canvas(scene, 'smoke', 36, 36, (c) => {
    const g = c.createRadialGradient(18, 18, 2, 18, 18, 18);
    g.addColorStop(0, 'rgba(160,160,170,0.55)'); g.addColorStop(0.6, 'rgba(110,110,120,0.3)'); g.addColorStop(1, 'rgba(90,90,100,0)');
    c.fillStyle = g; c.fillRect(0, 0, 36, 36);
  });
  canvas(scene, 'glow', 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  canvas(scene, 'flame', 16, 30, (c) => {
    const halo = c.createRadialGradient(8, 10, 1, 8, 12, 14);
    halo.addColorStop(0, 'rgba(255,179,0,0.5)'); halo.addColorStop(1, 'rgba(255,61,0,0)');
    c.fillStyle = halo; c.fillRect(0, 0, 16, 30);
    const g = c.createLinearGradient(0, 0, 0, 30);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, '#ffe082'); g.addColorStop(0.55, '#ffb300'); g.addColorStop(1, 'rgba(255,61,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(4, 0); c.lineTo(12, 0); c.quadraticCurveTo(11, 16, 8, 30); c.quadraticCurveTo(5, 16, 4, 0); c.fill();
  });
  canvas(scene, 'ring', 64, 64, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 7;
    c.beginPath(); c.arc(32, 32, 26, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 2.6;
    c.beginPath(); c.arc(32, 32, 26, 0, Math.PI * 2); c.stroke();
  });

  // ---------------------------------------------------- poderes (pw0..pw5)
  // 0 arma, 1 triple, 2 rápido, 3 escudo, 4 vida, 5 bomba
  const POWERS = [
    ['#4fc3f7', 'up'], ['#ffca28', 'triple'], ['#69f0ae', 'fast'],
    ['#82b1ff', 'shield'], ['#ff5273', 'heart'], ['#ffab40', 'bomb'],
  ];
  POWERS.forEach(([color, icon], i) => canvas(scene, `pw${i}`, 40, 40, (c) => {
    const halo = c.createRadialGradient(20, 20, 4, 20, 20, 20);
    halo.addColorStop(0, 'rgba(255,255,255,0.45)'); halo.addColorStop(0.55, `${color}55`.replace('#', '#')); halo.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = halo; c.fillRect(0, 0, 40, 40);
    // cápsula de cristal
    const glass = c.createRadialGradient(15, 14, 2, 20, 20, 14);
    glass.addColorStop(0, 'rgba(40,66,110,0.95)'); glass.addColorStop(1, 'rgba(7,14,32,0.95)');
    c.fillStyle = glass;
    c.beginPath(); c.arc(20, 20, 13.4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = color; c.lineWidth = 2.4;
    c.beginPath(); c.arc(20, 20, 13.4, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1;
    c.beginPath(); c.arc(20, 20, 11.4, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
    c.save();
    c.shadowColor = color; c.shadowBlur = 6 * TS;
    drawIcon(c, icon, 20, 20, 8.6, '#ffffff');
    c.restore();
  }));

  // ---------------------------------------------------- iconos de cartas y HUD
  const CARD_ICON_DEFS = {
    spd: ['wing', '#80d8ff'], rof: ['bolt', '#ffd54f'], dmg: ['burst', '#ff8a65'],
    prc: ['pierce', '#b388ff'], hp: ['heart', '#ff5273'], bmb: ['bomb', '#ffab40'],
    shd: ['shield', '#82b1ff'], mag: ['magnet', '#69f0ae'], cmb: ['target', '#f48fb1'],
  };
  for (const [id, [icon, color]] of Object.entries(CARD_ICON_DEFS)) {
    canvas(scene, `ic-${id}`, 56, 56, (c) => {
      c.save();
      c.shadowColor = color; c.shadowBlur = 8 * TS;
      drawIcon(c, icon, 28, 28, 20, color);
      c.restore();
    });
  }
  canvas(scene, 'ic-bomba', 22, 22, (c) => {
    drawIcon(c, 'bomb', 11, 11, 8, '#ffcc80');
  });
  canvas(scene, 'ic-vida', 22, 22, (c) => {
    drawIcon(c, 'heart', 11, 11, 8.6, '#ff5273');
  });

  canvas(scene, 'debris', 10, 10, (c) => {
    const g = c.createLinearGradient(0, 0, 10, 10);
    g.addColorStop(0, '#d7ccc8'); g.addColorStop(1, '#6d4c41');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(1, 3); c.lineTo(6, 0); c.lineTo(9, 4); c.lineTo(7, 9); c.lineTo(1, 7); c.closePath(); c.fill();
  });
  canvas(scene, 'vignette', 400, 300, (c) => {
    const g = c.createRadialGradient(200, 150, 85, 200, 150, 250);
    g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(0.75, 'rgba(255,0,40,0.3)'); g.addColorStop(1, 'rgba(255,0,40,0.6)');
    c.fillStyle = g; c.fillRect(0, 0, 400, 300);
  }, STARS_TS);

  // ---------------------------------------------------- planetas del fondo
  canvas(scene, 'planet0', 230, 150, (c) => {
    const cx = 115, cy = 75, r = 58;
    const ringG = c.createLinearGradient(cx - 110, cy, cx + 110, cy);
    ringG.addColorStop(0, 'rgba(235,235,245,0.0)'); ringG.addColorStop(0.2, 'rgba(235,235,245,0.75)');
    ringG.addColorStop(0.8, 'rgba(200,205,225,0.65)'); ringG.addColorStop(1, 'rgba(235,235,245,0.0)');
    const drawRing = (width, ry) => {
      c.strokeStyle = ringG; c.lineWidth = width;
      c.beginPath(); c.ellipse(cx, cy, 108, ry, -0.3, 0, Math.PI * 2); c.stroke();
    };
    // mitad trasera del anillo
    c.save();
    c.beginPath(); c.rect(0, 0, 230, cy - 8); c.clip();
    drawRing(7, 26);
    c.restore();
    // planeta con bandas
    const g = c.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.1, cx, cy, r * 1.05);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#cfd4dd'); g.addColorStop(0.8, '#6b7280'); g.addColorStop(1, '#23272e');
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
    c.globalAlpha = 0.22;
    const bands = ['#8b93a5', '#aab2c2', '#747c8e', '#99a3b5', '#687083'];
    bands.forEach((col, i) => {
      c.fillStyle = col;
      const y = cy - r + (i + 0.6) * (r * 2 / (bands.length + 1));
      c.beginPath(); c.ellipse(cx, y, r * 1.05, r * 0.16, -0.06, 0, Math.PI * 2); c.fill();
    });
    c.globalAlpha = 1;
    // sombra del anillo sobre el planeta
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 8;
    c.beginPath(); c.ellipse(cx, cy + 6, 108, 26, -0.3, Math.PI * 0.1, Math.PI * 0.9); c.stroke();
    c.restore();
    // brillo atmosférico
    c.strokeStyle = 'rgba(190,220,255,0.5)'; c.lineWidth = 1.6;
    c.beginPath(); c.arc(cx, cy, r + 1, Math.PI * 0.85, Math.PI * 1.75); c.stroke();
    // mitad delantera del anillo
    c.save();
    c.beginPath(); c.rect(0, cy - 8, 230, 150); c.clip();
    drawRing(8, 26);
    c.strokeStyle = 'rgba(120,125,145,0.5)'; c.lineWidth = 2.4;
    c.beginPath(); c.ellipse(cx, cy, 102, 23, -0.3, 0, Math.PI); c.stroke();
    c.restore();
  }, STARS_TS);

  canvas(scene, 'planet1', 110, 110, (c) => {
    const cx = 55, cy = 55, r = 46;
    const atm = c.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.18);
    atm.addColorStop(0, 'rgba(160,210,255,0)'); atm.addColorStop(0.75, 'rgba(160,210,255,0.3)'); atm.addColorStop(1, 'rgba(160,210,255,0)');
    c.fillStyle = atm; c.fillRect(0, 0, 110, 110);
    const g = c.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.1, cx, cy, r * 1.08);
    g.addColorStop(0, '#f5f8ff'); g.addColorStop(0.45, '#c3ccda'); g.addColorStop(0.85, '#5d6675'); g.addColorStop(1, '#20242c');
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
    const rnd = seeded(7);
    for (let i = 0; i < 9; i++) {
      const x = cx - r + rnd() * r * 2, y = cy - r + rnd() * r * 2, cr = 3 + rnd() * 8;
      c.fillStyle = 'rgba(30,35,48,0.35)';
      c.beginPath(); c.ellipse(x, y, cr, cr * 0.8, rnd(), 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(x, y, cr, cr * 0.8, rnd(), Math.PI * 0.8, Math.PI * 1.55); c.stroke();
    }
    c.restore();
  }, STARS_TS);

  // ---------------------------------------------------- fondo espacial
  const stars = (key, size, count, maxR, alpha, flares) => canvas(scene, key, size, size, (c) => {
    const rnd = seeded(key.length * 977 + count);
    for (let i = 0; i < count; i++) {
      const r = 0.35 + rnd() * maxR;
      const x = rnd() * size, y = rnd() * size;
      const warm = rnd();
      const col = warm > 0.86 ? [255, 225, 185] : warm > 0.72 ? [185, 215, 255] : [225, 235, 255];
      const a = alpha * (0.35 + rnd() * 0.65);
      c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      if (r > maxR * 0.75) { // halo suave en las más grandes
        const g = c.createRadialGradient(x, y, 0, x, y, r * 3.2);
        g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.5})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(x, y, r * 3.2, 0, Math.PI * 2); c.fill();
      }
    }
    for (let i = 0; i < (flares || 0); i++) { // destellos en cruz
      const x = rnd() * size, y = rnd() * size, L = 4 + rnd() * 6;
      const g = c.createRadialGradient(x, y, 0, x, y, L);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, L * 0.55, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 0.8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - L, y); c.lineTo(x + L, y); c.moveTo(x, y - L); c.lineTo(x, y + L); c.stroke();
    }
  }, STARS_TS);
  stars('stars-far', 512, 240, 0.9, 0.7, 0);
  stars('stars-mid', 512, 85, 1.5, 0.9, 2);
  stars('stars-near', 512, 26, 2.2, 1, 5);

  canvas(scene, 'nebula', 800, 600, (c) => {
    c.fillStyle = '#05060f';
    c.fillRect(0, 0, 800, 600);
    const blob = (x, y, r, col) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, 800, 600);
    };
    blob(160, 140, 340, 'rgba(94,53,177,0.4)');
    blob(650, 420, 380, 'rgba(21,101,192,0.36)');
    blob(540, 100, 230, 'rgba(216,27,96,0.2)');
    blob(240, 470, 260, 'rgba(0,131,143,0.18)');
    blob(720, 130, 190, 'rgba(123,31,162,0.24)');
    blob(420, 300, 420, 'rgba(26,35,126,0.22)');
    // polvo estelar granulado
    const rnd = seeded(2026);
    for (let i = 0; i < 520; i++) {
      const x = rnd() * 800, y = rnd() * 600;
      c.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${0.015 + rnd() * 0.04})` : `rgba(140,160,255,${0.02 + rnd() * 0.04})`;
      c.beginPath(); c.arc(x, y, 0.5 + rnd() * 1.4, 0, Math.PI * 2); c.fill();
    }
    // oscurecimiento de bordes
    const vg = c.createRadialGradient(400, 300, 220, 400, 300, 520);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,3,10,0.6)');
    c.fillStyle = vg; c.fillRect(0, 0, 800, 600);
  }, STARS_TS);
}
