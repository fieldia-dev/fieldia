import { createMemoryDataSource, type Page } from '@fieldia/core';
import { installZonePromises } from '../../../../testing/zone-promises';
import { askAssistant, type DesignerAssistant } from './assistant';
import { elementFactory } from './chrome';
import { blankPage, createDesigner, createMemoryLookStore, createMemoryPageStore, type Designer, type LookStore, type PageStore } from './designer';
import { looksHub } from './look-hub';
import { button, field, mount, tile } from './test-editor';
import { tryIt, type TryIt } from './try-it';

/**
 * Every promise the designer is given by the app is handled the moment it is given — never when the designer first
 * awaits it — so one the app refused at once, or had refused already, is never said unhandled by a zone that watches
 * its own promises: Angular's, which tells `NgZone.onError` (0.36.1's FU2, in the designer's own calls). The zone looks
 * at a promise refused in its drain before any job of the engine's queued after it — a native `await`'s, the designer's
 * own code, which Angular did not compile — and at one its own `Promise.all` or `then` made of it as soon as that ran
 * (testing/zone-promises.ts). Each kind the app answers: its page store's (`load` as a page is opened, and a saved
 * form's; `saveDraft` after an edit and a version restored; `publish`; `list`, the saved forms to place, from the
 * toolbox, a placed one's panel and a step that opens a page), its looks store's (`list`, `save`, `remove`), its
 * assistant's, and Try it's data (the app's lists). A change a person made that the store refused is said in the
 * designer's words, with Try again; what the designer read by itself keeps what it drew, and is asked again later —
 * none of it left unhandled, the designer's own promises neither (Jest fails a test that leaves one of those).
 */

// Each test mounts an editor, several the whole screen editor: given room on a loaded machine.
jest.setTimeout(20_000);

const wait = (ms = 0) => new Promise((done) => setTimeout(done, ms));
/** Long enough for anything left unhandled to be said. */
const settle = async () => {
  for (let i = 0; i < 8; i++) await wait(5);
};

let zone: ReturnType<typeof installZonePromises>;
beforeEach(() => {
  zone = installZonePromises();
});
afterEach(() => {
  zone.restore();
  jest.restoreAllMocks();
});
/** Nothing the app refused was said unhandled by the zone. */
const quiet = () => expect(zone.said.map((reason) => (reason as Error)?.message ?? String(reason))).toEqual([]);

/** The app's refusals: made at once, as it is asked; or made before it was asked, in an earlier turn, and kept. */
const FAILED = 'The server did not answer';
const atOnce = <T>() => Promise.reject(new Error(FAILED)) as Promise<T>;
async function already<T>(): Promise<() => Promise<T>> {
  const kept = Promise.reject(new Error(FAILED)) as Promise<T>;
  // Its first asker handled it, as the app's cache had it handled.
  kept.then(undefined, () => undefined);
  await settle();
  return () => kept;
}
type Refuse = <T>() => Promise<T>;
const KINDS: [string, () => Promise<Refuse>][] = [
  ['refused as it is asked', async () => atOnce],
  ['refused already, before it was asked', async () => (await already()) as Refuse],
];

/** A page store whose `member` refuses while `fails.now` holds, else answers as the memory store does. */
function refusing<K extends keyof PageStore>(member: K, refuse: Refuse, base = createMemoryPageStore()) {
  const fails = { now: true };
  const own = base[member] as unknown as (...args: unknown[]) => unknown;
  const store = { ...base, [member]: (...args: unknown[]) => (fails.now ? refuse() : own.apply(base, args)) } as PageStore;
  return { store, fails, base };
}

/** A site visit with a question on it: nothing in it stops a publish. */
function visitPage(title = 'Site visit'): Page {
  const page = blankPage('screen', title);
  return { ...page, id: 'site-visit', fields: { visitor: { type: 'char', label: 'Visitor' } }, layout: { type: 'sections', id: 'sections', children: [{ type: 'section', id: 'section-1', columns: 2, children: [{ type: 'field', id: 'visitor', field: 'visitor' }] }] } };
}
const address: Page = {
  fieldia: '0.1',
  id: 'address',
  title: 'Address',
  data: { kind: 'responses' },
  fields: { street: { type: 'char', label: 'Street' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 'where', columns: 2, children: [{ type: 'field', id: 'street', field: 'street' }] }] },
};

const unsaved = (host: Element) => host.querySelector('.fd-designer-unsaved') as HTMLElement;
const menuNote = () => document.querySelector('.fd-menu .fd-menu-note')?.textContent;
const menuItems = () => [...document.querySelectorAll('.fd-menu [data-item]')].map((item) => item.textContent);

