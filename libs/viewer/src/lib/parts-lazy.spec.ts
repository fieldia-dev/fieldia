import { createMemoryDataSource, type Page } from '@fieldia/core';
import { datePart, filesPart, pathPart, textPart, type WidgetFactory } from '@fieldia/widgets';
import { openFormDialog } from './dialog';
import { BUG, VALUES } from './test-head';
import { mountViewer, type ViewerHandle } from './viewer';
import { filtersPart, headPart, partsFor } from './viewer-parts';

/**
 * Before its parts have come (parts.ts in @fieldia/widgets): a page that uses
 * none is drawn at once and asks for none; a page that draws from one — a
 * record's head, a split button, a work heading, a work item's text, a path
 * picker, a filter bar — is drawn whole once its parts have come, nothing of
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
    for (const part of [headPart, filtersPart, textPart, pathPart, datePart, filesPart]) expect(part.loaded).toBeUndefined();
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
    expect(partsFor(page({ type: 'list', id: 'l', columns: [], search: 'fields', filterFields: [] }))).toEqual([filtersPart]);
    // A work item's bug: its head (its Changed Date is words in the head's "Updated by", no box).
    expect(partsFor(BUG)).toEqual([headPart]);
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
    // A table's lines draw each cell with its column's box: a date column, a time column.
    expect(partsFor(page(sections(field('lines')), fields))).toEqual([datePart]);
    expect(partsFor(page(sections(field('plain')), fields))).toEqual([]);
    expect(partsFor(page(sections(field('plain', { cells: { slot: { widget: 'time' } } })), fields))).toEqual([datePart]);
    // A property may be a date: one added in place, or worked out from its value, may be one whatever the page names.
    expect(partsFor(page(sections(field('props')), fields))).toEqual([datePart]);
    // A plain char: none. The app's own date box: none.
    expect(partsFor(page(sections(field('slot')), fields))).toEqual([]);
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(partsFor(page(sections(field('due'), field('lines')), fields), { date: own })).toEqual([]);
  });

  it('the files part for a file, a picture, a signature or a PDF, wherever its box is drawn: a field, a table’s lines, a record’s avatar — never a property', () => {
    const fields = {
      photo: { type: 'image', label: 'Photo' },
      docs: { type: 'binary', label: 'Documents', multiple: true },
      sign: { type: 'binary', label: 'Signed by' },
      name: { type: 'char', label: 'Name' },
      lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { name: { type: 'char', label: 'Name' }, photo: { type: 'image', label: 'Photo' } } },
      plain: { type: 'one2many', label: 'Plain lines', relation: 'line', fields: { name: { type: 'char', label: 'Name' } } },
      props: { type: 'properties', label: 'Properties', definitions: [{ name: 'note', label: 'Note', type: 'char' }] },
    };
    const field = (name: string, more: Record<string, unknown> = {}) => ({ type: 'field', id: `f-${name}`, field: name, ...more });
    expect(partsFor(page(sections(field('photo')), fields))).toEqual([filesPart]);
    expect(partsFor(page(sections(field('docs')), fields))).toEqual([filesPart]);
    expect(partsFor(page(sections(field('sign', { widget: 'signature' })), fields))).toEqual([filesPart]);
    expect(partsFor(page(sections(field('docs', { widget: 'pdf' })), fields))).toEqual([filesPart]);
    // A table's lines draw each cell with its column's widget: a photo in a line's cell.
    expect(partsFor(page(sections(field('lines')), fields))).toEqual([filesPart]);
    expect(partsFor(page(sections(field('plain')), fields))).toEqual([]);
    // A record's avatar beside its title: a picture field the sheet names, rather than places.
    expect(partsFor(page({ type: 'sheet', id: 'r', title: { field: 'name', avatarField: 'photo' }, children: [] }, fields))).toEqual([filesPart]);
    expect(partsFor(page({ type: 'sheet', id: 'r', title: { field: 'name' }, children: [] }, fields))).toEqual([]);
    // A property holds no file: its rows ask for a date's part alone.
    expect(partsFor(page(sections(field('props')), fields))).toEqual([datePart]);
    expect(partsFor(page(sections(field('name')), fields))).toEqual([]);
    // The app's own file box: none.
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(partsFor(page(sections(field('photo'), field('lines')), fields), { image: own })).toEqual([]);
  });

  it('a page with a photo: nothing of it drawn until the files part has come, then its file box, the photo and the record’s files in it', async () => {
    const fields = { photo: { type: 'image', label: 'Photo' }, docs: { type: 'binary', label: 'Documents', multiple: true } };
    const photo = { name: 'Face.png', type: 'image/png', size: 3, url: 'https://files.example/face.png' };
    const docs = [{ name: 'Lease.pdf', type: 'application/pdf', size: 4, url: 'https://files.example/lease.pdf' }];
    const dataSource = createMemoryDataSource({ records: { x: { 1: { photo, docs } } } });
    expect(filesPart.loaded).toBeUndefined();
    const { host, handle } = mount(page(sections({ type: 'field', id: 'f-photo', field: 'photo' }, { type: 'field', id: 'f-docs', field: 'docs' }), fields), { dataSource, recordId: 1 });
    expect(handle.element.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('[data-node]')).toBeNull();
    await handle.drawn;
    await handle.form.settled();
    expect(filesPart.loaded).toBeDefined();
    expect(handle.element.hasAttribute('aria-busy')).toBe(false);
    expect(host.querySelector('[data-fd-plain]')).toBeNull();
    expect(host.querySelector('[data-node="f-photo"] .fd-file.fd-file-image img.fd-file-thumb')?.getAttribute('src')).toBe('https://files.example/face.png');
    expect(host.querySelector('[data-node="f-docs"] .fd-file .fd-file-name')?.getAttribute('title')).toBe('Lease.pdf');
    expect(document.getElementById('fieldia-files-styles')).not.toBeNull();
  });

  it('a sheet drawn once its part came keeps its save’s status where the page put it: across the top, or in a corner', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mountViewer: fresh } = await import('./viewer');
      const { filesPart: freshFiles } = await import('@fieldia/widgets');
      const sheet = page({ type: 'sheet', id: 'r', children: [{ type: 'field', id: 'f-photo', field: 'photo' }] }, { photo: { type: 'image', label: 'Photo' } });
      expect(freshFiles.loaded).toBeUndefined();
      for (const saveStatus of ['bar', 'toast'] as const) {
        const host = document.createElement('div');
        document.body.append(host);
        const handle = fresh(host, { page: sheet, saveStatus });
        handles.push(handle);
        await handle.drawn;
        const status = host.querySelector('.fd-status-box') as HTMLElement;
        expect(host.querySelector('.fd-file')).not.toBeNull();
        // Never beside Save in the sheet's header, where the page drawn after it would have put it.
        expect(status.closest('.fd-actions')).toBeNull();
        if (saveStatus === 'bar') expect(host.querySelector('.fd-content')?.firstElementChild).toBe(status);
        else expect(status.parentElement).toBe(handle.element);
      }
    });
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
});
