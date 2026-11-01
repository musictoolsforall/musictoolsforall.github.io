// IndexedDB storage for songs and recordings, with an in-memory fallback
// when the browser won't give us storage (private window, blocked data).

const DB_NAME = 'swara-notes';
const SETTINGS_PREFIX = 'swara-notes:';

const byUpdatedDesc = (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0);

function memoryStore() {
  const songs = new Map();
  const recordings = new Map();
  return {
    persistent: false,
    async listSongs() { return [...songs.values()].map((s) => structuredClone(s)).sort(byUpdatedDesc); },
    async getSong(id) { return songs.has(id) ? structuredClone(songs.get(id)) : null; },
    async putSong(song) { songs.set(song.id, structuredClone(song)); },
    async deleteSong(id) { songs.delete(id); recordings.delete(id); },
    async getRecording(songId) { return recordings.get(songId) ?? null; },
    async putRecording(songId, file) {
      recordings.set(songId, { songId, name: file.name ?? '', type: file.type ?? '', blob: file });
    },
    async deleteRecording(songId) { recordings.delete(songId); },
  };
}

const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('songs', { keyPath: 'id' });
      r.result.createObjectStore('recordings', { keyPath: 'songId' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('database blocked'));
  });
}

function idbStore(db) {
  const tx = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);
  return {
    persistent: true,
    async listSongs() { return (await req(tx('songs').getAll())).sort(byUpdatedDesc); },
    async getSong(id) { return (await req(tx('songs').get(id))) ?? null; },
    async putSong(song) { await req(tx('songs', 'readwrite').put(song)); },
    async deleteSong(id) {
      const t = db.transaction(['songs', 'recordings'], 'readwrite');
      t.objectStore('songs').delete(id);
      t.objectStore('recordings').delete(id);
      await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = () => reject(t.error); });
    },
    async getRecording(songId) { return (await req(tx('recordings').get(songId))) ?? null; },
    async putRecording(songId, file) {
      await req(tx('recordings', 'readwrite').put({
        songId, name: file.name ?? '', type: file.type ?? '', blob: file,
      }));
    },
    async deleteRecording(songId) { await req(tx('recordings', 'readwrite').delete(songId)); },
  };
}

export async function openStore() {
  try {
    if (typeof indexedDB === 'undefined') return memoryStore();
    return idbStore(await openDb());
  } catch {
    return memoryStore();
  }
}

export function getSetting(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setSetting(key, value) {
  try {
    globalThis.localStorage?.setItem(SETTINGS_PREFIX + key, JSON.stringify(value));
  } catch {
    // Settings are a convenience; losing them is fine.
  }
}
