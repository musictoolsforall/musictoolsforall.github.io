// Export/import a song as a single JSON file, optionally with its recording.

import { FORMAT_VERSION, DEFAULT_GAMAKAS } from './model.js';

const APP = 'swara-notes';

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function base64ToBlob(data, type) {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function exportSong(song, recording) {
  const out = { app: APP, formatVersion: FORMAT_VERSION, song };
  if (recording) {
    out.recording = {
      name: recording.name, type: recording.type, dataBase64: await blobToBase64(recording.blob),
    };
  }
  return JSON.stringify(out);
}

export function importSong(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This is not a valid song file.');
  }
  if (!data || data.app !== APP) throw new Error('This is not a Swara Notes file.');
  if (typeof data.formatVersion !== 'number' || data.formatVersion > FORMAT_VERSION) {
    throw new Error('This file was made by a newer version of Swara Notes.');
  }
  const valid = data.song && Array.isArray(data.song.lines) && data.song.lines.every((l) =>
    Array.isArray(l?.syllables) && l.syllables.every((s) => s && Array.isArray(s.notes)));
  if (!valid) throw new Error('This is not a valid song file.');

  // A fresh id means importing never overwrites an existing song.
  const song = {
    ...data.song,
    jarus: Array.isArray(data.song.jarus) ? data.song.jarus : [],
    gamakaTable: Array.isArray(data.song.gamakaTable) ? data.song.gamakaTable : DEFAULT_GAMAKAS.map((g) => ({ ...g })),
    defaultScale: data.song.defaultScale ?? {},
    id: crypto.randomUUID(),
    updatedAt: Date.now(),
  };
  const r = data.recording;
  const recording = r?.dataBase64
    ? { name: r.name ?? '', type: r.type ?? '', blob: base64ToBlob(r.dataBase64, r.type ?? '') }
    : null;
  return { song, recording };
}
