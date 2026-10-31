// Split Tamil lyrics into lines of syllables.

const PULLI = '்';
const TRAILING_PUNCT = /^[,.!?…]+$/;

const isVowel = (c) => c >= 'அ' && c <= 'ஔ';
const isConsonant = (c) => c >= 'க' && c <= 'ஹ';
const isSign = (c) => (c >= 'ா' && c <= '்') || c === 'ௗ';
const isAytham = (c) => c === 'ஃ';
const isTamil = (c) => isVowel(c) || isConsonant(c) || isSign(c) || isAytham(c);

// Break a word into raw units: Tamil letters (consonant + signs, vowel, ஃ)
// and runs of non-Tamil characters.
function units(word) {
  const out = [];
  const chars = [...word];
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    if (isConsonant(c)) {
      let u = c;
      while (i + 1 < chars.length && isSign(chars[i + 1])) u += chars[++i];
      out.push({ text: u, tamil: true });
    } else if (isTamil(c)) {
      out.push({ text: c, tamil: true });
    } else {
      let u = c;
      while (i + 1 < chars.length && !isTamil(chars[i + 1])) u += chars[++i];
      out.push({ text: u, tamil: false });
    }
    i++;
  }
  return out;
}

function splitWord(word) {
  const syllables = [];
  let carry = ''; // word-initial pulli consonants waiting for the next unit
  let prevTamil = false;
  for (const u of units(word)) {
    if (u.tamil && u.text.endsWith(PULLI)) {
      if (syllables.length && prevTamil) syllables[syllables.length - 1] += u.text;
      else carry += u.text;
    } else if (!u.tamil && prevTamil && TRAILING_PUNCT.test(u.text)) {
      syllables[syllables.length - 1] += u.text;
    } else {
      syllables.push(carry + u.text);
      carry = '';
      prevTamil = u.tamil;
    }
  }
  if (carry) syllables.push(carry);
  return syllables;
}

export function splitLyrics(text) {
  return String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/).flatMap(splitWord));
}
