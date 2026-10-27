import type { Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import type { PageRefused } from './refused';

/**
 * A page the viewer refuses (the audit's R-M5, R-M6) said where the form would be, never a blank area: why, in words,
 * its problems under "What is wrong", the app's `onError` told, the error thrown with its `issues`. What the check before
 * the draw refuses — as 0.35's viewer refused it — is told as `stage: "draw"`; a page 0.35's viewer drew that
 * `validatePage` refuses — the mistakes an AI agent writing a page makes most among them — drawn and said in 0.36, is
 * refused before the draw from 0.37 (`page.invalid`), told as `stage: "check"`: an app's viewer carries the whole check.
 * And in an app's bundle the checks of what a part draws (a list's settings, a map's) come in a chunk of their own, as
 * the one-tag script's come with each part: a page with a mistake there is refused once they came, before it is drawn.
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
function mount(page: Page) {
  const host = document.createElement('div');
  document.body.append(host);
  const told: unknown[] = [];
  let thrown: PageRefused | null = null;
  try {
    handle = mountViewer(host, { page, onError: (error, where) => told.push({ error, where }) });
  } catch (error) {
    thrown = error as PageRefused;
  }
  return { host, told, thrown };
}

/** What a page has said of a deprecation, kept on the page itself (deprecations.ts): forgotten, for each test its own page. */
const SAID = Symbol.for('fieldia.deprecations.said');
const forget = () => delete (globalThis as { [SAID]?: unknown })[SAID];

describe('a page the check before the draw refuses, as 0.35 refused it', () => {
  it('says why where the form would be, lists what is wrong, tells onError and throws the problems', () => {
    const { host, told, thrown } = mount(made((p) => (p.layout.children[0]['field'] = 'phone')));
    expect(thrown?.issues).toEqual([{ path: 'layout.children[0].field', message: 'no field "phone"' }]);
    expect(thrown?.message).toMatch(/^This page cannot be shown:\n {2}layout\.children\[0\]\.field: no field "phone"/);
    // Never a blank area: the words where the form would be, in Fieldia's look.
    const box = host.querySelector('.fd-form.fd-unshown') as HTMLElement;
    expect(box.querySelector('[role="alert"]')?.textContent).toBe('This form cannot be shown: its page has mistakes. Whoever made it can check it with validatePage.');
    expect(box.querySelector('details summary')?.textContent).toBe('What is wrong');
    expect([...box.querySelectorAll('details li')].map((item) => item.textContent)).toEqual(['layout.children[0].field no field "phone"']);
    expect(told).toEqual([{ error: thrown, where: { stage: 'draw', part: 'page' } }]);
    expect(host.querySelector('.fd-field, input')).toBeNull();
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

describe('a page 0.35 drew that validatePage refuses: refused before the draw (page.invalid, 0.37)', () => {
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
  ])('refuses %s: its words where the form would be, onError told (stage "check"), the problems thrown — nothing drawn', (_, page, path) => {
    const { host, told, thrown } = mount(page);
    expect(thrown?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path })]));
    expect(thrown?.message).toMatch(/^This page cannot be shown:\n/);
    const box = host.querySelector('.fd-form.fd-unshown') as HTMLElement;
    expect(box.querySelector('[role="alert"]')?.textContent).toBe('This form cannot be shown: its page has mistakes. Whoever made it can check it with validatePage.');
    expect([...box.querySelectorAll('details li code')].map((code) => code.textContent)).toContain(path);
    expect(told).toEqual([{ error: thrown, where: { stage: 'check', part: 'page' } }]);
    expect(host.querySelector('.fd-field, input, select')).toBeNull();
    // Refused, never warned of: page.invalid and format.under-stamped are changed (0.37).
    expect(warn).not.toHaveBeenCalled();
  });

  it('what 0.35 refused is told as before (stage "draw"), even with a mistake only the whole check finds beside it', () => {
    const { thrown, told } = mount(made((p) => {
      p.layout.children[0]['field'] = 'phone';
      p.fields['name']['required'] = 'yes';
    }));
    expect(thrown?.issues).toEqual([{ path: 'layout.children[0].field', message: 'no field "phone"' }]);
    expect(told).toEqual([{ error: thrown, where: { stage: 'draw', part: 'page' } }]);
  });

  it('a line\'s own form and a dialog\'s are held to it too: another mount of it is refused the same', () => {
    const page = made((p) => (p.fields['name']['required'] = 'yes'));
    expect(mount(page).thrown?.issues).toEqual([expect.objectContaining({ path: 'fields.name.required' })]);
    expect(mount(page).thrown?.issues).toEqual([expect.objectContaining({ path: 'fields.name.required' })]);
  });
});

