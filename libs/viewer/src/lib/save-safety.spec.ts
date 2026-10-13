import { ConflictError, createMemoryDataSource, type MemoryDataSourceOptions, type Page, type RecordPermissions, type Values } from '@fieldia/core';
import { openFormDialog } from './dialog';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * Save safety on screen: a save over someone else's shows who changed the
 * record and when, what each changed, and Reload or Keep mine — the person's
 * own changes listed after Reload to put back, nothing lost unsaid. And a
 * record its source says the person may only read: no Edit, no Save, no
 * Archive, Duplicate or Delete — hidden, never greyed — and why, in words.
 */

const lead: Page = {
  fieldia: '0.1',
  id: 'lead',
  title: 'Lead',
  data: { kind: 'record', model: 'lead' },
  fields: {
    name: { type: 'char', label: 'Name', required: true },
    phone: { type: 'char', label: 'Phone' },
    stage: { type: 'selection', label: 'Stage', options: [{ value: 'new', label: 'New' }, { value: 'visit', label: 'Visit' }, { value: 'won', label: 'Won' }] },
    budget: { type: 'float', label: 'Budget' },
    commission: { type: 'float', label: 'Commission' },
    active: { type: 'boolean', label: 'Active', default: true },
  },
  translations: { ar: { Phone: 'الهاتف', Stage: 'المرحلة', Budget: 'الميزانية' } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    toolbar: {
      menu: [
        { id: 'm-print', label: 'Brochure', group: 'print', action: 'print_brochure' },
        { id: 'm-archive', builtin: 'archive' },
        { id: 'm-unarchive', builtin: 'unarchive' },
        { id: 'm-duplicate', builtin: 'duplicate' },
        { id: 'm-delete', builtin: 'delete' },
      ],
    },
    children: [
      {
        type: 'section',
        id: 'main',
        children: [
          { type: 'field', id: 'f-phone', field: 'phone' },
          { type: 'field', id: 'f-stage', field: 'stage' },
          { type: 'field', id: 'f-budget', field: 'budget' },
          { type: 'field', id: 'f-commission', field: 'commission' },
        ],
      },
    ],
  },
};

