import { BinaryBitmap, Code128Reader, DecodeHintType, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';
import { code128 } from './code128';
import { qrCode, qrVersion, type QrLevel } from './qr';

/**
 * The codes part's own encoders read back by ZXing (@zxing/library, the scan part's reader): a QR code at every level,
 * across the 40 versions, of plain, accented, Arabic and emoji words — each read as the words it was made of — and a
 * Code 128 of digits, words and both, each read as its value. What a phone's camera reads from a printed ticket.
 */

const LEVELS: readonly QrLevel[] = ['L', 'M', 'Q', 'H'];
/** The light of each pixel (0 dark, 255 light), as ZXing's luminance source takes it. */
type Picture = { light: Uint8ClampedArray; width: number; height: number };

/** A QR code's modules as a picture: each module `scale` pixels square, four modules of quiet zone round it. */
function qrPicture(modules: boolean[][], scale = 2): Picture {
  const quiet = 4;
  const side = (modules.length + quiet * 2) * scale;
  const light = new Uint8ClampedArray(side * side).fill(255);
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) return;
      for (let dy = 0; dy < scale; dy++) light.fill(0, ((quiet + y) * scale + dy) * side + (quiet + x) * scale, ((quiet + y) * scale + dy) * side + (quiet + x + 1) * scale);
    })
  );
  return { light, width: side, height: side };
}

/** A barcode's bars and spaces (modules, a bar first) as a picture: each module `scale` pixels wide, ten modules of quiet zone each side. */
function barPicture(runs: number[], scale = 2, height = 16): Picture {
  const modules = runs.flatMap((run, i) => new Array<boolean>(run).fill(i % 2 === 0));
  const row = [...new Array<boolean>(10).fill(false), ...modules, ...new Array<boolean>(10).fill(false)].flatMap((dark) => new Array<number>(scale).fill(dark ? 0 : 255));
  const light = new Uint8ClampedArray(row.length * height);
  for (let y = 0; y < height; y++) light.set(row, y * row.length);
  return { light, width: row.length, height };
}

const bitmapOf = ({ light, width, height }: Picture) => new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(light, width, height)));
const pure = new Map<DecodeHintType, unknown>([[DecodeHintType.PURE_BARCODE, true]]);

/** A QR code of the words at a level, as ZXing reads it back. */
function qrRead(words: string, level: QrLevel): { text: string; version: number } {
  const code = qrCode(words, level);
  return { text: new QRCodeReader().decode(bitmapOf(qrPicture(code.modules)), pure).getText(), version: code.version };
}

/** The version plain words of so many bytes take at a level: 41 where they fit none. */
const versionOf = (bytes: number, level: QrLevel) => {
  try {
    return qrVersion(bytes, level);
  } catch {
    return 41;
  }
};

/** Words that fill a code of this version at this level: the given ones, then letters, until the code is that big. */
function wordsOfVersion(start: string, version: number, level: QrLevel): string {
  let low = 0;
  let high = 3000;
  // The fewest letters added that make a code of the version asked (a version holds a range of lengths).
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (versionOf(start.length + middle, level) >= version) high = middle;
    else low = middle + 1;
  }
  return start + 'q'.repeat(low);
}

describe('a QR code read back by ZXing', () => {
  it('reads as its words at every level, through every fourth version from 1 to 40 and the last', () => {
    const versions = [1, 2, 3, 5, 7, 9, 10, 13, 17, 21, 25, 27, 30, 33, 36, 39, 40];
    const read: string[] = [];
    for (const level of LEVELS) {
      for (const version of versions) {
        const words = wordsOfVersion(`T${level}${version}-`, version, level);
        const back = qrRead(words, level);
        expect(back.version).toBe(version);
        expect(back.text).toBe(words);
        read.push(`${level}${version}`);
      }
    }
    expect(read).toHaveLength(LEVELS.length * versions.length);
  });

  it('reads Arabic, accented and emoji words as they were written, said as UTF-8, at every level', () => {
    const words = [
      'مرحبا بكم في فيلدية — حجز رقم ٤٢',
      'Crème brûlée, Ærøskøbing, Ñandú, Łódź, İstanbul',
      'Ticket 🎟️ for Mona 👩🏽‍💻 — 3 × ☕',
      'عيادة الجمال: Botox 💉 4 وحدات, prix 1 200 €',
      'x'.repeat(300) + ' ٣٫٥ مليون',
    ];
    for (const level of LEVELS) for (const one of words) expect(qrRead(one, level).text).toBe(one);
  });
});

describe('a Code 128 read back by ZXing', () => {
  it('reads as its value: digits two to a symbol, words, and both in turn', () => {
    const values = ['0', '7', '42', '0042', '1234567890', '12345678901234567890', 'TKT-2026-0042', 'Hello, World!', 'a1b2c3d4', 'B-12 / Floor 3', 'Ab1234567Cd', '~!@#$%^&*()_+{}|:"<>?', '2026-10-22T09:40'];
    for (const value of values) {
      expect(new Code128Reader().decode(bitmapOf(barPicture(code128(value)))).getText()).toBe(value);
    }
  });
});
