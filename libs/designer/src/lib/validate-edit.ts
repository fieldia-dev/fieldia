import { checkPage, FieldSchema, PageSchema, validatePage, type Page, type PageValidation } from '@fieldia/core';
import { keepUnchanged } from './keep-unchanged';

/**
 * An edit's page, checked as `validatePage` checks it, at the cost of what
 * the edit changed. A page known to pass whose edit left its layout alone —
 * a label typed, a help, an option, a translation, the title, the look —
 * needs only the fields and parts it changed checked against the format,
 * and the page's references checked (the quick `checkPage`): the rest is as
 * it was when it passed. Anything else, a page not known to pass among it,
 * is checked whole, and a page refused is always refused by the whole check,
 * so its problems read as they always have.
 *
 * The page handed back keeps every part the edit left alone (`keepUnchanged`).
 */
export interface EditChecker {
  (before: Page, draft: Page): PageValidation;
  /** Whether a page is known to pass: one this checker passed. */
  passed(page: Page): boolean;
}

export function editChecker(): EditChecker {
  /** Pages that passed: an edit of one of them may be checked by what it changed. */
  const passed = new WeakSet<Page>();
  const check = (before: Page, draft: Page): PageValidation => {
    const next = keepUnchanged(before, draft);
    const changed = passed.has(before) ? changedParts(before, next) : null;
    if (
      changed &&
      changed.fields.every((name) => FieldSchema.safeParse(next.fields[name]).success) &&
      changed.parts.every((key) => PARTS[key]?.safeParse(next[key as keyof Page]).success === true) &&
      checkPage(next).ok
    ) {
      passed.add(next);
      return { ok: true, page: next };
    }
    const whole = validatePage(draft);
    if (!whole.ok) return whole;
    const page = keepUnchanged(before, whole.page);
    passed.add(page);
    return { ok: true, page };
  };
  return Object.assign(check, { passed: (page: Page) => passed.has(page) });
}

/** The format of each part of a page, by its key: a part changed is checked against its own. */
const PARTS = (PageSchema as unknown as { shape: Record<string, { safeParse(value: unknown): { success: boolean } }> }).shape;

/**
 * What an edit changed, when it left the layout, and which parts and fields
 * the page has, as they were: the fields whose definitions changed, and the
 * page's other parts that did. Null when it changed anything else.
 */
function changedParts(before: Page, next: Page): { fields: string[]; parts: string[] } | null {
  if (next === before) return { fields: [], parts: [] };
  const keys = Object.keys(next) as (keyof Page)[];
  const was = Object.keys(before);
  if (keys.length !== was.length || keys.some((key, i) => key !== was[i]) || next.layout !== before.layout) return null;
  const names = Object.keys(next.fields);
  const had = Object.keys(before.fields);
  if (names.length !== had.length || names.some((name, i) => name !== had[i])) return null;
  return {
    fields: names.filter((name) => next.fields[name] !== before.fields[name]),
    parts: keys.filter((key) => key !== 'fields' && next[key] !== before[key]),
  };
}
