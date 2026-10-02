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
      ['Amira Clinics', 'Egypt', 'Draft', 'EGP 50,000.00'],
      ['Nile Traders', 'Egypt', 'Active', 'EGP 250,000.00'],
    ]);
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('1–2 / 4');
    expect(button(host, 'Previous page')?.disabled).toBe(true);
    button(host, 'Next page')!.click();
    await until(() => rows(host)[0]?.textContent?.includes('Petra'));
    expect(rows(host).map((r) => cells(r)[0])).toEqual(['Petra Tours', 'Zamalek Studio']);
    // An amount in the record's own currency, which the list asks for though it is not a column.
    expect(cells(rows(host)[0])[3]).toBe('JOD 80,000.00');
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
