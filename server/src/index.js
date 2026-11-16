// Servidor de juego de Astro Defender.
//  - Puerto PORT (7777): HTTP (/status, /healthz) + WebSocket (juego y espectadores)
//  - Puerto METRICS_PORT (9100): métricas Prometheus
//  - Integración Agones: Ready, Health, etiquetas y Shutdown al terminar.
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { Room, TICK_MS } from './room.js';
import * as agones from './agones.js';
import * as m from './metrics.js';

const PORT = Number(process.env.PORT || 7777);
const METRICS_PORT = Number(process.env.METRICS_PORT || 9100);
const IDLE_ALLOCATED_SECONDS = Number(process.env.IDLE_ALLOCATED_SECONDS || 90);
const EMPTY_SHUTDOWN_SECONDS = Number(process.env.EMPTY_SHUTDOWN_SECONDS || 15);

const room = new Room();
room.onEnd = (result, score) => {
  m.matchesFinished.inc({ result });
  console.log(`[room] partida terminada: ${result} (puntos de equipo: ${score})`);
};

// ---------------------------------------------------------------- HTTP + WS
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/healthz') {
    res.end('ok');
  } else if (req.url === '/status') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      state: room.sim.state,
      wave: room.sim.wave,
      players: room.playerCount,
      spectators: room.spectatorCount,
      joinable: room.joinable,
      names: [...room.sim.players.values()].map((p) => p.name),
    }));
  } else {
    res.statusCode = 404;
    res.end();
  }
});

const wss = new WebSocketServer({ server, maxPayload: 1024 });

wss.on('connection', (ws) => {
  room.connect(ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (data) => {
    const type = room.handle(ws, data.toString());
    if (type) m.messagesIn.inc({ type });
  });
  ws.on('close', () => room.disconnect(ws));
  ws.on('error', () => {});
});

// Detecta conexiones muertas
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 10000);

// ---------------------------------------------------------------- bucle de juego
setInterval(() => {
  const end = m.tickHistogram.startTimer();
  const data = room.tick();
  const bytes = room.broadcast(data);
  if (bytes) m.bytesOut.inc(bytes);
  end();
}, TICK_MS);

// ---------------------------------------------------------------- ciclo de vida
let allocatedAt = null;
let emptySince = null;
let shuttingDown = false;

async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[lifecycle] apagando: ${reason}`);
  for (const ws of wss.clients) ws.close(4000, 'server-shutdown');
  if (agones.enabled) await agones.shutdown();
  setTimeout(() => process.exit(0), 2000);
}

setInterval(async () => {
  const players = room.playerCount;
  const spectators = room.spectatorCount;
  m.playersGauge.set(players);
  m.spectatorsGauge.set(spectators);
  m.waveGauge.set(room.sim.wave);
  for (const s of ['lobby', 'playing', 'victory', 'gameover']) {
    m.stateGauge.set({ state: s }, room.sim.state === s ? 1 : 0);
  }

  if (!agones.enabled) {
    if (players === 0) room.resetIfEmpty();
    return;
  }

  // Etiquetas visibles en el GameServer (las usa el lobby/matchmaker)
  agones.setLabel('joinable', room.joinable ? 'true' : 'false');
  agones.setLabel('players', players);
  agones.setLabel('spectators', spectators);
  agones.setLabel('state', room.sim.state);
  agones.setLabel('wave', room.sim.wave);

  // Partida abandonada: todos los jugadores se fueron
  if (room.hadPlayers && players === 0) {
    emptySince ??= Date.now();
    if (Date.now() - emptySince > EMPTY_SHUTDOWN_SECONDS * 1000) shutdown('sala vacía');
  } else {
    emptySince = null;
  }

  // Asignado pero nadie se conectó
  if (allocatedAt && !room.hadPlayers &&
      Date.now() - allocatedAt > IDLE_ALLOCATED_SECONDS * 1000) {
    shutdown('asignado sin jugadores');
  }
}, 1000);

if (agones.enabled) {
  setInterval(() => agones.health(), 2000);
  setInterval(async () => {
    if (allocatedAt) return;
    const gs = await agones.getGameServer();
    if (gs?.status?.state === 'Allocated') {
      allocatedAt = Date.now();
      console.log('[agones] GameServer asignado a una partida');
    }
  }, 3000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, async () => {
  console.log(`[gameserver] escuchando en :${PORT} (Agones: ${agones.enabled ? 'sí' : 'no, modo local'})`);
  m.startMetricsServer(METRICS_PORT);
  if (agones.enabled) {
    await agones.ready();
    console.log('[agones] Ready');
  }
});
