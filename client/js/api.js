// Comunicación con el lobby (matchmaking) y con la tabla de líderes (Lambda + DynamoDB).

const DEFAULT_CONFIG = { leaderboardUrl: 'api/scores' };

export async function loadConfig() {
  try {
    const r = await fetch('config.json', { cache: 'no-store' });
    if (!r.ok) throw new Error();
    return { ...DEFAULT_CONFIG, ...(await r.json()) };
  } catch {
    return { ...DEFAULT_CONFIG, offline: true };
  }
}

export async function loadManifest() {
  try {
    const r = await fetch('assets/manifest.json', { cache: 'no-store' });
    return r.ok ? await r.json() : {};
  } catch {
    return {};
  }
}

async function jsonFetch(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  let body = null;
  try { body = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) throw new Error(body?.error || `Error ${r.status}`);
  return body;
}

// ------------------------------------------------------------------ partidas
export const requestMatch = (type, code) =>
  jsonFetch('api/match', { method: 'POST', body: JSON.stringify({ type, code }) });

export const listMatches = () => jsonFetch('api/matches');

// ------------------------------------------------------------------ líderes
const LOCAL_KEY = 'astro.localScores';

function localScores() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
}

export async function fetchScores(mode) {
  const base = window.ASTRO.config.leaderboardUrl;
  try {
    const sep = base.includes('?') ? '&' : '?';
    const data = await jsonFetch(`${base}${sep}mode=${mode}&limit=10`);
    return { items: data.items || [], source: 'cloud' };
  } catch {
    const items = localScores().filter((s) => s.mode === mode)
      .sort((a, b) => b.score - a.score).slice(0, 10);
    return { items, source: 'local' };
  }
}

export async function submitScore(entry) {
  const base = window.ASTRO.config.leaderboardUrl;
  try {
    await jsonFetch(base, { method: 'POST', body: JSON.stringify(entry) });
    return 'cloud';
  } catch {
    try {
      const all = localScores();
      all.push({ ...entry, createdAt: new Date().toISOString() });
      localStorage.setItem(LOCAL_KEY, JSON.stringify(all.slice(-200)));
    } catch { /* almacenamiento no disponible */ }
    return 'local';
  }
}

// ------------------------------------------------------------------ preferencias
export function getName() {
  try { return localStorage.getItem('astro.name') || ''; } catch { return ''; }
}
export function setName(n) {
  try { localStorage.setItem('astro.name', n); } catch { /* ignorar */ }
}
