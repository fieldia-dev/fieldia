import { checkPage, FieldSchema, validatePage, type Page, type PageValidation } from '@fieldia/core';
import { keepUnchanged } from './keep-unchanged';

/**
 * An edit's page, checked as `validatePage` checks it, at the cost of what
 * the edit changed. A page known to pass whose edit changed only some fields'
 * definitions — a label typed, a help, an option — needs those definitions
 * checked against the format, and the page's references checked (the quick
 * `checkPage`); the rest of it is as it was when it passed. Anything else, a
 * page not known to pass among it, is checked whole, and a page refused is
 * always refused by the whole check, so its problems read as they always have.
 *
 * The page handed back keeps every part the edit left alone (`keepUnchanged`).
 */
export function editChecker(): (before: Page, draft: Page) => PageValidation {
  /** Pages that passed: an edit of one of them may be checked by what it changed. */
  const passed = new WeakSet<Page>();
  return (before, draft) => {
    const next = keepUnchanged(before, draft);
    const changed = passed.has(before) ? changedFields(before, next) : null;
    if (changed && changed.every((name) => FieldSchema.safeParse(next.fields[name]).success) && checkPage(next).ok) {
      passed.add(next);
      return { ok: true, page: next };
    }
    const whole = validatePage(draft);
    if (!whole.ok) return whole;
    const page = keepUnchanged(before, whole.page);
    passed.add(page);
    return { ok: true, page };
  };
}

/** The fields whose definitions an edit changed, when that is all it changed; null when it changed anything else. */
function changedFields(before: Page, next: Page): string[] | null {
  if (next === before) return [];
  const keys = Object.keys(next) as (keyof Page)[];
  const was = Object.keys(before);
  if (keys.length !== was.length || keys.some((key, i) => key !== was[i] || (key !== 'fields' && next[key] !== before[key]))) return null;
  const names = Object.keys(next.fields);
  const had = Object.keys(before.fields);
  if (names.length !== had.length || names.some((name, i) => name !== had[i])) return null;
  return names.filter((name) => next.fields[name] !== before.fields[name]);
}
