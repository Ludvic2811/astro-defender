import { addStarfield, setupView, title, label, button, reveal, COLORS, FONT } from '../ui.js';
import { listMatches } from '../api.js';

const STATE = {
  lobby: ['En sala de espera', 0x8fa3bf],
  playing: ['En combate', 0x69f0ae],
  gameover: ['Derrota', 0xff5252],
};

// Lista de partidas activas para verlas como espectador.
export class SpectateScene extends Phaser.Scene {
  constructor() { super('Spectate'); }

  create() {
    setupView(this);
    this.cameras.main.fadeIn(250);
    this.bg = addStarfield(this);
    const head = title(this, 400, 56, 'PARTIDAS EN VIVO', 36);
    const sub = label(this, 400, 98, 'Elige una partida para observarla como espectador', 14, COLORS.dim, { body: true });
    this.status = label(this, 400, 300, 'Buscando partidas...', 15, COLORS.dim, { body: true });
    this.list = this.add.container(0, 0);
    this.liveDots = [];
    const back = button(this, 400, 560, 'VOLVER', () => this.scene.start('Menu'), { width: 180, height: 40, size: 15 });
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
    reveal(this, [head, sub, back]);
    this.refresh();
    this.timer = this.time.addEvent({ delay: 3000, loop: true, callback: () => this.refresh() });
  }

  async refresh() {
    let matches;
    try {
      matches = await listMatches();
    } catch (err) {
      if (!this.sys.isActive()) return;
      this.list.removeAll(true);
      this.liveDots = [];
      this.status.setText(`No se pudo obtener la lista de partidas: ${err.message}`);
      return;
    }
    if (!this.sys.isActive()) return;
    this.list.removeAll(true);
    this.liveDots = [];
    const visible = matches.filter((m) => !m.private).slice(0, 7);
    this.status.setText(visible.length ? '' : 'No hay partidas públicas en curso ahora mismo.');
    visible.forEach((m, i) => {
      const y = 150 + i * 56;
      const [stateTxt, stateCol] = STATE[m.state] || [m.state, 0x8fa3bf];
      const row = this.add.graphics();
      row.fillStyle(COLORS.panel, 0.72);
      row.fillRoundedRect(80, y - 24, 640, 48, 12);
      row.fillStyle(0xffffff, 0.03);
      row.fillRoundedRect(80, y - 24, 640, 20, { tl: 12, tr: 12, bl: 0, br: 0 });
      row.lineStyle(1.3, 0x4fc3f7, 0.4);
      row.strokeRoundedRect(80, y - 24, 640, 48, 12);
      // chip del estado
      row.fillStyle(stateCol, 0.14);
      row.fillRoundedRect(236, y - 12, 150, 24, 12);
      row.lineStyle(1.2, stateCol, 0.8);
      row.strokeRoundedRect(236, y - 12, 150, 24, 12);
      const dot = this.add.circle(252, y, 4, stateCol);
      if (m.state === 'playing') this.liveDots.push(dot);
      const stTxt = this.add.text(260, y, stateTxt, {
        fontFamily: FONT, fontSize: '11px', fontStyle: '700', color: `#${stateCol.toString(16).padStart(6, '0')}`,
      }).setOrigin(0, 0.5);
      const info = label(this, 104, y, `SALA ${m.code}`, 15, COLORS.gold, { ox: 0, bold: true });
      const det = label(this, 400, y,
        `${m.wave ? `Oleada ${m.wave} · ` : ''}${m.players} piloto(s) · ${m.spectators} espect.`,
        12, COLORS.text, { ox: 0, body: true });
      const btn = button(this, 650, y, 'VER', () => this.scene.start('Game', { mode: 'spectate', match: m }),
        { width: 90, height: 34, size: 13 });
      this.list.add([row, dot, stTxt, info, det, btn]);
    });
  }

  update(_, delta) {
    this.bg.update(delta, 0.5);
    const a = 0.45 + Math.sin(this.time.now / 300) * 0.45;
    for (const d of this.liveDots) d.setAlpha(a);
  }
}
