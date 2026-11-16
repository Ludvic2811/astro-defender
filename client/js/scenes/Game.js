import {
  PLAYER_COLORS, EV, MAX_PLAYERS, BOSS_EVERY, CARDS, ENEMY, isBossWave,
} from '../../shared/sim.js';
import { LocalSource, NetSource } from '../sources.js';
import {
  addStarfield, setupView, glassPanel, title, label, button, banner, fitSprite, FONT, BODY_FONT, COLORS, S,
} from '../ui.js';
import { sfx, music, toggleMute, unlockAudio } from '../audio.js';
import { getName, submitScore, requestMatch } from '../api.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const pad = (n) => String(Math.floor(n)).padStart(7, '0');
const fmt = (n) => Math.floor(n).toLocaleString('es-MX');

// Variantes del ovni del equipo: color y tamaño por tipo de enemigo
const ENEMY_LOOK = {
  [ENEMY.BASIC]: { tint: null, size: 1 },
  [ENEMY.KAMIKAZE]: { tint: 0xff6b6b, size: 0.82 },
  [ENEMY.SHOOTER]: { tint: 0xc792ff, size: 1.05 },
  [ENEMY.TANK]: { tint: 0xffb74d, size: 1.5 },
};
const BOSS_TINTS = [0xff8a80, 0xb388ff, 0x80d8ff, 0xffd180, 0xccff90];
const POWER_NAMES = ['ARMA +1', 'DISPARO TRIPLE', 'DISPARO RÁPIDO', 'ESCUDO', 'VIDA EXTRA', 'BOMBA +1'];
const POWER_TINTS = [0x4fc3f7, 0xffca28, 0x69f0ae, 0x82b1ff, 0xff5273, 0xffab40];

/**
 * Escena de juego. data.mode:
 *  - 'solo'     simulación local
 *  - 'coop'     jugador conectado a un servidor de juego (data.match = {host, port, code})
 *  - 'spectate' espectador de una partida en curso
 */
