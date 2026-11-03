// Keystroke -> editing action. Pure apart from mutating the state it's given.

import {
  addNote, setVariant, toggleGamaka, addJaru, deleteNote, insertSyllableAfter,
  insertLineAfter, deleteSyllable, mergeWithNext, setTalaMark,
  copyNotes, pasteNotes, notesInCells,
} from './model.js';

const SWARA_KEYS = new Set(['s', 'r', 'g', 'm', 'p', 'd', 'n']);
const TALA_CYCLE = { '': '|', '|': '||', '||': '' };

// The key to act on for a DOM keyboard event, or null to ignore it. On a
// Tamil (or other non-Latin) layout letters arrive as Tamil characters, so
// letter keys fall back to the physical key.
export function normalizeKey(e) {
  if (e.isComposing || e.key === 'Process' || e.key === 'Dead') return null;
  const letter = /^Key([A-Z])$/.exec(e.code ?? '');
  if (letter && (e.altKey || (e.key.length === 1 && !/^[\x20-\x7E]$/.test(e.key)))) {
    return letter[1].toLowerCase();
  }
  return e.key;
}

// `clipboard` can be passed in so copied swaras survive switching songs.
export function createEditorState(song, clipboard = null) {
  return {
    song, cursor: { lineIdx: 0, sylIdx: 0 },
    pendingOctave: 0, pendingJaruFrom: null, lastNoteId: null, clipboard,
  };
}

function currentSyllable(state) {
  return state.song.lines[state.cursor.lineIdx]?.syllables[state.cursor.sylIdx] ?? null;
}

function moveTo(state, lineIdx, sylIdx) {
  state.cursor = { lineIdx, sylIdx };
  const notes = currentSyllable(state)?.notes ?? [];
  state.lastNoteId = notes.length ? notes[notes.length - 1].id : null;
}

function step(state, dir) {
  const { lines } = state.song;
  let { lineIdx, sylIdx } = state.cursor;
  sylIdx += dir;
  if (sylIdx >= (lines[lineIdx]?.syllables.length ?? 0)) {
    if (lineIdx + 1 >= lines.length) return;
    lineIdx += 1; sylIdx = 0;
  } else if (sylIdx < 0) {
    if (lineIdx === 0) return;
    lineIdx -= 1; sylIdx = lines[lineIdx].syllables.length - 1;
  }
  moveTo(state, lineIdx, sylIdx);
}

