import { createMemoryDataSource, type Page } from '@fieldia/core';
import { openFormDialog } from './dialog';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A record on paper: as printing begins (the window's beforeprint), every tab
 * is drawn, each box written as the words a person reads in it, and the
 * printout's head filled — the app's logo and words, the record's title, the
 * day on the page's clock — and all of it undone once printing is done. The
 * gear menu's built-in Print and a `print` step print this form alone; the
 * app's PDF handed back from an action is shown over the record, or saved.
 */

const invoice: Page = {
  fieldia: '0.4',
  id: 'invoice',
  title: 'Invoice',
  timeZone: 'Africa/Cairo',
  print: { header: 'Zamalek Office Supplies\nCairo', footer: 'Quote {name} when you pay.', logo: '/brand/logo.svg' },
  data: { kind: 'record', model: 'account.move' },
  fields: {
    name: { type: 'char', label: 'Number' },
    partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }] },
    payment: { type: 'selection', label: 'Payment', options: [{ value: 'bank', label: 'Bank transfer' }, { value: 'cash', label: 'Cash' }] },
    note: { type: 'text', label: 'Terms' },
    reference: { type: 'char', label: 'Reference' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    toolbar: { menu: [{ id: 'm-print', builtin: 'print' }, { id: 'm-pdf', label: 'Invoice PDF', group: 'print', action: 'print_invoice' }, { id: 'm-dup', builtin: 'duplicate' }] },
    buttons: [{ type: 'button', id: 'b-print', label: 'Print it', steps: [{ do: 'print' }] }],
    children: [
      { type: 'field', id: 'f-partner', field: 'partner_id' },
      {
        type: 'tabs',
        id: 'tabs',
        children: [
          { type: 'tab', id: 't-main', label: 'Details', children: [{ type: 'field', id: 'f-state', field: 'state' }] },
          { type: 'tab', id: 't-pay', label: 'Payment', children: [{ type: 'field', id: 'f-payment', field: 'payment' }, { type: 'field', id: 'f-note', field: 'note' }] },
          { type: 'tab', id: 't-hidden', label: 'Internal', invisible: 'state == "posted"', children: [{ type: 'field', id: 'f-ref', field: 'reference' }] },
        ],
      },
    ],
  },
};

const source = () =>
  createMemoryDataSource({
    records: {
      'account.move': { 7: { name: 'INV/2026/0042', partner_id: { id: 1, label: 'Heliopolis Medical Center' }, state: 'posted', payment: 'bank', note: 'Within 30 days.\nNo cash.', reference: 'PO-118' } },
      partner: { 1: { name: 'Heliopolis Medical Center' } },
    },
  });

let handle: ViewerHandle | null = null;
afterEach(() => {
  jest.restoreAllMocks();
  handle?.destroy();
  handle = null;
  document.documentElement.classList.remove('fd-print-one');
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: invoice, dataSource: source(), recordId: 7, now: () => new Date('2026-10-16T08:05:00Z'), ...options });
  await until(() => handle?.form.getState().status === 'ready');
  return host;
}
const root = (host: Element) => host.querySelector('form.fd-form') as HTMLElement;
const panel = (host: Element, label: string) => host.querySelector(`.fd-tabpanel[data-fd-tab="${label}"]`) as HTMLElement;
const words = (host: Element) => [...host.querySelectorAll('.fd-print-box')].map((box) => box.textContent);

