import { createMemoryDataSource, type Page } from '@fieldia/core';
import { datePart, linesPart, pathPart, quietPart, textPart, themesPart, type WidgetFactory } from '@fieldia/widgets';
import { openFormDialog } from './dialog';
import { BUG, VALUES } from './test-head';
import { customers, partners } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';
import { filtersPart, headPart, installListStyles, listPart, partsFor } from './viewer-parts';

/**
 * Before its parts have come (parts.ts in @fieldia/widgets): a page that uses
 * none is drawn at once and asks for none; a page that draws from one — a
 * record's head, a split button, a work heading, a work item's text, a path
 * picker, a list, a filter bar — is drawn whole once its parts have come, nothing of
 * it before, its element busy meanwhile; a dialog opens once its parts are in.
 * This file starts with no part loaded (src/test-parts.ts leaves it so), and
 * its tests run in order: the first sees no part at all.
 */

const page = (layout: unknown, fields: Record<string, unknown> = { name: { type: 'char', label: 'Name' } }): Page =>
  ({ fieldia: '0.1', id: 'p', title: 'P', data: { kind: 'record', model: 'x' }, fields, layout }) as unknown as Page;
const sections = (...children: unknown[]) => ({ type: 'sections', id: 's', children });
const PLAIN = page(sections({ type: 'section', id: 'g', title: 'Group', collapsible: true, children: [{ type: 'field', id: 'f-name', field: 'name' }] }));

/** Waits, a turn at a time, until `ready` holds. */
async function until(ready: () => unknown) {
  for (let turn = 0; turn < 50 && !ready(); turn++) await new Promise((done) => setTimeout(done, 0));
  expect(ready()).toBeTruthy();
}

let handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles) handle.destroy();
  handles = [];
  document.body.replaceChildren();
});
const mount = (shown: Page, more: Partial<Parameters<typeof mountViewer>[1]> = {}) => {
  const host = document.createElement('div');
  document.body.append(host);
  const handle = mountViewer(host, { page: shown, ...more });
  handles.push(handle);
  return { host, handle };
};

