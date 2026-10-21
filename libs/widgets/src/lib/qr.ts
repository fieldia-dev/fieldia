/**
 * A QR code made from words (ISO/IEC 18004): the words as UTF-8 bytes in byte mode — said to be UTF-8 (ECI 26) where
 * any is past ASCII, so a strict reader reads Arabic as Arabic — at the error correction level
 * asked — L, M, Q or H, a 7, 15, 25 or 30 per cent of it that may be lost and still read — in the smallest of the 40
 * versions that holds them, its mask the one of eight with the fewest penalty points. The result is its modules, dark
 * or light, row by row: what the codes part draws (codes.ts). Nothing else of a QR code is made here — no numeric or
 * kanji mode, no structured append — so a code is a few hundred bytes of script.
 */

/** How much of a code may be lost and still read: about 7, 15, 25 and 30 per cent. */
export type QrLevel = 'L' | 'M' | 'Q' | 'H';

/** A code as rows of modules, dark (true) or light; its version, from 1 (21 × 21) to 40 (177 × 177). */
export interface QrCode {
  version: number;
  size: number;
  modules: boolean[][];
}

/** The words that do not fit: their bytes, and the most a code of that level holds. */
export class QrTooLong extends Error {
  constructor(
    readonly bytes: number,
    readonly most: number
  ) {
    super(`${bytes} bytes do not fit a QR code: ${most} at most at this level`);
  }
}

const LEVELS: readonly QrLevel[] = ['L', 'M', 'Q', 'H'];
/** The bits a format names each level by. */
const LEVEL_BITS: Readonly<Record<QrLevel, number>> = { L: 1, M: 0, Q: 3, H: 2 };
/** For each level, by version (1–40): the error correction codewords of each block. */
const BLOCK_ECC: Readonly<Record<QrLevel, string>> = {
  L: '7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30',
  M: '10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28',
  Q: '13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30',
  H: '17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30',
};
/** For each level, by version (1–40): how many blocks the codewords are split into. */
const BLOCKS: Readonly<Record<QrLevel, string>> = {
  L: '1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25',
  M: '1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49',
  Q: '1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68',
  H: '1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81',
};
const table = (of: Readonly<Record<QrLevel, string>>, level: QrLevel, version: number) => Number(of[level].split(',')[version - 1]);

/** The modules a version has for data and error correction: all but its finders, timing, alignment, format and version. */
function dataModules(version: number): number {
  let count = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const aligns = Math.floor(version / 7) + 2;
    count -= (25 * aligns - 10) * aligns - 55;
    if (version >= 7) count -= 36;
  }
  return count;
}
/** The codewords of data a version holds at a level. */
const dataCodewords = (version: number, level: QrLevel) => Math.floor(dataModules(version) / 8) - table(BLOCK_ECC, level, version) * table(BLOCKS, level, version);
/** The bytes of words a version holds at a level, in byte mode: its bits less the mode and the count (and UTF-8's ECI). */
const capacity = (version: number, level: QrLevel, eci = false) => Math.floor((dataCodewords(version, level) * 8 - 4 - (version < 10 ? 8 : 16) - (eci ? 12 : 0)) / 8);

// ---- Reed–Solomon over GF(256), the field of x⁸ + x⁴ + x³ + x² + 1 --------------------------------------------------
function times(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function divisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = times(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = times(root, 2);
  }
  return result;
}
function remainder(data: readonly number[], by: readonly number[]): number[] {
  const result = by.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    by.forEach((coefficient, i) => (result[i] ^= times(coefficient, factor)));
  }
  return result;
}

