import { createMemoryDataSource, pageCheckPart, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import type { PageRefused } from './refused';

/**
 * A page the viewer refuses (the audit's R-M5, R-M6) said where the form would be, never a blank area: why, in words,
 * its problems under "What is wrong", the app's `onError` told, the error with its `issues`. What the check before the
 * draw refuses — as 0.35's viewer refused it — is thrown at the mount, told as `stage: "draw"`. A page 0.35's viewer drew
 * that `validatePage` refuses — the mistakes an AI agent writing a page makes most among them — drawn and said in 0.36,
 * is drawn at once from 0.37 too, never waiting, then taken down as its whole check runs, once the page is painted:
 * `onError` told (`stage: "check"`), `refused` settled with the `PageRefused`, and no write through it before then —
 * held, then refused with the page (`page.invalid`). A page that passes sends what was held. Where the check's part
 * cannot come, the page stays drawn, said, and its writes go on.
 */
let handle: ViewerHandle | undefined;
let quiet: jest.SpyInstance;
beforeEach(() => (quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined)));
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  quiet.mockRestore();
  document.body.replaceChildren();
});

const good = (): Page => ({
  fieldia: '0.13',
  id: 'contact',
  title: 'Contact',
  data: { kind: 'record', model: 'res.partner' },
  fields: {
    name: { type: 'char', label: 'Name' },
    state: { type: 'selection', label: 'State', options: [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }] },
  },
  layout: { type: 'sheet', id: 'main', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-state', field: 'state' }] },
});
type Loose = Record<string, unknown> & { fields: Record<string, Record<string, unknown>>; layout: { children: Record<string, unknown>[] } };
const made = (change: (page: Loose) => void): Page => {
  const page = good() as unknown as Loose;
  change(page);
  return page as unknown as Page;
};

/** A host on the page, and what mounting `page` there did: the error thrown, what onError heard. */
function mount(page: Page, development = false) {
  const host = document.createElement('div');
  document.body.append(host);
  const told: unknown[] = [];
  let thrown: PageRefused | null = null;
  try {
    handle = mountViewer(host, { page, onError: (error, where) => told.push({ error, where }), ...(development ? { development } : {}) });
  } catch (error) {
    thrown = error as PageRefused;
  }
  return { host, told, thrown };
}

/** What a page has said of a deprecation, kept on the page itself (deprecations.ts): forgotten, for each test its own page. */
const SAID = Symbol.for('fieldia.deprecations.said');

/** What a visitor reads where a refused form would be: plain words with a way on, never a check's. */
const VISITOR = 'This form is not available right now. Please try again later, or contact whoever sent it to you.';
/** Never in what a visitor reads: a function's name, a check's or a schema's words, a path. */
const DEVELOPERS = /validatePage|fieldia-check|Invalid input|expected|received|no field|layout\.|fields\./;
const forget = () => delete (globalThis as { [SAID]?: unknown })[SAID];

