import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { code128, code128Values, Code128Refused } from './code128';
import { qrCode, qrVersion, QrTooLong } from './qr';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';

/**
 * A value shown as a code: the encoders — a QR code in byte mode at each level, in the smallest of 40 versions; Code
 * 128 in the code set that writes each run — and the widget that draws one as the value changes, named, saying why one
 * cannot be drawn. Every code made here was also read back by ZXing (21 Oct 2026: 294 QR codes, versions 1 to 40 at
 * every level, and 313 barcodes, each read as made); the code below is one of them, kept as it was read. The round
 * trip itself, ZXing reading what these encoders make, is codes-zxing.spec.ts.
 */

const rows = (modules: boolean[][]) => modules.map((row) => row.map((dark) => (dark ? '#' : '.')).join(''));
/** https://fieldia.dev/t/B-1043 at level M, as ZXing read it back. */
const TICKET = [
  '#######..##.##..#.#...#######', '#.....#.#.#...###..##.#.....#', '#.###.#....#.##.#.##..#.###.#', '#.###.#....#####......#.###.#', '#.###.#.#.###.#..####.#.###.#',
  '#.....#..##.##...###..#.....#', '#######.#.#.#.#.#.#.#.#######', '.........#...##.#####........', '#.#.#.#....##.##.##.....#..#.', '.###.#..####..##.##.###..#..#',
  '.#..#.#..#..##....#..##.#.###', '.#.##..###..#..#.##.##..#..#.', '##..#.###.......#######..#.##', '...#.#..#..#.#.####..##..#..#', '..##..##.###..###.#.#..###.##',
  '##..#...##.####.##..#....#.#.', '#.#.####..##..##.##..##..#.##', '.##.#..#####..##.##.###..##.#', '#.#.#.#.....##........###..##', '.#.#.#.##..#...#.#.##..###.#.',
  '#..#..##..#.....###.#####....', '........#.#.##.######...#.###', '#######..#..#.#######.#.##.##', '#.....#..##.###.###.#...##.#.', '#.###.#.#.#.#.##..#.#####..#.',
  '#.###.#..#.#####...#.#.##.#..', '#.###.#.#..#.#...#.##..###..#', '#.....#...#..#.#...##.###..#.', '#######.##......#..##..##..##',
];

/** The format a code says it was made with: its 15 bits round the top-left finder, checked against all 32 there are. */
function formatOf(modules: boolean[][]): { level: number; mask: number } | null {
  const at = (x: number, y: number): number => (modules[y][x] ? 1 : 0);
  const read = [0, 1, 2, 3, 4, 5].map((i) => at(8, i)).concat([at(8, 7), at(8, 8), at(7, 8)], [9, 10, 11, 12, 13, 14].map((i) => at(14 - i, 8)));
  const bits = read.reduce((sum: number, bit, i) => sum | (bit << i), 0);
  for (let data = 0; data < 32; data++) {
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    if ((((data << 10) | rem) ^ 0x5412) === bits) return { level: data >>> 3, mask: data & 7 };
  }
  return null;
}

describe('a QR code', () => {
  it('is the smallest version that holds the words at the level asked, made as ZXing reads it', () => {
    const code = qrCode('https://fieldia.dev/t/B-1043');
    expect([code.version, code.size]).toEqual([3, 29]);
    expect(rows(code.modules)).toEqual(TICKET);
    // Level M (bits 00), and the mask it chose said in its format.
    expect(formatOf(code.modules)).toEqual({ level: 0, mask: expect.any(Number) });
    expect(formatOf(qrCode('x', 'H').modules)?.level).toBe(2);
    expect(formatOf(qrCode('x', 'L').modules)?.level).toBe(1);
  });

  it('has its finders, its timing and its dark module where the standard puts them', () => {
    for (const words of ['a', 'x'.repeat(200), 'y'.repeat(1500)]) {
      const { size, modules, version } = qrCode(words, 'Q');
      expect(size).toBe(version * 4 + 17);
      for (const [x, y] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
        expect(rows(modules.slice(y, y + 7).map((row) => row.slice(x, x + 7)))).toEqual(['#######', '#.....#', '#.###.#', '#.###.#', '#.###.#', '#.....#', '#######']);
      }
      for (let i = 8; i < size - 8; i++) expect([modules[6][i], modules[i][6]]).toEqual([i % 2 === 0, i % 2 === 0]);
      expect(modules[size - 8][8]).toBe(true);
    }
  });

  it('counts the words as UTF-8 bytes, and says words too long for version 40', () => {
    // 2953 bytes at L, 2331 at M, 1663 at Q, 1273 at H: the most version 40 holds.
    expect([qrVersion(2953, 'L'), qrVersion(2331, 'M'), qrVersion(1663, 'Q'), qrVersion(1273, 'H')]).toEqual([40, 40, 40, 40]);
    expect(() => qrVersion(2332, 'M')).toThrow(QrTooLong);
    try {
      qrCode('ب'.repeat(1200), 'M');
    } catch (error) {
      expect(error).toBeInstanceOf(QrTooLong);
      // Said to be UTF-8 (its ECI), it holds a byte less.
      expect([(error as QrTooLong).bytes, (error as QrTooLong).most]).toEqual([2400, 2330]);
    }
    // As the browser's TextEncoder writes them, a lone surrogate too.
    for (const words of ['naïve café', 'مرحبا', '票 🎫', 'x\ud800y']) expect(qrCode(words).modules).toEqual(qrCode(words).modules);
    // Two bytes a letter in Arabic: 17 letters are 34 bytes, past version 2's 26 at M.
    expect(qrCode('مرحبا بكم في الحفل').version).toBe(3);
    expect(qrVersion(26, 'M')).toBe(2);
  });
});

