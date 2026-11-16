// Matchmaker: traduce "partida rápida / crear sala / unirse con código"
// en GameServerAllocations de Agones. En modo local devuelve un único servidor.
import { k8s, namespace, inCluster } from './k8s.js';

const FLEET = process.env.FLEET_NAME || 'astro-fleet';
const ALLOC_RETRY_SECONDS = Number(process.env.ALLOC_RETRY_SECONDS || 25);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const codeFromName = (name) => name.split('-').pop().toUpperCase();

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function toMatch(gs) {
  const labels = gs.metadata?.labels || {};
  return {
    code: codeFromName(gs.metadata.name),
    host: gs.status?.address,
    port: gs.status?.ports?.[0]?.port,
    players: Number(labels['agones.dev/sdk-players'] || 0),
    spectators: Number(labels['agones.dev/sdk-spectators'] || 0),
    state: labels['agones.dev/sdk-state'] || 'lobby',
    wave: Number(labels['agones.dev/sdk-wave'] || 0),
    private: labels.private === 'true',
  };
}

// ------------------------------------------------------------------ Agones
class AgonesMatchmaker {
  constructor(metrics) {
    this.metrics = metrics;
    this.cache = { at: 0, items: [] };
  }

  async allocate(type, selectors, labels) {
    const body = {
      apiVersion: 'allocation.agones.dev/v1',
      kind: 'GameServerAllocation',
      spec: { selectors, ...(labels ? { metadata: { labels } } : {}) },
    };
    const end = this.metrics.allocationSeconds.startTimer({ type });
    const deadline = Date.now() + ALLOC_RETRY_SECONDS * 1000;
    let wait = 500;
    // Si no hay servidores Ready (p. ej. durante un pico) se reintenta mientras
    // el FleetAutoscaler / Cluster Autoscaler crean capacidad.
    for (;;) {
      const res = await k8s('POST', `/apis/allocation.agones.dev/v1/namespaces/${namespace}/gameserverallocations`, body);
      const st = res?.status?.state;
      if (st === 'Allocated') {
        end();
        this.metrics.allocations.inc({ type, result: 'allocated' });
        this.cache.at = 0;
        return {
          code: codeFromName(res.status.gameServerName),
          host: res.status.address,
          port: res.status.ports?.[0]?.port,
        };
      }
      this.metrics.allocations.inc({ type, result: (st || 'error').toLowerCase() });
      if (Date.now() + wait > deadline) {
        end();
        throw new HttpError(503, 'No hay servidores de juego disponibles. Intenta de nuevo en unos segundos.');
      }
      await sleep(wait);
      wait = Math.min(wait * 1.5, 3000);
    }
  }

  quick() {
    return this.allocate('quick', [
      {
        gameServerState: 'Allocated',
        matchLabels: { 'agones.dev/fleet': FLEET, 'agones.dev/sdk-joinable': 'true' },
        matchExpressions: [{ key: 'private', operator: 'DoesNotExist' }],
      },
      { gameServerState: 'Ready', matchLabels: { 'agones.dev/fleet': FLEET } },
    ]);
  }

  create() {
    return this.allocate('create',
      [{ gameServerState: 'Ready', matchLabels: { 'agones.dev/fleet': FLEET } }],
      { private: 'true' });
  }

  async listRaw() {
    if (Date.now() - this.cache.at < 2000) return this.cache.items;
    const sel = encodeURIComponent(`agones.dev/fleet=${FLEET}`);
    const res = await k8s('GET', `/apis/agones.dev/v1/namespaces/${namespace}/gameservers?labelSelector=${sel}`);
    const items = (res?.items || []).filter((gs) => gs.status?.state === 'Allocated');
    this.cache = { at: Date.now(), items };
    return items;
  }

  async join(code) {
    const c = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(c)) throw new HttpError(400, 'Código inválido');
    this.cache.at = 0;
    const gs = (await this.listRaw()).find((g) => codeFromName(g.metadata.name) === c);
    if (!gs) throw new HttpError(404, 'No existe una sala activa con ese código');
    const m = toMatch(gs);
    return { code: m.code, host: m.host, port: m.port };
  }

  async list() {
    return (await this.listRaw()).map(toMatch).filter((m) => m.players > 0);
  }
}

// ------------------------------------------------------------------ Local
class LocalMatchmaker {
  constructor() {
    this.port = Number(process.env.GAMESERVER_PORT || 7777);
    this.statusUrl = process.env.GAMESERVER_STATUS_URL || `http://localhost:${this.port}/status`;
    this.fixedHost = process.env.GAMESERVER_PUBLIC_HOST || null;
  }
  info(reqHost) {
    return { code: 'LOCAL', host: this.fixedHost || reqHost || 'localhost', port: this.port };
  }
  async status() {
    try {
      const r = await fetch(this.statusUrl, { signal: AbortSignal.timeout(1500) });
      return await r.json();
    } catch {
      return null;
    }
  }
  async quick(reqHost) {
    const st = await this.status();
    if (!st) throw new HttpError(503, 'El servidor de juego local no está corriendo (npm start en /server)');
    return this.info(reqHost);
  }
  create(reqHost) { return this.quick(reqHost); }
  async join(code, reqHost) {
    if (String(code).toUpperCase() !== 'LOCAL') throw new HttpError(404, 'En modo local el código es LOCAL');
    return this.quick(reqHost);
  }
  async list(reqHost) {
    const st = await this.status();
    if (!st || st.players === 0) return [];
    return [{ ...this.info(reqHost), players: st.players, spectators: st.spectators, state: st.state, wave: st.wave, private: false }];
  }
}

export function createMatchmaker(metrics) {
  const mode = process.env.MATCHMAKER_MODE || (inCluster ? 'agones' : 'local');
  console.log(`[matchmaker] modo: ${mode}`);
  return mode === 'agones' ? new AgonesMatchmaker(metrics) : new LocalMatchmaker();
}