describe('the parts a page draws from', () => {
  it('are none for a page of plain parts, which is drawn at once and asks for none', async () => {
    expect(partsFor(PLAIN)).toEqual([]);
    const { host, handle } = mount(PLAIN);
    expect(host.querySelector('[data-node="f-name"]')).not.toBeNull();
    expect(handle.element.hasAttribute('aria-busy')).toBe(false);
    await handle.drawn;
    for (const part of [headPart, listPart, filtersPart, textPart, pathPart, datePart, themesPart, quietPart]) expect(part.loaded).toBeUndefined();
  });

  it('are found wherever the page names what needs them, unless the app draws those fields', () => {
    const md = { type: 'field', id: 'f-md', field: 'notes', options: { editor: 'markdown' } };
    const fields = { notes: { type: 'html', label: 'Notes' }, area: { type: 'many2one', label: 'Area', relation: 'area' }, links: { type: 'many2many', label: 'Links', relation: 'x' } };
    expect(partsFor(page(sections({ type: 'button', id: 'b', label: 'Undo', iconOnly: true })))).toEqual([headPart]);
    expect(partsFor(page(sections({ type: 'section', id: 'g', title: 'G', maximise: true, children: [] })))).toEqual([headPart]);
    // A Markdown text alone in a titled group: its Edit and Done in the group's heading.
    expect(partsFor(page(sections({ type: 'section', id: 'g', title: 'G', children: [md] }), fields))).toEqual([headPart, textPart]);
    expect(partsFor(page(sections({ type: 'field', id: 'f', field: 'area', widget: 'path' }), fields))).toEqual([pathPart]);
    expect(partsFor(page(sections({ type: 'field', id: 'f', field: 'links', widget: 'links' }), fields))).toEqual([textPart]);
    // A list: its screen's part, and its filter bar's beside it for a search by fields.
    expect(partsFor(page({ type: 'list', id: 'l', columns: [] }))).toEqual([listPart]);
    expect(partsFor(customers)).toEqual([listPart]);
    expect(partsFor(page({ type: 'list', id: 'l', columns: [], search: 'fields', filterFields: [] }))).toEqual([listPart, filtersPart]);
    // A work item's bug: its head (its Changed Date is words in the head's "Updated by", no box), and its quiet skin's look.
    expect(partsFor(BUG)).toEqual([headPart, quietPart]);
    // The classic formatted text, the plain many2one: no part.
    expect(partsFor(page(sections({ type: 'field', id: 'f', field: 'notes' }, { type: 'field', id: 'g', field: 'area' }), fields))).toEqual([]);
    // The app's own widget for the field: no part.
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(partsFor(page(sections({ type: 'field', id: 'f', field: 'area', widget: 'path' }), fields), { 'many2one.path': own })).toEqual([]);
  });

  it('the date part for a date, a date and time, a time of day or a range, wherever its box is drawn: a field, a table’s lines, a property', () => {
    const fields = {
      due: { type: 'date', label: 'Due' },
      at: { type: 'datetime', label: 'At' },
      slot: { type: 'char', label: 'Slot' },
      lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { name: { type: 'char', label: 'Name' }, due: { type: 'date', label: 'Due' }, slot: { type: 'char', label: 'Slot' } } },
      plain: { type: 'one2many', label: 'Plain lines', relation: 'line', fields: { name: { type: 'char', label: 'Name' }, slot: { type: 'char', label: 'Slot' } } },
      props: { type: 'properties', label: 'Properties', definitions: [{ name: 'note', label: 'Note', type: 'char' }] },
    };
    const field = (name: string, more: Record<string, unknown> = {}) => ({ type: 'field', id: `f-${name}`, field: name, ...more });
    expect(partsFor(page(sections(field('due')), fields))).toEqual([datePart]);
    expect(partsFor(page(sections(field('at')), fields))).toEqual([datePart]);
    expect(partsFor(page(sections(field('slot', { widget: 'time' })), fields))).toEqual([datePart]);
    expect(partsFor(page(sections(field('due', { widget: 'daterange', options: { endField: 'at' } })), fields))).toEqual([datePart]);
    // A table's lines draw each cell with its column's box: a date column, a time column (the table itself in the lines part).
    expect(partsFor(page(sections(field('lines')), fields))).toEqual([linesPart, datePart]);
    expect(partsFor(page(sections(field('plain')), fields))).toEqual([linesPart]);
    expect(partsFor(page(sections(field('plain', { cells: { slot: { widget: 'time' } } })), fields))).toEqual([linesPart, datePart]);
    // A property may be a date: one added in place, or worked out from its value, may be one whatever the page names.
    expect(partsFor(page(sections(field('props')), fields))).toEqual([datePart]);
    // A plain char: none. The app's own date box: none.
    expect(partsFor(page(sections(field('slot')), fields))).toEqual([]);
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(partsFor(page(sections(field('due'), field('lines')), fields), { date: own })).toEqual([linesPart]);
  });

  it('a list: nothing of it drawn, its element busy, until the list part has come; then the list whole, its records in', async () => {
    expect(listPart.loaded).toBeUndefined();
    expect(document.getElementById('fd-list-styles')).toBeNull();
    const { host, handle } = mount(customers, { dataSource: partners() });
    expect(handle.element.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('.fd-list')).toBeNull();
    // What needs the list waits for it: the app's reload.
    let reloaded = false;
    const reload = handle.reload().then(() => (reloaded = true));
    expect(reloaded).toBe(false);
    await handle.drawn;
    await reload;
    expect(listPart.loaded).toBeDefined();
    expect(filtersPart.loaded).toBeUndefined();
    expect(handle.element.hasAttribute('aria-busy')).toBe(false);
    expect(host.querySelector('.fd-list-waiting')).toBeNull();
    expect(host.querySelector('.fd-search-input')).not.toBeNull();
    await until(() => host.querySelectorAll('.fd-list-table tbody tr.fd-list-row').length === 2);
    expect(document.getElementById('fd-list-styles')).not.toBeNull();
    // Drawn from the part now loaded: a second list is drawn at once.
    const second = mount(customers, { dataSource: partners() });
    expect(second.host.querySelector('.fd-list-table')).not.toBeNull();
    expect(second.handle.element.hasAttribute('aria-busy')).toBe(false);
  });

  it('the list’s look put in a page from its part, for what draws it without a list (the designer’s canvas): at once once the part is in', async () => {
    const other = document.implementation.createHTMLDocument('canvas');
    await installListStyles(other);
    expect(other.getElementById('fd-list-styles')?.textContent).toContain('.fd-list-table');
    // Once, however often it is asked for.
    await installListStyles(other);
    expect(other.querySelectorAll('#fd-list-styles')).toHaveLength(1);
  });

  it('a page with a date: nothing of it drawn until the date part has come, then Fieldia’s own box with its calendar, the value in words', async () => {
    const fields = { due: { type: 'date', label: 'Due' } };
    const dataSource = createMemoryDataSource({ records: { x: { 1: { due: '2026-10-15' } } } });
    expect(datePart.loaded).toBeUndefined();
    const { host, handle } = mount(page(sections({ type: 'field', id: 'f-due', field: 'due' }), fields), { dataSource, recordId: 1 });
    expect(handle.element.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('[data-node]')).toBeNull();
    await handle.drawn;
    await handle.form.settled();
    expect(datePart.loaded).toBeDefined();
    expect(handle.element.hasAttribute('aria-busy')).toBe(false);
    expect(host.querySelector('[data-node="f-due"] .fd-date-pick .fd-calendar-button')).not.toBeNull();
    expect((host.querySelector('[data-node="f-due"] input') as HTMLInputElement).value).toBe('15 Oct 2026');
  });

  it('a saved form placed in a page, holding a date: its quiet placeholder until the date part has come, then drawn whole — never plainly first', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mountViewer: fresh } = await import('./viewer');
      const { datePart: freshDate } = await import('@fieldia/widgets');
      const visit = { ...page(sections({ type: 'field', id: 'f-due', field: 'due' }), { due: { type: 'date', label: 'Due' } }), id: 'visit', data: { kind: 'responses' } } as Page;
      const outer = page(sections({ type: 'field', id: 'f-name', field: 'name' }, { type: 'form', id: 'visit', page: 'visit', name: 'visit', title: 'Visit' }));
      expect(freshDate.loaded).toBeUndefined();
      const host = document.createElement('div');
      document.body.append(host);
      const handle = fresh(host, { page: outer, pages: { visit } });
      handles.push(handle);
      // The page round it asks for no part: drawn at once, the saved form's placeholder in it.
      expect(handle.element.hasAttribute('aria-busy')).toBe(false);
      const part = host.querySelector('.fd-form-part[data-node="visit"]') as HTMLElement;
      expect(part.getAttribute('aria-busy')).toBe('true');
      expect(part.querySelector('input')).toBeNull();
      await until(() => !part.hasAttribute('aria-busy'));
      expect(freshDate.loaded).toBeDefined();
      expect(part.querySelector('[data-node="visit-f-due"] .fd-date-pick .fd-calendar-button, .fd-date-pick .fd-calendar-button')).not.toBeNull();
      expect(part.querySelectorAll('input')).toHaveLength(1);
    });
  });

  it('a record with a head: nothing of it drawn, its element busy, until its part has come; then drawn whole, its record in', async () => {
    const dataSource = createMemoryDataSource({ records: { 'work.item': { 1: VALUES } } });
    const { host, handle } = mount(BUG, { dataSource, recordId: 1 });
    expect(handle.element.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('.fd-content')?.children.length ?? 0).toBe(0);
    expect(host.querySelector('[data-node]')).toBeNull();
    // What needs the page drawn waits for it: a list's open, the app's reload.
    let reloaded = false;
    const reload = handle.reload().then(() => (reloaded = true));
    expect(reloaded).toBe(false);
    await handle.drawn;
    await reload;
    expect(headPart.loaded).toBeDefined();
    expect(handle.element.hasAttribute('aria-busy')).toBe(false);
    expect(host.querySelector('.fd-head-badge')?.textContent).toBe('BUG 4127');
    expect(document.getElementById('fieldia-head-styles')).not.toBeNull();
    await handle.form.settled();
    expect((host.querySelector('[data-node="#title"] input') as HTMLInputElement).value).toBe(VALUES.title);
    // Drawn from the part now loaded: a second record is drawn at once.
    const second = mount(BUG, { dataSource, recordId: 1 });
    expect(second.host.querySelector('.fd-head')).not.toBeNull();
    expect(second.handle.element.hasAttribute('aria-busy')).toBe(false);
  });

  it('a field that takes the focus as the record opens takes it once the page is drawn, though the record opened first', async () => {
    const shown = page(sections({ type: 'section', id: 'g', title: 'G', foldAt: 'end', children: [{ type: 'field', id: 'f-name', field: 'name', focus: true }] }));
    // The head part is in by now: the text part stands in for "not yet" here, with a path picker it has never drawn.
    const fields = { name: { type: 'char', label: 'Name' }, area: { type: 'many2one', label: 'Area', relation: 'area' } };
    const late = page(sections({ type: 'field', id: 'f-name', field: 'name', focus: true }, { type: 'field', id: 'f-area', field: 'area', widget: 'path' }), fields);
    expect(partsFor(shown)).toEqual([headPart]);
    expect(pathPart.loaded).toBeUndefined();
    const dataSource = createMemoryDataSource({ records: { x: { 1: { name: 'Sara' } } } });
    const { host, handle } = mount(late, { dataSource, recordId: 1 });
    await handle.form.settled();
    expect(host.querySelector('input')).toBeNull();
    await handle.drawn;
    await Promise.resolve();
    expect(document.activeElement).toBe(host.querySelector('[data-node="f-name"] input'));
    expect(host.querySelector('.fd-path')).not.toBeNull();
  });

  it('a dialog of the inset size opens once the head part is in, drawn whole, its window tools wired', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const dataSource = createMemoryDataSource({ records: { 'work.item': { 1: VALUES } } });
    const opened = openFormDialog({ page: BUG, title: 'Bug 1', recordId: 1, dataSource, size: 'inset', backdrop: 'clear', maximise: true, resizable: true });
    // The head part is in already (an earlier test drew a head): the box is there at once.
    const box = document.querySelector('.fd-form-dialog') as HTMLElement;
    expect(box.classList.contains('fd-size-inset')).toBe(true);
    expect(box.querySelector('.fd-head-window .fd-dialog-max')).not.toBeNull();
    (box.querySelector('.fd-dialog-max') as HTMLElement).click();
    expect(box.hasAttribute('data-maximised')).toBe(true);
    (box.querySelector('.fd-dialog-close') as HTMLElement).click();
    expect((await opened).saved).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('a dialog whose page needs a part not yet in opens once it is, and gives the focus back where it was', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const fields = { notes: { type: 'html', label: 'Notes' } };
    expect(textPart.loaded).toBeUndefined();
    const opened = openFormDialog({ page: page(sections({ type: 'field', id: 'f-notes', field: 'notes', options: { toolbar: 'focus' } }), fields), title: 'Notes', mode: 'values' });
    expect(document.querySelector('.fd-form-dialog')).toBeNull();
    await textPart.load();
    await until(() => document.querySelector('.fd-form-dialog'));
    const box = document.querySelector('.fd-form-dialog') as HTMLElement;
    expect(box.querySelector('.fd-text[data-toolbar="focus"]')).not.toBeNull();
    (box.querySelector('.fd-dialog-close') as HTMLElement).click();
    await opened;
    expect(document.activeElement).toBe(opener);
  });
});

