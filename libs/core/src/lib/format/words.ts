/**
 * Words that hold a field's value, as an alert's or a text's: "The tax lock
 * date is {tax_lock_date}" shows the date the record holds there, as the
 * field shows it. After a bar, the words shown while the field is empty:
 * "How was your visit to {branch|this branch}?" — the page's own words,
 * translated with the rest of them. A name in braces that is no field of the
 * page is refused by the page check; braces round anything else are left as
 * they are.
 */
const VALUE = /\{([A-Za-z_][A-Za-z0-9_]*)(?:\|([^{}]*))?\}/g;

/** The fields words show the values of, in the order they show them. */
export function valuesIn(words: string): string[] {
  return [...words.matchAll(VALUE)].map((match) => match[1]);
}

/** The words with each `{field}` replaced by what `value` gives for it — its words while empty, where it has some. */
export function fillValues(words: string, value: (field: string) => string): string {
  return words.replace(VALUE, (_, name: string, empty?: string) => value(name) || (empty ?? ''));
}

/**
 * The words cut at each `{field}`: words, then a field's name with its words while empty (`fallback`), in turn — for
 * drawing a value set apart from the words round it.
 */
export function splitValues(words: string): { text: string; field?: string; fallback?: string }[] {
  const parts: { text: string; field?: string; fallback?: string }[] = [];
  let at = 0;
  for (const match of words.matchAll(VALUE)) {
    if (match.index > at) parts.push({ text: words.slice(at, match.index) });
    parts.push({ text: '', field: match[1], ...(match[2] !== undefined ? { fallback: match[2] } : {}) });
    at = match.index + match[0].length;
  }
  if (at < words.length) parts.push({ text: words.slice(at) });
  return parts;
}
