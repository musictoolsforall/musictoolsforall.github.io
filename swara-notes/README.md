# Swara Notes

A small web app for writing Carnatic swaras above the syllables of a song's
lyrics, with gamaka marks drawn the way your teacher draws them, while you
loop and slow down a class recording.

- Swaras and lyrics in Tamil, English, or both
- Paste lyrics in Tamil script or in English letters; the app can write them
  in the other script for you (English → Tamil is a best guess: `aa` = ா,
  `zh` = ழ, `N`/`L`/`R` = ண/ள/ற — fix any syllable with a double-click)
- Variants (R1, R2…) with an optional default raga scale per song
- Octave dots: one or two above or below
- Gamakas: jaru (line above the notes), kampita `~`, pull after pluck `↓`,
  sphurita `ˆ`. Edit the table or add your own in **Settings**
- Recording player with A–B loop and 0.5× / 0.75× speed
- Copy and paste swaras: **Ctrl+C** copies a syllable's swaras, **Alt+C** a whole
  line's (gamakas and jarus included), **Ctrl+V** pastes. Arrow keys move
  between syllables and lines
- Change the lyrics any time with **Lyrics**: swaras stay on every line whose
  words you didn't change; only changed lines lose theirs (you're asked first)
- Practice view with big text
- **PDF / Print** from the practice view (choose "Save as PDF" in the print
  dialog). It prints in the script you picked, at the A−/A+ size, on A4
- **Text** download, e.g. `sree[S ⌜R1~] ka[Ṡ⌝ P]`, to paste into messages.
  `⌜ … ⌝` marks a jaru, and a key at the end explains the marks

## Privacy

Everything stays on your device. Songs are saved in your browser
(IndexedDB) and recordings are never uploaded. Nothing is sent to a server,
even when the app is hosted on GitHub Pages. Use **Export** on the song list
to back up a song or move it to another device. You can include the
recording in the exported file if you like.

## Run locally

From the repository root:

```bash
python3 -m http.server 8000
# open http://localhost:8000/swara-notes/
```

## Tests

```bash
cd swara-notes
npm test   # Node 20+; no dependencies
```

Part of [Music Tools for All](../README.md), published at
https://musictoolsforall.github.io/swara-notes/.

Don't commit song lyrics or recordings to the repository. Keep them in the
app and in your own exported files.
