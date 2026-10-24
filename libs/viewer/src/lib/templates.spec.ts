import { createMemoryDataSource, type DataSource, type JsonValue, type Page } from '@fieldia/core';
import type { PreferenceStore } from '@fieldia/widgets';
import { templateValues } from './templates';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * Record templates people save and name (`templates`): a record's values kept by a name through the data source, or
 * the person's preferences without it, and a new record started from one, as the person's own changes.
 */

const page = {
  fieldia: '0.12',
  id: 'course',
  title: 'Treatment course',
  data: { kind: 'record', model: 'course' },
  templates: true,
  fields: {
    name: { type: 'char', label: 'Patient' },
    treatment: { type: 'selection', label: 'Treatment', options: [{ value: 'botox', label: 'Botox' }, { value: 'laser', label: 'Laser' }] },
    price: { type: 'float', label: 'Price' },
    total: { type: 'float', label: 'Total', compute: 'price * 2' },
    notes: { type: 'text', label: 'Notes' },
    consent: { type: 'binary', label: 'Consent' },
    sessions: { type: 'one2many', label: 'Sessions', relation: 'course.session', fields: { area: { type: 'char', label: 'Area' } } },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    children: [{ type: 'section', id: 'main', children: ['treatment', 'price', 'total', 'notes', 'consent', 'sessions'].map((field) => ({ type: 'field', id: `f-${field}`, field })) }],
  },
} as unknown as Page;

const RECORD = { name: 'Mona Adel', treatment: 'botox', price: 4500, notes: 'Forehead and frown lines', sessions: [{ key: '1', id: 1, values: { area: 'Forehead' } }] };

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

async function mount(dataSource: DataSource, recordId: number | null, preferences?: PreferenceStore) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource, recordId, ...(preferences ? { preferences } : {}) });
  await handle.drawn;
  await handle.form.settled();
  return { host, form: handle.form };
}

