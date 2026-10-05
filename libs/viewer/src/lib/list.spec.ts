import { createMemoryDataSource, type ActionRequest, type Page } from '@fieldia/core';
import { customers, partners, until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}, page: Page = customers) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: partners(), ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr'));
  return host;
}
const rows = (host: Element) => [...host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')] as HTMLTableRowElement[];
const cells = (row: Element) => [...row.querySelectorAll('td')].slice(1).map((td) => td.textContent);
const button = (root: Element, name: string) => [...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name && !b.closest('[hidden]')) as HTMLButtonElement | undefined;

describe('a list of records', () => {
  it('shows a page of records in the list’s order, each value as the form would show it, and pages through', async () => {
    const host = await mount();
    expect([...host.querySelectorAll('.fd-list-table thead th')].slice(1).map((th) => th.textContent)).toEqual(['Name', 'Country', 'Status', 'Credit limit']);
    expect(rows(host).map(cells)).toEqual([
      ['Amira Clinics', 'Egypt', 'Draft', 'E£50,000.00'],
      ['Nile Traders', 'Egypt', 'Active', 'E£250,000.00'],
    ]);
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('1–2 / 4');
    expect(button(host, 'Previous page')?.disabled).toBe(true);
    button(host, 'Next page')!.click();
    await until(() => rows(host)[0]?.textContent?.includes('Petra'));
    expect(rows(host).map((r) => cells(r)[0])).toEqual(['Petra Tours', 'Zamalek Studio']);
    // An amount in the record's own currency, which the list asks for though it is not a column.
    expect(cells(rows(host)[0])[3]).toBe('JOD\u00a080,000.00');
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('3–4 / 4');
    expect(button(host, 'Next page')?.disabled).toBe(true);
  });

  it('keeps each value in its own direction, so a phone number reads the same right to left', async () => {
    const host = await mount({ locale: 'ar' });
    const cell = rows(host)[0].querySelectorAll('td')[4];
    expect(cell.firstElementChild?.tagName).toBe('BDI');
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('1–2 من 4');
  });

  it('sorts by a column from its header, one way then the other, and says so', async () => {
    const host = await mount();
    const header = () => [...host.querySelectorAll('.fd-list-table thead th')].find((th) => th.textContent?.startsWith('Credit limit')) as HTMLElement;
    header().querySelector('button')!.click();
    await until(() => header().getAttribute('aria-sort') === 'ascending');
    expect(header().getAttribute('aria-sort')).toBe('ascending');
    await until(() => cells(rows(host)[0])[0] === 'Amira Clinics');
    expect(rows(host).map((r) => cells(r)[0])).toEqual(['Amira Clinics', 'Petra Tours']);
    header().querySelector('button')!.click();
    await until(() => header().getAttribute('aria-sort') === 'descending');
    expect(header().getAttribute('aria-sort')).toBe('descending');
    await until(() => cells(rows(host)[0])[0] === 'Nile Traders');
    expect(rows(host).map((r) => cells(r)[0])).toEqual(['Nile Traders', 'Petra Tours']);
  });

  it('opens a record from its row, by a click or by Enter', async () => {
    const opened: unknown[] = [];
    const host = await mount({ onOpenRecord: (id) => void opened.push(id) });
    rows(host)[1].querySelector('td:nth-child(2)')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    rows(host)[0].focus();
    rows(host)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(opened).toEqual([1, 2]);
    // Choosing a row is not opening it.
    (rows(host)[0].querySelector('input[type=checkbox]') as HTMLInputElement).click();
    expect(opened).toEqual([1, 2]);
  });

  it('selects records, offers the list’s buttons for them, and hands the app their ids', async () => {
    const pressed: ActionRequest[] = [];
    const host = await mount({ onAction: (request) => void pressed.push(request) });
    const bulk = host.querySelector('.fd-list-selection') as HTMLElement;
    expect(bulk.hidden).toBe(true);
    (rows(host)[0].querySelector('input[type=checkbox]') as HTMLInputElement).click();
    expect(bulk.hidden).toBe(false);
    expect(bulk.textContent).toContain('1 selected');
    (host.querySelector('thead input[type=checkbox]') as HTMLInputElement).click();
    expect(bulk.textContent).toContain('2 selected');
    button(bulk, 'Archive')!.click();
    await until(() => pressed.length);
    expect(pressed[0]).toEqual(expect.objectContaining({ id: 'archive', action: 'archive', recordIds: [2, 1] }));
    button(bulk, 'Clear')!.click();
    expect(bulk.hidden).toBe(true);
  });

  it('starts with the list’s default filters, and says when nothing matches', async () => {
    const host = await mount({}, { ...customers, layout: { ...(customers.layout as object), defaultFilters: ['active'] } as Page['layout'] });
    expect(rows(host).map((r) => cells(r)[0])).toEqual(['Nile Traders', 'Petra Tours']);
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('1–2 / 2');
    const empty = document.createElement('div');
    document.body.append(empty);
    const other = mountViewer(empty, { page: customers, dataSource: createMemoryDataSource() });
    await until(() => !(empty.querySelector('.fd-list-empty') as HTMLElement)?.hidden);
    expect((empty.querySelector('.fd-list-empty') as HTMLElement).hidden).toBe(false);
    expect(empty.querySelector('.fd-list-empty')?.textContent).toBe('No records match.');
    other.destroy();
  });
});

describe('a list grouped by its fields', () => {
  const groups = (host: Element) => [...host.querySelectorAll('.fd-list-group')].map((tr) => `${'  '.repeat(Number((tr as HTMLElement).dataset['level']))}${tr.textContent}`);
  const group = (host: Element, name: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('.fd-group-toggle')].find((b) => b.querySelector('.fd-group-label')?.textContent === name) as HTMLButtonElement;
  async function groupBy(host: Element, ...names: string[]) {
    button(host, 'Search options')!.click();
    for (const name of names) button(host.querySelector('.fd-search-panel [data-group-kind="groupBy"]') as HTMLElement, name)!.click();
    await until(() => host.querySelector('.fd-list-group'));
  }

  it('shows a row for each value with how many records have it, and opens one into its records', async () => {
    const host = await mount();
    await groupBy(host, 'Country');
    expect(groups(host)).toEqual(['Egypt (2)', 'Jordan (1)', 'None (1)']);
    expect(rows(host)).toEqual([]);
    expect((host.querySelector('.fd-pager') as HTMLElement).hidden).toBe(true);
    const egypt = group(host, 'Egypt');
    expect(egypt.getAttribute('aria-expanded')).toBe('false');
    egypt.click();
    await until(() => rows(host).length === 2);
    expect(egypt.getAttribute('aria-expanded')).toBe('true');
    expect(rows(host).map((r) => cells(r)[0])).toEqual(['Amira Clinics', 'Nile Traders']);
    // The records sit under their group, before the next one.
    expect(rows(host)[1].nextElementSibling?.textContent).toBe('Jordan (1)');
    group(host, 'None').click();
    await until(() => rows(host).length === 3);
    expect(rows(host)[2].textContent).toContain('Zamalek Studio');
    egypt.click();
    expect(rows(host).map((r) => cells(r)[0])).toEqual(['Zamalek Studio']);
    expect(egypt.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a group into the next field’s groups, and closes everything under it at once', async () => {
    const host = await mount();
    await groupBy(host, 'Country', 'Status');
    group(host, 'Egypt').click();
    await until(() => groups(host).length === 5);
    expect(groups(host)).toEqual(['Egypt (2)', '  Active (1)', '  Draft (1)', 'Jordan (1)', 'None (1)']);
    group(host, 'Draft').click();
    await until(() => rows(host).length === 1);
    expect(cells(rows(host)[0])[0]).toBe('Amira Clinics');
    expect(rows(host)[0].dataset['level']).toBe('2');
    group(host, 'Egypt').click();
    expect(groups(host)).toEqual(['Egypt (2)', 'Jordan (1)', 'None (1)']);
    expect(rows(host)).toEqual([]);
  });

  it('shows a group’s records a page at a time, with the rest a click away', async () => {
    const host = await mount({}, { ...customers, layout: { ...(customers.layout as object), pageSize: 1 } as Page['layout'] });
    await groupBy(host, 'Country');
    group(host, 'Egypt').click();
    await until(() => rows(host).length === 1);
    const more = button(host, 'Show 1 more')!;
    expect(more).toBeTruthy();
    more.click();
    await until(() => rows(host).length === 2);
    expect(rows(host).map((r) => cells(r)[0])).toEqual(['Amira Clinics', 'Nile Traders']);
    expect(host.querySelector('.fd-list-more')).toBeNull();
  });

  it('chooses the records on show in the open groups, and goes back to pages when the grouping goes', async () => {
    const pressed: ActionRequest[] = [];
    const host = await mount({ onAction: (request) => void pressed.push(request) });
    await groupBy(host, 'Country');
    group(host, 'Egypt').click();
    await until(() => rows(host).length === 2);
    (host.querySelector('thead input[type=checkbox]') as HTMLInputElement).click();
    button(host.querySelector('.fd-list-selection') as HTMLElement, 'Archive')!.click();
    await until(() => pressed.length);
    expect(pressed[0].recordIds).toEqual([2, 1]);
    // Closed, a group's records are no longer chosen.
    group(host, 'Egypt').click();
    expect((host.querySelector('.fd-list-selection') as HTMLElement).hidden).toBe(true);
    button(host, 'Remove Country')!.click();
    await until(() => rows(host).length === 2 && !host.querySelector('.fd-list-group'));
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('1–2 / 4');
  });
});