const leads = (): Record<string, Values> => ({
  1: { name: 'Villa in Sheikh Zayed', phone: '+201001234567', stage: 'new', budget: 4000000, commission: 0.025, active: true },
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
  const handle = mountViewer(host, { page: lead, dataSource: source(), recordId: 1, confirm: async () => true, ...options });
  handles.push(handle);
  await handle.form.settled();
  return { host, handle };
}

const type = (host: Element, field: string, value: string) => {
  const input = host.querySelector(`[data-field="${field}"] input`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};
const button = (host: Element, words: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === words && !b.closest('[hidden]') && !b.hidden);
const shown = (element: Element | null) => !!element && !(element as HTMLElement).hidden && !element.closest('[hidden]');
const conflict = (host: Element) => host.querySelector('.fd-conflict') as HTMLElement;
const aside = (host: Element) => host.querySelector('.fd-set-aside') as HTMLElement;
const note = (host: Element) => host.querySelector('.fd-read-only-note') as HTMLElement;
/** A time as the conflict says it, the same day: hours and minutes, in the language's way. */
const clock = (at: Date, tag = 'en-GB') => new Intl.DateTimeFormat(tag, { hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' }).format(at);

describe('someone else saved first: the conflict, with Reload and Keep mine', () => {
  async function refused(options: Partial<ViewerOptions> = {}, who: { by?: string; at?: string } = { by: 'Mona' }) {
    const ds = source();
    const mounted = await mount({ dataSource: ds, ...options });
    type(mounted.host, 'phone', '+201009998887');
    type(mounted.host, 'budget', '4200000');
    ds.changeElsewhere('lead', 1, { stage: 'visit', budget: 4500000 }, who as { by: string; at?: string });
    expect(await mounted.handle.save()).toBe(false);
    return { ...mounted, ds };
  }

  it('says who changed the record and when, what they changed and what both did, and offers Reload and Keep mine', async () => {
    const at = new Date();
    const { host } = await refused({}, { by: 'Mona', at: at.toISOString() });
    const box = conflict(host);
    expect(shown(box)).toBe(true);
    const words = box.querySelector('[role="alert"]') as HTMLElement;
    expect(words.textContent).toContain(`Mona changed this record at ${clock(at)}.`);
    expect(words.textContent).toContain('They changed: Stage, Budget.');
    expect(words.textContent).toContain('You both changed: Budget.');
    expect(words.textContent).toContain('Keep mine saves yours over theirs.');
    expect(shown(button(box, 'Reload') ?? null)).toBe(true);
    expect(shown(button(box, 'Keep mine') ?? null)).toBe(true);
    // My changes stay in the form, for whichever is chosen.
    expect((host.querySelector('[data-field="phone"] input') as HTMLInputElement).value).toBe('+201009998887');
  });

  it('names someone else, and no time, when the source told neither', async () => {
    const ds = source();
    const { host, handle } = await mount({ dataSource: { ...ds, save: async () => Promise.reject(new ConflictError({ version: { token: 'v9' } })) } });
    type(host, 'phone', '+201009998887');
    await handle.save();
    expect(conflict(host).textContent).toContain('Someone else changed this record after you opened it.');
  });

  it('Keep mine saves my changes over theirs, and the banner goes', async () => {
    const { host, ds, handle } = await refused();
    button(conflict(host), 'Keep mine')?.click();
    await until(() => handle.form.getState().status === 'saved');
    expect(ds.records['lead'][1]).toMatchObject({ phone: '+201009998887', budget: 4200000, stage: 'visit' });
    expect(shown(conflict(host))).toBe(false);
  });

  it('Reload shows theirs, and lists my changes with their values and theirs, each to put back', async () => {
    const { host, handle } = await refused();
    button(conflict(host), 'Reload')?.click();
    await until(() => shown(aside(host)));
    expect(shown(conflict(host))).toBe(false);
    expect((host.querySelector('[data-field="budget"] input') as HTMLInputElement).value).toMatch(/4[,.\s]?500[,.\s]?000/);
    const rows = [...aside(host).querySelectorAll('li')].map((li) => li.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Phone');
    expect(rows[0]).toContain('+201009998887');
    expect(rows[1]).toContain('Budget');
    // Each is put back by its own button, named for its field; the list goes once none is left.
    const phone = aside(host).querySelector('button[aria-label="Put back Phone"]') as HTMLButtonElement;
    phone.click();
    expect(handle.form.getState().values['phone']).toBe('+201009998887');
    expect(handle.form.getState().dirty).toEqual(['phone']);
    expect(aside(host).querySelectorAll('li')).toHaveLength(1);
    button(aside(host), 'Put back')?.click();
    expect(shown(aside(host))).toBe(false);
  });

  it('lets go of what was set aside with Dismiss, and takes the focus to the list as it shows', async () => {
    const { host } = await refused();
    button(conflict(host), 'Reload')?.click();
    await until(() => shown(aside(host)));
    expect(aside(host).contains(document.activeElement)).toBe(true);
    (aside(host).querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement).click();
    expect(shown(aside(host))).toBe(false);
  });

  it('speaks the page’s language: Arabic words, the fields’ own names in it', async () => {
    const at = new Date();
    const { host } = await refused({ locale: 'ar' }, { by: 'منى', at: at.toISOString() });
    const words = conflict(host).textContent ?? '';
    expect(words).toContain('منى');
    expect(words).toContain(clock(at, 'ar'));
    expect(words).toContain('المرحلة');
    expect(button(conflict(host), 'إعادة التحميل')).toBeTruthy();
  });
});

describe('what the source says the person may do with the record', () => {
  const guarded = (can: RecordPermissions) => source({ can: { lead: () => can } });
  const menuItems = (host: Element) => [...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].filter((item) => !item.hidden).map((item) => item.textContent);

  it('only to read: no Edit, no Save even after a change, no Archive, Duplicate or Delete, and the reason said', async () => {
    const { host, handle } = await mount({ dataSource: guarded({ edit: false, archive: false, duplicate: false, delete: false, reason: 'Only Mona, the lead’s agent, can change it.' }), editSwitch: true, readonly: true });
    expect(shown(note(host))).toBe(true);
    expect(note(host).getAttribute('role')).toBe('status');
    expect(note(host).textContent).toBe('Only Mona, the lead’s agent, can change it.');
    expect(button(host, 'Edit')).toBeUndefined();
    expect(menuItems(host)).toEqual(['Brochure']);
    handle.setReadonly(false);
    handle.setValues({ phone: '+201009998887' });
    expect(button(host, 'Save')).toBeUndefined();
    expect((host.querySelector('[data-field="phone"] input') as HTMLInputElement).readOnly).toBe(true);
    // Read as a whole, its fields show no lock each: the record's own words say why.
    expect(shown(host.querySelector('[data-field="phone"] .fd-lock-wrap'))).toBe(false);
  });

  it('only to read, with no reason given: the viewer’s own words, in the page’s language', async () => {
    const { host } = await mount({ dataSource: guarded({ edit: false }), locale: 'fr' });
    expect(note(host).textContent).toBe('Vous pouvez lire cet enregistrement, mais pas le modifier.');
  });

  it('may edit but not delete: Delete is hidden, and the menu says why', async () => {
    const { host } = await mount({ dataSource: guarded({ delete: false }) });
    expect(menuItems(host)).toEqual(['Brochure', 'Archive', 'Duplicate']);
    (host.querySelector('.fd-record-gear') as HTMLButtonElement).click();
    const why = host.querySelector('.fd-record-menu-note') as HTMLElement;
    expect(shown(why)).toBe(true);
    expect(why.textContent).toBe('Not open to you here: Delete.');
    expect((host.querySelector('.fd-record-gear') as HTMLElement).getAttribute('aria-describedby')).toBe(why.id);
    expect(shown(note(host))).toBe(false);
  });

  it('a field read-only for this person locks with the reason; a field hidden from them is gone', async () => {
    const { host } = await mount({ dataSource: guarded({ readonlyFields: ['budget'], hiddenFields: ['commission'], reason: 'Budgets are the manager’s.' }) });
    expect((host.querySelector('[data-field="budget"] input') as HTMLInputElement).readOnly).toBe(true);
    expect((host.querySelector('[data-field="phone"] input') as HTMLInputElement).readOnly).toBe(false);
    const lock = host.querySelector('[data-field="budget"] .fd-lock') as HTMLElement;
    expect(shown(lock)).toBe(true);
    expect(document.getElementById(lock.getAttribute('aria-describedby') as string)?.textContent).toBe('Budgets are the manager’s.');
    expect(shown(host.querySelector('[data-field="commission"]'))).toBe(false);
  });

  it('in a dialog: no Save & Close for a record the person may only read, and Close in place of Discard', async () => {
    const opened = openFormDialog({ page: lead, dataSource: guarded({ edit: false }), recordId: 1, title: 'Lead' });
    const dialog = () => document.querySelector('.fd-form-dialog') as HTMLElement;
    await until(() => dialog()?.querySelector('.fd-read-only-note:not([hidden])'));
    expect(button(dialog(), 'Save & Close')).toBeUndefined();
    button(dialog(), 'Close')?.click();
    expect((await opened).saved).toBe(false);
  });
});
