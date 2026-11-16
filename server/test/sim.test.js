import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Simulation, STEP, EV, PLAYER, POWER, ENEMY, BOSS_EVERY, CARDS,
  difficulty, comboMult, isBossWave,
} from '../../shared/sim.js';

const run = (sim, seconds) => { for (let i = 0; i < seconds / STEP; i++) sim.step(STEP); };
const solo = () => { const s = new Simulation(); s.addPlayer(1, 'Ana'); s.start(); return s; };
const enemyAt = (sim, x, y, extra = {}) => {
  const e = { id: sim.id(), type: ENEMY.BASIC, x, y, baseX: x, vy: 0, amp: 0, freq: 0, phase: 0, t: 0, hp: 1, fire: 99, st: 0, ...extra };
  sim.enemies.push(e);
  return e;
};
/** Avanza oleadas eliminando enemigos al instante (el jugador es invencible). */
function skipTo(sim, wave) {
  for (const p of sim.players.values()) p.inv = 1e9;
  for (let guard = 0; guard < 500000 && sim.wave < wave && sim.state === 'playing'; guard++) {
    for (const e of sim.enemies) e.dead = true;
    sim.boss = null;
    if (sim.phase === 'upgrade') for (const p of sim.players.values()) sim.pickUpgrade(p.id, 0);
    sim.step(STEP);
  }
}

test('inicia la oleada 1 con un jugador', () => {
  const sim = solo();
  assert.equal(sim.state, 'playing');
  assert.equal(sim.wave, 1);
  assert.ok(sim.drainEvents().some((e) => e[0] === EV.WAVE));
});

test('máximo 4 jugadores', () => {
  const sim = new Simulation({ mode: 'coop' });
  for (let i = 1; i <= 4; i++) assert.equal(sim.addPlayer(i, `P${i}`), true);
  assert.equal(sim.addPlayer(5, 'P5'), false);
});

test('oleadas infinitas: pasa de la 10 sin victoria', () => {
  const sim = solo();
  skipTo(sim, 12);
  assert.equal(sim.state, 'playing');
  assert.ok(sim.wave >= 12);
});

test('hay jefe cada 5 oleadas y al vencerlo se eligen cartas', () => {
  assert.ok(isBossWave(5) && isBossWave(10) && !isBossWave(7));
  const sim = solo();
  skipTo(sim, BOSS_EVERY);
  sim.players.get(1).inv = 1e9;
  for (let i = 0; i < 400 && !sim.boss; i++) sim.step(STEP); // aviso de 2.5 s
  assert.ok(sim.boss, 'debe aparecer el jefe');
  const boss = sim.boss;
  sim.damageEnemy(boss, boss.maxHp, 1);
  assert.ok(sim.drainEvents().some((e) => e[0] === EV.SECTOR));
  for (let i = 0; i < 10 && sim.phase !== 'upgrade'; i++) sim.step(STEP);
  assert.equal(sim.phase, 'upgrade');
  const p = sim.players.get(1);
  assert.equal(p.options.length, 3);
  assert.equal(sim.pickUpgrade(1, 0), true);
  assert.equal(sim.phase, 'break');
  assert.equal(p.cards[p.options?.[0] ?? Object.keys(p.cards)[0]], 1);
});

test('los jefes son más resistentes cada vez', () => {
  const hp = (wave) => { const s = solo(); s.wave = wave; s.spawnBoss(); return s.boss.maxHp; };
  assert.ok(hp(10) > hp(5) && hp(15) > hp(10));
});

test('curva de dificultad creciente y acotada', () => {
  let prev = difficulty(1);
  for (let n = 2; n <= 100; n++) {
    const d = difficulty(n);
    assert.ok(d.speed >= prev.speed && d.hp >= prev.hp && d.scoreMul >= prev.scoreMul);
    assert.ok(d.count <= 45 && d.interval >= 0.3 && d.speed < 250);
    prev = d;
  }
  assert.ok(difficulty(20).scoreMul >= 2 * (1 + 0.1 * 19) - 1e-9, 'zona crítica duplica puntos');
  assert.ok(difficulty(5, 4).count > difficulty(5, 1).count, 'escala con jugadores');
});

test('disparar destruye enemigos, suma puntos y combo', () => {
  const sim = solo();
  const p = sim.players.get(1);
  for (let i = 0; i < 3; i++) enemyAt(sim, p.x, p.y - 120 - i * 40);
  sim.setInput(1, { f: true });
  run(sim, 1);
  assert.equal(sim.enemies.filter((e) => e.vy === 0).length, 0);
  assert.ok(p.score >= 300);
  assert.equal(p.kills, 3);
  assert.ok(p.shots >= p.hits && p.hits >= 3);
});

