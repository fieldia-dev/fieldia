import { createMemoryDataSource, type Page } from '@fieldia/core';
import { linesPart } from '@fieldia/widgets';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A record's footer on paper is its content's last part (print.ts), which the stylesheet makes the footer under every
 * sheet: still the last where the page is drawn only once its parts have come, after the footer was put in. This
 * file starts with no part loaded (src/test-parts.ts leaves it so).
 */

const page: Page = {
  fieldia: '0.10',
  id: 'visit',
  title: 'Visit',
  print: { footer: 'Bring this sheet to room {room}.' },
  data: { kind: 'record', model: 'visit' },
  fields: {
    room: { type: 'char', label: 'Room' },
    step_ids: { type: 'one2many', label: 'Steps', relation: 'visit.step', fields: { title: { type: 'char', label: 'Title' } } },
  },
  layout: { type: 'sheet', id: 'sheet', children: [{ type: 'field', id: 'f-room', field: 'room' }, { type: 'field', id: 'f-steps', field: 'step_ids' }] },
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

it('keeps the footer the content’s last part when the page is drawn once its parts come', async () => {
  expect(linesPart.loaded).toBeFalsy();
  const host = document.createElement('div');
  document.body.append(host);
  const steps = [{ key: 'a', values: { title: 'Sign in at the desk' } }];
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { visit: { 1: { room: 'B2', step_ids: steps } } } }), recordId: 1 });
  const content = host.querySelector('form.fd-form > .fd-content') as HTMLElement;
  // Waiting for the lines part: nothing of the page drawn yet, the footer in already.
  expect(content.querySelector('[data-field="step_ids"]')).toBeNull();
  expect(content.lastElementChild?.classList.contains('fd-print-end')).toBe(true);
  await handle.drawn;
  expect(content.querySelector('[data-field="step_ids"]')).not.toBeNull();
  expect(content.lastElementChild?.classList.contains('fd-print-end')).toBe(true);
  expect(content.querySelectorAll('.fd-print-end')).toHaveLength(1);
});

/**
 * Print on intent (0.26): the print part comes only as a person shows they mean to print. Each test below starts from
 * a copy of the viewer of its own (`jest.isolateModules`), the print part not in, as a page no one printed yet.
 */
type Fresh = { mountViewer: typeof mountViewer; printPart: typeof import('./print').printPart };
function fresh(): Fresh {
  let made: Fresh | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    made = { mountViewer: require('./viewer').mountViewer, printPart: require('./print').printPart };
  });
  return made as Fresh;
}

const invoice: Page = {
  fieldia: '0.10',
  id: 'invoice',
  title: 'Invoice',
  data: { kind: 'record', model: 'invoice' },
  fields: { name: { type: 'char', label: 'Number' }, note: { type: 'text', label: 'Terms' } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    toolbar: { menu: [{ id: 'm-print', builtin: 'print' }] },
    buttons: [{ type: 'button', id: 'b-print', label: 'Print it', steps: [{ do: 'print' }] }],
    children: [
      {
        type: 'tabs',
        id: 'tabs',
        children: [
          { type: 'tab', id: 't-main', label: 'Details', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
          { type: 'tab', id: 't-terms', label: 'Terms', children: [{ type: 'field', id: 'f-note', field: 'note' }] },
        ],
      },
    ],
  },
};
const invoices = () => createMemoryDataSource({ records: { invoice: { 1: { name: 'INV/1', note: 'Within 30 days.' } } } });
const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check: () => unknown) {
  for (let waited = 0; !check(); waited += 10) {
    if (waited >= 3000) throw new Error(`Waited three seconds, and it never held: ${check.toString()}`);
    await tick();
  }
}
async function mountFresh(page: Page = invoice) {
  const viewer = fresh();
  const host = document.createElement('div');
  document.body.append(host);
  handle = viewer.mountViewer(host, { page, dataSource: invoices(), recordId: 1 });
  await until(() => handle?.form.getState().status === 'ready');
  const form = host.querySelector('form.fd-form') as HTMLElement;
  const terms = () => host.querySelector('.fd-tabpanel[data-fd-tab="Terms"] [data-field="note"]');
  return { ...viewer, host, form, terms };
}
const ctrlP = () => {
  const press = new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', ctrlKey: true, bubbles: true, cancelable: true });
  document.body.dispatchEvent(press);
  return press.defaultPrevented;
};

