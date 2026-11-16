// Punto de entrada del cliente: carga configuración y arranca Phaser.
// Nitidez HiDPI: el lienzo interno se crea a WORLD × S píxeles (S = 2 o 3 según
// la pantalla) y cada escena acerca su cámara con zoom S, de modo que toda la
// lógica y las coordenadas siguen en el espacio 800 × 600 del simulador.
import { loadConfig, loadManifest } from './api.js';
import { WORLD_W, WORLD_H } from '../shared/sim.js';
import { S } from './ui.js';
import { BootScene } from './scenes/Boot.js';
import { MenuScene } from './scenes/Menu.js';
import { ModeScene } from './scenes/Mode.js';
import { GameScene } from './scenes/Game.js';
import { LeaderboardScene } from './scenes/Leaderboard.js';
import { SpectateScene } from './scenes/Spectate.js';
import { HowToScene } from './scenes/HowTo.js';

const [config, manifest] = await Promise.all([loadConfig(), loadManifest()]);
window.ASTRO = { config, manifest };

// Todo texto se rasteriza a la resolución real del lienzo para que sea nítido.
const addText = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function patchedText(x, y, text, style = {}) {
  if (style.resolution === undefined) style = { ...style, resolution: S };
  return addText.call(this, x, y, text, style);
};

window.ASTRO.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WORLD_W * S,
  height: WORLD_H * S,
  backgroundColor: '#03040b',
  render: { antialias: true, pixelArt: false, roundPixels: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  dom: { createContainer: true },
  scene: [BootScene, MenuScene, ModeScene, GameScene, LeaderboardScene, SpectateScene, HowToScene],
});
