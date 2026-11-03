// Song list: create, open, export, import, delete.

import { createSong } from '../model.js';
import { exportSong, importSong } from '../export.js';
import { getSetting } from '../storage.js';
import { download, safeName } from '../download.js';

function h(tag, props = {}, ...children) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
}

export async function mountList(root, store) {
  const message = h('p', { className: 'message', role: 'status' });
  const list = h('div', { className: 'song-list' });

  const newBtn = h('button', {
    className: 'primary', textContent: 'New song',
    onclick: async () => {
      const title = prompt('Song title');
      if (!title) return;
      const song = createSong(title.trim());
      const table = getSetting('gamakaTable', null);
      if (Array.isArray(table) && table.length) song.gamakaTable = table;
      await store.putSong(song);
      location.hash = `#/edit/${song.id}`;
    },
  });

  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const { song, recording } = importSong(await file.text());
      await store.putSong(song);
      if (recording) await store.putRecording(song.id, Object.assign(recording.blob, { name: recording.name }));
      message.textContent = `Imported “${song.title}”.`;
      message.className = 'message';
      draw();
    } catch (err) {
      message.textContent = `Could not import ${file.name}: ${err.message}`;
      message.className = 'message error';
    }
  };
  const importBtn = h('button', { textContent: 'Import', onclick: () => fileInput.click() });

  async function exportOne(song) {
    const rec = await store.getRecording(song.id);
    let include = false;
    if (rec) include = confirm(`Include the recording (${rec.name}) in the file?\n\nOK = include it (bigger file)\nCancel = notation only`);
    download(`${safeName(song.title)}.swara.json`, await exportSong(song, include ? rec : undefined));
  }

  async function draw() {
    const songs = await store.listSongs();
    list.replaceChildren();
    if (!songs.length) {
      list.append(h('p', { className: 'muted' }, 'No songs yet. Start a new one, or ', h('a', { href: '#/practice/demo', textContent: 'look at the demo' }), '.'));
      return;
    }
    for (const song of songs) {
      const when = new Date(song.updatedAt).toLocaleString();
      list.append(h('div', { className: 'song-row' },
        h('div', { className: 'song-info' },
          h('a', { href: `#/edit/${song.id}`, className: 'song-title', textContent: song.title || 'Untitled' }),
          h('span', { className: 'muted', textContent: [song.raga, `edited ${when}`].filter(Boolean).join(' · ') })),
        h('div', { className: 'toolbar' },
          h('a', { href: `#/practice/${song.id}`, textContent: 'Practice' }),
          h('button', { textContent: 'Export', onclick: () => exportOne(song) }),
          h('button', {
            textContent: 'Delete',
            onclick: async () => {
              if (!confirm(`Delete “${song.title}”? Export it first if you want a backup.`)) return;
              await store.deleteSong(song.id);
              draw();
            },
          }))));
    }
  }

  root.replaceChildren(
    h('a', { href: '../', textContent: '← All tools' }),
    h('h1', { textContent: 'Swara Notes' }),
    h('p', { className: 'muted', textContent: 'Your songs and recordings stay in this browser. Use Export to back up or move a song to another device.' }),
    getSetting('tourSeen', false) ? '' : h('p', { className: 'welcome' },
      h('strong', { textContent: 'New here? ' }),
      'Open the ', h('a', { href: '#/edit/demo', textContent: 'demo song' }),
      ' for a one-minute guide to writing swaras, then press New song to start your own.'),
    h('div', { className: 'toolbar' }, newBtn, importBtn, fileInput),
    message, list,
  );
  await draw();
  return () => {};
}
