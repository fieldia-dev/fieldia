import { checkPage, FORMAT_VERSION, FORMAT_VERSIONS, PAGE_UPGRADES, upgradePage, validatePage, type Page, type PageJson, type PageUpgrade } from '../../index';
import { compareFormats, formatProblem } from './version';

/**
 * A page says which format it is written in (`fieldia`). One written in an older format is brought up to date step by
 * step as it is read; one newer than this Fieldia is refused with words that say so, instead of a key it cannot place.
 */

const page = (more: Record<string, unknown> = {}): PageJson => ({
  fieldia: FORMAT_VERSION,
  id: 'p',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'name' }] },
  ...more,
});

/**
 * A made-up history, for the steps' order: format 0.7 called a field's label `caption`; 0.8 put the page's skin under
 * `look`; 0.9 added nothing a page must change for.
 */
const HISTORY = {
  versions: ['0.7', '0.8', '0.9'],
  steps: [
    {
      to: '0.8',
      changes: "A field's caption is its label.",
      upgrade: (old: PageJson) => {
        const fields = old['fields'] as Record<string, Record<string, unknown>>;
        for (const field of Object.values(fields)) {
          if ('caption' in field) {
            field['label'] = field['caption'];
            delete field['caption'];
          }
        }
        return old;
      },
      example: { before: {}, after: {} },
    },
    {
      to: '0.9',
      changes: 'The skin is part of the look.',
      upgrade: ({ skin, ...rest }: PageJson) => (skin === undefined ? rest : { ...rest, look: { ...(rest['look'] as object), skin } }),
      example: { before: {}, after: {} },
    },
  ] satisfies PageUpgrade[],
};

describe('upgradePage', () => {
  it('hands back a page in the current format as it is: the same object', () => {
    const current = page();
    expect(upgradePage(current)).toBe(current);
  });

  it('brings a page up step by step, from its own format on, and never changes the page given', () => {
    const old = { ...page(), fieldia: '0.7', skin: 'quiet', fields: { name: { type: 'char', caption: 'Name' } } };
    const before = JSON.stringify(old);
    const upgraded = upgradePage(old, HISTORY) as PageJson;
    expect(upgraded).toEqual({ ...page(), fieldia: '0.9', look: { skin: 'quiet' }, fields: { name: { type: 'char', label: 'Name' } } });
    expect(JSON.stringify(old)).toBe(before);
    // Its format still comes first, as a reader looks for it.
    expect(Object.keys(upgraded)[0]).toBe('fieldia');
  });

  it("takes only the steps after the page's own format", () => {
    const fromMiddle = { ...page(), fieldia: '0.8', skin: 'quiet', fields: { name: { type: 'char', caption: 'kept' } } };
    // 0.8 already had labels: a key called caption is left alone (the reference check will name it).
    expect(upgradePage(fromMiddle, HISTORY)).toMatchObject({ fieldia: '0.9', look: { skin: 'quiet' }, fields: { name: { caption: 'kept' } } });
  });

  it('hands back a page newer than this Fieldia, or of no known format, as it is: the checks say why', () => {
    for (const version of ['0.10', '1.0', '0.6', 'one', undefined]) {
      const odd = { ...page(), fieldia: version };
      expect(upgradePage(odd, HISTORY)).toBe(odd);
    }
    expect(upgradePage(null)).toBeNull();
    expect(upgradePage('a page')).toBe('a page');
  });
});

describe('the format in the checks', () => {
  it('a page newer than this Fieldia: checkPage and validatePage say to update Fieldia', () => {
    const newer = { ...page(), fieldia: '0.9' };
    const said = `this page is in format 0.9, newer than this Fieldia reads (${FORMAT_VERSION}): update Fieldia to show it`;
    expect(checkPage(newer)).toEqual({ ok: false, issues: [{ path: 'fieldia', message: said }] });
    const validated = validatePage(newer);
    expect(validated.ok).toBe(false);
    expect(!validated.ok && validated.issues).toContainEqual({ path: 'fieldia', message: said });
  });

  it('a page that names no format, or none Fieldia has had, is told which this Fieldia reads', () => {
    expect(checkPage({ ...page(), fieldia: undefined })).toMatchObject({ ok: false, issues: [{ path: 'fieldia', message: `"fieldia" says which format the page is written in: "${FORMAT_VERSION}" for this Fieldia` }] });
    expect(formatProblem('0.0')).toBe(`format 0.0 is not one Fieldia has had: this Fieldia reads ${FORMAT_VERSION}`);
  });

  it('an older format Fieldia has had is named with the way up, where a page is checked as it stands', () => {
    expect(formatProblem('0.7', HISTORY.versions)).toBe('this page is in format 0.7: upgradePage(page) brings it to 0.9');
    expect(formatProblem('0.9', HISTORY.versions)).toBeNull();
  });

  it('a current page passes as before, handed back equal', () => {
    const current = page() as unknown as Page;
    expect(checkPage(current)).toEqual({ ok: true, page: current });
    expect(validatePage(current)).toEqual({ ok: true, page: current });
  });

  it('versions compare as numbers: 0.10 is after 0.9', () => {
    expect(compareFormats('0.10', '0.9')).toBeGreaterThan(0);
    expect(compareFormats('1.0', '0.21')).toBeGreaterThan(0);
    expect(compareFormats('0.1', '0.1')).toBe(0);
    expect(compareFormats('0.1', 'x')).toBeNull();
  });
});

