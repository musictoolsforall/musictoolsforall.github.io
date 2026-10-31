# Swara Notes (Carnatic Notation Editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web app (GitHub Pages) for typing swaras with gamaka marks above Tamil lyric syllables while looping a local class recording, with a practice view to play from.

**Architecture:** Plain ES modules, no build step. Pure-logic modules (swara, syllables, translit, model, editor-keys, export, jaru geometry) are unit-tested with Node's built-in runner. DOM modules (render, player, screens) sit on top and are verified in a real browser. Data lives in IndexedDB. Settings live in localStorage. Nothing leaves the device.

**Tech Stack:** HTML, CSS, vanilla JS (ES modules), `node --test` (Node ≥ 20, v24 installed), Google Font "Noto Sans Tamil", IndexedDB, HTMLAudioElement.

**Spec:** `docs/superpowers/specs/2026-10-31-carnatic-notation-editor-design.md`

## Global Constraints

- Static files only. Must run from GitHub Pages under a sub-path (`/<repo>/`), so all URLs are relative and there's no server code.
- No build step, no npm dependencies. `package.json` exists only for `"type": "module"` and the `test` script.
- Recordings and lyrics never leave the device. No song lyrics or recordings anywhere in the repo, including tests and demos. Test/demo text is the public-domain geetham "ஸ்ரீ கணநாத" (Sri Gananatha) only.
- Swaras in Tamil: S ஸ, R ரி, G க, M ம, P ப, D த, N நி. English: S R G M P D N. Rest: `,`.
- Variants: R, G, D, N ∈ {1,2,3}; M ∈ {1,2}; S, P none. Shown as subscript (ரி₂ / R₂).
- Octave level: -2..+2, shown as 1 or 2 dots above (tara / ati-tara) or below (mandra / anumandra) the swara, in both scripts.
- Gamaka marks are all **above** the note. Jaru = **flat straight line above the notes** from the start note to the end note. Defaults: kampita `~`, pull-after-pluck `↓`, sphurita `ˆ` (editable table).
- Script view: `'ta' | 'en' | 'both'`, applied to swaras and lyrics. With `'both'`, marks sit above the top (Tamil) swara row only.
- Saved songs carry `formatVersion: 1`.
- Every localStorage/IndexedDB access is wrapped so the app still works if storage throws.

## Review Focus

1. **Lyrics that aren't pure Tamil** (English words, digits, punctuation, "ஓ…" with ellipses, common in film songs). Each non-Tamil run becomes its own syllable and transliterates to itself. Nothing is dropped. → test in Task 2 and Task 3.
2. **A jaru crossing a wrapped row on a narrow screen.** It's drawn as two segments (end of the first row, start of the next) and redrawn on resize. → test in Task 7 (`jaruSegments`).
3. **Importing a corrupt or foreign file.** Show a clear error and leave existing songs untouched. → test in Task 6.
4. **Deleting or merging around jarus.** Deleting a note or syllable that a jaru starts or ends on removes that jaru. A jaru entered "backwards" is normalised to document order. → test in Task 4.
5. **No storage available** (private window, blocked site data). The app runs with in-memory storage and shows a warning that work won't be saved. → test in Task 6.

---

## File Structure

```
index.html                 app shell, loads js/app.js
css/app.css                layout, notation, theme tokens (light/dark)
js/swara.js                swara tables, display, scale parsing
js/syllables.js            Tamil text → lines → syllables
js/translit.js             Tamil syllable → readable English
js/model.js                Song data + editing operations (pure)
js/editor-keys.js          keystroke → state transition (pure)
js/jaru-geom.js            jaru line segments from note boxes (pure)
js/storage.js              IndexedDB + memory fallback, settings
js/export.js               export/import serialisation
js/render.js               notation DOM rendering + jaru overlay
js/player.js               audio player: loop, speed, shortcuts
js/screens/list.js         song list screen
js/screens/editor.js       editor screen (Layout A)
js/screens/practice.js     practice screen
js/screens/settings.js     gamaka table + scale + script settings panel
js/app.js                  hash routing, boot
tests/*.test.js            node --test unit tests
package.json  .gitignore  README.md
```

---

### Task 1: Project scaffold + swara module

