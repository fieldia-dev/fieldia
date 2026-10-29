import { FIELD_TYPES } from './names';
import type { Page } from './page';
import type { Field, LineField } from './field';
import { ReferenceCheck, type CheckOptions, type PageIssue, type PageValidation } from './references';
import type { FunctionsKnown } from '../expression/app-functions';
import { formatProblem } from './version';
import { upgradePage } from './upgrade';

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const LAYOUTS = ['sheet', 'sections', 'tabs', 'wizard'];

/** How a page is checked: a line's own form with `parent`, the fields of the record the line is on; the app's `functions`. */
export interface PageCheckOptions {
  parent?: Record<string, Field | LineField>;
  functions?: FunctionsKnown;
}

/**
 * A page's outline: an object, in a format this Fieldia reads, with an id, its data, its fields each a kind Fieldia
 * knows with a label, and a layout of its kinds — what every check reads first. The page brought up to date
 * (`upgradePage`), or why it cannot be read at all.
 */
export function pageOutline(given: unknown): { page: Record<string, unknown>; issues: PageIssue[] } | { page: null; issues: PageIssue[] } {
  // A page in an older format is read as the current one (upgradePage); one newer than this Fieldia is said to be.
  const input = upgradePage(given);
  if (!isObject(input)) return { page: null, issues: [{ path: '(page)', message: 'a page is a JSON object' }] };
  const issues: PageIssue[] = [];
  const say = (path: string, message: string) => issues.push({ path, message });
  const format = formatProblem(input['fieldia']);
  if (format) say('fieldia', format);
  if (typeof input['id'] !== 'string' || !input['id']) say('id', 'a page needs an id');
  const data = input['data'];
  if (!isObject(data) || !(data['kind'] === 'responses' || (data['kind'] === 'record' && typeof data['model'] === 'string' && data['model']))) {
    say('data', 'data is { "kind": "record", "model": … } or { "kind": "responses" }');
  }
  const fields = input['fields'];
  if (!isObject(fields)) say('fields', 'fields is an object of field definitions, by name');
  else {
    for (const [name, def] of Object.entries(fields)) {
      if (!isObject(def) || !(FIELD_TYPES as readonly unknown[]).includes(def['type']) || typeof def['label'] !== 'string') {
        say(`fields.${name}`, 'a field needs a type Fieldia knows and a label');
      }
    }
  }
  const layout = input['layout'];
  const isList = isObject(layout) && layout['type'] === 'list';
  if (!isObject(layout) || (isList ? !Array.isArray(layout['columns']) : !LAYOUTS.includes(layout['type'] as string) || !Array.isArray(layout['children']))) {
    say('layout', 'the layout is a sheet, sections, tabs or wizard, with children, or a list with columns');
  }
  return { page: input, issues };
}

/**
 * Every name and condition in a page whose outline passed, as `validatePage` finds them: `sense`, the whole check's own
 * checks of its settings besides (check-whole.ts). `later`: the one-tag script's checks that come with a part not come
 * yet, which the viewer runs again once it has.
 */
export function pageReferences(page: Page, options: PageCheckOptions, sense?: CheckOptions['sense']): { issues: PageIssue[]; later?: string[] } {
  // A line's own form reads the record the line is on as parent.
  const check = new ReferenceCheck(page, options.parent ? { name: page.id, parent: options.parent } : undefined, { functions: options.functions, sense });
  const found = check.run();
  return check.later.size ? { issues: found, later: [...check.later] } : { issues: found };
}

/**
 * The check a page gets before it is drawn — what the viewer refuses at once, as 0.35's viewer refused it: its outline,
 * then every name and condition in it, the same as `validatePage` finds them (its warnings — a value of a kind a function
 * does not take — are said where pages are made, and stop nothing). It leaves out the key-by-key check of the format and
 * the settings held to themselves: the whole check (`checkPageWhole`, a part of its own, check-whole.ts), which gives
 * `validatePage`'s verdict, and which every viewer runs as soon as the page is drawn, taking down a page it refuses and
 * holding every write through the page until it has run (0.37, `page.invalid`). Run `validatePage` where pages are made
 * or tested. A page that passes is handed back as it is — one in an older format, brought up to date (`upgradePage`). A
 * line's own form — a page of a table's line fields — is checked with `parent`, the fields of the record the line is on,
 * which its conditions read as `parent`; `functions`, the app's own, which its expressions may call besides Fieldia's.
 * In the one-tag script the checks of what a part draws (a list's settings, a map's: owed-checks.ts) are owed until it
 * came (`later`).
 */
export function checkPage(given: unknown, options: PageCheckOptions = {}): PageValidation {
  const outline = pageOutline(given);
  if (!outline.page || outline.issues.length) return { ok: false, issues: outline.issues };
  const page = outline.page as unknown as Page;
  try {
    const { issues, later } = pageReferences(page, options);
    const owed = later ? { later } : {};
    return issues.length ? { ok: false, issues, ...owed } : { ok: true, page, ...owed };
  } catch (error) {
    return { ok: false, issues: [{ path: '(page)', message: `a part of this page cannot be read: ${(error as Error).message}` }] };
  }
}
