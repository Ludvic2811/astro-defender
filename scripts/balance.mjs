// Simulador de balance: un bot juega muchas partidas sin gráficos y reporta
// hasta qué oleada llega. Sirve para calibrar la curva de dificultad.
//   node scripts/balance.mjs [partidas=100] [jugadores=1] [novato|experto]
// Perfiles: el novato reacciona cada 0.3 s y se distrae el 20 % de las veces;
// el experto reacciona cada 0.15 s y se distrae el 5 %.
import { Simulation, STEP, PLAYER } from '../shared/sim.js';

const GAMES = Number(process.argv[2] || 100);
const PLAYERS = Number(process.argv[3] || 1);
const PROFILES = { novato: { every: 18, miss: 0.2 }, experto: { every: 9, miss: 0.05 } };
const PROFILE_NAME = process.argv[4] || 'novato';
const PROFILE = PROFILES[PROFILE_NAME];
const MAX_WAVE = 60;

function botInput(sim, p) {
  const input = { u: false, d: false, l: false, r: false, f: true };
  let tx = p.x, ty = 520;

  // Objetivo: poder cercano o el enemigo más bajo
  let best = null, bd = Infinity;
  for (const u of sim.powerups) {
    const d = Math.hypot(u.x - p.x, u.y - p.y);
    if (d < 260 && d < bd) { bd = d; best = u; }
  }
  if (best) { tx = best.x; ty = Math.max(PLAYER.minY, best.y); }
  else {
    let low = null;
    for (const e of sim.enemies) if (!low || e.y > low.y) low = e;
    if (low) tx = low.x;
  }

  // Amenazas con posición y velocidad para extrapolar su trayectoria
  const threats = [];
  let danger = 0;
  for (const b of sim.bullets) {
    if (b.kind !== 1) continue;
    if (Math.hypot(b.x - p.x, b.y - p.y) < 150) danger++;
    threats.push([b.x, b.y, b.vx, b.vy, 6]);
  }
  for (const e of sim.enemies) {
    const vx = e.type === 2 && e.st === 2 ? e.vx : 0;
    const vy = e.type === 2 ? (e.st === 1 ? 0 : e.vy) : e.type === 1 ? 0 : (e.vy || 0);
    threats.push([e.x, e.y, vx, vy, e.type === 1 ? 62 : e.type === 4 ? 30 : 22]);
  }
  for (const a of sim.asteroids) threats.push([a.x, a.y, a.vx, a.vy, [14, 24, 36][a.size]]);

  // Despiste: solo persigue su objetivo, sin mirar amenazas
  if (Math.random() < PROFILE.miss) threats.length = 0;

  // Evalúa 9 movimientos posibles y elige el menos peligroso
  const sp = PLAYER.speed * p.speedMul;
  let bestScore = Infinity, bestMove = [0, 0];
  for (const mx of [-1, 0, 1]) {
    for (const my of [-1, 0, 1]) {
      let score = 0;
      for (const t of [0.08, 0.16, 0.28, 0.42]) {
        const px = Math.min(780, Math.max(20, p.x + mx * sp * t));
        const py = Math.min(576, Math.max(PLAYER.minY, p.y + my * sp * t));
        for (const [x, y, vx, vy, r] of threats) {
          const dx = x + vx * t - px, dy = y + vy * t - py;
          const lim = r + PLAYER.radius + 8;
          if (dx * dx + dy * dy < lim * lim) score += 10 / (t + 0.05);
        }
        if (sim.boss?.laser > 0 && Math.abs(sim.boss.x - px) < 34) score += 30;
      }
      score += Math.abs(tx - (p.x + mx * 40)) * 0.01 + Math.abs(ty - (p.y + my * 40)) * 0.005;
      if (score < bestScore) { bestScore = score; bestMove = [mx, my]; }
    }
  }
  input.l = bestMove[0] < 0; input.r = bestMove[0] > 0;
  input.u = bestMove[1] < 0; input.d = bestMove[1] > 0;
  return { input, bomb: danger >= 9 || (p.lives === 1 && danger >= 5) };
}

function play() {
  const sim = new Simulation({ mode: PLAYERS > 1 ? 'coop' : 'solo' });
  for (let i = 1; i <= PLAYERS; i++) sim.addPlayer(i, `bot${i}`);
  sim.start();
  let steps = 0;
  while (sim.state === 'playing' && sim.wave <= MAX_WAVE) {
    if (steps % PROFILE.every === 0) {
      for (const p of sim.players.values()) {
        if (!p.alive) continue;
        const { input, bomb } = botInput(sim, p);
        sim.setInput(p.id, input);
        if (bomb) sim.useBomb(p.id);
      }
    }
    if (sim.phase === 'upgrade') {
      for (const p of sim.players.values()) if (!p.picked) sim.pickUpgrade(p.id, Math.floor(Math.random() * 3));
    }
    sim.step(STEP);
    steps++;
    sim.drainEvents();
  }
  return { wave: sim.wave, score: sim.teamScore, minutes: (steps * STEP) / 60 };
}

const t0 = Date.now();
const results = Array.from({ length: GAMES }, play);
const waves = results.map((r) => r.wave).sort((a, b) => a - b);
const q = (f) => waves[Math.min(waves.length - 1, Math.floor(f * waves.length))];
const avg = (k) => results.reduce((s, r) => s + r[k], 0) / results.length;
console.log(`Perfil: ${PROFILE_NAME} · partidas: ${GAMES} · jugadores por partida: ${PLAYERS} · ${((Date.now() - t0) / 1000).toFixed(1)} s de cómputo`);
console.log(`Oleada alcanzada → mín ${waves[0]} · p25 ${q(0.25)} · mediana ${q(0.5)} · p75 ${q(0.75)} · p90 ${q(0.9)} · máx ${waves.at(-1)}`);
console.log(`Promedio → oleada ${avg('wave').toFixed(1)} · puntos ${Math.round(avg('score'))} · duración ${avg('minutes').toFixed(1)} min`);
const hist = {};
for (const w of waves) { const b = `${Math.floor((w - 1) / 5) * 5 + 1}-${Math.floor((w - 1) / 5) * 5 + 5}`; hist[b] = (hist[b] || 0) + 1; }
console.log('Distribución por sectores:', hist);
const exact = {};
for (const w of waves) exact[w] = (exact[w] || 0) + 1;
console.log('Oleada exacta de derrota:', Object.entries(exact).map(([w, c]) => `${w}:${c}`).join('  '));