**Files:**
- Create: `package.json`, `.gitignore`, `js/swara.js`, `tests/swara.test.js`

**Interfaces:**
- Produces (`js/swara.js`):
  - `SWARAS: readonly ['S','R','G','M','P','D','N']`
  - `TAMIL: { S:'ஸ', R:'ரி', G:'க', M:'ம', P:'ப', D:'த', N:'நி', ',':',' }`
  - `maxVariant(swara: string) → 0|2|3` (S,P,',' → 0; M → 2; R,G,D,N → 3)
  - `isValidVariant(swara, v: number) → boolean`
  - `swaraDisplay(note: {swara, variant?, octave}, script: 'ta'|'en') → { base: string, sub: string, octave: -2|-1|0|1|2 }`. `sub` is the subscript digit ('₁₂₃') or ''.
  - `parseScale(str: string) → { R?:1|2|3, G?:…, M?:1|2, D?:…, N?:… }`. Accepts "R2 G3 M1 D2 N3", case-insensitive, any whitespace/commas. Ignores invalid tokens.
  - `formatScale(scale) → string` ("R2 G3 M1 D2 N3", in SWARAS order)

- [ ] **Step 1: Scaffold**

`git init -b main`. `package.json`: `{"name":"swara-notes","private":true,"type":"module","scripts":{"test":"node --test tests/"}}`. `.gitignore`: `.superpowers/`, `.remember/`, `node_modules/`.

- [ ] **Step 2: Write failing tests** in `tests/swara.test.js` (using `node:test` + `node:assert/strict`):

```js
test('tamil display with variant and octave', () => {
  assert.deepEqual(swaraDisplay({swara:'R', variant:2, octave:0}, 'ta'), {base:'ரி', sub:'₂', octave:0});
  assert.deepEqual(swaraDisplay({swara:'S', octave:1}, 'en'), {base:'S', sub:'', octave:1});
  assert.deepEqual(swaraDisplay({swara:',', octave:0}, 'ta'), {base:',', sub:'', octave:0});
  assert.deepEqual(swaraDisplay({swara:'S', octave:2}, 'ta'), {base:'ஸ', sub:'', octave:2});
});
test('variant limits', () => {
  assert.equal(isValidVariant('M', 2), true);
  assert.equal(isValidVariant('M', 3), false);
  assert.equal(isValidVariant('P', 1), false);
  assert.equal(isValidVariant('N', 3), true);
});
test('parseScale', () => {
  assert.deepEqual(parseScale('r2, G3 m1 D2 N3'), {R:2,G:3,M:1,D:2,N:3});
  assert.deepEqual(parseScale('M3 P1 X2 R1'), {R:1});
  assert.equal(formatScale({N:3, R:2}), 'R2 N3');
});
```

- [ ] **Step 3: Run** `npm test`. Expected: FAIL (module not found).
- [ ] **Step 4: Implement `js/swara.js`** per Interfaces.
- [ ] **Step 5: Run** `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: scaffold and swara module"`

---

### Task 2: Tamil syllable splitting

**Files:**
- Create: `js/syllables.js`, `tests/syllables.test.js`

**Interfaces:**
- Produces: `splitLyrics(text: string) → string[][]`. Lines (split on `\n`, trimmed, blank lines dropped), each an array of syllable strings.

Algorithm (not determined by the tests alone):
1. Split each line into words on whitespace.
2. Within a word, scan Tamil units: an independent vowel (U+0B85–0B94), or a consonant (U+0B95–0BB9) plus any following dependent vowel signs/pulli (U+0BBE–0BCD, U+0BD7), or ஃ (U+0B83).
3. A unit ending in pulli (U+0BCD) attaches to the **previous** syllable in the same word. At the start of a word it attaches to the **next** unit (so ஸ்ரீ is one syllable).
4. A run of non-Tamil characters (Latin, digits, punctuation) is one syllable. Exception: punctuation directly after a Tamil syllable (`,` `.` `!` `?` `…`) attaches to that syllable.

- [ ] **Step 1: Write failing tests**

