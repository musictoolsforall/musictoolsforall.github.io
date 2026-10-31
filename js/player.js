// Recording player: local file, A–B loop, slow-down without changing pitch.

const fmt = (t) => {
  if (!Number.isFinite(t)) return '0:00';
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

function button(label, title, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  if (title) b.title = title;
  b.onclick = onClick;
  return b;
}

export function createPlayer(container, { onFileChosen } = {}) {
  const audio = new Audio();
  audio.preservesPitch = true;
  let url = null;
  let loop = null; // { a, b } in seconds
  let raf = 0;

  const wrap = document.createElement('div');
  wrap.className = 'player';

  const fileLabel = document.createElement('label');
  fileLabel.className = 'file-pick';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*,video/*';
  fileInput.hidden = true;
  const fileName = document.createElement('span');
  fileName.textContent = 'Choose recording';
  fileLabel.append(fileInput, fileName);
  fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    load(file, file.name);
    onFileChosen?.(file);
  };

  const playBtn = button('▶', 'Play / pause (Ctrl+Space)', () => toggle());
  const time = document.createElement('span');
  time.className = 'time';

  const bar = document.createElement('div');
  bar.className = 'bar';
  const loopRegion = document.createElement('div');
  loopRegion.className = 'loop-region';
  const head = document.createElement('div');
  head.className = 'head';
  bar.append(loopRegion, head);
  bar.onclick = (e) => {
    if (!audio.duration) return;
    const r = bar.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  };

  const speed = document.createElement('select');
  speed.title = 'Speed';
  for (const v of [0.5, 0.75, 1]) speed.append(new Option(`${v}×`, v, v === 1, v === 1));
  speed.onchange = () => { audio.playbackRate = Number(speed.value); };

  const aBtn = button('A', 'Loop start (Ctrl+,)', () => setLoop(audio.currentTime, loop?.b ?? audio.duration));
  const bBtn = button('B', 'Loop end (Ctrl+.)', () => setLoop(loop?.a ?? 0, audio.currentTime));
  const clearBtn = button('✕', 'Clear loop (Ctrl+/)', () => clearLoop());

  wrap.append(fileLabel, playBtn, time, bar, speed, aBtn, bBtn, clearBtn);
  container.append(wrap);

  function update() {
    const d = audio.duration || 0;
    time.textContent = `${fmt(audio.currentTime)} / ${fmt(d)}`;
    head.style.left = d ? `${(audio.currentTime / d) * 100}%` : '0';
    if (loop && d) {
      loopRegion.hidden = false;
      loopRegion.style.left = `${(loop.a / d) * 100}%`;
      loopRegion.style.width = `${((loop.b - loop.a) / d) * 100}%`;
    } else {
      loopRegion.hidden = true;
    }
    playBtn.textContent = audio.paused ? '▶' : '❚❚';
  }

  function checkLoop() {
    if (loop && audio.currentTime >= loop.b) audio.currentTime = loop.a;
  }

  function tick() {
    checkLoop();
    update();
    if (!audio.paused) raf = requestAnimationFrame(tick);
  }

  audio.addEventListener('timeupdate', () => { checkLoop(); update(); });
  audio.addEventListener('loadedmetadata', update);
  audio.addEventListener('play', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
  audio.addEventListener('pause', update);

  function load(blob, name) {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    audio.src = url;
    audio.playbackRate = Number(speed.value);
    fileName.textContent = name || 'Recording';
    loop = null;
    update();
  }

  function setLoop(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    loop = a < b ? { a, b } : { a: b, b: a };
    if (loop.b - loop.a < 0.2) loop = null;
    update();
  }

  function clearLoop() { loop = null; update(); }

  function toggle() {
    if (!audio.src) { fileInput.click(); return; }
    if (audio.paused) {
      if (loop && (audio.currentTime < loop.a || audio.currentTime >= loop.b)) audio.currentTime = loop.a;
      audio.play();
    } else {
      audio.pause();
    }
  }

  function onKey(e) {
    if (!e.ctrlKey) return;
    const actions = {
      ' ': () => toggle(),
      ',': () => setLoop(audio.currentTime, loop?.b ?? audio.duration),
      '.': () => setLoop(loop?.a ?? 0, audio.currentTime),
      '/': () => clearLoop(),
    };
    const act = actions[e.key];
    if (act) { e.preventDefault(); e.stopImmediatePropagation(); act(); }
  }
  // Capture phase so player shortcuts run before the editor's key handling.
  document.addEventListener('keydown', onKey, true);

  function destroy() {
    document.removeEventListener('keydown', onKey, true);
    cancelAnimationFrame(raf);
    audio.pause();
    if (url) URL.revokeObjectURL(url);
    wrap.remove();
  }

  update();
  return { load, setLoop, clearLoop, toggle, destroy, audio };
}