describe('on paper, the print part on intent', () => {
  afterEach(() => jest.restoreAllMocks());

  it('a page no one prints asks for none of it: its printout’s head is drawn hidden all the same', async () => {
    const { printPart, host } = await mountFresh({ ...invoice, print: { header: 'Zamalek Office Supplies' } as Page['print'], layout: { ...invoice.layout, toolbar: undefined, buttons: [] } as Page['layout'] });
    // Its page has words for paper: the part fetched once drawn, the browser idle (a second, where it says nothing of idle).
    expect(host.querySelector('.fd-print-head .fd-print-words .fd-print-line')?.textContent).toBe('Zamalek Office Supplies');
    expect(printPart.loaded).toBeUndefined();
    await until(() => printPart.loaded);
    handle?.destroy();
    handle = null;
    const plain = await mountFresh({ ...invoice, layout: { ...invoice.layout, toolbar: undefined, buttons: [] } as Page['layout'] });
    await tick(1200);
    expect(plain.printPart.loaded).toBeUndefined();
    expect(plain.host.querySelector('.fd-print-head[aria-hidden="true"] .fd-print-title')).not.toBeNull();
  });

  it('the browser’s own print before it came prints the page as it is, and asks for it: the next print whole', async () => {
    const { printPart, form, terms } = await mountFresh();
    // (Put in by an earlier test's copy of the part: this page has had none.)
    document.getElementById('fieldia-print-styles')?.remove();
    window.dispatchEvent(new Event('beforeprint'));
    expect(form.hasAttribute('data-fd-print')).toBe(false);
    expect(terms()).toBeNull();
    // Come while that print is under way: it keeps the look it began with to its end — no look made, no sheet put in.
    await until(() => printPart.loaded);
    await tick(20);
    expect(form.hasAttribute('data-fd-print')).toBe(false);
    expect(document.getElementById('fieldia-print-styles')).toBeNull();
    window.dispatchEvent(new Event('afterprint'));
    expect(document.getElementById('fieldia-print-styles')).not.toBeNull();
    // Come: nothing laid out until a print begins; then every tab drawn, each box written as its words.
    expect(form.hasAttribute('data-fd-print')).toBe(false);
    window.dispatchEvent(new Event('beforeprint'));
    expect(form.hasAttribute('data-fd-print')).toBe(true);
    expect(terms()).not.toBeNull();
    window.dispatchEvent(new Event('afterprint'));
    expect(form.hasAttribute('data-fd-print')).toBe(false);
  });

  it('Ctrl+P before it came is held back while it comes, then prints the page whole; once in, at once, in the press', async () => {
    const { printPart, form, terms } = await mountFresh();
    const seen: boolean[] = [];
    const print = jest.spyOn(window, 'print').mockImplementation(() => {
      window.dispatchEvent(new Event('beforeprint'));
      seen.push(form.hasAttribute('data-fd-print') && terms() !== null);
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(ctrlP()).toBe(true);
    // A second press while it comes prints once.
    expect(ctrlP()).toBe(true);
    await until(() => print.mock.calls.length);
    await tick(50);
    expect(seen).toEqual([true]);
    expect(printPart.loaded).toBeDefined();
    expect(form.hasAttribute('data-fd-print')).toBe(false);
    expect(ctrlP()).toBe(true);
    expect(seen).toEqual([true, true]);
    // Where the browser tells nothing as it prints: laid out all the same, and put back as print() returns.
    print.mockImplementation(() => void seen.push(form.hasAttribute('data-fd-print') && terms() !== null));
    expect(ctrlP()).toBe(true);
    expect(seen).toEqual([true, true, true]);
    expect(form.hasAttribute('data-fd-print')).toBe(false);
  });

  it('Ctrl+P an app’s own keys took, or with Shift or Alt, is let be', async () => {
    const { printPart } = await mountFresh();
    const own = (event: KeyboardEvent) => event.preventDefault();
    document.body.addEventListener('keydown', own);
    ctrlP();
    document.body.removeEventListener('keydown', own);
    const shifted = new KeyboardEvent('keydown', { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(shifted);
    expect(shifted.defaultPrevented).toBe(false);
    await tick(50);
    expect(printPart.loaded).toBeUndefined();
    // ⌘P, and an Arabic keyboard's ح on P's key, are Ctrl+P.
    const arabic = new KeyboardEvent('keydown', { key: 'ح', code: 'KeyP', metaKey: true, bubbles: true, cancelable: true });
    jest.spyOn(window, 'print').mockImplementation(() => undefined);
    document.body.dispatchEvent(arabic);
    expect(arabic.defaultPrevented).toBe(true);
  });

  it('the gear opened with its Print fetches it, and prints nothing; its Print waits for it and prints this record alone', async () => {
    const { printPart, host, form } = await mountFresh();
    const print = jest.spyOn(window, 'print').mockImplementation(() => {
      window.dispatchEvent(new Event('beforeprint'));
      expect(document.documentElement.classList.contains('fd-print-one')).toBe(true);
      expect(form.hasAttribute('data-fd-print')).toBe(true);
      window.dispatchEvent(new Event('afterprint'));
    });
    (host.querySelector('.fd-record-gear') as HTMLButtonElement).click();
    await until(() => printPart.loaded);
    expect(print).not.toHaveBeenCalled();
    expect(form.hasAttribute('data-fd-print')).toBe(false);
    (host.querySelector('[data-node="m-print"]') as HTMLButtonElement).click();
    await until(() => print.mock.calls.length === 1);
  });

  it('a pointer resting on a button that prints fetches it; its press waits for it', async () => {
    const { printPart, host } = await mountFresh();
    const print = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    const button = host.querySelector('[data-node="b-print"]') as HTMLButtonElement;
    // Passed over: nothing.
    button.dispatchEvent(new Event('pointerenter'));
    button.dispatchEvent(new Event('pointerleave'));
    await tick(200);
    expect(printPart.loaded).toBeUndefined();
    button.dispatchEvent(new Event('pointerenter'));
    await until(() => printPart.loaded);
    expect(print).not.toHaveBeenCalled();
    button.click();
    await until(() => print.mock.calls.length === 1);
  });

  it('viewer.print() before it came waits for it, then prints this form alone, the page round it left out', async () => {
    const { printPart, form } = await mountFresh();
    const seen: boolean[] = [];
    jest.spyOn(window, 'print').mockImplementation(() => {
      window.dispatchEvent(new Event('beforeprint'));
      seen.push(form.classList.contains('fd-print-this') && form.hasAttribute('data-fd-print'));
      window.dispatchEvent(new Event('afterprint'));
    });
    await handle?.print();
    expect(printPart.loaded).toBeDefined();
    expect(seen).toEqual([true]);
    expect(form.classList.contains('fd-print-this')).toBe(false);
  });
});
