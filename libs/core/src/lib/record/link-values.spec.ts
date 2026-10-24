import { ownerOf } from './browser-kept';
import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { linkParams, linkValue, linkValues } from './link-values';

/**
 * A property enquiry opened from a campaign's link: who sent it (`utm_source`, `utm_campaign`), the broker's code
 * (`agent` into `agent_code`) — hidden fields, placed nowhere — and the unit asked about, shown for the person to keep.
 */
const enquiry = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.13',
  id: 'enquiry',
  data: { kind: 'responses' },
  fields: {
    name: { type: 'char', label: 'Your name', required: true },
    unit: { type: 'char', label: 'Unit' },
    bedrooms: { type: 'integer', label: 'Bedrooms', min: 1, max: 9 },
    budget: { type: 'monetary', label: 'Budget', currency: 'EGP' },
    viewing: { type: 'boolean', label: 'Book a viewing' },
    move: { type: 'date', label: 'Moving in' },
    kind: { type: 'selection', label: 'Kind', options: [{ value: 'villa', label: 'Villa' }, { value: 'flat', label: 'Flat' }] },
    utm_source: { type: 'char', label: 'Source', size: 40 },
    utm_campaign: { type: 'char', label: 'Campaign' },
    agent_code: { type: 'char', label: 'Agent', pattern: '[a-z]+' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-unit', field: 'unit' },
      { type: 'field', id: 'f-bedrooms', field: 'bedrooms' },
      { type: 'field', id: 'f-kind', field: 'kind', invisible: 'unit == "hidden"' },
    ],
  },
  prefill: { fromUrl: ['utm_source', 'utm_campaign', { param: 'agent', field: 'agent_code' }, 'unit', 'bedrooms', 'budget', 'viewing', 'move', 'kind'] },
  ...more,
});

