import { createMemoryDataSource, type MemoryDataSourceOptions, type Page, type Values } from '@fieldia/core';
import { openFormDialog, openFormPanel, type FormDialogResult } from './dialog';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * Every way out of a record that acts on a save that went through — Save &
 * Close, a footer button whose steps saved, a `close` step after a save, the
 * pager, Duplicate, a page opened in this one's place, Done — asks before it
 * leaves work behind: a change made while the save was on its way, or changes
 * Reload set aside. "Discard your changes?", the focus on Cancel; Cancel keeps
 * the person where they are, with their work. And the status never says
 * "Saved" while a change is still to save.
 */

const lead: Page = {
  fieldia: '0.1',
  id: 'lead',
  title: 'Lead',
  data: { kind: 'record', model: 'lead' },
  fields: {
    name: { type: 'char', label: 'Name', required: true },
    phone: { type: 'char', label: 'Phone' },
    stage: { type: 'selection', label: 'Stage', options: [{ value: 'new', label: 'New' }, { value: 'visit', label: 'Visit' }] },
    budget: { type: 'float', label: 'Budget' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    toolbar: { menu: [{ id: 'm-duplicate', builtin: 'duplicate' }] },
    buttons: [
      { type: 'button', id: 'done', label: 'Save and close', steps: [{ do: 'save' }, { do: 'close' }] },
      { type: 'button', id: 'other', label: 'Open the other', steps: [{ do: 'open', page: 'lead-other', as: 'page', record: '2' }] },
    ],
    children: [
      {
        type: 'section',
        id: 'main',
        children: [
          { type: 'field', id: 'f-phone', field: 'phone' },
          { type: 'field', id: 'f-stage', field: 'stage' },
          { type: 'field', id: 'f-budget', field: 'budget' },
        ],
      },
    ],
  },
};

/** Another lead, as the page a button opens in this one's place shows it. */
const other: Page = { ...lead, id: 'lead-other', layout: { ...(lead.layout as Extract<Page['layout'], { type: 'sheet' }>), buttons: [] } };

/** The same lead with buttons of its own at its foot, in place of Discard and Save & Close. */
const withFooter: Page = {
  ...lead,
  layout: { ...(lead.layout as Extract<Page['layout'], { type: 'sheet' }>), footer: [{ type: 'button', id: 'apply', label: 'Apply', style: 'primary', steps: [{ do: 'save' }] }] },
};

const leads = (): Record<string, Values> => ({
  1: { name: 'Villa in Sheikh Zayed', phone: '+201001234567', stage: 'new', budget: 4000000 },
  2: { name: 'Flat in Maadi', phone: '+201112223334', stage: 'visit', budget: 2500000 },
});
const source = (more: MemoryDataSourceOptions = {}) => createMemoryDataSource({ records: { lead: leads() }, versions: { by: 'Sara' }, ...more });

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
const question = (scope: Element = document.body) => scope.querySelector('[role="alertdialog"]') as HTMLElement | null;
const answer = (words: 'Cancel' | 'Discard', scope: Element = document.body) => button(question(scope) as HTMLElement, words).click();
const pause = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
const panelOf = () => document.querySelector('.fd-form-dialog') as HTMLElement;

/** Asked "Discard your changes?", the focus on Cancel: Enter keeps the work. */
async function asked(scope: Element = document.body) {
  await until(() => question(scope));
  expect(question(scope)?.textContent).toContain('Discard your changes?');
  expect(document.activeElement?.textContent).toBe('Cancel');
}

/** Type in a field while the save is on its way: the source is asked, and answers after a while. */
async function typeWhileSaving(ds: ReturnType<typeof source>, scope: Element, field: string, value: string) {
  const before = saves(ds);
  await until(() => saves(ds) > before);
  expect(saves(ds)).toBe(before + 1);
  type(scope, field, value);
}
const saves = (ds: ReturnType<typeof source>) => ds.calls.filter((call) => call.method === 'save').length;
const copies = (ds: ReturnType<typeof source>) => ds.calls.filter((call) => call.method === 'copy').length;

describe('a dialog or a panel closes on a save only when nothing is left unsaved', () => {
  /** A lead in a dialog or a panel: how it ended, once it has. */
  async function opened(open: typeof openFormDialog, options: Partial<Parameters<typeof openFormDialog>[0]> = {}) {
    const ds = (options.dataSource as ReturnType<typeof source> | undefined) ?? source({ delayMs: 30 });
    let ended: FormDialogResult | null = null;
    void open({ page: lead, dataSource: ds, recordId: 1, title: 'Lead', ...options }).then((value) => (ended = value));
    await until(() => input(panelOf() ?? document.body, 'phone')?.value === '+201001234567');
    await pause();
    return { ds, ended: () => ended };
  }
  /** A conflict in it, then Reload: the phone set aside. */
  async function reloadedIn(ds: ReturnType<typeof source>) {
    type(panelOf(), 'phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' });
    input(panelOf(), 'phone').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    await until(() => panelOf().querySelector('.fd-conflict:not([hidden])'));
    button(panelOf().querySelector('.fd-conflict') as HTMLElement, 'Reload').click();
    await until(() => panelOf().querySelector('.fd-set-aside:not([hidden])'));
    expect(input(panelOf(), 'phone').value).toBe('+201001234567');
  }

  it('Save & Close, with a change made while it saved: asked; Cancel keeps the dialog open with the change, still to save', async () => {
    const { ds, ended } = await opened(openFormDialog);
    type(panelOf(), 'phone', '+201009998887');
    button(panelOf(), 'Save & Close').click();
    await typeWhileSaving(ds, panelOf(), 'budget', '4300000');
    await asked(panelOf());
    answer('Cancel', panelOf());
    await pause();
    expect(ended()).toBeNull();
    expect(ds.records['lead'][1]).toMatchObject({ phone: '+201009998887', budget: 4000000 });
    expect(input(panelOf(), 'budget').value).toMatch(/4[,.\s]?300[,.\s]?000/);
    // Pressed again, it saves the rest and closes.
    button(panelOf(), 'Save & Close').click();
    await until(() => ended());
    expect(ended()).toMatchObject({ saved: true });
    expect(ds.records['lead'][1]).toMatchObject({ budget: 4300000 });
  });

  it('Save & Close in a panel after Reload: the changes set aside are asked about; Discard closes it saved', async () => {
    const { ds, ended } = await opened(openFormPanel, { dataSource: source() });
    await reloadedIn(ds);
    button(panelOf(), 'Save & Close').click();
    await asked(panelOf());
    answer('Cancel', panelOf());
    await pause();
    expect(ended()).toBeNull();
    expect(panelOf().querySelector('.fd-set-aside li')?.textContent).toContain('+201009998887');
    button(panelOf(), 'Save & Close').click();
    await asked(panelOf());
    answer('Discard', panelOf());
    await until(() => ended());
    expect(ended()).toMatchObject({ saved: true });
  });

  it('a footer button whose steps saved, with a change made meanwhile: asked before the dialog closes', async () => {
    const { ds, ended } = await opened(openFormDialog, { page: withFooter });
    type(panelOf(), 'phone', '+201009998887');
    button(panelOf(), 'Apply').click();
    await typeWhileSaving(ds, panelOf(), 'budget', '4300000');
    await asked(panelOf());
    answer('Cancel', panelOf());
    await pause();
    expect(ended()).toBeNull();
    expect(input(panelOf(), 'budget').value).toMatch(/4[,.\s]?300[,.\s]?000/);
  });

  it('a `close` step after its run saved, with a change made meanwhile: asked, once', async () => {
    const { ds, ended } = await opened(openFormDialog);
    type(panelOf(), 'phone', '+201009998887');
    button(panelOf(), 'Save and close').click();
    await typeWhileSaving(ds, panelOf(), 'budget', '4300000');
    await asked(panelOf());
    await pause();
    expect(panelOf().querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
    answer('Discard', panelOf());
    await until(() => ended());
    expect(ended()).toMatchObject({ saved: true });
  });

  it('a plain dialog’s Escape closes at once on a change not saved, as before; but asks about changes set aside', async () => {
    const first = await opened(openFormDialog);
    type(panelOf(), 'phone', '+201009998887');
    input(panelOf(), 'phone').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await until(() => first.ended());
    expect(first.ended()).toMatchObject({ saved: false });
    const { ds, ended } = await opened(openFormDialog, { dataSource: source() });
    await reloadedIn(ds);
    input(panelOf(), 'phone').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await asked(panelOf());
    answer('Cancel', panelOf());
    await pause();
    expect(ended()).toBeNull();
    expect(panelOf().querySelector('.fd-set-aside li')?.textContent).toContain('+201009998887');
  });
});

describe('the record’s own ways to another record', () => {
  it('the pager, with a change made while its save ran: asked; Cancel stays on this record with the change', async () => {
    const ds = source({ delayMs: 30 });
    const { host, handle } = await mount({ dataSource: ds, records: [1, 2] });
    type(host, 'phone', '+201009998887');
    const next = host.querySelectorAll<HTMLButtonElement>('.fd-record-pager button')[1];
    next.focus();
    next.click();
    await typeWhileSaving(ds, host, 'budget', '4300000');
    await asked(host);
    answer('Cancel', host);
    await pause();
    expect(handle.form.getState()).toMatchObject({ recordId: 1, dirty: ['budget'] });
    expect(document.activeElement).toBe(next);
    next.click();
    await until(() => handle.form.getState().recordId === 2);
    expect(handle.form.getState().recordId).toBe(2);
  });

  it('Duplicate after Reload: asked in the viewer’s own box; Cancel keeps the changes set aside, Discard shows the copy', async () => {
    const ds = source();
    const { host, handle } = await mount({ dataSource: ds, confirm: async () => true });
    type(host, 'phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' });
    await handle.save();
    button(host.querySelector('.fd-conflict') as HTMLElement, 'Reload').click();
    await until(() => handle.form.getState().setAside);
    const duplicate = () => (host.querySelector('[data-node="m-duplicate"]') as HTMLButtonElement).click();
    duplicate();
    await asked(host);
    answer('Cancel', host);
    await handle.form.settled();
    expect(handle.form.getState()).toMatchObject({ recordId: 1, setAside: { phone: '+201009998887' } });
    expect(copies(ds)).toBe(0);
    duplicate();
    await asked(host);
    answer('Discard', host);
    await until(() => handle.form.getState().recordId === 3);
    expect(handle.form.getState().setAside).toBeNull();
  });

  it('a page opened in this one’s place gives way back on its save only once nothing in it is left unsaved', async () => {
    const ds = source({ delayMs: 30 });
    const { host, handle } = await mount({ dataSource: ds, pages: { 'lead-other': other } });
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
    expect(handle.element.hidden).toBe(true);
    expect(ds.records['lead'][2]).toMatchObject({ phone: '+201009998887', budget: 2500000 });
    expect(input(opened(), 'budget').value).toMatch(/2[,.\s]?600[,.\s]?000/);
  });
});

