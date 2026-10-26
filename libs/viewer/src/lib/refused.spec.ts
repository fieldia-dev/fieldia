import type { Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import type { PageRefused } from './refused';

/**
 * A page the viewer refuses (the audit's R-M5, R-M6): it refuses what `validatePage` refuses — the mistakes an AI
 * agent writing a page makes most among them — and says so where the form would be, never a blank area: why, in
 * words, its problems under "What is wrong", the app's `onError` told, the error thrown with its `issues`.
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

describe('a page the viewer refuses', () => {
  it('says why where the form would be, lists what is wrong, tells onError and throws the problems', () => {
    const { host, told, thrown } = mount(made((p) => (p.fields['name']['required'] = 'yes')));
    expect(thrown?.issues).toEqual([{ path: 'fields.name.required', message: expect.stringContaining('expected boolean') }]);
    expect(thrown?.message).toMatch(/^This page cannot be shown:\n {2}fields\.name\.required: /);
    // Never a blank area: the words where the form would be, in Fieldia's look.
    const box = host.querySelector('.fd-form.fd-unshown') as HTMLElement;
    expect(box.querySelector('[role="alert"]')?.textContent).toBe('This form cannot be shown: its page has mistakes. Whoever made it can check it with validatePage.');
    expect(box.querySelector('details summary')?.textContent).toBe('What is wrong');
    expect([...box.querySelectorAll('details li')].map((item) => item.textContent)).toEqual([expect.stringMatching(/^fields\.name\.required Invalid input: expected boolean/)]);
    expect(told).toEqual([{ error: thrown, where: { stage: 'draw', part: 'page' } }]);
    expect(host.querySelector('.fd-field, input')).toBeNull();
  });

  it.each([
    ['a field typed "email"', made((p) => (p.fields['name']['type'] = 'email'))],
    ['options as plain words', made((p) => (p.fields['state']['options'] = ['draft', 'active']))],
    ['a step "setValue"', made((p) => (p['on'] = { change: { name: [{ do: 'setValue', field: 'state', value: "'draft'" }] } }))],
    ['a key the format does not have', made((p) => (p.fields['name']['read-only'] = true))],
    ['a node with no id', made((p) => delete p.layout.children[0]['id'])],
    ['a widget\'s option the format refuses', made((p) => Object.assign(p.layout.children[0], { widget: 'phone', options: { countries: 'all' } }))],
  ])('refuses %s, as validatePage does, and says so', (_, page) => {
    const { host, thrown } = mount(page);
    expect(thrown?.issues.length).toBeGreaterThan(0);
    expect(host.querySelector('.fd-unshown [role="alert"]')).not.toBeNull();
  });

  it('draws a page that passes, as ever', () => {
    const { host, thrown, told } = mount(good());
    expect(thrown).toBeNull();
    expect(told).toEqual([]);
    expect(host.querySelector('.fd-unshown')).toBeNull();
    expect(host.querySelector('input')).not.toBeNull();
  });
});
