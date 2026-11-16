// =====================================================================
//  ASTRO DEFENDER – Simulación compartida (navegador + servidor Node.js)
//  La misma lógica corre en el cliente (modo individual) y en el servidor
//  autoritativo (modo cooperativo). El renderizador solo consume los
//  "snapshots" que produce snapshot().
//
//  Oleadas infinitas: la partida termina solo cuando caen todos los pilotos.
//  Cada 5 oleadas aparece un jefe; al vencerlo se eligen cartas de mejora.
// =====================================================================

export const WORLD_W = 800;
export const WORLD_H = 600;
export const MAX_PLAYERS = 4;
export const STEP = 1 / 60;
export const BOSS_EVERY = 5;
export const CRITICAL_WAVE = 20;
export const PLAYER_COLORS = [0x4fc3f7, 0xffb74d, 0x81c784, 0xf06292];

export const PLAYER = {
  radius: 16,
  speed: 320,
  fireCd: 0.22,
  bulletSpeed: 650,
  lives: 3,
  maxLives: 5,
  invuln: 2.0,
  minY: WORLD_H * 0.35,
  maxBombs: 5,
  startBombs: 2,
};

export const ENEMY = { BASIC: 0, BOSS: 1, KAMIKAZE: 2, SHOOTER: 3, TANK: 4 };
const ENEMY_RADIUS = [20, 62, 17, 21, 30];
const ENEMY_POINTS = [100, 5000, 150, 200, 400];
/** Oleada a partir de la cual aparece cada tipo (y el escuadrón en V). */
export const UNLOCK = { kamikaze: 4, shooter: 6, tank: 8, squadron: 9 };

export const POWER = { WEAPON: 0, TRIPLE: 1, RAPID: 2, SHIELD: 3, LIFE: 4, BOMB: 5 };
const POWER_WEIGHTS = [25, 18, 18, 15, 10, 14];

export const AST = { radius: [14, 24, 36], hp: [1, 2, 4], points: [25, 50, 100] };

/** Cartas de mejora que se eligen tras vencer a un jefe. */
export const CARDS = {
  spd: { name: 'Propulsores', desc: '+12% de velocidad', max: 3 },
  rof: { name: 'Cadencia', desc: '+15% de velocidad de disparo', max: 4 },
  dmg: { name: 'Cañón pesado', desc: '+35% de daño', max: 4 },
  prc: { name: 'Perforantes', desc: 'Las balas atraviesan un enemigo más', max: 2 },
  hp: { name: 'Blindaje', desc: '+1 vida y +1 vida máxima', max: 3 },
  bmb: { name: 'Arsenal', desc: '+2 bombas', max: 5 },
  shd: { name: 'Escudo regenerativo', desc: 'Escudo nuevo al iniciar cada oleada', max: 1 },
  mag: { name: 'Imán', desc: 'Atrae los poderes hacia tu nave', max: 1 },
  cmb: { name: 'Concentración', desc: 'El combo dura 1.5 s más', max: 2 },
};