export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.gameMode = data.mode || 'solo';
    this.matchInfo = data.match || null;
    this.quick = !!data.quick;
    this.retries = data.retries || 0;
  }

  create() {
    setupView(this);
    this.cameras.main.fadeIn(250);
    this.bg = addStarfield(this, { planets: true });
    this.spr = { p: new Map(), e: new Map(), a: new Map(), b: new Map(), u: new Map() };
    this.overlayType = null;
    this.overlay = null;
    this.endedAt = 0;
    this.submitted = false;
    this.lastState = null;
    this.rematching = false;
    this.floaters = 0;
    const m = window.ASTRO.manifest || {};
    this.custom = { player: !!m.player, enemy: !!m.enemy };
    this.bossKey = m.boss ? 'boss' : (m.enemy ? 'enemy' : 'boss');

    this.particles = this.add.particles(0, 0, 'particle', {
      speed: { min: 40, max: 280 }, lifespan: { min: 300, max: 900 },
      scale: { start: 0.42, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [0xffffff, 0xffd54f, 0xff7043, 0xff5252], blendMode: 'ADD', emitting: false,
    }).setDepth(30);
    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 140, max: 420 }, lifespan: { min: 250, max: 550 },
      scale: { start: 0.4, end: 0.05 }, alpha: { start: 1, end: 0 }, rotate: { min: 0, max: 360 },
      tint: [0xffffff, 0xffe082, 0xffab40], blendMode: 'ADD', emitting: false,
    }).setDepth(31);
    this.smoke = this.add.particles(0, 0, 'smoke', {
      speed: { min: 15, max: 70 }, lifespan: { min: 600, max: 1100 },
      scale: { start: 0.25, end: 0.85 }, alpha: { start: 0.4, end: 0 },
      emitting: false,
    }).setDepth(28);
    this.debris = this.add.particles(0, 0, 'debris', {
      speed: { min: 60, max: 220 }, lifespan: { min: 500, max: 1100 }, rotate: { min: 0, max: 360 },
      scale: { start: 0.42, end: 0.1 }, alpha: { start: 1, end: 0 }, gravityY: 120, emitting: false,
    }).setDepth(29);
    this.laserGfx = this.add.graphics().setDepth(18).setBlendMode('ADD');
    this.vignette = this.add.image(400, 300, 'vignette').setDisplaySize(800, 600).setDepth(39).setAlpha(0);

    this.createHud();
    this.createTouchControls();

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE', false);
    const kb = this.input.keyboard;
    kb.on('keydown-ESC', () => this.onEsc());
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-M', () => toggleMute());
    kb.on('keydown-ENTER', () => this.onEnter());
    kb.on('keydown-B', () => this.bomb());
    kb.on('keydown-SHIFT', () => this.bomb());
    kb.on('keydown-ONE', () => this.pick(0));
    kb.on('keydown-TWO', () => this.pick(1));
    kb.on('keydown-THREE', () => this.pick(2));
    kb.on('keydown', unlockAudio);

    const name = getName() || 'Piloto';
    if (this.gameMode === 'solo') {
      this.source = new LocalSource(name);
    } else {
      this.source = new NetSource({
        host: this.matchInfo.host, port: this.matchInfo.port, name,
        role: this.gameMode === 'spectate' ? 'spectator' : 'player',
      });
    }
    music.start();
    this.events.once('shutdown', () => { this.source.destroy(); music.stop(); });

    if (this.gameMode !== 'spectate') {
      const msg = this.touchMode ? 'Disparo automático · joystick a la izquierda · botón B: bomba'
        : 'ESPACIO disparar · B o SHIFT bomba · P pausa';
      const hint = label(this, 400, 560, msg, 13, COLORS.dim, { body: true }).setDepth(41);
      this.tweens.add({ targets: hint, alpha: 0, delay: 6000, duration: 800, onComplete: () => hint.destroy() });
    }
  }

  // ================================================================ entrada
  readInput() {
    const k = this.keys;
    const j = this.joy?.vec || { x: 0, y: 0 };
    return {
      u: k.UP.isDown || k.W.isDown || j.y < -0.35,
      d: k.DOWN.isDown || k.S.isDown || j.y > 0.35,
      l: k.LEFT.isDown || k.A.isDown || j.x < -0.35,
      r: k.RIGHT.isDown || k.D.isDown || j.x > 0.35,
      f: k.SPACE.isDown || !!this.touchMode,
    };
  }

  bomb() {
    if (this.gameMode === 'spectate' || this.lastState !== 'playing' || this.source.paused) return;
    this.source.bomb();
  }

  pick(i) {
    if (this.overlayType === 'upgrade' && this.gameMode !== 'spectate') this.source.pick(i);
  }

  onEsc() {
    if (this.gameMode === 'solo' && this.lastState === 'playing') return this.togglePause();
    this.toMenu();
  }

  onEnter() {
    const st = this.lastState;
    if (st === 'lobby' && this.source.isHost) this.source.start();
    if (st === 'gameover' && this.overlayType === 'result') this.playAgain();
  }

  togglePause() {
    if (this.gameMode !== 'solo' || this.lastState !== 'playing') return;
    this.source.paused = !this.source.paused;
  }

  toMenu() { this.scene.start(this.gameMode === 'spectate' ? 'Spectate' : 'Menu'); }

  playAgain() {
    if (this.gameMode === 'solo') { this.source.restart(); this.resetResult(); }
    else if (this.gameMode === 'coop' && this.source.isHost) this.source.restart();
  }

  resetResult() { this.submitted = false; this.endedAt = 0; }

  // ================================================================ controles táctiles
  createTouchControls() {
    if (!this.sys.game.device.input.touch) return;
    this.touchMode = true; // disparo automático
    this.input.addPointer(2);
    const base = this.add.container(110, 490).setDepth(45).setAlpha(0.85);
    const baseBg = this.add.circle(0, 0, 56, 0xffffff, 0.06).setStrokeStyle(2, 0x4fc3f7, 0.45);
    const baseIn = this.add.circle(0, 0, 40, 0xffffff, 0.04).setStrokeStyle(1, 0xffffff, 0.15);
    base.add([baseBg, baseIn]);
    const knob = this.add.container(110, 490).setDepth(46);
    const knobGlow = this.add.image(0, 0, 'glow').setDisplaySize(84, 84).setTint(0x4fc3f7).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD);
    const knobBody = this.add.circle(0, 0, 24, 0x4fc3f7, 0.5).setStrokeStyle(2, 0xbfe9ff, 0.8);
    knob.add([knobGlow, knobBody]);
    this.joy = { id: null, vec: { x: 0, y: 0 }, base, knob };

    const bombBtn = this.add.container(712, 500).setDepth(46);
    const bombGlow = this.add.image(0, 0, 'glow').setDisplaySize(130, 130).setTint(0xff9100).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD);
    const bombBody = this.add.circle(0, 0, 36, 0xff9100, 0.4).setStrokeStyle(2.5, 0xffd180, 0.9);
    const bombIcon = this.add.image(0, 0, 'ic-bomba');
    fitSprite(bombIcon, 34);
    bombBtn.add([bombGlow, bombBody, bombIcon]);
    bombBtn.setSize(100, 100).setInteractive();
    bombBtn.on('pointerdown', () => {
      this.tweens.add({ targets: bombBtn, scale: 0.9, duration: 70, yoyo: true });
      this.bomb();
    });

    this.input.on('pointerdown', (p) => {
      if (this.joy.id !== null || p.worldX > 400 || p.worldY < 220) return;
      this.joy.id = p.id;
      base.setPosition(p.worldX, p.worldY);
      knob.setPosition(p.worldX, p.worldY);
    });
    this.input.on('pointermove', (p) => {
      if (p.id !== this.joy.id) return;
      const dx = p.worldX - base.x, dy = p.worldY - base.y;
      const d = Math.min(56, Math.hypot(dx, dy)) || 1;
      const ang = Math.atan2(dy, dx);
      knob.setPosition(base.x + Math.cos(ang) * d, base.y + Math.sin(ang) * d);
      this.joy.vec = { x: (Math.cos(ang) * d) / 56, y: (Math.sin(ang) * d) / 56 };
    });
    const release = (p) => {
      if (p.id !== this.joy.id) return;
      this.joy.id = null;
      this.joy.vec = { x: 0, y: 0 };
      knob.setPosition(base.x, base.y);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  // ================================================================ bucle
  update(_, delta) {
    const src = this.source;
    const s = src.getState();
    const playing = s && s.st === 'playing' && !src.paused && s.ph !== 'upgrade';
    this.bg.update(delta, playing ? (s.crit ? 2.6 : 1.8) : 0.5);

    if (src.kind === 'net') {
      if (src.error === 'full' && this.quick && !this.rematching) return this.rematch();
      if (src.status === 'closed' && !this.rematching) { this.setOverlay('closed', s); return; }
      if (!s) { this.setOverlay('connecting'); return; }
    }

    src.update(delta, src.paused ? {} : this.readInput());
    if (!s) return;

    if (s.st !== this.lastState) {
      if (s.st === 'gameover') this.endedAt = this.time.now;
      if (s.st === 'playing' || s.st === 'lobby') this.resetResult();
      this.lastState = s.st;
    }

    // Música y ambiente según la oleada
    if (s.st === 'playing') music.set(s.crit ? 3 : s.w >= 10 ? 2 : s.w >= 4 ? 1 : 0, s.bm > 0);
    else music.set(0, false);
    if (s.w) this.bg.setSector(Math.floor((s.w - 1) / BOSS_EVERY));
    const danger = s.crit ? 0.12 + Math.sin(this.time.now / 300) * 0.06 : 0;
    if (!this.vignetteTween) this.vignette.setAlpha(danger);

    this.renderWorld(s);
    this.renderLaser(s);
    for (const ev of src.drainEvents()) this.handleEvent(ev);
    this.updateHud(s);

    if (s.st === 'lobby') this.setOverlay('lobby', s);
    else if (s.st === 'gameover') { if (this.time.now - this.endedAt > 1300) this.setOverlay('result', s); }
    else if (s.ph === 'upgrade') this.setOverlay('upgrade', s);
    else if (src.paused) this.setOverlay('paused', s);
    else this.setOverlay(null);

    if (this.overlay?.refresh) this.overlay.refresh(s);
  }

  async rematch() {
    this.rematching = true;
    this.source.destroy();
    const giveUp = () => { this.quick = false; this.rematching = false; this.source.status = 'closed'; };
    if (this.retries >= 3) return giveUp();
    try {
      const match = await requestMatch('quick');
      this.scene.restart({ mode: 'coop', match, quick: true, retries: this.retries + 1 });
    } catch {
      giveUp();
    }
  }

  // ================================================================ render
  sync(map, list, create, update) {
    const seen = new Set();
    for (const it of list) {
      seen.add(it[0]);
      let o = map.get(it[0]);
      if (!o) { o = create(it); map.set(it[0], o); }
      update(o, it);
    }
    for (const [id, o] of map) {
      if (!seen.has(id)) { o.destroy(); map.delete(id); }
    }
  }

  renderWorld(s) {
    const t = this.time.now;
    const showNames = this.gameMode !== 'solo';
    const myId = this.source.myId;

    this.sync(this.spr.p, s.p, (it) => {
      const c = this.add.container(it[1], it[2]).setDepth(20);
      const ship = this.add.image(0, 0, 'player');
      fitSprite(ship, this.custom.player ? 70 : 54);
      // sombra proyectada para que el dibujo se funda con el fondo
      const shadow = this.add.image(4, 7, 'player').setTint(0x000000).setAlpha(0.3);
      shadow.setScale(ship.scaleX);
      const engine = this.add.image(0, ship.displayHeight / 2 + 2, 'glow')
        .setTint(0xffa040).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
      fitSprite(engine, 34);
      const flame = this.add.image(0, ship.displayHeight / 2 + 6, 'flame').setBlendMode('ADD').setVisible(!this.custom.player);
      const aura = this.add.image(0, 0, 'ring').setTint(0xffd54f).setBlendMode('ADD').setVisible(false);
      fitSprite(aura, 76);
      const shield = this.add.image(0, 0, 'ring').setTint(0x82b1ff).setBlendMode('ADD').setVisible(false);
      fitSprite(shield, 88);
      c.add([shadow, engine, flame, aura, ship, shield]);
      if (showNames) {
        const color = it[0] === myId ? '#ffffff' : hex(PLAYER_COLORS[it[7]] || 0xffffff);
        const tag = this.add.text(0, ship.displayHeight / 2 + 18, it[0] === myId ? `▲ ${it[6]}` : it[6], {
          fontFamily: FONT, fontSize: '10px', color, stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
        c.addAt(this.add.circle(0, 0, 32, PLAYER_COLORS[it[7]] || 0xffffff, 0.12), 0);
        c.add(tag);
      }
      const trail = this.add.particles(0, 0, 'particle', {
        lifespan: 380, speedY: { min: 80, max: 150 }, speedX: { min: -15, max: 15 },
        scale: { start: 0.2, end: 0 }, alpha: { start: 0.7, end: 0 },
        tint: [0xffb300, 0xff7043], blendMode: 'ADD', frequency: 35,
      }).setDepth(19);
      trail.startFollow(c, 0, ship.displayHeight / 2);
      c.on('destroy', () => trail.destroy());
      Object.assign(c, { ship, shadow, engine, flame, aura, shield, trail, useFlame: !this.custom.player, prevX: it[1] });
      return c;
    }, (c, it) => {
      c.setPosition(it[1], it[2]);
      const flags = it[5];
      const alive = !!(flags & 1);
      c.setVisible(alive);
      c.trail.emitting = alive && s.st === 'playing';
      c.ship.setAlpha(flags & 2 ? (Math.floor(t / 90) % 2 ? 0.25 : 1) : 1);
      c.shadow.setAlpha(c.ship.alpha * 0.3);
      // Inclinación al moverse
      const vx = it[1] - c.prevX;
      c.prevX = it[1];
      c.ship.rotation += (Phaser.Math.Clamp(vx * 0.06, -0.35, 0.35) - c.ship.rotation) * 0.2;
      c.shadow.rotation = c.ship.rotation;
      c.engine.setAlpha(0.4 + Math.random() * 0.3);
      if (c.useFlame) c.flame.setScale(0.27 + Math.random() * 0.13, 0.23 + Math.random() * 0.2);
      c.aura.setVisible(!!(flags & 4));
      c.aura.rotation = t / 300;
      c.shield.setVisible(!!(flags & 16));
      c.shield.setAlpha(0.55 + Math.sin(t / 150) * 0.25);
      c.trail.particleTint = flags & 8 ? 0x69f0ae : 0xffb300;
    });

    this.sync(this.spr.e, s.e, (it) => {
      const type = it[1];
      let img;
      if (type === ENEMY.BOSS) {
        img = this.add.image(it[2], it[3], this.bossKey).setDepth(15);
        fitSprite(img, 180);
        img.baseTint = BOSS_TINTS[((s.bk || 1) - 1) % BOSS_TINTS.length];
        img.setTint(img.baseTint);
      } else {
        const look = ENEMY_LOOK[type] || ENEMY_LOOK[0];
        img = this.add.image(it[2], it[3], 'enemy').setDepth(15);
        fitSprite(img, (this.custom.enemy ? 58 : 50) * look.size);
        if (look.tint) img.setTint(look.tint);
        img.baseTint = look.tint;
      }
      img.type = type;
      img.prev = [it[2], it[3]];
      return img;
    }, (img, it) => {
      const [px, py] = img.prev;
      img.setPosition(it[2], it[3]);
      img.prev = [it[2], it[3]];
      if (img.type === ENEMY.KAMIKAZE) {
        if (it[4] === 1) { // apuntando: parpadea
          const on = Math.floor(t / 80) % 2;
          if (on) img.setTintFill(0xffffff); else img.setTint(img.baseTint);
          img.rotation = 0;
        } else if (it[4] === 2) {
          img.setTint(img.baseTint);
          img.rotation = Math.atan2(it[3] - py, it[2] - px) - Math.PI / 2;
        }
      } else if (img.type === ENEMY.BASIC || img.type === ENEMY.SHOOTER) {
        img.rotation = Math.sin(t / 250 + it[0]) * 0.12;
      }
    });

    this.sync(this.spr.a, s.a, (it) => {
      const img = this.add.image(it[2], it[3], 'asteroid').setDepth(12);
      fitSprite(img, [34, 56, 84][it[1]] || 56);
      return img;
    }, (img, it) => { img.setPosition(it[2], it[3]); img.rotation = it[4]; });

    this.sync(this.spr.b, s.b, (it) => {
      const key = it[1] === 1 ? 'ebullet' : it[1] === 2 ? 'bigbullet' : 'bullet';
      const img = this.add.image(it[2], it[3], key).setDepth(it[1] === 1 ? 17 : 16).setBlendMode('ADD');
      fitSprite(img, it[1] === 1 ? 20 : it[1] === 2 ? 32 : 27);
      return img;
    }, (img, it) => img.setPosition(it[2], it[3]));

    this.sync(this.spr.u, s.u, (it) => {
      const c = this.add.container(it[2], it[3]).setDepth(14);
      const halo = this.add.image(0, 0, 'glow').setTint(POWER_TINTS[it[1]] || 0xffffff)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
      fitSprite(halo, 58);
      const icon = this.add.image(0, 0, `pw${it[1]}`);
      fitSprite(icon, 34);
      c.add([halo, icon]);
      return c;
    }, (c, it) => {
      c.setPosition(it[2], it[3]);
      c.setScale(1 + Math.sin(t / 150) * 0.1);
      c.rotation = Math.sin(t / 500 + it[0]) * 0.1;
    });
  }

  renderLaser(s) {
    const g = this.laserGfx;
    g.clear();
    if (!s.bl) return;
    const boss = [...this.spr.e.values()].find((o) => o.type === ENEMY.BOSS);
    if (!boss) return;
    const y0 = boss.y + boss.displayHeight * 0.3;
    if (s.bl === 1) {
      if (Math.floor(this.time.now / 100) % 2) {
        g.fillStyle(0xff1744, 0.55);
        g.fillRect(boss.x - 2, y0, 4, 600 - y0);
        g.fillStyle(0xffffff, 0.5);
        g.fillRect(boss.x - 0.7, y0, 1.4, 600 - y0);
      }
    } else {
      const w = 36 + Math.random() * 8;
      g.fillStyle(0xff1744, 0.18);
      g.fillRect(boss.x - w * 0.85, y0, w * 1.7, 600 - y0);
      g.fillStyle(0xff1744, 0.4);
      g.fillRect(boss.x - w / 2, y0, w, 600 - y0);
      g.fillStyle(0xff7961, 0.75);
      g.fillRect(boss.x - 10, y0, 20, 600 - y0);
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(boss.x - 5, y0, 10, 600 - y0);
    }
  }

  // ================================================================ efectos
  flash(id) {
    const o = this.spr.e.get(id) || this.spr.a.get(id);
    if (!o) return;
    o.setTintFill(0xffffff);
    this.time.delayedCall(60, () => { if (o.active) { if (o.baseTint) o.setTint(o.baseTint); else o.clearTint(); } });
  }

  explode(x, y, size) {
    this.particles.explode([12, 26, 90][size] || 12, x, y);
    this.debris.explode([6, 10, 24][size] || 6, x, y);
    this.sparks.explode([7, 13, 36][size] || 7, x, y);
    this.smoke.explode([3, 6, 16][size] || 3, x, y);
    const flash = this.add.image(x, y, 'glow').setDepth(31).setBlendMode('ADD').setTint(0xffe0b2);
    const fs = fitSprite(flash, [54, 92, 230][size] || 54);
    this.tweens.add({
      targets: flash, scale: fs * 1.7, alpha: 0, duration: 200 + size * 90,
      ease: 'Cubic.easeOut', onComplete: () => flash.destroy(),
    });
    const ring = this.add.image(x, y, 'ring').setDepth(29).setBlendMode('ADD').setTint(0xffb74d);
    const rs = fitSprite(ring, 22);
    this.tweens.add({
      targets: ring, scale: rs * [2.8, 4.8, 12][size] || rs * 3, alpha: 0,
      duration: 380 + size * 200, ease: 'Cubic.easeOut', onComplete: () => ring.destroy(),
    });
    sfx.boom(size);
    if (size === 2) {
      this.cameras.main.shake(500, 0.015);
      this.punch();
      this.source.freeze(70);
    }
  }

  punch(zoom = 1.025) {
    const cam = this.cameras.main;
    this.tweens.add({ targets: cam, zoom: S * zoom, duration: 60, yoyo: true, onComplete: () => cam.setZoom(S) });
  }

  floatText(x, y, text, color = '#ffffff', size = 14) {
    if (this.floaters > 28) return;
    this.floaters++;
    const t = this.add.text(x, y, text, {
      fontFamily: FONT, fontSize: `${size}px`, fontStyle: '700', color, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(35);
    this.tweens.add({
      targets: t, y: y - 36, alpha: 0, duration: 750, ease: 'Cubic.easeOut',
      onComplete: () => { t.destroy(); this.floaters--; },
    });
  }

  dangerFlash() {
    this.vignetteTween?.stop();
    this.vignette.setAlpha(0);
    this.vignetteTween = this.tweens.add({
      targets: this.vignette, alpha: 0.7, duration: 250, yoyo: true, repeat: 3,
      onComplete: () => { this.vignetteTween = null; },
    });
  }

  playerName(id) {
    return this.source.getState()?.p.find((p) => p[0] === id)?.[6] || 'Piloto';
  }

  handleEvent([type, x, y, a, b]) {
    const me = this.source.myId;
    switch (type) {
      case EV.SHOT: a === 0 ? sfx.shoot() : sfx.eshot(); break;
      case EV.BOOM: this.explode(x, y, a); break;
      case EV.HIT: this.flash(a); this.particles.explode(3, x, y); sfx.hit(); break;
      case EV.PHIT:
        if (a === me) { this.cameras.main.shake(250, 0.012); this.cameras.main.flash(150, 255, 40, 40); sfx.phit(); }
        else sfx.hit();
        break;
      case EV.SHIELD: {
        sfx.shieldBreak();
        const ring = this.add.image(x, y, 'ring').setTint(0x82b1ff).setBlendMode('ADD').setDepth(31);
        const rs = fitSprite(ring, 76);
        this.tweens.add({ targets: ring, scale: rs * 2.2, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
        break;
      }
      case EV.PDEAD:
        if (a === me) {
          banner(this, 'NAVE DESTRUIDA', COLORS.danger, 34, 900);
          if (this.gameMode === 'coop') {
            const t = label(this, 400, 320, 'Sin vidas: reaparecerás en la siguiente oleada si tu equipo resiste', 14, COLORS.dim, { body: true }).setDepth(45);
            this.tweens.add({ targets: t, alpha: 0, delay: 3000, duration: 600, onComplete: () => t.destroy() });
          }
        }
        break;
      case EV.WAVE:
        banner(this, isBossWave(a) ? `OLEADA ${a} · JEFE` : `OLEADA ${a}`, isBossWave(a) ? COLORS.danger : COLORS.text, 40);
        sfx.wave();
        break;
      case EV.CLEAR: banner(this, '¡OLEADA SUPERADA!', COLORS.ok, 28, 700); break;
      case EV.WARN:
        this.time.delayedCall(900, () => banner(this, '⚠ PELIGRO ⚠', COLORS.danger, 48, 1100));
        this.time.delayedCall(900, () => this.dangerFlash());
        sfx.warn();
        break;
      case EV.SECTOR:
        banner(this, '¡SECTOR LIBERADO!', COLORS.gold, 44, 1500);
        this.cameras.main.flash(300, 255, 255, 255);
        this.source.freeze(220);
        sfx.sector();
        break;
      case EV.CRITICAL:
        this.time.delayedCall(1200, () => banner(this, 'ZONA CRÍTICA · PUNTOS ×2', COLORS.danger, 34, 1400));
        this.dangerFlash();
        break;
      case EV.POWER:
        if (a === me) { this.floatText(x, y - 10, POWER_NAMES[b] || '', COLORS.gold, 15); sfx.power(); }
        break;
      case EV.LEVEL:
        if (a === me) { banner(this, `ARMA NIVEL ${b}`, '#4fc3f7', 26, 600); sfx.level(); }
        break;
      case EV.PTS: this.floatText(x, y, `+${fmt(a)}`, a >= 1000 ? COLORS.gold : '#ffffff', a >= 1000 ? 18 : 13); break;
      case EV.COMBO:
        if (a === me) { this.floatText(x, y - 40, `COMBO ×${b}`, '#ff80ab', 18); sfx.combo(b); }
        break;
      case EV.BOMB: {
        this.cameras.main.flash(250, 255, 255, 255);
        this.cameras.main.shake(400, 0.02);
        this.punch(1.04);
        const wave = this.add.image(x, y, 'ring').setDepth(32).setBlendMode('ADD').setTint(0xffd180);
        const ws = fitSprite(wave, 40);
        this.tweens.add({ targets: wave, scale: ws * 28, alpha: 0, duration: 700, onComplete: () => wave.destroy() });
        sfx.bomb();
        break;
      }
      case EV.LASER: sfx.laser(); break;
      case EV.CARD: if (a === me) sfx.card(); break;
      case EV.REVIVE:
        this.floatText(x, y - 30, a === me ? '¡DE VUELTA AL COMBATE!' : `${this.playerName(a)} REGRESA`, COLORS.ok, 15);
        sfx.revive();
        break;
      case EV.END: sfx.lose(); break;
    }
  }

  // ================================================================ HUD
  createHud() {
    const D = 40;
    const solo = this.gameMode === 'solo';
    const spectator = this.gameMode === 'spectate';
    const h = (this.hud = {});

    // --- panel de puntos (arriba a la izquierda)
    glassPanel(this, 117, 38, 210, 56, { radius: 12, alpha: 0.6 }).setDepth(D);
    h.scoreLbl = label(this, 26, 21, 'PUNTOS', 10, COLORS.dim, { ox: 0, oy: 0 }).setDepth(D + 1);
    h.score = label(this, 26, 33, '0000000', 23, COLORS.text, { ox: 0, oy: 0, bold: true }).setDepth(D + 1);

    // --- insignia de combo
    h.comboC = this.add.container(26, 82).setDepth(D + 1).setVisible(false);
    const comboG = this.add.graphics();
    comboG.fillStyle(0x3d1026, 0.82);
    comboG.fillRoundedRect(0, -12, 108, 24, 12);
    comboG.lineStyle(1.5, 0xff80ab, 0.9);
    comboG.strokeRoundedRect(0, -12, 108, 24, 12);
    h.comboTxt = label(this, 54, 0, '', 13, '#ff9fc0', { bold: true });
    h.comboC.add([comboG, h.comboTxt]);
    h.lastCombo = 0;

    // --- píldora de oleada (arriba al centro)
    glassPanel(this, 400, 31, 198, 46, { radius: 20, alpha: 0.6 }).setDepth(D);
    h.wave = label(this, 400, 23, '', 15, COLORS.accentCss, { bold: true }).setDepth(D + 1);
    h.sector = label(this, 400, 41, '', 9, COLORS.dim).setDepth(D + 1);

    // --- barra del jefe
    h.bossC = this.add.container(0, 0).setDepth(D + 1).setVisible(false);
    const bossFrame = this.add.graphics();
    bossFrame.fillStyle(0x140407, 0.8);
    bossFrame.fillRoundedRect(188, 62, 424, 16, 8);
    bossFrame.lineStyle(1.6, 0xff5252, 0.9);
    bossFrame.strokeRoundedRect(188, 62, 424, 16, 8);
    h.bossGhost = this.add.rectangle(192, 70, 416, 8, 0xffffff, 0.65).setOrigin(0, 0.5);
    h.bossFill = this.add.rectangle(192, 70, 416, 8, 0xff1744).setOrigin(0, 0.5);
    h.bossGloss = this.add.rectangle(192, 67.5, 416, 3, 0xffffff, 0.22).setOrigin(0, 0.5);
    h.bossLbl = label(this, 400, 88, '', 10, COLORS.danger, { bold: true });
    h.bossC.add([bossFrame, h.bossGhost, h.bossFill, h.bossGloss, h.bossLbl]);

    // --- panel de estado de la nave (arriba a la derecha)
    if (!spectator) {
      h.gearPanel = glassPanel(this, 683, 48, 210, 76, { radius: 12, alpha: 0.6 }).setDepth(D);
      h.lives = [];
      for (let i = 0; i < 6; i++) {
        const img = this.add.image(772 - i * 23, 30, 'player').setDepth(D + 1);
        fitSprite(img, 21);
        h.lives.push(img);
      }
      label(this, 592, 30, 'VIDAS', 9, COLORS.dim, { ox: 0 }).setDepth(D + 1);
      label(this, 592, 53, 'ARMA', 9, COLORS.dim, { ox: 0 }).setDepth(D + 1);
      label(this, 592, 72, 'BOMBAS', 9, COLORS.dim, { ox: 0 }).setDepth(D + 1);
      h.gearGfx = this.add.graphics().setDepth(D + 1);
      h.bombIcons = [];
      for (let i = 0; i < 4; i++) {
        const b = this.add.image(650 + i * 20, 72, 'ic-bomba').setDepth(D + 1).setVisible(false);
        fitSprite(b, 16);
        h.bombIcons.push(b);
      }
      h.bombMore = label(this, 650 + 4 * 20 - 6, 72, '', 11, '#ffcc80', { ox: 0, bold: true }).setDepth(D + 1);
      h.lastGear = '';

      // --- efectos activos (píldoras)
      h.fx = {};
      const fxDefs = [['triple', 'TRIPLE', 0xffca28], ['fast', 'RÁPIDO', 0x69f0ae], ['shield', 'ESCUDO', 0x82b1ff]];
      for (const [id, txt, colNum] of fxDefs) {
        const cont = this.add.container(0, 104).setDepth(D + 1).setVisible(false);
        const g = this.add.graphics();
        const w = 74;
        g.fillStyle(0x081024, 0.75);
        g.fillRoundedRect(0, -11, w, 22, 11);
        g.lineStyle(1.4, colNum, 0.9);
        g.strokeRoundedRect(0, -11, w, 22, 11);
        g.fillStyle(colNum, 1);
        g.fillCircle(12, 0, 3.2);
        const tx = label(this, w / 2 + 5, 0, txt, 10, hex(colNum), { bold: true });
        cont.add([g, tx]);
        cont.pillW = w;
        h.fx[id] = cont;
      }
    } else {
      h.lives = [];
      h.fx = {};
    }

    // --- información inferior derecha (sala, espectadores, ping)
    h.right = label(this, 788, 572, '', 11, COLORS.dim, { ox: 1, oy: 1, align: 'right' }).setDepth(D + 1);
    h.net = label(this, 788, 590, '', 10, COLORS.dim, { ox: 1, oy: 1 }).setDepth(D + 1);

    // --- equipo (abajo a la izquierda, solo multijugador)
    if (!solo) {
      h.teamGfx = this.add.graphics().setDepth(D);
      h.teamRows = [];
      for (let i = 0; i < MAX_PLAYERS; i++) {
        const dot = this.add.circle(0, 0, 4, 0xffffff).setDepth(D + 1).setVisible(false);
        const txt = label(this, 0, 0, '', 12, COLORS.text, { ox: 0, body: true, bold: true }).setDepth(D + 1);
        h.teamRows.push({ dot, txt });
      }
      h.lastTeamN = -1;
    }
  }

  updateHud(s) {
    const h = this.hud;
    const me = s.p.find((p) => p[0] === this.source.myId);
    const solo = this.gameMode === 'solo';
    const spectator = this.gameMode === 'spectate';
    h.scoreLbl.setText(solo ? 'PUNTOS' : 'PUNTOS DEL EQUIPO');
    h.score.setText(pad(solo ? (me ? me[4] : 0) : s.ts));

    // combo con rebote al subir
    const combo = me && me[10] > 1 ? me[10] : 0;
    h.comboC.setVisible(!!combo);
    if (combo) {
      h.comboTxt.setText(`COMBO ×${combo}`);
      if (combo !== h.lastCombo) {
        h.comboC.setScale(1.25);
        this.tweens.add({ targets: h.comboC, scale: 1, duration: 160, ease: 'Back.easeOut' });
      }
    }
    h.lastCombo = combo;

    h.wave.setText(s.w ? `OLEADA ${s.w}` : '');
    const sector = Math.floor((Math.max(1, s.w) - 1) / BOSS_EVERY) + 1;
    h.sector.setText(s.w ? (s.crit ? `SECTOR ${sector} · ZONA CRÍTICA ×2` : `SECTOR ${sector}`) : '');
    h.sector.setColor(s.crit ? COLORS.danger : COLORS.dim);

    if (!spectator && h.gearGfx) {
      const lives = me ? me[3] : 0;
      h.lives.forEach((img, i) => img.setVisible(i < lives));
      const lvl = me ? me[8] : 0;
      const bombs = me ? me[9] : 0;
      const gearKey = `${lvl}|${bombs}`;
      if (gearKey !== h.lastGear) {
        h.lastGear = gearKey;
        const g = h.gearGfx;
        g.clear();
        for (let i = 0; i < 4; i++) { // nivel de arma 1-4 en segmentos
          const x = 650 + i * 24;
          if (i < lvl) {
            g.fillStyle(0x4fc3f7, 1);
            g.fillRoundedRect(x, 49, 19, 8, 2);
          } else {
            g.lineStyle(1.2, 0x4fc3f7, 0.35);
            g.strokeRoundedRect(x, 49, 19, 8, 2);
          }
        }
        h.bombIcons.forEach((b, i) => b.setVisible(i < Math.min(bombs, 4)));
        h.bombMore.setText(bombs > 4 ? `+${bombs - 4}` : bombs === 0 ? '—' : '');
        h.bombMore.setColor(bombs === 0 ? '#5a6b85' : '#ffcc80');
      }

      // píldoras de efectos activos, apiladas desde la derecha
      const act = [];
      if (me && me[5] & 4) act.push('triple');
      if (me && me[5] & 8) act.push('fast');
      if (me && me[5] & 16) act.push('shield');
      let x = 788;
      for (const id of ['triple', 'fast', 'shield']) {
        const pill = h.fx[id];
        const on = act.includes(id);
        if (on && !pill.visible) {
          pill.setVisible(true).setScale(0.6);
          this.tweens.add({ targets: pill, scale: 1, duration: 160, ease: 'Back.easeOut' });
        } else if (!on) pill.setVisible(false);
        if (on) { x -= pill.pillW; pill.x = x; x -= 8; }
      }
    }

    const bits = [];
    if (spectator) bits.push('MODO ESPECTADOR');
    if (this.matchInfo?.code && !solo) bits.push(`SALA ${this.matchInfo.code}`);
    if (me && !solo) bits.push(`TUS PUNTOS ${fmt(me[4])}`);
    h.right.setText(bits.join('  ·  '));

    if (!solo) {
      const rows = s.p.slice().sort((a, b) => a[7] - b[7]);
      if (rows.length !== h.lastTeamN) {
        h.lastTeamN = rows.length;
        const g = h.teamGfx;
        g.clear();
        const ph = rows.length * 22 + 14;
        g.fillStyle(COLORS.panel, 0.55);
        g.fillRoundedRect(12, 588 - ph, 236, ph, 10);
        g.lineStyle(1.2, 0x4fc3f7, 0.35);
        g.strokeRoundedRect(12, 588 - ph, 236, ph, 10);
      }
      const y0 = 588 - rows.length * 22 - 14;
      h.teamRows.forEach((row, i) => {
        const p = rows[i];
        if (!p) { row.dot.setVisible(false); row.txt.setText(''); return; }
        const alive = p[5] & 1;
        const col = PLAYER_COLORS[p[7]] || 0xffffff;
        row.dot.setVisible(true).setPosition(28, y0 + 18 + i * 22).setFillStyle(col, alive ? 1 : 0.25);
        row.txt.setPosition(40, y0 + 18 + i * 22);
        row.txt.setText(`${p[6]}  ${fmt(p[4])}  ${'♥'.repeat(Math.max(0, p[3]))}`);
        row.txt.setColor(alive ? hex(col) : '#5a6b85');
      });
      h.net.setText(`${this.source.ping ? `ping ${this.source.ping} ms · ` : ''}espectadores ${this.source.spectators || 0}`);
    }

    const boss = s.bm > 0;
    h.bossC.setVisible(boss);
    if (boss) {
      const w = 416 * Math.max(0, s.bh / s.bm);
      h.bossFill.width = w;
      h.bossGloss.width = w;
      // estela blanca que persigue al daño
      h.bossGhost.width += (w - h.bossGhost.width) * 0.06;
      if (h.bossGhost.width < w) h.bossGhost.width = w;
      h.bossLbl.setText(`NAVE NODRIZA · SECTOR ${s.bk}`);
    } else {
      h.bossGhost.width = 416;
    }
  }

  // ================================================================ capas
  setOverlay(type, s) {
    if (type === this.overlayType) return;
    this.overlay?.destroy();
    this.overlay = null;
    this.overlayType = type;
    if (!type) return;
    const builders = {
      connecting: () => this.buildMessage('CONECTANDO...', `Sala ${this.matchInfo?.code || ''}`, false),
      closed: () => this.buildMessage('CONEXIÓN TERMINADA',
        this.source.error === 'full' ? 'La sala está llena.' :
          this.source.closeCode === 4000 ? 'El servidor de la partida se cerró.' :
            'No se pudo conectar o se perdió la conexión con el servidor de juego.', true),
      paused: () => this.buildMessage('PAUSA', 'P: continuar    ESC: salir al menú', false),
      lobby: () => this.buildLobby(),
      upgrade: () => this.buildUpgrade(),
      result: () => this.buildResult(s),
    };
    this.overlay = builders[type]();
  }

  panel(h = 420, w = 560) {
    const c = this.add.container(0, 0).setDepth(60);
    c.add(this.add.rectangle(400, 300, 800, 600, 0x02030a, 0.62));
    c.add(glassPanel(this, 400, 300, w, h, { alpha: 0.88, radius: 18 }));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 160 });
    return c;
  }

  buildMessage(head, text, withButton) {
    const c = this.panel(220);
    c.add(title(this, 400, 245, head, 30));
    c.add(label(this, 400, 300, text, 15, COLORS.text, { body: true, wrap: 480 }));
    if (withButton) c.add(button(this, 400, 360, 'MENÚ', () => this.toMenu(), { width: 180, height: 42 }));
    return c;
  }

  buildLobby() {
    const c = this.panel(440);
    const spectator = this.gameMode === 'spectate';
    c.add(title(this, 400, 118, 'SALA DE ESPERA', 30));
    const chip = this.add.graphics();
    chip.fillStyle(0x0c1736, 0.9);
    chip.fillRoundedRect(302, 158, 196, 56, 12);
    chip.lineStyle(1.6, 0xffd54f, 0.7);
    chip.strokeRoundedRect(302, 158, 196, 56, 12);
    c.add(chip);
    c.add(label(this, 400, 170, 'CÓDIGO DE SALA', 9, COLORS.dim));
    c.add(title(this, 400, 194, this.matchInfo?.code || '-----', 26, COLORS.gold));
    c.add(label(this, 400, 230, 'Compártelo con tu equipo para que se una', 12, COLORS.dim, { body: true }));
    const slots = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const y = 268 + i * 31;
      const row = this.add.graphics();
      row.fillStyle(0x0c1736, 0.55);
      row.fillRoundedRect(230, y - 13, 340, 26, 8);
      c.add(row);
      const dot = this.add.circle(248, y, 5, 0xffffff, 1);
      const t = label(this, 264, y, '', 14, COLORS.dim, { body: true, ox: 0 });
      slots.push({ dot, t });
      c.add([dot, t]);
    }
    const hint = label(this, 400, 400, '', 13, COLORS.text, { body: true });
    c.add(hint);
    const startBtn = button(this, 300, 452, 'INICIAR', () => this.source.start(), { width: 180, height: 44 });
    const exitBtn = button(this, 500, 452, 'SALIR', () => this.toMenu(), { width: 180, height: 44 });
    c.add([startBtn, exitBtn]);
    c.refresh = (s) => {
      const bySlot = new Map(s.p.map((p) => [p[7], p]));
      slots.forEach(({ dot, t }, i) => {
        const p = bySlot.get(i);
        if (p) {
          const tags = [p[0] === this.source.hostId ? 'anfitrión' : '', p[0] === this.source.myId ? 'tú' : ''].filter(Boolean);
          dot.setFillStyle(PLAYER_COLORS[i], 1);
          t.setText(`${p[6]}${tags.length ? `   (${tags.join(', ')})` : ''}`).setColor(hex(PLAYER_COLORS[i]));
        } else {
          dot.setFillStyle(0xffffff, 0.12);
          t.setText('— libre —').setColor('#5a6b85');
        }
      });
      const host = this.source.isHost;
      startBtn.setVisible(host);
      exitBtn.x = host ? 500 : 400;
      hint.setText(spectator ? 'La partida aún no comienza.'
        : host ? `Presiona ENTER o INICIAR cuando tu equipo esté listo (${s.p.length}/${MAX_PLAYERS})`
          : 'Esperando a que el anfitrión inicie la misión...');
    };
    return c;
  }

  /** Elección de 1 de 3 cartas de mejora tras vencer a un jefe. */
  buildUpgrade() {
    const c = this.panel(470, 700);
    c.add(title(this, 400, 100, 'ELIGE UNA MEJORA', 32, COLORS.gold));
    const sub = label(this, 400, 138, '', 13, COLORS.text, { body: true });
    const status = label(this, 400, 500, '', 13, COLORS.dim, { body: true });
    c.add([sub, status]);
    let cards = null;
    let chosen = -1;

    const buildCards = (options) => {
      cards = options.map((id, i) => {
        const info = CARDS[id];
        const x = 190 + i * 210;
        const card = this.add.container(x, 318);
        const bg = this.add.graphics();
        const drawBg = (hover) => {
          bg.clear();
          bg.fillStyle(hover ? 0x15224d : 0x0e1a3d, 0.97);
          bg.fillRoundedRect(-95, -130, 190, 260, 14);
          bg.fillStyle(0xffffff, 0.04);
          bg.fillRoundedRect(-95, -130, 190, 86, { tl: 14, tr: 14, bl: 0, br: 0 });
          bg.lineStyle(hover ? 2.5 : 1.6, hover ? 0xffd54f : 0x4fc3f7, hover ? 1 : 0.7);
          bg.strokeRoundedRect(-95, -130, 190, 260, 14);
          bg.lineStyle(1, 0x4fc3f7, 0.25);
          bg.lineBetween(-72, 28, 72, 28);
        };
        drawBg(false);
        // chip con la tecla
        const keyChip = this.add.graphics();
        keyChip.fillStyle(0x4fc3f7, 0.16);
        keyChip.fillRoundedRect(-13, -124, 26, 20, 6);
        keyChip.lineStyle(1.2, 0x4fc3f7, 0.7);
        keyChip.strokeRoundedRect(-13, -124, 26, 20, 6);
        const key = this.add.text(0, -114, `${i + 1}`, { fontFamily: FONT, fontSize: '12px', fontStyle: '700', color: COLORS.accentCss }).setOrigin(0.5);
        // emblema con el icono dibujado
        const halo = this.add.image(0, -62, 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setTint(0xffd54f);
        fitSprite(halo, 92);
        const emblem = this.add.graphics();
        emblem.fillStyle(0x081024, 0.9);
        emblem.fillCircle(0, -62, 30);
        emblem.lineStyle(1.6, 0xffd54f, 0.55);
        emblem.strokeCircle(0, -62, 30);
        const icon = this.add.image(0, -62, `ic-${id}`);
        fitSprite(icon, 42);
        const name = this.add.text(0, 6, info.name.toUpperCase(), {
          fontFamily: FONT, fontSize: '14px', fontStyle: '700', color: '#ffffff', align: 'center', wordWrap: { width: 170 },
        }).setOrigin(0.5);
        const desc = this.add.text(0, 56, info.desc, {
          fontFamily: BODY_FONT, fontSize: '14px', color: '#c5d5ea', align: 'center', wordWrap: { width: 160 },
        }).setOrigin(0.5);
        const level = this.add.text(0, 108, info.max > 1 ? `Acumulable hasta ×${info.max}` : 'Mejora única', {
          fontFamily: FONT, fontSize: '10px', color: COLORS.dim,
        }).setOrigin(0.5);
        card.add([bg, keyChip, key, halo, emblem, icon, name, desc, level]);
        card.setSize(190, 260).setInteractive({ useHandCursor: true });
        card.on('pointerover', () => {
          if (chosen >= 0) return;
          drawBg(true);
          this.tweens.add({ targets: card, y: 310, duration: 120, ease: 'Sine.easeOut' });
        });
        card.on('pointerout', () => {
          if (chosen >= 0) return;
          drawBg(false);
          this.tweens.add({ targets: card, y: 318, duration: 120 });
        });
        card.on('pointerup', () => this.pick(i));
        card.setAlpha(0).setY(334);
        this.tweens.add({ targets: card, alpha: 1, y: 318, duration: 220, delay: 60 + i * 70, ease: 'Cubic.easeOut' });
        c.add(card);
        return card;
      });
    };

    c.refresh = (s) => {
      const up = s.up;
      if (!up) return;
      const mine = up.o.find(([id]) => id === this.source.myId);
      const done = up.d.includes(this.source.myId);
      const pending = s.p.filter((p) => !up.d.includes(p[0])).length;
      if (this.gameMode === 'spectate' || !mine) {
        sub.setText('Los pilotos están eligiendo sus mejoras...');
      } else {
        if (!cards) buildCards(mine[1]);
        sub.setText(done ? 'Mejora instalada.' : 'Teclas 1, 2, 3 o haz clic en una carta');
        if (done && chosen < 0) {
          chosen = 1;
          cards.forEach((k) => { k.setAlpha(0.35); k.disableInteractive(); });
        }
      }
      const time = up.t >= 0 ? ` · ${up.t} s` : '';
      status.setText(pending > 0 && (done || this.gameMode === 'spectate') ? `Esperando a ${pending} piloto(s)${time}` : (up.t >= 0 ? `Tiempo restante: ${up.t} s` : ''));
    };
    return c;
  }

  buildResult(s) {
    const c = this.panel(500, 640);
    const me = s.p.find((p) => p[0] === this.source.myId);
    const solo = this.gameMode === 'solo';
    const spectator = this.gameMode === 'spectate';
    const score = solo ? (me ? me[4] : 0) : s.ts;
    const sectors = Math.floor(Math.max(0, s.w - 1) / BOSS_EVERY);

    // Récord personal: cumple el papel de "pantalla de victoria"
    const key = `astro.best.${solo ? 'solo' : 'coop'}`;
    let best = { score: 0, wave: 0 };
    try { best = JSON.parse(localStorage.getItem(key)) || best; } catch { /* sin almacenamiento */ }
    const isRecord = !spectator && score > best.score;
    if (isRecord) {
      try { localStorage.setItem(key, JSON.stringify({ score, wave: s.w })); } catch { /* ignorar */ }
      sfx.record();
    }

    c.add(title(this, 400, 84, isRecord ? '¡NUEVO RÉCORD!' : 'DERROTA', 44,
      isRecord ? COLORS.gold : COLORS.danger, isRecord ? '#ffd54f' : '#ff1744'));
    c.add(label(this, 400, 124, isRecord ? '¡Superaste tu mejor marca! La humanidad te lo agradece.'
      : 'La flota alienígena superó nuestras defensas.', 14, COLORS.text, { body: true }));
    c.add(label(this, 400, 156, solo ? 'PUNTUACIÓN' : 'PUNTUACIÓN DEL EQUIPO', 12, COLORS.dim));
    c.add(title(this, 400, 188, fmt(score), 36));
    c.add(label(this, 400, 222,
      `Oleada ${s.w} · ${sectors} sector(es) liberado(s)${best.score && !isRecord ? ` · Récord: ${fmt(best.score)}` : ''}`,
      14, COLORS.text, { body: true }));

    // Estadísticas por piloto (MVP en cooperativo)
    const rows = s.p.slice().sort((a, b) => b[4] - a[4]);
    const tableG = this.add.graphics();
    tableG.fillStyle(0x0c1736, 0.55);
    tableG.fillRoundedRect(130, 242, 540, 24 + rows.slice(0, 4).length * 20, 8);
    tableG.lineStyle(1, 0x4fc3f7, 0.3);
    tableG.lineBetween(142, 265, 658, 265);
    c.add(tableG);
    const head = 'PILOTO            PUNTOS   DERRIBOS  PRECISIÓN  COMBO';
    c.add(this.add.text(400, 255, head, { fontFamily: 'Consolas, "Courier New", monospace', fontSize: '12px', color: COLORS.dim }).setOrigin(0.5));
    rows.slice(0, 4).forEach((p, i) => {
      const mvp = !solo && i === 0 && rows.length > 1 ? '★ ' : '';
      const line = `${(mvp + p[6]).padEnd(16).slice(0, 16)}  ${String(fmt(p[4])).padStart(9)}  ${String(p[11]).padStart(8)}  ${String(p[12] + '%').padStart(9)}  ${String('×' + p[14]).padStart(5)}`;
      c.add(this.add.text(400, 278 + i * 20, line, {
        fontFamily: 'Consolas, "Courier New", monospace', fontSize: '13px',
        color: mvp ? COLORS.gold : p[0] === this.source.myId ? '#ffffff' : hex(PLAYER_COLORS[p[7]] || 0xffffff),
      }).setOrigin(0.5));
    });

    const status = label(this, 400, 384, '', 13, COLORS.dim, { body: true });
    c.add(status);
    const canSubmit = solo || (this.gameMode === 'coop' && this.source.isHost);
    if (canSubmit && !this.submitted && score > 0) {
      this.submitted = true;
      status.setText('Registrando puntuación...');
      const names = s.p.map((p) => p[6]).join(' & ').slice(0, 40);
      submitScore({ name: solo ? (me?.[6] || getName()) : names, score, wave: s.w, mode: solo ? 'solo' : 'coop', players: s.p.length })
        .then((where) => {
          if (status.active) status.setColor(COLORS.ok).setText(where === 'cloud' ? '¡Puntuación registrada en la tabla de líderes!' : 'Puntuación guardada en este navegador (sin conexión con el servidor).');
        });
    } else if (this.gameMode === 'coop' && !this.source.isHost) {
      status.setText('El anfitrión registra la puntuación del equipo.');
    }

    const y = 430;
    if (solo) {
      c.add(button(this, 400, y, 'JUGAR DE NUEVO', () => this.playAgain(), { width: 260 }));
      c.add(button(this, 270, y + 58, 'LÍDERES', () => this.scene.start('Leaderboard', { mode: 'solo' }), { width: 200, height: 42 }));
      c.add(button(this, 530, y + 58, 'MENÚ', () => this.toMenu(), { width: 200, height: 42 }));
    } else if (this.gameMode === 'coop') {
      const rematch = button(this, 400, y, 'REVANCHA', () => this.playAgain(), { width: 260 });
      const wait = label(this, 400, y, 'Esperando a que el anfitrión inicie la revancha...', 13, COLORS.dim, { body: true });
      c.add([rematch, wait]);
      c.add(button(this, 270, y + 58, 'LÍDERES', () => this.scene.start('Leaderboard', { mode: 'coop' }), { width: 200, height: 42 }));
      c.add(button(this, 530, y + 58, 'SALIR', () => this.toMenu(), { width: 200, height: 42 }));
      c.refresh = () => { rematch.setVisible(this.source.isHost); wait.setVisible(!this.source.isHost); };
    } else {
      c.add(button(this, 400, y + 30, 'VOLVER A PARTIDAS', () => this.toMenu(), { width: 300 }));
    }
    return c;
  }
}