test('multiplicador de combo', () => {
  assert.equal(comboMult(1), 1);
  assert.equal(comboMult(5), 2);
  assert.equal(comboMult(100), 5);
});

test('colisión quita una vida, el arma baja de nivel y el escudo protege', () => {
  const sim = solo();
  const p = sim.players.get(1);
  p.inv = 0; p.weapon = 3; p.shield = true;
  sim.asteroids.push({ id: 500, size: 2, x: p.x, y: p.y, vx: 0, vy: 0, rot: 0, vr: 0, hp: 4 });
  sim.step(STEP);
  assert.equal(p.lives, PLAYER.lives, 'el escudo absorbe el golpe');
  assert.equal(p.shield, false);
  p.inv = 0;
  sim.asteroids.push({ id: 501, size: 2, x: p.x, y: p.y, vx: 0, vy: 0, rot: 0, vr: 0, hp: 4 });
  sim.step(STEP);
  assert.equal(p.lives, PLAYER.lives - 1);
  assert.equal(p.weapon, 2);
});

test('poderes: arma, vida, bomba y disparo triple', () => {
  const sim = solo();
  const p = sim.players.get(1);
  for (const kind of [POWER.WEAPON, POWER.LIFE, POWER.BOMB, POWER.TRIPLE]) {
    sim.powerups.push({ id: sim.id(), kind, x: p.x, y: p.y });
  }
  sim.step(STEP);
  assert.equal(p.weapon, 2);
  assert.equal(p.lives, PLAYER.lives + 1);
  assert.equal(p.bombs, PLAYER.startBombs + 1);
  assert.ok(p.triple > 0);
});

test('la bomba limpia las balas enemigas y daña a todos', () => {
  const sim = solo();
  const p = sim.players.get(1);
  enemyAt(sim, 100, 100);
  sim.fireEnemyBullet(300, 300, 0, 100);
  assert.equal(sim.useBomb(1), true);
  assert.equal(sim.bullets.filter((b) => b.kind === 1).length, 0);
  assert.ok(sim.enemies.every((e) => e.dead));
  assert.equal(p.bombs, PLAYER.startBombs - 1);
});

test('el láser del jefe daña a quien esté debajo', () => {
  const sim = solo();
  const p = sim.players.get(1);
  p.inv = 0;
  sim.wave = 10; sim.spawnBoss();
  Object.assign(sim.boss, { y: 110, x: p.x, vx: 0, patterns: [1], laser: 2, laserT: 1 });
  sim.step(STEP);
  assert.equal(p.lives, PLAYER.lives - 1);
});

test('cooperativo: los caídos reaparecen en la siguiente oleada', () => {
  const sim = new Simulation({ mode: 'coop' });
  sim.addPlayer(1, 'Ana'); sim.addPlayer(2, 'Beto');
  sim.start();
  const beto = sim.players.get(2);
  beto.alive = false; beto.lives = 0;
  sim.players.get(1).inv = 1e9;
  sim.startWave(2);
  assert.equal(beto.alive, true);
  assert.equal(beto.lives, 1);
});

test('game over cuando todos pierden sus vidas', () => {
  const sim = solo();
  const p = sim.players.get(1);
  p.lives = 1; p.inv = 0; p.shield = false;
  enemyAt(sim, p.x, p.y);
  sim.step(STEP);
  assert.equal(sim.state, 'gameover');
});

test('todas las cartas se pueden aplicar', () => {
  const sim = solo();
  const p = sim.players.get(1);
  for (const c of Object.keys(CARDS)) sim.applyCard(p, c);
  assert.ok(p.speedMul > 1 && p.rofMul > 1 && p.dmgMul > 1 && p.pierce === 1 && p.magnet && p.regenShield);
});

test('snapshot compacto con el formato esperado', () => {
  const sim = new Simulation({ mode: 'coop' });
  sim.addPlayer(1, 'Ana');
  sim.addPlayer(2, 'Beto');
  sim.start();
  run(sim, 3);
  const s = sim.snapshot();
  assert.equal(s.st, 'playing');
  assert.equal(s.p.length, 2);
  assert.equal(s.p[0].length, 16);
  assert.ok(JSON.stringify(s).length < 20000);
});
