// Boot and hash routing: #/ (songs), #/edit/<id>, #/practice/<id>.

import { openStore } from './storage.js';
import { createSong, setLyrics, addNote, addJaru, toggleGamaka, insertLineAfter } from './model.js';
import { parseScale } from './swara.js';
import { mountPractice } from './screens/practice.js';
import { mountEditor, mountSongPlayer } from './screens/editor.js';
import { mountList } from './screens/list.js';
import { openSettings } from './screens/settings.js';

const root = document.getElementById('app');
const storePromise = openStore();

// Demo: the opening of Purandara Dasa's geetham "Sri Gananatha" (public
// domain) in Malahari. Swaras are illustrative, to show every kind of mark.
export function buildDemoSong() {
  const song = createSong('Sri Gananatha (demo)');
  song.id = 'demo';
  song.raga = 'Malahari';
  song.defaultScale = parseScale('R1 G3 M1 D1');
  setLyrics(song, 'ஸ்ரீ கணநாத');
  const [sri, ga, na, naa, tha] = song.lines[0].syllables;
  addNote(song, sri.id, { swara: 'M' });
  addNote(song, sri.id, { swara: 'P' });
  const d = addNote(song, ga.id, { swara: 'D' });
  const s = addNote(song, ga.id, { swara: 'S', octave: 1 });
  addJaru(song, d.id, s.id);
  const s2 = addNote(song, na.id, { swara: 'S', octave: 1 });
  toggleGamaka(song, s2.id, 'kampita');
  addNote(song, na.id, { swara: 'D' });
  const p = addNote(song, naa.id, { swara: 'P' });
  toggleGamaka(song, p.id, 'pull');
  const m = addNote(song, naa.id, { swara: 'M' });
  toggleGamaka(song, m.id, 'sphurita');
  const g = addNote(song, tha.id, { swara: 'G' });
  const r = addNote(song, tha.id, { swara: 'R' });
  addJaru(song, g.id, r.id);
  addNote(song, tha.id, { swara: 'S' });
  // An interlude line showing two-dot octaves and a jaru across columns.
  const line = insertLineAfter(song, song.lines[0].id);
  const col = line.syllables[0];
  const hi = addNote(song, col.id, { swara: 'S', octave: 2 });
  addNote(song, col.id, { swara: 'P' });
  const lo = addNote(song, col.id, { swara: 'D', octave: -1 });
  addNote(song, col.id, { swara: 'P', octave: -2 });
  addJaru(song, hi.id, lo.id);
  return song;
}

let cleanup = () => {};

async function route() {
  const store = await storePromise;
  cleanup();
  cleanup = () => {};
  const banner = store.persistent ? null : Object.assign(document.createElement('div'), {
    className: 'banner',
    textContent: 'This browser is not letting the app save. Your work will be lost when you close the tab — use Export to keep it.',
  });
  const [, screen, id] = location.hash.replace(/^#\/?/, '/').split('/');

  if ((screen === 'practice' || screen === 'edit') && id === 'demo' && !(await store.getSong('demo'))) {
    await store.putSong(buildDemoSong());
  }

  const view = document.createElement('div');
  root.replaceChildren(...(banner ? [banner] : []), view);
  if (screen === 'practice' && id) {
    cleanup = await mountPractice(view, store, id, {
      mountPlayer: (slot, song) => mountSongPlayer(slot, store, song, () => store.putSong(song)),
    });
  } else if (screen === 'edit' && id) {
    cleanup = await mountEditor(view, store, id, { openSettings });
  } else {
    cleanup = await mountList(view, store);
  }
}

window.addEventListener('hashchange', route);
route();