describe('saved, but not all of it', () => {
  it('the status says so while a change made during the save is still to save, and "Saved" once it is', async () => {
    const ds = source({ delayMs: 30 });
    const { host, handle } = await mount({ dataSource: ds });
    type(host, 'phone', '+201009998887');
    const saving = handle.save();
    await typeWhileSaving(ds, host, 'budget', '4300000');
    expect(await saving).toBe(true);
    expect(host.querySelector('.fd-status')?.textContent).toBe('Saved, but not your latest changes.');
    expect(host.querySelector('.fd-status')?.classList.contains('fd-status-saved')).toBe(false);
    expect(await handle.save()).toBe(true);
    expect(host.querySelector('.fd-status')?.textContent).toBe('Saved');
  });

  it('Done keeps the record being edited, and says so, when a change was made while it saved', async () => {
    const ds = source({ delayMs: 30 });
    const { host, handle } = await mount({ dataSource: ds, editSwitch: true });
    type(host, 'phone', '+201009998887');
    button(host, 'Done').click();
    await typeWhileSaving(ds, host, 'budget', '4300000');
    await until(() => handle.form.getState().status === 'saved');
    await pause();
    expect(host.querySelector('.fd-form')?.hasAttribute('data-readonly')).toBe(false);
    expect(host.querySelector('.fd-announce')?.textContent).toBe('Saved, but not your latest changes.');
    expect(handle.form.getState().dirty).toEqual(['budget']);
  });

  it('a page of answers changed while they were sent stays, and says so, not "Thank you"', async () => {
    const survey: Page = {
      fieldia: '0.1',
      id: 'survey',
      title: 'Survey',
      data: { kind: 'responses' },
      fields: { name: { type: 'char', label: 'Name' }, note: { type: 'char', label: 'Note' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-note', field: 'note' }] },
    };
    const ds = createMemoryDataSource({ delayMs: 30 });
    const { host, handle } = await mount({ page: survey, dataSource: ds, recordId: null });
    type(host, 'name', 'Sara');
    button(host, 'Submit').click();
    await until(() => ds.calls.some((call) => call.method === 'submit'));
    expect(ds.responses).toHaveLength(0);
    type(host, 'note', 'Call after six');
    await until(() => handle.form.getState().status === 'saved');
    await pause();
    expect((host.querySelector('.fd-done') as HTMLElement).hidden).toBe(true);
    expect(host.querySelector('.fd-announce')?.textContent).toBe('Sent, but not your latest changes.');
    expect(input(host, 'note').value).toBe('Call after six');
    expect(ds.responses[0].values).toMatchObject({ name: 'Sara' });
  });
});
