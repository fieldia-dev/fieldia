import { ConflictError, createMemoryDataSource, type MemoryDataSourceOptions, type Page, type RecordPermissions, type Values } from '@fieldia/core';
import { openFormDialog, openFormPanel } from './dialog';
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
  2: { name: 'Flat in Maadi', phone: '+201112223334', stage: 'visit', budget: 2500000, commission: 0.02, active: true },
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

  it('lets go of what was set aside with Dismiss, asked first, and takes the focus to the list as it shows', async () => {
    const { host, handle } = await refused();
    button(conflict(host), 'Reload')?.click();
    await until(() => shown(aside(host)));
    expect(aside(host).contains(document.activeElement)).toBe(true);
    expect(aside(host).getAttribute('aria-labelledby')).toBe(aside(host).querySelector('.fd-set-aside-title')?.id);
    const dismiss = aside(host).querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement;
    dismiss.focus();
    dismiss.click();
    // A discard, asked as every other is: the focus on Cancel, and Cancel keeps them, the focus back on ×.
    await until(() => host.querySelector('[role="alertdialog"]'));
    const ask = host.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(ask.textContent).toContain('Discard your changes?');
    expect(document.activeElement).toBe(button(ask, 'Cancel'));
    button(ask, 'Cancel')?.click();
    await until(() => !host.querySelector('[role="alertdialog"]'));
    expect(handle.form.getState().setAside).toEqual({ phone: '+201009998887', budget: 4200000 });
    expect(shown(aside(host))).toBe(true);
    expect(document.activeElement).toBe(dismiss);
    dismiss.click();
    await until(() => host.querySelector('[role="alertdialog"]'));
    button(host.querySelector('[role="alertdialog"]') as HTMLElement, 'Discard')?.click();
    await until(() => !shown(aside(host)));
    expect(handle.form.getState().setAside).toBeNull();
    // Hidden, it has no name: a label the page's own fields have ("No") finds them, not it.
    expect(aside(host).hasAttribute('aria-labelledby')).toBe(false);
    // The focus goes to the first field the changes were in, never to the page's body.
    expect(document.activeElement).toBe(host.querySelector('[data-field="phone"] input'));
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

  it('after Reload in Arabic, each value set aside, and what it holds now, reads in its own direction', async () => {
    const { host } = await refused({ locale: 'ar' });
    button(conflict(host), 'إعادة التحميل')?.click();
    await until(() => shown(aside(host)));
    const phone = aside(host).querySelector('li') as HTMLElement;
    // A phone number among Arabic words keeps its order: "+20 100 123 4567", not "4567 123 100 20+".
    expect(phone.querySelector('.fd-set-aside-mine')?.tagName).toBe('BDI');
    expect(phone.querySelector('.fd-set-aside-now bdi')?.textContent).toBe('+201001234567');
    expect(phone.querySelector('.fd-set-aside-now')?.textContent).toBe('الآن +201001234567');
  });
});

