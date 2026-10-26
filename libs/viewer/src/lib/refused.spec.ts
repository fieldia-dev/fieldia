import { pageCheckPart, type Page, type PageInvalid } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import type { PageRefused } from './refused';

/**
 * A page the viewer refuses (the audit's R-M5, R-M6) — what the check before the draw refuses, as 0.35's viewer refused
 * it — said where the form would be, never a blank area: why, in words, its problems under "What is wrong", the app's
 * `onError` told, the error thrown with its `issues`. And a page 0.35's viewer drew that `validatePage` refuses — the
 * mistakes an AI agent writing a page makes most among them — drawn in 0.36, the whole check run after the first draw
 * saying what it found once in the console and to `onError`, as a warning: refused from 0.37 (`page.invalid`).
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
/** Until `done` holds, a moment at a time: the whole check runs once the page is drawn and the browser idle. */
async function until(done: () => boolean) {
  for (let i = 0; i < 200 && !done(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
}

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

describe('a page 0.35 drew that validatePage refuses (page.invalid)', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    forget();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());
  const deprecations = () => warn.mock.calls.map((call) => String(call[0])).filter((words) => words.includes('(page.invalid;'));

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
  ])('draws %s, then says it once in the console and to onError, as a warning — refused from 0.37', async (_, page, path) => {
    const { host, told, thrown } = mount(page);
    expect(thrown).toBeNull();
    expect(host.querySelector('.fd-unshown')).toBeNull();
    await handle?.drawn;
    expect(host.querySelector('.fd-form input, .fd-form select')).not.toBeNull();
    // What 0.35 did with it besides, it does: options as words draw their field as a box that says it failed.
    const checked = () => told.filter((one) => (one as { where: { stage: string } }).where.stage === 'check');
    await until(() => checked().length > 0);
    expect(checked()).toEqual([{ error: expect.objectContaining({ issues: expect.arrayContaining([expect.objectContaining({ path })]) }), where: { stage: 'check', part: 'page', warning: true } }]);
    expect((checked()[0] as { error: PageInvalid }).error.message).toMatch(/^This page has mistakes validatePage refuses: drawn in 0\.36, refused from 0\.37\./);
    const said = deprecations();
    expect(said.length).toBe(1);
    expect(said[0].startsWith(`Fieldia: a page drawn has mistakes validatePage refuses (${path}: `)).toBe(true);
    expect(said[0].endsWith(' — deprecated, it changes in 0.37 (page.invalid; https://fieldia.dev/promises/#deprecations).')).toBe(true);
    // Still drawn: nothing taken away.
    expect(host.querySelector('.fd-unshown')).toBeNull();
    expect(host.querySelector('.fd-form input, .fd-form select')).not.toBeNull();
  });

  it('says it once in a page: another form of it tells its onError, the console nothing more', async () => {
    const page = made((p) => (p.fields['name']['required'] = 'yes'));
    const first = mount(page);
    await until(() => first.told.length > 0);
    const firstHandle = handle;
    const second = mount(page);
    await until(() => second.told.length > 0);
    expect(second.told).toEqual([{ error: expect.objectContaining({ issues: [expect.objectContaining({ path: 'fields.name.required' })] }), where: { stage: 'check', part: 'page', warning: true } }]);
    expect(deprecations().length).toBe(1);
    firstHandle?.destroy();
  });

  it('a page that passes the whole check: nothing said, once it has run', async () => {
    const { told, thrown } = mount(good());
    expect(thrown).toBeNull();
    await handle?.drawn;
    await pageCheckPart.load();
    await until(() => false);
    expect(told).toEqual([]);
    expect(deprecations()).toEqual([]);
  });

  it('a form taken away before the whole check ran says nothing', async () => {
    const { told } = mount(made((p) => (p.fields['name']['required'] = 'yes')));
    handle?.destroy();
    handle = undefined;
    await pageCheckPart.load();
    await until(() => false);
    expect(told).toEqual([]);
    expect(deprecations()).toEqual([]);
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
