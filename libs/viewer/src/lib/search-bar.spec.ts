import type { ListNode, Page } from '@fieldia/core';
import { memoryPreferences, type PreferenceStore } from '@fieldia/widgets';
import { customers, partners, until } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';

let handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles) handle.destroy();
  handles = [];
  document.body.replaceChildren();
});

async function mount(preferences: PreferenceStore = memoryPreferences(), page: Page = customers) {
  const host = document.createElement('div');
  document.body.append(host);
  handles.push(mountViewer(host, { page, dataSource: partners(), preferences }));
  await until(() => host.querySelector('.fd-list-row'));
  return host;
}
/** The customers' filters in two groups: a status, and a country. */
const grouped = {
  ...customers,
  layout: {
    ...customers.layout,
    filters: [
      { id: 'active', label: 'Active', filter: [{ field: 'state', op: '=', value: 'active' }], group: 'state' },
      { id: 'egypt', label: 'Egypt', filter: [{ field: 'country_id', op: '=', value: 1 }], group: 'country' },
      { id: 'blocked', label: 'Blocked', filter: [{ field: 'state', op: '=', value: 'blocked' }], group: 'state' },
      { id: 'jordan', label: 'Jordan', filter: [{ field: 'country_id', op: '=', value: 2 }], group: 'country' },
    ],
  },
} as Page;
const input = (host: Element) => host.querySelector('.fd-search-input') as HTMLInputElement;
const names = (host: Element) => [...host.querySelectorAll('.fd-list-row')].map((row) => row.querySelectorAll('td')[1].textContent);
const chips = (host: Element) => [...host.querySelectorAll('.fd-facet .fd-facet-text')].map((chip) => chip.textContent);
const options = (host: Element) => [...host.querySelectorAll('.fd-search-suggestions [role=option]')];
const total = (host: Element) => host.querySelector('.fd-pager-text')?.textContent;
const button = (root: Element, name: string) =>
  [...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name && !b.closest('[hidden]')) as HTMLButtonElement;
function type(host: Element, text: string) {
  input(host).value = text;
  input(host).dispatchEvent(new Event('input', { bubbles: true }));
}
function press(host: Element, key: string) {
  input(host).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}
async function shows(host: Element, expected: string[]) {
  await until(() => JSON.stringify(names(host)) === JSON.stringify(expected));
  expect(names(host)).toEqual(expected);
}

