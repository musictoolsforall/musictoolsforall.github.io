import test from 'node:test';
import assert from 'node:assert/strict';
import { toTamil } from '../js/translit-ta.js';

test('english letters to tamil script', () => {
  for (const [en, ta] of [
    ['amma', 'அம்ம'],
    ['naan', 'நான்'],
    ['vaazhkai', 'வாழ்கை'],
    ['kaNNe', 'கண்ணெ'],
    ['Paadu', 'பாடு'],
    ['santhosham', 'சந்தொஷம்'],
    ['Naan', 'நான்'],
    ['kaaRRu', 'காற்று'],
    ['ilai', 'இலை'],
    ['peesaamaleeE', 'பீசாமலீஏ'],
  ]) assert.equal(toTamil(en), ta, en);
});

test('keeps spaces, lines, digits and punctuation', () => {
  assert.equal(toTamil('naan 2!\namma'), 'நான் 2!\nஅம்ம');
});
