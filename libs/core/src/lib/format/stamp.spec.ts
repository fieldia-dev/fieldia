import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lowestFormat, needOf, stampPage } from './stamp';
import { checkPage } from './check-page';
import { wholeCheck } from './check-whole';
import { validatePage } from './validate';
import { upgradePage } from './upgrade';
import { FORMAT_VERSION, FORMAT_VERSIONS } from './version';
import * as Viewer030 from './test-version-0.30';
import type { Page } from './page';

/**
 * A page stamped with the lowest format its settings need (the audit's R-M7), and read by its stamp. The 0.30 viewer
 * here is its own format check, copied from its release (test-version-0.30.ts; tools/format-since.test.mjs holds the
 * copy to the commit, and every stamp to that format's own released schema): it reads a page in a format it has, as
 * 0.30's `checkPage` does — brought up to date through its versions, then asked `formatProblem`.
 */
const EXAMPLES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages');
const read030 = (page: { fieldia?: unknown }) => Viewer030.formatProblem(upgradePage(page, { versions: Viewer030.FORMAT_VERSIONS, steps: [] }).fieldia, Viewer030.FORMAT_VERSIONS);
const page = (fields: Record<string, unknown>, more: Record<string, unknown> = {}): Page =>
  ({
    fieldia: FORMAT_VERSION,
    id: 'p',
    data: { kind: 'responses' },
    fields,
    layout: { type: 'sections', id: 'root', children: Object.keys(fields).map((name) => ({ type: 'field', id: `f-${name}`, field: name })) },
    ...more,
  }) as unknown as Page;

describe('a page stamped with the lowest format it needs', () => {
  it('using nothing new, saved now, is read by the 0.30 viewer — stamped as 0.35 stamped it, it was refused', () => {
    const plain = page({ name: { type: 'char', label: 'Name', required: true }, visits: { type: 'integer', label: 'Visits', min: 0 } });
    expect(lowestFormat(plain)).toBe('0.1');
    const saved = stampPage(plain);
    expect(saved.fieldia).toBe('0.1');
    expect(plain.fieldia).toBe(FORMAT_VERSION);
    expect(read030(saved)).toBeNull();
    // What 0.35 wrote: the newest format, whatever the page used.
    expect(read030(plain)).toBe(`this page is in format ${FORMAT_VERSION}, newer than this Fieldia reads (0.9): update Fieldia to show it`);
  });

  it('using a setting, is stamped with the format it came in — a secret 0.13, which the 0.30 viewer refuses rather than misreads', () => {
    const pin = page({ pin: { type: 'char', label: 'PIN', secret: true } });
    expect(lowestFormat(pin)).toBe('0.13');
    expect(read030(stampPage(pin))).toBe('this page is in format 0.13, newer than this Fieldia reads (0.9): update Fieldia to show it');
    expect(lowestFormat(page({ name: { type: 'char', label: 'Name' } }, { loading: { first: 'skeleton' } }))).toBe('0.12');
    expect(lowestFormat(page({ phone: { type: 'char', label: 'Phone' } }, { phone: { country: 'EG', countries: 'native' } }))).toBe('0.11');
    expect(lowestFormat(page({ day: { type: 'date', label: 'Day', precision: 'month' } }))).toBe('0.10');
    expect(lowestFormat(page({ pattern: { type: 'char', label: 'Code', pattern: '^[0-9]+$', patternHint: 'digits' } }))).toBe('0.2');
    // A value a setting takes that came later: a table of lines kept as rows on a phone (`cards: "never"`, 0.7).
    const lines = page({ items: { type: 'one2many', label: 'Items', fields: { name: { type: 'char', label: 'Name' } } } });
    expect(lowestFormat(lines)).toBe('0.1');
    ((lines.layout as unknown as { children: Record<string, unknown>[] }).children[0])['cards'] = 'never';
    expect(lowestFormat(lines)).toBe('0.7');
  });

  it('relying on a default a later format changed needs that format: its step says so (`uses`), as the train makes a changed default', () => {
    // A format whose step writes the old default into older pages: a page left to the new default needs it.
    const step = { to: '0.13', changes: 'A box shows its hint inside it', upgrade: (old: Record<string, unknown>) => old, example: { before: {}, after: {} }, uses: (given: Record<string, unknown>) => (given['fields'] as Record<string, { hint?: unknown }>)['name']?.hint === undefined };
    const plain = page({ name: { type: 'char', label: 'Name' } });
    expect(needOf(plain).index).toBe(0);
    expect(FORMAT_VERSIONS[needOf(plain, undefined, [step]).index]).toBe('0.13');
    expect(needOf(plain, undefined, [{ ...step, uses: () => false }]).index).toBe(0);
  });

  it('is never stamped past the format this Fieldia writes, and never below the first', () => {
    for (const name of readdirSync(EXAMPLES).filter((file) => file.endsWith('.page.json'))) {
      const stamped = lowestFormat(JSON.parse(readFileSync(join(EXAMPLES, name), 'utf8')));
      expect(FORMAT_VERSIONS).toContain(stamped);
    }
  });
});

describe('a page read by its stamp', () => {
  const SAID = Symbol.for('fieldia.deprecations.said');
  it('says an older format than a setting it uses came in: in 0.36 warned of by validatePage and the whole check, at the setting, with the format to write — refused from 0.37', () => {
    delete (globalThis as { [SAID]?: Set<string> })[SAID];
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const wrong = { ...page({ pin: { type: 'char', label: 'PIN', secret: true } }), fieldia: '0.10' };
    const words = 'this came in format 0.13, but the page says it is in format 0.10, which a Fieldia reading 0.10 would read without it: write "fieldia": "0.13" — lowestFormat(page) gives the lowest a page needs';
    expect(validatePage(wrong)).toMatchObject({ ok: true, warnings: [{ path: 'fields.pin.secret', message: words }] });
    expect(checkPage(wrong).ok).toBe(true);
    // Said once in the page, as a deprecation is: format.under-stamped, refused from 0.37.
    const said = `Fieldia: fields.pin.secret: ${words} — read as it is now, refused from 0.37 — deprecated, it changes in 0.37 (format.under-stamped; https://fieldia.dev/promises/#deprecations).`;
    expect(warn.mock.calls.map((call) => String(call[0]))).toEqual([said]);
    // The whole check a viewer runs after the first draw says it too, in a page not told yet; the check before the draw,
    // which reads no setting's format, says nothing.
    delete (globalThis as { [SAID]?: Set<string> })[SAID];
    warn.mockClear();
    expect(wholeCheck(wrong).ok).toBe(true);
    expect(warn.mock.calls.map((call) => String(call[0]))).toEqual([said]);
    // Stamped with what it needs, or later: nothing said.
    for (const fieldia of ['0.13', FORMAT_VERSION]) expect(validatePage({ ...wrong, fieldia }).warnings).toBeUndefined();
    expect(validatePage(stampPage(wrong)).warnings).toBeUndefined();
    warn.mockRestore();
  });

  it('every example page, stamped with the lowest format it needs, passes every check', () => {
    for (const name of readdirSync(EXAMPLES).filter((file) => file.endsWith('.page.json'))) {
      const given = JSON.parse(readFileSync(join(EXAMPLES, name), 'utf8')) as Page;
      const stamped = stampPage(given);
      expect({ name, check: checkPage(stamped).ok, whole: wholeCheck(stamped).ok, validate: validatePage(stamped).ok }).toEqual({ name, check: checkPage(given).ok, whole: wholeCheck(given).ok, validate: validatePage(given).ok });
    }
  });
});