describe('the search bar', () => {
  it('offers the ways to search what is typed, and takes the one chosen with the keys', async () => {
    const host = await mount();
    type(host, 'egy');
    expect(options(host).map((o) => o.textContent)).toEqual(['Search Name for: egy', 'Search Country for: egy']);
    expect(options(host)[0].getAttribute('aria-selected')).toBe('true');
    press(host, 'ArrowDown');
    expect(options(host)[1].getAttribute('aria-selected')).toBe('true');
    expect(input(host).getAttribute('aria-activedescendant')).toBe(options(host)[1].id);
    press(host, 'Enter');
    expect(chips(host)).toEqual(['Country: egy']);
    expect(input(host).value).toBe('');
    expect((host.querySelector('.fd-search-suggestions') as HTMLElement).hidden).toBe(true);
    await shows(host, ['Amira Clinics', 'Nile Traders']);
    // The same two rows were first before the search too: its answer's count waited for.
    await until(() => total(host) === '1–2 / 2');
    expect(total(host)).toBe('1–2 / 2');
    // Escape, or leaving the box, puts the suggestions away.
    type(host, 'egy');
    press(host, 'Escape');
    expect((host.querySelector('.fd-search-suggestions') as HTMLElement).hidden).toBe(true);
    type(host, 'egy');
    input(host).dispatchEvent(new FocusEvent('blur'));
    expect((host.querySelector('.fd-search-suggestions') as HTMLElement).hidden).toBe(true);
  });

  it('puts values searched in one field in one chip, any of them, and Backspace takes the last chip away', async () => {
    const host = await mount();
    type(host, 'nile');
    press(host, 'Enter');
    await shows(host, ['Nile Traders']);
    type(host, 'amira');
    press(host, 'Enter');
    expect(chips(host)).toEqual(['Name: nile or amira']);
    await shows(host, ['Amira Clinics', 'Nile Traders']);
    type(host, 'nile');
    press(host, 'Enter');
    expect(chips(host)).toEqual(['Name: nile or amira']);
    type(host, 'act');
    press(host, 'ArrowDown');
    press(host, 'Enter');
    expect(chips(host)).toEqual(['Name: nile or amira', 'Status: Active']);
    await shows(host, ['Nile Traders']);
    type(host, '');
    press(host, 'Backspace');
    expect(chips(host)).toEqual(['Name: nile or amira']);
    await shows(host, ['Amira Clinics', 'Nile Traders']);
    button(host, 'Remove Name: nile or amira').click();
    expect(chips(host)).toEqual([]);
    await until(() => total(host) === '1–2 / 4');
    expect(total(host)).toBe('1–2 / 4');
  });

  it('turns the list’s filters on and off from the menu, any of them, and groups by fields in the order chosen', async () => {
    const host = await mount();
    const toggle = button(host, 'Search options');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const panel = host.querySelector('.fd-search-panel') as HTMLElement;
    expect(panel.hidden).toBe(false);
    button(panel, 'Active').click();
    expect(button(panel, 'Active').getAttribute('aria-pressed')).toBe('true');
    expect(chips(host)).toEqual(['Active']);
    await shows(host, ['Nile Traders', 'Petra Tours']);
    button(panel, 'Blocked').click();
    expect(chips(host)).toEqual(['Active or Blocked']);
    await until(() => total(host) === '1–2 / 3');
    button(panel, 'Active').click();
    expect(chips(host)).toEqual(['Blocked']);
    await shows(host, ['Zamalek Studio']);
    button(panel, 'Status').click();
    button(panel, 'Country').click();
    expect(chips(host)).toEqual(['Blocked', 'Status > Country']);
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
    // A press anywhere else closes it too.
    toggle.click();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(panel.hidden).toBe(true);
  });

  it('keeps filters of a group apart from another’s: a line between them in the menu, a chip each whose × takes its group off, and every group holding', async () => {
    const host = await mount(memoryPreferences(), grouped);
    button(host, 'Search options').click();
    const panel = host.querySelector('.fd-search-panel') as HTMLElement;
    // The menu: each group's filters together, in the order the groups first come, a separator between them.
    const menu = panel.querySelector('[data-group-kind="filters"]') as HTMLElement;
    expect([...menu.querySelectorAll('.fd-search-option[data-filter], [role="separator"]')].map((part) => (part.getAttribute('role') === 'separator' ? '—' : part.textContent))).toEqual(['Active', 'Blocked', '—', 'Egypt', 'Jordan']);
    button(panel, 'Active').click();
    button(panel, 'Egypt').click();
    // Active, and in Egypt.
    expect(chips(host)).toEqual(['Active', 'Egypt']);
    await shows(host, ['Nile Traders']);
    button(panel, 'Blocked').click();
    button(panel, 'Jordan').click();
    expect(chips(host)).toEqual(['Active or Blocked', 'Egypt or Jordan']);
    await shows(host, ['Nile Traders', 'Petra Tours']);
    // A chip's × takes its own group's filters off, and the menu says so.
    button(host, 'Remove Egypt or Jordan').click();
    expect(chips(host)).toEqual(['Active or Blocked']);
    // The focus in the box, the menu gave way: opened again, it says so.
    button(host, 'Search options').click();
    expect(button(panel, 'Egypt').getAttribute('aria-pressed')).toBe('false');
    expect(button(panel, 'Active').getAttribute('aria-pressed')).toBe('true');
    await until(() => total(host) === '1–2 / 3');
    // Backspace takes the last chip away: the last group.
    button(panel, 'Egypt').click();
    expect(chips(host)).toEqual(['Active or Blocked', 'Egypt']);
    type(host, '');
    press(host, 'Backspace');
    expect(chips(host)).toEqual(['Active or Blocked']);
    // The same filters naming no group: one chip, any of them, as before.
    const plain = await mount(memoryPreferences(), { ...grouped, layout: { ...grouped.layout, filters: (grouped.layout as ListNode).filters!.map(({ group: _, ...filter }) => filter) } } as Page);
    button(plain, 'Search options').click();
    const panelPlain = plain.querySelector('.fd-search-panel') as HTMLElement;
    expect(panelPlain.querySelectorAll('[role="separator"]')).toHaveLength(0);
    button(panelPlain, 'Active').click();
    button(panelPlain, 'Egypt').click();
    expect(chips(plain)).toEqual(['Active or Egypt']);
    await shows(plain, ['Amira Clinics', 'Nile Traders']);
  });

  it('counts each filter as if it alone of its group were on, the other groups’ kept', async () => {
    const host = await mount(memoryPreferences(), { ...grouped, layout: { ...grouped.layout, filterCounts: true } } as Page);
    button(host, 'Search options').click();
    const panel = host.querySelector('.fd-search-panel') as HTMLElement;
    const counts = () => ['Active', 'Blocked', 'Egypt', 'Jordan'].map((name) => `${name} ${panel.querySelector(`[data-filter="${name.toLowerCase()}"] .fd-filter-count`)?.textContent ?? '-'}`);
    await until(() => counts().every((said) => !said.endsWith('-')));
    expect(counts()).toEqual(['Active 2', 'Blocked 1', 'Egypt 2', 'Jordan 1']);
    panel.querySelector<HTMLButtonElement>('[data-filter="active"]')!.click();
    // Active on: its own group counts as before; Egypt and Jordan count the active ones.
    await until(() => counts()[2] === 'Egypt 1');
    expect(counts()).toEqual(['Active 2', 'Blocked 1', 'Egypt 1', 'Jordan 1']);
    panel.querySelector<HTMLButtonElement>('[data-filter="jordan"]')!.click();
    await until(() => counts()[0] === 'Active 1');
    expect(counts()).toEqual(['Active 1', 'Blocked 0', 'Egypt 1', 'Jordan 1']);
  });

  it('builds a filter of its own: a field, a condition that suits it, and a value', async () => {
    const host = await mount();
    button(host, 'Search options').click();
    button(host, 'Add a custom filter').click();
    const form = host.querySelector('.fd-custom-filter') as HTMLElement;
    const field = form.querySelector('select[aria-label="Field"]') as HTMLSelectElement;
    const condition = () => form.querySelector('select[aria-label="Condition"]') as HTMLSelectElement;
    field.value = 'state';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    expect([...condition().options].map((o) => o.textContent)).toEqual(['is', 'is not', 'is set', 'is not set']);
    expect([...(form.querySelector('select[aria-label="Value"]') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Active', 'Draft', 'Blocked']);
    field.value = 'credit_limit';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    condition().value = '>';
    condition().dispatchEvent(new Event('change', { bubbles: true }));
    (form.querySelector('input[aria-label="Value"]') as HTMLInputElement).value = '60000';
    button(form, 'Apply').click();
    expect(chips(host)).toEqual(['Credit limit greater than 60,000']);
    await shows(host, ['Nile Traders', 'Petra Tours']);
    expect(form.hidden).toBe(true);
  });

  it('keeps a search as a favourite, starts with the one used by default, and forgets one deleted', async () => {
    const preferences = memoryPreferences();
    const host = await mount(preferences);
    button(host, 'Search options').click();
    button(host, 'Active').click();
    button(host, 'Save current search').click();
    (host.querySelector('input[aria-label="Name of the search"]') as HTMLInputElement).value = 'Active customers';
    (host.querySelector('.fd-favourite-form input[type=checkbox]') as HTMLInputElement).checked = true;
    button(host.querySelector('.fd-favourite-form') as HTMLElement, 'Save').click();
    expect(preferences.get('favourites:customers')).toEqual([{ name: 'Active customers', facets: [{ kind: 'filters', ids: ['active'], labels: ['Active'] }], isDefault: true }]);

    const again = await mount(preferences);
    expect(chips(again)).toEqual(['Active']);
    await shows(again, ['Nile Traders', 'Petra Tours']);
    button(again, 'Remove Active').click();
    await until(() => total(again) === '1–2 / 4');
    button(again, 'Search options').click();
    button(again, 'Active customers').click();
    expect(chips(again)).toEqual(['Active']);
    button(again, 'Delete Active customers').click();
    expect(preferences.get('favourites:customers')).toEqual([]);
    expect(again.querySelector('.fd-favourites-none')?.textContent).toBe('No saved searches yet.');

    const third = await mount(preferences);
    expect(chips(third)).toEqual([]);
  });
});