describe('a record on paper', () => {
  it('has a head the screen does not show: the app’s logo and words, the record’s title and the day on the page’s clock', async () => {
    const host = await mount();
    const head = host.querySelector('.fd-print-head') as HTMLElement;
    expect(head.getAttribute('aria-hidden')).toBe('true');
    expect(head.querySelector('img')?.getAttribute('src')).toBe('/brand/logo.svg');
    // The app's words a line each.
    expect([...head.querySelectorAll('.fd-print-words .fd-print-line')].map((line) => line.textContent)).toEqual(['Zamalek Office Supplies', 'Cairo']);
    window.dispatchEvent(new Event('beforeprint'));
    // The record's own name, alone.
    expect(head.querySelector('.fd-print-title')?.textContent).toBe('INV/2026/0042');
    // 08:05 in UTC is 11:05 in Cairo, the page's zone (EEST, summer time, on 16 October 2026).
    expect(head.querySelector('.fd-print-when')?.textContent).toMatch(/^Printed 16 Oct 2026, 11:05/);
    // The footer's {name} is the record's.
    expect(host.querySelector('.fd-print-foot')?.textContent).toBe('Quote INV/2026/0042 when you pay.');
  });

  it('draws every tab as printing begins — but one its condition hides — and names each', async () => {
    const host = await mount();
    expect(panel(host, 'Payment').querySelector('[data-field="payment"]')).toBeNull();
    window.dispatchEvent(new Event('beforeprint'));
    expect(root(host).hasAttribute('data-fd-print')).toBe(true);
    expect(panel(host, 'Payment').querySelector('[data-field="payment"]')).not.toBeNull();
    // Hidden by its condition (the invoice is posted): off the paper too, and never drawn for it.
    expect(panel(host, 'Internal').hasAttribute('data-off')).toBe(true);
    expect(panel(host, 'Internal').querySelector('[data-field="reference"]')).toBeNull();
    // The tab shown stays the one shown.
    expect(panel(host, 'Details').hidden).toBe(false);
    expect(panel(host, 'Payment').hidden).toBe(true);
  });

  it('writes each box as the words a person reads in it, beside it, and takes them away once printed', async () => {
    const host = await mount();
    window.dispatchEvent(new Event('beforeprint'));
    // The title, the customer by name, a choice by its label, a long text whole with its lines.
    expect(words(host)).toEqual(expect.arrayContaining(['INV/2026/0042', 'Heliopolis Medical Center', 'Posted', 'Bank transfer', 'Within 30 days.\nNo cash.']));
    const box = host.querySelector('[data-field="note"] textarea') as HTMLTextAreaElement;
    expect(box.hasAttribute('data-print-box')).toBe(true);
    expect(box.nextElementSibling?.classList.contains('fd-print-box')).toBe(true);
    window.dispatchEvent(new Event('afterprint'));
    expect(words(host)).toEqual([]);
    expect(box.hasAttribute('data-print-box')).toBe(false);
    expect(root(host).hasAttribute('data-fd-print')).toBe(false);
  });

  it('writes what was typed and not saved yet: the paper shows the boxes as they are', async () => {
    const host = await mount();
    const box = host.querySelector('[data-field="note"] textarea, [data-field="partner_id"] input') as HTMLInputElement;
    expect(box).not.toBeNull();
    const title = host.querySelector('[data-node="#title"] textarea') as HTMLTextAreaElement;
    title.value = 'INV/2026/0042-B';
    window.dispatchEvent(new Event('beforeprint'));
    expect(words(host)).toContain('INV/2026/0042-B');
  });
});

describe('the owner’s walk of 0.25 on paper', () => {
  const draft = () =>
    createMemoryDataSource({ records: { 'account.move': { 8: { name: '/', state: 'draft' }, 9: { name: null, state: 'draft' } }, partner: { 1: { name: 'Heliopolis Medical Center' } } } });
  const sheet = invoice.layout as Extract<Page['layout'], { type: 'sheet' }>;
  const staged: Page = { ...invoice, records: { one: 'invoice', other: 'invoices', a: 'an invoice' }, layout: { ...sheet, statusbar: { field: 'state' } } };

  it('titles a record with no name yet by what its page calls its records and its stage, never its model’s title', async () => {
    for (const [recordId, page, title] of [
      [8, staged, 'Invoice · Draft'],
      [9, staged, 'Invoice · Draft'],
      [8, invoice, 'Invoice'],
    ] as const) {
      const host = await mount({ page, dataSource: draft(), recordId });
      window.dispatchEvent(new Event('beforeprint'));
      expect(host.querySelector('.fd-print-title')?.textContent).toBe(title);
      window.dispatchEvent(new Event('afterprint'));
      handle?.destroy();
      handle = null;
    }
  });

  it('leaves out a header or footer line whose value is empty, "/" or no words, whole; the others stay', async () => {
    const page: Page = { ...invoice, print: { header: 'Zamalek\nOrder {reference}', footer: 'Quote {name} when you pay.\nThank you.' } };
    const host = await mount({ page, dataSource: draft(), recordId: 8 });
    window.dispatchEvent(new Event('beforeprint'));
    const shown = (box: string) => [...host.querySelectorAll<HTMLElement>(`${box} .fd-print-line`)].filter((line) => !line.hidden).map((line) => line.textContent);
    expect(shown('.fd-print-words')).toEqual(['Zamalek']);
    expect(shown('.fd-print-foot')).toEqual(['Thank you.']);
    // A name typed: its line back.
    handle?.form.setValue('name', 'INV/2026/0043');
    window.dispatchEvent(new Event('afterprint'));
    window.dispatchEvent(new Event('beforeprint'));
    expect(shown('.fd-print-foot')).toEqual(['Quote INV/2026/0043 when you pay.', 'Thank you.']);
  });

  it('marks a tab, a group or a field its page leaves off paper, for the stylesheet to leave out', async () => {
    const off: Page = JSON.parse(JSON.stringify(invoice));
    const tabs = (off.layout as { children: { id: string; children?: { id: string; print?: boolean; children?: { print?: boolean }[] }[] }[] }).children[1];
    tabs.children![1].print = false;
    (off.layout as { children: { print?: boolean }[] }).children[0].print = false;
    const host = await mount({ page: off });
    window.dispatchEvent(new Event('beforeprint'));
    expect(panel(host, 'Payment').dataset['print']).toBe('off');
    expect(panel(host, 'Details').dataset['print']).toBeUndefined();
    expect((host.querySelector('[data-node="f-partner"]') as HTMLElement).dataset['print']).toBe('off');
  });
});