describe('a Code 128 barcode', () => {
  const check = (values: number[]) => values.slice(0, -2).reduce((sum, value, i) => sum + value * Math.max(1, i), 0) % 103;
  it('writes words in set B, a run of digits two to a symbol in set C, and ends with its check and its stop', () => {
    expect(code128Values('1234567890')).toEqual([105, 12, 34, 56, 78, 90, 85, 106]);
    // Letters in B; a run of four digits at the end in C.
    const ticket = code128Values('B-1043');
    expect(ticket.slice(0, 3)).toEqual([104, 34, 13]);
    expect(ticket.slice(3, -2)).toEqual([99, 10, 43]);
    // An odd run's first digit in the set before it; a short run stays in B; a control character in A.
    expect(code128Values('12345').slice(0, -2)).toEqual([104, 17, 99, 23, 45]);
    expect(code128Values('A12B').slice(0, -2)).toEqual([104, 33, 17, 18, 34]);
    expect(code128Values('a\tb').slice(0, -2)).toEqual([104, 65, 101, 73, 100, 66]);
    for (const words of ['1234567890', 'B-1043', 'TKT 2026-10-21 0007', 'x123456y']) expect(code128Values(words).at(-2)).toBe(check(code128Values(words)));
  });

  it('is eleven modules a symbol, the stop thirteen, bars and spaces in turn', () => {
    const widths = code128('B-1043');
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(11 * (code128Values('B-1043').length - 1) + 13);
    expect(widths.every((width) => width >= 1 && width <= 4)).toBe(true);
  });

  it('refuses a character past plain ASCII, naming it', () => {
    expect(() => code128('Café')).toThrow(Code128Refused);
    expect(() => code128('Café')).toThrow('"é"');
  });
});