```js
test('basic split', () => {
  assert.deepEqual(splitLyrics('ஸ்ரீ கணநாத'), [['ஸ்ரீ','க','ண','நா','த']]);
});
test('pulli joins previous', () => {
  assert.deepEqual(splitLyrics('கண்'), [['கண்']]);
});
test('lines and blanks', () => {
  assert.deepEqual(splitLyrics('க ண\n\n  நா  '), [['க','ண'],['நா']]);
});
test('mixed script and punctuation', () => {
  assert.deepEqual(splitLyrics('ஓ… hello 2'), [['ஓ…','hello','2']]);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `splitLyrics` per algorithm.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: tamil syllable splitting`

---

### Task 3: Transliteration

**Files:**
- Create: `js/translit.js`, `tests/translit.test.js`

**Interfaces:**
- Produces: `transliterate(syllable: string) → string`.

Table (readable, lossy by design): consonants க k, ங ng, ச ch, ஞ nj, ட t, ண n, த th, ந n, ப p, ம m, ய y, ர r, ல l, வ v, ழ zh, ள l, ற r, ன n, ஜ j, ஷ sh, ஸ s, ஹ h. Vowels/signs: அ/inherent a, ஆ/ா aa, இ/ி i, ஈ/ீ ee, உ/ு u, ஊ/ூ oo, எ/ெ e, ஏ/ே ae, ஐ/ை ai, ஒ/ொ o, ஓ/ோ o, ஔ/ௌ au; pulli ் = no vowel; ஃ = "h". Non-Tamil characters pass through unchanged.

- [ ] **Step 1: Write failing tests**

```js
test('translit', () => {
  for (const [ta, en] of [['க','ka'],['நா','naa'],['த','tha'],['ண','na'],['ழ','zha'],['ஸ்ரீ','sree'],['கண்','kan'],['கை','kai'],['ஓ…','o…'],['hello','hello']])
    assert.equal(transliterate(ta), en);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `transliterate`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: tamil transliteration`

---

### Task 4: Song model and editing operations

**Files:**
- Create: `js/model.js`, `tests/model.test.js`

**Interfaces:**
- Consumes: `splitLyrics` (Task 2), `transliterate` (Task 3), `isValidVariant` (Task 1).
- Produces (all operations mutate `song` in place and update `song.updatedAt`; ids via `crypto.randomUUID()`):
  - Types:
    ```
    Song { id, formatVersion: 1, title, raga: '', tala: '', useTalaMarkers: false,
           defaultScale: {}, lines: Line[], jarus: Jaru[], gamakaTable: Gamaka[],
           recordingName: '' , updatedAt: number }
    Line { id, syllables: Syllable[] }
    Syllable { id, lyricTa: string, lyricEn: string, lyricEnOverride: boolean,
               notes: Note[], talaMark: '' | '|' | '||' }
    Note { id, swara: 'S'|'R'|'G'|'M'|'P'|'D'|'N'|',', variant: 0|1|2|3, octave: -2|-1|0|1|2, gamakas: string[] }
    Jaru { id, from: noteId, to: noteId }
    Gamaka { id, name, mark, key }
    ```
  - `DEFAULT_GAMAKAS: Gamaka[]` = `[{id:'kampita',name:'Kampita',mark:'~',key:'~'}, {id:'pull',name:'Pull after pluck',mark:'↓',key:'v'}, {id:'sphurita',name:'Sphurita',mark:'ˆ',key:'^'}]`
  - `createSong(title: string) → Song`
  - `setLyrics(song, text: string) → void`. Builds lines from `splitLyrics`. Throws `Error('song has swaras')` if any note exists (UI warns and clears first).
  - `clearSwaras(song)`, `noteCount(song) → number`
  - `allNotes(song) → Note[]` (in document order), `findSyllable(song, sylId) → {line, lineIdx, syl, sylIdx} | null`
  - `addNote(song, sylId, {swara, variant?, octave?}) → Note`. If `variant` is omitted, it takes `song.defaultScale[swara] ?? 0`.
  - `setVariant(song, noteId, v)` (ignored if invalid), `toggleGamaka(song, noteId, gamakaId)`
  - `deleteNote(song, noteId)` removes any jaru touching it
  - `addJaru(song, fromId, toId) → Jaru | null` normalises to document order; null if same note
  - `editSyllableText(song, sylId, text)` updates `lyricTa`, recomputes `lyricEn` unless `lyricEnOverride`
  - `setSyllableEn(song, sylId, en)` sets override (empty string clears override and recomputes)
  - `splitSyllable(song, sylId, at: number) → Syllable` (new second part; notes stay on first)
  - `mergeWithNext(song, sylId)` (within the line; notes concatenate)
  - `insertSyllableAfter(song, sylId) → Syllable` (empty lyric), `insertLineAfter(song, lineId) → Line` (one empty syllable)
  - `deleteSyllable(song, sylId)` removes its notes' jarus; deletes the line if it becomes empty
  - `setTalaMark(song, sylId, mark)`

