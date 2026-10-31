// Song data and editing operations. Operations mutate the song in place.

import { splitLyrics } from './syllables.js';
import { transliterate } from './translit.js';
import { isValidVariant } from './swara.js';

export const FORMAT_VERSION = 1;

export const DEFAULT_GAMAKAS = Object.freeze([
  { id: 'kampita', name: 'Kampita', mark: '~', key: '~' },
  { id: 'pull', name: 'Pull after pluck', mark: '↓', key: 'v' },
  { id: 'sphurita', name: 'Sphurita', mark: 'ˆ', key: '^' },
]);

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
    useTalaMarkers: false, defaultScale: {}, lines: [], jarus: [],
    gamakaTable: DEFAULT_GAMAKAS.map((g) => ({ ...g })), recordingName: '',
    updatedAt: Date.now(),
  };
}

export function allNotes(song) {
  return song.lines.flatMap((l) => l.syllables.flatMap((s) => s.notes));
}

export function noteCount(song) {
  return allNotes(song).length;
}

export function setLyrics(song, text) {
  if (noteCount(song) > 0) throw new Error('song has swaras');
  song.lines = splitLyrics(text).map((syls) => ({ id: uid(), syllables: syls.map(makeSyllable) }));
  song.jarus = [];
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