describe('a page whose mistake is in what a part checks, in an app\'s bundle (perf-leftovers\' item 5)', () => {
  type Packages = typeof import('./viewer') & typeof import('@fieldia/core');
  /** The packages in a module registry of their own: no check a part carries put in yet (all-checks.ts). */
  async function fresh(): Promise<Packages> {
    let packages!: Packages;
    await jest.isolateModulesAsync(async () => {
      const [viewer, core] = await Promise.all([import('./viewer'), import('@fieldia/core')]);
      packages = { ...core, ...viewer };
    });
    return packages;
  }
  const list = (more: Record<string, unknown> = {}): Page =>
    ({
      fieldia: '0.13',
      id: 'customers',
      data: { kind: 'record', model: 'res.partner' },
      fields: { name: { type: 'char', label: 'Name' }, state: { type: 'selection', label: 'State', options: [{ value: 'draft', label: 'Draft' }] } },
      layout: { type: 'list', id: 'people', columns: ['name', 'state'], filters: [{ id: 'drafts', label: 'Drafts', filter: [{ field: 'state', op: '=', value: 'draft' }] }], ...more },
    }) as unknown as Page;

  it('carries none of those checks before they are owed, asks for their chunk with the page\'s parts, and refuses it once they came — before it is drawn', async () => {
    const fieldia = await fresh();
    expect(fieldia.formatChecksPart?.loaded).toBeUndefined();
    // Owed, not run: the check before the draw passes what it cannot check yet.
    const broken = list({ defaultFilters: ['nope'] });
    expect(fieldia.checkPageOwing(broken)).toMatchObject({ ok: true, later: ['list'] });
    const host = document.createElement('div');
    document.body.append(host);
    const told: unknown[] = [];
    // The mount returns: the page waits for its parts, the checks' chunk among them, nothing drawn meanwhile.
    const opened = fieldia.mountViewer(host, { page: broken, onError: (error, where) => told.push({ error, where }) });
    expect(host.querySelector('.fd-unshown, .fd-list')).toBeNull();
    let refused: PageRefused | null = null;
    await opened.drawn.catch((error: PageRefused) => (refused = error));
    expect(fieldia.formatChecksPart?.loaded).toBeDefined();
    expect((refused as PageRefused | null)?.issues).toEqual([{ path: 'layout.defaultFilters[0]', message: 'no filter "nope" in this list' }]);
    expect(host.querySelector('.fd-unshown [role="alert"]')?.textContent).toMatch(/^This form cannot be shown/);
    expect(host.querySelector('.fd-list, table')).toBeNull();
    // A list's settings were refused by 0.35's viewer too: told as the check before the draw tells it.
    expect(told).toEqual([{ error: refused, where: { stage: 'draw', part: 'page' } }]);
    opened.destroy();
  });

  it('checkPage, validatePage and checkPageWhole stay whole: they refuse it at once', async () => {
    const fieldia = await fresh();
    const broken = list({ defaultFilters: ['nope'] });
    expect(fieldia.checkPage(broken)).toMatchObject({ ok: false, issues: [{ path: 'layout.defaultFilters[0]' }] });
    expect(fieldia.validatePage(broken)).toMatchObject({ ok: false, issues: [{ path: 'layout.defaultFilters[0]' }] });
    expect(await fieldia.checkPageWhole(broken)).toMatchObject({ ok: false, issues: [{ path: 'layout.defaultFilters[0]' }] });
  });

  it('a record with none of what they check never asks for them', async () => {
    const fieldia = await fresh();
    const host = document.createElement('div');
    document.body.append(host);
    const opened = fieldia.mountViewer(host, { page: good() });
    expect(host.querySelector('input')).not.toBeNull();
    await opened.drawn;
    expect(fieldia.formatChecksPart?.coming).toBeFalsy();
    expect(fieldia.formatChecksPart?.loaded).toBeUndefined();
    opened.destroy();
  });
});

describe('a page that passes', () => {
  it('is drawn, as ever', () => {
    const { host, thrown, told } = mount(good());
    expect(thrown).toBeNull();
    expect(told).toEqual([]);
    expect(host.querySelector('.fd-unshown')).toBeNull();
    expect(host.querySelector('input')).not.toBeNull();
  });
});