describe('what is in front, and the footer on every sheet', () => {
  it('with a form dialog open, prints only the form in it — the dialog’s record — not the page behind', async () => {
    const host = await mount();
    void openFormDialog({ page: invoice, dataSource: source(), recordId: 7, title: 'INV/2026/0042' });
    await until(() => document.querySelector('.fd-form-dialog form.fd-form .fd-print-head'));
    const front = document.querySelector('.fd-form-dialog form.fd-form') as HTMLElement;
    window.dispatchEvent(new Event('beforeprint'));
    expect(document.documentElement.classList.contains('fd-print-one')).toBe(true);
    expect(front.classList.contains('fd-print-this')).toBe(true);
    expect(root(host).classList.contains('fd-print-this')).toBe(false);
    window.dispatchEvent(new Event('afterprint'));
    expect(document.documentElement.classList.contains('fd-print-one')).toBe(false);
    expect(front.classList.contains('fd-print-this')).toBe(false);
  });

  it('with none open, prints the page as it is: nothing marked to print alone', async () => {
    await mount();
    window.dispatchEvent(new Event('beforeprint'));
    expect(document.documentElement.classList.contains('fd-print-one')).toBe(false);
    window.dispatchEvent(new Event('afterprint'));
  });

  it('keeps a record’s footer the content’s last part, which paper repeats under every sheet: no room kept by padding', async () => {
    const host = await mount();
    window.dispatchEvent(new Event('beforeprint'));
    expect(root(host).hasAttribute('data-print-room')).toBe(false);
    // The content's last part, its words in a box of their own inside it (a table's footer group draws no rule).
    const content = root(host).querySelector(':scope > .fd-content') as HTMLElement;
    const end = content.lastElementChild as HTMLElement;
    expect(end.classList.contains('fd-print-end')).toBe(true);
    expect(end.getAttribute('aria-hidden')).toBe('true');
    expect(end.querySelector(':scope > .fd-print-foot')?.textContent).toBe('Quote INV/2026/0042 when you pay.');
    expect(root(host).querySelector(':scope > .fd-print-foot, :scope > .fd-print-end')).toBeNull();
    window.dispatchEvent(new Event('afterprint'));
  });

  it('has no footer where its page has none', async () => {
    const host = await mount({ page: { ...invoice, print: { header: 'Zamalek Office Supplies' } } });
    expect(host.querySelector('.fd-print-end, .fd-print-foot')).toBeNull();
  });
});

