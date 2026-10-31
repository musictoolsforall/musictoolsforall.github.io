// Render a song's notation into a container, with jaru lines drawn in an
// SVG overlay that is recomputed whenever the layout changes.

import { swaraDisplay } from './swara.js';
import { jaruSegments } from './jaru-geom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
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
  if (opts.script !== 'en') col.append(el('div', 'ly ly-ta', empty ? '—' : syl.lyricTa));
  if (opts.script !== 'ta') col.append(el('div', 'ly ly-en', empty ? '—' : syl.lyricEn));
  return col;
}

function drawJarus(container, song) {
  const svg = container.querySelector('svg.jarus');
  if (!svg) return;
  svg.replaceChildren();
  const base = container.getBoundingClientRect();
  svg.setAttribute('width', container.scrollWidth);
  svg.setAttribute('height', container.scrollHeight);

  const rel = (r) => ({ left: r.left - base.left, right: r.right - base.left, top: r.top - base.top });

  // Visual rows = groups of top swara rows sharing a vertical position.
  const rowsByTop = new Map();
  for (const top of container.querySelectorAll('.sw-top')) {
    const r = rel(top.getBoundingClientRect());
    const key = Math.round(r.top);
    const row = rowsByTop.get(key);
    if (row) { row.left = Math.min(row.left, r.left); row.right = Math.max(row.right, r.right); }
    else rowsByTop.set(key, { ...r, top: key });
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
      const line = document.createElementNS(SVG_NS, 'line');
      const y = s.y + 6; // just above the swara glyphs, inside the row's top padding
      line.setAttribute('x1', s.x1); line.setAttribute('x2', s.x2);
      line.setAttribute('y1', y); line.setAttribute('y2', y);
      line.setAttribute('class', 'jaru');
      svg.append(line);
    }
  }
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
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'jarus');
  svg.setAttribute('aria-hidden', 'true');
  container.append(svg);

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
