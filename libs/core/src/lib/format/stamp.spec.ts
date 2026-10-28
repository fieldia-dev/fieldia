import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lowestFormat, needOf, stampPage, stampProblem } from './stamp';
import { checkPage } from './check-page';
import { wholeCheck } from './check-whole';
import { validatePage } from './validate';
import { upgradePage } from './upgrade';
import { FORMAT_VERSION, FORMAT_VERSIONS } from './version';
import * as Viewer030 from './test-version-0.30';
import * as Viewer036 from './test-version-0.36';
import type { Page } from './page';

/**
 * A page stamped with the lowest format its settings need (the audit's R-M7), and read by its stamp. The 0.30 viewer
 * here is its own format check, copied from its release (test-version-0.30.ts; tools/format-since.test.mjs holds the
 * copy to the commit, and every stamp to that format's own released schema): it reads a page in a format it has, as
 * 0.30's `checkPage` does — brought up to date through its versions, then asked `formatProblem`.
 */
const EXAMPLES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages');
const read030 = (page: { fieldia?: unknown }) => Viewer030.formatProblem(upgradePage(page, { versions: Viewer030.FORMAT_VERSIONS, steps: [] }).fieldia, Viewer030.FORMAT_VERSIONS);
/** The 0.36 viewer's format check, the last that reads format 0.13 (test-version-0.36.ts, held to its release). */
const read036 = (page: { fieldia?: unknown }) => Viewer036.formatProblem(upgradePage(page, { versions: Viewer036.FORMAT_VERSIONS, steps: [] }).fieldia, Viewer036.FORMAT_VERSIONS);
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

  it('saying what a copy does not keep, or a filter’s group, is stamped 0.14, which the 0.36 viewer refuses with its words — and a page saying neither stays as 0.36 read it', () => {
    const bill = page({ state: { type: 'selection', label: 'Status', default: 'draft', options: [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }] } }, { data: { kind: 'record', model: 'account.move' } });
    expect(lowestFormat(bill)).toBe('0.1');
    expect(read036(stampPage(bill))).toBeNull();
    const fields = bill.fields as unknown as Record<string, Record<string, unknown>>;
    fields['state']['copy'] = false;
    expect(lowestFormat(bill)).toBe('0.14');
    expect(read036(stampPage(bill))).toBe('this page is in format 0.14, newer than this Fieldia reads (0.13): update Fieldia to show it');
    // Said true, as a copy keeps it anyway: the same key, the same format.
    fields['state']['copy'] = true;
    expect(lowestFormat(bill)).toBe('0.14');
    // A table's line field says it too.
    const lines = page({ items: { type: 'one2many', label: 'Items', relation: 'line', fields: { name: { type: 'char', label: 'Name' }, lot: { type: 'char', label: 'Lot', copy: false } } } });
    expect(lowestFormat(lines)).toBe('0.14');
    const filters = [
      { id: 'late', label: 'Late', filter: [{ field: 'state', op: '=', value: 'posted' }] },
      { id: 'draft', label: 'Draft', filter: [{ field: 'state', op: '=', value: 'draft' }] },
    ];
    const list = { fieldia: FORMAT_VERSION, id: 'bills', data: { kind: 'record', model: 'account.move' }, fields: { state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }] } }, layout: { type: 'list', id: 'l', columns: ['state'], filters } } as unknown as Page;
    expect(lowestFormat(list)).toBe('0.1');
    const grouped = { ...list, layout: { ...list.layout, filters: [{ ...filters[0], group: 'when' }, filters[1]] } } as unknown as Page;
    expect(lowestFormat(grouped)).toBe('0.14');
    expect(read036(stampPage(grouped))).toBe('this page is in format 0.14, newer than this Fieldia reads (0.13): update Fieldia to show it');
    // Said 0.13, it is under-stamped: warned of now, refused from 0.37 (format.under-stamped, lane p37-refuse).
    expect(stampProblem({ ...grouped, fieldia: '0.13' }, needOf(upgradePage(grouped)))).toMatchObject({ path: 'layout.filters[0].group' });
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
  it('says an older format than a setting it uses came in: refused by validatePage and the whole check, at the setting, with the format to write (0.37; warned of in 0.36)', () => {
    delete (globalThis as { [SAID]?: Set<string> })[SAID];
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const wrong = { ...page({ pin: { type: 'char', label: 'PIN', secret: true } }), fieldia: '0.10' };
    const words = 'this came in format 0.13, but the page says it is in format 0.10, which a Fieldia reading 0.10 would read without it: write "fieldia": "0.13" — lowestFormat(page) gives the lowest a page needs';
    const refused = { ok: false, issues: [{ path: 'fields.pin.secret', message: words }] };
    expect(validatePage(wrong)).toEqual(refused);
    // The whole check every viewer runs as soon as a page is drawn refuses it the same; the check before the draw, which
    // reads no setting's format, passes it.
    expect(wholeCheck(wrong)).toEqual(refused);
    expect(checkPage(wrong).ok).toBe(true);
    // Refused, never warned of: format.under-stamped is changed (0.37).
    expect(warn).not.toHaveBeenCalled();
    // Stamped with what it needs, or later: passed, nothing said.
    for (const fieldia of ['0.13', FORMAT_VERSION]) expect(validatePage({ ...wrong, fieldia })).toMatchObject({ ok: true });
    expect(validatePage(stampPage(wrong))).toMatchObject({ ok: true });
    expect(wholeCheck(stampPage(wrong)).ok).toBe(true);
    // What the names and conditions find is said first: the stamp's, where they find nothing.
    const broken = { ...wrong, layout: { ...wrong.layout, children: [{ type: 'field', id: 'f-pin', field: 'pins' }] } };
    expect(validatePage(broken)).toMatchObject({ ok: false, issues: [{ path: 'layout.children[0].field' }] });
    expect(wholeCheck(broken)).toMatchObject({ ok: false, issues: [{ path: 'layout.children[0].field' }] });
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
