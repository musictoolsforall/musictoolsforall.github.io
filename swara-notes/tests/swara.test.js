import test from 'node:test';
import assert from 'node:assert/strict';
import { swaraDisplay, isValidVariant, parseScale, formatScale, maxVariant } from '../js/swara.js';

test('tamil display with variant and octave', () => {
  assert.deepEqual(swaraDisplay({ swara: 'R', variant: 2, octave: 0 }, 'ta'), { base: 'ரி', sub: '₂', octave: 0 });
  assert.deepEqual(swaraDisplay({ swara: 'S', octave: 1 }, 'en'), { base: 'S', sub: '', octave: 1 });
  assert.deepEqual(swaraDisplay({ swara: ',', octave: 0 }, 'ta'), { base: ',', sub: '', octave: 0 });
  assert.deepEqual(swaraDisplay({ swara: 'S', octave: 2 }, 'ta'), { base: 'ஸ', sub: '', octave: 2 });
});

test('variant limits', () => {
  assert.equal(isValidVariant('M', 2), true);
  assert.equal(isValidVariant('M', 3), false);
  assert.equal(isValidVariant('P', 1), false);
  assert.equal(isValidVariant('N', 3), true);
  assert.equal(maxVariant(','), 0);
});

test('parseScale', () => {
  assert.deepEqual(parseScale('r2, G3 m1 D2 N3'), { R: 2, G: 3, M: 1, D: 2, N: 3 });
  assert.deepEqual(parseScale('M3 P1 X2 R1'), { R: 1 });
  assert.equal(formatScale({ N: 3, R: 2 }), 'R2 N3');
});