- [ ] **Step 1: Write failing tests**

```js
test('setLyrics builds syllables with translit', () => {
  const s = createSong('t'); setLyrics(s, 'ஸ்ரீ கணநாத');
  assert.deepEqual(s.lines[0].syllables.map(x => [x.lyricTa, x.lyricEn]),
    [['ஸ்ரீ','sree'],['க','ka'],['ண','na'],['நா','naa'],['த','tha']]);
  assert.equal(s.formatVersion, 1);
});
test('setLyrics refuses when swaras exist', () => {
  const s = createSong('t'); setLyrics(s, 'க'); addNote(s, s.lines[0].syllables[0].id, {swara:'S'});
  assert.throws(() => setLyrics(s, 'ண'), /has swaras/);
});
test('default scale fills variant, explicit overrides', () => {
  const s = createSong('t'); s.defaultScale = {R:2}; setLyrics(s, 'க');
  const id = s.lines[0].syllables[0].id;
  assert.equal(addNote(s, id, {swara:'R'}).variant, 2);
  assert.equal(addNote(s, id, {swara:'R', variant:1}).variant, 1);
  assert.equal(addNote(s, id, {swara:'G'}).variant, 0);
});
test('jaru normalised and removed with note', () => {
  const s = createSong('t'); setLyrics(s, 'க ண');
  const [a, b] = s.lines[0].syllables;
  const n1 = addNote(s, a.id, {swara:'G'}), n2 = addNote(s, b.id, {swara:'M'});
  const j = addJaru(s, n2.id, n1.id);
  assert.deepEqual([j.from, j.to], [n1.id, n2.id]);
  assert.equal(addJaru(s, n1.id, n1.id), null);
  deleteNote(s, n2.id); assert.equal(s.jarus.length, 0);
});
test('merge concatenates notes, split keeps notes on first', () => {
  const s = createSong('t'); setLyrics(s, 'க ண');
  const [a, b] = s.lines[0].syllables;
  addNote(s, a.id, {swara:'S'}); addNote(s, b.id, {swara:'R'});
  mergeWithNext(s, a.id);
  assert.equal(s.lines[0].syllables.length, 1);
  assert.equal(s.lines[0].syllables[0].lyricTa, 'கண');
  assert.deepEqual(s.lines[0].syllables[0].notes.map(n => n.swara), ['S','R']);
  const second = splitSyllable(s, a.id, 1);
  assert.equal(second.lyricTa, 'ண'); assert.equal(second.notes.length, 0);
});
test('delete syllable drops jaru and empty line', () => {
  const s = createSong('t'); setLyrics(s, 'க\nண');
  const a = s.lines[0].syllables[0], b = s.lines[1].syllables[0];
  const n1 = addNote(s, a.id, {swara:'S'}), n2 = addNote(s, b.id, {swara:'R'});
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
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `js/model.js` per Interfaces.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: song model and editing ops`

---

### Task 5: Editor keystroke state machine

**Files:**
- Create: `js/editor-keys.js`, `tests/editor-keys.test.js`

**Interfaces:**
- Consumes: model ops (Task 4).
- Produces:
  - `EditorState { song, cursor: { lineIdx, sylIdx }, pendingOctave: -2|-1|0|1|2, pendingJaruFrom: noteId|null, lastNoteId: noteId|null }`
  - `createEditorState(song) → EditorState`
  - `applyKey(state, ev: { key: string, ctrl?: boolean, shift?: boolean, alt?: boolean }) → { handled: boolean }`. Mutates `state`.

