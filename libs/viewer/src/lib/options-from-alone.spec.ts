import { checkPage, createForm, createMemoryDataSource, validatePage, type DataSource, type Option, type Page } from '@fieldia/core';
import { firstPaint } from '../server';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A choice whose options come from one of the app's lists (`optionsFrom`) and that writes no `options` of its own has
 * none to start with: the page draws, and the list fills them. The page's door (`upgradePage`, which `checkPage`,
 * `validatePage`, `createForm` and the designer read a page through) reads the options left out as none, so nothing
 * reading a choice's options meets none — whatever its widget, on the page, on a table's line, in a list.
 */

// NexiBI's reproduction (amlak-64, FU1 evidence: repro-options-from-without-options.cjs): its page as it was sent.
const nexibi = (): Page =>
  ({
    fieldia: '0.1',
    id: 'pick',
    data: { kind: 'record', model: 'test.pick' },
    fields: {
      kind: { type: 'selection', label: 'Kind', options: [{ value: 'fruit', label: 'Fruit' }] },
      pick: { type: 'selection', label: 'Pick', optionsFrom: { list: 'picks', dependsOn: ['kind'] } },
    },
    layout: { type: 'sections', id: 'all', children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-kind', field: 'kind' }, { type: 'field', id: 'f-pick', field: 'pick' }] }] },
  }) as unknown as Page;

const PICKS: Option[] = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
];

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
async function until(ready: () => unknown) {
  for (let turn = 0; turn < 200 && !ready(); turn++) await new Promise((done) => setTimeout(done, 5));
  expect(ready()).toBeTruthy();
}
function mount(page: Page, values: Record<string, unknown> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const asked: string[] = [];
  const dataSource: DataSource = {
    options: async (request) => {
      asked.push(request.list);
      return PICKS;
    },
  };
  handle = mountViewer(host, { page, dataSource, values: values as never });
  return { host, asked };
}
const offered = (host: HTMLElement, node: string) =>
  [...host.querySelectorAll(`[data-node="${node}"] option, [data-node="${node}"] label.fd-choice, [data-node="${node}"] [role="option"]`)].map((option) => option.textContent?.trim()).filter(Boolean);

describe('NexiBI’s reproduction: a choice from the app’s list that writes no options', () => {
  it('passes checkPage, draws, and its options arrive from the app’s list', async () => {
    expect(checkPage(nexibi()).ok).toBe(true);
    const { host, asked } = mount(nexibi(), { kind: 'fruit' });
    await expect(handle!.drawn).resolves.toBeUndefined();
    await until(() => offered(host, 'f-pick').includes('Apple'));
    expect(asked).toContain('picks');
    expect(offered(host, 'f-pick')).toEqual(expect.arrayContaining(['Apple', 'Banana']));
  });
});

/** The page with the choice as `pick` written, drawn by `widget` (its node's settings `options`). */
const withPick = (pick: Record<string, unknown>, node: Record<string, unknown> = {}): Page =>
  ({
    ...nexibi(),
    fields: { ...nexibi().fields, pick: { type: 'selection', label: 'Pick', optionsFrom: { list: 'picks' }, ...pick } },
    layout: { type: 'sections', id: 'all', children: [{ type: 'field', id: 'f-pick', field: 'pick', ...node }] },
  }) as unknown as Page;

/** What a page draws, once its choices' lists came: its HTML, each number in it a count. */
async function drawn(page: Page, values: Record<string, unknown> = {}, dataSource?: DataSource) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: dataSource ?? { options: async () => PICKS }, values: values as never });
  await expect(handle.drawn).resolves.toBeUndefined();
  for (let turn = 0; turn < 20; turn++) await new Promise((done) => setTimeout(done, 5));
  // Ids are counted across mounts: each read as a count.
  const html = host.innerHTML.replace(/\d+/g, '#');
  handle.destroy();
  handle = null;
  host.remove();
  return html;
}
/** The page with each choice's `options: []` written where it left them out: what it must draw the same as. */
const written = (page: Page): Page => JSON.parse(JSON.stringify(page), (key, value) => (value && typeof value === 'object' && value.type === 'selection' && !value.options ? { ...value, options: [] } : value));

describe('every widget of a choice, its options left out: drawn as the page writing `options: []` draws', () => {
  it.each([
    ['its own list', {}, {}],
    ['radios', {}, { widget: 'radio' }],
    ['several ticked', { multiple: true }, {}],
    ['checkboxes', { multiple: true }, { widget: 'checkboxes' }],
    ['a box that searches', {}, { options: { search: true } }],
    ['tags', { multiple: true }, { widget: 'tags' }],
    ['a dot', {}, { widget: 'dot' }],
    ['a priority', {}, { widget: 'priority' }],
    ['Other, typed', { other: true }, {}],
  ] as [string, Record<string, unknown>, Record<string, unknown>][])('%s', async (_, pick, node) => {
    const page = withPick(pick, node);
    const values = { pick: pick['multiple'] ? ['a'] : 'a' };
    const html = await drawn(page, values);
    expect(html).not.toContain('fd-widget-failed');
    expect(html).toBe(await drawn(written(page), values));
  });
});

describe('a table’s line, a list and a first paint, its options left out', () => {
  it('a line’s choice from the app’s list: the table drawn as the page writing them draws it', async () => {
    const page = {
      fieldia: '0.13',
      id: 'lines',
      data: { kind: 'responses' },
      fields: { lines: { type: 'one2many', label: 'Lines', relation: 'm.line', fields: { pick: { type: 'selection', label: 'Pick', optionsFrom: { list: 'picks' } }, note: { type: 'char', label: 'Note' } } } },
      layout: { type: 'sections', id: 'all', children: [{ type: 'field', id: 'f-lines', field: 'lines' }] },
    } as unknown as Page;
    expect(checkPage(page).ok).toBe(true);
    const values = { lines: [{ key: 'l1', values: { pick: 'a', note: 'One' } }] };
    const html = await drawn(page, values);
    expect(html).toContain('Pick');
    expect(html).not.toContain('fd-widget-failed');
    expect(html).toBe(await drawn(written(page), values));
  });

  it('a list of records with such a choice in a column: drawn as the page writing them draws it', async () => {
    const page = {
      fieldia: '0.13',
      id: 'listed',
      data: { kind: 'record', model: 'test.pick' },
      fields: { name: { type: 'char', label: 'Name' }, pick: { type: 'selection', label: 'Pick', optionsFrom: { list: 'picks' } } },
      layout: { type: 'list', id: 'list', columns: ['name', 'pick'] },
    } as unknown as Page;
    expect(checkPage(page).ok).toBe(true);
    const source = () => createMemoryDataSource({ records: { 'test.pick': { 1: { name: 'First', pick: 'a' } } }, lists: { picks: PICKS } } as never);
    const html = await drawn(page, {}, source());
    expect(html).toContain('First');
    expect(html).toBe(await drawn(written(page), {}, source()));
  });

  it('the first paint of the page, and the form alone, read its options as none', () => {
    expect(() => firstPaint(nexibi())).not.toThrow();
    const form = createForm({ page: nexibi() });
    expect((form.page.fields['pick'] as { options: unknown }).options).toEqual([]);
    // The full check reads it as the viewer does: a choice from the app's list, its options none.
    expect(validatePage(nexibi())).toMatchObject({ ok: true });
  });
});
