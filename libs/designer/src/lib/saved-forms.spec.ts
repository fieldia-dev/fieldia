import type { FormNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore, pageChecks, type PageStore } from './designer';

/**
 * A saved form placed in the page being designed: picked from the app's
 * saved forms (the store's `list()`), its answers under a name of its own,
 * the latest version or one kept to, refused when it would hold the page
 * itself; and what is wrong with one in the Checks list.
 */

const address = (street = 'Street'): Page => ({
  fieldia: '0.1',
  id: 'address',
  title: 'Address',
  data: { kind: 'responses' },
  fields: { street: { type: 'char', label: street, required: true }, city: { type: 'char', label: 'City' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 'where', columns: 2, children: [{ type: 'field', id: 'street', field: 'street' }, { type: 'field', id: 'city', field: 'city' }] }] },
});

/** A saved form that places the page being designed: placing it there would place that page inside itself. */
const contact: Page = {
  fieldia: '0.1',
  id: 'contact',
  title: 'Contact person',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'name', field: 'name' }, { type: 'form', id: 'visit', page: 'site-visit', name: 'visit' }] },
};

async function setUp(options: { list?: boolean; openForm?: (id: string) => void } = {}) {
  const store = createMemoryPageStore();
  await store.publish(address('Street'));
  await store.publish(address('Street and number'));
  await store.publish(contact);
  // A draft never published is no saved form to place.
  await store.saveDraft({ ...address(), id: 'draft-only', title: 'Draft only' });
  const used: PageStore = options.list === false ? { load: store.load, saveDraft: store.saveDraft, publish: store.publish } : store;
  const designer = createDesigner({ page: blankPage('screen', 'Site visit'), store: used, openForm: options.openForm });
  const name = designer.addQuestion('short-answer', { parent: 'section-1' }) as string;
  designer.updateQuestion(name, { label: 'Visitor' });
  return { designer, store };
}

const parts = (page: Page) => ((page.layout as { children: SectionNode[] }).children[0].children.filter((n) => n.type === 'form') as FormNode[]);

