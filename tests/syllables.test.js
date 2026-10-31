import test from 'node:test';
import assert from 'node:assert/strict';
import { splitLyrics } from '../js/syllables.js';

test('basic split', () => {
  assert.deepEqual(splitLyrics('ஸ்ரீ கணநாத'), [['ஸ்ரீ', 'க', 'ண', 'நா', 'த']]);
});

test('pulli joins previous', () => {
  assert.deepEqual(splitLyrics('கண்'), [['கண்']]);
});

test('lines and blanks', () => {
  assert.deepEqual(splitLyrics('க ண\n\n  நா  '), [['க', 'ண'], ['நா']]);
});

test('mixed script and punctuation', () => {
  assert.deepEqual(splitLyrics('ஓ… hello 2'), [['ஓ…', 'hello', '2']]);
});