/** The words as a code's codewords: byte mode, its count, the bytes, the end, the padding — then split into blocks, each with its error correction, interleaved. */
function codewords(bytes: readonly number[], version: number, level: QrLevel): number[] {
  const bits: number[] = [];
  const put = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  // Bytes past ASCII said to be UTF-8 (ECI 26), not the standard's ISO-8859-1.
  if (bytes.some((byte) => byte > 127)) {
    put(0b0111, 4);
    put(26, 8);
  }
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) put(byte, 8);
  const room = dataCodewords(version, level) * 8;
  put(0, Math.min(4, room - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < room; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  // The blocks: the short ones first, each long one a codeword longer.
  const count = table(BLOCKS, level, version);
  const ecc = table(BLOCK_ECC, level, version);
  const raw = Math.floor(dataModules(version) / 8);
  const short = count - (raw % count);
  const shortLength = Math.floor(raw / count);
  const by = divisor(ecc);
  const blocks: number[][] = [];
  for (let i = 0, at = 0; i < count; i++) {
    const own = data.slice(at, at + shortLength - ecc + (i < short ? 0 : 1));
    at += own.length;
    const correction = remainder(own, by);
    if (i < short) own.push(0);
    blocks.push([...own, ...correction]);
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((block, j) => (i !== shortLength - ecc || j >= short) && result.push(block[i]));
  return result;
}

/** Where a version's alignment patterns are centred, along each side. */
function alignments(version: number, size: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const result = [6];
  for (let at = size - 7; result.length < count; at -= step) result.splice(1, 0, at);
  return result;
}

const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** A mask's penalty points (the standard's four rules): runs, blocks, what looks like a finder, and too much of one colour. */
function penalty(modules: boolean[][]): number {
  const size = modules.length;
  let points = 0;
  let dark = 0;
  const at = (line: number, i: number, across: boolean) => (across ? modules[line][i] : modules[i][line]);
  // Out of the code is light, as its quiet zone is.
  const light = (line: number, from: number, to: number, across: boolean) => {
    for (let i = Math.max(0, from); i < Math.min(size, to); i++) if (at(line, i, across)) return false;
    return true;
  };
  for (const across of [true, false]) {
    for (let line = 0; line < size; line++) {
      let run = 0;
      for (let i = 0; i < size; i++) {
        run = i > 0 && at(line, i, across) === at(line, i - 1, across) ? run + 1 : 1;
        if (run === 5) points += 3;
        else if (run > 5) points++;
        // Dark, light, three dark, light, dark — with four light before or after it.
        if (i + 6 < size && [1, 0, 1, 1, 1, 0, 1].every((bit, k) => at(line, i + k, across) === !!bit) && (light(line, i - 4, i, across) || light(line, i + 7, i + 11, across))) points += 40;
      }
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) dark++;
      if (x + 1 < size && y + 1 < size && modules[y][x] === modules[y][x + 1] && modules[y][x] === modules[y + 1][x] && modules[y][x] === modules[y + 1][x + 1]) points += 3;
    }
  }
  return points + (Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
}

/** Words as UTF-8 bytes, as the browser's TextEncoder writes them (a lone surrogate as U+FFFD) — wherever the code runs. */
function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const character of text) {
    let point = character.codePointAt(0) as number;
    if (point >= 0xd800 && point <= 0xdfff) point = 0xfffd;
    if (point < 0x80) bytes.push(point);
    else if (point < 0x800) bytes.push(0xc0 | (point >> 6), 0x80 | (point & 63));
    else if (point < 0x10000) bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63));
    else bytes.push(0xf0 | (point >> 18), 0x80 | ((point >> 12) & 63), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63));
  }
  return bytes;
}

/** The smallest version that holds this many bytes at a level; past 40, the words do not fit. */
export function qrVersion(bytes: number, level: QrLevel = 'M', eci = false): number {
  for (let version = 1; version <= 40; version++) if (capacity(version, level, eci) >= bytes) return version;
  throw new QrTooLong(bytes, capacity(40, level, eci));
}

/** Words as a QR code, at a level (M unless said); `QrTooLong` where they do not fit even version 40. */
export function qrCode(text: string, level: QrLevel = 'M'): QrCode {
  if (!LEVELS.includes(level)) throw new Error(`a QR code's level is L, M, Q or H, not ${level}`);
  const bytes = utf8(text);
  const version = qrVersion(bytes.length, level, bytes.some((byte) => byte > 127));
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    fixed[y][x] = true;
  };
  // Timing, the three finders with their separators, and the alignment patterns not over a finder.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        const [x, y] = [cx + dx, cy + dy];
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, ring !== 2 && ring !== 4);
      }
    }
  }
  const centres = alignments(version, size);
  centres.forEach((cy, i) =>
    centres.forEach((cx, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === centres.length - 1) || (i === centres.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    })
  );
  // The format's and the version's places, held for them; the dark module.
  const format = (mask: number) => {
    const data = (LEVEL_BITS[level] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const [a, b] = [size - 11 + (i % 3), Math.floor(i / 3)];
      set(a, b, dark);
      set(b, a, dark);
    }
  }
  // The codewords, two columns at a time, up and down from the right, the timing column stepped over.
  const words = codewords(bytes, version, level);
  let bit = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - step : step;
        if (fixed[y][x] || bit >= words.length * 8) continue;
        modules[y][x] = ((words[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
        bit++;
      }
    }
  }
  // Each mask tried, its format written with it; the one with the fewest points kept.
  const masked = (mask: number) => {
    const copy = modules.map((row, y) => row.map((dark, x) => (fixed[y][x] ? dark : dark !== MASKS[mask](x, y))));
    const keep = modules.map((row) => [...row]);
    modules.forEach((row, y) => row.forEach((_, x) => (modules[y][x] = copy[y][x])));
    format(mask);
    const result = modules.map((row) => [...row]);
    keep.forEach((row, y) => row.forEach((dark, x) => (modules[y][x] = dark)));
    return result;
  };
  let best = masked(0);
  let fewest = penalty(best);
  for (let mask = 1; mask < 8; mask++) {
    const tried = masked(mask);
    const points = penalty(tried);
    if (points < fewest) [best, fewest] = [tried, points];
  }
  return { version, size, modules: best };
}