const menuButton = (host: Element) => host.querySelector('.fd-templates-button') as HTMLButtonElement;
const items = (host: Element) => [...host.querySelectorAll<HTMLButtonElement>('.fd-templates-menu [role="menuitem"]')];
async function choose(host: Element, words: string) {
  menuButton(host).click();
  await settle();
  const item = items(host).find((one) => one.textContent === words);
  if (!item) throw new Error(`No "${words}" in ${items(host).map((one) => one.textContent).join(', ')}`);
  item.click();
  await settle();
}
async function answer(name: string, button: string) {
  const dialog = document.querySelector('.fd-form-dialog') as HTMLElement;
  const box = dialog.querySelector('input[type="text"], input:not([type])') as HTMLInputElement | null;
  if (box) {
    box.value = name;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const press = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find((one) => one.textContent === button) as HTMLButtonElement;
  press.click();
  await settle();
}

describe('record templates', () => {
  it('keeps a text in several languages whole, each language as the person typed it, and lays both (0.31)', () => {
    const both = { ...page, fields: { ...page.fields, notes: { type: 'text', label: 'Notes', translate: ['ar', 'en'] } } } as unknown as Page;
    const notes = { ar: 'الجبهة وخطوط العبوس', en: 'Forehead and frown lines' };
    expect(templateValues(both, { treatment: 'botox', notes })).toEqual({ treatment: 'botox', notes });
  });

  it('keeps what a person fills in — never the name, a file or a value worked out — and lines without their ids', () => {
    expect(templateValues(page, { ...RECORD, total: 9000, consent: { name: 'c.pdf', type: 'application/pdf', size: 1, data: 'QQ==' } })).toEqual({
      treatment: 'botox',
      price: 4500,
      notes: 'Forehead and frown lines',
      sessions: [{ values: { area: 'Forehead' } }],
    });
  });

  it('saves a record as a template by its name, through the data source, and starts a new record from it', async () => {
    const ds = createMemoryDataSource({ records: { course: { 1: { ...RECORD } } }, templates: {} });
    const { host } = await mount(ds, 1);
    expect(menuButton(host).textContent).toBe('Templates');
    await choose(host, 'Save as template…');
    await answer('Botox package', 'Save template');
    const saved = await (ds.templates as NonNullable<typeof ds.templates>)({ model: 'course', pageId: 'course' });
    expect(saved).toEqual([{ id: 'template-1', name: 'Botox package', values: { treatment: 'botox', price: 4500, notes: 'Forehead and frown lines', sessions: [{ values: { area: 'Forehead' } }] } }]);
    handle?.destroy();
    document.body.replaceChildren();
    const fresh = await mount(ds, null);
    await choose(fresh.host, 'Botox package');
    const values = fresh.form.getState().values;
    expect(values).toMatchObject({ name: null, treatment: 'botox', price: 4500, notes: 'Forehead and frown lines' });
    expect((values['sessions'] as { values: object }[]).map((line) => line.values)).toEqual([{ area: 'Forehead' }]);
    // The person's own changes: Ctrl+Z takes each back.
    expect(fresh.form.getState().dirty).toEqual(expect.arrayContaining(['treatment', 'price', 'notes', 'sessions']));
    expect(fresh.form.undo()).toEqual({ field: 'sessions' });
  });

  it('asks before it replaces a template saved again under its name, in its own words; and lets templates go', async () => {
    const ds = createMemoryDataSource({ records: { course: { 1: { ...RECORD } } }, templates: { course: [{ id: 'botox', name: 'Botox package', values: { price: 4000 } }, { id: 'laser', name: 'Laser course', values: { treatment: 'laser' } }] } });
    const { host } = await mount(ds, 1);
    const priceOf = async () => (await (ds.templates as NonNullable<typeof ds.templates>)({ model: 'course', pageId: 'course' })).find((one) => one.id === 'botox')?.values['price'];
    await choose(host, 'Save as template…');
    await answer('botox package', 'Save template');
    // The owner's walk of 0.31: saved over "Botox package" without a word. Asked first, its Yes the action's own words.
    const question = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null;
    expect(question()?.textContent).toContain('Replace “Botox package”?');
    const buttons = () => [...(question()?.querySelectorAll('button') ?? [])].map((one) => one.textContent);
    expect(buttons()).toEqual(expect.arrayContaining(['Replace', 'Cancel']));
    // Cancel: nothing kept over it, the name asked again as it was typed.
    ([...(question() as HTMLElement).querySelectorAll('button')].find((one) => one.textContent === 'Cancel') as HTMLButtonElement).click();
    await settle();
    expect(await priceOf()).toBe(4000);
    expect((document.querySelector('.fd-form-dialog input') as HTMLInputElement | null)?.value).toBe('botox package');
    await answer('botox package', 'Save template');
    ([...(question() as HTMLElement).querySelectorAll('button')].find((one) => one.textContent === 'Replace') as HTMLButtonElement).click();
    await settle();
    expect(await priceOf()).toBe(4500);
    await choose(host, 'Delete templates…');
    const dialog = document.querySelector('.fd-form-dialog') as HTMLElement;
    const laser = [...dialog.querySelectorAll('label')].find((label) => label.textContent?.includes('Laser course'))?.querySelector('input') as HTMLInputElement;
    laser.click();
    await answer('', 'Delete');
    expect((await (ds.templates as NonNullable<typeof ds.templates>)({ model: 'course', pageId: 'course' })).map((one) => one.name)).toEqual(['botox package']);
  });

  it("keeps them in the person's preferences where the source keeps none, and offers starting from one only on a new record", async () => {
    const kept: Record<string, JsonValue> = {};
    const preferences: PreferenceStore = { get: (key) => kept[key] ?? null, set: (key, value) => void (kept[key] = value) };
    const ds = createMemoryDataSource({ records: { course: { 1: { ...RECORD } } } });
    const plain: DataSource = { ...ds, templates: undefined, saveTemplate: undefined, deleteTemplate: undefined };
    const { host } = await mount(plain, 1, preferences);
    await choose(host, 'Save as template…');
    await answer('Botox package', 'Save template');
    expect(kept['templates:course']).toEqual([expect.objectContaining({ name: 'Botox package', values: expect.objectContaining({ price: 4500 }) })]);
    menuButton(host).click();
    await settle();
    expect(items(host).map((one) => one.textContent)).toEqual(['Save as template…', 'Delete templates…']);
  });
});
