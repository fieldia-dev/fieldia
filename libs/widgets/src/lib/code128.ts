/**
 * A Code 128 barcode made from words (ISO/IEC 15417): letters, digits and the signs of plain ASCII, each in the code
 * set that writes it — B for printable characters, A for a control character, C for a run of digits, two to a symbol,
 * where a run is long enough to save room — with its check symbol and its stop. The result is the widths of its bars
 * and spaces, in modules, a bar first: what the codes part draws (codes.ts).
 */

/** Each symbol's bars and spaces, in modules, a bar first: 103, 104 and 105 start code sets A, B and C; 106 is the stop. */
const PATTERNS =
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(
    ' '
  );

/** Words Code 128 cannot write: a character past plain ASCII, by its place. */
export class Code128Refused extends Error {
  constructor(readonly character: string) {
    super(`Code 128 writes plain ASCII; "${character}" is not`);
  }
}

/** Each symbol's value, start to stop, its check symbol before the stop. */
export function code128Values(text: string): number[] {
  for (const character of text) if (character.charCodeAt(0) > 127 || character.length > 1) throw new Code128Refused(character);
  const digitsFrom = (at: number) => {
    let end = at;
    while (end < text.length && text.charCodeAt(end) >= 48 && text.charCodeAt(end) <= 57) end++;
    return end - at;
  };
  const values: number[] = [];
  let set: 'A' | 'B' | 'C' | null = null;
  for (let at = 0; at < text.length; ) {
    const run = digitsFrom(at);
    // Digits two to a symbol where it saves room: four or more at the start or the end, six or more between; all of them
    // where the words are an even run of digits alone.
    const pairs = (run === text.length && run % 2 === 0) || (run >= 4 && (at === 0 || at + run === text.length)) || run >= 6;
    if (pairs && (run % 2 === 0 || set !== null)) {
      // An odd run's first digit goes in the set before it, so the rest pair up.
      if (run % 2 === 1) {
        values.push(text.charCodeAt(at) - 32);
        at++;
      }
      if (set !== 'C') values.push(set === null ? 105 : 99);
      set = 'C';
      for (let end = at + (run - (run % 2)); at < end; at += 2) values.push(Number(text.slice(at, at + 2)));
      continue;
    }
    const code = text.charCodeAt(at);
    // A control character is set A's, a small letter set B's; any other the set it is in, B unless it is in A.
    const wanted: 'A' | 'B' = code < 32 ? 'A' : code >= 96 ? 'B' : set === 'A' ? 'A' : 'B';
    if (set !== wanted) values.push(set === null ? (wanted === 'A' ? 103 : 104) : wanted === 'A' ? 101 : 100);
    set = wanted;
    values.push(code < 32 ? code + 64 : code - 32);
    at++;
  }
  if (!values.length) values.push(104);
  const check = values.reduce((sum, value, i) => sum + value * Math.max(1, i), 0) % 103;
  return [...values, check, 106];
}

/** The bars and spaces of words in Code 128, in modules, a bar first, from the start to the end of the stop. */
export function code128(text: string): number[] {
  return code128Values(text).flatMap((value) => [...PATTERNS[value]].map(Number));
}
