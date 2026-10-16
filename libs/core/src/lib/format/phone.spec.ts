import { validatePage } from '../../index';
import { PageSchema } from './page';

/**
 * Phone numbers read the world over (`"widget": "phone"`): the page's `phone` and a phone field's own `country` and
 * `shown` are known to the format, so a country or a way of showing written wrong is refused before anything draws.
 * A page that says neither is read as before.
 */

const page = (more: Record<string, unknown> = {}, options?: Record<string, unknown>) => ({
  fieldia: '0.2',
  id: 'contact',
  data: { kind: 'responses' },
  fields: { mobile: { type: 'char', label: 'Mobile' } },
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'm', field: 'mobile', widget: 'phone', ...(options ? { options } : {}) }] },
  ...more,
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a page’s phone numbers in the format', () => {
  it('takes a country to read numbers in and a way to show them, on the page or on a phone field', () => {
    expect(problems(page())).toEqual([]);
    expect(problems(page({ phone: {} }))).toEqual([]);
    expect(problems(page({ phone: { country: 'EG', shown: 'national' } }))).toEqual([]);
    expect(problems(page({}, { country: 'AE', shown: 'international' }))).toEqual([]);
    // A phone field's other options stay as they are.
    expect(problems(page({}, { clear: false }))).toEqual([]);
  });

  it('refuses a country not written as its ISO code, a way of showing it does not know, and a word it does not know', () => {
    expect(problems(page({ phone: { country: 'eg' } }))).toEqual(['phone.country: a country is its ISO code in capitals, such as "EG"']);
    expect(problems(page({ phone: { shown: 'local' } }))).toEqual(['phone.shown: shown is "international" (+20 10 1234 5678) or "national" (010 1234 5678)']);
    expect(problems(page({ phone: { countries: ['EG'] } }))).toEqual(['phone: Unrecognized key: "countries"']);
    expect(problems(page({}, { country: 'Egypt' }))).toEqual(['layout.children[0].options.country: a country is its ISO code in capitals, such as "EG"']);
    // Another widget's options are not a phone's.
    const text = page({}, { country: 'Egypt' });
    (text.layout.children[0] as Record<string, unknown>)['widget'] = 'email';
    expect(problems(text)).toEqual([]);
  });

  it('is in the JSON Schema as the page’s own', () => {
    expect(PageSchema.safeParse(page({ phone: { country: 'SA' } })).success).toBe(true);
  });
});
