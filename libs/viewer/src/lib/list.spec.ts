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
      ['Amira Clinics', 'Egypt', 'Draft', 'E£\u00a050,000.00'],
      ['Nile Traders', 'Egypt', 'Active', 'E£\u00a0250,000.00'],
    ]);
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('1–2 / 4');
    expect(button(host, 'Previous page')?.disabled).toBe(true);
    button(host, 'Next page')!.click();
    await until(() => rows(host)[0]?.textContent?.includes('Petra'));
    expect(rows(host).map((r) => cells(r)[0])).toEqual(['Petra Tours', 'Zamalek Studio']);
    // An amount in the record's own currency, which the list asks for though it is not a column, in its places: a dinar's three.
    expect(cells(rows(host)[0])[3]).toBe('JOD\u00a080,000.000');
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('3–4 / 4');
    expect(button(host, 'Next page')?.disabled).toBe(true);
  });

  it('writes an amount as its field’s money look says, asking for the fields its condition reads though they are no column', async () => {
    const credit = { ...customers.fields['credit_limit'], money: { currency: 'code', at: 'after', per: [{ period: 'month', when: "state == 'active'" }] } };
    const page = { ...customers, fields: { ...customers.fields, credit_limit: credit }, layout: { ...customers.layout, columns: ['name', 'credit_limit'] } } as Page;
    const host = await mount({}, page);
    expect(rows(host).map(cells)).toEqual([
      ['Amira Clinics', '50,000.00\u00a0EGP'],
      ['Nile Traders', '250,000.00\u00a0EGP/month'],
    ]);
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

  it('asks a button’s question once, runs its steps with the records chosen, busy until done, then loads again', async () => {
    const pressed: ActionRequest[] = [];
    let release!: () => void;
    const page = {
      ...customers,
      layout: {
        ...(customers.layout as object),
        actions: [{ type: 'button', id: 'archive', label: 'Archive', confirm: 'Archive them?', steps: [{ do: 'say', message: 'Archiving' }], action: 'archive' }],
      },
    } as Page;
    const host = await mount(
      {
        onAction: (request) => {
          pressed.push(request);
          return new Promise<void>((done) => (release = done));
        },
      },
      page
    );
    (host.querySelector('thead input[type=checkbox]') as HTMLInputElement).click();
    const archive = button(host.querySelector('.fd-list-selection') as HTMLElement, 'Archive')!;
    archive.click();
    await until(() => document.querySelector('[role=alertdialog]'));
    expect(document.querySelectorAll('[role=alertdialog]')).toHaveLength(1);
    // Yes says what it does, in the button's words.
    expect([...(document.querySelector('[role=alertdialog]') as HTMLElement).querySelectorAll('button')].map((one) => one.textContent)).toEqual(['Cancel', 'Archive']);
    button(document.querySelector('[role=alertdialog]') as HTMLElement, 'Archive')!.click();
    await until(() => pressed.length);
    expect(document.querySelector('[role=alertdialog]')).toBeNull();
    expect(archive.getAttribute('aria-busy')).toBe('true');
    archive.click();
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toEqual(expect.objectContaining({ id: 'archive', recordIds: [2, 1] }));
    expect(host.querySelector('.fd-say')?.textContent).toContain('Archiving');
    release();
    await until(() => !archive.hasAttribute('aria-busy'));
    expect(archive.hasAttribute('aria-busy')).toBe(false);
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

  /** The ARIA a treegrid's row may carry and a table's may not: a table's rows claim no tree. */
  const TREE = ['aria-level', 'aria-expanded', 'aria-setsize', 'aria-posinset'];
  const treeClaims = (host: Element) => [...host.querySelectorAll('.fd-list-table tr')].flatMap((tr) => TREE.filter((name) => tr.hasAttribute(name)).map((name) => `${tr.textContent}: ${name}`));
  const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

  it('says what each group is without a tree a table cannot hold: a button that opens it, named with its count in words', async () => {
    const host = await mount();
    await groupBy(host, 'Country', 'Status');
    // Still a table, of rows and cells: a group's row is a cell across every column holding its button.
    expect(host.querySelector('.fd-list-table')?.hasAttribute('role')).toBe(false);
    const egypt = group(host, 'Egypt');
    expect(egypt.closest('td')?.colSpan).toBe(5);
    expect(egypt.getAttribute('aria-expanded')).toBe('false');
    expect([...host.querySelectorAll('.fd-group-toggle')].map((b) => b.getAttribute('aria-label'))).toEqual(['Egypt, 2 records', 'Jordan, 1 record', 'None, 1 record']);
    egypt.click();
    await until(() => groups(host).length === 5);
    group(host, 'Draft').click();
    await until(() => rows(host).length === 1);
    expect(group(host, 'Active').getAttribute('aria-label')).toBe('Active, 1 record');
    expect(treeClaims(host)).toEqual([]);
    // Seen, as it always was: the name, and the count in brackets.
    expect(groups(host)).toEqual(['Egypt (2)', '  Active (1)', '  Draft (1)', 'Jordan (1)', 'None (1)']);
  });

  it('counts a group in the words the page names its records by, in its language', async () => {
    const named = { ...customers, records: { one: 'customer', other: 'customers', a: 'a customer' } } as Page;
    const host = await mount({}, named);
    await groupBy(host, 'Country');
    expect([...host.querySelectorAll('.fd-group-toggle')].map((b) => b.getAttribute('aria-label'))).toEqual(['Egypt, 2 customers', 'Jordan, 1 customer', 'None, 1 customer']);
    handle?.destroy();
    host.remove();
    // A page that names none, in German: the language's own word for records.
    const german = await mount({ locale: 'de' });
    button(german, 'Suchoptionen')!.click();
    button(german.querySelector('.fd-search-panel [data-group-kind="groupBy"]') as HTMLElement, 'Country')!.click();
    await until(() => german.querySelector('.fd-list-group'));
    expect(group(german, 'Egypt').getAttribute('aria-label')).toBe('Egypt, 2 Einträge');
    expect(group(german, 'Jordan').getAttribute('aria-label')).toBe('Jordan, 1 Eintrag');
  });

  it('is worked by keyboard as its rows are: the arrows cross a group’s heading, which opens towards the line’s end and closes towards its start', async () => {
    const host = await mount();
    await groupBy(host, 'Country');
    const [egypt, jordan] = [group(host, 'Egypt'), group(host, 'Jordan')];
    egypt.focus();
    key(egypt, 'ArrowRight');
    await until(() => rows(host).length === 2);
    expect(egypt.getAttribute('aria-expanded')).toBe('true');
    // Open already: Right again changes nothing.
    key(egypt, 'ArrowRight');
    expect(egypt.getAttribute('aria-expanded')).toBe('true');
    key(egypt, 'ArrowDown');
    expect(document.activeElement).toBe(rows(host)[0]);
    key(rows(host)[0], 'ArrowDown');
    key(rows(host)[1], 'ArrowDown');
    expect(document.activeElement).toBe(jordan);
    key(jordan, 'ArrowUp');
    expect(document.activeElement).toBe(rows(host)[1]);
    key(rows(host)[1], 'ArrowUp');
    key(rows(host)[0], 'ArrowUp');
    expect(document.activeElement).toBe(egypt);
    key(egypt, 'ArrowLeft');
    expect(egypt.getAttribute('aria-expanded')).toBe('false');
    expect(rows(host)).toEqual([]);
    key(egypt, 'ArrowDown');
    expect(document.activeElement).toBe(jordan);
  });

  it('turns a heading’s arrows round right to left', async () => {
    const host = await mount({ locale: 'ar', dir: 'rtl' });
    button(host, 'خيارات البحث')!.click();
    button(host.querySelector('.fd-search-panel [data-group-kind="groupBy"]') as HTMLElement, 'Country')!.click();
    await until(() => host.querySelector('.fd-list-group'));
    const first = group(host, 'Egypt');
    key(first, 'ArrowLeft');
    await until(() => rows(host).length > 0);
    expect(first.getAttribute('aria-expanded')).toBe('true');
    key(first, 'ArrowRight');
    expect(first.getAttribute('aria-expanded')).toBe('false');
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
