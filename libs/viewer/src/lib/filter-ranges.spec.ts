import { createMemoryDataSource, validatePage, type Page, type Values } from '@fieldia/core';
import { memoryPreferences, type PreferenceStore } from '@fieldia/widgets';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * Filters a buyer and a sales team expect (w4-filters): a count beside each value of a filter bar's lists, among the
 * rest of the search; a number's or a date's range as one chip — From and To, a press for each least value ("2+");
 * a phone's sheet of every field with "Show 3 homes"; and in the search bar's menu, a named filter's and a favourite's
 * count ("Late 2"). A page that asks for none of it is drawn as before.
 */

const homesPage: Page = {
  fieldia: '0.10',
  id: 'homes',
  title: 'Homes',
  records: { one: 'home', other: 'homes', a: 'a home' },
  data: { kind: 'record', model: 'home' },
  fields: {
    name: { type: 'char', label: 'Home' },
    kind: { type: 'selection', label: 'Type', options: [{ value: 'flat', label: 'Flat' }, { value: 'villa', label: 'Villa' }] },
    amenities: { type: 'many2many', label: 'Amenities', relation: 'amenity' },
    price: { type: 'monetary', label: 'Price', currency: 'EGP', digits: [12, 0] },
    bedrooms: { type: 'integer', label: 'Bedrooms' },
    area_m2: { type: 'integer', label: 'Area, m²' },
    listed_on: { type: 'date', label: 'Listed on' },
  },
  layout: {
    type: 'list',
    id: 'homes',
    columns: ['name', 'kind', 'price', 'bedrooms'],
    sort: [{ field: 'price' }],
    search: 'fields',
    searchFields: ['name'],
    filterFields: ['kind', 'amenities', 'price', 'bedrooms', 'area_m2', 'listed_on'],
    filterRanges: { bedrooms: { atLeast: [1, 2, 3, 4] }, area_m2: {} },
    filterLabels: { area_m2: 'Area' },
    filterCounts: true,
    filterSheet: true,
  },
};