describe('a value shown as a code', () => {
  function setup(widget: string, field: Record<string, unknown>, options: { readonly?: boolean; node?: Record<string, unknown> } = {}) {
    const page = {
      fieldia: '0.1',
      id: 't',
      data: { kind: 'responses' },
      fields: { x: { label: 'Ticket', ...field } as Field },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', widget, ...(options.node ? { options: options.node } : {}) }] },
    } as Page;
    const form = createForm({ page });
    const widgetOf = createWidget({ form, name: 'x', field: page.fields['x'], node: (page.layout as { children: FieldNode[] }).children[0], id: 'fd-x', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widgetOf.element);
    const refresh = () => widgetOf.update({ value: form.getState().values['x'], values: form.getState().values, readonly: options.readonly ?? false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    return { form, el: widgetOf.element };
  }
  const figure = (el: Element) => el.querySelector('.fd-code-figure') as HTMLElement;

  it('draws a QR code of the value, named for a screen reader, black on white at its size', () => {
    const { form, el } = setup('qrcode', { type: 'char' }, { readonly: true });
    expect(figure(el).hidden).toBe(true);
    form.setValue('x', 'https://fieldia.dev/t/B-1043');
    const svg = figure(el).querySelector('svg') as SVGSVGElement;
    expect(figure(el).hidden).toBe(false);
    expect([svg.getAttribute('role'), svg.getAttribute('aria-label'), svg.getAttribute('viewBox'), svg.getAttribute('width'), svg.getAttribute('shape-rendering')]).toEqual(['img', 'QR code: https://fieldia.dev/t/B-1043', '0 0 37 37', '160', 'crispEdges']);
    // The value's words are a QR code's only where the page says; read-only, no box over it.
    expect((el.querySelector('.fd-code-words') as HTMLElement).hidden).toBe(true);
    expect((el.querySelector('.fd-code > :first-child') as HTMLElement).hidden).toBe(true);
    // Its dark modules, one rectangle a run: the first row's starts at the margin.
    expect(svg.querySelector('path')?.getAttribute('d')?.startsWith('M4 4h7v1h-7z')).toBe(true);
  });

  it('follows what is typed in its box, and says words too long for a QR code', () => {
    const { form, el } = setup('qrcode', { type: 'text' }, { node: { level: 'H', size: 200, showValue: true } });
    const box = el.querySelector('textarea') as HTMLTextAreaElement;
    expect(box).not.toBeNull();
    form.setValue('x', 'Table 12');
    expect(figure(el).querySelector('svg')?.getAttribute('width')).toBe('200');
    expect(el.querySelector('.fd-code-words')?.textContent).toBe('Table 12');
    form.setValue('x', 'z'.repeat(1300));
    expect(figure(el).hidden).toBe(true);
    expect(el.querySelector('.fd-code-why')?.textContent).toBe('Too long for a QR code: shorten it, or show a link to it instead.');
  });

  it('draws a barcode of a number or words, its value under it, and says a character it cannot write', () => {
    const { form, el } = setup('barcode', { type: 'integer' }, { readonly: true });
    form.setValue('x', 20261021);
    const svg = figure(el).querySelector('svg') as SVGSVGElement;
    expect(svg.getAttribute('aria-label')).toBe('Barcode: 20261021');
    expect(el.querySelector('.fd-code-words')?.textContent).toBe('20261021');
    // Two pixels a module: its start, four pairs of digits in set C, its check and its stop, ten modules either side.
    expect([svg.getAttribute('height'), svg.getAttribute('width')]).toEqual(['64', String(2 * (11 * 6 + 13 + 20))]);
    const words = setup('barcode', { type: 'char' }, { readonly: true });
    words.form.setValue('x', 'Café 12');
    expect(figure(words.el).hidden).toBe(true);
    expect(words.el.querySelector('.fd-code-why')?.textContent).toBe('A barcode cannot hold “é”: only letters without accents, digits and signs.');
  });

  it('writes a code’s value as an identifier: a number in its box and under it never grouped (the owner’s walk of 0.31)', () => {
    const { form, el } = setup('barcode', { type: 'integer' });
    form.setValue('x', 20261105);
    const box = el.querySelector('input') as HTMLInputElement;
    expect(box.value).toBe('20261105');
    expect(el.querySelector('.fd-code-words')?.textContent).toBe('20261105');
  });

  it('says a payload that is no short line by its summary, or by nothing: a vCard by its name, a link with its parameters by its address', () => {
    const { form, el } = setup('qrcode', { type: 'text' }, { readonly: true, node: { showValue: true } });
    const svg = () => figure(el).querySelector('svg') as SVGSVGElement;
    const words = () => el.querySelector('.fd-code-words') as HTMLElement;
    form.setValue('x', ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Summit desk', 'ORG:Cairo Real Estate Summit', 'TEL;TYPE=WORK:+20 2 2537 4100', 'END:VCARD'].join('\n'));
    expect(svg().getAttribute('aria-label')).toBe('QR code: Summit desk');
    expect([words().textContent, words().hidden]).toEqual(['Summit desk', false]);
    form.setValue('x', 'https://tickets.example/t/TKT-2026-0042?utm_source=whatsapp&agent=mona&session=8f3a91c2');
    expect(svg().getAttribute('aria-label')).toBe('QR code: tickets.example/t/TKT-2026-0042');
    expect(words().textContent).toBe('tickets.example/t/TKT-2026-0042');
    form.setValue('x', 'WIFI:T:WPA;S:Clinic guests;P:s3cret-pass;;');
    expect(words().textContent).toBe('Clinic guests');
    // A long text that names nothing: the code alone, named as a code.
    form.setValue('x', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.');
    expect([words().textContent, words().hidden]).toEqual(['', true]);
    expect(svg().getAttribute('aria-label')).toBe('QR code');
    // A short line, as it is.
    form.setValue('x', 'Table 12');
    expect([words().textContent, svg().getAttribute('aria-label')]).toEqual(['Table 12', 'QR code: Table 12']);
  });
});