// Up/down a line, keeping the column where possible.
function stepLine(state, dir) {
  const { lines } = state.song;
  const lineIdx = state.cursor.lineIdx + dir;
  if (lineIdx < 0 || lineIdx >= lines.length) return;
  moveTo(state, lineIdx, Math.min(state.cursor.sylIdx, lines[lineIdx].syllables.length - 1));
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function paste(state, confirm) {
  const { song, clipboard } = state;
  const syl = currentSyllable(state);
  if (!clipboard) return { handled: true, message: 'Nothing copied yet. Ctrl+C copies a cell, Alt+C a line.' };
  if (!syl) return { handled: true };
  const existing = notesInCells(song, syl.id, clipboard);
  if (existing && !confirm(`Pasting will replace ${plural(existing, 'swara')} already here. Continue?`)) {
    return { handled: true };
  }
  const { pasted, skipped, lastSylId } = pasteNotes(song, syl.id, clipboard);
  const at = lastSylId ? state.song.lines[state.cursor.lineIdx].syllables.findIndex((x) => x.id === lastSylId) : -1;
  if (at >= 0) { moveTo(state, state.cursor.lineIdx, at); step(state, 1); }
  return {
    handled: true,
    message: `Pasted ${plural(pasted, 'cell')}.` + (skipped ? ` ${plural(skipped, 'cell')} didn't fit on this line.` : ''),
  };
}

function clampCursor(state) {
  const { lines } = state.song;
  if (!lines.length) { moveTo(state, 0, 0); return; }
  const lineIdx = Math.min(state.cursor.lineIdx, lines.length - 1);
  const sylIdx = Math.min(state.cursor.sylIdx, lines[lineIdx].syllables.length - 1);
  moveTo(state, lineIdx, sylIdx);
}

function enterNote(state, swara) {
  const syl = currentSyllable(state);
  if (!syl) return;
  const note = addNote(state.song, syl.id, { swara, octave: state.pendingOctave });
  state.pendingOctave = 0;
  if (state.pendingJaruFrom) {
    addJaru(state.song, state.pendingJaruFrom, note.id);
    state.pendingJaruFrom = null;
  }
  state.lastNoteId = note.id;
}

export function applyKey(state, ev) {
  const { key, ctrl = false, shift = false, alt = false, confirm = () => true } = ev;
  const { song } = state;
  const syl = currentSyllable(state);
  const lower = key.length === 1 ? key.toLowerCase() : key;

  if (ctrl) {
    if (key === 'Enter' && shift) {
      const line = song.lines[state.cursor.lineIdx];
      if (!line) return { handled: false };
      insertLineAfter(song, line.id);
      moveTo(state, state.cursor.lineIdx + 1, 0);
      return { handled: true };
    }
    if (key === 'Enter' && syl) {
      insertSyllableAfter(song, syl.id);
      moveTo(state, state.cursor.lineIdx, state.cursor.sylIdx + 1);
      return { handled: true };
    }
    if (lower === 'c' && !shift && syl) {
      state.clipboard = copyNotes(song, [syl.id]);
      return { handled: true, message: `Copied 1 cell (${plural(syl.notes.length, 'swara')}). Ctrl+V to paste.` };
    }
    if (lower === 'v' && !shift) return paste(state, confirm);
    if (key === 'Backspace' && syl) {
      deleteSyllable(song, syl.id);
      clampCursor(state);
      return { handled: true };
    }
    return { handled: false };
  }

  if (alt) {
    if (lower === 'c' && syl) {
      const line = song.lines[state.cursor.lineIdx];
      state.clipboard = copyNotes(song, line.syllables.map((x) => x.id));
      return { handled: true, message: `Copied line (${plural(line.syllables.length, 'cell')}). Go to the start of another line and press Ctrl+V.` };
    }
    if (lower === 'm' && syl) {
      mergeWithNext(song, syl.id);
      moveTo(state, state.cursor.lineIdx, state.cursor.sylIdx);
      return { handled: true };
    }
    return { handled: false };
  }

  if (key === 'Escape') {
    state.pendingJaruFrom = null;
    state.pendingOctave = 0;
    return { handled: true };
  }
  if (SWARA_KEYS.has(lower)) { enterNote(state, lower.toUpperCase()); return { handled: true }; }
  if (key === ',') { enterNote(state, ','); return { handled: true }; }
  if (key === '1' || key === '2' || key === '3') {
    if (state.lastNoteId) setVariant(song, state.lastNoteId, Number(key));
    return { handled: true };
  }
  if (key === "'") { state.pendingOctave = Math.min(2, Math.max(0, state.pendingOctave) + 1); return { handled: true }; }
  if (key === '.') { state.pendingOctave = Math.max(-2, Math.min(0, state.pendingOctave) - 1); return { handled: true }; }
  if (key === '/') { state.pendingJaruFrom = state.lastNoteId; return { handled: true }; }
  if (key === '|' && song.useTalaMarkers && syl) {
    setTalaMark(song, syl.id, TALA_CYCLE[syl.talaMark ?? '']);
    return { handled: true };
  }

  if (key === 'Backspace') {
    const last = syl?.notes[syl.notes.length - 1];
    if (last) {
      deleteNote(song, last.id);
      moveTo(state, state.cursor.lineIdx, state.cursor.sylIdx);
    }
    return { handled: true };
  }
  if (key === ' ' || (key === 'Tab' && !shift)) { step(state, 1); return { handled: true }; }
  if (key === 'Tab' && shift) { step(state, -1); return { handled: true }; }
  if (key === 'ArrowRight') { step(state, 1); return { handled: true }; }
  if (key === 'ArrowLeft') { step(state, -1); return { handled: true }; }
  if (key === 'ArrowDown') { stepLine(state, 1); return { handled: true }; }
  if (key === 'ArrowUp') { stepLine(state, -1); return { handled: true }; }
  if (key === 'Enter') {
    if (state.cursor.lineIdx + 1 < song.lines.length) moveTo(state, state.cursor.lineIdx + 1, 0);
    return { handled: true };
  }

  const gamaka = song.gamakaTable.find((g) => g.key === key);
  if (gamaka) {
    if (state.lastNoteId) toggleGamaka(song, state.lastNoteId, gamaka.id);
    return { handled: true };
  }
  return { handled: false };
}
