import test from 'node:test';
import assert from 'node:assert/strict';
import { createSong } from '../js/model.js';
import { openStore, getSetting, setSetting } from '../js/storage.js';

// Node has no indexedDB, so this exercises the memory fallback path.
test('memory fallback round-trips', async () => {
  const st = await openStore(); assert.equal(st.persistent, false);
  const s = createSong('a'); await st.putSong(s);
  assert.equal((await st.listSongs())[0].id, s.id);
  await st.putRecording(s.id, Object.assign(new Blob([new Uint8Array([1])]), { name: 'x.m4a' }));
  assert.equal((await st.getRecording(s.id)).name, 'x.m4a');
  await st.deleteSong(s.id);
  assert.equal((await st.listSongs()).length, 0);
  assert.equal(await st.getRecording(s.id), null);
});

test('settings survive missing localStorage', () => {
  assert.equal(getSetting('script', 'both'), 'both');
  setSetting('script', 'ta'); // must not throw
});
