import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../src/room.js';

function fakeConn() {
  return { sent: [], closed: null, bufferedAmount: 0, send(m) { this.sent.push(JSON.parse(m)); }, close(c) { this.closed = c; } };
}

const quiet = () => {};

test('el primer jugador es anfitrión y puede iniciar', () => {
  const room = new Room({ log: quiet });
  const a = fakeConn(), b = fakeConn();
  room.connect(a); room.connect(b);
  room.handle(a, JSON.stringify({ t: 'join', name: 'Ana' }));
  room.handle(b, JSON.stringify({ t: 'join', name: 'Beto' }));
  assert.equal(a.sent[0].host, true);
  assert.equal(b.sent[0].host, false);
  room.handle(b, JSON.stringify({ t: 'start' }));
  assert.equal(room.sim.state, 'lobby', 'solo el anfitrión inicia');
  room.handle(a, JSON.stringify({ t: 'start' }));
  assert.equal(room.sim.state, 'playing');
});

test('rechaza al quinto jugador y admite espectadores', () => {
  const room = new Room({ log: quiet });
  const conns = Array.from({ length: 5 }, fakeConn);
  conns.forEach((c, i) => { room.connect(c); room.handle(c, JSON.stringify({ t: 'join', name: `P${i}` })); });
  assert.equal(room.playerCount, 4);
  assert.equal(conns[4].closed, 4001);
  assert.equal(room.sim.state, 'playing', 'arranca automáticamente con 4');
  const spec = fakeConn();
  room.connect(spec);
  room.handle(spec, JSON.stringify({ t: 'join', role: 'spectator' }));
  assert.equal(room.spectatorCount, 1);
});

test('reasigna anfitrión al desconectarse', () => {
  const room = new Room({ log: quiet });
  const a = fakeConn(), b = fakeConn();
  room.connect(a); room.connect(b);
  room.handle(a, JSON.stringify({ t: 'join', name: 'Ana' }));
  room.handle(b, JSON.stringify({ t: 'join', name: 'Beto' }));
  room.disconnect(a);
  assert.equal(room.hostId, b.sent[0].id);
});

test('tick produce snapshots y se difunden', () => {
  const room = new Room({ log: quiet });
  const a = fakeConn();
  room.connect(a);
  room.handle(a, JSON.stringify({ t: 'join', name: 'Ana' }));
  room.handle(a, JSON.stringify({ t: 'start' }));
  const data = room.tick();
  room.broadcast(data);
  const snap = a.sent.at(-1);
  assert.equal(snap.t, 'snap');
  assert.equal(snap.s.st, 'playing');
});

test('ignora mensajes malformados', () => {
  const room = new Room({ log: quiet });
  const a = fakeConn();
  room.connect(a);
  assert.equal(room.handle(a, 'no-json'), null);
  assert.equal(room.handle(a, JSON.stringify({ t: 'hack' })), null);
});

test('bombas y elección de cartas por WebSocket', () => {
  const room = new Room({ log: quiet });
  const a = fakeConn();
  room.connect(a);
  room.handle(a, JSON.stringify({ t: 'join', name: 'Ana' }));
  room.handle(a, JSON.stringify({ t: 'start' }));
  const p = room.sim.players.get(a.sent[0].id);
  const bombs = p.bombs;
  assert.equal(room.handle(a, JSON.stringify({ t: 'bomb' })), 'bomb');
  assert.equal(p.bombs, bombs - 1);
  room.sim.startUpgrade();
  room.handle(a, JSON.stringify({ t: 'pick', i: 7 }));
  assert.equal(p.picked, false, 'índice fuera de rango');
  room.handle(a, JSON.stringify({ t: 'pick', i: 1 }));
  assert.equal(room.sim.phase, 'break');
});
