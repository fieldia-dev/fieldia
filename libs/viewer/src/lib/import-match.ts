import { foldForSearch, type Page } from '@fieldia/core';

/**
 * A file's columns matched to a page's fields, as a list's Import first
 * offers them: a column whose header names a field — by its name or its
 * label in any of the page's languages, in any case, with or without its
 * accents, spaces and marks ("E-mail", "email", "البريد الإلكتروني") — fills
 * that field; each field from one column, the first that names it. The
 * person then changes any of them, column by column.
 */

/** Words as a header is matched: folded as a search folds them, accents and every mark but letters and digits left out. */
export function matchKey(words: string): string {
  return foldForSearch(words)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Words and every translation the page has of them, whichever language it is shown in: the words, those of every
 * language its `translations` give for them, and — where the words are a translation already (a page shown in
 * Arabic) — the words they translate and their other translations.
 */
export function inEveryLanguage(page: Page, words: string): string[] {
  const all = new Set([words]);
  const maps = Object.values(page.translations ?? {});
  const sources = new Set([words]);
  for (const map of maps) for (const [source, translated] of Object.entries(map)) if (translated === words) sources.add(source);
  for (const source of sources) {
    all.add(source);
    for (const map of maps) if (map[source]) all.add(map[source]);
  }
  return [...all];
}

/** The names a column's header may call a field by: its own name (a link's without its "_id"), and its label in every language of the page. */
export function namesOf(page: Page, field: string): string[] {
  const def = page.fields[field];
  return [field, field.replace(/_ids?$/, ''), ...(def ? inEveryLanguage(page, def.label) : [])];
}

/** For each column, by its header, the field it fills — one of `fields` — or null where none is named; each field once, by its first column. */
export function matchColumns(page: Page, headers: readonly string[], fields: readonly string[]): (string | null)[] {
  const byKey = new Map<string, string>();
  for (const field of fields) for (const name of namesOf(page, field)) if (matchKey(name) && !byKey.has(matchKey(name))) byKey.set(matchKey(name), field);
  const taken = new Set<string>();
  return headers.map((header) => {
    const field = byKey.get(matchKey(header));
    if (!field || taken.has(field)) return null;
    taken.add(field);
    return field;
  });
}
