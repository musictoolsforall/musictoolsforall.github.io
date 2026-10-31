// English letters -> Tamil script, using the common phonetic typing
// convention (aa = ா, zh = ழ, capital N/L/R = ண/ள/ற). It's a best guess:
// some letters (n, l, r) can be more than one Tamil letter, and the user
// fixes those per syllable.

// Longest spellings first. Capitals matter only inside a word.
const CONSONANTS = [
  ['ng', 'ங'], ['nj', 'ஞ'], ['zh', 'ழ'], ['th', 'த'], ['dh', 'த'], ['ch', 'ச'], ['sh', 'ஷ'],
  ['k', 'க'], ['g', 'க'], ['q', 'க'], ['c', 'ச'], ['s', 'ச'], ['S', 'ஸ'], ['j', 'ஜ'],
  ['t', 'ட'], ['T', 'ட'], ['d', 'ட'], ['D', 'ட'], ['N', 'ண'], ['n', 'ன'], ['p', 'ப'],
  ['b', 'ப'], ['f', 'ப'], ['m', 'ம'], ['y', 'ய'], ['r', 'ர'], ['R', 'ற'], ['l', 'ல'],
  ['L', 'ள'], ['v', 'வ'], ['w', 'வ'], ['h', 'ஹ'], ['z', 'ஜ'], ['x', 'க்ஸ'],
];

// [spelling, independent vowel, vowel sign after a consonant]
const VOWELS = [
  ['aa', 'ஆ', 'ா'], ['ai', 'ஐ', 'ை'], ['au', 'ஔ', 'ௌ'], ['ee', 'ஈ', 'ீ'], ['ii', 'ஈ', 'ீ'],
  ['oo', 'ஊ', 'ூ'], ['uu', 'ஊ', 'ூ'], ['ae', 'ஏ', 'ே'], ['oa', 'ஓ', 'ோ'],
  ['A', 'ஆ', 'ா'], ['I', 'ஈ', 'ீ'], ['U', 'ஊ', 'ூ'], ['E', 'ஏ', 'ே'], ['O', 'ஓ', 'ோ'],
  ['a', 'அ', ''], ['i', 'இ', 'ி'], ['u', 'உ', 'ு'], ['e', 'எ', 'ெ'], ['o', 'ஒ', 'ொ'],
];

const PULLI = '்';
const DENTAL_NEXT = new Set(['த']); // n before th/dh is ந்

function match(table, word, i) {
  return table.find(([spelling]) => word.startsWith(spelling, i)) ?? null;
}

function convertWord(raw) {
  // A capital at the start of a word is just sentence case, not ண/ள/ற.
  const word = raw.length ? raw[0].toLowerCase() + raw.slice(1) : raw;
  const tokens = [];
  for (let i = 0; i < word.length;) {
    const v = match(VOWELS, word, i);
    if (v) { tokens.push({ type: 'v', v }); i += v[0].length; continue; }
    const c = match(CONSONANTS, word, i) ?? match(CONSONANTS, word.toLowerCase(), i);
    if (c) { tokens.push({ type: 'c', spelling: c[0], ta: c[1] }); i += c[0].length; continue; }
    tokens.push({ type: 'x', text: word[i] }); i += 1;
  }

  let out = '';
  for (const [i, t] of tokens.entries()) {
    if (t.type === 'x') { out += t.text; continue; }
    if (t.type === 'v') {
      const prev = tokens[i - 1];
      out += prev?.type === 'c' ? t.v[2] : t.v[1];
      continue;
    }
    let ta = t.ta;
    if (t.spelling === 'n') {
      const next = tokens[i + 1];
      const wordStart = i === 0 || tokens[i - 1].type === 'x';
      if (wordStart || (next?.type === 'c' && DENTAL_NEXT.has(next.ta))) ta = 'ந';
    }
    out += ta;
    if (tokens[i + 1]?.type !== 'v') out += PULLI;
  }
  return out;
}

export function toTamil(text) {
  return String(text).replace(/[A-Za-z]+/g, convertWord);
}