describe('the page store’s answers (`PageStore`)', () => {
  it.each(KINDS)('%s: `load`, as a page is opened (`createDesigner.open`): the open says why, opened once asked again', async (_, made) => {
    const base = createMemoryPageStore();
    await base.publish(visitPage());
    const { store, fails } = refusing('load', await made(), base);
    await expect(createDesigner.open('site-visit', store)).rejects.toThrow(FAILED);
    await settle();
    quiet();
    fails.now = false;
    expect((await createDesigner.open('site-visit', store)).getPage().title).toBe('Site visit');
    quiet();
  });

  it.each(KINDS)('%s: `saveDraft`, an edit: said under the bar with Try again, saved once tried again', async (_, made) => {
    const { store, fails, base } = refusing('saveDraft', await made());
    const designer = createDesigner({ page: visitPage(), store });
    const { host } = mount(designer);
    designer.setPageInfo({ title: 'Site visit, east' });
    await designer.settled();
    await settle();
    quiet();
    expect(designer.getState().notSaved).toBe(FAILED);
    const line = unsaved(host);
    expect(line.hidden).toBe(false);
    expect(line.getAttribute('role')).toBe('alert');
    expect(line.querySelector('bdi')?.textContent).toBe('Your changes could not be saved: The server did not answer');
    expect(base.pages.get('site-visit')?.draft ?? null).toBeNull();
    fails.now = false;
    button(line, 'Try again')?.click();
    await designer.settled();
    await settle();
    expect(base.pages.get('site-visit')?.draft?.title).toBe('Site visit, east');
    expect(designer.getState().notSaved).toBeNull();
    expect(line.hidden).toBe(true);
    quiet();
  });

  it.each(KINDS)('%s: `saveDraft`, the next edit saves the whole draft again, and the line goes', async (_, made) => {
    const { store, fails, base } = refusing('saveDraft', await made());
    const designer = createDesigner({ page: visitPage(), store });
    const { host } = mount(designer);
    designer.setPageInfo({ title: 'Site visit, east' });
    await designer.settled();
    expect(unsaved(host).hidden).toBe(false);
    fails.now = false;
    designer.setPageInfo({ description: 'Each room, in turn' });
    await designer.settled();
    await settle();
    expect(base.pages.get('site-visit')?.draft).toMatchObject({ title: 'Site visit, east', description: 'Each room, in turn' });
    expect(unsaved(host).hidden).toBe(true);
    quiet();
  });

  it.each(KINDS)('%s: `saveDraft`, a version restored: said with Try again, that version the draft once tried again', async (_, made) => {
    const base = createMemoryPageStore();
    await base.publish(visitPage('Site visit'));
    const { store, fails } = refusing('saveDraft', await made(), base);
    fails.now = false;
    const designer = await createDesigner.open('site-visit', store);
    const { host } = mount(designer);
    designer.setPageInfo({ title: 'Site visit, east' });
    await designer.settled();
    expect(base.pages.get('site-visit')?.draft?.title).toBe('Site visit, east');
    fails.now = true;
    expect(designer.revertTo(1)).toBe(true);
    await designer.settled();
    await settle();
    quiet();
    expect(unsaved(host).querySelector('bdi')?.textContent).toBe('Your changes could not be saved: The server did not answer');
    fails.now = false;
    button(unsaved(host), 'Try again')?.click();
    await designer.settled();
    expect(base.pages.get('site-visit')?.draft?.title).toBe('Site visit');
    expect(unsaved(host).hidden).toBe(true);
    quiet();
  });

  it('`saveDraft` that throws as it is asked, or answers with no promise: said, and the next save still goes', async () => {
    const base = createMemoryPageStore();
    let given: 'throw' | 'nothing' | 'answer' = 'throw';
    const store: PageStore = {
      ...base,
      saveDraft(page) {
        if (given === 'throw') throw new Error(FAILED);
        if (given === 'nothing') return undefined as unknown as Promise<void>;
        return base.saveDraft(page);
      },
    };
    const designer = createDesigner({ page: visitPage(), store });
    designer.setPageInfo({ title: 'Site visit, east' });
    await designer.settled();
    expect(designer.getState().notSaved).toBe(FAILED);
    given = 'nothing';
    designer.setPageInfo({ title: 'Site visit, west' });
    await designer.settled();
    expect(designer.getState().notSaved).toBeNull();
    given = 'answer';
    designer.setPageInfo({ title: 'Site visit, north' });
    await designer.settled();
    expect(base.pages.get('site-visit')?.draft?.title).toBe('Site visit, north');
    quiet();
  });

  it.each(KINDS)('%s: `publish`: the dialog says why in its words, with Try again; published once tried again', async (_, made) => {
    const { store, fails, base } = refusing('publish', await made());
    const designer = createDesigner({ page: visitPage(), store });
    const { host } = mount(designer);
    await expect(designer.publish()).rejects.toThrow(FAILED);
    await settle();
    quiet();
    expect(designer.getState().versions).toEqual([]);
    button(host, 'Publish')?.click();
    const dialog = document.querySelector('.fd-publish-dialog') as HTMLElement;
    button(dialog, 'Publish version 1')?.click();
    await settle();
    quiet();
    const failed = dialog.querySelector('.fd-publish-failed') as HTMLElement;
    expect([failed.hidden, failed.getAttribute('role'), failed.textContent]).toEqual([false, 'alert', 'Version 1 could not be published: The server did not answer']);
    expect(button(dialog, 'Publish version 1')).toBeUndefined();
    fails.now = false;
    button(dialog, 'Try again')?.click();
    await settle();
    expect(dialog.isConnected).toBe(false);
    expect(designer.getState().versions.map((v) => v.version)).toEqual([1]);
    expect(base.pages.get('site-visit')?.versions.length).toBe(1);
    quiet();
  });

  it.each(KINDS)('%s: `list`, from the toolbox: the menu says why, and the next press asks again', async (_, made) => {
    const base = createMemoryPageStore();
    await base.publish(address);
    const { store, fails } = refusing('list', await made(), base);
    const designer = createDesigner({ page: visitPage(), store });
    await expect(designer.savedForms()).rejects.toThrow(FAILED);
    const { host } = mount(designer, { mode: 'advanced' });
    tile(host, 'form:saved').click();
    await settle();
    quiet();
    expect(menuItems()).toEqual([]);
    expect(menuNote()).toBe('The saved forms could not be listed: The server did not answer');
    fails.now = false;
    tile(host, 'form:saved').click();
    await settle();
    expect(menuItems()).toEqual(['Address']);
    quiet();
  });

  it.each(KINDS)('%s: `list`, a placed saved form’s panel: the one placed kept, asked again as the panel comes back', async (_, made) => {
    const base = createMemoryPageStore();
    await base.publish(address);
    const { store, fails } = refusing('list', await made(), base);
    const designer = createDesigner({ page: visitPage(), store });
    await designer.loadSavedForm('address');
    const id = designer.addForm('address', { parent: 'section-1' }) as string;
    designer.select(id);
    const { host } = mount(designer, { mode: 'advanced' });
    await settle();
    quiet();
    const which = () => [...(field(host, 'Saved form')?.options ?? [])].map((o) => o.value);
    expect(which()).toEqual(['address']);
    fails.now = false;
    designer.select(null);
    designer.select(id);
    await settle();
    expect(which()).toEqual(['address']);
    expect(field(host, 'Saved form')?.options[0].textContent).toBe('Address');
    quiet();
  });

  it.each(KINDS)('%s: `list`, a step that opens a page: asked again as Add a step opens again', async (_, made) => {
    const base = createMemoryPageStore();
    await base.publish({ ...visitPage('Customer'), id: 'customer' });
    const { store, fails } = refusing('list', await made(), base);
    const page: Page = { ...visitPage('Order'), id: 'order' };
    (page.layout as { children: { children: unknown[] }[] }).children[0].children.push({ type: 'button', id: 'new-customer', label: 'New customer', action: 'button' });
    const designer = createDesigner({ page, store });
    designer.select('new-customer');
    const { host } = mount(designer, { mode: 'advanced' });
    const clicked = () => host.querySelector('[data-setting="When clicked"]') as HTMLElement;
    button(clicked(), 'Add a step')?.click();
    await settle();
    quiet();
    // Pressed again, the menu opened anew in place of the first.
    fails.now = false;
    button(clicked(), 'Add a step')?.click();
    ([...document.querySelectorAll<HTMLButtonElement>('.fd-menu .fd-menu-item')].find((b) => b.textContent === 'Open a page') as HTMLButtonElement).click();
    await settle();
    expect([...(field(clicked(), 'Page')?.options ?? [])].map((o) => o.textContent)).toEqual(['Pick…', 'Customer', 'Another page, by its id…']);
    quiet();
  });

  it.each(KINDS)('%s: `load`, a saved form placed: never taken for one the store has not; asked again a while later', async (_, made) => {
    const base = createMemoryPageStore();
    await base.publish(address);
    const { store, fails } = refusing('load', await made(), base);
    const designer = createDesigner({ page: visitPage(), store });
    const id = designer.addForm('address', { parent: 'section-1' }) as string;
    expect(id).toBeTruthy();
    await settle();
    quiet();
    // Still to come: the Checks say nothing of it yet — never that the store cannot find it, holding back Publish.
    expect(designer.savedForm('address')).toBeUndefined();
    expect(designer.checks().filter((check) => check.at === id)).toEqual([]);
    // Not asked again at once, as each draw asks for it: the store is not pressed in a loop.
    fails.now = false;
    let asked = 0;
    const load = store.load;
    store.load = (one) => (asked++, load(one));
    designer.select(id);
    expect(designer.savedForm('address')).toBeUndefined();
    await settle();
    expect(asked).toBe(0);
    // A while later, the next that asks for it asks the store again.
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    designer.savedForm('address');
    await settle();
    expect(asked).toBe(1);
    expect(designer.savedForm('address')?.page?.title).toBe('Address');
    quiet();
  });

  it.each(KINDS)('%s: `load`, a saved form loaded afresh: what was drawn is kept', async (_, made) => {
    const base = createMemoryPageStore();
    await base.publish(address);
    const { store, fails } = refusing('load', await made(), base);
    fails.now = false;
    const designer = createDesigner({ page: visitPage(), store });
    await designer.loadSavedForm('address');
    const id = designer.addForm('address', { parent: 'section-1' }) as string;
    const { host } = mount(designer, { mode: 'advanced' });
    await settle();
    const frame = () => host.querySelector(`.fd-canvas-form[data-node="${id}"]`) as HTMLElement;
    expect(frame().querySelector('[data-saved-node="street"]')).not.toBeNull();
    fails.now = true;
    await designer.loadSavedForm('address');
    await settle();
    quiet();
    expect(designer.savedForm('address')?.page?.title).toBe('Address');
    expect(frame().querySelector('[data-saved-node="street"]')).not.toBeNull();
    expect(designer.checks().filter((check) => check.at === id)).toEqual([]);
  });
});

