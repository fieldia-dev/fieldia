import { BarcodeFormat, DataMatrixWriter, QRCodeWriter } from '@zxing/library';

/**
 * Codes drawn for the scan tests, as a camera would see them printed: a QR code, a DataMatrix (a GS1 one, its parts
 * apart by group separators, with the FNC1 that marks it), an EAN-13 and a Code 39, black on white with their quiet
 * zones — as the pixels a canvas gives (`ImageData`'s shape), or as an SVG to draw on a page's canvas. For tests only.
 */

/** The kinds of code drawn. */
export type DrawnFormat = 'qr_code' | 'data_matrix' | 'ean_13' | 'code_39';

/** A code as rows of modules: true is dark. */
type Modules = boolean[][];

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = L.map((code) => [...code].map((bit) => (bit === '1' ? '0' : '1')).join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** An EAN-13's bars, its 13 digits as given (the check digit theirs). */
function ean13(digits: string): string {
  if (!/^\d{13}$/.test(digits)) throw new Error(`an EAN-13 is 13 digits: ${digits}`);
  const parity = PARITY[Number(digits[0])];
  const left = [...digits.slice(1, 7)].map((d, i) => (parity[i] === 'L' ? L : G)[Number(d)]).join('');
  const right = [...digits.slice(7)].map((d) => R[Number(d)]).join('');
  return `101${left}01010${right}101`;
}

const CODE39: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000', '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101', '8': '100100100', '9': '001100100',
  A: '100001001', B: '001001001', C: '101001000', D: '000011001', E: '100011000', F: '001011000', G: '000001101', H: '100001100', I: '001001100', J: '000011100',
  K: '100000011', L: '001000011', M: '101000010', N: '000010011', O: '100010010', P: '001010010', Q: '000000111', R: '100000110', S: '001000110', T: '000010110',
  U: '110000001', V: '011000001', W: '111000000', X: '010010001', Y: '110010000', Z: '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
};

/** A Code 39's bars, its text between the stars that start and end it: wide elements three modules, narrow one. */
function code39(text: string): string {
  return [...`*${text.toUpperCase()}*`]
    .map((char) => {
      const wide = CODE39[char];
      if (!wide) throw new Error(`Code 39 has no "${char}"`);
      return [...wide].map((bit, i) => (i % 2 === 0 ? '1' : '0').repeat(bit === '1' ? 3 : 1)).join('');
    })
    .join('0');
}

/** A code's modules, its quiet zone round it. */
function modulesOf(format: DrawnFormat, text: string, gs1: boolean): Modules {
  if (format === 'ean_13' || format === 'code_39') {
    const bars = format === 'ean_13' ? ean13(text) : code39(text);
    const row = [...'0'.repeat(10) + bars + '0'.repeat(10)].map((bit) => bit === '1');
    return Array.from({ length: 24 }, () => row);
  }
  // A GS1 code's FNC1s as the group separators a reader gives for them, first and between its parts: read back, the
  // same text as a printed GS1 DataMatrix's (the writer's own GS1 encoding is broken in @zxing/library 0.23).
  const written = gs1 && !text.startsWith('\u001d') ? `\u001d${text}` : text;
  const matrix = format === 'qr_code' ? new QRCodeWriter().encode(written, BarcodeFormat.QR_CODE, 0, 0, new Map()) : new DataMatrixWriter().encode(written, BarcodeFormat.DATA_MATRIX, 0, 0);
  const quiet = format === 'qr_code' ? 0 : 2;
  const width = matrix.getWidth() + 2 * quiet;
  const height = matrix.getHeight() + 2 * quiet;
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => x >= quiet && y >= quiet && x < width - quiet && y < height - quiet && matrix.get(x - quiet, y - quiet)));
}

/**
 * A code as a canvas's pixels: four bytes a pixel, each module `scale` pixels (3 for a 1D code's, as it is drawn wide).
 * A GS1 code's text holds its parts apart by group separators (`\u001d`): drawn so a reader gives it as a GS1 code's.
 */
export function codePixels(format: DrawnFormat, text: string, options: { gs1?: boolean; scale?: number } = {}): { data: Uint8ClampedArray; width: number; height: number } {
  const modules = modulesOf(format, text, options.gs1 ?? false);
  const scale = options.scale ?? (format === 'ean_13' || format === 'code_39' ? 3 : 6);
  const width = modules[0].length * scale;
  const height = modules.length * scale;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!modules[Math.floor(y / scale)][Math.floor(x / scale)]) continue;
      const at = (y * width + x) * 4;
      data[at] = data[at + 1] = data[at + 2] = 0;
    }
  }
  return { data, width, height };
}

/** A code as an SVG picture, black on white, each module one unit wide; `size` the longer side in pixels. */
export function codeSvg(format: DrawnFormat, text: string, options: { gs1?: boolean; size?: number } = {}): string {
  const modules = modulesOf(format, text, options.gs1 ?? false);
  const [w, h] = [modules[0].length, modules.length];
  const size = options.size ?? 360;
  const [width, height] = w >= h ? [size, Math.round((size * h) / w)] : [Math.round((size * w) / h), size];
  // Each run of dark modules in a row one shape; a 1D code's rows are alike, so each bar is one shape the whole height.
  const bars = modules.every((row) => row.join() === modules[0].join());
  const runs = (row: boolean[], y: number, tall: number) => {
    const out: string[] = [];
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let end = x;
      while (row[end + 1]) end++;
      out.push(`M${x} ${y}h${end - x + 1}v${tall}h-${end - x + 1}z`);
      x = end;
    }
    return out;
  };
  const dark = (bars ? runs(modules[0], 0, h) : modules.flatMap((row, y) => runs(row, y, 1))).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"><rect width="${w}" height="${h}" fill="#fff"/><path fill="#000" d="${dark}"/></svg>`;
}
