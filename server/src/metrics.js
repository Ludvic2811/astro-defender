import http from 'node:http';
import client from 'prom-client';

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'astro_gs_' });

export const playersGauge = new client.Gauge({
  name: 'astro_players_connected',
  help: 'Jugadores conectados a esta partida',
  registers: [registry],
});
export const spectatorsGauge = new client.Gauge({
  name: 'astro_spectators_connected',
  help: 'Espectadores conectados a esta partida',
  registers: [registry],
});
export const waveGauge = new client.Gauge({
  name: 'astro_match_wave',
  help: 'Oleada actual de la partida',
  registers: [registry],
});
export const stateGauge = new client.Gauge({
  name: 'astro_match_state',
  help: 'Estado de la partida (1 = activo) por estado',
  labelNames: ['state'],
  registers: [registry],
});
export const tickHistogram = new client.Histogram({
  name: 'astro_tick_duration_seconds',
  help: 'Duración de cada tick de simulación + difusión',
  buckets: [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05],
  registers: [registry],
});
export const messagesIn = new client.Counter({
  name: 'astro_ws_messages_received_total',
  help: 'Mensajes WebSocket recibidos',
  labelNames: ['type'],
  registers: [registry],
});
export const bytesOut = new client.Counter({
  name: 'astro_ws_bytes_sent_total',
  help: 'Bytes enviados por WebSocket',
  registers: [registry],
});
export const matchesFinished = new client.Counter({
  name: 'astro_matches_finished_total',
  help: 'Partidas terminadas por resultado',
  labelNames: ['result'],
  registers: [registry],
});

export function startMetricsServer(port) {
  const srv = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  srv.listen(port, () => console.log(`[metrics] escuchando en :${port}/metrics`));
  return srv;
}