Key map:
- `s r g m p d n` (case-insensitive, no modifiers): add a note to the cursor syllable with `octave: pendingOctave`, then reset `pendingOctave`. If `pendingJaruFrom` is set, `addJaru(pendingJaruFrom, newNote)` and clear it. Set `lastNoteId`.
- `,`: add a rest.
- `1` `2` `3`: `setVariant(lastNoteId, n)`.
- `'` → `pendingOctave = min(2, max(0, pendingOctave) + 1)`; `.` → `pendingOctave = max(-2, min(0, pendingOctave) - 1)`. So `''s` gives octave 2, and `'.` cancels back toward the other direction.
- Any `gamakaTable[i].key`: toggle that gamaka on `lastNoteId`.
- `/`: `pendingJaruFrom = lastNoteId`.
- `Backspace` (no ctrl): delete the last note of the cursor syllable.
- `Space`/`Tab`: next syllable (wrapping to the next line). `Shift+Tab`: previous. `Enter`: first syllable of the next line. Moving resets `lastNoteId` to the last note of the new syllable (or null).
- `Ctrl+Enter`: `insertSyllableAfter`, move to it. `Ctrl+Shift+Enter`: `insertLineAfter`, move to it.
- `Ctrl+Backspace`: `deleteSyllable` at the cursor and clamp the cursor.
- `Alt+M`: `mergeWithNext` at the cursor.
- `|`: cycle `talaMark` '' → '|' → '||' → '' (only when `song.useTalaMarkers`).
- Anything else: `{handled: false}`.

- [ ] **Step 1: Write failing tests**

```js
const setup = () => { const s = createSong('t'); setLyrics(s, 'க ண\nநா'); return createEditorState(s); };
const keys = (st, str) => [...str].forEach(k => applyKey(st, {key:k}));
test('typing swaras with variant, octave, gamaka', () => {
  const st = setup(); keys(st, "r2'sv");
  const notes = st.song.lines[0].syllables[0].notes;
  assert.deepEqual(notes.map(n => [n.swara, n.variant, n.octave]), [['R',2,0],['S',0,1]]);
  assert.deepEqual(notes[1].gamakas, ['pull']);
});
test('two-dot octaves', () => {
  const st = setup(); keys(st, "''s..p");
  assert.deepEqual(st.song.lines[0].syllables[0].notes.map(n => n.octave), [2, -2]);
});
test('jaru across syllables', () => {
  const st = setup(); keys(st, 'g/'); applyKey(st, {key:' '}); keys(st, 'm');
  assert.equal(st.song.jarus.length, 1);
  assert.equal(st.pendingJaruFrom, null);
});
test('navigation wraps lines and Enter jumps', () => {
  const st = setup(); applyKey(st, {key:'Tab'}); applyKey(st, {key:'Tab'});
  assert.deepEqual(st.cursor, {lineIdx:1, sylIdx:0});
  applyKey(st, {key:'Tab', shift:true}); assert.deepEqual(st.cursor, {lineIdx:0, sylIdx:1});
});
test('invalid variant ignored, unknown key unhandled', () => {
  const st = setup(); keys(st, 'p2');
  assert.equal(st.song.lines[0].syllables[0].notes[0].variant, 0);
  assert.equal(applyKey(st, {key:'x'}).handled, false);
});
test('ctrl+enter inserts empty column', () => {
  const st = setup(); applyKey(st, {key:'Enter', ctrl:true});
  assert.equal(st.song.lines[0].syllables[1].lyricTa, '');
  assert.deepEqual(st.cursor, {lineIdx:0, sylIdx:1});
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `js/editor-keys.js`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: editor key handling`

---

### Task 6: Storage, settings and export/import

**Files:**
- Create: `js/storage.js`, `js/export.js`, `tests/storage.test.js`, `tests/export.test.js`

