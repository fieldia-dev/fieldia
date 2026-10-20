import { isEmpty, type Field, type FieldNode, type JsonValue, type Line, type LineField, type Page, type SignatureEvidence, type Value, type Values } from '@fieldia/core';

/**
 * A signature's evidence (a signature node's `options.signs`): who signed, when, which answers, and a fingerprint —
 * SHA-256 — of those answers with who and when, written in one canonical form an app can write again from the record
 * it keeps, in any language, and compare.
 *
 * **The canonical form, `fieldia-signature/1`.** The text hashed is the JSON of
 *
 *     { "answers": { <field>: <answer>, … }, "at": <when>, "by": <who>, "field": <the signature's field>,
 *       "format": "fieldia-signature/1", "page": <the page's id> }
 *
 * written as RFC 8785 (JCS) writes JSON: no spaces, every object's keys in the order of their UTF-16 code units, strings
 * escaped as JSON.stringify escapes them, numbers as JavaScript writes them (12, 12.5, 0.1); `by` is left out when no one
 * is named. Its bytes are the text's UTF-8, and the fingerprint is their SHA-256 in small hexadecimal letters. Each
 * answer is the field's value as the person saw it as they signed, written so a store that hands it back another way
 * still reads the same:
 *
 * - nothing — null, an empty text, no choice, no line, a text of spaces — is `null`; yes and no are `true` and `false`;
 * - a number is itself; a text, a choice's value, a date ("2026-10-19") and a time are their text as kept;
 * - a date and time kept with its zone ("…Z", "…+02:00") is its instant in UTC with milliseconds
 *   ("2026-10-19T08:42:00.000Z"); one kept without a zone, its text as kept;
 * - a link is its record's id; several links, their ids in order; a reference `{ "id", "model" }`;
 * - a file is `{ "name", "size", "type" }` (never its bytes or where it is stored); several, in order;
 * - a table's lines are an array, a line each in order, each line an object of the table's own fields' answers;
 * - anything else (a saved form's answers, JSON) is its JSON, each value inside written by these rules.
 */

/** The canonical form's name, kept in the evidence and written in the text hashed. */
export const SIGNATURE_FORMAT = 'fieldia-signature/1';

/** A field's answer as the fingerprint reads it: plain JSON, the same however a store hands it back. */
export function signedAnswer(def: Field | LineField | undefined, value: Value | undefined): JsonValue {
  if (value === null || value === undefined || (def ? isEmpty(def, value) : isEmpty({ type: 'json' } as Field, value))) return null;
  // An instant written with its zone ("…Z", "…+02:00") is the same instant however it is written; one without is its text.
  if (def?.type === 'datetime' && typeof value === 'string' && /T.*([zZ]|[+-]\d\d:?\d\d)$/.test(value)) {
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? value : at.toISOString();
  }
  if (Array.isArray(value)) {
    // A table's lines: each line's own fields, never its key, which lasts as long as the page, or its id once saved.
    if (def?.type === 'one2many') return (value as Line[]).map((line) => Object.fromEntries(Object.entries(def.fields).map(([name, sub]) => [name, signedAnswer(sub, line.values?.[name])])));
    return (value as Value[]).map((item) => signedAnswer(undefined, item));
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if ('id' in object && 'label' in object) return 'model' in object ? { id: object['id'] as JsonValue, model: object['model'] as JsonValue } : (object['id'] as JsonValue);
    if (typeof object['name'] === 'string' && typeof object['type'] === 'string' && typeof object['size'] === 'number') return { name: object['name'], size: object['size'], type: object['type'] };
    const out: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(object)) if (item !== undefined) out[key] = signedAnswer(undefined, item as Value);
    return out;
  }
  return typeof value === 'number' && !Number.isFinite(value) ? null : (value as JsonValue);
}

/** JSON as RFC 8785 writes it: no spaces, each object's keys in the order of their UTF-16 code units. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined || typeof value !== 'object') return JSON.stringify(value ?? null) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

/** What a signature's fingerprint is made of: the page, the signature's field, who and when, and the answers by field. */
export interface SignedText {
  page: string;
  field: string;
  by?: string;
  at: string;
  answers: Record<string, JsonValue>;
}

/** The text a signature's fingerprint is the SHA-256 of, in the canonical form (`fieldia-signature/1`). */
export function signatureText(signed: SignedText): string {
  return canonicalJson({ answers: signed.answers, at: signed.at, ...(signed.by ? { by: signed.by } : {}), field: signed.field, format: SIGNATURE_FORMAT, page: signed.page });
}

/** The answers of `fields`, as the fingerprint reads them (`signedAnswer`), from a record's values and the page's fields. */
export function signedAnswers(page: Pick<Page, 'fields'>, values: Readonly<Values>, fields: readonly string[]): Record<string, JsonValue> {
  return Object.fromEntries(fields.map((name) => [name, signedAnswer(page.fields[name], values[name])]));
}

/**
 * Every field drawn as a signature on the page, wherever it stands: never an answer another signature signs. A signature
 * signs its answers; whether two people sign, and in which order, is the app's (a flow's) to say.
 */