describe('a page the check before the draw refuses, as 0.35 refused it', () => {
  it('says to its visitor, where the form would be, that it is not available now, with a way on; tells onError and throws the problems', () => {
    const { host, told, thrown } = mount(made((p) => (p.layout.children[0]['field'] = 'phone')));
    expect(thrown?.issues).toEqual([{ path: 'layout.children[0].field', message: 'no field "phone"' }]);
    expect(thrown?.message).toMatch(/^This page cannot be shown:\n {2}layout\.children\[0\]\.field: no field "phone"/);
    // Never a blank area: the visitor's words where the form would be, in Fieldia's look — and nothing for the developer
    // (the 0.37 walk: "Whoever made it can check it with validatePage", and the check's own words, read by a visitor).
    const box = host.querySelector('.fd-form.fd-unshown') as HTMLElement;
    expect(box.querySelector('[role="alert"]')?.textContent).toBe(VISITOR);
    expect(box.textContent).toBe(VISITOR);
    expect(box.textContent).not.toMatch(DEVELOPERS);
    expect(box.querySelector('details')).toBeNull();
    expect(told).toEqual([{ error: thrown, where: { stage: 'draw', part: 'page' } }]);
    expect(host.querySelector('.fd-field, input')).toBeNull();
  });

  it('while the app is being made (`development`), lists what is wrong under the visitor’s words, for whoever made the page', () => {
    const { host, thrown } = mount(made((p) => (p.layout.children[0]['field'] = 'phone')), true);
    const box = host.querySelector('.fd-form.fd-unshown') as HTMLElement;
    expect(box.querySelector('[role="alert"]')?.textContent).toBe(VISITOR);
    expect(box.querySelector('details summary')?.textContent).toBe('What is wrong');
    expect(box.querySelector('details p')?.textContent).toBe('Its page has mistakes, so the form is not shown. Check the page with validatePage or npx fieldia-check.');
    expect([...box.querySelectorAll('details li')].map((item) => item.textContent)).toEqual(['layout.children[0].field no field "phone"']);
    expect(thrown?.issues).toHaveLength(1);
  });

  it.each([
    ['a field of a kind Fieldia does not know', made((p) => (p.fields['name']['type'] = 'email'))],
    ['a part naming a field the page lacks', made((p) => (p.layout.children[0]['field'] = 'phone'))],
    ['a condition reading a field the page lacks', made((p) => (p.layout.children[0]['invisible'] = "kind != 'sales'"))],
    ['a condition that does not read', made((p) => (p.layout.children[0]['invisible'] = "state === 'draft'"))],
    ['one id twice', made((p) => (p.layout.children[1]['id'] = 'f-name'))],
    ['no "fieldia"', made((p) => delete p['fieldia'])],
  ])('refuses %s and says so', (_, page) => {
    const { host, thrown } = mount(page);
    expect(thrown?.issues.length).toBeGreaterThan(0);
    expect(host.querySelector('.fd-unshown [role="alert"]')).not.toBeNull();
  });
});