**Interfaces:**
- Produces (`js/storage.js`):
  - `openStore() → Promise<Store>`. Uses IndexedDB db `swara-notes` v1 with object stores `songs` (keyPath `id`) and `recordings` (keyPath `songId`, value `{songId, name, type, blob}`). If `indexedDB` is undefined or opening fails, it returns a memory store with `store.persistent === false`.
  - `Store { persistent: boolean, listSongs() → Promise<Song[]> (sorted updatedAt desc), getSong(id), putSong(song), deleteSong(id) (also deletes recording), getRecording(songId), putRecording(songId, file: Blob & {name}) , deleteRecording(songId) }`
  - `getSetting(key, fallback)`, `setSetting(key, value)`: localStorage JSON under the `swara-notes:` prefix, try/catch, fallback on any error. Keys used: `script` ('both'), `hideVariants` (false), `fontScale` (1).
- Produces (`js/export.js`):
  - `exportSong(song, recording?: {name, type, blob}) → Promise<string>` JSON `{app:'swara-notes', formatVersion:1, song, recording?: {name, type, dataBase64}}`
  - `importSong(text: string) → { song, recording: {name, type, blob} | null }`. Throws `Error` with a user-readable message on invalid JSON, wrong `app`, or `formatVersion` > 1, or a missing `song.lines` array. Assigns a **new** `song.id` so an import never overwrites an existing song.

- [ ] **Step 1: Write failing tests**

```js
// storage.test.js (node has no indexedDB → memory fallback path)
test('memory fallback round-trips', async () => {
  const st = await openStore(); assert.equal(st.persistent, false);
  const s = createSong('a'); await st.putSong(s);
  assert.equal((await st.listSongs())[0].id, s.id);
  await st.deleteSong(s.id); assert.equal((await st.listSongs()).length, 0);
});
test('settings survive missing localStorage', () => {
  assert.equal(getSetting('script', 'both'), 'both');
  setSetting('script', 'ta'); // must not throw
});
// export.test.js
test('round trip with recording, new id', async () => {
  const s = createSong('a'); setLyrics(s, 'க');
  const rec = {name:'c.m4a', type:'audio/mp4', blob:new Blob([new Uint8Array([1,2,3])])};
  const out = importSong(await exportSong(s, rec));
  assert.notEqual(out.song.id, s.id);
  assert.equal(out.song.lines[0].syllables[0].lyricTa, 'க');
  assert.deepEqual([...new Uint8Array(await out.recording.blob.arrayBuffer())], [1,2,3]);
});
test('rejects bad files', () => {
  assert.throws(() => importSong('not json'), /not a valid/i);
  assert.throws(() => importSong('{"app":"other"}'), /not a swara notes file/i);
  assert.throws(() => importSong('{"app":"swara-notes","formatVersion":9,"song":{"lines":[]}}'), /newer version/i);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: storage and export/import`

---

### Task 7: Notation rendering, jaru geometry, app shell, practice view

**Files:**
- Create: `js/jaru-geom.js`, `tests/jaru-geom.test.js`, `js/render.js`, `css/app.css`, `index.html`, `js/app.js`, `js/screens/practice.js`

**Interfaces:**
- Produces (`js/jaru-geom.js`):
  - `jaruSegments(fromBox, toBox, rowBoxes) → Array<{x1, x2, y}>`. Each box is `{left, right, top}` relative to the notation container. `rowBoxes` are the wrapped visual rows `{left, right, top}` in order. A same-row jaru gives one segment from the centre of `from` to the centre of `to`, at `y = row.top`. When it crosses rows, the segments are: from centre → that row's right; every full middle row left → right; the last row's left → to centre.
- Produces (`js/render.js`):
  - `renderNotation(container: HTMLElement, song, opts: { script: 'ta'|'en'|'both', hideVariants: boolean, cursor?: {lineIdx, sylIdx}, pendingJaruFrom?: noteId, onSyllableClick?(lineIdx, sylIdx), onNoteClick?(noteId), onSyllableDblClick?(lineIdx, sylIdx) }) → void`. Each line is a flex-wrap row of `.syl` columns with `data-line`/`data-syl`. Each column stacks: Tamil swara row, English swara row, Tamil lyric, English lyric (rows hidden per `script`). Notes are `<span class="note" data-note-id>` with `base`, a `<sub>` for the variant, and octave dots via `.oct-up1` / `.oct-up2` / `.oct-down1` / `.oct-down2` classes (1 or 2 dots, centred above/below the swara glyph). Gamaka marks are positioned above the note in the **top** visible swara row. An empty lyric renders "—". A tala mark renders after the column. Jaru lines go in an absolutely positioned SVG overlay computed with `jaruSegments` after layout. `ResizeObserver` recomputes them.
