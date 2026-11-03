import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSong, setLyrics, addNote, addJaru, deleteNote, mergeWithNext, splitSyllable,
  deleteSyllable, insertSyllableAfter, setSyllableEn, editSyllableText, noteCount, clearSwaras,
  insertLineAfter, lyricsChange, copyNotes, pasteNotes, notesInCells, toggleGamaka,
} from '../js/model.js';

test('setLyrics builds syllables with translit', () => {
  const s = createSong('t'); setLyrics(s, 'ஸ்ரீ கணநாத');
  assert.deepEqual(s.lines[0].syllables.map((x) => [x.lyricTa, x.lyricEn]),
    [['ஸ்ரீ', 'sree'], ['க', 'ka'], ['ண', 'na'], ['நா', 'naa'], ['த', 'tha']]);
  assert.equal(s.formatVersion, 1);
});

test('clearSwaras removes every note', () => {
  const s = createSong('t'); setLyrics(s, 'க'); addNote(s, s.lines[0].syllables[0].id, { swara: 'S' });
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

// --- re-pasting lyrics keeps swaras on unchanged lines ---
const sylId = (s, l, i) => s.lines[l].syllables[i].id;

test('re-paste keeps swaras on unchanged lines and drops them on changed ones', () => {
  const s = createSong('t');
  setLyrics(s, 'க ண\nநா த\nஸ்ரீ');
  addNote(s, sylId(s, 0, 0), { swara: 'S' });
  addNote(s, sylId(s, 1, 0), { swara: 'R' });
  addNote(s, sylId(s, 2, 0), { swara: 'G' });
  const kept = s.lines[2];
  setLyrics(s, 'க ண\nநா ம\nஸ்ரீ');
  assert.equal(s.lines.length, 3);
  assert.deepEqual(s.lines[0].syllables[0].notes.map((n) => n.swara), ['S']);
  assert.deepEqual(s.lines[1].syllables.map((x) => x.notes.length), [0, 0]);
  assert.equal(s.lines[1].syllables[1].lyricTa, 'ம');
  assert.equal(s.lines[2], kept);
  assert.deepEqual(s.lines[2].syllables[0].notes.map((n) => n.swara), ['G']);
});

test('re-paste handles inserted and removed lines', () => {
  const s = createSong('t');
  setLyrics(s, 'க\nண\nநா');
  for (let i = 0; i < 3; i++) addNote(s, sylId(s, i, 0), { swara: 'S' });
  setLyrics(s, 'புது\nக\nநா');
  assert.deepEqual(s.lines.map((l) => l.syllables[0].lyricTa), ['பு', 'க', 'நா']);
  assert.deepEqual(s.lines.map((l) => l.syllables[0].notes.length), [0, 1, 1]);
});

test('lyricsChange reports how many swaras would be lost, without changing the song', () => {
  const s = createSong('t');
  setLyrics(s, 'க\nண');
  addNote(s, sylId(s, 0, 0), { swara: 'S' });
  addNote(s, sylId(s, 1, 0), { swara: 'R' });
  addNote(s, sylId(s, 1, 0), { swara: 'G' });
  const before = JSON.stringify(s);
  assert.deepEqual(lyricsChange(s, 'க\nம'), { lostNotes: 2, changedLines: 1 });
  assert.deepEqual(lyricsChange(s, 'க\nண'), { lostNotes: 0, changedLines: 0 });
  assert.equal(JSON.stringify(s), before);
});

test('jarus touching a removed note are dropped, others kept', () => {
  const s = createSong('t');
  setLyrics(s, 'க\nண\nநா');
  const a = addNote(s, sylId(s, 0, 0), { swara: 'S' });
  const b = addNote(s, sylId(s, 0, 0), { swara: 'R' });
  const c = addNote(s, sylId(s, 1, 0), { swara: 'G' });
  addJaru(s, a.id, b.id);
  addJaru(s, b.id, c.id);
  setLyrics(s, 'க\nம\nநா');
  assert.deepEqual(s.jarus.map((j) => [j.from, j.to]), [[a.id, b.id]]);
});

test('a line edited by hand (double-click) still matches its pasted text', () => {
  const s = createSong('t');
  setLyrics(s, 'kaaRRu', { from: 'en' });
  addNote(s, sylId(s, 0, 0), { swara: 'S' });
  editSyllableText(s, sylId(s, 0, 0), 'கா');
  setLyrics(s, 'kaaRRu\nputhu', { from: 'en' });
  assert.equal(s.lines[0].syllables[0].notes.length, 1);
  assert.equal(s.lines.length, 2);
});

test('interlude lines (no words) stay in place', () => {
  const s = createSong('t');
  setLyrics(s, 'க\nண');
  insertLineAfter(s, s.lines[0].id);
  addNote(s, s.lines[1].syllables[0].id, { swara: 'P' });
  setLyrics(s, 'க\nம');
  assert.equal(s.lines.length, 3);
  assert.equal(s.lines[1].syllables[0].notes[0].swara, 'P');
  assert.equal(s.lines[2].syllables[0].lyricTa, 'ம');
});

test('a changed line stays in its place, before a following interlude', () => {
  const s = createSong('t');
  setLyrics(s, 'க');
  insertLineAfter(s, s.lines[0].id);
  setLyrics(s, 'ம\nபுது');
  assert.deepEqual(s.lines.map((l) => l.syllables.map((x) => x.lyricTa).join('')), ['ம', '', 'புது']);
});

// --- copy / paste swaras ---
test('copy one cell and paste into another, with fresh ids', () => {
  const s = createSong('t'); setLyrics(s, 'க ண நா');
  const [a, b] = s.lines[0].syllables;
  const n1 = addNote(s, a.id, { swara: 'R', variant: 2, octave: 1 });
  toggleGamaka(s, n1.id, 'kampita');
  addNote(s, a.id, { swara: 'G' });
  const clip = copyNotes(s, [a.id]);
  assert.deepEqual(pasteNotes(s, b.id, clip), { pasted: 1, skipped: 0, lastSylId: b.id });
  assert.deepEqual(b.notes.map((n) => [n.swara, n.variant, n.octave, n.gamakas]), [['R', 2, 1, ['kampita']], ['G', 0, 0, []]]);
  assert.notEqual(b.notes[0].id, a.notes[0].id);
  b.notes[0].gamakas.push('x');
  assert.deepEqual(a.notes[0].gamakas, ['kampita']); // a real copy, not shared
});

test('pasting replaces what was there and drops its jarus', () => {
  const s = createSong('t'); setLyrics(s, 'க ண');
  const [a, b] = s.lines[0].syllables;
  addNote(s, a.id, { swara: 'S' });
  const x = addNote(s, b.id, { swara: 'P' }); const y = addNote(s, b.id, { swara: 'D' });
  addJaru(s, x.id, y.id);
  pasteNotes(s, b.id, copyNotes(s, [a.id]));
  assert.deepEqual(b.notes.map((n) => n.swara), ['S']);
  assert.equal(s.jarus.length, 0);
});

test('copy a line: jarus inside the copied cells come along', () => {
  const s = createSong('t'); setLyrics(s, 'க ண\nநா த');
  const [a, b] = s.lines[0].syllables;
  const p = addNote(s, a.id, { swara: 'P' }); const d = addNote(s, b.id, { swara: 'D' });
  addJaru(s, p.id, d.id);
  const clip = copyNotes(s, s.lines[0].syllables.map((x) => x.id));
  const res = pasteNotes(s, s.lines[1].syllables[0].id, clip);
  assert.deepEqual(res.pasted, 2);
  const [c, e] = s.lines[1].syllables;
  assert.equal(s.jarus.length, 2);
  assert.deepEqual([s.jarus[1].from, s.jarus[1].to], [c.notes[0].id, e.notes[0].id]);
});

test('paste stops at the end of the line and says how many cells did not fit', () => {
  const s = createSong('t'); setLyrics(s, 'க ண நா\nத');
  for (const x of s.lines[0].syllables) addNote(s, x.id, { swara: 'S' });
  const res = pasteNotes(s, s.lines[1].syllables[0].id, copyNotes(s, s.lines[0].syllables.map((x) => x.id)));
  assert.deepEqual([res.pasted, res.skipped], [1, 2]);
});

test('notesInCells counts swaras a paste would overwrite', () => {
  const s = createSong('t'); setLyrics(s, 'க ண நா');
  const [a, b, c] = s.lines[0].syllables;
  addNote(s, a.id, { swara: 'S' }); addNote(s, a.id, { swara: 'R' });
  addNote(s, c.id, { swara: 'G' });
  const clip = copyNotes(s, [a.id, b.id]);
  assert.equal(notesInCells(s, b.id, clip), 1);  // b empty, c has 1
  assert.equal(notesInCells(s, a.id, clip), 2);
});
