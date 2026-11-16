import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeFromName } from '../src/matchmaker.js';

test('el código de sala es el sufijo del GameServer', () => {
  assert.equal(codeFromName('astro-fleet-7x2kq-ab3cd'), 'AB3CD');
});