// Eventos que el renderizador convierte en efectos/sonidos: [tipo, x, y, a, b]
export const EV = {
  SHOT: 'shot',       // a: 0 jugador / 1 enemigo
  BOOM: 'boom',       // a: tamaño 0 chico, 1 mediano, 2 jefe
  HIT: 'hit',         // a: id de la entidad golpeada
  PHIT: 'phit',       // a: id del jugador
  PDEAD: 'pdead',     // a: id del jugador
  SHIELD: 'shield',   // escudo roto; a: id del jugador
  WAVE: 'wave',       // a: número de oleada
  CLEAR: 'clear',     // a: número de oleada
  WARN: 'warn',       // se acerca un jefe; a: número de jefe
  SECTOR: 'sector',   // jefe vencido; a: número de jefe
  CRITICAL: 'crit',   // entrada a la zona crítica
  POWER: 'power',     // poder recogido; a: jugador, b: tipo
  LEVEL: 'lvl',       // sube el nivel de arma; a: jugador, b: nivel
  PTS: 'pts',         // puntos flotantes; a: puntos
  COMBO: 'combo',     // a: jugador, b: multiplicador
  BOMB: 'bomb',       // a: jugador
  LASER: 'laser',     // aviso de láser del jefe
  UPGRADE: 'upg',     // empieza la elección de cartas
  CARD: 'card',       // a: jugador
  REVIVE: 'revive',   // a: jugador
  END: 'end',         // a: 'gameover'
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const hit = (a, ar, b, br) => {
  const dx = a.x - b.x, dy = a.y - b.y, r = ar + br;
  return dx * dx + dy * dy <= r * r;
};
const weighted = (weights) => {
  let r = Math.random() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
};

/** Multiplicador de combo: +1 cada 4 derribos encadenados, máximo ×5. */
export const comboMult = (c) => Math.min(5, 1 + Math.floor(Math.max(0, c - 1) / 4));

/**
 * Curva de dificultad de la oleada n. Crece rápido al principio y se
 * estabiliza (logarítmica) para que las oleadas altas sigan siendo jugables.
 */
export function difficulty(n, players = 1) {
  const ln = Math.log(Math.max(1, n));
  const critical = n >= CRITICAL_WAVE;
  return {
    count: Math.min(45 + 5 * (players - 1), Math.round((6 + 3 * n) * (1 + 0.4 * (players - 1)))),
    interval: Math.max(0.3, 1.3 - 0.35 * ln),
    speed: 60 + 32 * ln,
    fireMul: (1.3 / (1 + 0.25 * Math.sqrt(n - 1))) * (critical ? 0.85 : 1),
    bulletSpeed: 200 + 28 * ln,
    hp: Math.round((1 + Math.floor(n / 6)) * (1 + 0.25 * (players - 1))),
    asteroidEvery: Math.max(0.8, 5.5 / (1 + 0.08 * n)) * (critical ? 0.6 : 1),
    scoreMul: (1 + 0.1 * (n - 1)) * (critical ? 2 : 1),
  };
}

export const isBossWave = (n) => n > 0 && n % BOSS_EVERY === 0;

/** Movimiento del jugador; exportado para la predicción del cliente. */
export function applyMovement(p, input, dt) {
  let dx = (input.r ? 1 : 0) - (input.l ? 1 : 0);
  let dy = (input.d ? 1 : 0) - (input.u ? 1 : 0);
  if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
  const sp = PLAYER.speed * (p.speedMul || 1);
  p.x = clamp(p.x + dx * sp * dt, 20, WORLD_W - 20);
  p.y = clamp(p.y + dy * sp * dt, PLAYER.minY, WORLD_H - 24);
}

// Patrones de disparo por nivel de arma: [desplazamiento x, velocidad x]
const WEAPON_PATTERNS = [
  null,
  [[0, 0]],
  [[-8, 0], [8, 0]],
  [[-8, 0], [8, 0], [-10, -110], [10, 110]],
  [[-12, 0], [0, 0], [12, 0], [-10, -130], [10, 130]],
];

export class Simulation {
  constructor({ mode = 'solo' } = {}) {
    this.mode = mode;
    this.players = new Map();
    this.events = [];
    this.nextId = 1;
    this.resetWorld();
    this.state = 'lobby';
  }

  // ------------------------------------------------------------ jugadores
  newPlayerStats(p) {
    Object.assign(p, {
      lives: PLAYER.lives, maxLives: PLAYER.maxLives, score: 0, alive: true,
      inv: 0, cd: 0, weapon: 1, bombs: PLAYER.startBombs,
      triple: 0, rapid: 0, shield: false,
      speedMul: 1, rofMul: 1, dmgMul: 1, pierce: 0,
      regenShield: false, magnet: false, comboBonus: 0,
      combo: 0, comboT: 0, maxCombo: 0, kills: 0, shots: 0, hits: 0,
      cards: {}, options: null, picked: false,
    });
  }

  addPlayer(id, name = 'Piloto') {
    if (this.players.size >= MAX_PLAYERS || this.players.has(id)) return false;
    const used = new Set([...this.players.values()].map((p) => p.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    const p = { id, slot, name: String(name).slice(0, 16) || 'Piloto', x: 0, y: 0,
      input: { u: false, d: false, l: false, r: false, f: false } };
    this.newPlayerStats(p);
    this.placePlayer(p);
    if (this.state === 'playing') {
      p.inv = PLAYER.invuln;
      if (this.phase === 'upgrade') { p.options = this.drawCards(p); }
    }
    this.players.set(id, p);
    return true;
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.state === 'playing') {
      if (this.phase === 'upgrade') this.checkUpgradeDone();
      this.checkGameOver();
    }
  }

  setInput(id, input) {
    const p = this.players.get(id);
    if (!p || !input) return;
    p.input.u = !!input.u; p.input.d = !!input.d;
    p.input.l = !!input.l; p.input.r = !!input.r;
    p.input.f = !!input.f;
  }

  placePlayer(p) {
    p.x = this.mode === 'solo' ? WORLD_W / 2 : (WORLD_W / (MAX_PLAYERS + 1)) * (p.slot + 1);
    p.y = WORLD_H - 60;
  }

  anyAlive() {
    for (const p of this.players.values()) if (p.alive) return true;
    return false;
  }

  // ------------------------------------------------------------ ciclo
  resetWorld() {
    this.time = 0;
    this.wave = 0;
    this.phase = 'fight'; // fight | break | upgrade
    this.toSpawn = 0;
    this.spawnTimer = 0;
    this.breakTimer = 0;
    this.bossTimer = 0;
    this.upTimer = 0;
    this.asteroidTimer = 3;
    this.enemies = [];
    this.asteroids = [];
    this.bullets = [];
    this.powerups = [];
    this.boss = null;
    this.diff = difficulty(1);
  }

  start() {
    if (this.state !== 'lobby' || this.players.size === 0) return false;
    this.resetWorld();
    for (const p of this.players.values()) {
      this.newPlayerStats(p);
      p.inv = 1;
      this.placePlayer(p);
    }
    this.state = 'playing';
    this.startWave(1);
    return true;
  }

  /** Vuelve al lobby conservando a los jugadores conectados. */
  restart() {
    this.resetWorld();
    this.state = 'lobby';
    for (const p of this.players.values()) {
      this.newPlayerStats(p);
      this.placePlayer(p);
    }
  }

  get teamScore() {
    let s = 0;
    for (const p of this.players.values()) s += p.score;
    return s;
  }

  emit(type, x = 0, y = 0, a = 0, b = 0) {
    this.events.push([type, Math.round(x), Math.round(y), a, b]);
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  startWave(n) {
    this.wave = n;
    this.phase = 'fight';
    this.diff = difficulty(n, Math.max(1, this.players.size));
    const boss = isBossWave(n);
    this.toSpawn = boss ? 2 + (n / BOSS_EVERY) * 2 : this.diff.count;
    this.spawnTimer = boss ? 4 : 1.5;
    this.breakTimer = 0;
    this.bossTimer = boss ? 2.5 : 0;

    // Pilotos caídos reaparecen si alguien del equipo sigue vivo
    const alive = this.anyAlive();
    for (const p of this.players.values()) {
      if (!p.alive && alive) {
        p.alive = true; p.lives = 1; p.inv = 2.5; p.weapon = 1;
        this.placePlayer(p);
        this.emit(EV.REVIVE, p.x, p.y, p.id);
      }
      if (p.alive && p.regenShield) p.shield = true;
    }
    this.emit(EV.WAVE, 0, 0, n);
    if (n === CRITICAL_WAVE) this.emit(EV.CRITICAL);
    if (boss) this.emit(EV.WARN, 0, 0, n / BOSS_EVERY);
  }

  // ------------------------------------------------------------ spawns
  id() { return this.nextId++; }

  spawnUnit() {
    const n = this.wave;
    const w = [10, 0, 0, 0, 0]; // básico, kamikaze, tirador, tanque, escuadrón
    if (n >= UNLOCK.kamikaze) w[1] = Math.min(6, 2 + 0.3 * n);
    if (n >= UNLOCK.shooter) w[2] = Math.min(5, 1.5 + 0.2 * n);
    if (n >= UNLOCK.tank) w[3] = Math.min(3, 1 + 0.1 * n);
    if (n >= UNLOCK.squadron && this.toSpawn >= 5) w[4] = Math.min(3, 1 + 0.1 * n);
    switch (weighted(w)) {
      case 1: this.spawnKamikaze(); return 1;
      case 2: this.spawnShooter(); return 1;
      case 3: this.spawnTank(); return 1;
      case 4: this.spawnSquadron(); return 5;
      default: this.spawnBasic(); return 1;
    }
  }

  spawnBasic(x, y = -30, shared) {
    const baseX = x ?? rand(60, WORLD_W - 60);
    const d = this.diff;
    this.enemies.push({
      id: this.id(), type: ENEMY.BASIC, x: baseX, y, baseX, st: 0,
      vy: shared?.vy ?? d.speed + rand(-10, 10),
      amp: shared?.amp ?? rand(20, 90), freq: shared?.freq ?? rand(1, 2.5),
      phase: shared?.phase ?? rand(0, Math.PI * 2),
      t: 0, hp: d.hp, fire: rand(1.2, 3.5) * d.fireMul,
    });
  }

  spawnSquadron() {
    const cx = rand(160, WORLD_W - 160);
    const shared = { vy: this.diff.speed * 0.9, amp: rand(30, 70), freq: rand(0.8, 1.4), phase: rand(0, 6) };
    for (let i = 0; i < 5; i++) this.spawnBasic(cx + (i - 2) * 42, -30 - Math.abs(i - 2) * 30, shared);
  }

  spawnKamikaze(x, y, aiming = false) {
    this.enemies.push({
      id: this.id(), type: ENEMY.KAMIKAZE, x: x ?? rand(50, WORLD_W - 50), y: y ?? -30,
      vx: 0, vy: this.diff.speed * 1.3, targetY: rand(70, 200),
      st: aiming ? 1 : 0, timer: aiming ? 0.7 : 0, hp: 1, t: 0,
    });
  }

  spawnShooter() {
    const d = this.diff;
    this.enemies.push({
      id: this.id(), type: ENEMY.SHOOTER, x: rand(80, WORLD_W - 80), y: -30, baseX: 0,
      vy: d.speed, targetY: rand(70, 170), st: 0, timer: 10, t: 0,
      hp: 2 + Math.floor(this.wave / 5), fire: 1.5,
    });
  }

  spawnTank() {
    const d = this.diff;
    const baseX = rand(90, WORLD_W - 90);
    this.enemies.push({
      id: this.id(), type: ENEMY.TANK, x: baseX, y: -40, baseX, st: 0,
      vy: 35 + 3 * Math.log(this.wave), t: 0, phase: rand(0, 6),
      hp: 6 + Math.floor(this.wave / 3), fire: 2,
    });
  }

  spawnBoss() {
    const k = Math.max(1, Math.round(this.wave / BOSS_EVERY));
    const n = Math.max(1, this.players.size);
    const hp = Math.round(35 * Math.sqrt(n) * (1 + 0.75 * (k - 1)) + 20 * (n - 1));
    this.boss = {
      id: this.id(), type: ENEMY.BOSS, x: WORLD_W / 2, y: -90, vx: 80 + 20 * Math.min(5, k), st: 0,
      hp, maxHp: hp, k, t: 0, fire: 2.5,
      patterns: k >= 4 ? [0, 1, 2] : [(k - 1) % 3], pi: 0, patternT: 7,
      laser: 0, laserT: 0, laserCd: 1.5, summonT: 3,
    };
    this.enemies.push(this.boss);
  }

  spawnAsteroid(size = 2, x, y, vx, vy) {
    if (this.asteroids.length >= 16) return;
    this.asteroids.push({
      id: this.id(), size,
      x: x ?? rand(40, WORLD_W - 40), y: y ?? -40,
      vx: vx ?? rand(-40, 40), vy: vy ?? rand(50, 110) + this.wave * 3,
      rot: rand(0, Math.PI * 2), vr: rand(-1.5, 1.5),
      hp: AST.hp[size],
    });
  }

  dropPower(x, y, kind) {
    if (this.powerups.length >= 10) return;
    this.powerups.push({ id: this.id(), kind: kind ?? weighted(POWER_WEIGHTS), x, y });
  }

  fireEnemyBullet(x, y, vx, vy) {
    if (this.bullets.length >= 300) return;
    this.bullets.push({ id: this.id(), kind: 1, x, y, vx, vy, owner: 0 });
  }

  fireAimed(e, speed, spread = 0, count = 1) {
    const t = this.nearestPlayer(e.x, e.y);
    const base = t ? Math.atan2(t.y - e.y, t.x - e.x) : Math.PI / 2;
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * spread;
      this.fireEnemyBullet(e.x, e.y + 16, Math.cos(a) * speed, Math.sin(a) * speed);
    }
    this.emit(EV.SHOT, e.x, e.y, 1);
  }

  nearestPlayer(x, y) {
    let best = null, bd = Infinity;
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ------------------------------------------------------------ acciones
  firePlayer(p) {
    const pattern = WEAPON_PATTERNS[p.weapon].slice();
    if (p.triple > 0) pattern.push([-6, -230], [6, 230]);
    const kind = p.weapon >= 3 ? 2 : 0;
    for (const [ox, vx] of pattern) {
      if (this.bullets.length >= 300) break;
      this.bullets.push({
        id: this.id(), kind, x: p.x + ox, y: p.y - 22, vx, vy: -PLAYER.bulletSpeed,
        owner: p.id, dmg: p.dmgMul, left: 1 + p.pierce, seen: p.pierce ? new Set() : null,
      });
      p.shots++;
    }
    p.cd = (PLAYER.fireCd / p.rofMul) * (p.rapid > 0 ? 0.5 : 1);
    this.emit(EV.SHOT, p.x, p.y, 0);
  }

  useBomb(id) {
    const p = this.players.get(id);
    if (!p || !p.alive || p.bombs <= 0 || this.state !== 'playing' || this.phase === 'upgrade') return false;
    p.bombs--;
    p.inv = Math.max(p.inv, 1);
    this.bullets = this.bullets.filter((b) => b.kind !== 1);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dmg = e.type === ENEMY.BOSS ? e.maxHp * 0.08 : 6;
      this.damageEnemy(e, dmg, p.id);
    }
    for (const a of this.asteroids) {
      if (a.dead) continue;
      a.dead = true;
      this.emit(EV.BOOM, a.x, a.y, a.size === 2 ? 1 : 0);
      this.award(p.id, AST.points[a.size], a.x, a.y);
    }
    this.emit(EV.BOMB, p.x, p.y, p.id);
    return true;
  }

  // ------------------------------------------------------------ cartas
  drawCards(p) {
    const pool = Object.keys(CARDS).filter((c) => (p.cards[c] || 0) < CARDS[c].max);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  startUpgrade() {
    this.phase = 'upgrade';
    this.upTimer = this.mode === 'coop' ? 20 : Infinity;
    this.bullets = [];
    this.asteroids = [];
    for (const p of this.players.values()) { p.options = this.drawCards(p); p.picked = false; }
    this.emit(EV.UPGRADE);
  }

  applyCard(p, card) {
    p.cards[card] = (p.cards[card] || 0) + 1;
    switch (card) {
      case 'spd': p.speedMul += 0.12; break;
      case 'rof': p.rofMul += 0.15; break;
      case 'dmg': p.dmgMul += 0.35; break;
      case 'prc': p.pierce++; break;
      case 'hp': p.maxLives++; p.lives = Math.min(p.maxLives, p.lives + 1); break;
      case 'bmb': p.bombs = Math.min(PLAYER.maxBombs, p.bombs + 2); break;
      case 'shd': p.regenShield = true; p.shield = true; break;
      case 'mag': p.magnet = true; break;
      case 'cmb': p.comboBonus += 1.5; break;
    }
  }

  pickUpgrade(id, index) {
    const p = this.players.get(id);
    if (!p || this.phase !== 'upgrade' || p.picked || !p.options) return false;
    const card = p.options[index];
    if (!card) return false;
    this.applyCard(p, card);
    p.picked = true;
    this.emit(EV.CARD, p.x, p.y, p.id);
    this.checkUpgradeDone();
    return true;
  }

  checkUpgradeDone() {
    for (const p of this.players.values()) if (!p.picked && p.options?.length) return;
    this.phase = 'break';
    this.breakTimer = 2;
    for (const p of this.players.values()) p.options = null;
  }

  // ------------------------------------------------------------ paso fijo
  step(dt = STEP) {
    if (this.state !== 'playing') return;
    this.time += dt;

    // Jugadores
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      applyMovement(p, p.input, dt);
      p.cd -= dt;
      p.inv = Math.max(0, p.inv - dt);
      p.triple = Math.max(0, p.triple - dt);
      p.rapid = Math.max(0, p.rapid - dt);
      if (p.comboT > 0) { p.comboT -= dt; if (p.comboT <= 0) p.combo = 0; }
      if (p.input.f && p.cd <= 0 && this.phase !== 'upgrade') this.firePlayer(p);
    }

    if (this.phase === 'upgrade') {
      this.upTimer -= dt;
      if (this.upTimer <= 0) {
        for (const p of this.players.values()) {
          if (!p.picked && p.options?.length) this.pickUpgrade(p.id, Math.floor(Math.random() * p.options.length));
        }
        this.checkUpgradeDone();
      }
      return;
    }

    this.updateWaves(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateAsteroids(dt);
    this.updatePowerups(dt);
    this.collide();

    this.bullets = this.bullets.filter((o) => !o.dead);
    this.enemies = this.enemies.filter((o) => !o.dead);
    this.asteroids = this.asteroids.filter((o) => !o.dead);
    this.powerups = this.powerups.filter((o) => !o.dead);
    if (this.boss && this.boss.dead) this.boss = null;

    this.checkGameOver();
  }

  updateWaves(dt) {
    if (this.phase === 'break') {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) this.startWave(this.wave + 1);
      return;
    }
    if (this.bossTimer > 0) {
      this.bossTimer -= dt;
      if (this.bossTimer <= 0) this.spawnBoss();
    }
    if (this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.toSpawn -= this.spawnUnit();
        this.spawnTimer = isBossWave(this.wave) ? 2.5 : this.diff.interval;
        if (Math.random() < 0.1 + this.wave * 0.01) this.spawnAsteroid(2);
      }
    } else if (this.enemies.length === 0 && this.bossTimer <= 0) {
      this.emit(EV.CLEAR, 0, 0, this.wave);
      if (isBossWave(this.wave)) this.startUpgrade();
      else { this.phase = 'break'; this.breakTimer = 3; }
    }

    this.asteroidTimer -= dt;
    if (this.asteroidTimer <= 0) {
      this.asteroidTimer = this.diff.asteroidEvery * rand(0.7, 1.3);
      this.spawnAsteroid(Math.random() < 0.5 ? 2 : 1);
    }
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -20 || b.y > WORLD_H + 20 || b.x < -20 || b.x > WORLD_W + 20) b.dead = true;
    }
  }

  updateEnemies(dt) {
    const d = this.diff;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += dt;
      switch (e.type) {
        case ENEMY.BOSS: this.updateBoss(e, dt); break;

        case ENEMY.KAMIKAZE:
          if (e.st === 0) {
            e.y += e.vy * dt;
            if (e.y >= e.targetY) { e.st = 1; e.timer = 0.8; }
          } else if (e.st === 1) {
            e.timer -= dt;
            if (e.timer <= 0) {
              const t = this.nearestPlayer(e.x, e.y);
              const a = t ? Math.atan2(t.y - e.y, t.x - e.x) : Math.PI / 2;
              const sp = 320 + 25 * Math.log(this.wave);
              e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp; e.st = 2;
            }
          } else {
            e.x += e.vx * dt; e.y += e.vy * dt;
            if (e.y > WORLD_H + 40 || e.x < -40 || e.x > WORLD_W + 40 || e.y < -60) e.dead = true;
          }
          break;

        case ENEMY.SHOOTER:
          if (e.st === 0) {
            e.y += e.vy * dt;
            if (e.y >= e.targetY) { e.st = 1; e.baseX = e.x; }
          } else if (e.st === 1) {
            e.x = clamp(e.baseX + Math.sin(e.t * 0.9) * 90, 30, WORLD_W - 30);
            e.timer -= dt;
            e.fire -= dt;
            if (e.fire <= 0) {
              e.fire = 2.2 * d.fireMul;
              this.fireAimed(e, d.bulletSpeed * 0.9, 0.25, 3 + Math.min(2, Math.floor(this.wave / 10)));
            }
            if (e.timer <= 0) e.st = 2;
          } else {
            e.y += 140 * dt;
            if (e.y > WORLD_H + 40) e.dead = true;
          }
          break;

        case ENEMY.TANK:
          e.y += e.vy * dt;
          e.x = clamp(e.baseX + Math.sin(e.t * 0.7 + e.phase) * 30, 30, WORLD_W - 30);
          e.fire -= dt;
          if (e.fire <= 0 && e.y > 0) {
            e.fire = 2.5 * d.fireMul;
            this.fireAimed(e, d.bulletSpeed, 0.12, 2);
          }
          if (e.y > WORLD_H + 50) e.dead = true;
          break;

        default: // básico (también en escuadrón)
          e.y += e.vy * dt;
          e.x = clamp(e.baseX + Math.sin(e.t * e.freq + e.phase) * e.amp, 20, WORLD_W - 20);
          e.fire -= dt;
          if (e.fire <= 0 && e.y > 0 && e.y < WORLD_H * 0.7) {
            e.fire = rand(1.5, 3.5) * d.fireMul;
            // Oleadas 1-3: disparo recto hacia abajo; después apuntan al jugador
            if (this.wave < 4) {
              this.fireEnemyBullet(e.x, e.y + 16, 0, d.bulletSpeed);
              this.emit(EV.SHOT, e.x, e.y, 1);
            } else this.fireAimed(e, d.bulletSpeed);
          }
          if (e.y > WORLD_H + 40) e.dead = true;
      }
    }
  }

  updateBoss(e, dt) {
    e.y = Math.min(110, e.y + 60 * dt);
    const slow = e.laser > 0 ? 0.35 : 1;
    e.x += e.vx * slow * dt;
    if (e.x < 120) { e.x = 120; e.vx = Math.abs(e.vx); }
    if (e.x > WORLD_W - 120) { e.x = WORLD_W - 120; e.vx = -Math.abs(e.vx); }
    if (e.y < 100) return;

    const rate = e.hp < e.maxHp / 2 ? 0.7 : 1; // furia con menos de la mitad de vida
    e.patternT -= dt;
    if (e.patternT <= 0 && e.laser === 0 && e.patterns.length > 1) {
      e.pi = (e.pi + 1) % e.patterns.length;
      e.patternT = 7;
    }
    const pattern = e.patterns[e.pi];

    if (pattern === 0) { // ráfaga en abanico
      e.fire -= dt;
      if (e.fire <= 0) {
        e.fire = (2.2 - 0.15 * Math.min(4, e.k - 1)) * rate;
        const count = 4 + Math.min(7, e.k);
        const sp = 190 + 15 * Math.min(6, e.k);
        for (let i = 0; i < count; i++) {
          const a = Math.PI / 2 + (i - (count - 1) / 2) * 0.2 + Math.sin(e.t) * 0.15;
          this.fireEnemyBullet(e.x, e.y + 40, Math.cos(a) * sp, Math.sin(a) * sp);
        }
        this.emit(EV.SHOT, e.x, e.y, 1);
      }
    } else if (pattern === 1) { // láser que barre la pantalla
      if (e.laser === 0) {
        e.laserCd -= dt;
        if (e.laserCd <= 0) { e.laser = 1; e.laserT = 1.0; this.emit(EV.LASER, e.x, e.y); }
      } else if (e.laser === 1) {
        e.laserT -= dt;
        if (e.laserT <= 0) { e.laser = 2; e.laserT = 1.6; }
      } else {
        e.laserT -= dt;
        for (const p of this.players.values()) {
          if (p.alive && p.inv <= 0 && Math.abs(p.x - e.x) < 18 && p.y > e.y) this.damagePlayer(p);
        }
        if (e.laserT <= 0) { e.laser = 0; e.laserCd = 1.5 * rate; }
      }
    } else { // invocador de escoltas
      e.summonT -= dt;
      if (e.summonT <= 0) {
        e.summonT = 4 * rate;
        for (const ox of [-70, 0, 70]) this.spawnKamikaze(e.x + ox, e.y + 30, true);
      }
      e.fire -= dt;
      if (e.fire <= 0) { e.fire = 2.4 * rate; this.fireAimed(e, 230, 0.2, 3); }
    }
    if (pattern !== 1) e.laser = 0;
  }

  updateAsteroids(dt) {
    for (const a of this.asteroids) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.vr * dt;
      if (a.y > WORLD_H + 60 || a.x < -80 || a.x > WORLD_W + 80) a.dead = true;
    }
  }

  updatePowerups(dt) {
    for (const u of this.powerups) {
      let pulled = false;
      for (const p of this.players.values()) {
        if (!p.alive || !p.magnet) continue;
        const dx = p.x - u.x, dy = p.y - u.y, dist = Math.hypot(dx, dy);
        if (dist < 170 && dist > 1) { u.x += (dx / dist) * 320 * dt; u.y += (dy / dist) * 320 * dt; pulled = true; break; }
      }
      if (!pulled) u.y += 90 * dt;
      if (u.y > WORLD_H + 20) u.dead = true;
    }
  }

  // ------------------------------------------------------------ puntos y daño
  award(ownerId, base, x, y) {
    const p = this.players.get(ownerId);
    if (!p) return;
    const prevMult = comboMult(p.combo);
    p.combo = p.comboT > 0 ? p.combo + 1 : 1;
    p.comboT = 2 + p.comboBonus;
    p.maxCombo = Math.max(p.maxCombo, p.combo);
    p.kills++;
    const mult = comboMult(p.combo);
    if (mult > prevMult) this.emit(EV.COMBO, p.x, p.y, p.id, mult);
    const pts = Math.round(base * this.diff.scoreMul * mult);
    p.score += pts;
    this.emit(EV.PTS, x, y, pts);
  }

  damageEnemy(e, dmg, ownerId) {
    e.hp -= dmg;
    this.emit(EV.HIT, e.x, e.y, e.id);
    if (e.hp > 0) return;
    e.dead = true;
    this.award(ownerId, ENEMY_POINTS[e.type], e.x, e.y);
    if (e.type === ENEMY.BOSS) {
      this.emit(EV.BOOM, e.x, e.y, 2);
      this.emit(EV.SECTOR, e.x, e.y, e.k);
      for (const ox of [-50, 0, 50]) this.dropPower(e.x + ox, e.y);
      // Los enemigos restantes huyen al caer la nave nodriza
      for (const o of this.enemies) if (!o.dead && o !== e) { o.dead = true; this.emit(EV.BOOM, o.x, o.y, 1); }
      this.bullets = this.bullets.filter((b) => b.kind !== 1);
      this.toSpawn = 0;
    } else {
      this.emit(EV.BOOM, e.x, e.y, e.type === ENEMY.TANK ? 2 : 1);
      const chance = e.type === ENEMY.TANK ? 0.35 : 0.1;
      if (Math.random() < chance) this.dropPower(e.x, e.y);
    }
  }

  damageAsteroid(a, dmg, ownerId) {
    a.hp -= dmg;
    this.emit(EV.HIT, a.x, a.y, a.id);
    if (a.hp > 0) return;
    a.dead = true;
    this.emit(EV.BOOM, a.x, a.y, a.size === 2 ? 1 : 0);
    this.award(ownerId, AST.points[a.size], a.x, a.y);
    if (a.size > 0) {
      const s = a.size - 1;
      this.spawnAsteroid(s, a.x - 10, a.y, a.vx - 60, a.vy * 0.9);
      this.spawnAsteroid(s, a.x + 10, a.y, a.vx + 60, a.vy * 0.9);
    }
  }

  bulletHits(b, target) {
    if (b.seen) {
      if (b.seen.has(target.id)) return false;
      b.seen.add(target.id);
    }
    const owner = this.players.get(b.owner);
    if (owner) owner.hits++;
    b.left--;
    if (b.left <= 0) b.dead = true;
    return true;
  }

  collide() {
    // Balas de jugadores contra enemigos y asteroides
    for (const b of this.bullets) {
      if (b.dead || b.kind === 1) continue;
      for (const e of this.enemies) {
        if (e.dead || b.dead) continue;
        if (hit(b, 4, e, ENEMY_RADIUS[e.type]) && this.bulletHits(b, e)) this.damageEnemy(e, b.dmg, b.owner);
      }
      for (const a of this.asteroids) {
        if (a.dead || b.dead) continue;
        if (hit(b, 4, a, AST.radius[a.size]) && this.bulletHits(b, a)) this.damageAsteroid(a, b.dmg, b.owner);
      }
    }

    // Jugadores: poderes y daño
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const u of this.powerups) {
        if (!u.dead && hit(p, PLAYER.radius + 4, u, 12)) { u.dead = true; this.applyPower(p, u); }
      }
      if (p.inv > 0) continue;
      let damaged = false;
      for (const b of this.bullets) {
        if (!b.dead && b.kind === 1 && hit(p, PLAYER.radius - 4, b, 4)) { b.dead = true; damaged = true; break; }
      }
      if (!damaged) {
        for (const e of this.enemies) {
          if (!e.dead && hit(p, PLAYER.radius, e, ENEMY_RADIUS[e.type])) {
            if (e.type !== ENEMY.BOSS && e.type !== ENEMY.TANK) { e.dead = true; this.emit(EV.BOOM, e.x, e.y, 1); }
            damaged = true; break;
          }
        }
      }
      if (!damaged) {
        for (const a of this.asteroids) {
          if (!a.dead && hit(p, PLAYER.radius - 2, a, AST.radius[a.size] - 6)) {
            a.dead = true; this.emit(EV.BOOM, a.x, a.y, a.size === 2 ? 1 : 0);
            damaged = true; break;
          }
        }
      }
      if (damaged) this.damagePlayer(p);
    }
  }

  applyPower(p, u) {
    switch (u.kind) {
      case POWER.WEAPON:
        if (p.weapon < 4) { p.weapon++; this.emit(EV.LEVEL, p.x, p.y, p.id, p.weapon); }
        else { p.score += 500; this.emit(EV.PTS, p.x, p.y, 500); }
        break;
      case POWER.TRIPLE: p.triple = 8; break;
      case POWER.RAPID: p.rapid = 8; break;
      case POWER.SHIELD: p.shield = true; break;
      case POWER.LIFE: p.lives = Math.min(p.maxLives, p.lives + 1); break;
      case POWER.BOMB: p.bombs = Math.min(PLAYER.maxBombs, p.bombs + 1); break;
    }
    this.emit(EV.POWER, u.x, u.y, p.id, u.kind);
  }

  damagePlayer(p) {
    if (p.shield) {
      p.shield = false;
      p.inv = 1;
      this.emit(EV.SHIELD, p.x, p.y, p.id);
      return;
    }
    p.lives--;
    p.combo = 0; p.comboT = 0;
    p.triple = 0; p.rapid = 0;
    p.weapon = Math.max(1, p.weapon - 1);
    if (p.lives <= 0) {
      p.alive = false;
      this.emit(EV.PDEAD, p.x, p.y, p.id);
      this.emit(EV.BOOM, p.x, p.y, 1);
    } else {
      p.inv = PLAYER.invuln;
      this.emit(EV.PHIT, p.x, p.y, p.id);
    }
  }

  checkGameOver() {
    if (this.state !== 'playing' || this.players.size === 0) return;
    if (this.anyAlive()) return;
    this.state = 'gameover';
    this.phase = 'fight';
    this.emit(EV.END, 0, 0, 'gameover');
  }

  // ------------------------------------------------------------ snapshot
  /**
   * Formato compacto (también se envía por WebSocket):
   *  p: [id, x, y, vidas, puntos, flags, nombre, slot, nivelArma, bombas,
   *      multCombo, derribos, precisión%, velocidad%, comboMáx, vidasMáx]
   *     flags: 1 vivo, 2 invulnerable, 4 triple, 8 rápido, 16 escudo
   *  e: [id, tipo, x, y, estado]       a: [id, tamaño, x, y, rotación]
   *  b: [id, tipo(0 jugador,1 enemigo,2 jugador grande), x, y]
   *  u: [id, tipo, x, y]
   *  up: elección de cartas { t: segundos, o: [[idJugador, [cartas]]], d: [ids que ya eligieron] }
   */
  snapshot() {
    const r = Math.round;
    const p = [];
    for (const pl of this.players.values()) {
      const flags = (pl.alive ? 1 : 0) | (pl.inv > 0 ? 2 : 0) | (pl.triple > 0 ? 4 : 0) |
        (pl.rapid > 0 ? 8 : 0) | (pl.shield ? 16 : 0);
      p.push([pl.id, r(pl.x), r(pl.y), pl.lives, pl.score, flags, pl.name, pl.slot,
        pl.weapon, pl.bombs, comboMult(pl.combo), pl.kills,
        pl.shots ? r((100 * pl.hits) / pl.shots) : 0, r(pl.speedMul * 100), pl.maxCombo, pl.maxLives]);
    }
    let up = null;
    if (this.phase === 'upgrade') {
      up = {
        t: Number.isFinite(this.upTimer) ? Math.ceil(this.upTimer) : -1,
        o: [...this.players.values()].filter((q) => q.options).map((q) => [q.id, q.options]),
        d: [...this.players.values()].filter((q) => q.picked).map((q) => q.id),
      };
    }
    const boss = this.boss;
    return {
      st: this.state,
      ph: this.phase,
      w: this.wave,
      ts: this.teamScore,
      bh: boss ? Math.max(0, Math.ceil(boss.hp)) : 0,
      bm: boss ? boss.maxHp : 0,
      bk: boss ? boss.k : 0,
      bl: boss ? boss.laser : 0,
      crit: this.wave >= CRITICAL_WAVE ? 1 : 0,
      up,
      p,
      e: this.enemies.map((e) => [e.id, e.type, r(e.x), r(e.y), e.st || 0]),
      a: this.asteroids.map((a) => [a.id, a.size, r(a.x), r(a.y), r(a.rot * 100) / 100]),
      b: this.bullets.map((b) => [b.id, b.kind, r(b.x), r(b.y)]),
      u: this.powerups.map((u) => [u.id, u.kind, r(u.x), r(u.y)]),
    };
  }
}
