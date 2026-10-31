import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSong, setLyrics, addNote, addJaru, deleteNote, mergeWithNext, splitSyllable,
  deleteSyllable, insertSyllableAfter, setSyllableEn, editSyllableText, noteCount, clearSwaras,
} from '../js/model.js';

test('setLyrics builds syllables with translit', () => {
  const s = createSong('t'); setLyrics(s, 'ஸ்ரீ கணநாத');
  assert.deepEqual(s.lines[0].syllables.map((x) => [x.lyricTa, x.lyricEn]),
    [['ஸ்ரீ', 'sree'], ['க', 'ka'], ['ண', 'na'], ['நா', 'naa'], ['த', 'tha']]);
  assert.equal(s.formatVersion, 1);
});

test('setLyrics refuses when swaras exist', () => {
  const s = createSong('t'); setLyrics(s, 'க'); addNote(s, s.lines[0].syllables[0].id, { swara: 'S' });
  assert.throws(() => setLyrics(s, 'ண'), /has swaras/);
  clearSwaras(s); assert.equal(noteCount(s), 0);
  setLyrics(s, 'ண'); assert.equal(s.lines[0].syllables[0].lyricTa, 'ண');
});

test('default scale fills variant, explicit overrides', () => {
  const s = createSong('t'); s.defaultScale = { R: 2 }; setLyrics(s, 'க');
  const id = s.lines[0].syllables[0].id;
  assert.equal(addNote(s, id, { swara: 'R' }).variant, 2);
  assert.equal(addNote(s, id, { swara: 'R', variant: 1 }).variant, 1);
  assert.equal(addNote(s, id, { swara: 'G' }).variant, 0);
});

test('jaru normalised and removed with note', () => {
  const s = createSong('t'); setLyrics(s, 'க ண');
  const [a, b] = s.lines[0].syllables;
  const n1 = addNote(s, a.id, { swara: 'G' }), n2 = addNote(s, b.id, { swara: 'M' });
  const j = addJaru(s, n2.id, n1.id);
  assert.deepEqual([j.from, j.to], [n1.id, n2.id]);
  assert.equal(addJaru(s, n1.id, n1.id), null);
  deleteNote(s, n2.id); assert.equal(s.jarus.length, 0);
});

test('merge concatenates notes, split keeps notes on first', () => {
  const s = createSong('t'); setLyrics(s, 'க ண');
  const [a, b] = s.lines[0].syllables;
  addNote(s, a.id, { swara: 'S' }); addNote(s, b.id, { swara: 'R' });
  mergeWithNext(s, a.id);
  assert.equal(s.lines[0].syllables.length, 1);
  assert.equal(s.lines[0].syllables[0].lyricTa, 'கண');
  assert.deepEqual(s.lines[0].syllables[0].notes.map((n) => n.swara), ['S', 'R']);
  const second = splitSyllable(s, a.id, 1);
  assert.equal(second.lyricTa, 'ண'); assert.equal(second.notes.length, 0);
  assert.equal(s.lines[0].syllables[0].lyricTa, 'க');
});

test('delete syllable drops jaru and empty line', () => {
  const s = createSong('t'); setLyrics(s, 'க\nண');
  const a = s.lines[0].syllables[0], b = s.lines[1].syllables[0];
  const n1 = addNote(s, a.id, { swara: 'S' }), n2 = addNote(s, b.id, { swara: 'R' });
  addJaru(s, n1.id, n2.id); deleteSyllable(s, b.id);
  assert.equal(s.jarus.length, 0); assert.equal(s.lines.length, 1);
});

test('empty column and override', () => {
  const s = createSong('t'); setLyrics(s, 'க');
  const e = insertSyllableAfter(s, s.lines[0].syllables[0].id);
  assert.equal(e.lyricTa, '');
  setSyllableEn(s, s.lines[0].syllables[0].id, 'gaa');
  editSyllableText(s, s.lines[0].syllables[0].id, 'கா');
  assert.equal(s.lines[0].syllables[0].lyricEn, 'gaa');
  setSyllableEn(s, s.lines[0].syllables[0].id, '');
  assert.equal(s.lines[0].syllables[0].lyricEn, 'kaa');
});

test('gamaka key validation', async () => {
  const { gamakaKeyError } = await import('../js/model.js');
  const s = createSong('t');
  assert.equal(gamakaKeyError(s.gamakaTable, 'k', null), '');
  assert.match(gamakaKeyError(s.gamakaTable, 'r', null), /swara/i);
  assert.match(gamakaKeyError(s.gamakaTable, "'", null), /already used/i);
  assert.match(gamakaKeyError(s.gamakaTable, 'v', null), /Pull after pluck/);
  assert.equal(gamakaKeyError(s.gamakaTable, 'v', 'pull'), '');
  assert.match(gamakaKeyError(s.gamakaTable, 'kk', null), /one character/i);
});

test('gamakaUsage counts notes carrying a gamaka', async () => {
  const { gamakaUsage, toggleGamaka } = await import('../js/model.js');
  const s = createSong('t'); setLyrics(s, 'க ண');
  const [a, b] = s.lines[0].syllables;
  toggleGamaka(s, addNote(s, a.id, { swara: 'S' }).id, 'kampita');
  toggleGamaka(s, addNote(s, b.id, { swara: 'R' }).id, 'kampita');
  assert.equal(gamakaUsage(s, 'kampita'), 2);
  assert.equal(gamakaUsage(s, 'pull'), 0);
});

test('setLyrics from english letters builds tamil syllables', () => {
  const s = createSong('t');
  setLyrics(s, 'naan amma', { from: 'en' });
  assert.deepEqual(s.lines[0].syllables.map((x) => [x.lyricTa, x.lyricEn]),
    [['நான்', 'naan'], ['அம்', 'am'], ['ம', 'ma']]);
  assert.deepEqual(s.lyricScripts, { ta: true, en: true });
});

test('setLyrics can hide the other script', () => {
  const s = createSong('t');
  setLyrics(s, 'naan', { from: 'en', other: false });
  assert.deepEqual(s.lyricScripts, { ta: false, en: true });
  setLyrics(s, 'க', { from: 'ta', other: false });
  assert.deepEqual(s.lyricScripts, { ta: true, en: false });
  setLyrics(s, 'க');
  assert.deepEqual(s.lyricScripts, { ta: true, en: true });
});

test('setLyrics keeps the pasted text for re-editing', () => {
  const s = createSong('t');
  setLyrics(s, 'kaaRRu\nvaazhkai', { from: 'en' });
  assert.equal(s.lyricsSource, 'kaaRRu\nvaazhkai');
  assert.equal(s.lyricsFrom, 'en');
});
