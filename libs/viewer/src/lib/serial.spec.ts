import { createMemoryDataSource, type ActionResult, type DataSource, type Page, type SaveRequest, type UploadFile, type UploadRequest, type UploadedFile, type Values } from '@fieldia/core';
import { openFormDialog, type FormDialogResult } from './dialog';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * Round 5 of save safety in the viewer (docs/plans/wave1-contract.md, section
 * 10): the blocking probes of round 4's review, each a test. A way out taken
 * while a save is on its way waits for it — the page saying so — then checks
 * the record as it is now, so the save's answer never lands on another
 * record; a page in place, a dialog and the edit switch count the work done
 * while they wait, a file landing after a save among it; and the app's own
 * breadcrumbs inside a page in place go through the record under it too.
 */

const fields: Page['fields'] = {
  name: { type: 'char', label: 'Name', required: true },
  phone: { type: 'char', label: 'Phone' },
  budget: { type: 'float', label: 'Budget' },
  doc: { type: 'binary', label: 'Deed' },
};
const main = (id: string): Extract<Page['layout'], { type: 'sheet' }>['children'] => [
  {
    type: 'section',
    id: `${id}-main`,
    children: [
      { type: 'field', id: 'f-phone', field: 'phone' },
      { type: 'field', id: 'f-budget', field: 'budget' },
      { type: 'field', id: 'f-doc', field: 'doc' },
    ],
  },
];
const leadWith = (buttons: NonNullable<Extract<Page['layout'], { type: 'sheet' }>['buttons']>, id = 'lead'): Page => ({
  fieldia: '0.1',
  id,
  title: 'Lead',
  data: { kind: 'record', model: 'lead' },
  fields,
  layout: { type: 'sheet', id: 'sheet', title: { field: 'name' }, buttons, children: main(id) },
});
const other = leadWith([], 'lead-other');

const leads = (): Record<string, Values> => ({
  1: { name: 'Villa in Sheikh Zayed', phone: '+201001234567', budget: 4000000, doc: null },
  2: { name: 'Flat in Maadi', phone: '+201112223334', budget: 2500000, doc: null },
});

/** A memory source whose next save, or upload, a test holds on its way until it lets it go. 0.20's members, and upload. */
function heldSource() {
  const memory = createMemoryDataSource({ records: { lead: leads() } });
  const held: Record<'save' | 'upload', (() => void)[]> = { save: [], upload: [] };
  const holding = { save: 0, upload: 0 };
  async function gate(method: 'save' | 'upload') {
    if (!holding[method]) return;
    holding[method]--;
    await new Promise<void>((resolve) => held[method].push(resolve));
  }
  let files = 0;
  const source: DataSource & { records: Record<string, Record<string, Values>> } = {
    ...memory,
    records: memory.records,
    async save(request: SaveRequest) {
      await gate('save');
      return memory.save(request);
    },
    async upload(file: UploadFile, request: UploadRequest): Promise<UploadedFile> {
      void request;
      await gate('upload');
      return { url: `https://files.example/${file.name}`, name: file.name, size: file.size, type: file.type, fileId: ++files };
    },
  };
  return {
    source,
    hold: (method: 'save' | 'upload' = 'save') => void holding[method]++,
    held: (method: 'save' | 'upload' = 'save') => until(() => held[method].length > 0),
    release: (method: 'save' | 'upload' = 'save') => held[method].shift()?.(),
  };
}
type Held = ReturnType<typeof heldSource>;

const handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.replaceChildren();
});

async function mount(ds: Held, options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const handle = mountViewer(host, { page: leadWith([]), dataSource: ds.source, recordId: 1, pages: { 'lead-other': other }, ...options });
  handles.push(handle);
  await handle.form.settled();
  return { host, handle };
}

const input = (scope: Element, field: string) => scope.querySelector(`[data-field="${field}"] input:not([type="file"])`) as HTMLInputElement;
const type = (scope: Element, field: string, value: string) => {
  const box = input(scope, field);
  box.value = value;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
};
const ctrlEnter = (scope: Element, field = 'phone') => input(scope, field).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
const pick = (scope: Element, name = 'deed.pdf') => {
  const box = scope.querySelector('[data-field="doc"] input[type=file]') as HTMLInputElement;
  Object.defineProperty(box, 'files', { value: [new File([new Uint8Array(4)], name, { type: 'application/pdf' })], configurable: true });
  box.dispatchEvent(new Event('change', { bubbles: true }));
};
const button = (scope: Element, words: string) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === words && !b.hidden && !b.closest('[hidden]')) as HTMLButtonElement;
const question = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null;
const answer = (words: 'Cancel' | 'Discard') => button(question() as HTMLElement, words).click();
const pause = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
const status = (scope: Element) => scope.querySelector('.fd-status')?.textContent ?? '';
/** The page shown: a page in place hides the one under it. */
const shown = (host: Element) => [...host.querySelectorAll<HTMLElement>('form.fd-form')].filter((form) => !form.hidden).pop() as HTMLElement;

