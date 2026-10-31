import test from 'node:test';
import assert from 'node:assert/strict';
import { createSong, setLyrics } from '../js/model.js';
import { exportSong, importSong } from '../js/export.js';

test('round trip with recording, new id', async () => {
  const s = createSong('a'); setLyrics(s, 'க');
  const rec = { name: 'c.m4a', type: 'audio/mp4', blob: new Blob([new Uint8Array([1, 2, 3])]) };
  const out = importSong(await exportSong(s, rec));
  assert.notEqual(out.song.id, s.id);
  assert.equal(out.song.lines[0].syllables[0].lyricTa, 'க');
  assert.equal(out.recording.name, 'c.m4a');
  assert.deepEqual([...new Uint8Array(await out.recording.blob.arrayBuffer())], [1, 2, 3]);
});

test('export without recording', async () => {
  const s = createSong('a');
  const out = importSong(await exportSong(s));
  assert.equal(out.recording, null);
});

test('rejects bad files', () => {
  assert.throws(() => importSong('not json'), /not a valid/i);
  assert.throws(() => importSong('{"app":"other"}'), /not a swara notes file/i);
  assert.throws(() => importSong('{"app":"swara-notes","formatVersion":9,"song":{"lines":[]}}'), /newer version/i);
  assert.throws(() => importSong('{"app":"swara-notes","formatVersion":1,"song":{}}'), /not a valid/i);
});