const homes = (): Record<string, Values> => ({
  1: { name: 'Flat in Dokki', kind: 'flat', amenities: [{ id: 2, label: 'Pool' }], price: 900_000, bedrooms: 1, area_m2: 70, listed_on: '2026-09-02' },
  2: { name: 'Flat in Maadi', kind: 'flat', amenities: [], price: 1_800_000, bedrooms: 2, area_m2: 110, listed_on: '2026-09-20' },
  3: { name: 'Flat in Zamalek', kind: 'flat', amenities: [{ id: 1, label: 'Garden' }], price: 2_600_000, bedrooms: 3, area_m2: 150, listed_on: '2026-10-05' },
  4: { name: 'Villa in New Cairo', kind: 'villa', amenities: [{ id: 1, label: 'Garden' }, { id: 2, label: 'Pool' }], price: 9_500_000, bedrooms: 5, area_m2: 420, listed_on: '2026-10-12' },
  5: { name: 'Villa in Sheikh Zayed', kind: 'villa', amenities: [{ id: 1, label: 'Garden' }], price: 7_200_000, bedrooms: 4, area_m2: 360, listed_on: '2026-10-15' },
});
const source = () => createMemoryDataSource({ records: { home: homes(), amenity: { 1: { name: 'Garden' }, 2: { name: 'Pool' } } } });

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}, page: Page = homesPage) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: source(), ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr.fd-list-row'));
  return host;
}
const rows = (host: Element) => [...host.querySelectorAll<HTMLTableRowElement>('.fd-list-table tbody tr.fd-list-row')];
const names = (host: Element) => rows(host).map((tr) => tr.querySelector('td bdi')?.textContent);
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
const bar = (host: Element) => host.querySelector('.fd-filter-bar') as HTMLElement;
const pick = (host: Element, field: string) => bar(host).querySelector(`.fd-filter-pick[data-field="${field}"]`) as HTMLButtonElement;
const menuOf = (button: HTMLButtonElement) => document.getElementById(button.getAttribute('aria-controls') as string) as HTMLElement;
const options = (menu: HTMLElement) => [...menu.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')];
/** An option as it shows: its words and its count. */
const shownOption = (option: HTMLElement) => `${option.querySelector('.fd-filter-option-text')?.textContent} ${option.querySelector('.fd-filter-count')?.textContent ?? '-'}`;
/** Text typed into a box and the box left, as a person does. */
const type = (input: HTMLInputElement, text: string) => {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};
const kept = (values: Record<string, unknown>): PreferenceStore => {
  const store = memoryPreferences();
  for (const [name, value] of Object.entries(values)) store.set(name, value as never);
  return store;
};

describe('a count beside each value', () => {
  it('says how many records each value finds, among the rest of the search, and in words to a screen reader', async () => {
    const host = await mount();
    const kind = pick(host, 'kind');
    kind.click();
    await until(() => options(menuOf(kind)).some((o) => o.querySelector('.fd-filter-count')));
    expect(options(menuOf(kind)).map(shownOption)).toEqual(['Flat 3', 'Villa 2']);
    expect(options(menuOf(kind))[0].getAttribute('aria-label')).toBe('Flat, 3 homes');
    expect(options(menuOf(kind))[0].querySelector('.fd-filter-count')?.getAttribute('aria-hidden')).toBe('true');
    // Villas: the amenities count among them; a value none of them holds says 0, still to tick.
    options(menuOf(kind))[1].click();
    await until(() => rows(host).length === 2);
    const amenities = pick(host, 'amenities');
    amenities.click();
    await until(() => options(menuOf(amenities)).some((o) => o.querySelector('.fd-filter-count')));
    expect(options(menuOf(amenities)).map(shownOption)).toEqual(['Garden 2', 'Pool 1']);
    // Its own ticks never change a field's counts: Flat still says how many flats there are among the rest.
    kind.click();
    await until(() => options(menuOf(kind)).some((o) => o.querySelector('.fd-filter-count')));
    expect(options(menuOf(kind)).map(shownOption)).toEqual(['Flat 3', 'Villa 2']);
  });

  it('counts by the keyword and a range too, and says 0 for a value nothing left holds', async () => {
    const host = await mount();
    const bedrooms = pick(host, 'bedrooms');
    bedrooms.click();
    const press = [...menuOf(bedrooms).querySelectorAll<HTMLButtonElement>('.fd-filter-range-press')].find((b) => b.textContent === '4+') as HTMLButtonElement;
    press.click();
    await until(() => rows(host).length === 2);
    const kind = pick(host, 'kind');
    kind.click();
    await until(() => options(menuOf(kind)).some((o) => o.querySelector('.fd-filter-count')));
    expect(options(menuOf(kind)).map(shownOption)).toEqual(['Flat 0', 'Villa 2']);
  });

  it('counts nothing where the page does not ask, nor where the source cannot group', async () => {
    const plain = { ...homesPage, layout: { ...homesPage.layout, filterCounts: undefined } } as Page;
    const ds = source();
    const host = await mount({ dataSource: ds }, plain);
    const kind = pick(host, 'kind');
    kind.click();
    await until(() => options(menuOf(kind)).length);
    expect(options(menuOf(kind)).map(shownOption)).toEqual(['Flat -', 'Villa -']);
    expect(ds.calls.filter((call) => call.method === 'groups')).toEqual([]);
    handle?.destroy();
    document.body.replaceChildren();
    // A source without groups: the values, and no count.
    const { groups: _groups, ...rest } = source();
    const host2 = await mount({ dataSource: rest });
    const kind2 = pick(host2, 'kind');
    kind2.click();
    await until(() => options(menuOf(kind2)).length);
    expect(options(menuOf(kind2)).map(shownOption)).toEqual(['Flat -', 'Villa -']);
  });
});

describe('a range, one chip', () => {
  it('takes From and To as the page writes numbers, its button saying it whole, the list kept to it', async () => {
    const host = await mount();
    const price = pick(host, 'price');
    expect(price.textContent).toBe('Price');
    expect(price.getAttribute('aria-haspopup')).toBe('dialog');
    price.click();
    const menu = menuOf(price);
    expect(menu.getAttribute('role')).toBe('dialog');
    expect(menu.getAttribute('aria-label')).toBe('Filter by Price');
    const [from, to] = [...menu.querySelectorAll<HTMLInputElement>('input')];
    expect(document.activeElement).toBe(from);
    expect([from.getAttribute('aria-label'), to.getAttribute('aria-label')]).toEqual(['Price: From', 'Price: To']);
    type(from, '1,000,000');
    await until(() => rows(host).length === 4);
    expect(price.textContent).toBe('Price: E£\u00a01,000,000+');
    to.focus();
    to.value = '3000000';
    key(to, 'Enter');
    await until(() => rows(host).length === 2);
    expect(names(host)).toEqual(['Flat in Maadi', 'Flat in Zamalek']);
    expect(price.textContent).toBe('Price: E£\u00a01,000,000 – E£\u00a03,000,000');
    expect(price.hasAttribute('data-picked')).toBe(true);
    // Escape closes it, the focus back on its button.
    key(to, 'Escape');
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(price);
    // × clears it with the rest.
    (bar(host).querySelector('.fd-filter-clear') as HTMLButtonElement).click();
    await until(() => rows(host).length === 5);
    expect(price.textContent).toBe('Price');
    expect(from.value).toBe('');
  });

  it('refuses From past To and text that is no number, keeping it as typed and saying why', async () => {
    const host = await mount();
    const area = pick(host, 'area_m2');
    expect(area.textContent).toBe('Area');
    area.click();
    const [from, to] = [...menuOf(area).querySelectorAll<HTMLInputElement>('input')];
    type(from, '300');
    await until(() => rows(host).length === 2);
    type(to, '100');
    const hint = () => menuOf(area).querySelector('.fd-refusal-hint:not([hidden])')?.textContent;
    await until(() => hint());
    expect(hint()).toBe('From is more than To');
    expect(to.value).toBe('100');
    expect(rows(host).length).toBe(2);
    type(to, '12.5');
    await until(() => hint() !== 'From is more than To');
    expect(hint()).toMatch(/whole number/i);
    expect(to.value).toBe('12.5');
    type(to, '400');
    await until(() => rows(host).length === 1);
    expect(area.textContent).toBe('Area: 300 – 400');
  });

  it('offers a press for each least value, Any taking it away', async () => {
    const host = await mount();
    const bedrooms = pick(host, 'bedrooms');
    bedrooms.click();
    const menu = menuOf(bedrooms);
    const presses = [...menu.querySelectorAll<HTMLButtonElement>('.fd-filter-range-press')];
    expect(presses.map((b) => b.textContent)).toEqual(['Any', '1+', '2+', '3+', '4+']);
    expect(document.activeElement).toBe(presses[0]);
    expect(presses[0].getAttribute('aria-pressed')).toBe('true');
    presses[2].click();
    await until(() => rows(host).length === 4);
    expect(bedrooms.textContent).toBe('Bedrooms: 2+');
    expect(presses.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'false', 'false']);
    expect((menu.querySelector('input') as HTMLInputElement).value).toBe('2');
    presses[0].click();
    await until(() => rows(host).length === 5);
    expect(bedrooms.textContent).toBe('Bedrooms');
  });

  it('takes a date’s days in the page’s order: from one, until one, between', async () => {
    const host = await mount();
    const listed = pick(host, 'listed_on');
    listed.click();
    const [from, to] = [...menuOf(listed).querySelectorAll<HTMLInputElement>('input')];
    expect(from.placeholder).not.toBe('');
    type(from, '1/10/2026');
    await until(() => rows(host).length === 3);
    expect(listed.textContent).toBe('Listed on: from 1 Oct 2026');
    type(to, '12/10/2026');
    await until(() => rows(host).length === 2);
    expect(listed.textContent).toBe('Listed on: 1 Oct 2026 – 12 Oct 2026');
    type(from, '');
    await until(() => rows(host).length === 4);
    expect(listed.textContent).toBe('Listed on: until 12 Oct 2026');
    type(to, '31/02/2026');
    const hint = () => menuOf(listed).querySelector('.fd-refusal-hint:not([hidden])')?.textContent;
    await until(() => hint());
    expect(hint()).toMatch(/February/);
  });

  it('starts with a range a kept search holds, read back into its boxes', async () => {
    const preferences = kept({
      'favourites:homes': [{ name: 'Mid price', isDefault: true, facets: [{ kind: 'field', field: 'price', label: 'Price', values: [{ op: 'between', value: [1_000_000, 3_000_000], label: 'E£\u00a01,000,000 – E£\u00a03,000,000' }] }] }],
    });
    const host = await mount({ preferences });
    await until(() => rows(host).length === 2);
    const price = pick(host, 'price');
    expect(price.textContent).toBe('Price: E£\u00a01,000,000 – E£\u00a03,000,000');
    const [from, to] = [...menuOf(price).querySelectorAll<HTMLInputElement>('input')];
    expect([from.value, to.value]).toEqual(['1,000,000', '3,000,000']);
  });
});

