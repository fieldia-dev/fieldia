import Ajv2020 from 'ajv/dist/2020';
import { checkPage, createForm, createMemoryDataSource, pageJsonSchema, validatePage, type DataSource, type Option, type Page, type Values } from '../../index';

/**
 * Choices from the app's own lists: a selection whose options the data source
 * gives, loaded when the form shows it and again when a field they change
 * with changes — a city list that follows the country chosen.
 */

const COUNTRIES: Option[] = [
  { value: 'eg', label: 'Egypt' },
  { value: 'jo', label: 'Jordan' },
];
const CITIES: Record<string, Option[]> = {
  eg: [
    { value: 'cai', label: 'Cairo' },
    { value: 'alx', label: 'Alexandria' },
  ],
  jo: [{ value: 'amm', label: 'Amman' }],
};

function page(fields: Record<string, unknown> = {}): Page {
  return {
    fieldia: '0.1',
    id: 'lists',
    data: { kind: 'record', model: 'site' },
    fields: {
      country: { type: 'selection', label: 'Country', options: [], optionsFrom: { list: 'countries' } },
      city: { type: 'selection', label: 'City', options: [], optionsFrom: { list: 'cities', dependsOn: ['country'] } },
      ...fields,
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'c', field: 'country' },
        { type: 'field', id: 'y', field: 'city' },
      ],
    },
  } as Page;
}

const problems = (input: unknown) => {
  const result = validatePage(input);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
};

/** A data source whose list requests wait until the test lets each one answer. */
function lists() {
  const asked: { list: string; values: Values; answer(options: Option[]): void; fail(message: string): void }[] = [];
  const source: DataSource = {
    options: (request) =>
      new Promise<Option[]>((resolve, reject) => {
        asked.push({ ...request, answer: resolve, fail: (message) => reject(new Error(message)) });
      }),
  };
  return { source, asked };
}

describe('choices from the app’s lists, in the format', () => {
  it('takes a list by name, with the fields its choices change with, in place of written options', () => {
    expect(problems(page())).toEqual([]);
    expect(checkPage(page()).ok).toBe(true);
  });

  it('still asks for written options when the choices are not from a list', () => {
    expect(problems(page({ size: { type: 'selection', label: 'Size', options: [] } }))).toEqual(['fields.size.options: a choice needs its options, or a list of the app’s to take them from']);
  });

  it('refuses a list with no name, and a field to change with that the page does not have', () => {
    expect(problems(page({ town: { type: 'selection', label: 'Town', options: [], optionsFrom: { list: '' } } }))).toEqual([expect.stringMatching(/^fields\.town\.optionsFrom\.list: /)]);
    const bad = page({ town: { type: 'selection', label: 'Town', options: [], optionsFrom: { list: 'towns', dependsOn: ['country', 'region'] } } });
    expect(problems(bad)).toEqual(['fields.town.optionsFrom.dependsOn[1]: no field "region"']);
    expect(checkPage(bad).ok).toBe(false);
  });

  it('keeps lists to the page’s own fields: a table’s lines cannot load choices', () => {
    const lines = page({
      lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { kind: { type: 'selection', label: 'Kind', options: [], optionsFrom: { list: 'kinds' } } } },
    });
    expect(problems(lines)).toEqual([
      'fields.lines.fields.kind.options: Too small: expected array to have >=1 items',
      'fields.lines.fields.kind.optionsFrom: choices from the app’s lists are for the page’s own fields, not a table’s lines',
    ]);
  });

  it('is in the JSON Schema, with the same rule for written options', () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(pageJsonSchema());
    expect(validate(page())).toBe(true);
    expect(validate(page({ size: { type: 'selection', label: 'Size', options: [] } }))).toBe(false);
    expect(validate(page({ size: { type: 'selection', label: 'Size', options: [], optionsFrom: { list: 'sizes', colour: 1 } } }))).toBe(false);
  });
});

