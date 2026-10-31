// Swara names, scripts and variant rules.

export const SWARAS = Object.freeze(['S', 'R', 'G', 'M', 'P', 'D', 'N']);

export const TAMIL = Object.freeze({
  S: 'ஸ', R: 'ரி', G: 'க', M: 'ம', P: 'ப', D: 'த', N: 'நி', ',': ',',
});

const SUBSCRIPT = ['', '₁', '₂', '₃'];

// S and P (and the rest) have no variants; M has two; R G D N have three.
export function maxVariant(swara) {
  if (swara === 'M') return 2;
  if (swara === 'R' || swara === 'G' || swara === 'D' || swara === 'N') return 3;
  return 0;
}

export function isValidVariant(swara, v) {
  return Number.isInteger(v) && v >= 1 && v <= maxVariant(swara);
}

export function swaraDisplay(note, script) {
  const base = script === 'ta' ? TAMIL[note.swara] : note.swara;
  const sub = isValidVariant(note.swara, note.variant) ? SUBSCRIPT[note.variant] : '';
  return { base, sub, octave: note.octave ?? 0 };
}

// "R2 G3 M1 D2 N3" -> { R: 2, G: 3, M: 1, D: 2, N: 3 }; invalid tokens are ignored.
export function parseScale(str) {
  const scale = {};
  for (const token of String(str).toUpperCase().split(/[\s,]+/)) {
    const m = /^([SRGMPDN])([1-3])$/.exec(token);
    if (m && isValidVariant(m[1], Number(m[2]))) scale[m[1]] = Number(m[2]);
  }
  return scale;
}

export function formatScale(scale) {
  return SWARAS.filter((s) => scale[s]).map((s) => s + scale[s]).join(' ');
}
