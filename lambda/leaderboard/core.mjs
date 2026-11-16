// Lógica de la tabla de líderes, independiente del SDK de AWS (fácil de probar).
// db debe exponer: put(item) y top(mode, limit) -> Promise<items[]>

const MODES = new Set(['solo', 'coop']);
const MAX_SCORE = 1_000_000_000;
const MAX_WAVE = 999;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function validateEntry(input) {
  if (!input || typeof input !== 'object') return { error: 'Cuerpo inválido' };
  const name = String(input.name ?? '').replace(/[^\p{L}\p{N} _&-]/gu, '').trim().slice(0, 40);
  const score = Number(input.score);
  const wave = Number(input.wave ?? 0);
  const mode = String(input.mode ?? 'solo');
  const players = Number(input.players ?? 1);
  if (!name) return { error: 'Nombre requerido' };
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) return { error: 'Puntuación inválida' };
  if (!Number.isInteger(wave) || wave < 0 || wave > MAX_WAVE) return { error: 'Oleada inválida' };
  if (!MODES.has(mode)) return { error: 'Modo inválido' };
  if (!Number.isInteger(players) || players < 1 || players > 4) return { error: 'Número de jugadores inválido' };
  return { entry: { name, score, wave, mode, players } };
}

export function createHandler(db, { now = () => new Date(), uuid = () => crypto.randomUUID() } = {}) {
  return async (event) => {
    const method = event?.requestContext?.http?.method || event?.httpMethod || 'GET';
    try {
      if (method === 'GET') {
        const q = event.queryStringParameters || {};
        const mode = MODES.has(q.mode) ? q.mode : 'solo';
        const limit = Math.min(Math.max(parseInt(q.limit, 10) || 10, 1), 50);
        const items = await db.top(mode, limit);
        return json(200, { mode, items });
      }
      if (method === 'POST') {
        let body = event.body || '{}';
        if (event.isBase64Encoded) body = Buffer.from(body, 'base64').toString('utf8');
        let parsed;
        try { parsed = JSON.parse(body); } catch { return json(400, { error: 'JSON inválido' }); }
        const { entry, error } = validateEntry(parsed);
        if (error) return json(400, { error });
        const item = { id: uuid(), ...entry, createdAt: now().toISOString() };
        await db.put(item);
        return json(201, item);
      }
      return json(405, { error: 'Método no permitido' });
    } catch (err) {
      console.error(err);
      return json(500, { error: 'Error interno' });
    }
  };
}
