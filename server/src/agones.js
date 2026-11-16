// Cliente mínimo del SDK de Agones usando su API REST local (sidecar).
// Agones inyecta AGONES_SDK_HTTP_PORT en el contenedor del servidor de juego.
// Si la variable no existe, el servidor corre en modo "standalone" (desarrollo local).

const port = process.env.AGONES_SDK_HTTP_PORT;
const base = port ? `http://localhost:${port}` : null;

export const enabled = Boolean(base);

async function call(method, path, body) {
  if (!base) return null;
  try {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`[agones] ${method} ${path} -> ${res.status}`);
      return null;
    }
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  } catch (err) {
    console.warn(`[agones] ${method} ${path} falló: ${err.message}`);
    return null;
  }
}

export const ready = () => call('POST', '/ready', {});
export const health = () => call('POST', '/health', {});
export const shutdown = () => call('POST', '/shutdown', {});
export const getGameServer = () => call('GET', '/gameserver');

// Las etiquetas quedan en el GameServer como "agones.dev/sdk-<key>"
const labelCache = new Map();
export async function setLabel(key, value) {
  const v = String(value);
  if (labelCache.get(key) === v) return;
  labelCache.set(key, v);
  const r = await call('PUT', '/metadata/label', { key, value: v });
  if (r === null) labelCache.delete(key);
}
