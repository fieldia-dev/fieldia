/**
 * Words that hold a field's value, as an alert's or a text's: "The tax lock
 * date is {tax_lock_date}" shows the date the record holds there, as the
 * field shows it. After a bar, the words shown while the field is empty:
 * "How was your visit to {branch|this branch}?" — the page's own words,
 * translated with the rest of them. A name in braces that is no field of the
 * page is refused by the page check; braces round anything else are left as
 * they are.
 *
 * A backslash right before a brace shows the brace as written, never a value:
 * `\{list}` shows "{list}". A run of backslashes before a brace shows half of
 * them (`\\{name}` a backslash, then the value); an odd one leaves the brace
 * written. Backslashes anywhere else stay as written. This is the one reader of
 * a page's words: everything that shows them, checks them or finds the fields
 * they name reads them here.
 */
const WORD = /(\\*)\{(?:([A-Za-z_][A-Za-z0-9_]*)(?:\|([^{}]*))?\})?/g;

/** A piece of words read: words as shown, or a field's value with its words while empty (`fallback`). */
type Piece = { text: string; field?: string; fallback?: string };

/** The words read: what shows as written — each run of backslashes before a brace halved — and each `{field}` between. */
function read(words: string): Piece[] {
  const pieces: Piece[] = [];
  let text = '';
  let at = 0;
  for (const match of words.matchAll(WORD)) {
    const [all, slashes, field, fallback] = match;
    text += words.slice(at, match.index) + slashes.slice(0, slashes.length >> 1);
    at = match.index + all.length;
    // A brace after an odd run is written, and no value starts there: nor does one in what follows it here, which holds no brace.
    if (field === undefined || slashes.length % 2) text += all.slice(slashes.length);
    else {
      if (text) pieces.push({ text });
      text = '';
      pieces.push({ text: '', field, ...(fallback !== undefined ? { fallback } : {}) });
    }
  }
  text += words.slice(at);
  if (text) pieces.push({ text });
  return pieces;
}

/** The fields words show the values of, in the order they show them. */
export function valuesIn(words: string): string[] {
  return read(words).flatMap((piece) => (piece.field ? [piece.field] : []));
}

/** The words with each `{field}` replaced by what `value` gives for it — its words while empty, where it has some. */
export function fillValues(words: string, value: (field: string) => string): string {
  return read(words)
    .map((piece) => (piece.field ? value(piece.field) || (piece.fallback ?? '') : piece.text))
    .join('');
}

/**
 * The words cut at each `{field}`: words, then a field's name with its words while empty (`fallback`), in turn — for
 * drawing a value set apart from the words round it.
 */
export function splitValues(words: string): { text: string; field?: string; fallback?: string }[] {
  return read(words);
}

/**
 * Words that show no values — a section's title, a tab's, a box's placeholder — as a person reads them: each escaped
 * brace a brace (`\{list}` "{list}"), and a `{field}` as written.
 */
export function plainWords(words: string): string;
export function plainWords(words: string | undefined): string | undefined;
export function plainWords(words: string | undefined): string | undefined {
  // A brace's run of backslashes halved, whether it escapes the brace or not: a `{field}` here is shown as written.
  return words?.replace(/(\\+)\{/g, (_, slashes: string) => `${slashes.slice(0, slashes.length >> 1)}{`);
}

/**
 * Words of the page's that Fieldia fills in itself — a pattern's hint names the field, `{label}` — read as words that
 * show values: each name `values` holds filled in, any other `{field}` as written, each escaped brace a brace.
 */
export function fillNamed(words: string, values: Readonly<Record<string, string>>): string {
  return read(words)
    .map((piece) => (!piece.field ? piece.text : Object.hasOwn(values, piece.field) ? values[piece.field] : `{${piece.field}${piece.fallback !== undefined ? `|${piece.fallback}` : ''}}`))
    .join('');
}

/**
 * Whether words, or a page's JSON that holds them, need reading: a `{field}` in them, or a brace escaped. Words without
 * either show as they are written.
 */
export const READ_WORDS = /\\\{|\{[A-Za-z_]\w*(?:\|[^{}]*)?\}/;

/**
 * `text` written so that every reader of a page's words shows it exactly as it is, with no value and nothing for the
 * page check to refuse: each brace escaped, each run of backslashes before one doubled. An app that puts words it did not
 * write into a page — a step's help, a choice from its own list — passes them through this, at one place.
 */
export function literalWords(text: string): string {
  return text.replace(/(\\*)\{/g, (_, slashes: string) => `${slashes}${slashes}\\{`);
}
