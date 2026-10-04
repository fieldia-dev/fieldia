/**
 * JSON as a person types it: read with the place of every key and value
 * kept, so a problem found in the page can be shown on its own line; and a
 * mistake in the text itself said in words, with its line and column.
 * Browsers word JSON.parse's errors each their own way, and some give no
 * place at all, so the text is read here, the same in every one.
 */

/** A place in the text: line and column, both from 1. */
export interface Place {
  line: number;
  column: number;
}

/** Where a value starts, and where each of its keys and items does. */
export interface Spot {
  at: number;
  keys?: Map<string, { at: number; value: Spot }>;
  items?: Spot[];
}

export type JsonRead = { ok: true; value: unknown; tree: Spot } | { ok: false; problem: Place & { message: string } };

class Mistake extends Error {
  constructor(
    message: string,
    readonly at: number
  ) {
    super(message);
  }
}

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const WORD = /[A-Za-z_$][\w$]*/y;
const ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
const ANY_VALUE = 'This is not a value JSON knows: text in double quotes, a number, true, false, null, [ … ] or { … }';

/** The line and column of an offset in the text. */
export function placeAt(text: string, offset: number): Place {
  let line = 1;
  let start = 0;
  for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) {
    line++;
    start = i + 1;
  }
  return { line, column: offset - start + 1 };
}

/** The offset of a line and column, kept inside the text. */
export function offsetOf(text: string, place: Place): number {
  let at = 0;
  for (let line = 1; line < place.line; line++) {
    const next = text.indexOf('\n', at);
    if (next === -1) return text.length;
    at = next + 1;
  }
  const end = text.indexOf('\n', at);
  return Math.min(at + place.column - 1, end === -1 ? text.length : end);
}

export function readJson(text: string): JsonRead {
  let i = 0;
  const space = () => {
    while (i < text.length && ' \t\n\r'.includes(text[i])) i++;
  };
  function fail(message: string, at = i): never {
    throw new Mistake(message, at);
  }
  /** What is found where a value or a key should be, said as a person would. */
  function unexpected(wanted: string): never {
    if (i >= text.length) fail(`The text ends too soon: ${wanted}`);
    if (text.startsWith('//', i) || text.startsWith('/*', i)) fail('JSON has no comments');
    if (text[i] === "'") fail('Text goes in double quotes');
    return fail(ANY_VALUE);
  }

  function string(): string {
    const open = i++;
    let out = '';
    for (;;) {
      if (i >= text.length) fail('This text has no closing double quote', open);
      const c = text[i];
      if (c === '"') {
        i++;
        return out;
      }
      if (c === '\n' || c === '\r') fail('A line break cannot sit inside text: write \\n');
      if (c < ' ') fail('A control character cannot sit inside text');
      if (c !== '\\') {
        out += c;
        i++;
        continue;
      }
      const e = text[i + 1];
      if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
        out += String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16));
        i += 6;
      } else if (e !== undefined && e in ESCAPES) {
        out += ESCAPES[e];
        i += 2;
      } else fail(`"\\${e ?? ''}" is not something JSON knows: write \\\\ for a backslash`);
    }
  }

  function value(): [unknown, Spot] {
    space();
    const at = i;
    const c = text[i];
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === '"') return [string(), { at }];
    for (const [word, meant] of [['true', true], ['false', false], ['null', null]] as const) {
      if (text.startsWith(word, i) && !/[\w$]/.test(text[i + word.length] ?? '')) {
        i += word.length;
        return [meant, { at }];
      }
    }
    NUMBER.lastIndex = i;
    const number = NUMBER.exec(text);
    if (number) {
      i += number[0].length;
      if (/^-?0$/.test(number[0]) && /\d/.test(text[i] ?? '')) fail('A number cannot start with extra zeros', at);
      return [Number(number[0]), { at }];
    }
    return unexpected('a value is missing');
  }

  /** After an item: a comma and the next, or the end. Says what is missing in between. */
  function after(close: '}' | ']'): boolean {
    space();
    if (text[i] === ',') {
      const comma = i++;
      space();
      if (text[i] === close) fail('Nothing follows this comma: take it away', comma);
      return true;
    }
    if (text[i] === close) {
      i++;
      return false;
    }
    if (i >= text.length) fail(`The text ends too soon: a closing ${close} is missing`);
    // On to the next key straight away: only the comma between them is missing.
    if (close === '}' && text[i] === '"') fail('A comma is missing before this');
    return fail(`A comma or a closing ${close} is missing here`);
  }

  function object(): [unknown, Spot] {
    const spot: Spot = { at: i++, keys: new Map() };
    const out: Record<string, unknown> = {};
    space();
    if (text[i] === '}') {
      i++;
      return [out, spot];
    }
    do {
      space();
      const keyAt = i;
      if (text[i] !== '"') {
        WORD.lastIndex = i;
        const word = WORD.exec(text);
        if (word) fail(`A key goes in double quotes, such as "${word[0]}"`);
        unexpected('a closing } is missing');
      }
      const key = string();
      space();
      if (text[i] !== ':') fail('A colon is missing after the key');
      i++;
      const [item, itemSpot] = value();
      // As JSON.parse: a key named __proto__ is a key, never the object's prototype.
      Object.defineProperty(out, key, { value: item, enumerable: true, writable: true, configurable: true });
      spot.keys?.set(key, { at: keyAt, value: itemSpot });
    } while (after('}'));
    return [out, spot];
  }

  function array(): [unknown, Spot] {
    const spot: Spot = { at: i++, items: [] };
    const out: unknown[] = [];
    space();
    if (text[i] === ']') {
      i++;
      return [out, spot];
    }
    do {
      space();
      if (i >= text.length) fail('The text ends too soon: a closing ] is missing');
      const [item, itemSpot] = value();
      out.push(item);
      spot.items?.push(itemSpot);
    } while (after(']'));
    return [out, spot];
  }

  try {
    space();
    if (i >= text.length) fail('The box is empty: a page is a JSON object, { … }');
    const [read, tree] = value();
    space();
    if (i < text.length) fail('There is more after the end: one { … } is the whole page');
    return { ok: true, value: read, tree };
  } catch (error) {
    if (!(error instanceof Mistake)) throw error;
    return { ok: false, problem: { ...placeAt(text, error.at), message: error.message } };
  }
}

