// Sala de juego autoritativa: una instancia por servidor de juego (modelo Agones:
// un proceso = una partida). Independiente de WebSocket para poder probarla.
import { Simulation, STEP, MAX_PLAYERS } from '../../shared/sim.js';

export const TICK_MS = 50; // 20 snapshots por segundo
const STEPS_PER_TICK = Math.round(TICK_MS / 1000 / STEP); // 3 pasos de 1/60 s

export class Room {
  constructor({ log = console.log } = {}) {
    this.sim = new Simulation({ mode: 'coop' });
    this.clients = new Map(); // conn -> { id, role, name }
    this.nextClientId = 1;
    this.hostId = null;
    this.hadPlayers = false;
    this.log = log;
    this.lastState = this.sim.state;
    this.onEnd = null; // callback(result)
  }

  get playerCount() { return this.sim.players.size; }
  get spectatorCount() {
    let n = 0;
    for (const c of this.clients.values()) if (c.role === 'spectator') n++;
    return n;
  }
  get joinable() { return this.sim.state === 'lobby' && this.playerCount < MAX_PLAYERS; }

  /** conn debe exponer send(string) y close(code, reason). */
  connect(conn) {
    this.clients.set(conn, { id: 0, role: null, name: '' });
  }

  disconnect(conn) {
    const c = this.clients.get(conn);
    this.clients.delete(conn);
    if (!c || c.role !== 'player') return;
    this.sim.removePlayer(c.id);
    this.log(`[room] ${c.name} (#${c.id}) salió. Jugadores: ${this.playerCount}`);
    if (this.hostId === c.id) this.pickHost();
  }

  pickHost() {
    const ids = [...this.sim.players.keys()].sort((a, b) => a - b);
    this.hostId = ids.length ? ids[0] : null;
  }

  handle(conn, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return null; }
    if (!msg || typeof msg.t !== 'string') return null;
    const c = this.clients.get(conn);
    if (!c) return null;

    switch (msg.t) {
      case 'join': {
        if (c.role) break;
        const name = String(msg.name || 'Piloto').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 16) || 'Piloto';
        if (msg.role === 'spectator') {
          c.role = 'spectator';
          c.name = name;
          c.id = this.nextClientId++;
          conn.send(JSON.stringify({ t: 'welcome', id: c.id, role: 'spectator' }));
          break;
        }
        if (this.playerCount >= MAX_PLAYERS) {
          conn.send(JSON.stringify({ t: 'error', code: 'full', msg: 'La sala está llena' }));
          conn.close(4001, 'full');
          break;
        }
        c.id = this.nextClientId++;
        c.role = 'player';
        c.name = name;
        this.sim.addPlayer(c.id, name);
        this.hadPlayers = true;
        if (this.hostId === null) this.hostId = c.id;
        conn.send(JSON.stringify({ t: 'welcome', id: c.id, role: 'player', host: this.hostId === c.id }));
        this.log(`[room] ${name} (#${c.id}) se unió. Jugadores: ${this.playerCount}`);
        // Arranque automático cuando la sala se llena
        if (this.playerCount >= MAX_PLAYERS && this.sim.state === 'lobby') this.sim.start();
        break;
      }
      case 'input':
        if (c.role === 'player') this.sim.setInput(c.id, msg);
        break;
      case 'bomb':
        if (c.role === 'player') this.sim.useBomb(c.id);
        break;
      case 'pick': {
        const i = Number(msg.i);
        if (c.role === 'player' && Number.isInteger(i) && i >= 0 && i < 3) this.sim.pickUpgrade(c.id, i);
        break;
      }
      case 'start':
        if (c.role === 'player' && c.id === this.hostId) this.sim.start();
        break;
      case 'restart':
        if (c.role === 'player' && c.id === this.hostId &&
            (this.sim.state === 'victory' || this.sim.state === 'gameover')) {
          this.sim.restart();
        }
        break;
      case 'ping':
        conn.send(JSON.stringify({ t: 'pong', c: msg.c }));
        break;
      default:
        return null;
    }
    return msg.t;
  }

  /** Avanza la simulación y devuelve el mensaje serializado a difundir. */
  tick() {
    for (let i = 0; i < STEPS_PER_TICK; i++) this.sim.step(STEP);
    if (this.sim.state !== this.lastState) {
      if ((this.sim.state === 'victory' || this.sim.state === 'gameover') && this.onEnd) {
        this.onEnd(this.sim.state, this.sim.teamScore);
      }
      this.lastState = this.sim.state;
    }
    return JSON.stringify({
      t: 'snap',
      s: this.sim.snapshot(),
      ev: this.sim.drainEvents(),
      h: this.hostId,
      sp: this.spectatorCount,
    });
  }

  broadcast(data) {
    let bytes = 0;
    for (const [conn, c] of this.clients) {
      if (!c.role) continue;
      // Clientes lentos: se descartan snapshots en vez de acumular memoria
      if (conn.bufferedAmount > 256 * 1024) continue;
      conn.send(data);
      bytes += data.length;
    }
    return bytes;
  }

  /** Reinicia la sala cuando queda vacía (modo standalone). */
  resetIfEmpty() {
    if (this.playerCount === 0 && this.sim.state !== 'lobby') {
      this.sim.restart();
      this.hostId = null;
    }
  }
}
