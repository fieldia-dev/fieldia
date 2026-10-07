import { createMemoryDataSource, type Page, type PostedMessage } from '@fieldia/core';
import { openFormDialog } from './dialog';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * What sits around a record: the bar over it with the breadcrumbs the app
 * gives, the gear menu the page fills and the pager over the records the app
 * gives — none of the app's parts in a dialog — and the attachment beside it.
 */

const employee: Page = {
  fieldia: '0.1',
  id: 'employee',
  title: 'Employee',
  data: { kind: 'record', model: 'hr.employee' },
  fields: {
    name: { type: 'char', label: 'Name' },
    active: { type: 'boolean', label: 'Active' },
    cv: { type: 'binary', label: 'CV', multiple: true },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    toolbar: {
      menu: [
        { id: 'm-badge', label: 'Badge', group: 'print', action: 'print_badge' },
        { id: 'm-archive', builtin: 'archive' },
        { id: 'm-unarchive', builtin: 'unarchive' },
        { id: 'm-duplicate', builtin: 'duplicate' },
        { id: 'm-delete', builtin: 'delete' },
        { id: 'm-depart', label: 'Departure', steps: [{ do: 'open', page: 'departure' }] },
      ],
    },
    children: [{ type: 'field', id: 'f-active', field: 'active' }],
  },
};

