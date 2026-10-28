import { createMemoryDataSource, type Page } from '@fieldia/core';
import { businessPart, choicePart, datePart, evidencePart, filesPart, linesPart, pathPart, photosPart, quietPart, relationsPart, slotsPart, surveyPart, textPart, themesPart, type WidgetFactory } from '@fieldia/widgets';
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
  ({ fieldia: '0.13', id: 'p', title: 'P', data: { kind: 'record', model: 'x' }, fields, layout }) as unknown as Page;
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
    for (const part of [headPart, listPart, filtersPart, textPart, pathPart, datePart, linesPart, businessPart, filesPart, evidencePart, photosPart, surveyPart, slotsPart, themesPart, quietPart]) expect(part.loaded).toBeUndefined();
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
    // The classic formatted text: no part. The plain many2one: its box, the relations part's.
    expect(partsFor(page(sections({ type: 'field', id: 'f', field: 'notes' }), fields))).toEqual([]);
    expect(partsFor(page(sections({ type: 'field', id: 'f', field: 'notes' }, { type: 'field', id: 'g', field: 'area' }), fields))).toEqual([relationsPart]);
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
    // (Properties themselves are drawn by the survey part.)
    expect(partsFor(page(sections(field('props')), fields))).toEqual([surveyPart, datePart]);
    // A plain char: none. The app's own date box: none.
    expect(partsFor(page(sections(field('slot')), fields))).toEqual([]);
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(partsFor(page(sections(field('due'), field('lines')), fields), { date: own })).toEqual([linesPart]);
    // Booking slots: their own part, which brings the date part with it (its box where the source has no slots).
    expect(partsFor(page(sections(field('at', { widget: 'slots', options: { schedule: 'clinic' } })), fields))).toEqual([slotsPart]);
    expect(partsFor(page(sections(field('at', { widget: 'slots' })), fields), { 'datetime.slots': own })).toEqual([]);
  });

  it('the evidence part beside the files part for a signature that signs answers — never for a plain signature, a file or a photo', () => {
    const fields = { name: { type: 'char', label: 'Name' }, sign: { type: 'binary', label: 'Signature' }, docs: { type: 'binary', label: 'Documents' }, photo: { type: 'image', label: 'Photo' } };
    const signature = (options?: Record<string, unknown>) => ({ type: 'field', id: 'f-sign', field: 'sign', widget: 'signature', ...(options ? { options } : {}) });
    expect(partsFor(page(sections(signature({ signs: 'form' })), fields))).toEqual([filesPart, evidencePart]);
    expect(partsFor(page(sections({ type: 'field', id: 'f-name', field: 'name' }, signature({ signs: ['name'], signerField: 'name', penWidth: 5 })), fields))).toEqual([filesPart, evidencePart]);
    // A picture, as before: its pen, its words, an upload — or signs of nothing.
    expect(partsFor(page(sections(signature()), fields))).toEqual([filesPart]);
    expect(partsFor(page(sections(signature({ penWidth: 5, upload: true })), fields))).toEqual([filesPart]);
    expect(partsFor(page(sections(signature({ signs: [] })), fields))).toEqual([filesPart]);
    expect(partsFor(page(sections({ type: 'field', id: 'f-docs', field: 'docs' }, { type: 'field', id: 'f-photo', field: 'photo' }), fields))).toEqual([filesPart]);
    // The app's own signature: neither.
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(partsFor(page(sections(signature({ signs: 'form' })), fields), { 'binary.signature': own })).toEqual([]);
  });

  it('the photos part for a photo set, which brings the files part — never for a plain picture field', () => {
    const fields = { photos: { type: 'image', label: 'Photos', multiple: true }, photo: { type: 'image', label: 'Photo' }, docs: { type: 'binary', label: 'Documents', multiple: true } };
    const set = { type: 'field', id: 'f-photos', field: 'photos', widget: 'photos', options: { captions: true } };
    expect(partsFor(page(sections(set), fields))).toEqual([photosPart]);
    expect(partsFor(page(sections(set, { type: 'field', id: 'f-docs', field: 'docs' }), fields))).toEqual([photosPart, filesPart]);
    expect(partsFor(page(sections({ type: 'field', id: 'f-photos', field: 'photos' }), fields))).toEqual([filesPart]);
    // The app's own set: neither.
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(partsFor(page(sections(set), fields), { 'image.photos': own })).toEqual([]);
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
    expect(host.querySelector('.fd-list > .fd-loader')).toBeNull();
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

  it('the business part for a business widget, wherever it is drawn: a field, a table’s lines, a sheet’s statusbar — never a headed sheet’s', () => {
    const fields = {
      state: { type: 'selection', label: 'State', options: [{ value: 'draft', label: 'Draft' }, { value: 'done', label: 'Done' }] },
      stage: { type: 'many2one', label: 'Stage', relation: 'stage' },
      hours: { type: 'float', label: 'Hours' },
      split: { type: 'json', label: 'Analytic' },
      lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { name: { type: 'char', label: 'Name' }, hours: { type: 'float', label: 'Hours' } } },
    };
    const field = (name: string, more: Record<string, unknown> = {}) => ({ type: 'field', id: `f-${name}`, field: name, ...more });
    for (const [name, widget] of [['state', 'statusbar'], ['stage', 'statusbar'], ['state', 'priority'], ['hours', 'duration'], ['hours', 'percentage'], ['split', 'distribution'], ['split', 'tax-totals'], ['split', 'payments']]) {
      // An analytic distribution's lines each draw a link's box: the relations part beside the business part.
      expect(partsFor(page(sections(field(name, { widget })), fields))).toEqual(widget === 'distribution' ? [businessPart, relationsPart] : [businessPart]);
    }
    // A table's lines draw each cell with its column's widget: hours in a column.
    // A table's own part first (the lines part), then its cells'.
    expect(partsFor(page(sections(field('lines', { cells: { hours: { widget: 'duration' } } })), fields))).toEqual([linesPart, businessPart]);
    // A sheet's statusbar is drawn as a field's with the statusbar widget.
    const sheet = (more: Record<string, unknown> = {}) => page({ type: 'sheet', id: 'sheet', title: { field: 'name' }, statusbar: { field: 'state' }, children: [], ...more }, { ...fields, name: { type: 'char', label: 'Name' } });
    expect(partsFor(sheet())).toEqual([businessPart]);
    expect(partsFor(sheet({ statusbar: { field: 'stage', clickable: true } }))).toEqual([businessPart]);
    // None: the same fields plainly (a stage a link's box, the relations part's), a state's dot (the main script's), a sheet
    // with no statusbar, the app's own statusbar, a headed sheet (its state is its head's).
    expect(partsFor(page(sections(field('state'), field('stage'), field('hours'), field('split'), field('lines'), field('state', { widget: 'dot' })), fields))).toEqual([relationsPart, linesPart]);
    expect(partsFor(sheet({ statusbar: undefined }))).toEqual([]);
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(partsFor(sheet(), { 'selection.statusbar': own })).toEqual([]);
    expect(partsFor(BUG)).toEqual([headPart, quietPart]);
  });

  it('a sheet with a statusbar: nothing of it drawn until the business part has come, then its statusbar, the record’s state current', async () => {
    const fields = { name: { type: 'char', label: 'Name' }, state: { type: 'selection', label: 'State', options: [{ value: 'draft', label: 'Draft' }, { value: 'done', label: 'Done' }] } };
    const dataSource = createMemoryDataSource({ records: { x: { 1: { name: 'Lot 7', state: 'done' } } } });
    expect(businessPart.loaded).toBeUndefined();
    const { host, handle } = mount(page({ type: 'sheet', id: 'sheet', title: { field: 'name' }, statusbar: { field: 'state', clickable: true }, children: [] }, fields), { dataSource, recordId: 1 });
    expect(handle.element.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('.fd-header')).toBeNull();
    await handle.drawn;
    await handle.form.settled();
    expect(businessPart.loaded).toBeDefined();
    expect(handle.element.hasAttribute('aria-busy')).toBe(false);
    expect([...host.querySelectorAll('.fd-header .fd-statusbar li')].map((li) => li.textContent)).toEqual(['Draft', 'Done']);
    expect(host.querySelector('.fd-header .fd-statusbar [aria-current="step"]')?.textContent).toBe('Done');
    expect(host.querySelector('[data-fd-plain]')).toBeNull();
    // Its stylesheet among Fieldia's, first of the parts', before the page's own looks.
    const sheets = [...document.head.querySelectorAll('style')].map((style) => style.id);
    expect(sheets.indexOf('fieldia-business-styles')).toBe(sheets.indexOf('fieldia-styles') + 1);
    expect(sheets.indexOf('fieldia-business-styles')).toBeLessThan(sheets.indexOf('fieldia-styles-looks'));
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
    expect(partsFor(page(sections(field('lines')), fields))).toEqual([linesPart, filesPart]);
    expect(partsFor(page(sections(field('plain')), fields))).toEqual([linesPart]);
    // A record's avatar beside its title: a picture field the sheet names, rather than places.
    expect(partsFor(page({ type: 'sheet', id: 'r', title: { field: 'name', avatarField: 'photo' }, children: [] }, fields))).toEqual([filesPart]);
    expect(partsFor(page({ type: 'sheet', id: 'r', title: { field: 'name' }, children: [] }, fields))).toEqual([]);
    // A property holds no file: a properties field asks for its own part (the survey kinds') and a date's.
    expect(partsFor(page(sections(field('props')), fields))).toEqual([surveyPart, datePart]);
    expect(partsFor(page(sections(field('name')), fields))).toEqual([]);
    // The app's own file box: none.
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(partsFor(page(sections(field('photo'), field('lines')), fields), { image: own })).toEqual([linesPart]);
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

  it('the relations part for a link to other records, wherever its box is drawn; the choice part for a long choice or tags, a property’s too', () => {
    const many = Array.from({ length: 16 }, (_, i) => ({ value: String(i), label: `Floor ${i}` }));
    const fields = {
      partner: { type: 'many2one', label: 'Customer', relation: 'partner' },
      tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
      labels: { type: 'char', label: 'Labels' },
      doc: { type: 'reference', label: 'Document', models: [{ value: 'partner', label: 'Customer' }] },
      floor: { type: 'selection', label: 'Floor', options: many },
      rooms: { type: 'selection', label: 'Rooms', multiple: true, options: [{ value: 'a', label: 'A' }] },
      lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { partner: { type: 'many2one', label: 'Customer', relation: 'partner' } } },
      short: { type: 'properties', label: 'Short', definitions: [{ name: 'size', label: 'Size', type: 'selection', options: [{ value: 's', label: 'S' }] }] },
      long: { type: 'properties', label: 'Long', definitions: [{ name: 'floor', label: 'Floor', type: 'selection', options: many }] },
      given: { type: 'properties', label: 'Given', definitionsFrom: { list: 'definitions' } },
    };
    const field = (name: string, more: Record<string, unknown> = {}) => ({ type: 'field', id: `f-${name}`, field: name, ...more });
    for (const shown of [field('partner'), field('tag_ids'), field('tag_ids', { widget: 'checkboxes' }), field('labels', { widget: 'tags' }), field('doc')]) {
      expect(partsFor(page(sections(shown), fields))).toEqual([relationsPart]);
    }
    // A table's cell drawn with its column's widget: a link's box.
    expect(partsFor(page(sections(field('lines')), fields))).toEqual([linesPart, relationsPart]);
    // A path picker is its own part's; the app's own link box needs none.
    expect(partsFor(page(sections(field('partner', { widget: 'path' })), fields))).toEqual([pathPart]);
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(partsFor(page(sections(field('partner')), fields), { many2one: own })).toEqual([]);
    // A long choice, searched, and several chosen as tags: the choice part's; a short choice or one not searched, none.
    expect(partsFor(page(sections(field('floor')), fields))).toEqual([choicePart]);
    expect(partsFor(page(sections(field('rooms', { widget: 'tags' })), fields))).toEqual([choicePart]);
    expect(partsFor(page(sections(field('floor', { options: { search: false } }), field('rooms')), fields))).toEqual([]);
    // Properties: the survey part's, a date's part — and the choice part where one may be a long choice: a definition of
    // the page's own, or any the data source gives.
    expect(partsFor(page(sections(field('short')), fields))).toEqual([surveyPart, datePart]);
    expect(partsFor(page(sections(field('long')), fields))).toEqual([surveyPart, datePart, choicePart]);
    expect(partsFor(page(sections(field('given')), fields))).toEqual([surveyPart, datePart, choicePart]);
  });

  it('the survey part for a ranking, a matrix, a slider, pictures, a colour, properties, an address or a progress bar, wherever drawn: a field, a table’s cells', () => {
    const options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
    const fields = {
      order: { type: 'selection', label: 'Order', multiple: true, options },
      desk: { type: 'selection', label: 'Desk', options },
      days: { type: 'integer', label: 'Days', min: 0, max: 5 },
      rooms: { type: 'matrix', label: 'Rooms', rows: options, columns: options },
      tag: { type: 'integer', label: 'Tag' },
      home: { type: 'json', label: 'Home' },
      extra: { type: 'properties', label: 'Extra', definitions: [{ name: 'note', label: 'Note', type: 'char' }] },
      lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { name: { type: 'char', label: 'Name' }, done: { type: 'integer', label: 'Done' }, tag: { type: 'integer', label: 'Tag' } } },
    };
    const field = (name: string, more: Record<string, unknown> = {}) => ({ type: 'field', id: `f-${name}`, field: name, ...more });
    for (const shown of [
      field('order', { widget: 'ranking' }),
      field('desk', { widget: 'image-choice' }),
      field('days', { widget: 'slider' }),
      field('rooms'),
      field('tag', { widget: 'color' }),
      field('home', { widget: 'address' }),
      field('days', { widget: 'progressbar' }),
      field('lines', { cells: { done: { widget: 'progressbar' } } }),
      field('lines', { cells: { tag: { widget: 'color' } } }),
    ])
      expect(partsFor(page(sections(shown), fields))).toEqual(shown.field === 'lines' ? [linesPart, surveyPart] : [surveyPart]);
    expect(partsFor(page(sections(field('extra')), fields))).toEqual([surveyPart, datePart]);
    // Their neighbours in the main script, and a page of them all asking once.
    expect(partsFor(page(sections(field('order'), field('desk'), field('days'), field('days', { widget: 'rating' }), field('tag'), field('home'), field('lines')), fields))).toEqual([linesPart]);
    expect(partsFor(page(sections(field('order', { widget: 'ranking' }), field('rooms'), field('home', { widget: 'address' })), fields))).toEqual([surveyPart]);
    // The app's own widget for the kind: none.
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(partsFor(page(sections(field('rooms')), fields), { matrix: own })).toEqual([]);
  });

  it('a page with a matrix: nothing of it drawn until the survey part has come, then the matrix with its answers', async () => {
    const options = [{ value: 'a', label: 'Poor' }, { value: 'b', label: 'Good' }];
    const fields = { name: { type: 'char', label: 'Name' }, rooms: { type: 'matrix', label: 'Rooms', rows: [{ value: 'k', label: 'Kitchen' }], columns: options } };
    const dataSource = createMemoryDataSource({ records: { x: { 1: { name: 'Sara', rooms: { k: 'b' } } } } });
    expect(surveyPart.loaded).toBeUndefined();
    const { host, handle } = mount(page(sections({ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-rooms', field: 'rooms' }), fields), { dataSource, recordId: 1 });
    expect(handle.element.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('[data-node]')).toBeNull();
    await handle.drawn;
    await handle.form.settled();
    expect(surveyPart.loaded).toBeDefined();
    expect(handle.element.hasAttribute('aria-busy')).toBe(false);
    expect((host.querySelector('[data-node="f-rooms"] .fd-matrix-table input:checked') as HTMLInputElement).getAttribute('aria-label')).toBe('Kitchen: Good');
    expect(document.getElementById('fieldia-survey-styles')).not.toBeNull();
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
    expect((host.querySelector('[data-node="#title"] textarea') as HTMLTextAreaElement).value).toBe(VALUES.title);
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
    // A dialog's own code (the acts part) in, as on a page once it is drawn: what comes later here is the look's.
    await (await import('./viewer-parts')).actsPart.load();
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
      // Said once over the page: the head has no place of its own to say it. An app's modules, kept failed by the
      // browser for the page's life: a reload brings it.
      const said = host.querySelector('.fd-parts-unloaded') as HTMLElement;
      expect(said.hidden).toBe(false);
      expect(said.getAttribute('role')).toBe('status');
      expect(said.textContent).toBe('Part of this page could not load, so it is shown plainly. Reload the page and try again.');
      expect(host.querySelectorAll('.fd-parts-unloaded')).toHaveLength(1);
      handle.destroy();
      jest.dontMock('./head-part');
    });
  });

  it('says nothing over a page whose parts all came', async () => {
    const { host } = mount(PLAIN);
    await until(() => host.querySelector('[data-node="f-name"]'));
    expect((host.querySelector('.fd-parts-unloaded') as HTMLElement).hidden).toBe(true);
  });

  /** A date field's page in a viewer of its own, whose date part cannot come while `offline.now` holds. */
  async function offlineDate(byScriptTag: boolean) {
    const offline = { now: true };
    jest.doMock('../../../widgets/src/lib/date-part', () => {
      if (offline.now) throw new Error('offline');
      return jest.requireActual('../../../widgets/src/lib/date-part');
    });
    if (byScriptTag) (await import('@fieldia/core')).partsComeByScriptTag();
    const { mountViewer: fresh } = await import('./viewer');
    const { datePart: freshDate } = await import('@fieldia/widgets');
    const host = document.createElement('div');
    document.body.append(host);
    const shown = page(sections({ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-due', field: 'due' }), { name: { type: 'char', label: 'Name' }, due: { type: 'date', label: 'Due' } });
    const handle = fresh(host, { page: shown, dataSource: createMemoryDataSource() });
    handles.push(handle);
    await handle.drawn;
    const field = host.querySelector('[data-node="f-due"]') as HTMLElement;
    await until(() => field.querySelector('.fd-part-unloaded'));
    return { offline, host, field, freshDate, note: field.querySelector('.fd-part-unloaded') as HTMLElement };
  }

  it('leaves a field whose box it draws plain, and working, and says so under it — a reload, where asking again cannot bring it', async () => {
    await jest.isolateModulesAsync(async () => {
      const { host, field, freshDate, note } = await offlineDate(false);
      expect(freshDate.loaded).toBeUndefined();
      // The plain box, which works; said under it, before its error, and nowhere over the page (the field says it).
      const box = field.querySelector('input') as HTMLInputElement;
      expect(box.classList.contains('fd-date')).toBe(true);
      expect(note.textContent).toBe('Part of this field could not load, so it is shown plainly. Reload the page and try again.');
      expect(note.getAttribute('role')).toBe('status');
      expect(note.nextElementSibling?.classList.contains('fd-error')).toBe(true);
      expect(note.querySelector('button')).toBeNull();
      expect((host.querySelector('.fd-parts-unloaded') as HTMLElement).hidden).toBe(true);
      jest.dontMock('../../../widgets/src/lib/date-part');
    });
  });

  it('with one script tag, Retry under the field asks for its part again: its box in the plain one’s place, the note gone', async () => {
    await jest.isolateModulesAsync(async () => {
      const { offline, field, freshDate, note } = await offlineDate(true);
      const retry = note.querySelector('button') as HTMLButtonElement;
      expect(note.textContent).toBe('Part of this field could not load, so it is shown plainly. Retry');
      // Still offline: said again.
      retry.click();
      expect(note.hidden).toBe(true);
      await until(() => !note.hidden);
      expect(field.querySelectorAll('.fd-part-unloaded')).toHaveLength(1);
      // Back online: the date part's box in place, said no more.
      offline.now = false;
      retry.click();
      await until(() => freshDate.loaded && field.querySelector('.fd-date-pick'));
      expect(note.hidden).toBe(true);
      jest.dontMock('../../../widgets/src/lib/date-part');
    });
  });

  it('Ctrl+Z whose undo part cannot come takes back nothing, and says so', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('./undo-part', () => {
        throw new Error('offline');
      });
      const { mountViewer: fresh } = await import('./viewer');
      const host = document.createElement('div');
      document.body.append(host);
      const handle = fresh(host, { page: PLAIN, dataSource: createMemoryDataSource() });
      handles.push(handle);
      await handle.drawn;
      const box = host.querySelector('[data-node="f-name"] input') as HTMLInputElement;
      box.focus();
      box.value = 'Nile';
      box.dispatchEvent(new Event('input', { bubbles: true }));
      box.dispatchEvent(new Event('change', { bubbles: true }));
      box.blur();
      host.querySelector<HTMLElement>('.fd-form')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }));
      await until(() => host.querySelector('.fd-says')?.textContent?.includes('Undo could not load.'));
      expect(host.querySelector('.fd-says .fd-say')?.textContent).toContain('Undo could not load. Reload the page and try again.');
      expect(box.value).toBe('Nile');
      jest.dontMock('./undo-part');
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

  it('leaves a list waiting in its place, the one way every wait is drawn, while it is asked for again, then the records could not be loaded, with Retry; Retry brings it in place', async () => {
    await jest.isolateModulesAsync(async () => {
      const { offline, host, handle, freshList } = await offlineList();
      expect(freshList.loaded).toBeUndefined();
      expect(handle.element.hasAttribute('aria-busy')).toBe(false);
      // The page round it is drawn; in the list's place, its first wait at once while the part is asked for again.
      const holder = host.querySelector('.fd-list[data-node="list"]') as HTMLElement;
      expect(holder.querySelector('.fd-loader')?.getAttribute('data-moment')).toBe('first');
      expect(holder.getAttribute('data-fd-wait')).toBe('first');
      expect(holder.getAttribute('aria-busy')).toBe('true');
      // It could not come again: the list's own words, and Retry; no loader left.
      await until(() => !holder.hasAttribute('aria-busy'));
      const failed = holder.querySelector('.fd-list-failed') as HTMLElement;
      expect(failed.hidden).toBe(false);
      expect(failed.getAttribute('role')).toBe('alert');
      expect(failed.textContent).toContain('Could not load the records.');
      expect(holder.querySelector('.fd-loader')).toBeNull();
      // Back online: Retry asks again, waiting meanwhile, and the list takes the holder's place.
      offline.now = false;
      (failed.querySelector('button') as HTMLButtonElement).click();
      expect(failed.hidden).toBe(true);
      expect(holder.getAttribute('aria-busy')).toBe('true');
      expect(holder.querySelector('.fd-loader')).not.toBeNull();
      // The list's own first wait goes on from the one in sight, its skeleton at once, its rows once it has been seen its minimum.
      await new Promise((done) => setTimeout(done, 350));
      await until(() => host.querySelectorAll('.fd-list-table tbody tr.fd-list-row').length === 2);
      expect(freshList.loaded).toBeDefined();
      expect(holder.isConnected).toBe(false);
      expect(host.querySelectorAll('.fd-list[data-node="list"]')).toHaveLength(1);
      expect(host.querySelector('.fd-list > .fd-loader')).toBeNull();
      // The app's reload is the list's own now.
      await handle.reload();
      expect(host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')).toHaveLength(2);
      jest.dontMock('./list-part');
    });
  });

  it('leaves a record’s related list said in its place, never an empty box: the records could not be loaded, and how to try again', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('./list-part', () => {
        throw new Error('offline');
      });
      const { mountViewer: fresh } = await import('./viewer');
      const host = document.createElement('div');
      document.body.append(host);
      const shown = page(
        sections({ type: 'field', id: 'f-name', field: 'name' }, { type: 'related', id: 'r-invoices', title: 'Invoices', model: 'invoice', field: 'partner_id', fields: { name: { type: 'char', label: 'Number' }, partner_id: { type: 'many2one', label: 'Customer', relation: 'x' } }, columns: ['name'] })
      );
      const handle = fresh(host, { page: shown, dataSource: createMemoryDataSource({ records: { x: { 1: { name: 'Nile Traders' } }, invoice: { 1: { name: 'INV/1', partner_id: 1 } } } }), recordId: 1 });
      handles.push(handle);
      await handle.drawn;
      const box = host.querySelector('[data-node="r-invoices"]') as HTMLElement;
      await until(() => box.querySelector('.fd-list-failed'));
      const failed = box.querySelector('.fd-list-failed') as HTMLElement;
      expect(failed.getAttribute('role')).toBe('alert');
      // An app's modules, kept failed for the page's life: a reload brings it, no Retry that could not.
      expect(failed.textContent).toBe('Could not load the records. Reload the page and try again.');
      // Said in its place: not over the page too.
      expect((host.querySelector('.fd-parts-unloaded') as HTMLElement).hidden).toBe(true);
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