describe('the sheet on a phone', () => {
  const sheet = () => document.querySelector('.fd-filter-sheet') as HTMLElement | null;
  const field = (name: string) => sheet()?.querySelector(`.fd-filter-sheet-field[data-field="${name}"]`) as HTMLElement;
  const show = () => sheet()?.querySelector('.fd-filter-sheet-show') as HTMLButtonElement;

  it('shows every field at once, counted as they change, and takes them together with Show', async () => {
    const host = await mount();
    const open = bar(host).querySelector('.fd-filter-sheet-open') as HTMLButtonElement;
    expect(open.textContent).toBe('Filters');
    expect(open.getAttribute('aria-haspopup')).toBe('dialog');
    open.click();
    await until(() => sheet() && show().textContent === 'Show 5 homes');
    expect(sheet()?.getAttribute('role')).toBe('dialog');
    expect(sheet()?.getAttribute('aria-modal')).toBe('true');
    expect([...(sheet() as HTMLElement).querySelectorAll('legend')].map((l) => l.textContent)).toEqual(['Type', 'Amenities', 'Price', 'Bedrooms', 'Area', 'Listed on']);
    await until(() => field('kind').querySelector('.fd-filter-count'));
    const ticks = (name: string) => [...field(name).querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    const said = (name: string) => [...field(name).querySelectorAll('label')].map((l) => `${l.querySelector('.fd-filter-option-text')?.textContent} ${l.querySelector('.fd-filter-count')?.textContent}`);
    expect(said('kind')).toEqual(['Flat 3', 'Villa 2']);
    // A tick counts again what Show shows and the other fields' values, and the list stays as it was.
    ticks('kind')[0].click();
    await until(() => show().textContent === 'Show 3 homes');
    await until(() => said('amenities').join() === 'Garden 1,Pool 1');
    expect(rows(host).length).toBe(5);
    // A press of a range, then a box typed and Show pressed straight away: the box is read first.
    const press = [...field('bedrooms').querySelectorAll<HTMLButtonElement>('.fd-filter-range-press')].find((b) => b.textContent === '2+') as HTMLButtonElement;
    press.click();
    await until(() => show().textContent === 'Show 2 homes');
    const [from] = [...field('price').querySelectorAll<HTMLInputElement>('input')];
    from.value = '2,000,000';
    show().click();
    expect(sheet()).toBeNull();
    await until(() => rows(host).length === 1);
    expect(names(host)).toEqual(['Flat in Zamalek']);
    expect(document.activeElement).toBe(open);
    expect(open.querySelector('.fd-filter-badge')?.textContent).toBe('3');
    expect(open.getAttribute('aria-label')).toBe('Filters, 3 on');
    // The desktop's buttons say the same.
    expect(pick(host, 'price').textContent).toBe('Price: E£\u00a02,000,000+');
    expect(pick(host, 'kind').textContent).toBe('Type: Flat');
  });

  it('lets what was changed go with × or Escape, and Clear all empties it, still to be shown', async () => {
    const host = await mount();
    const open = bar(host).querySelector('.fd-filter-sheet-open') as HTMLButtonElement;
    open.click();
    await until(() => sheet() && field('kind').querySelector('input'));
    (field('kind').querySelector('input') as HTMLInputElement).click();
    await until(() => show().textContent === 'Show 3 homes');
    (sheet()?.querySelector('.fd-dialog-close') as HTMLButtonElement).click();
    expect(sheet()).toBeNull();
    expect(rows(host).length).toBe(5);
    expect(open.querySelector('.fd-filter-badge')?.hasAttribute('hidden')).toBe(true);
    // Once shown, Clear all in the sheet empties it; Show takes the empty sheet.
    open.click();
    await until(() => sheet() && field('kind').querySelector('input'));
    (field('kind').querySelector('input') as HTMLInputElement).click();
    await until(() => show().textContent === 'Show 3 homes');
    show().click();
    await until(() => rows(host).length === 3);
    open.click();
    await until(() => sheet() && field('kind').querySelector('input')?.checked);
    (sheet()?.querySelector('.fd-filter-sheet-clear') as HTMLButtonElement).click();
    await until(() => show().textContent === 'Show 5 homes');
    expect(rows(host).length).toBe(3);
    key(sheet() as HTMLElement, 'Escape');
    expect(sheet()).toBeNull();
    expect(rows(host).length).toBe(3);
  });

  it('keeps the sheet open where a box holds text that is no number, saying why', async () => {
    const host = await mount();
    (bar(host).querySelector('.fd-filter-sheet-open') as HTMLButtonElement).click();
    await until(() => sheet());
    const [, to] = [...field('area_m2').querySelectorAll<HTMLInputElement>('input')];
    to.value = '1.5';
    show().click();
    expect(sheet()).not.toBeNull();
    expect(document.activeElement).toBe(to);
    expect(field('area_m2').querySelector('.fd-refusal-hint:not([hidden])')?.textContent).toMatch(/whole number/i);
    expect(to.value).toBe('1.5');
    expect(rows(host).length).toBe(5);
  });

  it('says no number where the source cannot count, and is drawn only where the page asks', async () => {
    const { totals: _totals, list, ...rest } = source();
    const host = await mount({ dataSource: { ...rest, list } });
    (bar(host).querySelector('.fd-filter-sheet-open') as HTMLButtonElement).click();
    // Its list's total counts, where it has no totals.
    await until(() => sheet() && show().textContent === 'Show 5 homes');
    handle?.destroy();
    document.body.replaceChildren();
    const host2 = await mount({}, { ...homesPage, layout: { ...homesPage.layout, filterSheet: undefined } } as Page);
    expect(bar(host2).querySelector('.fd-filter-sheet-open')).toBeNull();
    expect(bar(host2).hasAttribute('data-sheet')).toBe(false);
  });
});

describe('the search bar’s named filters and favourites', () => {
  const leads: Page = {
    fieldia: '0.10',
    id: 'leads',
    title: 'Leads',
    records: { one: 'lead', other: 'leads', a: 'a lead' },
    data: { kind: 'record', model: 'lead' },
    fields: {
      name: { type: 'char', label: 'Lead' },
      stage: { type: 'selection', label: 'Stage', options: [{ value: 'new', label: 'New' }, { value: 'won', label: 'Won' }] },
      next_on: { type: 'date', label: 'Next follow-up' },
      value: { type: 'monetary', label: 'Value', currency: 'EGP' },
    },
    layout: {
      type: 'list',
      id: 'leads',
      columns: ['name', 'stage', 'next_on', 'value'],
      filters: [
        { id: 'late', label: 'Late', period: { field: 'next_on', is: 'overdue' } },
        { id: 'today', label: 'Today', period: { field: 'next_on', is: 'today' } },
        { id: 'new', label: 'New', filter: [{ field: 'stage', op: '=', value: 'new' }] },
      ],
      filterCounts: true,
    },
  };
  const now = () => new Date('2026-10-19T09:00:00Z');
  const leadSource = () =>
    createMemoryDataSource({
      records: {
        lead: {
          1: { name: 'Nile Traders', stage: 'new', next_on: '2026-10-12', value: 50_000 },
          2: { name: 'Delta Foods', stage: 'won', next_on: '2026-10-18', value: 120_000 },
          3: { name: 'Giza Plaza', stage: 'new', next_on: '2026-10-19', value: 80_000 },
          4: { name: 'Amira Clinics', stage: 'new', next_on: '2026-10-25', value: 30_000 },
        },
      },
    });
  const option = (host: Element, id: string) => host.querySelector(`.fd-search-option[data-filter="${id}"]`) as HTMLButtonElement;
  const counted = (button: HTMLElement) => `${button.firstChild?.textContent} ${button.querySelector('.fd-filter-count')?.textContent ?? '-'}`;

  it('says how many each finds as the menu opens — "Late 2" — among the rest of the search, and a favourite’s', async () => {
    const preferences = kept({ 'favourites:leads': [{ name: 'Big ones', facets: [{ kind: 'custom', label: 'Value greater than 60,000', filter: [{ field: 'value', op: '>', value: 60_000 }] }] }] });
    const host = await mount({ dataSource: leadSource(), now, preferences }, leads);
    (host.querySelector('.fd-search-toggle') as HTMLButtonElement).click();
    await until(() => option(host, 'late').querySelector('.fd-filter-count') && host.querySelector('.fd-favourite .fd-filter-count'));
    expect(['late', 'today', 'new'].map((id) => counted(option(host, id)))).toEqual(['Late 2', 'Today 1', 'New 3']);
    expect(option(host, 'late').getAttribute('aria-label')).toBe('Late, 2 leads');
    expect(counted(host.querySelector('.fd-favourite .fd-search-option') as HTMLElement)).toBe('Big ones 2');
    // A named filter on: the others still count as if each were on alone, among the rest.
    option(host, 'new').click();
    await until(() => rows(host).length === 3);
    expect(['late', 'today', 'new'].map((id) => counted(option(host, id)))).toEqual(['Late 2', 'Today 1', 'New 3']);
    // A search typed narrows them all.
    const input = host.querySelector('.fd-search-input') as HTMLInputElement;
    input.value = 'Giza';
    input.dispatchEvent(new Event('input'));
    key(input, 'Enter');
    await until(() => counted(option(host, 'late')) === 'Late 0');
    expect(['late', 'today', 'new'].map((id) => counted(option(host, id)))).toEqual(['Late 0', 'Today 1', 'New 1']);
  });

  it('counts nothing where the page does not ask', async () => {
    const ds = leadSource();
    const host = await mount({ dataSource: ds, now }, { ...leads, layout: { ...leads.layout, filterCounts: undefined } } as Page);
    (host.querySelector('.fd-search-toggle') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(host.querySelector('.fd-search-option .fd-filter-count')).toBeNull();
    expect(ds.calls.filter((call) => call.method === 'totals')).toEqual([]);
  });

  it('takes a custom filter of a number between two as one chip', async () => {
    const host = await mount({ dataSource: leadSource(), now }, leads);
    (host.querySelector('.fd-search-toggle') as HTMLButtonElement).click();
    (host.querySelector('.fd-search-add') as HTMLButtonElement).click();
    const form = host.querySelector('.fd-custom-filter') as HTMLElement;
    const [field, condition] = [...form.querySelectorAll('select')];
    field.value = 'value';
    field.dispatchEvent(new Event('change'));
    expect([...condition.options].map((o) => o.textContent)).toContain('is between');
    condition.value = 'between';
    condition.dispatchEvent(new Event('change'));
    const [from, to] = [...form.querySelectorAll<HTMLInputElement>('.fd-custom-filter-value input')];
    from.value = '40,000';
    to.value = '100000';
    (form.querySelector('.fd-button-primary') as HTMLButtonElement).click();
    await until(() => rows(host).length === 2);
    expect([...host.querySelectorAll('.fd-facet-text')].map((chip) => chip.textContent)).toEqual(['Value: E£\u00a040,000.00 – E£\u00a0100,000.00']);
  });
});

describe('filters beside choices that change: carried, from the app’s list, a table’s lines', () => {
  /** Leads, each with the treatments it asked about, the one it came back for carried from them, and its branch from the app's list. */
  const leadsPage: Page = {
    fieldia: '0.10',
    id: 'leads',
    title: 'Leads',
    records: { one: 'lead', other: 'leads' },
    data: { kind: 'record', model: 'lead' },
    fields: {
      name: { type: 'char', label: 'Lead' },
      asked: { type: 'selection', label: 'Asked about', multiple: true, options: [{ value: 'botox', label: 'Botox' }, { value: 'peel', label: 'Peel' }] },
      again: { type: 'selection', label: 'Came back for', options: [{ value: 'none', label: 'Nothing' }], optionsFrom: { field: 'asked' } },
      branch: { type: 'selection', label: 'Branch', options: [], optionsFrom: { list: 'branches' } },
      visits: { type: 'one2many', label: 'Visits', relation: 'lead.visit', fields: { room: { type: 'selection', label: 'Room', options: [], optionsFrom: { list: 'rooms', dependsOn: ['parent.branch'] } } } },
    },
    layout: { type: 'list', id: 'leads', columns: ['name', 'again', 'branch'], search: 'fields', searchFields: ['name'], filterFields: ['again', 'branch'], filterCounts: true },
  };
  const leads = () =>
    createMemoryDataSource({
      records: {
        lead: {
          1: { name: 'Mona', asked: ['botox'], again: 'botox', branch: 'zamalek' },
          2: { name: 'Hana', asked: ['peel'], again: 'peel', branch: 'zamalek' },
          3: { name: 'Sara', asked: ['botox'], again: 'botox', branch: 'maadi' },
        },
      },
    });

  it('lists a carried choice by every option it may hold and a listed one by its records’ values, each counted in the records’ words', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: leadsPage, dataSource: leads() });
    await until(() => host.querySelector('.fd-list-table tbody tr.fd-list-row'));
    const again = pick(host, 'again');
    again.click();
    await until(() => options(menuOf(again)).some((o) => o.querySelector('.fd-filter-count')));
    expect(options(menuOf(again)).map(shownOption)).toEqual(['Botox 2', 'Peel 1', 'Nothing 0']);
    expect(options(menuOf(again))[0].getAttribute('aria-label')).toBe('Botox, 2 leads');
    const branch = pick(host, 'branch');
    branch.click();
    await until(() => options(menuOf(branch)).some((o) => o.querySelector('.fd-filter-count')));
    expect(options(menuOf(branch)).map(shownOption)).toEqual(['maadi 1', 'zamalek 2']);
    options(menuOf(branch))[1].click();
    await until(() => rows(host).length === 2);
  });

  it('takes no table’s line as a filter: a line’s choice is the line’s own', () => {
    const lines = { ...leadsPage, layout: { ...leadsPage.layout, filterFields: ['visits'] } } as Page;
    const result = validatePage(lines);
    expect(result.ok ? [] : result.issues.map((issue) => issue.path)).toEqual(['layout.filterFields[0]']);
  });
});
