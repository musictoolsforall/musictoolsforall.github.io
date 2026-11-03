// A small step-by-step guide: a card in the corner that explains one part of
// the screen at a time and outlines that part. It doesn't block the page, so
// the user can try things (e.g. type swaras) while the card is open.
//
// step = { title, html, target?: () => Element | null }
// `html` is our own fixed text (with <kbd> etc.), never user content.

export function startTour(steps, { onDone } = {}) {
  let i = 0;
  let outlined = null;

  const card = document.createElement('div');
  card.className = 'tour-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-live', 'polite');
  card.setAttribute('aria-label', 'Guide');
  document.body.append(card);

  const unmark = () => { outlined?.classList.remove('tour-target'); outlined = null; };

  function stop() {
    unmark();
    document.body.style.paddingBottom = '';
    card.remove();
    onDone?.();
  }

  function show() {
    const step = steps[i];
    unmark();
    const target = step.target?.() ?? null;
    if (target) {
      target.classList.add('tour-target');
      outlined = target;
    }

    card.replaceChildren();
    const count = document.createElement('p');
    count.className = 'tour-count';
    count.textContent = `${i + 1} of ${steps.length}`;
    const h = document.createElement('h2');
    h.textContent = step.title;
    const body = document.createElement('div');
    body.className = 'tour-body';
    body.innerHTML = step.html;

    const nav = document.createElement('div');
    nav.className = 'tour-nav';
    const skip = button(i === steps.length - 1 ? '' : 'Skip guide', stop, 'tour-skip');
    const back = button('Back', () => { i--; show(); });
    back.disabled = i === 0;
    const last = i === steps.length - 1;
    const next = button(last ? 'Start writing' : 'Next', () => { if (last) stop(); else { i++; show(); } }, 'primary');
    if (skip.textContent) nav.append(skip);
    nav.append(back, next);

    card.append(count, h, body, nav);
    next.focus({ preventScroll: true });
    if (target) keepVisible(target, card);
  }

  show();
  return stop;
}

function button(text, onclick, className = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.className = className;
  // Space/Enter/Tab belong to the button; other keys (s, r, g…) still reach
  // the editor so the user can try typing while the guide is open.
  b.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Tab') e.stopPropagation();
  });
  b.onclick = onclick;
  return b;
}

// Scroll so the outlined part sits above the card (on a phone the card covers
// the lower half of the screen). Extra page padding makes room to scroll.
function keepVisible(target, card) {
  const cardTop = card.getBoundingClientRect().top;
  document.body.style.paddingBottom = `${window.innerHeight - cardTop + 16}px`;
  // Anything stuck to the top of the screen (the player) also hides content.
  let topLimit = 16;
  for (const el of document.querySelectorAll('.sticky')) {
    if (!el.contains(target)) topLimit = Math.max(topLimit, el.getBoundingClientRect().bottom + 12);
  }
  const r = target.getBoundingClientRect();
  if (r.top >= topLimit && r.bottom <= cardTop - 12) return;
  // Move the target to just above the card, but never push its top under
  // the player when it's taller than the gap.
  const shift = r.top < topLimit ? r.top - topLimit : Math.min(r.bottom - (cardTop - 12), r.top - topLimit);
  window.scrollBy({ top: shift, behavior: 'smooth' });
}