/** Asked "Discard your changes?", the focus on Cancel. */
async function asked() {
  await until(() => question());
  expect(question()?.textContent).toContain('Discard your changes?');
  expect(document.activeElement?.textContent).toBe('Cancel');
}

describe('round 4 #1: a way out taken while a save is on its way (c-race, i-race-keys, b-during)', () => {
  const ways: [string, Partial<ViewerOptions>][] = [
    ['an action answering { record: 2 }', { onAction: (): ActionResult => ({ record: 2 }) }],
    ['a reload step', {}],
  ];
  for (const [name, more] of ways) {
    const steps = name.startsWith('an action') ? [{ do: 'call' as const, action: 'go_rec' }] : [{ do: 'reload' as const }];
    it(`${name}, the budget typed during the save: waits, saying so; asked once it landed; Cancel keeps record 1, and Ctrl+Enter saves only its own values`, async () => {
      const ds = heldSource();
      const { host, handle } = await mount(ds, { page: leadWith([{ type: 'button', id: 'go', label: 'Go now', steps }]), ...more });
      type(host, 'phone', '+201009998887');
      ds.hold();
      ctrlEnter(host);
      await ds.held();
      type(host, 'budget', '4300000');
      button(host, 'Go now').click();
      await pause();
      expect(question()).toBeNull();
      expect(status(host)).toBe('Waiting for the save to finish…');
      ds.release();
      await asked();
      answer('Cancel');
      await until(() => !question());
      await pause();
      expect(handle.form.getState()).toMatchObject({ recordId: 1, unsent: ['budget'] });
      expect(input(host, 'name').value).toBe('Villa in Sheikh Zayed');
      expect(handle.form.getState().values['budget']).toBe(4300000);
      expect(ds.source.records['lead'][1]).toMatchObject({ phone: '+201009998887', budget: 4000000 });
      expect(status(host)).toBe('Saved, but not all your changes.');
      ctrlEnter(host, 'budget');
      await until(() => handle.form.getState().unsent.length === 0 && handle.form.getState().status === 'saved');
      expect(ds.source.records['lead'][1]).toMatchObject({ name: 'Villa in Sheikh Zayed', phone: '+201009998887', budget: 4300000 });
      expect(ds.source.records['lead'][2]).toMatchObject({ name: 'Flat in Maadi', phone: '+201112223334', budget: 2500000 });
    });

    it(`${name}, nothing typed during the save: record 1 saved as it was, then the way out goes, unasked`, async () => {
      const ds = heldSource();
      const { host, handle } = await mount(ds, { page: leadWith([{ type: 'button', id: 'go', label: 'Go now', steps }]), ...more });
      type(host, 'phone', '+201009998887');
      ds.hold();
      ctrlEnter(host);
      await ds.held();
      button(host, 'Go now').click();
      await pause();
      ds.release();
      await until(() => handle.form.getState().status === 'ready' && !handle.form.getState().leaving);
      await handle.form.settled();
      expect(question()).toBeNull();
      expect(handle.form.getState().dirty).toEqual([]);
      expect(ds.source.records['lead'][1]).toMatchObject({ name: 'Villa in Sheikh Zayed', phone: '+201009998887' });
      // What is shown now is what is stored: saving it again writes nothing of one record over another.
      ctrlEnter(host);
      await handle.form.settled();
      expect(ds.source.records['lead'][1]).toMatchObject({ name: 'Villa in Sheikh Zayed', phone: '+201009998887' });
      expect(ds.source.records['lead'][2]).toMatchObject({ name: 'Flat in Maadi', phone: '+201112223334' });
    });
  }
});

describe('the pager: its save first, then the check, then the record', () => {
  it('Next with the budget typed during its own save: asked; Cancel keeps record 1 and the pager’s place', async () => {
    const ds = heldSource();
    const { host, handle } = await mount(ds, { records: { total: 2, at: 0, id: (at) => at + 1 } });
    const text = () => host.querySelector('.fd-record-pager-text')?.textContent;
    expect(text()).toBe('1 / 2');
    type(host, 'phone', '+201009998887');
    ds.hold();
    (host.querySelectorAll<HTMLButtonElement>('.fd-record-pager button')[1] as HTMLButtonElement).click();
    await ds.held();
    type(host, 'budget', '4300000');
    ds.release();
    await asked();
    answer('Cancel');
    await pause();
    expect(handle.form.getState()).toMatchObject({ recordId: 1, unsent: ['budget'] });
    // Drawn again as the person goes on: still record 1 of 2.
    type(host, 'phone', '+201000000001');
    expect(text()).toBe('1 / 2');
    expect((host.querySelector('.fd-record-pager') as HTMLElement).hidden).toBe(false);
  });
});

