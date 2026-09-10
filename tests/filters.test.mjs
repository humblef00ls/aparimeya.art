import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGradient, gradientStops, DEFAULT_GRADIENT } from '../src/lib/black-hole/filters.ts';

test('custom gradient storage round-trips positions and colors', () => {
  const stops = [{ position: 0.15, color: '#123456' }, { position: 0.72, color: '#abcdef' }, { position: 1, color: '#ffffff' }];
  assert.deepEqual(parseGradient(JSON.stringify(stops)), stops);
  assert.deepEqual(gradientStops('custom', stops), stops);
});

test('invalid saved gradients fall back safely', () => {
  for (const value of [null, '', '{', 'null', '{}', '[]', JSON.stringify([{ position: 0, color: '#000000' }]), JSON.stringify([{ position: 0, color: '#000000' }, { position: 0, color: '#ffffff' }]), JSON.stringify([{ position: -1, color: '#000000' }, { position: 1, color: '#ffffff' }]), JSON.stringify([{ position: 0, color: 'red' }, { position: 1, color: '#ffffff' }]), JSON.stringify(Array.from({ length: 17 }, (_, i) => ({ position: i / 16, color: '#000000' })))]) {
    assert.equal(parseGradient(value), null);
  }
});

test('presets keep their original three evenly spaced colors', () => {
  assert.deepEqual(gradientStops('mono', DEFAULT_GRADIENT), [{ position: 0, color: '#000000' }, { position: 0.5, color: '#808080' }, { position: 1, color: '#ffffff' }]);
});
