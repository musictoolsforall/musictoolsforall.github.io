// Plain-text version of a song, for pasting into messages or notes.
// Each syllable is written as  lyric[swaras], e.g.  sree[S ⌜R1~] ka[Ṡ⌝ P].
// Octave dots use combining marks so they sit on the letter:
// one dot above (U+0307), two above (U+0308), one below (U+0323), two below (U+0324).

import { swaraDisplay, isValidVariant } from './swara.js';

const OCTAVE_MARK = { 1: '\u0307', 2: '\u0308', '-1': '\u0323', '-2': '\u0324' };

function noteText(note, script, song, opts, jaruStarts, jaruEnds) {
  const d = swaraDisplay(note, script);
  // The dot goes after the whole swara, so Tamil ரி keeps its vowel sign intact.
  let s = d.base + (OCTAVE_MARK[d.octave] ?? '');
  if (!opts.hideVariants && isValidVariant(note.swara, note.variant)) s += note.variant;
  for (const id of note.gamakas ?? []) s += song.gamakaTable.find((g) => g.id === id)?.mark ?? '';
  if (jaruStarts.has(note.id)) s = '⌜' + s;
  if (jaruEnds.has(note.id)) s += '⌝';
  return s;
}

function lineText(line, script, song, opts, starts, ends) {
  const parts = [];
  for (const syl of line.syllables) {
    const lyric = (script === 'ta' ? syl.lyricTa : syl.lyricEn) || '—';
    const notes = syl.notes.map((n) => noteText(n, script, song, opts, starts, ends)).join(' ');
    parts.push(`${lyric}[${notes}]`);
    if (song.useTalaMarkers && syl.talaMark) parts.push(syl.talaMark);
  }
  return parts.join(' ');
}

export function songToText(song, opts = {}) {
  const script = opts.script ?? 'both';
  const scripts = script === 'both' ? ['ta', 'en'] : [script];
  const starts = new Set(song.jarus.map((j) => j.from));
  const ends = new Set(song.jarus.map((j) => j.to));

  const out = [song.title || 'Untitled'];
  const meta = [song.raga && `Raga: ${song.raga}`, song.tala && `Tala: ${song.tala}`].filter(Boolean);
  if (meta.length) out.push(meta.join(' · '));
  out.push('');

  for (const line of song.lines) {
    for (const s of scripts) out.push(lineText(line, s, song, opts, starts, ends));
    out.push('');
  }

  out.push('Key: ⌜ … ⌝ = jaru (slide) from the first note to the last');
  for (const g of song.gamakaTable) out.push(`     ${g.mark} = ${g.name}`);
  out.push('     dot above/below = higher/lower octave; , = karvai');
  return (out.join('\n') + '\n').normalize('NFC');
}