describe('the looks in parts of their own: the themes and the quiet look', () => {
  const quietGroup = (quiet: boolean) => page(sections({ type: 'section', id: 'g', quiet, children: [{ type: 'field', id: 'f-name', field: 'name' }] }));
  /** Fresh modules, so no look's part has come yet; their sheets out of the document. */
  async function fresh() {
    document.head.replaceChildren();
    const { mountViewer: mountFresh } = await import('./viewer');
    const { openFormDialog: openFresh } = await import('./dialog');
    const widgets = await import('@fieldia/widgets');
    const mountIn = (shown: Page, more: Partial<Parameters<typeof mountViewer>[1]> = {}) => {
      const host = document.createElement('div');
      document.body.append(host);
      const handle = mountFresh(host, { page: shown, ...more });
      handles.push(handle);
      return { host, handle };
    };
    /** Fieldia's own sheets and its parts', in their order (the viewer's own sheets after them). */
    const sheets = () => [...document.head.querySelectorAll('style')].map((style) => style.id).filter((id) => id.startsWith('fieldia-'));
    return { mountIn, openFresh, themes: widgets.themesPart, quiet: widgets.quietPart, sheets };
  }

  it('are the page’s when its look names a theme or the quiet skin, or a group or a field asks to be quiet; none for a page without', () => {
    expect(partsFor({ ...PLAIN, look: { theme: 'material' } })).toEqual([themesPart]);
    expect(partsFor({ ...PLAIN, look: { skin: 'quiet' } })).toEqual([quietPart]);
    expect(partsFor({ ...PLAIN, look: { theme: 'fluent', skin: 'quiet' } })).toEqual([themesPart, quietPart]);
    expect(partsFor(quietGroup(true))).toEqual([quietPart]);
    expect(partsFor(page(sections({ type: 'field', id: 'f-name', field: 'name', quiet: true })))).toEqual([quietPart]);
    // None: a plain page, a look with no theme or quiet skin, a group that says it is boxed.
    expect(partsFor(PLAIN)).toEqual([]);
    expect(partsFor({ ...PLAIN, look: { skin: 'outlined', accent: '#1677ff', density: 'compact' } })).toEqual([]);
    expect(partsFor(quietGroup(false))).toEqual([]);
  });

  it('a page whose look names a theme: nothing of it drawn until the themes part has come, then drawn whole, wearing it', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mountIn, themes, sheets } = await fresh();
      const { host, handle } = mountIn({ ...PLAIN, look: { theme: 'material' } });
      expect(handle.element.getAttribute('aria-busy')).toBe('true');
      expect(host.querySelector('[data-node]')).toBeNull();
      expect(handle.element.hasAttribute('data-fd-theme')).toBe(false);
      await handle.drawn;
      expect(themes.loaded).toBeDefined();
      expect(handle.element.getAttribute('data-fd-theme')).toBe('material');
      expect(handle.element.getAttribute('data-fd-skin')).toBe('outlined');
      expect(host.querySelector('[data-node="f-name"] input')).not.toBeNull();
      // Its sheet after Fieldia's own, before the page's own looks.
      expect(sheets()).toEqual(['fieldia-styles', 'fieldia-theme-styles', 'fieldia-styles-looks']);
    });
  });

  it('a theme the app gives or switches to before its part came: the page drawn at once in none, the theme last asked for worn as it comes', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mountIn, themes, sheets } = await fresh();
      const { host, handle } = mountIn(PLAIN, { theme: 'material' });
      // Drawn at once, in the theme's skin, with no theme's name over the skin's own tokens.
      expect(handle.element.hasAttribute('aria-busy')).toBe(false);
      expect(host.querySelector('[data-node="f-name"] input')).not.toBeNull();
      expect(handle.element.getAttribute('data-fd-skin')).toBe('outlined');
      expect(handle.element.hasAttribute('data-fd-theme')).toBe(false);
      // Switched before it came: the skin at once, the theme still none; the last one asked for is worn.
      handle.setTheme('odoo');
      expect(handle.element.getAttribute('data-fd-skin')).toBe('underline');
      expect(handle.element.hasAttribute('data-fd-theme')).toBe(false);
      await handle.drawn;
      expect(themes.loaded).toBeDefined();
      expect(handle.element.getAttribute('data-fd-theme')).toBe('odoo');
      expect(sheets()).toContain('fieldia-theme-styles');
      // In now: another at once, and none at once.
      handle.setTheme('fluent');
      expect(handle.element.getAttribute('data-fd-theme')).toBe('fluent');
      handle.setTheme(null);
      expect(handle.element.hasAttribute('data-fd-theme')).toBe(false);
    });
  });

  it('a theme taken off before its part came stays off as it comes', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mountIn, themes } = await fresh();
      const { handle } = mountIn(PLAIN);
      handle.setTheme('apple');
      handle.setTheme(null);
      await themes.load();
      await Promise.resolve();
      expect(handle.element.hasAttribute('data-fd-theme')).toBe(false);
    });
  });

  it('a dialog in a theme before its part came: open at once in none, wearing the theme as it comes', async () => {
    await jest.isolateModulesAsync(async () => {
      const { openFresh, themes } = await fresh();
      const opened = openFresh({ page: PLAIN, title: 'Name', mode: 'values', theme: 'apple' });
      const box = document.querySelector('.fd-form-dialog') as HTMLElement;
      expect(box).not.toBeNull();
      expect(box.hasAttribute('data-fd-theme')).toBe(false);
      await themes.load();
      await until(() => box.getAttribute('data-fd-theme') === 'apple');
      (box.querySelector('.fd-dialog-close') as HTMLElement).click();
      await opened;
    });
  });

  it('a page whose look is the quiet skin: nothing drawn until its part has come, then its fields quiet, its sheet in', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mountIn, quiet, sheets } = await fresh();
      const { host, handle } = mountIn({ ...PLAIN, look: { skin: 'quiet' } });
      expect(handle.element.getAttribute('aria-busy')).toBe('true');
      expect(host.querySelector('[data-node]')).toBeNull();
      await handle.drawn;
      expect(quiet.loaded).toBeDefined();
      expect(host.querySelector('[data-node="f-name"]')?.hasAttribute('data-quiet')).toBe(true);
      expect(sheets()).toEqual(['fieldia-styles', 'fieldia-quiet-styles', 'fieldia-styles-looks']);
    });
  });

  it('the quiet skin the app gives before its part came: each field quiet at once, boxed until it comes, its value shown and what is typed kept', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mountIn, quiet, sheets } = await fresh();
      const { host, handle } = mountIn(PLAIN, { skin: 'quiet' });
      handle.form.setValue('name', 'Sara');
      const field = host.querySelector('[data-node="f-name"]') as HTMLElement;
      const input = field.querySelector('input') as HTMLInputElement;
      // Drawn at once, marked quiet; the quiet look's sheet not in yet: the outlined skin's box, its value in it.
      expect(handle.element.hasAttribute('aria-busy')).toBe(false);
      expect(field.hasAttribute('data-quiet')).toBe(true);
      expect(quiet.loaded).toBeUndefined();
      expect(sheets()).not.toContain('fieldia-quiet-styles');
      expect(input.value).toBe('Sara');
      input.value = 'Sara Ali';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await handle.drawn;
      // Its sheet in: the same box, what was typed in it kept.
      expect(sheets()).toEqual(['fieldia-styles', 'fieldia-quiet-styles', 'fieldia-styles-looks']);
      expect(field.querySelector('input')).toBe(input);
      expect(input.value).toBe('Sara Ali');
      expect(handle.form.getState().values['name']).toBe('Sara Ali');
    });
  });

  it('a skin switched to quiet asks for its part; a page that never wears it never does', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mountIn, quiet, themes } = await fresh();
      const { host, handle } = mountIn(quietGroup(false), { skin: 'outlined' });
      await handle.drawn;
      expect(quiet.loaded).toBeUndefined();
      expect(themes.loaded).toBeUndefined();
      handle.setSkin('quiet');
      // A group that says it is boxed stays boxed: nothing in it wears the look, and its part is not asked for.
      expect(host.querySelector('[data-node="f-name"]')?.hasAttribute('data-quiet')).toBe(false);
      expect(quiet.loaded).toBeUndefined();
      const other = mountIn(PLAIN, { skin: 'outlined' });
      other.handle.setSkin('quiet');
      expect(other.host.querySelector('[data-node="f-name"]')?.hasAttribute('data-quiet')).toBe(true);
      await until(() => quiet.loaded);
      await until(() => document.getElementById('fieldia-quiet-styles'));
    });
  });
});

