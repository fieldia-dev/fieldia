import type { Page } from '@fieldia/core';
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
    expect(chips(host)).toEqual(['Credit limit greater than 60000']);
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
