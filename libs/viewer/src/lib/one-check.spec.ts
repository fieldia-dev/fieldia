import { createMemoryDataSource, type ActionStep, type MemoryDataSourceOptions, type Page, type RecordId, type Values } from '@fieldia/core';
import { openFormDialog, openFormPanel, type FormDialogResult } from './dialog';
import { pageDialogs } from './related';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * The viewer's ways out, each through the form's one check (`form.leave()`,
 * docs/plans/wave1-contract.md section 10): the pager, the breadcrumbs, a
 * dialog's and a panel's every exit, a page in this one's place, the app's
 * own close, a reload. And a save that went through is reported as saved by
 * every later exit of the dialog or page it was made in.
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
    ref: { type: 'char', label: 'Reference' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    buttons: [
      { type: 'button', id: 'done', label: 'Save and close', steps: [{ do: 'save' }, { do: 'close' }] },
      { type: 'button', id: 'other', label: 'Open the other', steps: [{ do: 'open', page: 'lead-other', as: 'page', record: '2' }] },
    ],
    children: [
      {
        type: 'section',
        id: 'main',
        children: [
          { type: 'field', id: 'f-name', field: 'name' },
          { type: 'field', id: 'f-phone', field: 'phone' },
          { type: 'field', id: 'f-budget', field: 'budget' },
        ],
      },
    ],
  },
};
const sheet = lead.layout as Extract<Page['layout'], { type: 'sheet' }>;
/** The same lead, its afterSave steps setting a value: the page's own, never the person's. */
const settingAfterSave: Page = { ...lead, on: { afterSave: [{ do: 'set', field: 'ref', value: "'R-1'" }] } };
const other: Page = { ...lead, id: 'lead-other', layout: { ...sheet, buttons: [] } };

const leads = (): Record<string, Values> => ({
  1: { name: 'Villa in Sheikh Zayed', phone: '+201001234567', budget: 4000000, ref: '' },
  2: { name: 'Flat in Maadi', phone: '+201112223334', budget: 2500000, ref: '' },
});
/** A plain memory source: no versions, nothing but what 0.20 had in use; slow when asked to be. */
const source = (more: MemoryDataSourceOptions = {}) => createMemoryDataSource({ records: { lead: leads() }, ...more });
type Source = ReturnType<typeof source>;

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

const input = (scope: Element, field: string) => scope.querySelector(`[data-field="${field}"] :is(input, textarea)`) as HTMLInputElement;
const type = (scope: Element, field: string, value: string) => {
  const box = input(scope, field);
  box.value = value;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
};
const button = (scope: Element, words: string) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === words && !b.hidden && !b.closest('[hidden]')) as HTMLButtonElement;
const question = (scope: Element = document.body) => scope.querySelector('[role="alertdialog"]') as HTMLElement | null;
const answer = (words: 'Cancel' | 'Discard', scope: Element = document.body) => button(question(scope) as HTMLElement, words).click();
const pause = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
const boxOf = () => document.querySelector('.fd-form-dialog') as HTMLElement;
const saves = (ds: Source) => ds.calls.filter((call) => call.method === 'save').length;

/** Asked "Discard your changes?", the focus on Cancel. */
async function asked(scope: Element = document.body) {
  await until(() => question(scope));
  expect(question(scope)?.textContent).toContain('Discard your changes?');
  expect(document.activeElement?.textContent).toBe('Cancel');
}

/** Type while the save is on its way: the source asked, not answered yet. */
async function typeWhileSaving(ds: Source, scope: Element, field = 'budget', value = '4300000') {
  const before = saves(ds);
  await until(() => saves(ds) > before);
  expect(saves(ds)).toBe(before + 1);
  type(scope, field, value);
}

/** A record at risk in the viewer: the budget typed while a save of the phone was on its way. */
async function atRisk(options: Partial<ViewerOptions> = {}) {
  const ds = source({ delayMs: 30 });
  const mounted = await mount({ dataSource: ds, ...options });
  type(mounted.host, 'phone', '+201009998887');
  const saving = mounted.handle.save();
  await typeWhileSaving(ds, mounted.host);
  expect(await saving).toBe(true);
  expect(mounted.handle.form.getState().unsent).toEqual(['budget']);
  return { ds, ...mounted };
}

