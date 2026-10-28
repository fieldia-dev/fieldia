import type { Page } from '@fieldia/core';
import type { DesignerWords } from './designer-words';

/**
 * Words typed with a brace that names no field — " (as on the {customer} line)" in a question's words: the page's check
 * refuses them as a field's name its words would show (`no field "customer"`). The designer says so in its own words —
 * never the check's path into the page (0.36's walk: `fields.name.label: no field "customer"`) — and offers the fix a
 * person means: the braces shown as they are written (`\{customer}`, Fieldia's literal brace).
 */

/** A brace naming no field, at its path: what the page's check refused, and the name in the braces. */
export interface BraceRefused {
  path: string;
  name: string;
}

const NO_FIELD = /^no field "([^"]+)"$/;
const escaped = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** `{name}` written plainly — not already `\{name}` — in some words. */
const plainBrace = (name: string) => new RegExp(`(?<!\\\\)\\{${escaped(name)}\\}`, 'g');

/** The value at a page's path ("fields.name.label", "layout.children.0.title"). */
function at(page: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), page);
}

/** The refusal of a brace in words, where the check's issue is one: the words at its path quote `{name}`. */
export function braceRefused(draft: Page, issue: { path: string; message: string }): BraceRefused | null {
  const name = NO_FIELD.exec(issue.message)?.[1];
  const words = at(draft, issue.path);
  return name && typeof words === 'string' && plainBrace(name).test(words) ? { path: issue.path, name } : null;
}

/** It said in the designer's words: whose words they are — a field's, by its label on the page as it was — and the name. */
export function braceWords(page: Page, refused: BraceRefused, words: DesignerWords): string {
  const field = /^fields\.([^.]+)\./.exec(refused.path)?.[1];
  const label = field ? page.fields[field]?.label?.trim() : '';
  return label ? words.refusals.braceNoField(label, refused.name) : words.refusals.braceNoFieldHere(refused.name);
}

/** The page with each brace refused shown as it is written: `{customer}` as `\{customer}`, which the page reads as words. */
export function bracesShown(draft: Page, refused: readonly BraceRefused[]): Page {
  const next = JSON.parse(JSON.stringify(draft)) as Page;
  for (const { path, name } of refused) {
    const keys = path.split('.');
    const holder = (keys.length > 1 ? at(next, keys.slice(0, -1).join('.')) : next) as Record<string, unknown> | undefined;
    const last = keys[keys.length - 1];
    if (holder && typeof holder[last] === 'string') holder[last] = (holder[last] as string).replace(plainBrace(name), `\\{${name}}`);
  }
  return next;
}
