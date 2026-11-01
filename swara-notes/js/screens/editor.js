// Editor screen (layout A): player strip on top, full-width notation below.

import { renderNotation } from '../render.js';
import { createPlayer } from '../player.js';
import { getSetting, setSetting } from '../storage.js';
import { createEditorState, applyKey, normalizeKey } from '../editor-keys.js';
import {
  setLyrics, clearSwaras, noteCount, addJaru, editSyllableText, setSyllableEn, splitSyllable,
} from '../model.js';
import { scriptToggle, applyFontScale } from './practice.js';

const KEY_HELP = [
  ['s r g m p d n', 'swara'], [',', 'rest / karvai'], ['1 2 3', 'variant of last swara (R1, R2…)'],
  ["'  ''", 'next swara 1 or 2 octaves up'], ['.  ..', 'next swara 1 or 2 octaves down'],
  ['/', 'start a jaru from the last swara; the next swara (or a clicked one) ends it'],
  ['Esc', 'cancel a started jaru or octave dot'],
  ['~  v  ^', 'kampita, pull (↓), sphurita — see Settings for your own'],
  ['Space / Tab', 'next syllable'], ['Shift+Tab', 'previous syllable'], ['Enter', 'next line'],
  ['Backspace', 'delete last swara'], ['Ctrl+Backspace', 'delete syllable'],
  ['Ctrl+Enter', 'insert empty column (held vowel)'], ['Ctrl+Shift+Enter', 'insert interlude line'],
  ['Alt+M', 'merge with next syllable'], ['|', 'tala marker (when enabled)'],
  ['Double-click', 'edit a syllable’s words (type a space to split it)'],
  ['Ctrl+Space', 'play / pause'], ['Ctrl+,  Ctrl+.', 'loop start / end'], ['Ctrl+/', 'clear loop'],
];

// Mount a player for a song, restoring its saved recording.
export async function mountSongPlayer(slot, store, song, onChange, onError) {
  const player = createPlayer(slot, {
    onFileChosen: async (file) => {
      song.recordingName = file.name;
      onChange?.();
      try {
        await store.putRecording(song.id, file);
      } catch {
        onError?.(`Couldn't keep "${file.name}" in the browser (too big or storage full). It plays now, but you'll need to choose it again next time.`);
      }
    },
  });
  const rec = await store.getRecording(song.id);
  if (rec) player.load(rec.blob, rec.name);
  else if (song.recordingName) {
    slot.querySelector('.file-pick span').textContent = `Choose recording (${song.recordingName})`;
  }
  return player;
}

function h(tag, props = {}, ...children) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
}

const isTyping = (t) => document.querySelector('dialog[open]') !== null
  || (t instanceof HTMLElement && t.closest('input, textarea, select') !== null);

