// Practice screen: read-only notation, big and legible, with the player on top.

import { renderNotation, redrawJarus } from '../render.js';
import { songToText } from '../text-export.js';
import { download, safeName } from '../download.js';
import { getSetting, setSetting } from '../storage.js';

const SCRIPTS = [['ta', 'தமிழ்'], ['en', 'English'], ['both', 'Both']];

export function scriptToggle(current, onPick) {
  const group = document.createElement('span');
  group.className = 'toolbar-group';
  for (const [value, label] of SCRIPTS) {
    const b = document.createElement('button');
    b.textContent = label;
    b.setAttribute('aria-pressed', String(value === current));
    b.onclick = () => onPick(value);
    group.append(b);
  }
  return group;
}

export function applyFontScale(scale) {
  document.documentElement.style.setProperty('--fs', String(scale));
}

export async function mountPractice(root, store, songId, { mountPlayer } = {}) {
  const song = await store.getSong(songId);
  root.replaceChildren();
  if (!song) {
    root.innerHTML = '<p>Song not found. <a href="#/">Back to songs</a></p>';
    return () => {};
  }

  const playerSlot = document.createElement('div');
  playerSlot.className = 'player-slot sticky';
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  const printHead = document.createElement('header');
  printHead.className = 'print-only print-head';
  const notation = document.createElement('div');
  root.append(playerSlot, toolbar, printHead, notation);
  const player = mountPlayer ? await mountPlayer(playerSlot, song) : null;

  let script = getSetting('script', 'both');
  let hideVariants = getSetting('hideVariants', false);
  let fontScale = getSetting('fontScale', 1);
  applyFontScale(fontScale);

  const draw = () => {
    toolbar.replaceChildren();
    const back = document.createElement('a');
    back.href = '#/';
    back.textContent = '← Songs';
    const title = document.createElement('strong');
    title.textContent = song.title + (song.raga ? ` · ${song.raga}` : '');
    const edit = document.createElement('a');
    edit.href = `#/edit/${song.id}`;
    edit.textContent = 'Edit';

    const variants = document.createElement('button');
    variants.textContent = 'R₂ numbers';
    variants.setAttribute('aria-pressed', String(!hideVariants));
    variants.onclick = () => { hideVariants = !hideVariants; setSetting('hideVariants', hideVariants); draw(); };

    const smaller = document.createElement('button');
    smaller.textContent = 'A−';
    smaller.onclick = () => { fontScale = Math.max(0.6, +(fontScale - 0.1).toFixed(2)); setSetting('fontScale', fontScale); applyFontScale(fontScale); };
    const bigger = document.createElement('button');
    bigger.textContent = 'A+';
    bigger.onclick = () => { fontScale = Math.min(2.5, +(fontScale + 0.1).toFixed(2)); setSetting('fontScale', fontScale); applyFontScale(fontScale); };

    const pdf = document.createElement('button');
    pdf.textContent = 'PDF / Print';
    pdf.title = 'Opens the print dialog. Choose "Save as PDF" to get a PDF file.';
    pdf.onclick = () => window.print();
    const txt = document.createElement('button');
    txt.textContent = 'Text';
    txt.title = 'Download as a plain-text file you can paste into messages or notes';
    txt.onclick = () => download(`${safeName(song.title)}.txt`,
      songToText(song, { script, hideVariants }), 'text/plain;charset=utf-8');

    const spacer = document.createElement('span');
    spacer.className = 'spacer';
    toolbar.append(back, title, spacer,
      scriptToggle(script, (s) => { script = s; setSetting('script', s); draw(); }),
      variants, smaller, bigger, pdf, txt, edit);

    printHead.replaceChildren();
    const h = document.createElement('h1');
    h.textContent = song.title || 'Untitled';
    const meta = [song.raga && `Raga: ${song.raga}`, song.tala && `Tala: ${song.tala}`].filter(Boolean);
    printHead.append(h);
    if (meta.length) printHead.append(Object.assign(document.createElement('p'), { textContent: meta.join(' · ') }));
    renderNotation(notation, song, { script, hideVariants });
  };
  draw();

  // Lay the page out at paper width before printing so the jaru lines are
  // measured where they will actually be printed, then restore afterwards.
  const beforePrint = () => {
    document.documentElement.classList.add('printing');
    redrawJarus(notation, song);
  };
  const afterPrint = () => {
    document.documentElement.classList.remove('printing');
    redrawJarus(notation, song);
  };
  window.addEventListener('beforeprint', beforePrint);
  window.addEventListener('afterprint', afterPrint);

  return () => {
    window.removeEventListener('beforeprint', beforePrint);
    window.removeEventListener('afterprint', afterPrint);
    afterPrint();
    player?.destroy();
  };
}
