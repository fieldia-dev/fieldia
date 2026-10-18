import { inflateSync } from 'node:zlib';

/**
 * The words on each sheet of a PDF a browser printed, and where they stand — enough to tell what is at a sheet's
 * foot, whether its footer is there and whether anything stands under it, without a PDF library or poppler (which a
 * test runner may not have): Chromium's `page.pdf()` and Firefox's print to a file both write each font's
 * ToUnicode map, and draw text with the few operators read here.
 */

/** A line of words on a sheet: its words in order, its baseline from the sheet's top, its start and its size, in points. */
export interface PdfLine {
  text: string;
  y: number;
  x: number;
  size: number;
  /** Words drawn where other words of the line start too: one over the other. */
  over?: string;
}

/** Words shown at once, where they start and end along their line. */
type Run = PdfLine & { end: number };

/** A font as the words it draws read: a code's bytes, its words and its width (thousandths of the size). */
interface Font {
  bytes: number;
  map: Map<number, string>;
  widths: Map<number, number>;
  missing: number;
}

export interface PdfSheet {
  height: number;
  lines: PdfLine[];
}

interface PdfObject {
  dict: string;
  stream?: Buffer;
}

/** Every object of the file, those packed in object streams too. */
function objects(bytes: Buffer): Map<number, PdfObject> {
  const text = bytes.toString('latin1');
  const all = new Map<number, PdfObject>();
  const start = /(\d+)\s+\d+\s+obj\b/g;
  for (let found = start.exec(text); found; found = start.exec(text)) {
    const from = found.index + found[0].length;
    const end = text.indexOf('endobj', from);
    if (end < 0) break;
    const body = text.slice(from, end);
    const at = body.search(/\bstream\r?\n/);
    if (at < 0) all.set(Number(found[1]), { dict: body });
    else {
      const dataFrom = from + at + body.slice(at).match(/^stream\r?\n/)![0].length;
      const dataEnd = text.lastIndexOf('endstream', end);
      let data = bytes.subarray(dataFrom, dataEnd);
      const dict = body.slice(0, at);
      if (/\/FlateDecode/.test(dict)) {
        try {
          data = inflateSync(data);
        } catch {
          // An end of line before `endstream` the length leaves out: inflate what stands before it.
          data = inflateSync(data.subarray(0, data.length - 1));
        }
      }
      all.set(Number(found[1]), { dict, stream: data });
    }
    start.lastIndex = end;
  }
  // Objects packed in an object stream: its header's numbers and offsets, then the objects one after another.
  for (const packed of [...all.values()].filter((one) => /\/Type\s*\/ObjStm/.test(one.dict) && one.stream)) {
    const first = Number(packed.dict.match(/\/First\s+(\d+)/)?.[1] ?? 0);
    const content = packed.stream!.toString('latin1');
    const head = content.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < head.length; i += 2) {
      const from = first + head[i + 1];
      const to = i + 3 < head.length ? first + head[i + 3] : content.length;
      if (!all.has(head[i])) all.set(head[i], { dict: content.slice(from, to) });
    }
  }
  return all;
}