describe('what the source says the person may do with the record', () => {
  const guarded = (can: RecordPermissions) => source({ can: { lead: () => can } });
  const menuItems = (host: Element) => [...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].filter((item) => !item.hidden).map((item) => item.textContent);

  it('only to read: no Edit, no Save even after a change, no Archive, Duplicate or Delete, and the reason said', async () => {
    const { host, handle } = await mount({ dataSource: guarded({ edit: false, archive: false, duplicate: false, delete: false, reason: 'Only Mona, the lead’s agent, can change it.' }), editSwitch: true, readonly: true });
    expect(shown(note(host))).toBe(true);
    expect(note(host).getAttribute('role')).toBe('status');
    // Read whole, as a locked form is: values as words, even once the app unlocks the form.
    expect(host.querySelector('.fd-form')?.hasAttribute('data-readonly')).toBe(true);
    expect(note(host).textContent).toBe('Only Mona, the lead’s agent, can change it.');
    expect(button(host, 'Edit')).toBeUndefined();
    expect(menuItems(host)).toEqual(['Brochure']);
    handle.setReadonly(false);
    expect(host.querySelector('.fd-form')?.hasAttribute('data-readonly')).toBe(true);
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

describe('saving twice in a row', () => {
  it('Ctrl+Enter pressed twice quickly saves once, as the same save: no conflict, and Saved', async () => {
    const ds = source({ delayMs: 20 });
    const { host, handle } = await mount({ dataSource: ds });
    type(host, 'phone', '+201009998887');
    const input = host.querySelector('[data-field="phone"] input') as HTMLInputElement;
    for (let i = 0; i < 2; i++) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    await until(() => handle.form.getState().status === 'saved');
    await handle.form.settled();
    expect(ds.calls.filter((call) => call.method === 'save')).toHaveLength(1);
    expect(handle.form.getState()).toMatchObject({ status: 'saved', conflict: null });
    expect(shown(conflict(host))).toBe(false);
    expect(host.querySelector('.fd-status')?.textContent).toBe('Saved');
  });
});

describe('after Reload, the changes set aside are asked about before they are left behind', () => {
  async function reloaded(options: Partial<ViewerOptions> = {}) {
    const ds = source();
    const mounted = await mount({ dataSource: ds, ...options });
    type(mounted.host, 'phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' });
    expect(await mounted.handle.save()).toBe(false);
    button(conflict(mounted.host), 'Reload')?.click();
    await until(() => shown(aside(mounted.host)));
    expect(mounted.handle.form.getState().dirty).toEqual([]);
    return { ...mounted, ds };
  }
  const question = (host: Element) => host.querySelector('[role="alertdialog"]') as HTMLElement | null;
  const answer = (host: Element, words: string) => [...(question(host)?.querySelectorAll('button') ?? [])].find((b) => b.textContent === words) as HTMLButtonElement;

  it('the pager asks first: Cancel stays on the record with them, the focus back on the pager; Discard moves on', async () => {
    const { host, handle } = await reloaded({ records: [1, 2] });
    const next = host.querySelectorAll<HTMLButtonElement>('.fd-record-pager button')[1];
    next.focus();
    next.click();
    await until(() => question(host));
    expect(question(host)?.textContent).toContain('Discard your changes?');
    // The safe answer has the focus: Enter keeps them.
    expect(document.activeElement).toBe(answer(host, 'Cancel'));
    answer(host, 'Cancel').click();
    await until(() => !question(host));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(handle.form.getState()).toMatchObject({ recordId: 1, setAside: { phone: '+201009998887' } });
    expect(shown(aside(host))).toBe(true);
    expect(document.activeElement).toBe(next);
    next.click();
    await until(() => question(host));
    answer(host, 'Discard').click();
    await until(() => handle.form.getState().recordId === 2);
    expect(handle.form.getState().setAside).toBeNull();
  });

  it('a panel asks first on Escape, and keeps them on Cancel', async () => {
    const ds = source();
    const result = openFormPanel({ page: lead, dataSource: ds, recordId: 1, title: 'Lead' });
    const panel = () => document.querySelector('.fd-form-panel') as HTMLElement;
    await until(() => panel()?.querySelector('[data-field="phone"] input'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    type(panel(), 'phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' });
    (panel().querySelector('.fd-form-dialog-foot .fd-button-primary') as HTMLButtonElement).click();
    await until(() => shown(conflict(panel())));
    button(conflict(panel()), 'Reload')?.click();
    await until(() => shown(aside(panel())));
    const phone = panel().querySelector('[data-field="phone"] input') as HTMLInputElement;
    phone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await until(() => question(panel()));
    expect(question(panel())?.textContent).toContain('Discard your changes?');
    answer(panel(), 'Cancel').click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(panel()).not.toBeNull();
    expect(shown(aside(panel()))).toBe(true);
    phone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await until(() => question(panel()));
    answer(panel(), 'Discard').click();
    expect((await result).saved).toBe(false);
  });
});

describe('Keep mine, when their version cannot be read', () => {
  it('saves nothing, and the banner says so — again on each try — keeping Reload and Keep mine', async () => {
    const ds = source();
    let down = false;
    const unread = {
      ...ds,
      load: async (request: Parameters<NonNullable<typeof ds.load>>[0]) => {
        if (down) throw new TypeError('Failed to fetch');
        return ds.load(request);
      },
      save: async (request: Parameters<typeof ds.save>[0]) => {
        try {
          return await ds.save(request);
        } catch (error) {
          throw error instanceof ConflictError ? new ConflictError({ version: error.conflict.version }) : error;
        }
      },
    };
    const { host, handle } = await mount({ dataSource: unread });
    type(host, 'phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' });
    expect(await handle.save()).toBe(false);
    down = true;
    const keep = button(conflict(host), 'Keep mine') as HTMLButtonElement;
    keep.click();
    await until(() => (handle.form.getState().conflict as { unread?: boolean } | null)?.unread);
    await until(() => !conflict(host).hasAttribute('aria-busy'));
    const words = conflict(host).querySelector('[role="alert"]') as HTMLElement;
    expect(words.textContent).toContain('Their version could not be read, so yours was not saved over it.');
    expect(ds.records['lead'][1]).toMatchObject({ phone: '+201001234567', stage: 'visit' });
    expect(shown(button(conflict(host), 'Reload') ?? null)).toBe(true);
    expect(shown(keep)).toBe(true);
    // Pressed again, still unread: said again, by the announcer.
    keep.click();
    await until(() => !conflict(host).hasAttribute('aria-busy') && host.querySelector('.fd-announce')?.textContent);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(host.querySelector('.fd-announce')?.textContent).toContain('Their version could not be read');
    expect(ds.calls.filter((call) => call.method === 'save')).toHaveLength(1);
  });
});

describe('after each button in the banner and the list, the focus lands where the person can go on', () => {
  async function refusedOn(change: (host: Element) => void) {
    const ds = source();
    const mounted = await mount({ dataSource: ds });
    change(mounted.host);
    ds.changeElsewhere('lead', 1, { stage: 'visit', budget: 4500000 }, { by: 'Mona' });
    expect(await mounted.handle.save()).toBe(false);
    return { ...mounted, ds };
  }
  const phoneBox = (host: Element) => host.querySelector('[data-field="phone"] input');

  it('Keep mine, once saved and the banner gone: on the first field the person changed', async () => {
    const { host, handle } = await refusedOn((at) => type(at, 'phone', '+201009998887'));
    const keep = button(conflict(host), 'Keep mine') as HTMLButtonElement;
    keep.focus();
    keep.click();
    await until(() => handle.form.getState().status === 'saved');
    await until(() => !conflict(host).hasAttribute('aria-busy'));
    expect(shown(conflict(host))).toBe(false);
    expect(document.activeElement).toBe(phoneBox(host));
  });

  it('Keep mine, the first changed field’s box not taking the focus: on the next one that does', async () => {
    const { host, handle } = await refusedOn((at) => {
      type(at, 'phone', '+201009998887');
      type(at, 'budget', '4200000');
    });
    (phoneBox(host) as HTMLInputElement).disabled = true;
    const keep = button(conflict(host), 'Keep mine') as HTMLButtonElement;
    keep.focus();
    keep.click();
    await until(() => handle.form.getState().status === 'saved' && !conflict(host).hasAttribute('aria-busy'));
    expect(document.activeElement).toBe(host.querySelector('[data-field="budget"] input'));
  });

  it('in a panel: Keep mine puts the focus on the field in the panel, never outside it', async () => {
    const ds = source();
    void openFormPanel({ page: lead, dataSource: ds, recordId: 1, title: 'Lead' });
    const panel = () => document.querySelector('.fd-form-panel') as HTMLElement;
    await until(() => (phoneBox(panel() ?? document.body) as HTMLInputElement | null)?.value === '+201001234567');
    type(panel(), 'phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { stage: 'visit', budget: 4500000 }, { by: 'Mona' });
    button(panel(), 'Save & Close')?.click();
    await until(() => shown(conflict(panel())));
    const keep = button(conflict(panel()), 'Keep mine') as HTMLButtonElement;
    keep.focus();
    keep.click();
    await until(() => !shown(conflict(panel())) && !conflict(panel()).hasAttribute('aria-busy'));
    expect(document.activeElement).toBe(phoneBox(panel()));
    expect(panel().contains(document.activeElement)).toBe(true);
  });

  it('Reload with nothing to set aside: on the first field that changed, and told it reloaded', async () => {
    // The same change Mona made: nothing of mine differs from hers.
    const { host, handle } = await refusedOn((at) => type(at, 'budget', '4500000'));
    const reload = button(conflict(host), 'Reload') as HTMLButtonElement;
    reload.focus();
    reload.click();
    await until(() => !shown(conflict(host)) && !conflict(host).hasAttribute('aria-busy'));
    expect(handle.form.getState().setAside).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('[data-field="stage"] select'));
    await until(() => host.querySelector('.fd-announce')?.textContent);
    expect(host.querySelector('.fd-announce')?.textContent).toBe('Reloaded: this is the record as it is now.');
  });

  it('Put all back: on the first field put back', async () => {
    const { host, handle } = await refusedOn((at) => {
      type(at, 'phone', '+201009998887');
      type(at, 'budget', '4200000');
    });
    button(conflict(host), 'Reload')?.click();
    await until(() => shown(aside(host)));
    const all = button(aside(host), 'Put all back') as HTMLButtonElement;
    all.focus();
    all.click();
    expect(handle.form.getState()).toMatchObject({ setAside: null, dirty: ['phone', 'budget'] });
    expect(shown(aside(host))).toBe(false);
    expect(document.activeElement).toBe(phoneBox(host));
  });
});