export function signatureFields(page: Pick<Page, 'layout'>): Set<string> {
  const found = new Set<string>();
  const walk = (part: unknown) => {
    if (Array.isArray(part)) part.forEach(walk);
    else if (part && typeof part === 'object') {
      const node = part as Partial<FieldNode>;
      if (node.type === 'field' && node.widget === 'signature' && typeof node.field === 'string') found.add(node.field);
      Object.values(part).forEach(walk);
    }
  };
  walk(page.layout);
  return found;
}

/**
 * The answers a signature signs as it is signed: those its `signs` names — every answer, for `"form"` — that are shown
 * (`shown`, in the page's order: `form.shownFields()`), never a signature's own.
 */
export function answersToSign(page: Pick<Page, 'layout'>, node: Pick<FieldNode, 'field' | 'options'>, shown: readonly string[]): string[] {
  const signs = node.options?.['signs'];
  const signatures = signatureFields(page);
  const asked = signs === 'form' ? shown : Array.isArray(signs) ? shown.filter((name) => signs.includes(name)) : [];
  return [...new Set(asked)].filter((name) => name !== node.field && !signatures.has(name));
}

/** A signature's evidence: who, when, which answers, and the SHA-256 of the canonical text (`signatureText`). */
export async function signAnswers(signing: { page: Pick<Page, 'id' | 'fields'>; field: string; values: Readonly<Values>; fields: readonly string[]; by?: string; at: Date | string }): Promise<SignatureEvidence> {
  const at = typeof signing.at === 'string' ? signing.at : signing.at.toISOString();
  const by = signing.by?.trim() || undefined;
  const text = signatureText({ page: signing.page.id, field: signing.field, at, ...(by ? { by } : {}), answers: signedAnswers(signing.page, signing.values, signing.fields) });
  return { format: SIGNATURE_FORMAT, ...(by ? { by } : {}), at, fields: [...signing.fields], sha256: await sha256Hex(text) };
}

/**
 * Whether the answers a signature signed are still as they were: its fingerprint made again from the values now. An
 * evidence in a form this Fieldia does not write is never said to match.
 */
export async function answersMatch(evidence: SignatureEvidence, page: Pick<Page, 'id' | 'fields'>, field: string, values: Readonly<Values>): Promise<boolean> {
  if (evidence.format !== SIGNATURE_FORMAT) return false;
  const text = signatureText({ page: page.id, field, at: evidence.at, ...(evidence.by ? { by: evidence.by } : {}), answers: signedAnswers(page, values, evidence.fields) });
  return (await sha256Hex(text)) === evidence.sha256;
}

interface Digest {
  digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
}

/**
 * A text's SHA-256, in small hexadecimal letters, of its UTF-8 bytes: the browser's own (SubtleCrypto), or — where a
 * page is served without https and the browser keeps it from the page — worked out here, to the same result.
 */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = utf8(text);
  const subtle = (globalThis as { crypto?: { subtle?: Digest } }).crypto?.subtle;
  if (subtle?.digest) {
    try {
      return hex(new Uint8Array(await subtle.digest('SHA-256', bytes)));
    } catch {
      // Refused here: worked out below.
    }
  }
  return hex(sha256(bytes));
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/** A text's UTF-8 bytes; a lone half of a pair written as U+FFFD, as TextEncoder writes it. */
function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code < 0xdc00 && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) code = 0x10000 + ((code - 0xd800) << 10) + (text.charCodeAt(++i) - 0xdc00);
    else if (code >= 0xd800 && code < 0xe000) code = 0xfffd;
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return Uint8Array.from(out);
}

/**
 * SHA-256's constants as FIPS 180-4 defines them: the first 32 bits of the fractional parts of the square roots of the
 * first 8 primes (the start) and of the cube roots of the first 64 (each round's), worked out once.
 */
let constants: { start: number[]; rounds: Uint32Array } | null = null;
function sha256Constants() {
  if (constants) return constants;
  const start: number[] = [];
  const rounds: number[] = [];
  const bits = (root: number) => ((root % 1) * 2 ** 32) | 0;
  for (let n = 2; rounds.length < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) prime = false;
    if (!prime) continue;
    if (start.length < 8) start.push(bits(Math.sqrt(n)));
    rounds.push(bits(Math.cbrt(n)));
  }
  return (constants = { start, rounds: Uint32Array.from(rounds) });
}

/** SHA-256 (FIPS 180-4) of some bytes. */
function sha256(bytes: Uint8Array): Uint8Array {
  const { start, rounds: K } = sha256Constants();
  const h = Uint32Array.from(start);
  // The message, a 1 bit, zeros, and its length in bits, to a whole number of 64-byte blocks.
  const length = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(length);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(length - 8, Math.floor(bytes.length / 0x20000000));
  view.setUint32(length - 4, bytes.length << 3);
  const w = new Uint32Array(64);
  const rotate = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let block = 0; block < length; block += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(block + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = rotate(w[t - 15], 7) ^ rotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotate(w[t - 2], 17) ^ rotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = w[t - 16] + s0 + w[t - 7] + s1;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let t = 0; t < 64; t++) {
      const t1 = (k + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
      const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      k = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += k;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  h.forEach((word, i) => outView.setUint32(i * 4, word));
  return out;
}
