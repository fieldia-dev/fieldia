import { createMemoryDataSource, type Page } from '@fieldia/core';
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
  fieldia: '0.3',
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
    expect(head.querySelector('.fd-print-words')?.textContent).toBe('Zamalek Office Supplies\nCairo');
    window.dispatchEvent(new Event('beforeprint'));
    expect(head.querySelector('.fd-print-title')?.textContent).toBe('Invoice · INV/2026/0042');
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