describe('a page from 0.20 or 0.21 (format 0.1)', () => {
  it('is read as it is, its version moved on and its own fields, layout and options the very objects given', () => {
    const fields = { name: { type: 'char', label: 'Name', size: 20 } };
    const layout = { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'name' }] };
    const given = { fieldia: '0.1', id: 'old', data: { kind: 'responses' }, fields, layout };
    const read = upgradePage(given);
    expect(read).not.toBe(given);
    expect(given.fieldia).toBe('0.1');
    expect(read.fieldia).toBe(FORMAT_VERSION);
    expect(read.fields).toBe(fields);
    expect(read.layout).toBe(layout);
    expect(validatePage(given)).toMatchObject({ ok: true });
  });
});

describe('a page from 0.22 or 0.23 (format 0.2)', () => {
  it('is read as it is, 0.3, 0.4, 0.5, 0.6, 0.7 and 0.8 having only added: its version moved on, its own objects kept', () => {
    const fields = { when: { type: 'datetime', label: 'When' } };
    const layout = { type: 'sections', id: 'root', children: [{ type: 'field', id: 'w', field: 'when' }] };
    const given = { fieldia: '0.2', id: 'kept', data: { kind: 'responses' }, fields, layout };
    const read = upgradePage(given);
    expect(given.fieldia).toBe('0.2');
    expect(read).toMatchObject({ fieldia: '0.8' });
    expect(read.fields).toBe(fields);
    expect(read.layout).toBe(layout);
    expect(validatePage(given)).toMatchObject({ ok: true });
  });
});

describe('a page from 0.24 (format 0.3)', () => {
  it('is read as it is, 0.4, 0.5, 0.6, 0.7 and 0.8 having only added: its version moved on, its own objects kept', () => {
    const fields = { when: { type: 'datetime', label: 'When', timeZone: 'Africa/Cairo' } };
    const layout = { type: 'list', id: 'root', columns: ['when'], export: true, bulkEdit: true };
    const given = { fieldia: '0.3', id: 'kept', data: { kind: 'record', model: 'm' }, fields, layout };
    const read = upgradePage(given);
    expect(given.fieldia).toBe('0.3');
    expect(read).toMatchObject({ fieldia: '0.8' });
    expect(read.fields).toBe(fields);
    expect(read.layout).toBe(layout);
    expect(validatePage(given)).toMatchObject({ ok: true });
  });
});

describe('a page from 0.25 (format 0.4)', () => {
  it('is read as it is, 0.5, 0.6, 0.7 and 0.8 having only added: its version moved on, its own objects kept', () => {
    const fields = { name: { type: 'char', label: 'Name' }, phone: { type: 'char', label: 'Phone' } };
    const layout = { type: 'list', id: 'root', columns: ['name', 'phone'], card: { title: 'name', fields: ['phone'] }, optionalColumns: { phone: 'show' }, rowBold: 'phone', print: true };
    const given = { fieldia: '0.4', id: 'kept', data: { kind: 'record', model: 'm' }, fields, layout };
    const read = upgradePage(given);
    expect(given.fieldia).toBe('0.4');
    expect(read).toMatchObject({ fieldia: '0.8' });
    expect(read.fields).toBe(fields);
    expect(read.layout).toBe(layout);
    expect(validatePage(given)).toMatchObject({ ok: true });
  });
});