describe('a page 0.35 drew that validatePage refuses: drawn, then taken down as its whole check runs (page.invalid, 0.37)', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    forget();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it.each([
    ['"required": "yes"', made((p) => (p.fields['name']['required'] = 'yes')), 'fields.name.required'],
    ['options as plain words', made((p) => (p.fields['state']['options'] = ['draft', 'active'])), 'fields.state.options[0]'],
    ['a step "setValue"', made((p) => (p['on'] = { change: { name: [{ do: 'setValue', field: 'state', value: "'draft'" }] } })), 'on.change.name[0].do'],
    ['a key the format does not have', made((p) => (p.fields['name']['read-only'] = true)), 'fields.name'],
    ['a widget\'s option the format refuses', made((p) => Object.assign(p.layout.children[0], { widget: 'phone', options: { countries: 'all' } })), 'layout.children[0].options.countries'],
    ['its least more than its most', made((p) => {
      p.fields['qty'] = { type: 'integer', label: 'Qty', min: 10, max: 5 };
      p.layout.children.push({ type: 'field', id: 'f-qty', field: 'qty' });
    }), 'fields.qty.min'],
    ['a stamp older than a setting it uses (format.under-stamped)', made((p) => {
      p['fieldia'] = '0.10';
      p.fields['pin'] = { type: 'char', label: 'PIN', secret: true };
      p.layout.children.push({ type: 'field', id: 'f-pin', field: 'pin' });
    }), 'fields.pin.secret'],
    ['a 0.13 page saying what a copy does not keep, which came in 0.14 (format.under-stamped)', made((p) => (p.fields['state']['copy'] = false)), 'fields.state.copy'],
  ])('%s: drawn at once, then taken down — its words in its place, onError told (stage "check"), refused settled', async (_, page, path) => {
    const { host, told, thrown } = mount(page, true);
    // Never thrown, never waited for: drawn as 0.36 drew it.
    expect(thrown).toBeNull();
    expect(host.querySelector('.fd-form input, .fd-form select')).not.toBeNull();
    const error = (await handle?.refused) as PageRefused;
    expect(error.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path })]));
    expect(error.message).toMatch(/^This page cannot be shown:\n/);
    const box = host.querySelector('.fd-form.fd-unshown') as HTMLElement;
    // One way of saying both refusals: the visitor's words, what is wrong under them while the app is being made.
    expect(box.querySelector('[role="alert"]')?.textContent).toBe(VISITOR);
    expect([...box.querySelectorAll('details li code')].map((code) => code.textContent)).toContain(path);
    // (What 0.35 did with it besides, it does as it is drawn: options as words draw their field as a box that says it
    // failed, told as a field's.)
    expect(told.filter((one) => (one as { where: { part: string } }).where.part === 'page')).toEqual([{ error, where: { stage: 'check', part: 'page' } }]);
    // Taken down: nothing of its form left.
    expect(host.querySelector('.fd-field, input, select')).toBeNull();
    // Refused, never warned of: page.invalid and format.under-stamped are changed (0.37).
    expect(warn).not.toHaveBeenCalled();
  });

  it('taken down, it says to its visitor what a page refused at the mount says — never the check’s words', async () => {
    const { host } = mount(made((p) => (p.fields['name']['required'] = 'yes')));
    const error = (await handle?.refused) as PageRefused;
    expect(error.issues).toEqual([expect.objectContaining({ path: 'fields.name.required' })]);
    const box = host.querySelector('.fd-form.fd-unshown') as HTMLElement;
    expect(box.textContent).toBe(VISITOR);
    expect(box.textContent).not.toMatch(DEVELOPERS);
  });

  it('what 0.35 refused is thrown at the mount as before (stage "draw"), even with a mistake only the whole check finds beside it', () => {
    const { thrown, told } = mount(made((p) => {
      p.layout.children[0]['field'] = 'phone';
      p.fields['name']['required'] = 'yes';
    }));
    expect(thrown?.issues).toEqual([{ path: 'layout.children[0].field', message: 'no field "phone"' }]);
    expect(told).toEqual([{ error: thrown, where: { stage: 'draw', part: 'page' } }]);
  });

  it('writes nothing through it: a save asked before its check ran waits for it, and is refused with the page', async () => {
    const dataSource = createMemoryDataSource({ records: { 'res.partner': { 1: { name: 'Nile Traders' } } } });
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: made((p) => (p.fields['name']['required'] = 'yes')), dataSource, recordId: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    handle.form.setValue('name', 'Nile Traders Co.');
    const saved = handle.form.save();
    expect(((await handle.refused) as PageRefused).issues).toEqual([expect.objectContaining({ path: 'fields.name.required' })]);
    await saved.catch(() => false);
    expect(dataSource.calls.filter((call) => call.method === 'save')).toEqual([]);
    expect(dataSource.records['res.partner'][1]['name']).toBe('Nile Traders');
  });

  it('makes no copy through it: a record\'s Duplicate (the source\'s copy) asked before its check ran waits, and is refused with the page', async () => {
    const dataSource = createMemoryDataSource({ records: { 'res.partner': { 1: { name: 'Nile Traders', state: 'active' } } } });
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: made((p) => (p.fields['name']['required'] = 'yes')), dataSource, recordId: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const copied = handle.form.run([{ do: 'duplicate' }]);
    expect(((await handle.refused) as PageRefused).issues).toEqual([expect.objectContaining({ path: 'fields.name.required' })]);
    await copied.catch(() => null);
    expect(dataSource.calls.filter((call) => call.method === 'copy')).toEqual([]);
    expect(Object.keys(dataSource.records['res.partner'])).toEqual(['1']);
  });

  it('a page in format 0.14 that passes makes the copy once its check ran, and the copy keeps nothing a field says copy: false', async () => {
    const dataSource = createMemoryDataSource({ records: { 'res.partner': { 1: { name: 'Nile Traders', state: 'active' } } } });
    const host = document.createElement('div');
    document.body.append(host);
    const page = made((p) => {
      p['fieldia'] = '0.14';
      Object.assign(p.fields['state'], { default: 'draft', copy: false });
    });
    handle = mountViewer(host, { page, dataSource, recordId: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const copied = handle.form.run([{ do: 'duplicate' }]);
    expect(await handle.refused).toBeNull();
    expect((await copied).done).toBe(true);
    expect(dataSource.calls.filter((call) => call.method === 'copy')).toHaveLength(1);
    const copy = Object.entries(dataSource.records['res.partner']).find(([id]) => id !== '1')?.[1];
    expect(copy).toMatchObject({ state: 'draft' });
  });

  it('a page that passes sends what was held once its check ran — and refused settles null', async () => {
    const dataSource = createMemoryDataSource({ records: { 'res.partner': { 1: { name: 'Nile Traders' } } } });
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: good(), dataSource, recordId: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    handle.form.setValue('name', 'Nile Traders Co.');
    expect(await handle.form.save()).toBe(true);
    expect(await handle.refused).toBeNull();
    expect(dataSource.records['res.partner'][1]['name']).toBe('Nile Traders Co.');
    expect(host.querySelector('.fd-unshown')).toBeNull();
  });

  it('another mount of it is taken down the same: a dialog\'s, a line\'s own form', async () => {
    const page = made((p) => (p.fields['name']['required'] = 'yes'));
    const first = mount(page);
    expect(((await handle?.refused) as PageRefused).issues).toEqual([expect.objectContaining({ path: 'fields.name.required' })]);
    expect(first.host.querySelector('.fd-unshown')).not.toBeNull();
    const second = mount(page);
    expect(((await handle?.refused) as PageRefused).issues).toEqual([expect.objectContaining({ path: 'fields.name.required' })]);
    expect(second.host.querySelector('.fd-unshown')).not.toBeNull();
  });

  it('taken away before its check ran: nothing said, refused settles null', async () => {
    const { host, told } = mount(made((p) => (p.fields['name']['required'] = 'yes')));
    const settled = handle?.refused;
    handle?.destroy();
    handle = undefined;
    expect(await settled).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(told).toEqual([]);
    expect(host.querySelector('.fd-unshown')).toBeNull();
  });
});

