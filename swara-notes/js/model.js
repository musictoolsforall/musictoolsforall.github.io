// Song data and editing operations. Operations mutate the song in place.

import { splitLyrics } from './syllables.js';
import { transliterate } from './translit.js';
import { toTamil } from './translit-ta.js';
import { isValidVariant } from './swara.js';

export const FORMAT_VERSION = 1;

export const DEFAULT_GAMAKAS = Object.freeze([
  { id: 'kampita', name: 'Kampita', mark: '~', key: '~' },
  { id: 'pull', name: 'Pull after pluck', mark: '↓', key: 'v' },
  { id: 'sphurita', name: 'Sphurita', mark: 'ˆ', key: '^' },
]);

const RESERVED_KEYS = new Set([..."srgmpdn", ..."SRGMPDN", ..."123,'./| "]);

// Returns '' if `key` can be used for a gamaka, otherwise a message to show.
export function gamakaKeyError(table, key, selfId) {
  if ([...key].length !== 1) return 'Use exactly one character.';
  if (/[srgmpdn]/i.test(key)) return 'That key types a swara.';
  if (RESERVED_KEYS.has(key)) return 'That key is already used by the editor.';
  const other = table.find((g) => g.key === key && g.id !== selfId);
  return other ? `Already used by ${other.name}.` : '';
}

const uid = () => crypto.randomUUID();
const touch = (song) => { song.updatedAt = Date.now(); };

function makeSyllable(lyricTa = '') {
  return {
    id: uid(), lyricTa, lyricEn: transliterate(lyricTa), lyricEnOverride: false,
    notes: [], talaMark: '',
  };
}

export function createSong(title) {
  return {
    id: uid(), formatVersion: FORMAT_VERSION, title, raga: '', tala: '',
    useTalaMarkers: false, defaultScale: {}, lyricScripts: { ta: true, en: true }, lines: [], jarus: [],
    gamakaTable: DEFAULT_GAMAKAS.map((g) => ({ ...g })), recordingName: '',
    updatedAt: Date.now(),
  };
}

export function allNotes(song) {
  return song.lines.flatMap((l) => l.syllables.flatMap((s) => s.notes));
}

export function gamakaUsage(song, gamakaId) {
  return allNotes(song).filter((n) => n.gamakas.includes(gamakaId)).length;
}

export function noteCount(song) {
  return allNotes(song).length;
}

// Words of a line, ignoring how it's split into syllables.
const lineKey = (line) => line.syllables.map((x) => x.lyricTa).join('');
const isInterlude = (line) => lineKey(line) === '';