describe('round 4 #2: a page opened in place counts the work done while it waits to give way (f-uploads)', () => {
  const opening = leadWith([{ type: 'button', id: 'open', label: 'Open other', steps: [{ do: 'open', page: 'lead-other', as: 'page', record: '2' }] }]);

  async function inPlace() {
    const ds = heldSource();
    const mounted = await mount(ds, { page: opening });
    button(mounted.host, 'Open other').click();
    await until(() => input(shown(mounted.host), 'name')?.value === 'Flat in Maadi');
    const inner = shown(mounted.host);
    type(inner, 'phone', '+201110000000');
    ds.hold();
    ctrlEnter(inner);
    await ds.held();
    ds.hold('upload');
    pick(inner);
    await ds.held('upload');
    ds.release();
    await pause();
    return { ds, ...mounted, inner };
  }

  it('a file picked during its save, landing after it: asked before going back; Cancel stays, and its next save takes the file', async () => {
    const { ds, host, inner } = await inPlace();
    expect(inner.isConnected && !inner.hidden).toBe(true);
    expect(question()).toBeNull();
    ds.release('upload');
    await asked();
    answer('Cancel');
    await pause();
    expect(shown(host)).toBe(inner);
    ctrlEnter(inner);
    await until(() => shown(host) !== inner);
    expect(ds.source.records['lead'][2]['doc']).toMatchObject({ name: 'deed.pdf' });
  });

  it('typed while it waits for that file: asked, and the budget kept on Cancel', async () => {
    const { ds, host, inner } = await inPlace();
    type(inner, 'budget', '2600000');
    ds.release('upload');
    await asked();
    answer('Cancel');
    await pause();
    expect(shown(host)).toBe(inner);
    expect(input(inner, 'budget').value).toBe('2,600,000.00');
    expect(ds.source.records['lead'][2]['budget']).toBe(2500000);
  });
});

describe('round 4 #3: a file picked during a save, landing after it, is the person’s work (f-uploads)', () => {
  it('a dialog: Save & Close asks; after Cancel the file lands; Escape asks again; Discard closes saved, the stored record as saved', async () => {
    const ds = heldSource();
    let ended: FormDialogResult | null = null;
    void openFormDialog({ page: leadWith([]), dataSource: ds.source, recordId: 1, title: 'Lead' }).then((result) => (ended = result));
    await until(() => input(document.querySelector('.fd-form-dialog') ?? document.body, 'phone')?.value);
    const box = document.querySelector('.fd-form-dialog') as HTMLElement;
    type(box, 'phone', '+201009998887');
    ds.hold();
    button(box, 'Save & Close').click();
    await ds.held();
    ds.hold('upload');
    pick(box);
    await ds.held('upload');
    ds.release();
    await pause();
    // Waiting for the file, and saying so at its foot.
    expect((box.querySelector('.fd-dialog-waiting') as HTMLElement).textContent).toBe('1 file still uploading. Waiting for it to finish.');
    ds.release('upload');
    await asked();
    answer('Cancel');
    await pause();
    expect(ended).toBeNull();
    input(box, 'phone').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await asked();
    answer('Discard');
    await until(() => ended);
    expect(ended).toMatchObject({ saved: true, recordId: 1 });
    expect(ds.source.records['lead'][1]).toMatchObject({ phone: '+201009998887', doc: null });
  });
});