describe('a page whose whole check cannot come (its part refused by the network)', () => {
  type Packages = typeof import('./viewer') & typeof import('@fieldia/core');
  /** The packages in a module registry of their own, the whole check's chunk failing as it is asked for. */
  async function offline(): Promise<Packages> {
    let packages!: Packages;
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../../core/src/lib/format/check-part', () => {
        throw new Error('Failed to fetch dynamically imported module');
      });
      const [viewer, core] = await Promise.all([import('./viewer'), import('@fieldia/core')]);
      packages = { ...core, ...viewer };
    });
    return packages;
  }

  it('stays drawn, said once in the console and to onError as a warning, over the page — and its writes go on', async () => {
    const fieldia = await offline();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const dataSource = fieldia.createMemoryDataSource({ records: { 'res.partner': { 1: { name: 'Nile Traders' } } } });
    const host = document.createElement('div');
    document.body.append(host);
    const told: unknown[] = [];
    // Even a page the whole check would refuse: an availability failure takes no form down.
    const opened = fieldia.mountViewer(host, { page: made((p) => (p.fields['name']['required'] = 'yes')), dataSource, recordId: 1, onError: (error, where) => told.push({ message: (error as Error).message, where }) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    opened.form.setValue('name', 'Nile Traders Co.');
    expect(await opened.form.save()).toBe(true);
    expect(await opened.refused).toBeNull();
    expect(dataSource.records['res.partner'][1]['name']).toBe('Nile Traders Co.');
    expect(host.querySelector('.fd-field input')).not.toBeNull();
    expect(host.querySelector('.fd-parts-unloaded:not([hidden])')?.textContent).toMatch(/^Part of this page could not load/);
    expect(told).toEqual([{ message: 'This page could not be fully checked: fieldia.check.js could not be loaded. It is drawn on the checks fieldia.js carries.', where: { stage: 'check', part: 'page', warning: true } }]);
    expect(warn.mock.calls.filter((call) => String(call[0]).includes('could not be fully checked'))).toHaveLength(1);
    opened.destroy();
    warn.mockRestore();
  });
});

describe('a page that passes', () => {
  it('is drawn at once, as ever — its whole check in or not', () => {
    expect(pageCheckPart.loaded).toBeDefined();
    const { host, thrown, told } = mount(good());
    expect(thrown).toBeNull();
    expect(told).toEqual([]);
    expect(host.querySelector('.fd-unshown')).toBeNull();
    expect(host.querySelector('input')).not.toBeNull();
  });

  it('a page in format 0.14 that says it — a field a copy does not keep — is drawn at once and stays: refused settles null', async () => {
    const page = made((p) => {
      p['fieldia'] = '0.14';
      p.fields['state']['copy'] = false;
    });
    const { host, thrown, told } = mount(page);
    expect(thrown).toBeNull();
    expect(host.querySelector('.fd-form select, .fd-form input')).not.toBeNull();
    expect(await handle?.refused).toBeNull();
    expect(told).toEqual([]);
    expect(host.querySelector('.fd-unshown')).toBeNull();
  });
});
