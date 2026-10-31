import test from 'node:test';
import assert from 'node:assert/strict';
import { jaruSegments } from '../js/jaru-geom.js';

test('same row', () => {
  const rows = [{ left: 0, right: 500, top: 10 }];
  assert.deepEqual(jaruSegments({ left: 10, right: 30, top: 10 }, { left: 100, right: 120, top: 10 }, rows),
    [{ x1: 20, x2: 110, y: 10 }]);
});

test('crosses wrap into two segments', () => {
  const rows = [{ left: 0, right: 500, top: 10 }, { left: 0, right: 500, top: 90 }];
  assert.deepEqual(jaruSegments({ left: 460, right: 480, top: 10 }, { left: 20, right: 40, top: 90 }, rows),
    [{ x1: 470, x2: 500, y: 10 }, { x1: 0, x2: 30, y: 90 }]);
});

test('spans a full middle row', () => {
  const rows = [{ left: 0, right: 500, top: 10 }, { left: 0, right: 480, top: 90 }, { left: 0, right: 500, top: 170 }];
  assert.deepEqual(jaruSegments({ left: 460, right: 480, top: 10 }, { left: 20, right: 40, top: 170 }, rows),
    [{ x1: 470, x2: 500, y: 10 }, { x1: 0, x2: 480, y: 90 }, { x1: 0, x2: 30, y: 170 }]);
});