export async function mountEditor(root, store, songId, { openSettings } = {}) {
  const song = await store.getSong(songId);
  root.replaceChildren();
  if (!song) {
    root.append(h('p', {}, 'Song not found. ', h('a', { href: '#/', textContent: 'Back to songs' })));
    return () => {};
  }

  const state = createEditorState(song);
  let script = getSetting('script', 'both');
  applyFontScale(getSetting('fontScale', 1));

  const saveError = h('div', { className: 'banner', hidden: true });
  let saveTimer = 0;
  const saveNow = () => {
    clearTimeout(saveTimer);
    return store.putSong(song).then(
      () => { saveError.hidden = true; },
      () => {
        saveError.textContent = 'Not saved! The browser refused to store this song. Go to Songs → Export to keep your work.';
        saveError.hidden = false;
      },
    );
  };
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
  };
  // Save straight away if the tab is closed, reloaded or hidden (phone/tablet app switch).
  const flush = () => { if (document.visibilityState === 'hidden') saveNow(); };
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', flush);
  const showError = (msg) => { saveError.textContent = msg; saveError.hidden = false; };

  const playerSlot = h('div', { className: 'player-slot sticky' });
  const toolbar = h('div', { className: 'toolbar' });
  const meta = h('div', { className: 'toolbar meta' });
  const status = h('div', { className: 'status muted' });
  const lyricsPanel = h('div', { className: 'lyrics-panel' });
  const helpPanel = h('div', { className: 'help-panel', hidden: true });
  const notation = h('div');
  root.append(saveError, playerSlot, toolbar, meta, lyricsPanel, helpPanel, status, notation);

  const player = await mountSongPlayer(playerSlot, store, song, save, showError);

  // --- toolbar ---
  const field = (label, key, width) => {
    const input = h('input', { value: song[key] ?? '', placeholder: label, title: label });
    input.style.width = width;
    input.oninput = () => { song[key] = input.value; save(); };
    return input;
  };
  const drawToolbar = () => {
    toolbar.replaceChildren(
      h('a', { href: '#/', textContent: '← Songs' }),
      h('span', { className: 'spacer' }),
      scriptToggle(script, (s) => { script = s; setSetting('script', s); drawToolbar(); draw(); }),
      h('button', { textContent: 'Lyrics', onclick: () => showLyrics(true) }),
      h('button', { textContent: 'Settings', onclick: () => openSettings?.(song, () => { save(); draw(); }) }),
      h('button', { textContent: 'Keys', onclick: () => { helpPanel.hidden = !helpPanel.hidden; } }),
      h('a', { href: `#/practice/${song.id}`, textContent: 'Practice' }),
    );
  };
  meta.append(field('Song title', 'title', '16em'), field('Raga', 'raga', '10em'), field('Tala (optional)', 'tala', '10em'));
  helpPanel.append(h('table', {}, ...KEY_HELP.map(([k, d]) => h('tr', {}, h('td', {}, h('kbd', { textContent: k })), h('td', { textContent: d })))));

  // --- lyrics paste ---
  function showLyrics(open) {
    lyricsPanel.replaceChildren();
    if (!open) return;
    let from = song.lyricsFrom ?? 'ta';
    const shown = song.lyricScripts ?? { ta: true, en: true };
    const joined = (key) => song.lines.map((l) => l.syllables.map((s) => s[key]).join(' ')).join('\n');
    // Prefer exactly what was pasted; older songs fall back to the syllables.
    const ta = h('textarea', { rows: 8, value: song.lyricsSource ?? joined(from === 'en' ? 'lyricEn' : 'lyricTa') });
    ta.style.width = '100%';
    const placeholder = () => {
      ta.placeholder = from === 'en'
        ? 'Paste lyrics in English letters (e.g. naan unnai…), one line per line of the song'
        : 'Paste Tamil lyrics here, one line per line of the song';
    };
    placeholder();
    const radio = (value, label) => {
      const r = h('input', { type: 'radio', name: 'lyrics-from', value, checked: from === value });
      r.onchange = () => { from = value; placeholder(); otherLabel.lastChild.textContent = otherText(); };
      return h('label', {}, r, ` ${label}`);
    };
    const otherText = () => (from === 'en' ? ' Also write them in Tamil script for me' : ' Also write them in English letters for me');
    const other = h('input', { type: 'checkbox', checked: song.lines.length ? (from === 'en' ? shown.ta : shown.en) : true });
    const otherLabel = h('label', {}, other, h('span', { textContent: otherText() }));
    const options = h('div', { className: 'toolbar lyrics-options' },
      h('strong', { textContent: 'These lyrics are in:' }), radio('ta', 'தமிழ் (Tamil script)'), radio('en', 'English letters'), otherLabel);
    const hint = h('p', { className: 'muted', textContent: 'Converting from English letters is a best guess — double-click any syllable to fix it. Tips: aa = ா, ee = ீ, zh = ழ, N = ண, L = ள, R = ற.' });
    const use = h('button', {
      className: 'primary', textContent: 'Use these lyrics',
      onclick: () => {
        if (noteCount(song) > 0) {
          if (!confirm('This clears all swaras for this song. Continue?')) return;
          clearSwaras(song);
        }
        setLyrics(song, ta.value, { from, other: other.checked });
        state.cursor = { lineIdx: 0, sylIdx: 0 };
        state.lastNoteId = null;
        showLyrics(false);
        save(); draw();
      },
    });
    const cancel = h('button', { textContent: 'Cancel', onclick: () => showLyrics(false) });
    lyricsPanel.append(options, ta, hint, h('div', { className: 'toolbar' }, use, song.lines.length ? cancel : ''));
    ta.focus();
  }

  // --- syllable words editor ---
  const dialog = h('dialog', { className: 'syl-dialog' });
  root.append(dialog);
  function editSyllable(lineIdx, sylIdx) {
    const syl = song.lines[lineIdx]?.syllables[sylIdx];
    if (!syl) return;
    const ta = h('input', { value: syl.lyricTa, placeholder: 'Tamil' });
    const en = h('input', { value: syl.lyricEnOverride ? syl.lyricEn : '', placeholder: `English (auto: ${syl.lyricEn})` });
    const form = h('form', { method: 'dialog' },
      h('label', {}, 'Tamil ', ta), h('label', {}, 'English ', en),
      h('p', { className: 'muted', textContent: 'Type a space in the Tamil text to split the syllable there. Leave English empty for automatic.' }),
      h('div', { className: 'toolbar' }, h('button', { className: 'primary', value: 'ok', textContent: 'Save' }), h('button', { value: 'cancel', textContent: 'Cancel' })));
    dialog.replaceChildren(form);
    dialog.onclose = () => {
      if (dialog.returnValue !== 'ok') return;
      const text = ta.value.trim();
      const space = [...text].indexOf(' ');
      if (space > 0) {
        editSyllableText(song, syl.id, text.replace(/\s+/, ''));
        splitSyllable(song, syl.id, space);
      } else {
        editSyllableText(song, syl.id, text);
      }
      setSyllableEn(song, syl.id, en.value.trim());
      save(); draw();
    };
    dialog.showModal();
    ta.focus();
  }

  // --- notation ---
  function draw() {
    if (!song.lines.length) { showLyrics(true); }
    const oct = state.pendingOctave;
    status.textContent = [
      oct ? `Next swara: ${oct > 0 ? 'up' : 'down'} ${Math.abs(oct)} octave${Math.abs(oct) > 1 ? 's' : ''}` : '',
      state.pendingJaruFrom ? 'Jaru started — type or click the end swara' : '',
    ].filter(Boolean).join(' · ') || 'Click a syllable, then type swaras. Press Keys for help.';
    renderNotation(notation, song, {
      script, hideVariants: false, cursor: state.cursor, pendingJaruFrom: state.pendingJaruFrom,
      onSyllableClick: (lineIdx, sylIdx) => {
        state.cursor = { lineIdx, sylIdx };
        const notes = song.lines[lineIdx].syllables[sylIdx].notes;
        state.lastNoteId = notes.length ? notes[notes.length - 1].id : null;
        draw();
      },
      onNoteClick: (noteId) => {
        if (!state.pendingJaruFrom) return false;
        addJaru(song, state.pendingJaruFrom, noteId);
        state.pendingJaruFrom = null;
        save(); draw();
        return true;
      },
      onSyllableDblClick: editSyllable,
    });
    notation.querySelector('.syl.cursor')?.scrollIntoView({ block: 'nearest' });
  }

  function onKey(e) {
    if (isTyping(e.target)) return;
    const key = normalizeKey(e);
    if (key === null) return;
    const { handled } = applyKey(state, { key, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey });
    if (!handled) return;
    e.preventDefault();
    save(); draw();
  }
  document.addEventListener('keydown', onKey);

  drawToolbar();
  draw();

  return () => {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('pagehide', saveNow);
    document.removeEventListener('visibilitychange', flush);
    saveNow();
    player.destroy();
  };
}