describe('a part that cannot come', () => {
  it('leaves the page drawn plainly: a sheet with a head drawn as a sheet, its buttons as buttons', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('./head-part', () => {
        throw new Error('offline');
      });
      const { mountViewer: fresh } = await import('./viewer');
      const { headPart: freshHead } = await import('./viewer-parts');
      const host = document.createElement('div');
      document.body.append(host);
      const handle = fresh(host, { page: BUG, dataSource: createMemoryDataSource({ records: { 'work.item': { 1: VALUES } } }), recordId: 1 });
      await handle.drawn;
      expect(freshHead.loaded).toBeUndefined();
      expect(handle.element.hasAttribute('aria-busy')).toBe(false);
      expect(host.querySelector('.fd-head')).toBeNull();
      expect(host.querySelector('.fd-sheet-page')).not.toBeNull();
      expect(host.querySelector('[data-node="f-notes"]')).not.toBeNull();
      handle.destroy();
      jest.dontMock('./head-part');
    });
  });

  /** A viewer of its own, whose list part cannot come while `offline.now` holds. */
  async function offlineList() {
    const offline = { now: true };
    jest.doMock('./list-part', () => {
      if (offline.now) throw new Error('offline');
      return jest.requireActual('./list-part');
    });
    const { mountViewer: fresh } = await import('./viewer');
    const { listPart: freshList } = await import('./viewer-parts');
    const host = document.createElement('div');
    document.body.append(host);
    const opened: unknown[] = [];
    const handle = fresh(host, { page: customers, dataSource: partners(), onOpenRecord: (id) => void opened.push(id) });
    handles.push(handle);
    await handle.drawn;
    return { offline, host, handle, opened, freshList };
  }

  it('leaves a list saying “Loading…” in its place while it is asked for again, then the records could not be loaded, with Retry; Retry brings it in place', async () => {
    await jest.isolateModulesAsync(async () => {
      const { offline, host, handle, freshList } = await offlineList();
      expect(freshList.loaded).toBeUndefined();
      expect(handle.element.hasAttribute('aria-busy')).toBe(false);
      // The page round it is drawn; in the list's place, its words while the part is asked for again.
      const holder = host.querySelector('.fd-list[data-node="list"]') as HTMLElement;
      expect(holder.querySelector('.fd-list-waiting')?.textContent).toBe('Loading…');
      expect(holder.querySelector('.fd-list-waiting')?.getAttribute('role')).toBe('status');
      expect(holder.getAttribute('aria-busy')).toBe('true');
      // It could not come again: the list's own words, and Retry.
      await until(() => !holder.hasAttribute('aria-busy'));
      const failed = holder.querySelector('.fd-list-failed') as HTMLElement;
      expect(failed.hidden).toBe(false);
      expect(failed.getAttribute('role')).toBe('alert');
      expect(failed.textContent).toContain('Could not load the records.');
      expect((holder.querySelector('.fd-list-waiting') as HTMLElement).hidden).toBe(true);
      // Back online: Retry asks again, "Loading…" meanwhile, and the list takes the holder's place.
      offline.now = false;
      (failed.querySelector('button') as HTMLButtonElement).click();
      expect((holder.querySelector('.fd-list-waiting') as HTMLElement).hidden).toBe(false);
      await until(() => host.querySelectorAll('.fd-list-table tbody tr.fd-list-row').length === 2);
      expect(freshList.loaded).toBeDefined();
      expect(holder.isConnected).toBe(false);
      expect(host.querySelectorAll('.fd-list[data-node="list"]')).toHaveLength(1);
      expect(host.querySelector('.fd-list-waiting')).toBeNull();
      // The app's reload is the list's own now.
      await handle.reload();
      expect(host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')).toHaveLength(2);
      jest.dontMock('./list-part');
    });
  });

  it('opens a record the app asks for once the list has come, asking for the part again', async () => {
    await jest.isolateModulesAsync(async () => {
      const { offline, host, handle, opened } = await offlineList();
      await until(() => !host.querySelector('.fd-list[data-node="list"]')?.hasAttribute('aria-busy'));
      offline.now = false;
      await handle.openRecord(2, { lit: false });
      expect(opened).toEqual([2]);
      expect(host.querySelector('.fd-list-table')).not.toBeNull();
      jest.dontMock('./list-part');
    });
  });
});