describe('the looks store’s answers (`LookStore`)', () => {
  const calm = { id: 'calm', name: 'Calm', look: { accent: '#336699' } };

  it.each(KINDS)('%s: `save` and `remove`: each rejects with the store’s words, the looks as they were', async (_, made) => {
    const refuse = await made();
    const base = createMemoryLookStore([calm]);
    const store: LookStore = { list: () => base.list(), save: () => refuse(), remove: () => refuse() };
    const hub = looksHub(store);
    hub.ensure();
    await settle();
    await expect(hub.save({ id: 'mine', name: 'Mine', look: {} })).rejects.toThrow(FAILED);
    await expect(hub.remove('calm')).rejects.toThrow(FAILED);
    await settle();
    quiet();
    expect(hub.looks?.map((look) => look.id)).toEqual(['calm']);
  });

  it.each(KINDS)('%s: `list`: the store’s words kept as its problem, listed once asked again', async (_, made) => {
    const refuse = await made();
    const base = createMemoryLookStore([calm]);
    const fails = { now: true };
    const store: LookStore = { list: () => (fails.now ? refuse() : base.list()), save: (look) => base.save(look), remove: (id) => base.remove(id) };
    const hub = looksHub(store);
    hub.ensure();
    await settle();
    quiet();
    expect([hub.problem, hub.looks]).toEqual([FAILED, null]);
    fails.now = false;
    hub.reload();
    await settle();
    expect([hub.problem, hub.looks?.map((look) => look.id)]).toEqual([null, ['calm']]);
  });
});

