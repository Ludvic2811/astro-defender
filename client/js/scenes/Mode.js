import { addStarfield, setupView, glassPanel, title, label, button, textInput, COLORS } from '../ui.js';
import { requestMatch, getName } from '../api.js';

// Selección de partida: individual o multijugador cooperativo.
export class ModeScene extends Phaser.Scene {
  constructor() { super('Mode'); }

  create() {
    setupView(this);
    this.cameras.main.fadeIn(250);
    this.bg = addStarfield(this);
    this.busy = false;
    glassPanel(this, 400, 172, 560, 92, { radius: 16 });
    glassPanel(this, 400, 338, 560, 204, { radius: 16 });

    title(this, 400, 60, 'SELECCIONA TU MISIÓN', 34);
    label(this, 400, 100, `Piloto: ${getName()}`, 14, COLORS.gold);

    // --- Individual
    label(this, 400, 150, 'INDIVIDUAL', 13, COLORS.accentCss);
    button(this, 400, 188, 'PARTIDA INDIVIDUAL', () => this.scene.start('Game', { mode: 'solo' }), { size: 20 });

    // --- Cooperativo
    label(this, 400, 252, 'MULTIJUGADOR COOPERATIVO (2 A 4 PILOTOS)', 13, COLORS.accentCss);
    button(this, 400, 290, 'PARTIDA RÁPIDA', () => this.match('quick'));
    button(this, 400, 348, 'CREAR SALA PRIVADA', () => this.match('create'));

    this.codeInput = textInput(this, 325, 410, { placeholder: 'CÓDIGO', maxLength: 8, upper: true });
    this.codeInput.style.width = '150px';
    button(this, 485, 410, 'UNIRSE', () => this.match('join', this.codeInput.value.trim()), { width: 140 });

    this.status = label(this, 400, 470, '', 14, COLORS.text, { body: true, wrap: 600 });
    button(this, 400, 545, 'VOLVER', () => this.scene.start('Menu'), { width: 180, height: 42, size: 15 });

    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
    this.codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.match('join', this.codeInput.value.trim());
    });
  }

  async match(type, code) {
    if (this.busy) return;
    if (type === 'join' && !code) {
      this.status.setColor(COLORS.danger).setText('Escribe el código de la sala.');
      return;
    }
    this.busy = true;
    this.status.setColor(COLORS.text).setText(type === 'join' ? 'Buscando la sala...' : 'Solicitando un servidor de juego...');
    try {
      const match = await requestMatch(type, code);
      this.scene.start('Game', { mode: 'coop', match, quick: type === 'quick' });
    } catch (err) {
      this.status.setColor(COLORS.danger).setText(
        `No se pudo iniciar la partida multijugador: ${err.message}\n` +
        '(El modo individual funciona sin servidor.)');
    } finally {
      this.busy = false;
    }
  }

  update(_, delta) { this.bg.update(delta, 0.8); }
}
