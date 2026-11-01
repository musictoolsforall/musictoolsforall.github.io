// Tamil -> readable English letters. Lossy on purpose ("naa", "zha"),
// the user can override any syllable.

const CONSONANTS = {
  'க': 'k', 'ங': 'ng', 'ச': 'ch', 'ஞ': 'nj', 'ட': 't', 'ண': 'n', 'த': 'th', 'ந': 'n',
  'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l',
  'ற': 'r', 'ன': 'n', 'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h',
};

const VOWELS = {
  'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo', 'எ': 'e', 'ஏ': 'ae',
  'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'o', 'ஔ': 'au', 'ஃ': 'h',
};

const SIGNS = {
  'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo', 'ெ': 'e', 'ே': 'ae', 'ை': 'ai',
  'ொ': 'o', 'ோ': 'o', 'ௌ': 'au', '்': '',
};

export function transliterate(syllable) {
  const chars = [...syllable];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (CONSONANTS[c] !== undefined) {
      out += CONSONANTS[c];
      const next = chars[i + 1];
      if (next !== undefined && SIGNS[next] !== undefined) {
        out += SIGNS[next];
        i++;
      } else {
        out += 'a'; // inherent vowel
      }
    } else if (VOWELS[c] !== undefined) {
      out += VOWELS[c];
    } else if (SIGNS[c] === undefined) {
      out += c; // non-Tamil passes through
    }
  }
  return out;
}