const departure: Page = {
  fieldia: '0.1',
  id: 'departure',
  title: 'Departure',
  data: { kind: 'responses' },
  fields: { reason: { type: 'char', label: 'Reason' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [{ type: 'field', id: 'f-reason', field: 'reason' }],
    footer: [{ type: 'button', id: 'b-post', label: 'Post it', steps: [{ do: 'post', message: 'Leaving: {reason}' }, { do: 'close' }] }],
  },
};

const people = () =>
  createMemoryDataSource({
    records: {
      'hr.employee': {
        1: { name: 'Mona Adel', active: true },
        2: { name: 'Karim Fathy', active: true },
        3: { name: 'Salma Nabil', active: false },
      },
    },
    attachments: { 'hr.employee:2': [{ name: 'notes.txt', type: 'text/plain', size: 4, url: '/notes.txt' }, { name: 'contract.pdf', type: 'application/pdf', size: 900, url: '/contract.pdf' }, { name: 'photo.png', type: 'image/png', size: 300, url: '/photo.png' }] },
  });

beforeAll(() => Object.assign(URL, { createObjectURL: () => 'blob:1', revokeObjectURL: () => undefined }));

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: employee, dataSource: people(), recordId: 1, confirm: async () => true, pages: { departure }, ...options });
  await handle.form.settled();
  return host;
}
const bar = (host: Element) => host.querySelector('.fd-record-bar') as HTMLElement | null;
const gear = (host: Element) => host.querySelector('.fd-record-gear') as HTMLButtonElement;
const items = (host: Element) => [...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].filter((item) => !item.hidden).map((item) => item.textContent);
const item = (host: Element, words: string) => [...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((b) => b.textContent === words) as HTMLButtonElement;
const pagerText = (host: Element) => host.querySelector('.fd-record-pager-text')?.textContent;
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
const settle = () => handle?.form.settled();

describe('the gear menu over a record', () => {
  it('is a real menu: its Print group first, then the actions, built-ins in the page’s own words', async () => {
    const host = await mount();
    const button = gear(host);
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const menu = host.querySelector('[role="menu"]') as HTMLElement;
    expect(menu.hidden).toBe(true);
    expect(menu.getAttribute('aria-labelledby')).toBe(button.id);
    // Archived records offer Unarchive instead of Archive.
    expect(items(host)).toEqual(['Badge', 'Archive', 'Duplicate', 'Delete', 'Departure']);
    expect(menu.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Print');
  });

  it('opens with the arrow keys, moves through its items, and closes with Escape back on the gear', async () => {
    const host = await mount();
    gear(host).focus();
    key(gear(host), 'ArrowDown');
    expect(gear(host).getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.textContent).toBe('Badge');
    key(document.activeElement as Element, 'ArrowDown');
    expect(document.activeElement?.textContent).toBe('Archive');
    key(document.activeElement as Element, 'ArrowUp');
    key(document.activeElement as Element, 'ArrowUp');
    expect(document.activeElement?.textContent).toBe('Departure');
    key(document.activeElement as Element, 'Escape');
    expect((host.querySelector('[role="menu"]') as HTMLElement).hidden).toBe(true);
    expect(document.activeElement).toBe(gear(host));
    key(gear(host), 'ArrowUp');
    expect(document.activeElement?.textContent).toBe('Departure');
  });

  it('archives and duplicates through the data source: the menu follows the record, the trail names the copy', async () => {
    const host = await mount({ breadcrumbs: [{ label: 'Employees' }] });
    gear(host).click();
    item(host, 'Archive').click();
    await until(() => items(host).includes('Unarchive'));
    expect(items(host)).toEqual(['Badge', 'Unarchive', 'Duplicate', 'Delete', 'Departure']);
    item(host, 'Duplicate').click();
    await until(() => handle?.form.getState().recordId === 4);
    await settle();
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe('Mona Adel (copy)');
  });

  it('runs an item’s own steps, the app’s actions, and words its roles keep from others hidden', async () => {
    const actions: string[] = [];
    const page: Page = { ...employee, layout: { ...(employee.layout as Extract<Page['layout'], { type: 'sheet' }>), toolbar: { menu: [{ id: 'm-debit', label: 'Debit Note', action: 'action_debit_note' }, { id: 'm-boss', label: 'Boss only', action: 'x', roles: ['hr.manager'] }] } } };
    const host = await mount({ page, onAction: (request) => void actions.push(request.action) });
    expect(items(host)).toEqual(['Debit Note']);
    gear(host).click();
    item(host, 'Debit Note').click();
    await until(() => actions.length);
    expect(actions).toEqual(['action_debit_note']);
  });

  it('keeps the gear away while every item is hidden, and the bar away when it would hold nothing', async () => {
    const page: Page = { ...employee, layout: { ...(employee.layout as Extract<Page['layout'], { type: 'sheet' }>), toolbar: { menu: [{ id: 'm-x', label: 'X', action: 'x', invisible: true }] } } };
    const host = await mount({ page });
    expect((host.querySelector('.fd-record-actions') as HTMLElement).hidden).toBe(true);
    handle?.destroy();
    const plain = await mount({ page: { ...employee, layout: { ...(employee.layout as Extract<Page['layout'], { type: 'sheet' }>), toolbar: undefined } } });
    expect(bar(plain)).toBeNull();
  });

  it('shows in a dialog, without the pager or the breadcrumbs the app gave', async () => {
    void openFormDialog({ page: employee, dataSource: people(), recordId: 1, title: 'Mona', records: [1, 2, 3], breadcrumbs: [{ label: 'Employees' }] });
    await until(() => document.querySelector('[role="dialog"] .fd-record-gear'));
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.querySelector('.fd-record-gear')).not.toBeNull();
    expect(dialog.querySelector('.fd-record-pager')).toBeNull();
    expect(dialog.querySelector('.fd-breadcrumbs')).toBeNull();
  });
});

describe('the pager over a record', () => {
  it('says where the record is, moves to the next and round from the last, and tells the app which', async () => {
    const opened: unknown[] = [];
    const host = await mount({ records: [1, 2, 3] });
    handle?.on('open', ({ recordId }) => opened.push(recordId));
    expect(pagerText(host)).toBe('1 / 3');
    const [previous, next] = [...host.querySelectorAll<HTMLButtonElement>('.fd-record-pager button')];
    expect([previous.getAttribute('aria-label'), next.getAttribute('aria-label')]).toEqual(['Previous record', 'Next record']);
    expect(host.querySelector('.fd-record-pager')?.getAttribute('role')).toBe('group');
    next.click();
    await until(() => pagerText(host) === '2 / 3');
    expect(host.querySelector<HTMLElement>('.fd-title input')).toBeTruthy();
    expect(handle?.form.getState().values['name']).toBe('Karim Fathy');
    previous.click();
    await until(() => pagerText(host) === '1 / 3');
    previous.click();
    await until(() => pagerText(host) === '3 / 3');
    await settle();
    expect(opened).toEqual([2, 1, 3]);
  });

  it('saves what changed before it moves, and stays when the save is refused', async () => {
    const source = people();
    const host = await mount({ records: [1, 2], dataSource: source });
    handle?.form.setValue('name', 'Mona A. Adel');
    (host.querySelectorAll<HTMLButtonElement>('.fd-record-pager button')[1]).click();
    await until(() => pagerText(host) === '2 / 2');
    expect(source.records['hr.employee'][1]['name']).toBe('Mona A. Adel');
    handle?.form.setValue('name', '');
    const refusing = { ...source, save: () => Promise.reject(Object.assign(new Error('Name is needed'), { problem: { kind: 'rule', message: 'Name is needed' } })) };
    handle?.destroy();
    const again = await mount({ records: [1, 2], dataSource: refusing });
    handle?.form.setValue('name', 'Changed');
    (again.querySelectorAll<HTMLButtonElement>('.fd-record-pager button')[1]).click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(pagerText(again)).toBe('1 / 2');
    expect(handle?.form.getState().recordId).toBe(1);
  });

  it('asks the app for the id at a place when it gives only how many there are', async () => {
    const asked: number[] = [];
    const host = await mount({ recordId: 2, records: { total: 40, at: 11, id: (at) => (asked.push(at), Promise.resolve(at === 12 ? 3 : 1)) } });
    expect(pagerText(host)).toBe('12 / 40');
    (host.querySelectorAll<HTMLButtonElement>('.fd-record-pager button')[1]).click();
    await until(() => pagerText(host) === '13 / 40');
    expect(asked).toEqual([12]);
    expect(handle?.form.getState().recordId).toBe(3);
  });

  it('moves on to the next record when this one is deleted, and counts a copy among them', async () => {
    const host = await mount({ records: [1, 2, 3] });
    gear(host).click();
    item(host, 'Duplicate').click();
    await until(() => pagerText(host) === '2 / 4');
    gear(host).click();
    item(host, 'Delete').click();
    await until(() => pagerText(host) === '2 / 3');
    await settle();
    expect(handle?.form.getState().values['name']).toBe('Karim Fathy');
  });

  it('stays away when the page says so', async () => {
    const page: Page = { ...employee, layout: { ...(employee.layout as Extract<Page['layout'], { type: 'sheet' }>), toolbar: { pager: false, breadcrumbs: false } } };
    const host = await mount({ page, records: [1, 2], breadcrumbs: [{ label: 'Employees' }] });
    expect(bar(host)).toBeNull();
  });
});

describe('the breadcrumbs over a record', () => {
  it('are a nav of the trail the app gives, the record last by its name, each before it a way back', async () => {
    const back = jest.fn();
    const host = await mount({ breadcrumbs: [{ label: 'Employees', open: back }, { label: 'Sales team', href: '#team' }] });
    const nav = host.querySelector('nav.fd-breadcrumbs') as HTMLElement;
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumbs');
    expect([...nav.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Employees', 'Sales team', 'Mona Adel']);
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Mona Adel');
    expect(nav.querySelector('a')?.getAttribute('href')).toBe('#team');
    (nav.querySelector('button') as HTMLButtonElement).click();
    expect(back).toHaveBeenCalled();
  });

  it('name a new record New, in the page’s language', async () => {
    const host = await mount({ recordId: null, breadcrumbs: [{ label: 'الموظفون' }], locale: 'ar' });
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe('جديد');
    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('مسار التنقل');
    expect(gear(host).textContent).toBe('إجراءات');
  });

  it('carry a page opened in the record’s place, the record its way back', async () => {
    const page: Page = { ...employee, layout: { ...(employee.layout as Extract<Page['layout'], { type: 'sheet' }>), buttons: [{ type: 'button', id: 'b-team', label: 'Team', steps: [{ do: 'open', page: 'team', as: 'page', record: '2' }] }] } };
    const team: Page = { ...employee, id: 'team', layout: { type: 'sheet', id: 'sheet', title: { field: 'name' }, children: [] } };
    const host = await mount({ page, pages: { team }, breadcrumbs: [{ label: 'Employees' }] });
    (host.querySelector('[data-node="b-team"]') as HTMLButtonElement).click();
    // The record steps aside, hidden, while the page in its place shows.
    const shown = () => [...host.querySelectorAll<HTMLElement>(':scope > .fd-form')].find((form) => !form.hidden) as HTMLElement;
    await until(() => shown().querySelector('[aria-current="page"]')?.textContent === 'Karim Fathy');
    const crumbs = [...shown().querySelectorAll('nav.fd-breadcrumbs li')].map((li) => li.textContent);
    expect(crumbs).toEqual(['Employees', 'Mona Adel', 'Karim Fathy']);
    expect(host.querySelector('.fd-back')).toBeNull();
    [...shown().querySelectorAll<HTMLButtonElement>('.fd-crumb')].find((crumb) => crumb.textContent === 'Mona Adel')?.click();
    await until(() => host.querySelectorAll(':scope > .fd-form').length === 1);
    expect([...shown().querySelectorAll('nav.fd-breadcrumbs li')].map((li) => li.textContent)).toEqual(['Employees', 'Mona Adel']);
  });
});

describe('words posted from a page opened over a record', () => {
  it('go to the record’s conversation, not the opened page’s', async () => {
    const host = await mount();
    const posted: PostedMessage[] = [];
    handle?.on('post', ({ message }) => void posted.push(message));
    gear(host).click();
    item(host, 'Departure').click();
    await until(() => document.querySelector('[role="dialog"] input'));
    const input = document.querySelector('[role="dialog"] input') as HTMLInputElement;
    input.value = 'Moving abroad';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    ([...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) => b.textContent === 'Post it') as HTMLButtonElement).click();
    await until(() => posted.length);
    expect(posted).toEqual([{ kind: 'note', text: 'Leaving: Moving abroad', body: '<p>Leaving: Moving abroad</p>' }]);
  });
});

describe('the attachment beside the sheet', () => {
  const withPreview = (preview: NonNullable<Extract<Page['layout'], { type: 'sheet' }>['attachmentPreview']>): Page => ({
    ...employee,
    layout: { ...(employee.layout as Extract<Page['layout'], { type: 'sheet' }>), attachmentPreview: preview, sidePanel: { type: 'slot', id: 'chatter', name: 'chatter' }, sidePanelBeside: 'always' },
  });
  const preview = (host: Element) => host.querySelector('.fd-attachment-preview') as HTMLElement;

  it('shows the data source’s first picture or PDF, in the browser’s own viewer, and goes through the rest', async () => {
    const host = await mount({ page: withPreview({}), recordId: 2 });
    await until(() => !preview(host).hidden);
    expect(preview(host).getAttribute('aria-label')).toBe('Attachment: contract.pdf');
    expect(preview(host).querySelector('iframe')?.getAttribute('src')).toBe('/contract.pdf');
    expect(preview(host).querySelector('a.fd-attachment-open')?.getAttribute('href')).toBe('/contract.pdf');
    expect(preview(host).querySelector('.fd-attachment-count')?.textContent).toBe('1 / 2');
    (preview(host).querySelector('[aria-label="Next attachment"]') as HTMLButtonElement).click();
    expect(preview(host).querySelector('img')?.getAttribute('src')).toBe('/photo.png');
    expect(host.querySelector('.fd-sheet-layout')?.getAttribute('data-side-beside')).toBe('always');
  });

  it('is hidden while the record has nothing to show, and follows the form to another record', async () => {
    const host = await mount({ page: withPreview({}), records: [1, 2] });
    await settle();
    expect(preview(host).hidden).toBe(true);
    (host.querySelectorAll<HTMLButtonElement>('.fd-record-pager button')[1]).click();
    await until(() => !preview(host).hidden);
    expect(preview(host).querySelector('.fd-attachment-name')?.textContent).toBe('contract.pdf');
  });

  it('shows a file field’s file, as it changes', async () => {
    const host = await mount({ page: withPreview({ field: 'cv' }) });
    expect(preview(host).hidden).toBe(true);
    handle?.form.setValue('cv', [{ name: 'cv.pdf', type: 'application/pdf', size: 3, data: 'JVBERg==' }]);
    expect(preview(host).hidden).toBe(false);
    expect(preview(host).querySelector('.fd-attachment-name')?.textContent).toBe('cv.pdf');
    expect(preview(host).querySelector('iframe')?.getAttribute('src')).toBe('blob:1');
  });
});

