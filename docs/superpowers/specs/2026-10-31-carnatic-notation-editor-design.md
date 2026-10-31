# Carnatic Swara–Lyrics Notation Editor — Design

Date: 2026-10-31
Status: Approved and implemented

## Intent and the why

A Carnatic music student (for example, learning veena) hears in class how
swaras, lyric syllables and gamakas (especially jaru) fit together. At home
the swaras are written down, partly in notes and partly only in class
recordings, but they've come loose from the words. It's easy to forget
which syllable a slide starts on, or that a note is supposed to be shaken
or pulled.

This app lets a student build a sheet where **swaras sit directly above the
lyric syllables they belong to, with gamaka marks drawn the way their
teacher draws them**, while listening to the class recording. They then
practise from that sheet on a big screen.

The first version must be usable to notate one full song end to end.

## Goals

1. Play a class recording (local file) with a loop region and slow-down
   (0.5×, 0.75×, 1×) so a phrase can be heard repeatedly.
2. Paste lyrics in Tamil script. The app splits them into lines and
   syllables and auto-generates English transliteration.
3. Type swaras under/over each syllable from the keyboard. Every swara shows
   in **both Tamil (ஸ ரி க ம ப த நி)** and **English (S R G M P D N)**.
   Lyrics also show in both Tamil script and English letters.
4. Mark gamakas with the teacher's notation (see table below).
5. Edit lyrics at any time (fix words, split/merge syllables) without losing
   swaras already attached to unaffected syllables.
6. Optional tala markers (| and ||) per song. Many film songs won't use them,
   so they're off by default.
7. Save work automatically in the browser. Export/import a song as a single
   file for backup and moving between devices.
8. A clean read-only practice view, big and legible on a laptop, tablet or
   big screen.

## Non-goals (first version)

- Automatic transcription of swaras from audio.
- Fetching/scraping lyrics from the internet. The user pastes lyrics they
  already have.
- Accounts, cloud sync, sharing between users.
- Linking the recording to the notation (tap a line to jump to it in the
  recording). A good later feature, not now.
- Audio playback of the typed swaras (synthesised veena).

## Anti-goals (would be a failure even if it "works")

- Uploading class recordings or song lyrics anywhere public. The app is
  hosted on GitHub Pages (public), so **recordings and songs must never
  leave the user's device** except via a file the user exports themselves.
  No lyrics or recordings committed to the repo, including test fixtures:
  use public-domain sample text (e.g. Purandara Dasa geetham "Sri Gananatha")
  for tests and demos.
- Notation that's cramped or hard to read at arm's length while holding a
  veena.
- Typing that forces mouse clicks for every swara. Entry must be keyboard-fast.
- Hard-coding one book's gamaka notation over the teacher's.

## Constraints

- **Hosting:** GitHub Pages. Static files only, no server.
- **Tech:** plain HTML, CSS and JavaScript, no build step *(my call)*.
  Small, readable, easy for the user to modify. Third-party libraries only
  if loaded from a pinned CDN version or vendored, and only when they clearly
  save effort.
- **Storage:** browser storage (IndexedDB recommended, since songs could grow
  and the recording handle/file may need storing). The audio file is chosen
  from the device each session, or cached locally in IndexedDB. Never uploaded.
- **Devices:** a laptop for editing. Practice view must also work on a tablet
  or phone browser.
- **Fonts:** Tamil must render correctly (use a Google Font such as Noto Sans
  Tamil or Mukta Malar).

## Decided by the user

- **Editing layout = "Layout A":** recording player strip across the top
  (play/pause, loop region, speed, time), notation filling the full width
  below. Each syllable is a column:
  ```
  Tamil swaras    (ஸ ரி)
  English swaras  (S R)
  Tamil lyric     (க)
  English lyric   (ga)
  ```
- Swaras typed from the keyboard. Both scripts fill in from one entry.
- **Script view is switchable:** Tamil only, English only, or both. This
  applies to swaras and lyrics, in both the editor and practice view, and
  also to export/print. The choice is remembered per device. The layout
  sketch above shows "both".
- **All gamaka marks go above the notes.** A jaru is a **flat, straight
  line above the notes**, from the start note to the end note. It doesn't
  slope. When both scripts are shown, marks are drawn above the top swara
  row only.
- Lyrics editable. Tala markers optional per song.
- Gamaka notation as the teacher writes it:

| Gamaka | Mark | Source |
|---|---|---|
| Jaru (slide) | **Straight line from the start note to the end note.** Can span notes in different syllables. | teacher |
| Kampita | **~ above the note** | teacher |
| Pull after pluck (deflection) | **↓ downward arrow above the note** | teacher |
| Sphurita | ˆ above the note | placeholder (my call), editable |

When a jaru crosses a line break on screen, it is drawn as two segments:
one to the end of the first row, one from the start of the next (my call).

