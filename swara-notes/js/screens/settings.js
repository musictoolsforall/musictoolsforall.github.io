// Song settings: default raga scale, tala markers, and the gamaka table.

import { parseScale, formatScale } from '../swara.js';
import { gamakaKeyError, gamakaUsage } from '../model.js';
import { setSetting } from '../storage.js';

function h(tag, props = {}, ...children) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
}

export function openSettings(song, onChange) {
  const dialog = h('dialog', { className: 'settings-dialog' });
  document.body.append(dialog);

  const scale = h('input', { value: formatScale(song.defaultScale ?? {}), placeholder: 'e.g. R2 G3 M1 D2 N3' });
  const scaleNote = h('span', { className: 'muted' });
  const showScale = () => {
    const parsed = formatScale(parseScale(scale.value));
    scaleNote.textContent = parsed ? `Will use: ${parsed}` : 'No default — swaras get no number unless you type one.';
  };
  scale.oninput = showScale;
  showScale();

  const tala = h('input', { type: 'checkbox', checked: song.useTalaMarkers });

  const table = song.gamakaTable.map((g) => ({ ...g }));
  const rows = h('tbody');
  const error = h('p', { className: 'error' });

  const drawRows = () => {
    rows.replaceChildren(h('tr', {},
      h('td', { textContent: 'Jaru' }), h('td', { textContent: 'line above notes' }), h('td', {}, h('kbd', { textContent: '/' })), h('td')));
    for (const g of table) {
      const name = h('input', { value: g.name, oninput: () => { g.name = name.value; } });
      const mark = h('input', { value: g.mark, size: 3, oninput: () => { g.mark = mark.value; } });
      const key = h('input', { value: g.key, size: 2, maxLength: 2, oninput: () => { g.key = key.value; } });
      const del = h('button', {
        type: 'button', textContent: 'Remove',
        onclick: () => {
          const used = gamakaUsage(song, g.id);
          if (used && !confirm(`${g.name} is used on ${used} note${used > 1 ? 's' : ''}. Removing it deletes those marks when you press Save. Remove?`)) return;
          table.splice(table.indexOf(g), 1);
          drawRows();
          dialog.focus();
        },
      });
      rows.append(h('tr', {}, h('td', {}, name), h('td', {}, mark), h('td', {}, key), h('td', {}, del)));
    }
  };
  drawRows();

  const add = h('button', {
    type: 'button', textContent: 'Add gamaka',
    onclick: () => { table.push({ id: crypto.randomUUID(), name: 'New gamaka', mark: '?', key: '' }); drawRows(); },
  });

  const save = h('button', { type: 'button', className: 'primary', textContent: 'Save' });
  const cancel = h('button', { type: 'button', textContent: 'Cancel', onclick: () => dialog.close() });
  save.onclick = () => {
    // Newest rows first, so a clash names the gamaka you just added.
    for (const g of [...table].reverse()) {
      const msg = gamakaKeyError(table, g.key, g.id);
      if (msg) { error.textContent = `${g.name || 'Gamaka'}: key “${g.key}” — ${msg}`; return; }
      if (!g.mark.trim()) { error.textContent = `${g.name || 'Gamaka'}: give it a mark.`; return; }
    }
    // Remove marks for gamakas that no longer exist.
    const ids = new Set(table.map((g) => g.id));
    for (const l of song.lines) for (const s of l.syllables) for (const n of s.notes) {
      n.gamakas = n.gamakas.filter((id) => ids.has(id));
    }
    song.defaultScale = parseScale(scale.value);
    song.useTalaMarkers = tala.checked;
    song.gamakaTable = table;
    song.updatedAt = Date.now();
    setSetting('gamakaTable', table); // new songs start with your table
    dialog.close();
    onChange?.();
  };

  dialog.append(
    h('h2', { textContent: 'Song settings' }),
    h('label', {}, h('strong', { textContent: 'Raga scale ' }), scale), scaleNote,
    h('p', { className: 'muted', textContent: 'Swaras typed without a number take this variant. Typing a number (r1, g2…) always wins.' }),
    h('label', {}, tala, ' Use tala markers ( | and || )'),
    h('h3', { textContent: 'Gamakas' }),
    h('p', { className: 'muted', textContent: 'All marks are drawn above the note. Your table is also used for new songs.' }),
    h('table', { className: 'gamaka-table' },
      h('thead', {}, h('tr', {}, ...['Name', 'Mark', 'Key', ''].map((t) => h('th', { textContent: t })))), rows),
    add, error,
    h('div', { className: 'toolbar' }, save, cancel),
  );
  dialog.onclose = () => dialog.remove();
  dialog.showModal();
}