describe('the assistant’s answer (`DesignerAssistant`)', () => {
  it.each(KINDS)('%s: `describe`: said under its box', async (_, made) => {
    const refuse = await made();
    const designer = createDesigner({ page: visitPage() });
    const assistant: DesignerAssistant = { describe: () => refuse() };
    const result = await askAssistant(designer, assistant, 'A site visit, room by room').done;
    await settle();
    quiet();
    expect(result).toEqual({ status: 'failed', problem: 'The assistant could not do it: The server did not answer' });
  });
});

describe('Try it’s data', () => {
  let trial: TryIt | null = null;
  afterEach(() => {
    trial?.destroy();
    trial = null;
  });

  it.each(KINDS)('%s: the app’s lists (`options`): the page tried all the same', async (_, made) => {
    const refuse = await made();
    const designer: Designer = createDesigner({ page: blankPage('screen', 'Delivery'), lists: [{ name: 'countries', label: 'Countries' }] });
    const id = designer.addQuestion('dropdown') as string;
    designer.setOptionsFrom(id, { list: 'countries' });
    const app = createMemoryDataSource({});
    app.options = () => refuse();
    trial = tryIt({ el: elementFactory(document), doc: document, designer, skin: 'outlined', onChange: () => undefined, dataSource: app });
    document.body.append(trial.toggle, trial.element);
    (trial.toggle.querySelector('button[data-mode="try"]') as HTMLButtonElement).click();
    await settle();
    quiet();
    expect(trial.element.querySelector('.fd-try-frame form.fd-form')).not.toBeNull();
  });
});