- Produces (`js/app.js`): hash routes `#/` (list), `#/edit/<id>`, `#/practice/<id>`. Shows a persistent banner when `store.persistent === false`.
- `index.html`: loads Noto Sans Tamil from Google Fonts; `<main id="app">`; `<script type="module" src="js/app.js">`. CSS uses tokens on `:root` with a dark-mode override, and a base notation size of at least 22px for swaras and 24px for Tamil lyrics, scaled by the `fontScale` setting.
- Practice screen (`js/screens/practice.js`): `mountPractice(root, store, songId)`. Read-only `renderNotation` plus script toggle (Tamil / English / Both), hide-variants toggle, font size A−/A+, and a player slot (filled in Task 8).

- [ ] **Step 1: Write failing tests**

```js
test('same row', () => {
  const rows = [{left:0, right:500, top:10}];
  assert.deepEqual(jaruSegments({left:10,right:30,top:10},{left:100,right:120,top:10}, rows), [{x1:20,x2:110,y:10}]);
});
test('crosses wrap into two segments', () => {
  const rows = [{left:0,right:500,top:10},{left:0,right:500,top:90}];
  assert.deepEqual(jaruSegments({left:460,right:480,top:10},{left:20,right:40,top:90}, rows),
    [{x1:470,x2:500,y:10},{x1:0,x2:30,y:90}]);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `jaruSegments`. Run `npm test`. Expected: PASS.
- [ ] **Step 4: Implement** `render.js`, `css/app.css`, `index.html`, `app.js` (list route is a placeholder until Task 9), and `practice.js`.
- [ ] **Step 5: Browser check.** `python3 -m http.server 8000`, then open `http://localhost:8000/#/practice/demo`. `app.js` seeds a demo song with id `demo` if none exists: the Sri Gananatha line in raga Malahari, `defaultScale` = `R1 G3 M1 D1` (Malahari: S R1 M1 P D1 Ṡ / Ṡ D1 P M1 G3 R1 S, no Ni), with notes only from that scale, including one upper-octave Ṡ and one two-dot note, one kampita, one pull, one sphurita, one jaru that crosses a syllable. Using Playwright, take screenshots at 1280px and 390px wide in each script mode. Expected: marks above the top swara row; jaru a flat line; at 390px wide a crossing jaru that wraps shows as two segments; no horizontal page scroll.
- [ ] **Step 6: Commit** `feat: notation rendering and practice view`

---

### Task 8: Player and editor screen

**Files:**
- Create: `js/player.js`, `js/screens/editor.js`
- Modify: `js/app.js` (route), `js/screens/practice.js` (mount player), `css/app.css`

**Interfaces:**
- Consumes: `renderNotation` (Task 7), `createEditorState`/`applyKey` (Task 5), model ops (Task 4), `Store` (Task 6).
- Produces (`js/player.js`):
  - `createPlayer(container, { onFileChosen?(file) }) → Player`. Renders: file picker ("Choose recording"), play/pause, current/total time, a seek bar with a loop region drawn on it, a speed selector 0.5× / 0.75× / 1× (`audio.preservesPitch = true`), and loop buttons "A" (start), "B" (end), "✕" (clear).
  - `Player { load(blob, name), setLoop(a, b), clearLoop(), toggle(), destroy() }`. Looping is checked on `timeupdate`, plus a `requestAnimationFrame` check while playing for tight loops.
  - Shortcuts, active while the page is focused: `Ctrl+Space` play/pause, `Ctrl+,` loop start at the current time, `Ctrl+.` loop end, `Ctrl+/` clear loop. They are handled before the editor keys and call `preventDefault`.