describe('a page filled from the link it is opened with (prefill)', () => {
  it('reads a link’s parameters: the address whole or its query, the first of each, decoded', () => {
    expect(Object.fromEntries(linkParams('https://homes.example/enquiry?utm_source=whats%20app&agent=mona&agent=karim#top'))).toEqual({ utm_source: 'whats app', agent: 'mona' });
    expect(Object.fromEntries(linkParams('?unit=B-12+North&flag'))).toEqual({ unit: 'B-12 North', flag: '' });
    expect(Object.fromEntries(linkParams('unit=%E2%9C%93&bad=%E0%A4%A'))).toEqual({ unit: '✓', bad: '%E0%A4%A' });
    expect(linkParams('https://homes.example/enquiry').size).toBe(0);
    // A parameter named as an object's own key is a parameter like any.
    expect(linkParams('?__proto__=x&constructor=y').get('__proto__')).toBe('x');
    expect(Object.fromEntries(linkParams({ agent: 'mona' }))).toEqual({ agent: 'mona' });
  });

  it('reads the words as each field holds a value, and leaves out what does not read so', () => {
    const page = enquiry();
    expect(linkValue(page.fields['bedrooms'], '3')).toBe(3);
    expect(linkValue(page.fields['bedrooms'], '3 rooms')).toBeUndefined();
    expect(linkValue(page.fields['budget'], '3500000.50')).toBe(3500000.5);
    expect(linkValue(page.fields['budget'], '3.5m')).toBeUndefined();
    expect(linkValue(page.fields['viewing'], 'yes')).toBe(true);
    expect(linkValue(page.fields['viewing'], '0')).toBe(false);
    expect(linkValue(page.fields['viewing'], 'maybe')).toBeUndefined();
    expect(linkValue(page.fields['move'], '2026-11-01')).toBe('2026-11-01');
    expect(linkValue(page.fields['move'], '2026-02-30')).toBeUndefined();
    expect(linkValue(page.fields['kind'], 'villa')).toBe('villa');
    expect(linkValue(page.fields['kind'], 'Villa')).toBeUndefined();
    expect(linkValue({ type: 'datetime', label: 'At' }, '2026-11-01T09:00:00+02:00')).toBe('2026-11-01T07:00:00.000Z');
    expect(linkValue({ type: 'datetime', label: 'At' }, '2026-11-01T09:00')).toBeUndefined();
    expect(linkValue(page.fields['unit'], '   ')).toBeUndefined();
    expect(linkValue(page.fields['unit'], 'x'.repeat(501))).toBeUndefined();
  });

  it('leaves out a value the field’s own checks would refuse: a hidden field no one can put right never stops a send', () => {
    const page = enquiry();
    const values = linkValues(page, '?utm_source=' + 'w'.repeat(41) + '&agent=Mona&bedrooms=12&utm_campaign=autumn');
    expect(values).toEqual({ utm_campaign: 'autumn' });
    expect(linkValues(page, '?agent=mona&bedrooms=2')).toEqual({ agent_code: 'mona', bedrooms: 2 });
    expect(linkValues({ ...page, prefill: undefined }, '?agent=mona')).toEqual({});
    expect(linkValues(page, undefined)).toEqual({});
  });

  it('starts a response with them, over the fields’ defaults, under what the app gives', () => {
    const page = enquiry({ fields: { ...enquiry().fields, utm_source: { type: 'char', label: 'Source', default: 'web' } } });
    const form = createForm({ page, url: 'https://homes.example/enquiry?utm_source=whatsapp&agent=mona&unit=B-12&kind=flat', values: { unit: 'C-3' } });
    expect(form.getState().values).toMatchObject({ utm_source: 'whatsapp', agent_code: 'mona', unit: 'C-3', kind: 'flat' });
    // The link's values are where the form starts: nothing for the person to discard.
    expect(form.getState().dirty).toEqual([]);
    const plain = createForm({ page, url: 'https://homes.example/enquiry' });
    expect(plain.getState().values['utm_source']).toBe('web');
  });

  it('sends the hidden fields with the answers, the shown ones as the person left them', async () => {
    const ds = createMemoryDataSource();
    const form = createForm({ page: enquiry(), dataSource: ds, url: '?utm_source=whatsapp&utm_campaign=autumn&agent=mona&unit=B-12&kind=villa' });
    form.setValue('name', 'Mona Adel');
    // The person changes what the link put in a box they see: theirs is sent.
    form.setValue('unit', 'B-14');
    expect(await form.save()).toBe(true);
    expect(ds.responses[0].values).toMatchObject({ name: 'Mona Adel', unit: 'B-14', utm_source: 'whatsapp', utm_campaign: 'autumn', agent_code: 'mona', kind: 'villa' });
    // A field filled by the link but placed on the page and hidden by its condition is left out, as any hidden question.
    const hiding = createForm({ page: enquiry(), dataSource: ds, url: '?unit=hidden&kind=villa' });
    hiding.setValue('name', 'Sara');
    await hiding.save();
    expect(ds.responses[1].values).not.toHaveProperty('kind');
    expect(ds.responses[1].values).toHaveProperty('utm_source', null);
  });

  it('starts again from the link with Submit another, and never fills a stored record opened', async () => {
    const ds = createMemoryDataSource();
    const form = createForm({ page: enquiry(), dataSource: ds, url: '?utm_source=whatsapp&unit=B-12' });
    form.setValues({ name: 'Mona', unit: 'B-14' });
    await form.save();
    form.reset();
    expect(form.getState().values).toMatchObject({ name: null, unit: 'B-12', utm_source: 'whatsapp' });

    const records = createMemoryDataSource({ records: { lead: { 7: { name: 'Karim', source: 'walk-in' } } } });
    const lead: Page = { fieldia: '0.13', id: 'lead', data: { kind: 'record', model: 'lead' }, fields: { name: { type: 'char', label: 'Name' }, source: { type: 'char', label: 'Source' } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }] }, prefill: { fromUrl: [{ param: 'utm_source', field: 'source' }] } };
    const opened = createForm({ page: lead, dataSource: records, recordId: 7, url: '?utm_source=whatsapp' });
    await opened.load();
    expect(opened.getState().values['source']).toBe('walk-in');
    // A new record keeps the link's, and its first save sends it.
    const made = createForm({ page: lead, dataSource: records, url: '?utm_source=whatsapp' });
    made.setValue('name', 'Hana');
    await made.save();
    expect(records.records['lead'][String(made.getState().recordId)]).toMatchObject({ name: 'Hana', source: 'whatsapp' });
  });

  it('keeps what the person typed: a draft laid over the link’s values wins', () => {
    const store = new Map<string, string>();
    const drafts = { store: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key) }, restore: 'auto' as const };
    store.set(`fieldia:draft:${ownerOf(null)}:enquiry:new`, JSON.stringify({ values: { unit: 'D-1', name: 'Mona' }, savedAt: '2026-10-20T10:00:00Z' }));
    const form = createForm({ page: enquiry(), drafts, url: '?unit=B-12&utm_source=whatsapp' });
    expect(form.getState().values).toMatchObject({ unit: 'D-1', name: 'Mona', utm_source: 'whatsapp' });
  });

  it('refuses a page that names a field it has not, one it cannot fill, or one twice', () => {
    const page = enquiry({
      fields: { ...enquiry().fields, agent: { type: 'many2one', label: 'Agent', relation: 'res.users' }, total: { type: 'integer', label: 'Total', compute: 'bedrooms * 2' }, city: { type: 'selection', label: 'City', options: [], optionsFrom: { list: 'cities' } } },
      prefill: { fromUrl: ['utm_source', 'utm_source', 'agent', 'total', 'city', 'nowhere', { param: 'u', field: 'unit' }, { param: 'unit2', field: 'unit' }] },
    });
    const checked = checkPage(page);
    const issues = checked.ok ? [] : checked.issues.map((issue) => `${issue.path}: ${issue.message}`);
    expect(issues).toEqual([
      'prefill.fromUrl[1]: "utm_source" is filled by two of the link\'s parameters: name it once',
      'prefill.fromUrl[2]: "agent" is a many2one: a link\'s words fill a line of text, a number, a yes or no, a choice or a day — keep them in a text field (an agent\'s code), and let your app link the record',
      'prefill.fromUrl[3]: "total" is worked out from other fields: a link cannot fill it',
      'prefill.fromUrl[4]: "city" takes its options from elsewhere: a link fills a choice of the page\'s own options',
      'prefill.fromUrl[5]: no field "nowhere" for the link\'s "nowhere" to fill: add it to the page\'s fields (placed nowhere, it is a hidden field, sent with the answers)',
      'prefill.fromUrl[7]: "unit" is filled by two of the link\'s parameters: name it once',
    ]);
    expect(validatePage({ ...enquiry(), prefill: { fromUrl: [] } }).ok).toBe(false);
    expect(validatePage({ ...enquiry(), prefill: { fromUrl: [{ param: 'a b', field: 'unit' }] } }).ok).toBe(false);
    expect(validatePage(enquiry()).ok).toBe(true);
  });
});
