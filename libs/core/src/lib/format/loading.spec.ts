import { checkPage } from './check-page';
import { LOADING_DEFAULTS, LOADING_TECHNIQUES } from './loading';
import { pageJsonSchema, validatePage } from '../../index';

/**
 * How a page looks while it waits (`loading`): on the page, a list, a related list, a map and a field's options, its
 * techniques each moment's own, its looks and its timing — checked where pages are made; a page that says none is
 * read as before, and the one-tag script's check never carries the shape.
 */

const FIELDS = {
  name: { type: 'char', label: 'Name' },
  partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' },
  lat: { type: 'float', label: 'Latitude' },
  lng: { type: 'float', label: 'Longitude' },
};
const record = (extra: Record<string, unknown> = {}, node: Record<string, unknown> = { type: 'field', id: 'n', field: 'name' }) => ({
  fieldia: '0.10',
  id: 'loading',
  data: { kind: 'record', model: 'customer' },
  fields: FIELDS,
  layout: { type: 'sections', id: 's', children: [node] },
  ...extra,
});
const list = (loading: unknown) => ({ fieldia: '0.10', id: 'customers', data: { kind: 'record', model: 'customer' }, fields: FIELDS, layout: { type: 'list', id: 'l', columns: ['name'], loading } });
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a page’s loading, in the format', () => {
  it('takes each moment’s techniques, the looks and the timing, on the page and on its parts', () => {
    expect(problems(record({ loading: { first: 'spinner', refresh: 'dim', more: 'skeleton', search: 'none', action: 'overlay', skeleton: 'pulse', spinner: 'dots', progress: 'inline', delay: 0, minShown: 500, slowAfter: 3000, timeout: 20000, error: 'toast' } }))).toEqual([]);
    expect(problems(record({ loading: {} }))).toEqual([]);
    expect(problems(list({ first: 'custom', refresh: 'skeleton', more: 'spinner' }))).toEqual([]);
    expect(problems(record({}, { type: 'field', id: 'n', field: 'partner_id', options: { loading: { search: 'spinner' } } }))).toEqual([]);
    expect(problems(record({}, { type: 'related', id: 'r', model: 'invoice', field: 'partner_id', fields: { name: { type: 'char', label: 'Name' } }, columns: ['name'], loading: { first: 'text', more: 'none' } }))).toEqual([]);
    expect(problems(record({}, { type: 'map', id: 'm', layers: [{ id: 'here', latitude: 'lat', longitude: 'lng' }], loading: { first: 'progress' } }))).toEqual([]);
  });

  it('refuses a technique of another moment, a look it does not have and a time out of reach, where it is', () => {
    expect(problems(record({ loading: { first: 'keep' } }))[0]).toMatch(/^loading\.first: /);
    expect(problems(record({ loading: { refresh: 'row' } }))[0]).toMatch(/^loading\.refresh: /);
    expect(problems(record({ loading: { spinner: 'bars' } }))[0]).toMatch(/^loading\.spinner: /);
    expect(problems(record({ loading: { delay: -1 } }))[0]).toMatch(/^loading\.delay: /);
    expect(problems(record({ loading: { delay: 20000 } }))[0]).toMatch(/^loading\.delay: /);
    expect(problems(record({ loading: { glow: true } }))).toHaveLength(1);
    expect(problems(list({ more: 'inline' }))[0]).toMatch(/^layout\.loading\.more: /);
    expect(problems(record({}, { type: 'field', id: 'n', field: 'partner_id', options: { loading: { search: 'skeleton' } } }))[0]).toMatch(/options\.loading\.search: /);
  });

  it('says a timeout that ends the wait before a loader could show, and "Still loading…" said after it', () => {
    expect(problems(record({ loading: { timeout: 100 } }))).toEqual([expect.stringMatching(/^loading\.timeout: a timeout ends the wait as failed: make it longer than the delay before a loader shows \(150 ms\)/)]);
    expect(problems(record({ loading: { delay: 0, timeout: 100 } }))).toEqual([]);
    expect(problems(record({ loading: { timeout: 4000 } }))).toEqual([]);
    expect(problems(record({ loading: { timeout: 4000, slowAfter: 4000 } }))).toEqual([expect.stringMatching(/^loading\.slowAfter: "Still loading…" is said before the wait ends/)]);
  });

  it('is left to the format’s schemas: the check a page gets as it is shown reads past it', () => {
    expect(checkPage(record({ loading: { first: 'spinner' } })).ok).toBe(true);
  });

  it('has a default for every moment, the first of its techniques', () => {
    for (const [moment, ways] of Object.entries(LOADING_TECHNIQUES)) expect(LOADING_DEFAULTS[moment as keyof typeof LOADING_TECHNIQUES]).toBe(ways[0]);
  });

  it('is in the JSON Schema, on the page and its list, related list and map', () => {
    const schema = JSON.stringify(pageJsonSchema());
    expect(schema).toContain('"PageLoading"');
    expect((schema.match(/"\$ref":"#\/\$defs\/PageLoading"/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
