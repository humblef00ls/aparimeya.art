import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGradient, gradientStops, DEFAULT_GRADIENT, moveGradientStop } from '../src/lib/black-hole/filters.ts';

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

test('dragged colors cross neighbors in both directions and keep selection', () => {
  const initial = [{position: 0, color: '#000000'}, {position: 0.3, color: '#ff0000'}, {position: 0.7, color: '#00ff00'}, {position: 1, color: '#ffffff'}];
  const right = moveGradientStop(initial, 1, 0.9);
  assert.equal(right.selected, 2);
  assert.equal(right.stops[right.selected].color, '#ff0000');
  const left = moveGradientStop(right.stops, right.selected, 0.1);
  assert.equal(left.selected, 1);
  assert.equal(left.stops[left.selected].color, '#ff0000');
  assert.deepEqual(parseGradient(JSON.stringify(left.stops)), left.stops);
  for (const position of [0, 0.7, 1]) {
    const overlap = moveGradientStop(initial, 1, position);
    assert.ok(parseGradient(JSON.stringify(overlap.stops)));
    assert.equal(overlap.stops[overlap.selected].color, '#ff0000');
  }
});