describe('placing a saved form', () => {
  it('lists the store’s saved forms, published ones only, never the page itself', async () => {
    const { designer, store } = await setUp();
    expect(designer.canPlaceForms()).toBe(true);
    await store.publish(designer.getPage());
    expect(await designer.savedForms()).toEqual([
      { id: 'address', title: 'Address' },
      { id: 'contact', title: 'Contact person' },
    ]);
  });

  it('cannot place one when the store does not list its pages', async () => {
    const { designer } = await setUp({ list: false });
    expect(designer.canPlaceForms()).toBe(false);
    expect(await designer.savedForms()).toEqual([]);
  });

  it('places one where asked, its answers under a name of its own, and picks it; a second copy takes another name', async () => {
    const { designer } = await setUp();
    const first = designer.addForm('address', { parent: 'section-1' }) as string;
    expect(designer.getState().selected).toBe(first);
    const second = designer.addForm('address', { after: first }) as string;
    expect(parts(designer.getPage()).map(({ id, page, name }) => ({ id, page, name }))).toEqual([
      { id: first, page: 'address', name: 'address' },
      { id: second, page: 'address', name: 'address_2' },
    ]);
    designer.undo();
    expect(parts(designer.getPage())).toHaveLength(1);
  });

  it('knows a saved form once loaded: its versions, and the page of the one kept to', async () => {
    const { designer } = await setUp();
    const heard: number[] = [];
    designer.subscribe(() => heard.push(1));
    expect(designer.savedForm('address')).toBeUndefined();
    await designer.loadSavedForm('address');
    // Its listeners were told, so a canvas waiting for it draws it.
    expect(heard.length).toBeGreaterThan(0);
    const latest = designer.savedForm('address');
    expect(latest?.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(latest?.page?.fields['street'].label).toBe('Street and number');
    expect(designer.savedForm('address', 1)?.page?.fields['street'].label).toBe('Street');
    expect(designer.savedForm('address', 9)?.page).toBeNull();
    await designer.loadSavedForm('nowhere');
    expect(designer.savedForm('nowhere')).toBeNull();
  });

  it('keeps to a version, or the latest again; takes another saved form, a name and a title of its own', async () => {
    const { designer } = await setUp();
    const id = designer.addForm('address', { parent: 'section-1' }) as string;
    expect(designer.setForm(id, { version: 1 })).toBe(true);
    expect(parts(designer.getPage())[0].version).toBe(1);
    expect(designer.setForm(id, { version: null })).toBe(true);
    expect(parts(designer.getPage())[0].version).toBeUndefined();
    expect(designer.setForm(id, { name: 'home', title: 'Home address' })).toBe(true);
    expect(parts(designer.getPage())[0]).toMatchObject({ name: 'home', title: 'Home address' });
    // An empty title shows none; null gives the saved form's own back.
    designer.setForm(id, { title: '' });
    expect(parts(designer.getPage())[0].title).toBe('');
    designer.setForm(id, { title: null });
    expect(parts(designer.getPage())[0].title).toBeUndefined();
  });

  it('refuses a name a field or another copy has, and one that is no name, saying why', async () => {
    const { designer } = await setUp();
    const first = designer.addForm('address', { parent: 'section-1' }) as string;
    const second = designer.addForm('address', { parent: 'section-1' }) as string;
    const field = Object.keys(designer.getPage().fields)[0];
    expect(designer.setForm(second, { name: 'address' })).toBe(false);
    expect(designer.getState().issues.join(' ')).toContain('give each copy a name of its own');
    expect(designer.setForm(first, { name: field })).toBe(false);
    expect(designer.getState().issues.join(' ')).toContain('is a field of this page');
    expect(designer.setForm(first, { name: 'home address' })).toBe(false);
    expect(designer.getState().issues).toEqual(['Where its answers go is a name of letters, digits and _, starting with a letter: “home_address”, say']);
  });

  it('gives a new field a name no copy’s answers have', async () => {
    const { designer } = await setUp();
    const id = designer.addForm('address', { parent: 'section-1' }) as string;
    designer.setForm(id, { name: 'q_2' });
    expect(Object.keys(designer.getPage().fields)).toEqual(['q_1']);
    const added = designer.addQuestion('short-answer', { parent: 'section-1' });
    expect(added).not.toBe(false);
    expect(Object.keys(designer.getPage().fields)).toEqual(['q_1', 'q_3']);
  });

  it('refuses a saved form that holds this page, once it has loaded, naming the way round', async () => {
    const { designer } = await setUp();
    await designer.loadSavedForm('contact');
    expect(designer.addForm('contact', { parent: 'section-1' })).toBe(false);
    expect(designer.getState().issues).toEqual(['“Contact person” holds this page: it would be placed inside itself (Site visit → Contact person → Site visit)']);
    const id = designer.addForm('address', { parent: 'section-1' }) as string;
    expect(designer.setForm(id, { page: 'contact' })).toBe(false);
    expect(parts(designer.getPage())[0].page).toBe('address');
    // The page itself is never offered, and never placed.
    expect(designer.addForm('site-visit')).toBe(false);
  });

  it('opens a saved form where it is made, when the app gave a way to', async () => {
    const opened: string[] = [];
    expect((await setUp()).designer.canOpenForm()).toBe(false);
    const { designer } = await setUp({ openForm: (id) => opened.push(id) });
    expect(designer.canOpenForm()).toBe(true);
    designer.openForm('address');
    expect(opened).toEqual(['address']);
  });
});

describe('what the Checks list says of a saved form', () => {
  it('names one the store cannot find, a version it has not got, and one that would hold the page', async () => {
    const { designer, store } = await setUp();
    const gone = designer.addForm('address', { parent: 'section-1' }) as string;
    designer.setForm(gone, { page: 'nowhere' });
    const old = designer.addForm('address', { parent: 'section-1' }) as string;
    designer.setForm(old, { version: 7 });
    // Placed while it did not yet hold this page; it does now.
    const loop = designer.addForm('address', { parent: 'section-1' }) as string;
    await store.publish({ ...contact, id: 'address', title: 'Address' });
    await designer.loadSavedForm('nowhere');
    await designer.loadSavedForm('address');
    const checks = designer.checks().filter((c) => [gone, old, loop].includes(c.at as string));
    expect(checks.map(({ at, severity, text }) => ({ at, severity, text }))).toEqual([
      { at: gone, severity: 'must', text: 'The saved form “nowhere” cannot be found: the form would say so in its place.' },
      { at: old, severity: 'must', text: '“Address” has no version 7: the form would say it cannot be found.' },
      { at: loop, severity: 'must', text: '“Address” holds this page: it would be placed inside itself (Site visit → Address → Site visit).' },
    ]);
    expect(checks[0].fix).toEqual({ label: 'Take it off the page', action: { kind: 'remove', id: gone } });
  });

  it('names copies whose answers would mix, on a page written by hand', () => {
    const page = blankPage('screen', 'Two copies');
    (page.layout as { children: SectionNode[] }).children[0].children.push(
      { type: 'form', id: 'one', page: 'address', name: 'home' },
      { type: 'form', id: 'two', page: 'address', name: 'home' }
    );
    const checks = pageChecks(page).filter((c) => c.at === 'two');
    expect(checks.map((c) => c.text)).toEqual(['Two saved forms keep their answers under “home”: their answers would mix. Give each copy a name of its own.']);
  });
});
