import { addStarfield, setupView, title, label, button, textInput, reveal, fitSprite, COLORS } from '../ui.js';
import { getName, setName } from '../api.js';
import { unlockAudio, toggleMute, isMuted } from '../audio.js';

function bestRecord() {
  try { return JSON.parse(localStorage.getItem('astro.best.solo')); } catch { return null; }
}

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    setupView(this);
    this.cameras.main.fadeIn(300);
    this.bg = addStarfield(this, { planets: true });

    // Decoración: naves y asteroides cruzando el fondo
    this.decor = [];
    const deco = (key, size, x, y, vx, vy, vr = 0, tint = null) => {
      const s = this.add.image(x, y, key).setAlpha(0.55);
      fitSprite(s, size);
      if (tint) s.setTint(tint);
      this.decor.push({ s, vx, vy, vr });
    };
    deco('enemy', 44, -60, 140, 60, 8);
    deco('enemy', 34, 900, 330, -45, 4, 0, 0xff6b6b);
    deco('asteroid', 60, 860, 470, -35, -6, 0.6);
    deco('asteroid', 30, 120, 640, 20, -40, -1);
    const heroGlow = this.add.image(110, 640, 'glow').setTint(0xffa040)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    fitSprite(heroGlow, 150);
    const hero = this.add.image(110, 640, 'player');
    fitSprite(hero, 110);
    this.tweens.add({ targets: heroGlow, y: 470 + 52, duration: 1300, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: heroGlow, alpha: 0.3, duration: 700, yoyo: true, repeat: -1, delay: 1300 });
    this.tweens.add({ targets: hero, y: 470, duration: 1300, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: hero, y: 455, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1300 });

    title(this, 400, 76, 'ASTRO DEFENDER', 54);
    title(this, 400, 128, 'INVASIÓN GALÁCTICA', 22, COLORS.gold);
    label(this, 400, 170, 'Año 2189. Oleadas infinitas de invasores amenazan a la humanidad.\n¿Cuánto tiempo podrás defender tu sector?',
      13, COLORS.dim, { body: true });

    label(this, 400, 212, 'NOMBRE DE PILOTO', 12, COLORS.accentCss);
    this.nameInput = textInput(this, 400, 244, { placeholder: 'Escribe tu nombre', value: getName(), maxLength: 16 });

    reveal(this, [
      button(this, 400, 306, 'JUGAR', () => this.play(), { size: 22 }),
      button(this, 400, 362, 'CÓMO JUGAR', () => this.scene.start('HowTo'), { height: 44 }),
      button(this, 400, 414, 'TABLA DE LÍDERES', () => this.scene.start('Leaderboard'), { height: 44 }),
      button(this, 400, 466, 'VER PARTIDAS EN VIVO', () => this.scene.start('Spectate'), { height: 44 }),
    ], { delay: 60 });

    const best = bestRecord();
    if (best?.score) {
      label(this, 400, 512, `TU RÉCORD: ${best.score.toLocaleString('es-MX')} PUNTOS · OLEADA ${best.wave}`, 12, COLORS.gold);
    }
    label(this, 400, 582, 'Mover: ← ↑ ↓ → / WASD    Disparar: ESPACIO    Bomba: B    Pausa: P    Sonido: M',
      12, COLORS.dim, { body: true });

    this.muteText = label(this, 784, 16, '', 11, COLORS.dim, { ox: 1, oy: 0 });
    this.refreshMute();
    this.input.keyboard.on('keydown-ENTER', () => this.play());
    this.input.keyboard.on('keydown-M', (e) => {
      if (e.target === this.nameInput) return;
      toggleMute(); this.refreshMute();
    });
    this.input.once('pointerdown', unlockAudio);
  }

  refreshMute() { this.muteText.setText(isMuted() ? 'SONIDO: NO (M)' : 'SONIDO: SÍ (M)'); }

  play() {
    unlockAudio();
    let name = this.nameInput.value.trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 16);
    if (!name) name = `Piloto${Math.floor(100 + Math.random() * 900)}`;
    setName(name);
    this.scene.start('Mode');
  }

  update(_, delta) {
    this.bg.update(delta, 0.8);
    for (const d of this.decor) {
      d.s.x += (d.vx * delta) / 1000;
      d.s.y += (d.vy * delta) / 1000;
      d.s.rotation += (d.vr * delta) / 1000;
      if (d.s.x > 900) d.s.x = -80;
      if (d.s.x < -100) d.s.x = 880;
      if (d.s.y < -80) d.s.y = 680;
    }
  }
}
