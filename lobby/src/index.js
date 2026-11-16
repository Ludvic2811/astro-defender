// Lobby de Astro Defender: sirve el cliente web (HTML/JS/Phaser), entrega la
// configuración, asigna partidas (Agones) y expone métricas Prometheus.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import client from 'prom-client';
import { createMatchmaker, HttpError } from './matchmaker.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(here, '../../client'));
const SHARED_DIR = path.resolve(process.env.SHARED_DIR || path.join(here, '../../shared'));
const LEADERBOARD_API_URL = process.env.LEADERBOARD_API_URL || '';

// ------------------------------------------------------------------ métricas
const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'astro_lobby_' });
const metrics = {
  allocations: new client.Counter({
    name: 'astro_lobby_allocations_total', help: 'Asignaciones de GameServer',
    labelNames: ['type', 'result'], registers: [registry],
  }),
  allocationSeconds: new client.Histogram({
    name: 'astro_lobby_allocation_seconds', help: 'Tiempo hasta obtener un servidor (incluye esperas por autoescalado)',
    labelNames: ['type'], buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30], registers: [registry],
  }),
  requests: new client.Counter({
    name: 'astro_lobby_http_requests_total', help: 'Peticiones HTTP',
    labelNames: ['route', 'status'], registers: [registry],
  }),
};

const matchmaker = createMatchmaker(metrics);

// Tabla de líderes en memoria (solo desarrollo local, sin AWS)
const localScores = [];

// ------------------------------------------------------------------ utilidades
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8',
};

function send(res, status, body, route) {
  metrics.requests.inc({ route, status });
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readBody(req, limit = 4096) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > limit) throw new HttpError(413, 'Cuerpo demasiado grande');
  }
  try { return data ? JSON.parse(data) : {}; } catch { throw new HttpError(400, 'JSON inválido'); }
}

async function serveStatic(req, res, pathname) {
  let root = STATIC_DIR;
  let rel = pathname;
  if (pathname.startsWith('/shared/')) { root = SHARED_DIR; rel = pathname.slice('/shared'.length); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, path.normalize(decodeURIComponent(rel)));
  if (!file.startsWith(root)) return send(res, 403, { error: 'forbidden' }, 'static');
  try {
    const data = await fs.readFile(file);
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(data);
    metrics.requests.inc({ route: 'static', status: 200 });
  } catch {
    send(res, 404, { error: 'not found' }, 'static');
  }
}

const hostOf = (req) => (req.headers.host || 'localhost').replace(/:\d+$/, '');

// ------------------------------------------------------------------ rutas
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p === '/healthz') { res.end('ok'); return; }
    if (p === '/metrics') {
      res.setHeader('Content-Type', registry.contentType);
      res.end(await registry.metrics());
      return;
    }
    if (p === '/config.json') {
      return send(res, 200, {
        leaderboardUrl: LEADERBOARD_API_URL || '/api/scores',
        leaderboardBackend: LEADERBOARD_API_URL ? 'aws' : 'lobby',
      }, 'config');
    }
    if (p === '/api/match' && req.method === 'POST') {
      const body = await readBody(req);
      const h = hostOf(req);
      let match;
      if (body.type === 'create') match = await matchmaker.create(h);
      else if (body.type === 'join') match = await matchmaker.join(body.code, h);
      else match = await matchmaker.quick(h);
      return send(res, 200, match, 'match');
    }
    if (p === '/api/matches' && req.method === 'GET') {
      return send(res, 200, await matchmaker.list(hostOf(req)), 'matches');
    }
    if (p === '/api/scores') {
      if (req.method === 'GET') {
        const mode = url.searchParams.get('mode') || 'solo';
        const top = localScores.filter((s) => s.mode === mode).sort((a, b) => b.score - a.score).slice(0, 10);
        return send(res, 200, { items: top }, 'scores');
      }
      if (req.method === 'POST') {
        const b = await readBody(req);
        const item = {
          name: String(b.name || 'Piloto').slice(0, 40), score: Math.max(0, Math.floor(Number(b.score) || 0)),
          wave: Number(b.wave) || 0, mode: b.mode === 'coop' ? 'coop' : 'solo', createdAt: new Date().toISOString(),
        };
        localScores.push(item);
        return send(res, 201, item, 'scores');
      }
    }
    if (req.method === 'GET') return serveStatic(req, res, p);
    send(res, 404, { error: 'not found' }, 'other');
  } catch (err) {
    const status = err.status && err.status < 600 ? err.status : 500;
    if (status >= 500) console.error('[lobby]', err.message);
    send(res, status, { error: err.message }, p.startsWith('/api/') ? p.slice(5) : 'other');
  }
});

server.listen(PORT, () => {
  console.log(`[lobby] http://localhost:${PORT}  (cliente: ${STATIC_DIR})`);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
