import { FIELD_TYPES } from './names';
import type { Page } from './page';
import type { Field, LineField } from './field';
import { ReferenceCheck, type PageIssue, type PageValidation } from './references';
import type { FunctionsKnown } from '../expression/app-functions';
import { formatProblem } from './version';
import { upgradePage } from './upgrade';
import { shapeIssues } from './shape-check';
import { PAGE_SHAPE } from './page-shape';

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const LAYOUTS = ['sheet', 'sections', 'tabs', 'wizard'];

/**
 * The check a page gets as it is shown, refusing what `validatePage` refuses: its outline, then its whole shape —
 * every key and value against the format's schema and its rules, read without the validation library an app showing
 * forms need not carry (shape-check.ts) — then every name and condition in it, as `validatePage` finds them (its
 * warnings — a value of a kind a function does not take — are said where pages are made, and stop nothing).
 * shape-parity.spec.ts holds the two to one verdict. A page that passes is handed back as it is — one in an older
 * format, brought up to date (`upgradePage`). A line's own form — a page of a table's line fields — is checked with
 * `parent`, the fields of the record the line is on, which its conditions read as `parent`; `functions`, the app's
 * own, which its expressions may call besides Fieldia's. `shape: false` leaves the shape out, for a caller that checked
 * it against the format's schemas itself (the designer, the parts an edit changed).
 */
export function checkPage(given: unknown, options: { parent?: Record<string, Field | LineField>; functions?: FunctionsKnown; shape?: false } = {}): PageValidation {
  // A page in an older format is read as the current one (upgradePage); one newer than this Fieldia is said to be.
  const input = upgradePage(given);
  if (!isObject(input)) return { ok: false, issues: [{ path: '(page)', message: 'a page is a JSON object' }] };
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
  if (issues.length) return { ok: false, issues };
  // Its whole shape, as `validatePage` checks it — the format's schema and its rules, read without the validation
  // library (shape-check.ts) — unless the caller checked it against the schemas already (the designer, an edit's part).
  // Every page needs it, so the one-tag script's main script carries it too: no part to wait for before a page is drawn.
  const shaped = options.shape === false ? [] : shapeIssues(input, PAGE_SHAPE);
  const page = input as unknown as Page;
  try {
    // A line's own form reads the record the line is on as parent.
    const check = new ReferenceCheck(page, options.parent ? { name: page.id, parent: options.parent } : undefined, { functions: options.functions });
    const found = check.run();
    // The one-tag script's checks that come with a part not come yet: the viewer runs this again once it has.
    const later = check.later.size ? { later: [...check.later] } : {};
    // What the names and conditions found is said in their own words first; the shape's, where they found nothing.
    if (found.length) return { ok: false, issues: found, ...later };
    return shaped.length ? { ok: false, issues: shaped } : { ok: true, page, ...later };
  } catch (error) {
    // A part the names' check could not read: what the shape says of it, where it says anything.
    if (shaped.length) return { ok: false, issues: shaped };
    return { ok: false, issues: [{ path: '(page)', message: `a part of this page cannot be read: ${(error as Error).message}` }] };
  }
}