- Editor screen (`js/screens/editor.js`): `mountEditor(root, store, songId)`.
  - Layout A: player strip on top (sticky), title/raga/tala inputs, a "Lyrics" button, then full-width notation.
  - With no lyrics, it shows a big textarea with "Paste Tamil lyrics" and an "Use these lyrics" button (`setLyrics`). The "Lyrics" button re-opens it. If notes exist, it confirms first: "This clears all swaras for this song", then `clearSwaras` + `setLyrics`.
  - `keydown` on document → `applyKey`. When handled, it calls `preventDefault`, re-renders, and debounces a save (500 ms) via `store.putSong`. Typing inside inputs/textarea is ignored.
  - Clicking a syllable moves the cursor. Clicking a note while `pendingJaruFrom` is set completes the jaru to that note (`addJaru`).
  - Double-clicking a syllable opens an inline editor with two inputs: Tamil text and English text. On Enter it commits via `editSyllableText`/`setSyllableEn`. If the Tamil text contains a space, it splits there (`splitSyllable` at the first space, with the space removed).
  - The chosen recording is stored with `store.putRecording` and reloaded on mount. If it's missing, the player shows "Choose recording". `song.recordingName` is saved so the UI can say which file to pick.
  - A small "Keys" help panel lists the key map from Task 5 and the player shortcuts.
  - Practice screen mounts the same player.

- [ ] **Step 1: Implement** `player.js`, then `editor.js`, and wire the routes.
- [ ] **Step 2: Run** `npm test`. Expected: PASS (no regressions).
- [ ] **Step 3: Browser check with Playwright.** Generate a test tone so no copyrighted audio is used: `ffmpeg -f lavfi -i "sine=frequency=440:duration=20" /tmp/claude-…/scratchpad/tone.m4a` in the scratchpad (if ffmpeg is missing, write a WAV with a short Node script instead). Create a song, set the scale to `R1 G3 M1 D1` (Malahari), paste the Sri Gananatha line, type `mpd/'s` + Tab + `''sd~`. Then set loop A at 2s and B at 4s, set speed 0.75×, and play. Expected: notes appear in both scripts with D shown as D₁; the jaru goes from D₁ to Ṡ (one dot); the next syllable's S has two dots; the loop jumps back from 4s to about 2s; after reloading the page the notes and recording are still there.
- [ ] **Step 4: Commit** `feat: player and editor screen`

---

### Task 9: Song list, settings panel, README, deploy prep

**Files:**
- Create: `js/screens/list.js`, `js/screens/settings.js`, `README.md`
- Modify: `js/app.js`, `js/screens/editor.js` (settings button)

**Interfaces:**
- Consumes: `Store`, `exportSong`/`importSong`, `parseScale`/`formatScale`, `DEFAULT_GAMAKAS`.
- List screen `mountList(root, store)`: songs sorted by most recently edited, each with Edit / Practice / Export / Delete (confirm). "New song" asks for a title → `createSong` → edit route. "Import" opens a file picker → `importSong`; on error it shows the message and saves nothing. The export dialog has an "Include recording" checkbox (off by default) and downloads `<title>.swara.json`.
- Settings panel `openSettings(song, onChange)` (modal from the editor):
  - Default scale text input (`parseScale`/`formatScale`), with the hint "e.g. R2 G3 M1 D2 N3".
  - Use tala markers checkbox.
  - Gamaka table: rows of name / mark / key, editable, plus "Add gamaka" and delete. Keys must be single characters that don't clash with `srgmpdn,123'./|` or another gamaka; a clash shows an inline error. Jaru is shown as a fixed row ("Jaru — line above notes, key /").
- README: what the app is, the privacy note (recordings and songs stay in your browser; export to back up), how to run locally (`python3 -m http.server`), how to test (`npm test`), and how to enable GitHub Pages (Settings → Pages → Deploy from branch `main`, root).

- [ ] **Step 1: Implement** the list and settings screens and the README.
- [ ] **Step 2: Run** `npm test`. Expected: PASS.
- [ ] **Step 3: Browser check.** Create two songs. Export one with the recording, delete it, then import it. Expected: it comes back with the recording and a new id. Import `{"app":"x"}`. Expected: an error message, and the list is unchanged. Add a gamaka "Nokku", mark `⌃`, key `k`, and type it in the editor. Expected: the mark renders above the note. Set scale "R2 G3" and type `r`. Expected: R₂.
- [ ] **Step 4: Commit** `feat: song list, settings, readme`
- [ ] **Step 5: Stop before publishing.** Creating the GitHub repo and pushing is outward-facing. Ask the user for the repo name and their confirmation before running `gh repo create` / `git push`.
