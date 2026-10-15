import { createMemoryDataSource, type Locale, type Page } from '@fieldia/core';
import { memoryPreferences } from '@fieldia/widgets';
import { until } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A list's search bar and its filter bar read what is typed as every box does
 * (FIELDIA INPUT RULES, 8): a work item's number in Arabic or Persian digits,
 * a German grouping point, never hex; a phone by its digits, however spaced.
 */

const items: Page = {
  fieldia: '0.1',
  id: 'backlog',
  title: 'Backlog',
  data: { kind: 'record', model: 'work.item' },
  fields: {
    number: { type: 'integer', label: 'ID' },
    title: { type: 'char', label: 'Title' },
    state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }] },
  },
  layout: { type: 'list', id: 'list', columns: ['number', 'title', 'state'], sort: [{ field: 'number' }], search: 'fields', searchFields: ['title', 'number'], filterFields: ['state'] },
};
const people: Page = {
  fieldia: '0.1',
  id: 'customers',
  title: 'Customers',
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' }, phone: { type: 'char', label: 'Phone' } },
  layout: { type: 'list', id: 'list', columns: ['name', 'phone'], sort: [{ field: 'name' }], cells: { phone: { widget: 'phone' } } },
};
const source = () =>
  createMemoryDataSource({
    records: {
      'work.item': {
        1: { number: 4172, title: 'Sales reps can see the jobs of other reps', state: 'active' },
        2: { number: 4108, title: 'Cancel stage loses the download', state: 'new' },
        3: { number: 31, title: 'Check the scanner log', state: 'new' },
      },
      partner: {
        1: { name: 'Delta Foods', phone: '+20 40 333 4400' },
        2: { name: 'Giza Plaza', phone: '+20 2 3572 5500' },
      },
    },
  });

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(page: Page, locale: Locale = 'en') {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: source(), preferences: memoryPreferences(), locale });
  await until(() => host.querySelector('.fd-list-row'));
  return host;
}
const cells = (host: Element, column: number) => [...host.querySelectorAll('.fd-list-row')].map((row) => row.querySelectorAll('td')[column]?.textContent?.trim());

describe('the filter bar’s keyword', () => {
  for (const [locale, typed] of [
    ['en', '٤١٧٢'],
    ['ar', '۴۱۷۲'],
    ['de', '4.172'],
    ['en', '4,172'],
  ] as const) {
    it(`${locale}: "${typed}" finds item 4172`, async () => {
      const host = await mount(items, locale);
      const input = host.querySelector('.fd-filter-bar input') as HTMLInputElement;
      input.value = typed;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await until(() => host.querySelectorAll('.fd-list-row').length === 1);
      expect(cells(host, 2)).toEqual(['Sales reps can see the jobs of other reps']);
    });
  }

  it('never reads hex as a number', async () => {
    const host = await mount(items);
    const input = host.querySelector('.fd-filter-bar input') as HTMLInputElement;
    input.value = '0x104C';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await until(() => host.querySelectorAll('.fd-list-row').length === 0);
    expect(host.querySelectorAll('.fd-list-row')).toHaveLength(0);
  });
});

describe('the search bar on a phone column', () => {
  for (const typed of ['3334400', '٤٤٠٠', '+٢٠ ٤٠ ٣٣٣ ٤٤٠٠']) {
    it(`finds "+20 40 333 4400" from "${typed}"`, async () => {
      const host = await mount(people);
      const input = host.querySelector('.fd-search-input') as HTMLInputElement;
      input.value = typed;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const phone = [...host.querySelectorAll('.fd-search-suggestions [role=option]')].find((option) => option.textContent?.startsWith('Search Phone')) as HTMLElement;
      expect(phone.textContent).toBe(`Search Phone for: ${typed}`);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await until(() => host.querySelectorAll('.fd-list-row').length === 1);
      expect(cells(host, 1)).toEqual(['Delta Foods']);
    });
  }
});
