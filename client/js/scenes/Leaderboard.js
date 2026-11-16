import { addStarfield, setupView, glassPanel, title, label, button, reveal, COLORS } from '../ui.js';
import { fetchScores } from '../api.js';
import { sfx } from '../audio.js';

const RANK_COLORS = [0xffd54f, 0xcfd8dc, 0xffab91];

export class LeaderboardScene extends Phaser.Scene {
  constructor() { super('Leaderboard'); }

  init(data) { this.tab = data?.mode || 'solo'; }

  create() {
    setupView(this);
    this.cameras.main.fadeIn(250);
    this.bg = addStarfield(this);
    const head = title(this, 400, 52, 'TABLA DE LÍDERES', 36);

    // Pestañas segmentadas (individual / cooperativo)
    const tabs = this.add.container(400, 112);
    this.tabG = this.add.graphics();
    tabs.add(this.tabG);
    this.tabTexts = {};
    [['solo', 'INDIVIDUAL'], ['coop', 'COOPERATIVO']].forEach(([id, txt], i) => {
      const x = -96 + i * 192;
      const t = label(this, x, 0, txt, 14, COLORS.dim, { bold: true });
      const zone = this.add.zone(x, 0, 192, 44).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => { sfx.click(); this.loadScores(id); });
      tabs.add([t, zone]);
      this.tabTexts[id] = t;
    });

    // Panel de la tabla
    const panel = glassPanel(this, 400, 352, 640, 392, { radius: 16 });
    label(this, 160, 180, '#', 11, COLORS.dim);
    label(this, 200, 180, 'PILOTO / EQUIPO', 11, COLORS.dim, { ox: 0 });
    label(this, 556, 180, 'OLEADA', 11, COLORS.dim);
    label(this, 656, 180, 'PUNTOS', 11, COLORS.dim);
    const divider = this.add.rectangle(400, 196, 576, 1, 0x4fc3f7, 0.35);

    this.rowsGfx = this.add.graphics();
    this.rows = [];
    for (let i = 0; i < 10; i++) {
      const y = 216 + i * 31;
      this.rows.push({
        y,
        rank: label(this, 160, y, '', 13, '#0a1430', { bold: true }).setDepth(2),
        name: label(this, 200, y, '', 14, COLORS.text, { ox: 0, body: true }),
        wave: label(this, 556, y, '', 14, COLORS.text, { body: true }),
        score: label(this, 656, y, '', 15, COLORS.text, { bold: true }),
      });
    }
    this.status = label(this, 400, 330, '', 15, COLORS.dim, { body: true });
    this.sourceLbl = label(this, 400, 524, '', 11, COLORS.dim, { body: true });
    const back = button(this, 400, 572, 'VOLVER', () => this.scene.start('Menu'), { width: 180, height: 40, size: 15 });
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
    reveal(this, [head, tabs, back]);
    this.loadScores(this.tab);
  }

  drawTabs(active) {
    const g = this.tabG;
    g.clear();
    g.fillStyle(COLORS.panel, 0.8);
    g.fillRoundedRect(-192, -22, 384, 44, 22);
    g.lineStyle(1.4, 0x4fc3f7, 0.45);
    g.strokeRoundedRect(-192, -22, 384, 44, 22);
    const i = active === 'coop' ? 1 : 0;
    g.fillStyle(0x4fc3f7, 0.22);
    g.fillRoundedRect(-188 + i * 192, -18, 188, 36, 18);
    g.lineStyle(1.6, 0xffd54f, 0.9);
    g.strokeRoundedRect(-188 + i * 192, -18, 188, 36, 18);
    for (const [id, t] of Object.entries(this.tabTexts)) {
      t.setColor(id === active ? COLORS.gold : COLORS.dim);
    }
  }

  async loadScores(mode) {
    this.tab = mode;
    const req = (this.reqId = (this.reqId || 0) + 1);
    this.drawTabs(mode);
    this.rowsGfx.clear();
    this.rows.forEach((r) => { r.rank.setText(''); r.name.setText(''); r.wave.setText(''); r.score.setText(''); });
    this.status.setText('Cargando...');
    const { items, source } = await fetchScores(mode);
    if (req !== this.reqId || !this.sys.isActive()) return;
    this.status.setText(items.length ? '' : 'Aún no hay puntuaciones. ¡Sé el primero!');
    const aws = window.ASTRO.config.leaderboardBackend === 'aws';
    this.sourceLbl.setText(source !== 'cloud' ? 'Sin conexión con el servidor: mostrando puntuaciones guardadas en este navegador'
      : aws ? 'Datos en la nube: AWS Lambda + DynamoDB' : 'Modo desarrollo: puntuaciones en memoria del lobby');
    const g = this.rowsGfx;
    items.slice(0, 10).forEach((it, i) => {
      const r = this.rows[i];
      // franja alterna y medalla del puesto
      if (i % 2 === 0) {
        g.fillStyle(0xffffff, 0.03);
        g.fillRoundedRect(112, r.y - 13, 576, 27, 6);
      }
      const col = RANK_COLORS[i] ?? 0x22304d;
      g.fillStyle(col, 1);
      g.fillCircle(160, r.y, 11);
      if (i < 3) { g.lineStyle(1.4, 0xffffff, 0.5); g.strokeCircle(160, r.y, 11); }
      r.rank.setText(String(i + 1)).setColor(i < 3 ? '#0a1430' : '#8fa3bf');
      const top = i === 0;
      r.name.setText(String(it.name).slice(0, 34)).setColor(top ? COLORS.gold : i < 3 ? '#e8eef7' : COLORS.text);
      r.wave.setText(String(it.wave ?? '-'));
      r.score.setText(Number(it.score).toLocaleString('es-MX')).setColor(top ? COLORS.gold : COLORS.text);
    });
  }

  update(_, delta) { this.bg.update(delta, 0.5); }
}