describe('a heading kept with the start of what follows it', () => {
  /** Where each part stands on the screen, as a browser lays it out: by its node, its field or its tab. */
  /** The parts measured with every tab shown (the form marked for it while measured). */
  const measured = new Set<string>();
  function laidOut(places: Record<string, [top: number, bottom: number]>) {
    measured.clear();
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const name = this.getAttribute('data-fd-tab') ?? this.getAttribute('data-field') ?? this.getAttribute('data-node') ?? '';
      if (this.closest('[data-fd-measure]')) measured.add(name);
      const [top, bottom] = places[name] ?? [0, 0];
      return { top, bottom, left: 0, right: 600, width: 600, height: bottom - top, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    jest.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(() => [{}] as unknown as DOMRectList);
  }
  const keep = (element: Element | null) => (element as HTMLElement | null)?.style.getPropertyValue('--fd-print-keep');

  it('keeps room under a tab’s name for its first part, measured as printing begins with every tab shown, and gives it back once printed', async () => {
    const host = await mount();
    // The Payment tab, not the one shown: its first part, the payment, 44px tall under the tab's top.
    laidOut({ Payment: [400, 600], payment: [400, 444], note: [460, 560], Details: [100, 200], state: [100, 130] });
    window.dispatchEvent(new Event('beforeprint'));
    // A quarter more than the 44px it takes at a sheet's width, for what paper draws otherwise, and 8 more: 63.
    expect(keep(panel(host, 'Payment'))).toBe('63px');
    expect(keep(panel(host, 'Details'))).toBe('46px');
    // Every tab was shown for it, and is as it was once measured.
    expect(measured).toEqual(new Set(['Payment', 'payment', 'Details', 'state']));
    expect(root(host).hasAttribute('data-fd-measure')).toBe(false);
    expect(panel(host, 'Payment').hidden).toBe(true);
    window.dispatchEvent(new Event('afterprint'));
    expect(keep(panel(host, 'Payment'))).toBe('');
    expect(keep(panel(host, 'Details'))).toBe('');
  });

  it('keeps a titled group’s title with its first field, and a short group whole on its sheet', async () => {
    const grouped = (title: string) => ({
      ...invoice,
      layout: { ...invoice.layout, children: [{ type: 'section', id: title, title, children: [{ type: 'field', id: `f-${title}-ref`, field: 'reference' }, { type: 'field', id: `f-${title}-note`, field: 'note' }] }] },
    }) as Page;
    const host = await mount({ page: grouped('Terms') });
    const group = host.querySelector('fieldset.fd-section') as HTMLElement;
    laidOut({ Terms: [100, 260], reference: [130, 170], note: [180, 260] });
    window.dispatchEvent(new Event('beforeprint'));
    // Its title and first field, 70px, a quarter more and 8; all of it, 160px, one box on paper, kept whole.
    expect(group.style.getPropertyValue('--fd-print-keep')).toBe('96px');
    expect(group.style.getPropertyValue('--fd-print-whole')).toBe('inline-block');
    window.dispatchEvent(new Event('afterprint'));
    expect(group.style.getPropertyValue('--fd-print-whole')).toBe('');
    // Taller than 420px with a quarter more: broken where it may, its title kept with its first field.
    laidOut({ Terms: [100, 500], reference: [130, 170], note: [180, 500] });
    window.dispatchEvent(new Event('beforeprint'));
    expect(group.style.getPropertyValue('--fd-print-keep')).toBe('96px');
    expect(group.style.getPropertyValue('--fd-print-whole')).toBe('');
    window.dispatchEvent(new Event('afterprint'));
  });

  it('keeps no more than all the tab holds, nor more than 420px; a part never laid out keeps the stylesheet’s own room', async () => {
    const host = await mount();
    laidOut({ Payment: [0, 900], payment: [0, 860], Details: [100, 140], state: [100, 136] });
    window.dispatchEvent(new Event('beforeprint'));
    expect(keep(panel(host, 'Payment'))).toBe('420px');
    // 36px of the tab's first part, 40 of all it holds: 40 and 8, not 36 a quarter more and 8.
    expect(keep(panel(host, 'Details'))).toBe('48px');
    window.dispatchEvent(new Event('afterprint'));
    laidOut({});
    window.dispatchEvent(new Event('beforeprint'));
    expect(keep(panel(host, 'Payment'))).toBe('');
    window.dispatchEvent(new Event('afterprint'));
  });
});

describe('Print: this form alone', () => {
  it('is the gear menu’s built-in item, under the Print heading as “This record”', async () => {
    const host = await mount();
    const group = host.querySelector('.fd-record-menu [role="group"]') as HTMLElement;
    expect([...group.querySelectorAll('.fd-record-menu-item')].map((item) => item.textContent)).toEqual(['This record', 'Invoice PDF']);
    // Duplicate stays among the actions.
    expect(group.querySelector('[data-node="m-dup"]')).toBeNull();
  });

  it('prints with the page round it left out, and is done once the browser is', async () => {
    const host = await mount();
    const seen: unknown[] = [];
    // As Chrome prints: told before and after, inside print().
    jest.spyOn(window, 'print').mockImplementation(() => {
      window.dispatchEvent(new Event('beforeprint'));
      seen.push([document.documentElement.classList.contains('fd-print-one'), root(host).classList.contains('fd-print-this'), root(host).hasAttribute('data-fd-print'), words(host).length > 0]);
      window.dispatchEvent(new Event('afterprint'));
    });
    await handle?.print();
    expect(seen).toEqual([[true, true, true, true]]);
    expect(document.documentElement.classList.contains('fd-print-one')).toBe(false);
    expect(root(host).classList.contains('fd-print-this')).toBe(false);
    expect(words(host)).toEqual([]);
  });

  it('waits for the browser’s dialog where print() does not, and is ready even where the browser tells nothing', async () => {
    const host = await mount();
    // Told before, the dialog still open as print() returns: done at afterprint.
    jest.spyOn(window, 'print').mockImplementation(() => void window.dispatchEvent(new Event('beforeprint')));
    let done = false;
    const printing = handle?.print().then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    expect(root(host).classList.contains('fd-print-this')).toBe(true);
    window.dispatchEvent(new Event('afterprint'));
    await printing;
    expect(done).toBe(true);
    // Told nothing at all: laid out as print() is called, and done as it returns.
    let ready = false;
    jest.spyOn(window, 'print').mockImplementation(() => void (ready = root(host).hasAttribute('data-fd-print') && words(host).length > 0));
    await handle?.print();
    expect(ready).toBe(true);
    expect(root(host).hasAttribute('data-fd-print')).toBe(false);
  });

  it('is what the built-in item and a print step do', async () => {
    const host = await mount();
    const print = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    (host.querySelector('.fd-record-gear') as HTMLButtonElement).click();
    (host.querySelector('[data-node="m-print"]') as HTMLButtonElement).click();
    await until(() => print.mock.calls.length === 1);
    (host.querySelector('[data-node="b-print"]') as HTMLButtonElement).click();
    await until(() => print.mock.calls.length === 2);
  });
});

describe('the app’s own file', () => {
  let made = 0;
  const saved: { name: string; href: string }[] = [];
  beforeEach(() => {
    saved.length = 0;
    URL.createObjectURL = () => `blob:test/${++made}`;
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ name: this.download, href: this.getAttribute('href') ?? '' });
    });
  });

  it('a PDF is shown over the record in the browser’s viewer, with Download; closed, its bytes are let go of', async () => {
    const host = await mount({ onAction: () => ({ file: { name: 'INV_2026_0042.pdf', type: 'application/pdf', bytes: new Uint8Array([37, 80, 68, 70]) } }) });
    (host.querySelector('.fd-record-gear') as HTMLButtonElement).click();
    (host.querySelector('[data-node="m-pdf"]') as HTMLButtonElement).click();
    await until(() => host.querySelector('.fd-file-viewer'));
    const viewer = host.querySelector('.fd-file-viewer') as HTMLElement;
    expect(viewer.querySelector('h2')?.textContent).toBe('INV_2026_0042.pdf');
    const frame = viewer.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toMatch(/^blob:test\//);
    const download = viewer.querySelector('a.fd-button') as HTMLAnchorElement;
    expect(download.download).toBe('INV_2026_0042.pdf');
    (viewer.querySelector('.fd-dialog-close') as HTMLButtonElement).click();
    expect(host.querySelector('.fd-file-viewer')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(frame.getAttribute('src'));
  });

  it('is saved where the app says so, or where the browser shows no such file, by its address or its data', async () => {
    let answer: unknown = { file: { name: 'Invoice.pdf', url: 'https://erp.example/report/7.pdf', show: 'download' } };
    const host = await mount({ onAction: () => answer as never });
    const press = async () => {
      (host.querySelector('.fd-record-gear') as HTMLButtonElement).click();
      (host.querySelector('[data-node="m-pdf"]') as HTMLButtonElement).click();
    };
    await press();
    await until(() => saved.length === 1);
    expect(saved[0]).toEqual({ name: 'Invoice.pdf', href: 'https://erp.example/report/7.pdf' });
    answer = { file: { name: 'lines.csv', data: btoa('a,b\n1,2') } };
    await press();
    await until(() => saved.length === 2);
    expect(saved[1].name).toBe('lines.csv');
    expect(saved[1].href).toMatch(/^blob:test\//);
    expect(host.querySelector('.fd-file-viewer')).toBeNull();
  });
});
