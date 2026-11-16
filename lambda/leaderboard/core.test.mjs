import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, validateEntry } from './core.mjs';

function memoryDb() {
  const items = [];
  return {
    items,
    put: async (it) => { items.push(it); },
    top: async (mode, limit) => items.filter((i) => i.mode === mode).sort((a, b) => b.score - a.score).slice(0, limit),
  };
}

const ev = (method, extra = {}) => ({ requestContext: { http: { method } }, ...extra });

test('valida entradas', () => {
  assert.ok(validateEntry({ name: 'Ana', score: 100, wave: 2, mode: 'solo' }).entry);
  assert.equal(validateEntry({ name: '', score: 1 }).error, 'Nombre requerido');
  assert.equal(validateEntry({ name: 'x', score: -5 }).error, 'Puntuación inválida');
  assert.equal(validateEntry({ name: 'x', score: 1.5 }).error, 'Puntuación inválida');
  assert.equal(validateEntry({ name: 'x', score: 1, mode: 'pvp' }).error, 'Modo inválido');
  assert.equal(validateEntry({ name: '<script>', score: 1 }).entry.name, 'script');
});

test('POST guarda y GET devuelve ordenado por modo', async () => {
  const db = memoryDb();
  const h = createHandler(db, { uuid: () => 'id', now: () => new Date(0) });
  for (const [name, score, mode] of [['A', 10, 'solo'], ['B', 50, 'solo'], ['C', 999, 'coop']]) {
    const r = await h(ev('POST', { body: JSON.stringify({ name, score, wave: 1, mode }) }));
    assert.equal(r.statusCode, 201);
  }
  const r = await h(ev('GET', { queryStringParameters: { mode: 'solo', limit: '5' } }));
  const body = JSON.parse(r.body);
  assert.deepEqual(body.items.map((i) => i.name), ['B', 'A']);
});

test('rechaza JSON inválido y métodos no soportados', async () => {
  const h = createHandler(memoryDb());
  assert.equal((await h(ev('POST', { body: '{nope' }))).statusCode, 400);
  assert.equal((await h(ev('DELETE'))).statusCode, 405);
});
