import test from 'node:test';
import assert from 'node:assert/strict';
import { createSong, setLyrics } from '../js/model.js';
import { createEditorState, applyKey } from '../js/editor-keys.js';

const setup = () => { const s = createSong('t'); setLyrics(s, 'க ண\nநா'); return createEditorState(s); };
const keys = (st, str) => [...str].forEach((k) => applyKey(st, { key: k }));

test('typing swaras with variant, octave, gamaka', () => {
  const st = setup(); keys(st, "r2'sv");
  const notes = st.song.lines[0].syllables[0].notes;
  assert.deepEqual(notes.map((n) => [n.swara, n.variant, n.octave]), [['R', 2, 0], ['S', 0, 1]]);
  assert.deepEqual(notes[1].gamakas, ['pull']);
});

test('two-dot octaves', () => {
  const st = setup(); keys(st, "''s..p");
  assert.deepEqual(st.song.lines[0].syllables[0].notes.map((n) => n.octave), [2, -2]);
});

test('jaru across syllables', () => {
  const st = setup(); keys(st, 'g/'); applyKey(st, { key: ' ' }); keys(st, 'm');
  assert.equal(st.song.jarus.length, 1);
  assert.equal(st.pendingJaruFrom, null);
});

test('navigation wraps lines and Enter jumps', () => {
  const st = setup(); applyKey(st, { key: 'Tab' }); applyKey(st, { key: 'Tab' });
  assert.deepEqual(st.cursor, { lineIdx: 1, sylIdx: 0 });
  applyKey(st, { key: 'Tab', shift: true }); assert.deepEqual(st.cursor, { lineIdx: 0, sylIdx: 1 });
  applyKey(st, { key: 'Enter' }); assert.deepEqual(st.cursor, { lineIdx: 1, sylIdx: 0 });
});

test('invalid variant ignored, unknown key unhandled', () => {
  const st = setup(); keys(st, 'p2');
  assert.equal(st.song.lines[0].syllables[0].notes[0].variant, 0);
  assert.equal(applyKey(st, { key: 'x' }).handled, false);
});

test('ctrl+enter inserts empty column', () => {
  const st = setup(); applyKey(st, { key: 'Enter', ctrl: true });
  assert.equal(st.song.lines[0].syllables[1].lyricTa, '');
  assert.deepEqual(st.cursor, { lineIdx: 0, sylIdx: 1 });
});

test('backspace removes last note, ctrl+backspace removes syllable', () => {
  const st = setup(); keys(st, 'sr'); applyKey(st, { key: 'Backspace' });
  assert.deepEqual(st.song.lines[0].syllables[0].notes.map((n) => n.swara), ['S']);
  applyKey(st, { key: 'Backspace', ctrl: true });
  assert.equal(st.song.lines[0].syllables[0].lyricTa, 'ண');
});