// Line up the new pasted text against the song's current lines (longest
// common subsequence). A line whose words are unchanged keeps its syllables,
// swaras and hand edits; changed or new lines start fresh. Lines with no
// words (interludes) are never in the pasted text, so they are kept where
// they are. Pure: returns the new lines and which old notes would be lost.
function planLyrics(song, text, from) {
  const srcLines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  const fresh = srcLines.map((src) => {
    const syls = splitLyrics(from === 'en' ? toTamil(src) : src)[0] ?? [];
    return { src, key: syls.join(''), syls };
  }).filter((n) => n.syls.length);

  const old = song.lines;
  const matches = (o, n) => !isInterlude(o) && (lineKey(o) === n.key || (o.src != null && o.src === n.src));

  // LCS table over (old lines, new lines).
  const L = Array.from({ length: old.length + 1 }, () => new Array(fresh.length + 1).fill(0));
  for (let i = old.length - 1; i >= 0; i--) {
    for (let j = fresh.length - 1; j >= 0; j--) {
      L[i][j] = matches(old[i], fresh[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }

  const lines = [];
  const lost = [];
  let changedLines = 0;
  // Between two matching lines there's a gap of removed old lines and added
  // new ones. A new line takes the place of the removed line it replaces;
  // interludes stay in their position; extra new lines go at the end of the gap.
  let gapOld = [], gapNew = [];
  const flush = () => {
    let k = 0;
    for (const o of gapOld) {
      if (isInterlude(o)) { lines.push({ old: o }); continue; }
      const notes = o.syllables.flatMap((x) => x.notes);
      lost.push(...notes);
      if (notes.length) changedLines++;
      if (k < gapNew.length) lines.push({ fresh: gapNew[k++] });
    }
    for (; k < gapNew.length; k++) lines.push({ fresh: gapNew[k] });
    gapOld = []; gapNew = [];
  };
  let i = 0, j = 0;
  while (i < old.length || j < fresh.length) {
    if (i < old.length && j < fresh.length && matches(old[i], fresh[j])) {
      flush();
      lines.push({ old: old[i], src: fresh[j].src });
      i++; j++;
    } else if (i < old.length && (j === fresh.length || L[i + 1][j] >= L[i][j + 1])) {
      gapOld.push(old[i++]);
    } else {
      gapNew.push(fresh[j++]);
    }
  }
  flush();
  return { lines, lost, changedLines };
}

// What re-pasting `text` would cost, without changing the song.
export function lyricsChange(song, text, { from = 'ta' } = {}) {
  const { lost, changedLines } = planLyrics(song, text, from);
  return { lostNotes: lost.length, changedLines };
}

// `from`: the script the pasted text is in ('ta' or 'en'). `other`: whether
// to also show it in the other script. English text is converted to Tamil
// first, since syllables are split on the Tamil. Swaras on lines whose
// words didn't change are kept; see planLyrics.
export function setLyrics(song, text, { from = 'ta', other = true } = {}) {
  const { lines, lost } = planLyrics(song, text, from);
  song.lyricsFrom = from;
  song.lyricsSource = text;
  song.lyricScripts = { ta: from === 'ta' || other, en: from === 'en' || other };
  song.lines = lines.map((p) => {
    if (p.old) {
      if (p.src != null) p.old.src = p.src;
      return p.old;
    }
    return { id: uid(), src: p.fresh.src, syllables: p.fresh.syls.map(makeSyllable) };
  });
  dropJarusFor(song, lost.map((n) => n.id));
  touch(song);
}

export function clearSwaras(song) {
  for (const l of song.lines) for (const s of l.syllables) s.notes = [];
  song.jarus = [];
  touch(song);
}

export function findSyllable(song, sylId) {
  for (let lineIdx = 0; lineIdx < song.lines.length; lineIdx++) {
    const line = song.lines[lineIdx];
    const sylIdx = line.syllables.findIndex((s) => s.id === sylId);
    if (sylIdx >= 0) return { line, lineIdx, syl: line.syllables[sylIdx], sylIdx };
  }
  return null;
}

function findNote(song, noteId) {
  return allNotes(song).find((n) => n.id === noteId) ?? null;
}

function dropJarusFor(song, noteIds) {
  const ids = new Set(noteIds);
  song.jarus = song.jarus.filter((j) => !ids.has(j.from) && !ids.has(j.to));
}

export function addNote(song, sylId, { swara, variant, octave = 0 }) {
  const found = findSyllable(song, sylId);
  if (!found) return null;
  const v = variant ?? song.defaultScale?.[swara] ?? 0;
  const note = {
    id: uid(), swara, variant: isValidVariant(swara, v) ? v : 0, octave, gamakas: [],
  };
  found.syl.notes.push(note);
  touch(song);
  return note;
}

export function setVariant(song, noteId, v) {
  const note = findNote(song, noteId);
  if (!note || !isValidVariant(note.swara, v)) return;
  note.variant = v;
  touch(song);
}

export function toggleGamaka(song, noteId, gamakaId) {
  const note = findNote(song, noteId);
  if (!note) return;
  const i = note.gamakas.indexOf(gamakaId);
  if (i >= 0) note.gamakas.splice(i, 1);
  else note.gamakas.push(gamakaId);
  touch(song);
}

export function deleteNote(song, noteId) {
  for (const l of song.lines) {
    for (const s of l.syllables) {
      const i = s.notes.findIndex((n) => n.id === noteId);
      if (i >= 0) {
        s.notes.splice(i, 1);
        dropJarusFor(song, [noteId]);
        touch(song);
        return;
      }
    }
  }
}

export function addJaru(song, fromId, toId) {
  if (fromId === toId) return null;
  const order = allNotes(song).map((n) => n.id);
  const a = order.indexOf(fromId), b = order.indexOf(toId);
  if (a < 0 || b < 0) return null;
  const jaru = { id: uid(), from: order[Math.min(a, b)], to: order[Math.max(a, b)] };
  song.jarus.push(jaru);
  touch(song);
  return jaru;
}

export function editSyllableText(song, sylId, text) {
  const found = findSyllable(song, sylId);
  if (!found) return;
  found.syl.lyricTa = text;
  if (!found.syl.lyricEnOverride) found.syl.lyricEn = transliterate(text);
  touch(song);
}

// Empty string clears the override and recomputes from the Tamil text.
export function setSyllableEn(song, sylId, en) {
  const found = findSyllable(song, sylId);
  if (!found) return;
  found.syl.lyricEnOverride = en !== '';
  found.syl.lyricEn = en !== '' ? en : transliterate(found.syl.lyricTa);
  touch(song);
}

// `at` counts code points. Notes stay on the first part.
export function splitSyllable(song, sylId, at) {
  const found = findSyllable(song, sylId);
  if (!found) return null;
  const chars = [...found.syl.lyricTa];
  const second = makeSyllable(chars.slice(at).join(''));
  editSyllableText(song, sylId, chars.slice(0, at).join(''));
  found.line.syllables.splice(found.sylIdx + 1, 0, second);
  touch(song);
  return second;
}

export function mergeWithNext(song, sylId) {
  const found = findSyllable(song, sylId);
  if (!found) return;
  const next = found.line.syllables[found.sylIdx + 1];
  if (!next) return;
  const syl = found.syl;
  syl.notes.push(...next.notes);
  found.line.syllables.splice(found.sylIdx + 1, 1);
  syl.lyricEnOverride = false;
  editSyllableText(song, sylId, syl.lyricTa + next.lyricTa);
}

export function insertSyllableAfter(song, sylId) {
  const found = findSyllable(song, sylId);
  if (!found) return null;
  const syl = makeSyllable('');
  found.line.syllables.splice(found.sylIdx + 1, 0, syl);
  touch(song);
  return syl;
}

export function insertLineAfter(song, lineId) {
  const idx = song.lines.findIndex((l) => l.id === lineId);
  const line = { id: uid(), syllables: [makeSyllable('')] };
  song.lines.splice(idx + 1, 0, line);
  touch(song);
  return line;
}

export function deleteSyllable(song, sylId) {
  const found = findSyllable(song, sylId);
  if (!found) return;
  dropJarusFor(song, found.syl.notes.map((n) => n.id));
  found.line.syllables.splice(found.sylIdx, 1);
  if (found.line.syllables.length === 0) song.lines.splice(found.lineIdx, 1);
  touch(song);
}

export function setTalaMark(song, sylId, mark) {
  const found = findSyllable(song, sylId);
  if (!found) return;
  found.syl.talaMark = mark;
  touch(song);
}

// --- copy / paste swaras ---
// A clip is a list of cells (one per copied syllable), each a list of notes
// without ids, plus the jarus that lie entirely inside the copied cells,
// stored as [cell, note] positions.

export function copyNotes(song, sylIds) {
  const syls = sylIds.map((id) => findSyllable(song, id)?.syl).filter(Boolean);
  const where = new Map();
  syls.forEach((syl, c) => syl.notes.forEach((n, k) => where.set(n.id, [c, k])));
  return {
    cells: syls.map((syl) => syl.notes.map(({ swara, variant, octave, gamakas }) => (
      { swara, variant, octave, gamakas: [...gamakas] }))),
    jarus: song.jarus
      .filter((j) => where.has(j.from) && where.has(j.to))
      .map((j) => ({ from: where.get(j.from), to: where.get(j.to) })),
  };
}

// The syllables a paste starting at `startSylId` would fill: consecutive
// cells on the same line, no further than its end.
function pasteTargets(song, startSylId, clip) {
  const found = findSyllable(song, startSylId);
  if (!found) return [];
  return found.line.syllables.slice(found.sylIdx, found.sylIdx + clip.cells.length);
}

export function notesInCells(song, startSylId, clip) {
  return pasteTargets(song, startSylId, clip).reduce((sum, syl) => sum + syl.notes.length, 0);
}

// Replace the swaras of the target cells with the clip's. Returns how many
// cells were pasted, how many didn't fit on the line, and the last cell filled.
export function pasteNotes(song, startSylId, clip) {
  const targets = pasteTargets(song, startSylId, clip);
  dropJarusFor(song, targets.flatMap((syl) => syl.notes.map((n) => n.id)));
  const ids = targets.map((syl, c) => {
    syl.notes = clip.cells[c].map((n) => ({ ...n, gamakas: [...n.gamakas], id: uid() }));
    return syl.notes.map((n) => n.id);
  });
  for (const j of clip.jarus) {
    const from = ids[j.from[0]]?.[j.from[1]], to = ids[j.to[0]]?.[j.to[1]];
    if (from && to) song.jarus.push({ id: uid(), from, to });
  }
  touch(song);
  return {
    pasted: targets.length,
    skipped: clip.cells.length - targets.length,
    lastSylId: targets.length ? targets[targets.length - 1].id : null,
  };
}
