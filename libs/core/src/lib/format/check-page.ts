import { FIELD_TYPES } from './names';
import type { Page } from './page';
import { ReferenceCheck, type PageIssue, type PageValidation } from './references';
import { FORMAT_VERSION } from './version';

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const LAYOUTS = ['sheet', 'sections', 'tabs', 'wizard'];

/**
 * The check a page gets as it is shown: its outline, then every name and
 * condition in it, the same as `validatePage` finds them. It leaves out the
 * key-by-key check of the format, and so the validation library, which an app
 * showing forms need not carry; run `validatePage` where pages are made or
 * tested. A page that passes is handed back as it is.
 */
export function checkPage(input: unknown): PageValidation {
  if (!isObject(input)) return { ok: false, issues: [{ path: '(page)', message: 'a page is a JSON object' }] };
  const issues: PageIssue[] = [];
  const say = (path: string, message: string) => issues.push({ path, message });
  if (input['fieldia'] !== FORMAT_VERSION) say('fieldia', `this build reads format ${FORMAT_VERSION}`);
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
  if (!isObject(layout) || !LAYOUTS.includes(layout['type'] as string) || !Array.isArray(layout['children'])) {
    say('layout', 'the layout is a sheet, sections, tabs or wizard, with children');
  }
  if (issues.length) return { ok: false, issues };
  const page = input as unknown as Page;
  try {
    const found = new ReferenceCheck(page).run();
    return found.length ? { ok: false, issues: found } : { ok: true, page };
  } catch (error) {
    return { ok: false, issues: [{ path: '(page)', message: `a part of this page cannot be read: ${(error as Error).message}` }] };
  }
}