/**
 * Where a path into the page sits in the text: `layout.children[0].field`, as
 * the page's checks name a place. A key may hold dots or brackets of its own,
 * so the longest key that fits is taken. When part of the path is missing —
 * a key the page needs and lacks — the deepest part there is.
 */
export function placeOf(text: string, tree: Spot, path: string): Place {
  let spot = tree;
  let at = tree.at;
  // "(page)", the page itself, names no key: the page's own place.
  let rest = path;
  while (rest) {
    const item = /^\[(\d+)\]/.exec(rest);
    if (item) {
      const next = spot.items?.[Number(item[1])];
      if (!next) break;
      spot = next;
      at = next.at;
      rest = rest.slice(item[0].length);
      continue;
    }
    if (rest.startsWith('.')) rest = rest.slice(1);
    let best: string | null = null;
    for (const key of spot.keys?.keys() ?? []) {
      const fits = rest === key || rest.startsWith(`${key}.`) || rest.startsWith(`${key}[`);
      if (fits && (best === null || key.length > best.length)) best = key;
    }
    const found = best === null ? undefined : spot.keys?.get(best);
    if (best === null || !found) break;
    spot = found.value;
    at = found.at;
    rest = rest.slice(best.length);
  }
  return placeAt(text, at);
}

/** The path to the first object that passes `test`, written as the page's checks write paths; null when there is none. */
export function pathTo(value: unknown, test: (value: object) => boolean, path = ''): string | null {
  if (value === null || typeof value !== 'object') return null;
  if (path && test(value)) return path;
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((item, i) => [`${path}[${i}]`, item])
    : Object.entries(value).map(([key, item]) => [path ? `${path}.${key}` : key, item]);
  for (const [at, item] of entries) {
    const found = pathTo(item, test, at);
    if (found !== null) return found;
  }
  return null;
}