describe('the record’s own ways out, through the one check', () => {
  it('the pager whose next id is looked up: a change typed meanwhile is saved with the rest, never dropped', async () => {
    const ds = source();
    let found!: (id: RecordId) => void;
    const { host, handle } = await mount({ dataSource: ds, records: { total: 2, at: 0, id: () => new Promise<RecordId>((resolve) => (found = resolve)) } });
    host.querySelectorAll<HTMLButtonElement>('.fd-record-pager button')[1].click();
    await pause();
    type(host, 'budget', '4300000');
    found(2);
    await until(() => handle.form.getState().recordId === 2 && handle.form.getState().status === 'ready');
    expect(handle.form.getState().recordId).toBe(2);
    expect(ds.records['lead'][1]).toMatchObject({ budget: 4300000 });
    expect(question()).toBeNull();
  });

  it('the breadcrumbs: asked before the app’s own way back; Cancel stays', async () => {
    const back = jest.fn();
    const { host } = await atRisk({ breadcrumbs: [{ label: 'Leads', open: back }] });
    button(host.querySelector('.fd-breadcrumbs') as HTMLElement, 'Leads').click();
    await asked(host);
    answer('Cancel', host);
    await pause();
    expect(back).not.toHaveBeenCalled();
    button(host.querySelector('.fd-breadcrumbs') as HTMLElement, 'Leads').click();
    await asked(host);
    answer('Discard', host);
    await until(() => back.mock.calls.length);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('the app’s own host.close, by a `close` step: asked in the viewer’s own box; not closed on Cancel', async () => {
    const close = jest.fn();
    const { host, handle } = await atRisk({ host: { close } });
    const run = handle.run([{ do: 'close' }]);
    await asked(host);
    answer('Cancel', host);
    expect(await run).toMatchObject({ done: false, reason: 'no' });
    expect(close).not.toHaveBeenCalled();
    expect(handle.form.getState().values['budget']).toBe(4300000);
  });

  it('one question at a time: ways out taken while it is asked get its answer; one taken after it asks again', async () => {
    const { host, handle } = await atRisk();
    const first = handle.form.leave();
    const second = handle.form.openRecord(2);
    await asked(host);
    expect(host.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
    answer('Cancel', host);
    expect(await first).toBe(false);
    expect(await second).toBe(false);
    expect(handle.form.getState().recordId).toBe(1);
    const third = handle.form.leave();
    await asked(host);
    answer('Discard', host);
    expect(await third).toBe(true);
  });

  it('handle.reload(): asked; Cancel keeps the change', async () => {
    const { host, handle } = await atRisk();
    const reloading = handle.reload();
    await asked(host);
    answer('Cancel', host);
    await reloading;
    expect(handle.form.getState().values['budget']).toBe(4300000);
  });
});

describe('a save that went through is reported saved by every later exit', () => {
  /** A dialog or a panel over a new lead, or record 1: how it ended, once it has. */
  async function inBox(open: typeof openFormDialog, options: Partial<Parameters<typeof openFormDialog>[0]> = {}) {
    const ds = (options.dataSource as Source | undefined) ?? source({ delayMs: 30 });
    let ended: FormDialogResult | null = null;
    void open({ page: lead, dataSource: ds, recordId: null, title: 'Lead', ...options }).then((value) => (ended = value));
    await until(() => input(boxOf() ?? document.body, 'name'));
    await pause();
    return { ds, ended: () => ended };
  }

  for (const [exit, leave] of [
    ['Discard', () => button(boxOf(), 'Discard').click()],
    ['Escape', () => input(boxOf(), 'phone').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))],
    ['×', () => (boxOf().querySelector('.fd-dialog-close') as HTMLButtonElement).click()],
  ] as const) {
    it(`a new lead saved by Save & Close, Cancel on the question, then ${exit}: saved, with the record made`, async () => {
      const { ds, ended } = await inBox(openFormDialog);
      type(boxOf(), 'name', 'Villa in New Cairo');
      button(boxOf(), 'Save & Close').click();
      await typeWhileSaving(ds, boxOf());
      await asked(boxOf());
      answer('Cancel', boxOf());
      await pause();
      expect(ended()).toBeNull();
      leave();
      // Escape and × ask about the change still at risk; Discard is the person's own answer.
      if (exit !== 'Discard') {
        await asked(boxOf());
        answer('Discard', boxOf());
      }
      await until(() => ended());
      expect(ended()).toMatchObject({ saved: true, recordId: 3 });
    });
  }

  it('Create and edit… from a link: the record made reaches the link though the person discarded what followed', async () => {
    const ds = source({ delayMs: 30 });
    const dialogs = pageDialogs({ page: lead, dataSource: ds, pages: { lead }, relatedPages: { lead } });
    const made = dialogs.openRecord('lead', { name: 'Villa in New Cairo', title: 'Lead' });
    await until(() => input(boxOf() ?? document.body, 'name')?.value === 'Villa in New Cairo');
    button(boxOf(), 'Save & Close').click();
    await typeWhileSaving(ds, boxOf());
    await asked(boxOf());
    answer('Cancel', boxOf());
    await pause();
    button(boxOf(), 'Discard').click();
    expect(await made).toMatchObject({ id: 3, label: 'Villa in New Cairo' });
  });

  it('a page in this one’s place: saved, Cancel on the question, then Back: the step that opened it goes on as saved', async () => {
    const ds = source({ delayMs: 30 });
    const ends: { done: boolean; reason?: string }[] = [];
    const { host, handle } = await mount({ dataSource: ds, pages: { 'lead-other': other } });
    handle.on('run', ({ id, result }) => id === 'other' && ends.push(result));
    button(host, 'Open the other').click();
    const opened = () => [...host.querySelectorAll<HTMLElement>('.fd-form')].find((form) => form !== handle.element) as HTMLElement;
    await until(() => opened() && input(opened(), 'phone')?.value === '+201112223334');
    await pause();
    type(opened(), 'phone', '+201009998887');
    button(opened(), 'Save').click();
    await typeWhileSaving(ds, opened(), 'budget', '2600000');
    await asked(opened());
    answer('Cancel', opened());
    await pause();
    button(opened(), 'Back').click();
    await asked(opened());
    answer('Discard', opened());
    await until(() => ends.length);
    expect(ends).toEqual([{ done: true }]);
    expect(handle.element.hidden).toBe(false);
  });
});

describe('as in 0.20: values set by the page’s own afterSave steps ask nothing', () => {
  it('Save & Close in a dialog and in a panel closes saved, no question', async () => {
    for (const open of [openFormDialog, openFormPanel]) {
      let ended: FormDialogResult | null = null;
      void open({ page: settingAfterSave, dataSource: source(), recordId: 1, title: 'Lead' }).then((value) => (ended = value));
      await until(() => input(boxOf() ?? document.body, 'phone')?.value === '+201001234567');
      type(boxOf(), 'phone', '+201009998887');
      button(boxOf(), 'Save & Close').click();
      await until(() => ended);
      expect(ended).toMatchObject({ saved: true, values: expect.objectContaining({ ref: 'R-1' }) });
      expect(question()).toBeNull();
    }
  });

  it('the pager, Done and the status: no question, locked, “Saved”', async () => {
    const { host, handle } = await mount({ page: settingAfterSave, records: [1, 2], editSwitch: true });
    type(host, 'phone', '+201009998887');
    button(host, 'Done').click();
    await until(() => host.querySelector('.fd-form')?.hasAttribute('data-readonly'));
    expect(host.querySelector('.fd-form')?.hasAttribute('data-readonly')).toBe(true);
    expect(host.querySelector('.fd-status')?.textContent).toBe('Saved');
    host.querySelectorAll<HTMLButtonElement>('.fd-record-pager button')[1].click();
    await until(() => handle.form.getState().recordId === 2);
    expect(handle.form.getState().recordId).toBe(2);
    expect(question()).toBeNull();
  });

  it('a page of answers whose afterSave resets it, or sets a value: “Thank you”, as before', async () => {
    for (const afterSave of [[{ do: 'reset' }], [{ do: 'set', field: 'ref', value: "'R-1'" }]] as ActionStep[][]) {
      const survey: Page = {
        fieldia: '0.1',
        id: 'survey',
        title: 'Survey',
        data: { kind: 'responses' },
        fields: { name: { type: 'char', label: 'Name' }, ref: { type: 'char', label: 'Reference' } },
        layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
        on: { afterSave },
      };
      const ds = createMemoryDataSource({});
      const { host } = await mount({ page: survey, dataSource: ds, recordId: null });
      type(host, 'name', 'Sara');
      button(host, 'Submit').click();
      await until(() => !(host.querySelector('.fd-done') as HTMLElement).hidden);
      expect((host.querySelector('.fd-done') as HTMLElement).hidden).toBe(false);
      expect(host.querySelector('.fd-announce')?.textContent ?? '').not.toContain('not your latest');
      expect(ds.responses).toHaveLength(1);
      document.body.replaceChildren();
    }
  });
});
