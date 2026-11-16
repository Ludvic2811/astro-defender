// "Fuentes" de estado para el renderizador:
//  - LocalSource: simulación en el navegador (modo individual).
//  - NetSource: servidor autoritativo vía WebSocket (cooperativo y espectador),
//    con interpolación de snapshots y predicción local de la nave propia.
import { Simulation, STEP, applyMovement } from '../shared/sim.js';

export class LocalSource {
  constructor(name) {
    this.kind = 'local';
    this.role = 'player';
    this.myId = 1;
    this.hostId = 1;
    this.isHost = true;
    this.status = 'open';
    this.sim = new Simulation({ mode: 'solo' });
    this.sim.addPlayer(1, name);
    this.sim.start();
    this.acc = 0;
    this.paused = false;
    this.frozen = 0;
  }
  update(deltaMs, input) {
    if (this.paused) return;
    // Pausa breve en impactos fuertes ("hit-stop")
    if (this.frozen > 0) { this.frozen -= deltaMs; return; }
    this.sim.setInput(1, input);
    this.acc += Math.min(deltaMs / 1000, 0.25);
    while (this.acc >= STEP) { this.sim.step(STEP); this.acc -= STEP; }
  }
  freeze(ms) { this.frozen = Math.max(this.frozen, ms); }
  getState() { return this.sim.snapshot(); }
  drainEvents() { return this.sim.drainEvents(); }
  bomb() { this.sim.useBomb(1); }
  pick(i) { this.sim.pickUpgrade(1, i); }
  start() {}
  restart() { this.sim.restart(); this.sim.start(); }
  destroy() {}
}

const INTERP_MS = 100;

function lerpList(a, b, t, xi, yi) {
  if (!a) return b;
  const prev = new Map();
  for (const it of a) prev.set(it[0], it);
  return b.map((it) => {
    const p = prev.get(it[0]);
    if (!p) return it;
    const out = it.slice();
    out[xi] = p[xi] + (it[xi] - p[xi]) * t;
    out[yi] = p[yi] + (it[yi] - p[yi]) * t;
    return out;
  });
}

export class NetSource {
  constructor({ host, port, name, role = 'player' }) {
    this.kind = 'net';
    this.role = role;
    this.myId = null;
    this.hostId = null;
    this.spectators = 0;
    this.status = 'connecting';
    this.error = null;
    this.ping = 0;
    this.buffer = [];
    this.events = [];
    this.predicted = null;
    this.lastInput = '';
    this.lastSent = 0;

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${host}:${port}`);
    this.ws.onopen = () => {
      this.status = 'open';
      this.send({ t: 'join', name, role });
      this.pingTimer = setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
    };
    this.ws.onmessage = (ev) => this.onMessage(ev.data);
    this.ws.onclose = (ev) => {
      if (this.status !== 'closed') this.closeCode = ev.code;
      this.status = 'closed';
      clearInterval(this.pingTimer);
    };
    this.ws.onerror = () => { this.error = this.error || 'connection'; };
  }

  send(obj) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  onMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.t) {
      case 'snap':
        this.buffer.push({ at: performance.now(), s: msg.s });
        if (this.buffer.length > 30) this.buffer.shift();
        if (msg.ev?.length) this.events.push(...msg.ev);
        this.hostId = msg.h;
        this.spectators = msg.sp;
        break;
      case 'welcome':
        this.myId = msg.id;
        this.role = msg.role;
        break;
      case 'pong':
        this.ping = Math.round(performance.now() - msg.c);
        break;
      case 'error':
        this.error = msg.code || 'error';
        this.errorMsg = msg.msg;
        break;
    }
  }

  get isHost() { return this.myId !== null && this.myId === this.hostId; }

  update(deltaMs, input) {
    if (this.role !== 'player' || this.status !== 'open') return;
    const key = `${+input.u}${+input.d}${+input.l}${+input.r}${+input.f}`;
    const now = performance.now();
    if (key !== this.lastInput || now - this.lastSent > 250) {
      this.send({ t: 'input', ...input });
      this.lastInput = key;
      this.lastSent = now;
    }
    // Predicción local del movimiento propio
    const latest = this.buffer[this.buffer.length - 1];
    if (!latest) return;
    const me = latest.s.p.find((p) => p[0] === this.myId);
    if (!me || !(me[5] & 1) || latest.s.st !== 'playing' || latest.s.ph === 'upgrade') { this.predicted = null; return; }
    if (!this.predicted) this.predicted = { x: me[1], y: me[2] };
    this.predicted.speedMul = (me[13] || 100) / 100;
    applyMovement(this.predicted, input, Math.min(deltaMs / 1000, 0.1));
    const dx = me[1] - this.predicted.x, dy = me[2] - this.predicted.y;
    const moving = input.u || input.d || input.l || input.r;
    if (dx * dx + dy * dy > 110 * 110) { this.predicted.x = me[1]; this.predicted.y = me[2]; }
    else if (!moving) { this.predicted.x += dx * 0.15; this.predicted.y += dy * 0.15; }
  }

  getState() {
    const n = this.buffer.length;
    if (!n) return null;
    const renderAt = performance.now() - INTERP_MS;
    let i = n - 1;
    while (i > 0 && this.buffer[i - 1].at > renderAt) i--;
    const b = this.buffer[i];
    const a = i > 0 ? this.buffer[i - 1] : null;
    let s = b.s;
    if (a && b.at > a.at) {
      const t = Math.max(0, Math.min(1, (renderAt - a.at) / (b.at - a.at)));
      s = {
        ...b.s,
        p: lerpList(a.s.p, b.s.p, t, 1, 2),
        e: lerpList(a.s.e, b.s.e, t, 2, 3),
        a: lerpList(a.s.a, b.s.a, t, 2, 3),
        b: lerpList(a.s.b, b.s.b, t, 2, 3),
        u: lerpList(a.s.u, b.s.u, t, 2, 3),
      };
    }
    // Datos no posicionales (vidas, puntos, estado, fase) del snapshot más reciente
    const latest = this.buffer[n - 1].s;
    const { p: _p, e: _e, a: _a, b: _b, u: _u, ...rest } = latest;
    s = { ...s, ...rest };
    const lp = new Map(latest.p.map((p) => [p[0], p]));
    s.p = s.p.filter((p) => lp.has(p[0])).map((p) => {
      const out = lp.get(p[0]).slice();
      out[1] = p[1]; out[2] = p[2];
      if (p[0] === this.myId && this.predicted) { out[1] = this.predicted.x; out[2] = this.predicted.y; }
      return out;
    });
    for (const p of latest.p) if (!s.p.some((q) => q[0] === p[0])) s.p.push(p);
    return s;
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  freeze() {}
  bomb() { this.send({ t: 'bomb' }); }
  pick(i) { this.send({ t: 'pick', i }); }
  start() { this.send({ t: 'start' }); }
  restart() { this.send({ t: 'restart' }); }
  destroy() {
    this.status = 'closed';
    clearInterval(this.pingTimer);
    try { this.ws.close(); } catch { /* ignorar */ }
  }
}
