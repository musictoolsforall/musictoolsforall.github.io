import test from 'node:test';
import assert from 'node:assert/strict';
import { transliterate } from '../js/translit.js';

test('translit', () => {
  for (const [ta, en] of [['க', 'ka'], ['நா', 'naa'], ['த', 'tha'], ['ண', 'na'], ['ழ', 'zha'],
    ['ஸ்ரீ', 'sree'], ['கண்', 'kan'], ['கை', 'kai'], ['ஓ…', 'o…'], ['hello', 'hello']]) {
    assert.equal(transliterate(ta), en, ta);
  }
});