const ref = (text: string, key: string): number | null => {
  const found = text.match(new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`));
  return found ? Number(found[1]) : null;
};

/** A dictionary's entry `key` — given inline (`<< … >>`) or by reference — as text. */
function entry(all: Map<number, PdfObject>, text: string, key: string): string {
  const at = text.search(new RegExp(`/${key}\\b`));
  if (at < 0) return '';
  const rest = text.slice(at + key.length + 1).trimStart();
  if (rest.startsWith('<<')) {
    let depth = 0;
    for (let i = 0; i < rest.length - 1; i++) {
      if (rest.startsWith('<<', i)) {
        depth++;
        i++;
      } else if (rest.startsWith('>>', i)) {
        depth--;
        i++;
        if (!depth) return rest.slice(0, i + 1);
      }
    }
    return rest;
  }
  const id = ref(text, key);
  return id === null ? '' : (all.get(id)?.dict ?? '');
}

/** A font's codes to the words they draw, from its ToUnicode map, and how many bytes a code takes. */
function unicodeOf(cmap: string): { width: number; map: Map<number, string> } {
  const map = new Map<number, string>();
  const hex = (value: string) => {
    let out = '';
    for (let i = 0; i + 4 <= value.length; i += 4) out += String.fromCharCode(Number.parseInt(value.slice(i, i + 4), 16));
    return out;
  };
  const range = cmap.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/);
  const width = range ? range[1].length / 2 : 2;
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(Number.parseInt(pair[1], 16), hex(pair[2]));
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const span of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      const low = Number.parseInt(span[1], 16);
      const high = Number.parseInt(span[2], 16);
      if (span[3].startsWith('[')) {
        const each = [...span[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((one) => hex(one[1]));
        each.forEach((word, i) => map.set(low + i, word));
      } else {
        const base = span[3].slice(1, -1);
        const last = Number.parseInt(base.slice(-4), 16);
        for (let code = low; code <= high; code++) map.set(code, hex(base.slice(0, -4)) + String.fromCharCode(last + code - low));
      }
    }
  }
  return { width, map };
}

/** A font's words (its ToUnicode map) and widths: a simple font's (`/FirstChar`, `/Widths`), a composite one's (`/W`). */
function fontOf(all: Map<number, PdfObject>, dict: string): Font {
  const cmapId = ref(dict, 'ToUnicode');
  const cmap = cmapId === null ? undefined : all.get(cmapId)?.stream?.toString('latin1');
  const { width: bytes, map } = cmap ? unicodeOf(cmap) : { width: 1, map: new Map<number, string>() };
  const widths = new Map<number, number>();
  const array = (text: string, key: string) => {
    const inline = text.match(new RegExp(`/${key}\\s*\\[`));
    if (inline) {
      // The array up to its matching bracket (a /W holds arrays in it).
      let depth = 0;
      const from = inline.index! + inline[0].length - 1;
      for (let i = from; i < text.length; i++) {
        if (text[i] === '[') depth++;
        else if (text[i] === ']' && !--depth) return text.slice(from, i + 1);
      }
    }
    const id = ref(text, key);
    return id === null ? '' : (all.get(id)?.dict ?? '');
  };
  let missing = 0;
  const descendant = ref(dict, 'DescendantFonts') ?? Number(dict.match(/\/DescendantFonts\s*\[\s*(\d+)\s+\d+\s+R/)?.[1] ?? NaN);
  if (Number.isFinite(descendant)) {
    const cid = all.get(descendant)?.dict ?? '';
    missing = Number(cid.match(/\/DW\s+([\d.]+)/)?.[1] ?? 1000);
    const items = [...array(cid, 'W').trim().replace(/^\[|\]$/g, '').matchAll(/\[([^\]]*)\]|[\d.]+/g)];
    for (let i = 0; i < items.length; ) {
      const first = Number(items[i][0]);
      if (items[i + 1]?.[1] !== undefined) {
        items[i + 1][1].trim().split(/\s+/).filter(Boolean).forEach((w, at) => widths.set(first + at, Number(w)));
        i += 2;
      } else {
        for (let code = first; code <= Number(items[i + 1]?.[0]); code++) widths.set(code, Number(items[i + 2]?.[0]));
        i += 3;
      }
    }
  } else {
    const first = Number(dict.match(/\/FirstChar\s+(\d+)/)?.[1] ?? 0);
    array(dict, 'Widths').replace(/[[\]]/g, ' ').trim().split(/\s+/).filter(Boolean).forEach((w, at) => widths.set(first + at, Number(w)));
  }
  return { bytes, map, widths, missing };
}

type Matrix = [number, number, number, number, number, number];
const times = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];

/** A content stream's tokens: numbers, names, strings (as bytes), arrays of them, and operators. */
function* tokens(content: string): Generator<{ op?: string; value?: unknown }> {
  let i = 0;
  const stack: unknown[][] = [];
  const push = (value: unknown) => (stack.length ? stack[stack.length - 1].push(value) : undefined);
  while (i < content.length) {
    const c = content[i];
    if (/\s/.test(c)) i++;
    else if (c === '%') i = content.indexOf('\n', i) < 0 ? content.length : content.indexOf('\n', i);
    else if (c === '[') {
      stack.push([]);
      i++;
    } else if (c === ']') {
      const array = stack.pop() ?? [];
      i++;
      if (stack.length) push(array);
      else yield { value: array };
    } else if (c === '(') {
      let depth = 1;
      let out = '';
      i++;
      while (i < content.length && depth) {
        const d = content[i];
        if (d === '\\') {
          const next = content[i + 1];
          const octal = content.slice(i + 1).match(/^[0-7]{1,3}/);
          if (octal) {
            out += String.fromCharCode(Number.parseInt(octal[0], 8));
            i += 1 + octal[0].length;
          } else {
            out += ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' } as Record<string, string>)[next] ?? next;
            i += 2;
          }
          continue;
        }
        if (d === '(') depth++;
        if (d === ')' && !--depth) break;
        out += d;
        i++;
      }
      i++;
      const value = { bytes: out };
      if (stack.length) push(value);
      else yield { value };
    } else if (c === '<' && content[i + 1] !== '<') {
      const end = content.indexOf('>', i);
      const raw = content.slice(i + 1, end).replace(/\s+/g, '');
      let out = '';
      for (let j = 0; j < raw.length; j += 2) out += String.fromCharCode(Number.parseInt(raw.slice(j, j + 2).padEnd(2, '0'), 16));
      i = end + 1;
      const value = { bytes: out };
      if (stack.length) push(value);
      else yield { value };
    } else if (c === '<' || c === '>') i += 2;
    else {
      const word = content.slice(i).match(/^[^\s[\]()<>/%]+|^\/[^\s[\]()<>/%]*/)?.[0] ?? c;
      i += word.length;
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
        if (stack.length) push(Number(word));
        else yield { value: Number(word) };
      } else if (word.startsWith('/')) {
        if (stack.length) push(word);
        else yield { value: word };
      } else if (!stack.length) yield { op: word };
    }
  }
}

/** Each sheet's lines of words, top to bottom. */
export function pdfSheets(bytes: Buffer): PdfSheet[] {
  const all = objects(bytes);
  const text = bytes.toString('latin1');
  const root = [...text.matchAll(/\/Root\s+(\d+)\s+\d+\s+R/g)].pop();
  const pagesId = root ? ref(all.get(Number(root[1]))?.dict ?? '', 'Pages') : null;
  const pages: PdfObject[] = [];
  const walk = (id: number | null) => {
    const node = id === null ? undefined : all.get(id);
    if (!node) return;
    if (/\/Type\s*\/Page\b(?!s)/.test(node.dict)) pages.push(node);
    for (const kid of node.dict.match(/\/Kids\s*\[([^\]]*)\]/)?.[1].matchAll(/(\d+)\s+\d+\s+R/g) ?? []) walk(Number(kid[1]));
  };
  walk(pagesId);
  return pages.map((page) => {
    const box = (page.dict.match(/\/MediaBox\s*\[([^\]]*)\]/)?.[1] ?? '0 0 595 842').trim().split(/\s+/).map(Number);
    const height = box[3] - box[1];
    const fontsDict = entry(all, entry(all, page.dict, 'Resources'), 'Font');
    const fonts = new Map<string, Font>();
    for (const font of fontsDict.matchAll(/\/([^\s/<>[\]]+)\s+(\d+)\s+\d+\s+R/g)) fonts.set(font[1], fontOf(all, all.get(Number(font[2]))?.dict ?? ''));
    const contentIds = page.dict.match(/\/Contents\s*\[([^\]]*)\]/)?.[1].matchAll(/(\d+)\s+\d+\s+R/g);
    const ids = contentIds ? [...contentIds].map((one) => Number(one[1])) : [ref(page.dict, 'Contents')].filter((id): id is number => id !== null);
    const content = ids.map((id) => all.get(id)?.stream?.toString('latin1') ?? '').join('\n');

    const runs: Run[] = [];
    const saved: Matrix[] = [];
    let ctm: Matrix = [1, 0, 0, 1, 0, 0];
    let tm: Matrix = [1, 0, 0, 1, 0, 0];
    let lm: Matrix = [1, 0, 0, 1, 0, 0];
    let font: Font = fonts.values().next().value ?? { bytes: 1, map: new Map(), widths: new Map(), missing: 0 };
    let size = 0;
    let leading = 0;
    let spacing = 0;
    let wordSpacing = 0;
    let stretch = 1;
    const args: unknown[] = [];
    /** The words shown from where the text matrix is, which each glyph moves on by its width. */
    const show = (strings: unknown[]) => {
      let words = '';
      const from = times(tm, ctm);
      const advance = (by: number) => (tm = times([1, 0, 0, 1, by * stretch, 0], tm));
      for (const one of strings) {
        if (typeof one === 'number') {
          // A wide enough step back is a space between words.
          if (one < -200) words += ' ';
          advance((-one / 1000) * size);
          continue;
        }
        const bytes = (one as { bytes: string }).bytes;
        for (let i = 0; i + font.bytes <= bytes.length; i += font.bytes) {
          let code = 0;
          for (let j = 0; j < font.bytes; j++) code = code * 256 + bytes.charCodeAt(i + j);
          words += font.map.get(code) ?? '';
          advance(((font.widths.get(code) ?? font.missing) / 1000) * size + spacing + (font.bytes === 1 && code === 32 ? wordSpacing : 0));
        }
      }
      const to = times(tm, ctm);
      const scale = Math.hypot(from[2], from[3]) || 1;
      if (words.trim()) runs.push({ text: words, x: Math.min(from[4], to[4]), y: height - from[5], size: size * scale, end: Math.max(from[4], to[4]) });
    };
    for (const token of tokens(content)) {
      if (!token.op) {
        args.push(token.value);
        continue;
      }
      const n = args.map(Number);
      switch (token.op) {
        case 'q':
          saved.push(ctm);
          break;
        case 'Q':
          ctm = saved.pop() ?? ctm;
          break;
        case 'cm':
          ctm = times(n.slice(-6) as Matrix, ctm);
          break;
        case 'BT':
          tm = lm = [1, 0, 0, 1, 0, 0];
          break;
        case 'Tf':
          font = fonts.get(String(args[args.length - 2]).slice(1)) ?? font;
          size = n[n.length - 1];
          break;
        case 'TL':
          leading = n[n.length - 1];
          break;
        case 'Tc':
          spacing = n[n.length - 1];
          break;
        case 'Tw':
          wordSpacing = n[n.length - 1];
          break;
        case 'Tz':
          stretch = n[n.length - 1] / 100;
          break;
        case 'Tm':
          tm = lm = n.slice(-6) as Matrix;
          break;
        case 'Td':
        case 'TD':
          if (token.op === 'TD') leading = -n[n.length - 1];
          tm = lm = times([1, 0, 0, 1, n[n.length - 2], n[n.length - 1]], lm);
          break;
        case 'T*':
          tm = lm = times([1, 0, 0, 1, 0, -leading], lm);
          break;
        case 'Tj':
          show([args[args.length - 1]]);
          break;
        case "'":
        case '"':
          tm = lm = times([1, 0, 0, 1, 0, -leading], lm);
          show([args[args.length - 1]]);
          break;
        case 'TJ':
          show(args[args.length - 1] as unknown[]);
          break;
      }
      args.length = 0;
    }
    // Runs on one baseline are one line, left to right: a space where a run starts past where the one before ends (a
    // word broken into runs for its spacing reads whole); words drawn over the end of the ones before, one over them.
    runs.sort((a, b) => a.y - b.y);
    const rows: Run[][] = [];
    for (const run of runs) {
      const row = rows.find((one) => Math.abs(one[0].y - run.y) < 1.5);
      if (row) row.push(run);
      else rows.push([run]);
    }
    const lines = rows.map((row): PdfLine => {
      row.sort((a, b) => a.x - b.x);
      let text = '';
      let end = -Infinity;
      let over: string | undefined;
      row.forEach((run, at) => {
        text += (text && run.x > end + run.size * 0.15 ? ' ' : '') + run.text;
        const under = row[at - 1];
        if (under && run.x < end - run.size * 0.4 && run.text.trim().length > 1 && under.text.trim().length > 1) over = `${run.text.trim()} / ${under.text.trim()}`;
        end = Math.max(end, run.end);
      });
      return { text: text.replace(/\s+/g, ' ').trim(), x: row[0].x, y: row[0].y, size: Math.max(...row.map((run) => run.size)), ...(over ? { over } : {}) };
    });
    return { height, lines };
  });
}

/** Words without their spaces, as a sheet's letter-spaced capitals are read, and their ligatures ("ﬁ") as letters. */
export const squash = (text: string) => text.normalize('NFKC').replace(/\s+/g, '').toLowerCase();

/**
 * What is wrong on each sheet, in words: its footer (`footer`, its words) missing from its foot, or alone on it; a line
 * under it that is not its own; a heading left alone over it — one of `headings`, a tab's name (larger than a label) or
 * a group's title (in capitals); a line drawn over another (two starting where the other does, nearer than a line).
 */
export function sheetProblems(sheets: PdfSheet[], footer: string, headings: string[]): string[] {
  const heads = new Set(headings.map(squash));
  const words = squash(footer);
  const problems: string[] = [];
  sheets.forEach((sheet, at) => {
    const which = `sheet ${at + 1} of ${sheets.length}`;
    const foot = sheet.lines.findIndex((line) => squash(line.text).length >= 12 && words.startsWith(squash(line.text).slice(0, 24)));
    if (foot < 0) return void problems.push(`${which}: no footer`);
    if (foot === 0) problems.push(`${which}: the footer alone`);
    for (const line of sheet.lines.slice(foot)) if (!words.includes(squash(line.text))) problems.push(`${which}: "${line.text}" under the footer`);
    const last = sheet.lines[foot - 1];
    if (last && heads.has(squash(last.text)) && (last.size >= 10.5 || last.text === last.text.toUpperCase())) problems.push(`${which}: "${last.text}" alone at its foot`);
    const body = sheet.lines.slice(0, foot);
    for (const line of body) if (line.over) problems.push(`${which}: words drawn over words (${line.over})`);
    for (let i = 1; i < body.length; i++) {
      const [over, under] = [body[i - 1], body[i]];
      if (under.y - over.y < 0.9 * Math.min(over.size, under.size) && Math.abs(under.x - over.x) < 3 && over.text.length > 2 && under.text.length > 2) {
        problems.push(`${which}: "${under.text}" drawn over "${over.text}"`);
      }
    }
  });
  return problems;
}
