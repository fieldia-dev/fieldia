import { checkPage } from './check-page';
import { validatePage } from './validate';
import type { Page } from './page';

/**
 * What a field says it may hold, held to itself (the audit's R-M5): pages `validatePage` passed and a form could then
 * never take — refused now by both checks, in words, at the path; and a required field nothing shows, a warning.
 */
const page = (fields: Record<string, unknown>, more: Record<string, unknown> = {}): Page =>
  ({
    fieldia: '0.13',
    id: 'p',
    data: { kind: 'responses' },
    fields,
    layout: { type: 'sections', id: 'root', children: Object.keys(fields).map((name) => ({ type: 'field', id: `f-${name}`, field: name })) },
    ...more,
  }) as unknown as Page;
const refused = (given: Page) => {
  const validated = validatePage(given);
  const checked = checkPage(given);
  return { validated: validated.ok ? [] : validated.issues, checked: checked.ok ? [] : checked.issues };
};
const both = (given: Page, path: string, words: RegExp) => {
  const { validated, checked } = refused(given);
  expect(validated).toEqual([{ path, message: expect.stringMatching(words) }]);
  expect(checked).toEqual(validated);
};

describe('what a field says it may hold, held to itself', () => {
  it('its least no more than its most', () => {
    both(page({ qty: { type: 'integer', label: 'Qty', min: 10, max: 5 } }), 'fields.qty.min', /the least \(10\) is more than the most \(5\): no value could be given/);
    both(page({ rate: { type: 'float', label: 'Rate', min: 0.5, max: 0.1 } }), 'fields.rate.min', /the least \(0\.5\) is more than the most \(0\.1\)/);
    expect(refused(page({ qty: { type: 'integer', label: 'Qty', min: 5, max: 5 } }))).toEqual({ validated: [], checked: [] });
  });

  it('its first value of its kind, inside its bounds', () => {
    both(page({ qty: { type: 'integer', label: 'Qty', default: 'five' } }), 'fields.qty.default', /"five" is not a whole number: an integer field's first value/);
    both(page({ qty: { type: 'integer', label: 'Qty', default: 2.5 } }), 'fields.qty.default', /2\.5 is not a whole number/);
    both(page({ price: { type: 'float', label: 'Price', default: '9.99' } }), 'fields.price.default', /"9\.99" is not a number/);
    both(page({ qty: { type: 'integer', label: 'Qty', min: 1, max: 9, default: 12 } }), 'fields.qty.default', /12 is outside the field's own bounds \(1 to 9\)/);
    both(page({ ok: { type: 'boolean', label: 'OK', default: 'yes' } }), 'fields.ok.default', /"yes" is not true or false/);
    both(page({ name: { type: 'char', label: 'Name', default: 5 } }), 'fields.name.default', /5 is not words/);
    both(page({ day: { type: 'date', label: 'Day', default: 'tomorrow' } }), 'fields.day.default', /"tomorrow" is not a day: a date's first value is "YYYY-MM-DD", "today"/);
    for (const fine of [{ type: 'integer', label: 'Qty', min: 1, default: 3 }, { type: 'date', label: 'Day', default: 'today+1' }, { type: 'date', label: 'Day', default: '2026-10-26' }, { type: 'char', label: 'Name', translate: ['ar', 'en'], default: { en: 'Hi' } }, { type: 'boolean', label: 'OK', default: false }]) {
      expect(refused(page({ x: fine }))).toEqual({ validated: [], checked: [] });
    }
  });

  it('a choice: each option\'s value once, its first value one of them', () => {
    const options = [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }];
    both(page({ state: { type: 'selection', label: 'State', options: [...options, { value: 'draft', label: 'Draft again' }] } }), 'fields.state.options[2].value', /"draft" is the value of an option before it/);
    both(page({ state: { type: 'selection', label: 'State', options, default: 'archived' } }), 'fields.state.default', /"archived" is not one of the field's options: its first value is one of "draft", "active"/);
    both(page({ tags: { type: 'selection', label: 'Tags', multiple: true, options, default: 'draft' } }), 'fields.tags.default', /a choice of several starts with a list of them, as \["draft"\]/);
    // An answer of one's own may be anything; options from the app's list are not the page's to know.
    expect(refused(page({ state: { type: 'selection', label: 'State', options, other: true, default: 'archived' } }))).toEqual({ validated: [], checked: [] });
    expect(refused(page({ state: { type: 'selection', label: 'State', options, default: 'active' }, tags: { type: 'selection', label: 'Tags', multiple: true, options, default: ['draft', 'active'] } }))).toEqual({ validated: [], checked: [] });
  });

  it('a list\'s column once', () => {
    const list = { fieldia: '0.13', id: 'l', data: { kind: 'record', model: 'x' }, fields: { name: { type: 'char', label: 'Name' } }, layout: { type: 'list', id: 'list', columns: ['name', 'name'] } } as unknown as Page;
    both(list, 'layout.columns[1]', /"name" is a column before it: each column once/);
  });

  it('a required field nothing shows: a warning where pages are made, never a refusal', () => {
    const hidden = page({ name: { type: 'char', label: 'Name' }, code: { type: 'char', label: 'Code', required: true } });
    (hidden.layout as unknown as { children: unknown[] }).children.pop();
    const validated = validatePage(hidden);
    expect(validated).toMatchObject({ ok: true, warnings: [{ path: 'fields.code.required', message: expect.stringMatching(/"code" is required, but no part of the page shows it/) }] });
    expect(checkPage(hidden).ok).toBe(true);
    // Hidden where it is placed, the same.
    const placedHidden = page({ code: { type: 'char', label: 'Code', required: true } });
    ((placedHidden.layout as unknown as { children: Record<string, unknown>[] }).children[0])['invisible'] = true;
    expect(validatePage(placedHidden).warnings?.map((w) => w.path)).toEqual(['fields.code.required']);
    // Worked out, given a first value, or filled by the link: nothing to ask.
    for (const filled of [{ compute: "'X'" }, { default: 'X' }]) {
      const given = page({ name: { type: 'char', label: 'Name' }, code: { type: 'char', label: 'Code', required: true, ...filled } });
      (given.layout as unknown as { children: unknown[] }).children.pop();
      expect(validatePage(given).warnings).toBeUndefined();
    }
    const linked = page({ name: { type: 'char', label: 'Name' }, code: { type: 'char', label: 'Code', required: true } }, { prefill: { fromUrl: ['code'] } });
    (linked.layout as unknown as { children: unknown[] }).children.pop();
    expect(validatePage(linked).warnings).toBeUndefined();
    // Shown by another part's widget, named in its options: a date range's end (the leave request's template).
    const range = page({ from: { type: 'date', label: 'From', required: true }, to: { type: 'date', label: 'To', required: true } });
    const children = (range.layout as unknown as { children: Record<string, unknown>[] }).children;
    children.pop();
    Object.assign(children[0], { widget: 'daterange', options: { endField: 'to' } });
    expect(validatePage(range)).toMatchObject({ ok: true });
    expect(validatePage(range).warnings).toBeUndefined();
  });
});