describe('choices from the app’s lists, in a form', () => {
  it('loads a field’s choices when asked, saying it is loading until they come', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source });
    expect(form.getState().choices).toEqual({});
    form.loadChoices('country');
    expect(form.getState().choices['country']).toEqual({ options: null, loading: true });
    expect(asked.map((a) => a.list)).toEqual(['countries']);
    asked[0].answer(COUNTRIES);
    await form.settled();
    expect(form.getState().choices['country']).toEqual({ options: COUNTRIES });
  });

  it('loads again when a field the choices change with changes, with the values as they are then', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source });
    form.loadChoices('city');
    asked[0].answer([]);
    await form.settled();
    form.setValue('country', 'eg');
    expect(asked.map((a) => [a.list, a.values['country']])).toEqual([
      ['cities', null],
      ['cities', 'eg'],
    ]);
    expect(form.getState().choices['city'].loading).toBe(true);
    // The choices shown until then stay, so the list does not flash empty.
    expect(form.getState().choices['city'].options).toEqual([]);
    asked[1].answer(CITIES['eg']);
    await form.settled();
    expect(form.getState().choices['city'].options).toEqual(CITIES['eg']);
    // Another field changing loads nothing.
    form.setValue('city', 'cai');
    expect(asked).toHaveLength(2);
  });

  it('keeps only the latest answer when they come back out of order', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source });
    form.loadChoices('city');
    form.setValue('country', 'eg');
    form.setValue('country', 'jo');
    asked[2].answer(CITIES['jo']);
    asked[1].answer(CITIES['eg']);
    asked[0].answer([]);
    await form.settled();
    expect(form.getState().choices['city']).toEqual({ options: CITIES['jo'] });
    // Nor does a late failure undo it.
    form.setValue('country', 'eg');
    form.setValue('country', 'jo');
    asked[4].answer(CITIES['jo']);
    asked[3].fail('too late');
    await form.settled();
    expect(form.getState().choices['city']).toEqual({ options: CITIES['jo'] });
  });

  it('says why the choices did not load, and loads them again when asked', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source });
    form.loadChoices('country');
    asked[0].fail('The server is away');
    await form.settled();
    expect(form.getState().choices['country']).toEqual({ options: null, error: 'The server is away' });
    form.loadChoices('country');
    asked[1].answer(COUNTRIES);
    await form.settled();
    expect(form.getState().choices['country']).toEqual({ options: COUNTRIES });
  });

  it('keeps the choices it had when loading them again fails', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source });
    form.loadChoices('city');
    asked[0].answer(CITIES['eg']);
    await form.settled();
    form.setValue('country', 'jo');
    asked[1].fail('The server is away');
    await form.settled();
    expect(form.getState().choices['city']).toEqual({ options: CITIES['eg'], error: 'The server is away' });
  });

  it('loads again when any one of the fields it changes with changes', async () => {
    const { source, asked } = lists();
    const form = createForm({
      page: page({ region: { type: 'char', label: 'Region' }, town: { type: 'selection', label: 'Town', options: [], optionsFrom: { list: 'towns', dependsOn: ['country', 'region'] } } }),
      dataSource: source,
    });
    form.loadChoices('town');
    form.setValue('region', 'north');
    expect(asked.map((a) => [a.list, a.values['region']])).toEqual([
      ['towns', null],
      ['towns', 'north'],
    ]);
  });

  it('says so when the data source has no lists', async () => {
    const form = createForm({ page: page(), dataSource: {} });
    form.loadChoices('country');
    await form.settled();
    expect(form.getState().choices['country']).toEqual({ options: null, error: 'No list "countries"' });
    expect(() => form.loadChoices('nope')).toThrow();
    expect(form.getState().choices['nope']).toBeUndefined();
  });

  it('accepts a choice the list gave, and once it has loaded, only those', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source });
    // Not loaded yet: nothing to say a choice is not one of them.
    form.setValue('country', 'eg');
    expect(form.problem('country')).toBeNull();
    form.loadChoices('country');
    asked[0].answer(COUNTRIES);
    await form.settled();
    expect(form.problem('country')).toBeNull();
    expect(form.validate()).toBe(true);
    form.setValue('country', 'fr');
    expect(form.problem('country')).toBe('Must be one of: Egypt, Jordan');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['country']).toBe('Must be one of: Egypt, Jordan');
  });

  it('keeps a value the list no longer offers: the person decides', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source, values: { country: 'eg', city: 'cai' } });
    form.loadChoices('city');
    asked[0].answer(CITIES['eg']);
    await form.settled();
    form.setValue('country', 'jo');
    asked[1].answer(CITIES['jo']);
    await form.settled();
    expect(form.getState().values['city']).toBe('cai');
    expect(form.problem('city')).toBe('Must be one of: Amman');
  });

  it('come from a memory data source too, by the list’s name', async () => {
    const source = createMemoryDataSource({ lists: { countries: COUNTRIES, cities: async (values) => CITIES[values['country'] as string] ?? [] } });
    expect(await source.options({ list: 'countries', values: {} })).toEqual(COUNTRIES);
    expect(await source.options({ list: 'cities', values: { country: 'jo' } })).toEqual(CITIES['jo']);
    await expect(source.options({ list: 'towns', values: {} })).rejects.toThrow('No list "towns"');
    const form = createForm({ page: page(), dataSource: source, values: { country: 'eg' } });
    form.loadChoices('city');
    await form.settled();
    expect(form.getState().choices['city'].options).toEqual(CITIES['eg']);
  });

  it('loads again when a record comes in with another value to follow', async () => {
    const { source, asked } = lists();
    source.load = async () => ({ country: 'jo', city: 'amm' });
    const form = createForm({ page: page(), dataSource: source, recordId: 7 });
    form.loadChoices('city');
    await form.load();
    expect(asked.map((a) => a.values['country'])).toEqual([null, 'jo']);
  });
});
