import { createMemoryDataSource, type DataSource, type Page, type Values } from '@fieldia/core';
import { openFormDialog, type FormDialogResult } from './dialog';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * The viewer's side of answers that come late and ways out that lose work: the pager told of a record deleted once
 * it had moved on; a dialog that saved, then let a change go, handing back the record as saved; a dialog of values
 * (a line's own form) asking before Escape drops what was typed in it; the browser's own ways out (`warnOnLeave`).
 */

const lead: Page = {
  fieldia: '0.1',
  id: 'lead',
  title: 'Lead',
  data: { kind: 'record', model: 'lead' },
  fields: {
    name: { type: 'char', label: 'Name', required: true },
    phone: { type: 'char', label: 'Phone' },
    budget: { type: 'float', label: 'Budget' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    children: [
      {
        type: 'section',
        id: 'main',
        children: [
          { type: 'field', id: 'f-phone', field: 'phone' },
          { type: 'field', id: 'f-budget', field: 'budget' },
        ],
      },
    ],
  },
};

const leads = (): Record<string, Values> => ({
  1: { name: 'Villa in Sheikh Zayed', phone: '+201001234567', budget: 4000000 },
  2: { name: 'Flat in Maadi', phone: '+201112223334', budget: 2500000 },
  3: { name: 'Studio in Zamalek', phone: '+201223334445', budget: 1800000 },
});
const source = (delayMs = 0) => createMemoryDataSource({ records: { lead: leads() }, delayMs });

const handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const handle = mountViewer(host, { page: lead, dataSource: source(), recordId: 1, ...options });
  handles.push(handle);
  await handle.form.settled();
  return { host, handle };
}

const input = (scope: Element, field: string) => scope.querySelector(`[data-field="${field}"] input`) as HTMLInputElement;
const type = (scope: Element, field: string, value: string) => {
  const box = input(scope, field);
  box.value = value;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
};
const button = (scope: Element, words: string) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === words && !b.hidden && !b.closest('[hidden]')) as HTMLButtonElement;
const question = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null;
const answer = (words: 'Cancel' | 'Discard') => button(question() as HTMLElement, words).click();
const pause = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
const box = () => document.querySelector('.fd-form-dialog') as HTMLElement | null;
const escape = () => box()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

describe('the pager told of a record deleted once it had moved on', () => {
  it('counts one fewer, and stays on the record shown with what was typed in it', async () => {
    const ds = source();
    let deleted!: () => void;
    const remove = ds.delete.bind(ds) as NonNullable<DataSource['delete']>;
    (ds as DataSource).delete = async (request) => {
      await new Promise<void>((go) => (deleted = go));
      return remove(request);
    };
    const { host, handle } = await mount({ dataSource: ds, records: [1, 2, 3] });
    const run = handle.form.run([{ do: 'delete' }]);
    await until(() => deleted);
    expect(await handle.form.openRecord(2)).toBe(true);
    type(host, 'phone', '+201110000000');
    deleted();
    await run;
    await handle.form.settled();
    await pause();
    expect(handle.form.getState()).toMatchObject({ recordId: 2, dirty: ['phone'] });
    expect(input(host, 'phone').value).toBe('+201110000000');
    expect(host.querySelector('.fd-record-pager-text')?.textContent).toBe('1 / 2');
  });
});

describe('a dialog that saved, then let a change go', () => {
  it('hands back the record as saved, never the change let go', async () => {
    const ds = source(30);
    let ended: FormDialogResult | null = null;
    void openFormDialog({ page: lead, dataSource: ds, recordId: 1, title: 'Lead' }).then((result) => (ended = result));
    await until(() => input(box() ?? document.body, 'phone')?.value === '+201001234567');
    type(box() as HTMLElement, 'phone', '+201009998887');
    button(box() as HTMLElement, 'Save & Close').click();
    await until(() => ds.calls.some((call) => call.method === 'save'));
    type(box() as HTMLElement, 'budget', '4300000');
    await until(() => question());
    answer('Discard');
    await until(() => ended);
    expect(ds.records['lead'][1]).toMatchObject({ phone: '+201009998887', budget: 4000000 });
    expect(ended).toMatchObject({ saved: true, recordId: 1, values: { phone: '+201009998887', budget: 4000000 } });
  });
});

describe('a dialog of values — a line’s own form — and its Escape', () => {
  const line: Page = { ...lead, id: 'line', data: { kind: 'responses' } };

  it('asks before what was typed in it goes: Cancel keeps it open with the change, Discard closes it unsaved', async () => {
    let ended: FormDialogResult | null = null;
    void openFormDialog({ page: line, title: 'Line', mode: 'values', values: { phone: '+201001234567', budget: 2 } }).then((result) => (ended = result));
    await until(() => input(box() ?? document.body, 'budget'));
    type(box() as HTMLElement, 'budget', '5');
    escape();
    await until(() => question());
    expect(question()?.textContent).toContain('Discard your changes?');
    expect(document.activeElement?.textContent).toBe('Cancel');
    answer('Cancel');
    await pause();
    expect(box()).not.toBeNull();
    expect(input(box() as HTMLElement, 'budget').value).toBe('5.00');
    escape();
    await until(() => question());
    answer('Discard');
    await until(() => ended);
    expect(ended).toMatchObject({ saved: false });
  });

  it('with nothing typed, Escape closes it at once, as always', async () => {
    let ended: FormDialogResult | null = null;
    void openFormDialog({ page: line, title: 'Line', mode: 'values', values: { phone: '+201001234567', budget: 2 } }).then((result) => (ended = result));
    await until(() => input(box() ?? document.body, 'budget'));
    escape();
    await until(() => ended);
    expect(question()).toBeNull();
    expect(ended).toMatchObject({ saved: false });
  });
});

describe('the browser’s own ways out (`warnOnLeave`)', () => {
  /** The browser leaving the page: whether something asked first. */
  const leaving = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it('asks while a change is not saved — before the record’s first save too — and not once it is saved, nor once the viewer is gone', async () => {
    const { host, handle } = await mount({ warnOnLeave: true });
    expect(leaving()).toBe(false);
    type(host, 'phone', '+201009998887');
    expect(leaving()).toBe(true);
    expect(await handle.form.save()).toBe(true);
    expect(leaving()).toBe(false);
    type(host, 'budget', '4300000');
    expect(leaving()).toBe(true);
    handle.destroy();
    expect(leaving()).toBe(false);
  });

  it('off unless asked for, as in 0.20: a change not saved asks nothing', async () => {
    const { host } = await mount();
    type(host, 'phone', '+201009998887');
    expect(leaving()).toBe(false);
  });
});