- **Gamaka symbols live in an editable table** (name, mark, position
  above/below/connector). The user can rename, change marks or add new
  gamakas. Defaults are the four above.

## Data model (sketch, builder may refine)

```
Song {
  id, title, raga?, tala? (optional, free text), useTalaMarkers: bool,
  lines: [ Line { syllables: [ Syllable {
       lyricTa, lyricEn (auto, user-overridable),
       notes: [ Note { swara: 'S'|'R'|'G'|'M'|'P'|'D'|'N'|',' (rest),
                       variant?: 1|2|3 (e.g. R1/R2, optional),
                       octave: -2|-1|0|1|2,
                       gamakas: [gamakaId] } ],
       talaMark?: '|'|'||' } ] } ],
  jarus: [ { from: noteRef, to: noteRef } ],   // connectors may cross syllables
  gamakaTable: [ { id, name, mark, position } ],
  recording: { fileName, (optional cached blob in IndexedDB) },
  updatedAt
}
```

- Swara display: Tamil ஸ ரி க ம ப த நி, English S R G M P D N. Octave
  level is shown with dots, in both scripts (user request): one dot above =
  tara sthayi, two dots above = ati-tara, one dot below = mandra, two dots
  below = anumandra. Range -2..+2.
- Rest/karvai shown as `,`.
- **Swara variants (user request):** R, G, D, N can be 1/2/3 and M can be
  1/2. S and P have none. The variant shows as a subscript, e.g. ரி₂ / R₂.
  Entry: type the digit right after the swara (`r2`, `m1`). *(My call)*
  Each song has an optional default scale (the raga's swaras, e.g. R2 G3 M1
  D2 N3). A swara typed without a digit takes the song's default, and an
  explicit digit overrides it. With no default set, a swara typed without a
  digit has no variant and shows no subscript. A per-device toggle hides the
  subscripts in practice view if they're clutter.

## Keyboard entry (default, my call, may be tuned)

- `s r g m p d n` → swara. `,` → rest/karvai.
- `'` → next note one octave up, pressed twice → two up (two dots).
  `.` → one octave down, twice → two down. Pressing the opposite key cancels.
- `~` kampita, `v` pull-after-pluck (↓), `^` sphurita.
- `/` → start a jaru from the current note. The next note entered (or
  selected, even in a later syllable) is the end of the line.
- Space / Tab → next syllable. Shift+Tab → previous. Enter → next line.
- Backspace → delete last note in the syllable.
- Player shortcuts that don't conflict while typing (e.g. Ctrl+Space
  play/pause, Ctrl+L set loop start/end).

## Transliteration

Tamil → English letters is automatic, using a simple readable scheme
(e.g. "naa", "zha", "ng") rather than strict ISO-15919. The user can
override any syllable. Syllable splitting follows Tamil grapheme clusters
(consonant + vowel sign as one syllable; consonant with pulli ் attaches to
the previous syllable). The user can split/merge syllables manually when the
song's singing splits them differently.

## Screens

1. **Song list:** create, open, delete, import, export.
2. **Editor (Layout A):** player strip + notation grid + lyrics edit mode
   + gamaka-table settings.
3. **Practice view:** read-only, large type, optional font-size control,
   player still available at top.

## Calls made after review (my calls, user may override)

- **Lyric editing is in place.** The user edits a syllable's text, splits
  one syllable into two, merges two, or inserts/deletes syllables and lines.
  No re-paste-and-diff in v1. Rules:
  - Merge: the notes of both syllables join in order.
  - Split: all notes stay on the first part. The user moves them if needed.
  - Deleting a note or syllable that a jaru starts or ends on deletes that
    jaru.
  - Re-pasting the whole text is offered only for a song with no swaras yet,
    or with a clear warning that existing swaras will be cleared.
- **Columns with no lyric are allowed.** A syllable's `lyricTa` may be empty,
  for a held vowel or stretch of notes on one vowel. It renders as "—" in the
  lyric rows. A line may consist entirely of such columns, for instrumental
  interludes or BGM the user wants to play. Keyboard: `Ctrl+Enter` inserts an
  empty-lyric column after the current one, and `Ctrl+Shift+Enter` inserts a
  new interlude line.
- **Speed/grouping marks are out of v1** (not used by the teacher's notation so far). Saved songs carry a `formatVersion` field so speed can be
  added later with a migration rather than breaking old files.
- **Export leaves audio out by default.** Plain JSON. A checkbox "include
  recording" packages the audio (e.g. base64 in the JSON, or a zip). Import
  accepts both.

## Left to the builder

- File/module structure, IndexedDB wrapper, rendering approach (DOM vs SVG
  for jaru lines. Lines must reflow correctly when the screen width changes).
- Exact transliteration table.
- Export file format (JSON is fine).
- Visual styling within the constraints above (legible, light and dark).
- Test approach. Unit tests for syllable splitting, transliteration and the
  data model are expected.