describe('round 4 #4: the app’s breadcrumbs inside a page in place go through the record under it too (g-related)', () => {
  it('the outer record’s budget typed during its [save, open as page]: the inner crumb “Leads” asks; Cancel stays; Discard goes', async () => {
    const ds = heldSource();
    const back = jest.fn();
    const { host, handle } = await mount(ds, {
      page: leadWith([{ type: 'button', id: 'open', label: 'Open other', steps: [{ do: 'save' }, { do: 'open', page: 'lead-other', as: 'page', record: '2' }] }]),
      breadcrumbs: [{ label: 'Leads', open: back }],
    });
    type(host, 'phone', '+201009998887');
    ds.hold();
    button(host, 'Open other').click();
    await ds.held();
    type(host, 'budget', '4300000');
    ds.release();
    await until(() => input(shown(host), 'name')?.value === 'Flat in Maadi');
    expect(handle.form.getState().unsent).toEqual(['budget']);
    const inner = shown(host);
    button(inner.querySelector('.fd-breadcrumbs') as HTMLElement, 'Leads').click();
    await asked();
    answer('Cancel');
    await pause();
    expect(back).not.toHaveBeenCalled();
    button(inner.querySelector('.fd-breadcrumbs') as HTMLElement, 'Leads').click();
    await asked();
    answer('Discard');
    await until(() => back.mock.calls.length);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('nothing at risk anywhere: the crumb goes at once, as in 0.20', async () => {
    const ds = heldSource();
    const back = jest.fn();
    const { host } = await mount(ds, { page: leadWith([{ type: 'button', id: 'open', label: 'Open other', steps: [{ do: 'open', page: 'lead-other', as: 'page', record: '2' }] }]), breadcrumbs: [{ label: 'Leads', open: back }] });
    button(host, 'Open other').click();
    await until(() => input(shown(host), 'name')?.value === 'Flat in Maadi');
    button(shown(host).querySelector('.fd-breadcrumbs') as HTMLElement, 'Leads').click();
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('round 4 #5: the edit switch’s Done never locks with work at risk, and says so (f-uploads)', () => {
  it('a file still uploading: Done saves it once it lands, then locks; nothing is left at risk', async () => {
    const ds = heldSource();
    const { host, handle } = await mount(ds, { editSwitch: true, breadcrumbs: [{ label: 'Leads', open: jest.fn() }] });
    ds.hold('upload');
    pick(host);
    await ds.held('upload');
    const done = host.querySelector('.fd-edit-switch') as HTMLButtonElement;
    done.click();
    await pause();
    expect(handle.isReadonly()).toBe(false);
    expect(status(host)).toBe('1 file still uploading. Saving when it is done.');
    ds.release('upload');
    await until(() => handle.isReadonly());
    expect(ds.source.records['lead'][1]['doc']).toMatchObject({ name: 'deed.pdf' });
    expect(handle.form.getState()).toMatchObject({ unsent: [], dirty: [] });
  });

  it('typed while Done’s save was on its way: stays editable, and says not all was saved', async () => {
    const ds = heldSource();
    const { host, handle } = await mount(ds, { editSwitch: true });
    type(host, 'phone', '+201009998887');
    ds.hold();
    (host.querySelector('.fd-edit-switch') as HTMLButtonElement).click();
    await ds.held();
    type(host, 'budget', '4300000');
    ds.release();
    await until(() => (host.querySelector('.fd-announce') as HTMLElement).textContent);
    expect(handle.isReadonly()).toBe(false);
    expect(host.querySelector('.fd-announce')?.textContent).toBe('Saved, but not all your changes.');
  });
});

describe('a dialog’s Discard during a save waits for it: the record it made is the caller’s', () => {
  it('a new lead: Save & Close held, Discard pressed meanwhile — closed saved, with its id, nothing asked', async () => {
    const ds = heldSource();
    let ended: FormDialogResult | null = null;
    void openFormDialog({ page: leadWith([]), dataSource: ds.source, recordId: null, title: 'Lead' }).then((result) => (ended = result));
    await until(() => input(document.querySelector('.fd-form-dialog') ?? document.body, 'name'));
    const box = document.querySelector('.fd-form-dialog') as HTMLElement;
    type(box, 'name', 'Plot in New Cairo');
    ds.hold();
    button(box, 'Save & Close').click();
    await ds.held();
    button(box, 'Discard').click();
    await pause();
    expect(ended).toBeNull();
    ds.release();
    await until(() => ended);
    expect(question()).toBeNull();
    expect(ended).toMatchObject({ saved: true, recordId: 3 });
  });

  it('Escape during Save & Close waits for the save, then closes saved, nothing asked', async () => {
    const ds = heldSource();
    let ended: FormDialogResult | null = null;
    void openFormDialog({ page: leadWith([]), dataSource: ds.source, recordId: 1, title: 'Lead' }).then((result) => (ended = result));
    await until(() => input(document.querySelector('.fd-form-dialog') ?? document.body, 'phone')?.value);
    const box = document.querySelector('.fd-form-dialog') as HTMLElement;
    type(box, 'phone', '+201009998887');
    ds.hold();
    button(box, 'Save & Close').click();
    await ds.held();
    input(box, 'phone').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await pause();
    expect(ended).toBeNull();
    expect((box.querySelector('.fd-dialog-waiting') as HTMLElement).textContent).toBe('Waiting for the save to finish…');
    ds.release();
    await until(() => ended);
    expect(question()).toBeNull();
    expect(ended).toMatchObject({ saved: true, recordId: 1 });
    expect(ds.source.records['lead'][1]).toMatchObject({ phone: '+201009998887' });
  });
});
