import { test } from 'node:test';
import assert from 'node:assert/strict';
import { songToText } from '../js/text-export.js';

const N = (x) => x.normalize('NFC');

const gamakaTable = [
  { id: 'kampita', name: 'Kampita', mark: '~' },
  { id: 'pull', name: 'Pull', mark: '↓' },
];

function song(extra = {}) {
  return {
    title: 'Sri Gananatha (demo)', raga: 'Malahari', tala: 'Rupakam',
    useTalaMarkers: false, gamakaTable, jarus: [],
    lines: [{ syllables: [
      { lyricTa: 'ஸ்ரீ', lyricEn: 'sree', notes: [
        { id: 'a', swara: 'S', octave: 0, gamakas: [] },
        { id: 'b', swara: 'R', variant: 1, octave: 0, gamakas: ['kampita'] },
      ] },
      { lyricTa: 'க', lyricEn: 'ka', notes: [
        { id: 'c', swara: 'S', octave: 1, gamakas: [] },
        { id: 'd', swara: 'P', octave: -1, gamakas: ['pull'] },
      ] },
      { lyricTa: '', lyricEn: '', notes: [{ id: 'e', swara: ',', octave: 0, gamakas: [] }] },
    ] }],
    ...extra,
  };
}

test('header has title, raga and tala', () => {
  const text = songToText(song(), { script: 'en' });
  assert.match(text, /^Sri Gananatha \(demo\)\nRaga: Malahari · Tala: Rupakam\n/);
});

test('english: syllable then swaras in brackets, variants, octave dots, marks', () => {
  const text = songToText(song(), { script: 'en' });
  assert.ok(text.includes(N('sree[S R1~] ka[Ṡ P̣↓] —[,]'), text), text);
});

test('tamil uses Tamil swaras and lyrics', () => {
  const text = songToText(song(), { script: 'ta' });
  assert.ok(text.includes(N('ஸ்ரீ[ஸ ரி1~] க[ஸ̇ ப̣↓]'), text), text);
});

test('both writes the Tamil line and then the English line', () => {
  const lines = songToText(song(), { script: 'both' }).split('\n');
  const i = lines.findIndex((l) => l.startsWith('ஸ்ரீ['));
  assert.ok(i > 0);
  assert.ok(lines[i + 1].startsWith('sree['));
});

test('hideVariants drops the digits', () => {
  assert.ok(songToText(song(), { script: 'en', hideVariants: true }).includes('sree[S R~]'));
});

test('jaru wraps from-note and to-note in ⌜ ⌝ even across syllables', () => {
  const text = songToText(song({ jarus: [{ from: 'b', to: 'c' }] }), { script: 'en' });
  assert.ok(text.includes(N('sree[S ⌜R1~] ka[Ṡ⌝ P̣↓]'), text), text);
});

test('two dots for two octaves, tala marks when enabled', () => {
  const s = song({ useTalaMarkers: true });
  s.lines[0].syllables[0].notes[0].octave = 2;
  s.lines[0].syllables[0].notes[1].octave = -2;
  s.lines[0].syllables[1].talaMark = '||';
  const text = songToText(s, { script: 'en' });
  assert.ok(text.includes(N('sree[S̈ R̤1~] ka[Ṡ P̣↓] || —[,]'), text), text);
});

test('legend lists the gamaka marks and jaru brackets', () => {
  const text = songToText(song(), { script: 'en' });
  assert.match(text, /⌜ … ⌝ = jaru/);
  assert.match(text, /~ = Kampita/);
  assert.match(text, /↓ = Pull/);
});
