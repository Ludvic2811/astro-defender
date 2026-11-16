import { addStarfield, setupView, glassPanel, title, label, button, fitSprite, COLORS } from '../ui.js';
import { UNLOCK, BOSS_EVERY, CRITICAL_WAVE } from '../../shared/sim.js';

// Guía rápida: controles, enemigos, poderes y reglas.
export class HowToScene extends Phaser.Scene {
  constructor() { super('HowTo'); }

  create() {
    setupView(this);
    this.cameras.main.fadeIn(250);
    this.bg = addStarfield(this);
    glassPanel(this, 210, 300, 378, 464, { radius: 16 });
    glassPanel(this, 596, 300, 378, 464, { radius: 16 });
    title(this, 400, 40, 'CÓMO JUGAR', 32);

    const head = (x, y, t) => label(this, x, y, t, 13, COLORS.accentCss, { ox: 0, bold: true });
    const text = (x, y, t, w = 300) => label(this, x, y, t, 13, COLORS.text, { ox: 0, oy: 0.5, body: true, align: 'left', wrap: w });

    // ---- Controles
    head(30, 82, 'CONTROLES');
    text(30, 124, 'Mover: flechas o WASD\nDisparar: ESPACIO (automático en táctil)\nBomba: B o SHIFT · Pausa: P · Sonido: M\nCartas de mejora: teclas 1, 2, 3', 360);

    // ---- Enemigos
    head(30, 178, 'ENEMIGOS');
    const enemies = [
      [null, 1, 'Ovni', 'Baja zigzagueando y dispara.'],
      [0xff6b6b, 0.82, 'Kamikaze', `Apunta y se lanza contra ti (oleada ${UNLOCK.kamikaze}+).`],
      [0xc792ff, 1.05, 'Tirador', `Se detiene y dispara en abanico (oleada ${UNLOCK.shooter}+).`],
      [0xffb74d, 1.4, 'Tanque', `Lento y muy resistente (oleada ${UNLOCK.tank}+).`],
      [null, 1, 'Escuadrón', `Cinco ovnis en formación V (oleada ${UNLOCK.squadron}+).`],
    ];
    enemies.forEach(([tint, size, name, desc], i) => {
      const y = 212 + i * 46;
      const img = this.add.image(54, y, 'enemy');
      fitSprite(img, 40 * size);
      if (tint) img.setTint(tint);
      label(this, 92, y - 9, name, 13, COLORS.gold, { ox: 0, bold: true });
      text(92, y + 9, desc, 290);
    });
    text(30, 452, `Cada ${BOSS_EVERY} oleadas llega una NAVE NODRIZA con ataques que cambian: ráfagas en abanico, un láser que barre la pantalla y escoltas kamikaze.`, 360);

    // ---- Poderes
    head(420, 82, 'PODERES');
    const powers = [
      'Arma +1 nivel (hasta 4)', 'Disparo triple (8 s)', 'Disparo rápido (8 s)',
      'Escudo: absorbe un golpe', 'Vida extra', 'Bomba: limpia la pantalla',
    ];
    powers.forEach((p, i) => {
      const y = 112 + i * 30;
      fitSprite(this.add.image(436, y, `pw${i}`), 26);
      text(460, y, p, 320);
    });

    // ---- Reglas
    head(420, 300, 'REGLAS');
    text(420, 378, [
      '• Oleadas infinitas: sobrevive todo lo que puedas.',
      '• Tienes 3 vidas. Al recibir un golpe tu arma baja un nivel.',
      '• Encadena derribos para subir el COMBO (hasta ×5).',
      '• Al vencer a un jefe eliges 1 de 3 cartas de mejora.',
      `• Desde la oleada ${CRITICAL_WAVE}: ZONA CRÍTICA, puntos ×2.`,
      '• Cooperativo: si caes, reapareces en la siguiente oleada si tu equipo resiste.',
    ].join('\n'), 360);

    button(this, 400, 562, 'VOLVER', () => this.scene.start('Menu'), { width: 180, height: 40, size: 15 });
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
  }

  update(_, delta) { this.bg.update(delta, 0.5); }
}
