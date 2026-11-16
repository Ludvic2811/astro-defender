import { generateFallbackTextures } from '../textures.js';
import { setupView, FONT } from '../ui.js';

// Carga los dibujos originales (si están en assets/manifest.json) y genera
// texturas de respaldo para todo lo que falte.
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    setupView(this);
    this.add.text(400, 272, 'ASTRO DEFENDER', {
      fontFamily: FONT, fontSize: '20px', fontStyle: '900', color: '#4fc3f7',
    }).setOrigin(0.5).setAlpha(0.9);
    const frame = this.add.rectangle(400, 304, 308, 12, 0x0a1430, 0.9).setStrokeStyle(1.5, 0x4fc3f7, 0.6);
    frame.isStroked = true;
    const bar = this.add.rectangle(250, 304, 4, 6, 0x4fc3f7).setOrigin(0, 0.5);
    this.load.on('progress', (v) => { bar.width = 300 * v; });
    this.load.on('loaderror', (file) => console.warn('[assets] no se pudo cargar', file.src));

    const manifest = window.ASTRO.manifest || {};
    for (const key of ['player', 'enemy', 'asteroid', 'boss']) {
      if (typeof manifest[key] === 'string') this.load.image(key, `assets/${manifest[key]}`);
    }
  }

  async create() {
    generateFallbackTextures(this);
    try {
      await Promise.race([
        Promise.all([document.fonts.load('900 20px Orbitron'), document.fonts.load('20px "Exo 2"')]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch { /* se usan fuentes del sistema */ }
    this.scene.start('Menu');
  }
}