describe('a page from 0.26 (format 0.5)', () => {
  it('is read as it is, 0.6, 0.7 and 0.8 having only added: its version moved on, its own objects kept', () => {
    const fields = { city: { type: 'selection', label: 'City', options: [], optionsFrom: { list: 'cities', dependsOn: ['country'] } }, country: { type: 'char', label: 'Country' } };
    const layout = { type: 'sections', id: 'root', children: [{ type: 'field', id: 'c', field: 'country' }, { type: 'field', id: 'y', field: 'city' }] };
    const given = { fieldia: '0.5', id: 'kept', records: { one: 'customer', other: 'customers' }, data: { kind: 'record', model: 'm' }, fields, layout };
    const read = upgradePage(given);
    expect(given.fieldia).toBe('0.5');
    expect(read).toMatchObject({ fieldia: '0.8' });
    expect(read.fields).toBe(fields);
    expect(read.layout).toBe(layout);
    expect(validatePage(given)).toMatchObject({ ok: true });
  });
});

describe('a page from 0.27 (format 0.6)', () => {
  it('is read as it is, 0.7 and 0.8 having only added: its version moved on, its own objects kept', () => {
    const fields = { name: { type: 'char', label: 'Name' }, lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { what: { type: 'char', label: 'What' } } } };
    const layout = { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'name' }, { type: 'field', id: 'l', field: 'lines', cards: 'narrow' }] };
    const endings = [{ title: 'Thank you, {name}' }];
    const given = { fieldia: '0.6', id: 'kept', data: { kind: 'responses' }, endings, fields, layout };
    const read = upgradePage(given);
    expect(given.fieldia).toBe('0.6');
    expect(read).toMatchObject({ fieldia: '0.8' });
    expect(read.fields).toBe(fields);
    expect(read.layout).toBe(layout);
    expect(validatePage(given)).toMatchObject({ ok: true });
  });
});

describe('a page from 0.28 (format 0.7)', () => {
  it('is read as it is, 0.8 having only added: its version moved on, its own objects kept', () => {
    const fields = { name: { type: 'char', label: 'Name' }, lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { what: { type: 'char', label: 'What' } } } };
    const layout = { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'name' }, { type: 'field', id: 'l', field: 'lines', cards: 'never' }] };
    const given = { fieldia: '0.7', id: 'kept', data: { kind: 'record', model: 'm' }, fields, layout };
    const read = upgradePage(given);
    expect(given.fieldia).toBe('0.7');
    expect(read).toMatchObject({ fieldia: '0.8' });
    expect(read.fields).toBe(fields);
    expect(read.layout).toBe(layout);
    expect(validatePage(given)).toMatchObject({ ok: true });
  });
});

describe("the format's history", () => {
  it('runs from the first format to this one, newest last', () => {
    expect(FORMAT_VERSIONS[0]).toBe('0.1');
    expect(FORMAT_VERSIONS[FORMAT_VERSIONS.length - 1]).toBe(FORMAT_VERSION);
    for (let i = 1; i < FORMAT_VERSIONS.length; i++) expect(compareFormats(FORMAT_VERSIONS[i], FORMAT_VERSIONS[i - 1])).toBeGreaterThan(0);
  });

  it('has at most one step to each format after the first, in order, and none to a format it does not list', () => {
    const reached = PAGE_UPGRADES.map((step) => step.to);
    expect(new Set(reached).size).toBe(reached.length);
    for (const to of reached) expect(FORMAT_VERSIONS.slice(1)).toContain(to);
    expect([...reached].sort((a, b) => compareFormats(a, b) ?? 0)).toEqual(reached);
  });

  // Every step comes with a page before it and after it, checked here: none goes untested.
  it('each step turns its example into what it says, and says what changed', () => {
    for (const step of PAGE_UPGRADES) {
      const before = JSON.parse(JSON.stringify(step.example.before));
      expect({ to: step.to, page: step.upgrade(before) }).toEqual({ to: step.to, page: step.example.after });
      expect(step.changes.trim()).not.toBe('');
    }
  });

  it("an example of the newest step, brought up, is a page this Fieldia validates", () => {
    const last = PAGE_UPGRADES[PAGE_UPGRADES.length - 1];
    if (!last) return expect(PAGE_UPGRADES).toHaveLength(0);
    const before = { ...last.example.before, fieldia: FORMAT_VERSIONS[FORMAT_VERSIONS.length - 2] };
    expect(validatePage(upgradePage(before))).toMatchObject({ ok: true });
  });
});
