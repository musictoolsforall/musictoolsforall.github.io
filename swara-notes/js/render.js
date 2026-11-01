// Render a song's notation into a container, with jaru lines drawn as thin
// bars (one per visual row) that are recomputed whenever the layout changes.

import { swaraDisplay } from './swara.js';
import { jaruSegments } from './jaru-geom.js';

const observers = new WeakMap();

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function noteEl(note, script, opts, song, withMarks) {
  const d = swaraDisplay(note, script);
  const span = el('span', 'note');
  span.dataset.noteId = note.id;
  if (d.octave > 0) span.classList.add(`oct-up${d.octave}`);
  if (d.octave < 0) span.classList.add(`oct-down${-d.octave}`);
  if (opts.pendingJaruFrom === note.id) span.classList.add('pending');
  span.append(el('span', 'base', d.base));
  if (d.sub && !opts.hideVariants) span.append(el('sub', null, String(note.variant)));
  if (d.octave) span.append(el('span', 'dots', '•'.repeat(Math.abs(d.octave))));
  if (withMarks && note.gamakas.length) {
    const marks = note.gamakas
      .map((id) => song.gamakaTable.find((g) => g.id === id)?.mark)
      .filter(Boolean)
      .join('');
    if (marks) span.append(el('span', 'mark', marks));
  }
  return span;
}

function swaraRow(syl, script, opts, song, isTop) {
  const row = el('div', `sw sw-${script}${isTop ? ' sw-top' : ''}`);
  if (!syl.notes.length) row.append(el('span', 'note empty', ' '));
  for (const n of syl.notes) row.append(noteEl(n, script, opts, song, isTop));
  return row;
}

function syllableEl(syl, lineIdx, sylIdx, song, opts) {
  const col = el('div', 'syl');
  col.dataset.line = lineIdx;
  col.dataset.syl = sylIdx;
  if (opts.cursor && opts.cursor.lineIdx === lineIdx && opts.cursor.sylIdx === sylIdx) {
    col.classList.add('cursor');
  }
  const scripts = opts.script === 'both' ? ['ta', 'en'] : [opts.script];
  scripts.forEach((s, i) => col.append(swaraRow(syl, s, opts, song, i === 0)));
  const empty = syl.lyricTa === '';
  const shown = song.lyricScripts ?? { ta: true, en: true };
  if (opts.script !== 'en' && shown.ta) col.append(el('div', 'ly ly-ta', empty ? '—' : syl.lyricTa));
  if (opts.script !== 'ta' && shown.en) col.append(el('div', 'ly ly-en', empty ? '—' : syl.lyricEn));
  return col;
}

// Each jaru segment is a thin bar placed inside the first syllable column of
// the visual row it belongs to, positioned relative to that column. When the
// page reflows or a printout breaks across pages, the row moves and its jaru
// bars move with it.
function drawJarus(container, song) {
  for (const old of container.querySelectorAll('.jaru-seg')) old.remove();
  const base = container.getBoundingClientRect();
  const rel = (r) => ({ left: r.left - base.left, right: r.right - base.left, top: r.top - base.top });

  // Visual rows = groups of top swara rows sharing a vertical position.
  const rowsByTop = new Map();
  for (const top of container.querySelectorAll('.sw-top')) {
    const r = rel(top.getBoundingClientRect());
    const key = Math.round(r.top);
    const row = rowsByTop.get(key);
    if (row) { row.left = Math.min(row.left, r.left); row.right = Math.max(row.right, r.right); }
    else rowsByTop.set(key, { ...r, top: key, anchor: top.closest('.syl') });
  }
  const rows = [...rowsByTop.values()].sort((a, b) => a.top - b.top);

  const boxOf = (noteId) => {
    const n = container.querySelector(`.sw-top .note[data-note-id="${noteId}"]`);
    if (!n) return null;
    const row = n.closest('.sw-top').getBoundingClientRect();
    return { ...rel(n.getBoundingClientRect()), top: Math.round(row.top - base.top) };
  };

  for (const j of song.jarus) {
    const a = boxOf(j.from), b = boxOf(j.to);
    if (!a || !b) continue;
    for (const s of jaruSegments(a, b, rows)) {
      const anchor = rowsByTop.get(s.y)?.anchor;
      if (!anchor) continue;
      const off = rel(anchor.getBoundingClientRect());
      const bar = el('span', 'jaru-seg');
      bar.setAttribute('aria-hidden', 'true');
      bar.style.left = `${s.x1 - off.left}px`;
      bar.style.width = `${Math.max(0, s.x2 - s.x1)}px`;
      bar.style.top = `${s.y - off.top + 5}px`; // just above the swara glyphs, inside the row's top padding
      anchor.append(bar);
    }
  }
}

// Recompute jaru positions now (e.g. right before printing, after the
// layout width has changed).
export function redrawJarus(container, song) {
  drawJarus(container, song);
}

export function renderNotation(container, song, opts) {
  container.replaceChildren();
  container.classList.add('notation');
  for (const [lineIdx, line] of song.lines.entries()) {
    const row = el('div', 'line');
    for (const [sylIdx, syl] of line.syllables.entries()) {
      row.append(syllableEl(syl, lineIdx, sylIdx, song, opts));
      if (song.useTalaMarkers && syl.talaMark) row.append(el('div', 'tala', syl.talaMark));
    }
    container.append(row);
  }
  container.onclick = (e) => {
    const note = e.target.closest('.note[data-note-id]');
    if (note && opts.onNoteClick && opts.onNoteClick(note.dataset.noteId)) return;
    const col = e.target.closest('.syl');
    if (col && opts.onSyllableClick) opts.onSyllableClick(Number(col.dataset.line), Number(col.dataset.syl));
  };
  container.ondblclick = (e) => {
    const col = e.target.closest('.syl');
    if (col && opts.onSyllableDblClick) opts.onSyllableDblClick(Number(col.dataset.line), Number(col.dataset.syl));
  };

  drawJarus(container, song);
  observers.get(container)?.disconnect();
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => drawJarus(container, song));
    ro.observe(container);
    observers.set(container, ro);
  }
  document.fonts?.ready.then(() => drawJarus(container, song));
}
