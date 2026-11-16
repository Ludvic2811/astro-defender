// Prueba de humo end-to-end: lobby -> asignación -> 2 jugadores + 1 espectador.
// Uso: node scripts/smoke-test.mjs [http://localhost:8080]
import { WebSocket } from '../server/node_modules/ws/wrapper.mjs';

const LOBBY = process.argv[2] || 'http://localhost:8080';
const post = async (path, body) => {
  const r = await fetch(LOBBY + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
};

function connect(match, name, role = 'player') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${match.host}:${match.port}`);
    const c = { ws, name, snaps: 0, last: null, welcome: null, rtt: null };
    ws.on('open', () => {
      ws.send(JSON.stringify({ t: 'join', name, role }));
      ws.send(JSON.stringify({ t: 'ping', c: Date.now() }));
    });
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      if (m.t === 'welcome') { c.welcome = m; resolve(c); }
      if (m.t === 'snap') { c.snaps++; c.last = m.s; }
      if (m.t === 'pong') c.rtt = Date.now() - m.c;
    });
    ws.on('error', reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const match = await post('/api/match', { type: 'quick' });
console.log('Partida asignada:', match);
const a = await connect(match, 'Ana');
const b = await connect(match, 'Beto');
const spec = await connect(match, 'Mirón', 'spectator');
console.log('Anfitrión:', a.welcome.host, '| Beto anfitrión:', b.welcome.host, '| espectador:', spec.welcome.role);

a.ws.send(JSON.stringify({ t: 'start' }));
a.ws.send(JSON.stringify({ t: 'input', l: true, f: true }));
b.ws.send(JSON.stringify({ t: 'input', r: true, f: true }));
await sleep(3000);

const s = spec.last;
console.log(`Snapshots en 3 s -> Ana: ${a.snaps}, Beto: ${b.snaps}, espectador: ${spec.snaps}`);
console.log(`Estado: ${s.st}, oleada ${s.w}, jugadores ${s.p.length}, enemigos ${s.e.length}, balas ${s.b.length}, RTT ${a.rtt} ms`);
console.log('Posiciones:', s.p.map((p) => `${p[6]}@(${Math.round(p[1])},${Math.round(p[2])}) pts=${p[4]}`).join('  '));

const matches = await (await fetch(LOBBY + '/api/matches')).json();
console.log('Partidas listadas para espectadores:', matches.length);

const ok = s.st === 'playing' && s.p.length === 2 && spec.snaps > 40 && matches.length === 1;
for (const c of [a, b, spec]) c.ws.close();
console.log(ok ? '\nOK: prueba de humo superada' : '\nFALLÓ la prueba de humo');
process.exit(ok ? 0 : 1);
