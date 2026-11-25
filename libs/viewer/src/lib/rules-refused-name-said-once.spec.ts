import { createMemoryDataSource, type Locale, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * One refusal, said once under its field (amlak-20's report, 25 Nov, @fieldia/viewer 0.36.1). A pick list of half-hour
 * times that takes typing ("At"): "08:15" typed, left and Saved showed two sentences for one problem — the box's own
 * refusal hint ("At: nothing is called “08:15”; pick one from the list. At still holds 08:30") and the field's error
 * ("At: nothing is called “08:15”; pick one from the list"). Every box that says why it did not take a name typed and
 * keeps the words unread did the same: a choice and its tags, a link and its tags, a path, tags at their most — on a
 * page, in a table's cell, on a card. Each is typed in, left, then saved: one element in sight holds the words (the
 * fuller one, "… still holds …", where the box says it), the box marked invalid and described by words in sight, the
 * save refused, the words still typed, the value kept.
 */

const wait = (ms = 60) => new Promise((done) => setTimeout(done, ms));
const TIMES = Array.from({ length: 27 }, (_, i) => {
  const at = `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
  return { value: at, label: at };
});

const page = {
  fieldia: '0.13',
  id: 'briefing',
  title: 'My morning',
  data: { kind: 'record', model: 'briefing' },
  fields: {
    name: { type: 'char', label: 'Name' },
    at: { type: 'selection', label: 'At', options: TIMES },
    rooms: { type: 'selection', label: 'Rooms', multiple: true, options: [{ value: 'k', label: 'Kitchen' }, { value: 'b', label: 'Bath' }] },
    client_id: { type: 'many2one', label: 'Client', relation: 'partner' },
    tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
    iteration: { type: 'many2one', label: 'Iteration', relation: 'work.iteration' },
    keywords: { type: 'char', label: 'Keywords' },
    lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { slot: { type: 'selection', label: 'Slot', options: TIMES } } },
    visits: { type: 'one2many', label: 'Visits', relation: 'visit', fields: { slot: { type: 'selection', label: 'Visit at', options: TIMES } } },
    analytic: { type: 'json', label: 'Analytic' },
    tax_totals: { type: 'json', label: 'Totals' },
  },
  layout: {
    type: 'sheet',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-at', field: 'at' },
      { type: 'field', id: 'f-rooms', field: 'rooms', widget: 'tags' },
      { type: 'field', id: 'f-client', field: 'client_id', options: { create: false } },
      { type: 'field', id: 'f-tags', field: 'tag_ids', options: { create: false } },
      { type: 'field', id: 'f-iteration', field: 'iteration', widget: 'path' },
      { type: 'field', id: 'f-keywords', field: 'keywords', widget: 'tags', options: { max: 2 } },
      { type: 'field', id: 'f-lines', field: 'lines' },
      { type: 'field', id: 'f-visits', field: 'visits', widget: 'cards' },
      { type: 'field', id: 'f-analytic', field: 'analytic', widget: 'distribution', options: { model: 'partner' } },
      { type: 'field', id: 'f-taxes', field: 'tax_totals', widget: 'tax-totals', options: { editable: true, currency: 'EGP' } },
    ],
  },
} as unknown as Page;

const record = {
  name: 'Hany',
  at: '08:30',
  rooms: ['k'],
  client_id: { id: 1, label: 'Acme' },
  tag_ids: [],
  iteration: { id: 4, label: 'Sprint 14', path: ['Portal', 'Sprint 14'] },
  keywords: 'oak, glass',
  lines: [{ key: 'l1', id: 101, values: { slot: '09:00' } }],
  visits: [{ key: 'v1', id: 201, values: { slot: '10:00' } }],
  analytic: { '1': 100 },
  tax_totals: { untaxed: 1000, groups: [{ name: 'VAT 14%', amount: 140 }], total: 1140 },
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(locale: Locale = 'en') {
  const dataSource = createMemoryDataSource({
    records: {
      briefing: { 1: JSON.parse(JSON.stringify(record)) },
      partner: { 1: { name: 'Acme' }, 2: { name: 'Nile Interiors' } },
      tag: { 10: { name: 'VIP' }, 11: { name: 'Wholesale' } },
      'work.iteration': { 3: { name: 'Sprint 13', path: ['Portal', 'Sprint 13'] }, 4: { name: 'Sprint 14', path: ['Portal', 'Sprint 14'] } },
    },
    shows: { 'work.iteration': { path: 'path' } },
    // A search that takes its time, as a server's does: a name looked up is refused after the box is left.
    delayMs: 15,
  });
  const host = document.createElement('div');
  if (locale === 'ar') host.dir = 'rtl';
  const away = document.createElement('button');
  document.body.append(host, away);
  handle = mountViewer(host, { page, dataSource, recordId: 1, locale });
  await handle.form.settled();
  return { host, away, form: handle.form, stored: () => dataSource.records['briefing'][1] };
}

const at = (host: Element, node: string) => host.querySelector(`[data-node="${node}"]`) as HTMLElement;
const plain = (text: string | null | undefined) => (text ?? '').replace(/[⁦-⁩]/g, '');
/**
 * The places `words` are in sight: each piece of text holding them whose element is drawn — none round it hidden, not
 * words for a screen reader alone (`fd-sr-only`), not a tooltip.
 */
function inSight(root: ParentNode, said: string): string[] {
  const words = plain(said);
  const found: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const element = text.parentElement;
    if (!element || !plain(text.nodeValue).includes(words)) continue;
    if (element.closest('[hidden], [aria-hidden="true"], .fd-sr-only, [role="tooltip"]')) continue;
    found.push(`${element.className}: ${plain(text.nodeValue)}`);
  }
  return found;
}
/** What the box's aria-describedby names that holds `words`: each, and whether it is in sight. */
function described(box: HTMLElement, said: string) {
  const words = plain(said);
  return (box.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => !!element && plain(element.textContent).includes(words))
    .map((element) => ({ id: element.id, seen: !element.closest('[hidden]') }));
}
/** Once in sight, and the box is described by those very words, in sight: never a hidden element's. */
function saidOnce(host: Element, box: HTMLElement, words: string, whole = words) {
  const shown = inSight(host, words);
  expect(shown).toHaveLength(1);
  expect(shown[0]).toContain(plain(whole));
  expect(box.getAttribute('aria-invalid')).toBe('true');
  expect(described(box, words)).toEqual([{ id: expect.any(String), seen: true }]);
}

function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe.each(['en', 'ar'] as const)('%s: a choice typed by name, the report’s “At”', (locale) => {
  const words = locale === 'en' ? { said: 'At: nothing is called “08:15”; pick one from the list', holds: 'At still holds 08:30' } : { said: 'At: لا شيء باسم «08:15»؛ اختر من القائمة', holds: 'ما زالت القيمة في At: 08:30' };

  it('left, then saved: one sentence, with what the field still holds', async () => {
    const { host, away, form, stored } = await mount(locale);
    const box = at(host, 'f-at').querySelector('input[role="combobox"]') as HTMLInputElement;
    type(box, '08:15');
    away.focus();
    saidOnce(host, box, words.said, `${words.said}. ${words.holds}`);
    expect(await form.save()).toBe(false);
    saidOnce(host, box, words.said, `${words.said}. ${words.holds}`);
    expect(box.value).toBe('08:15');
    expect(form.getState().values['at']).toBe('08:30');
    expect(stored()['at']).toBe('08:30');
  });

  it('saved straight from the box: one sentence', async () => {
    const { host, form } = await mount(locale);
    const box = at(host, 'f-at').querySelector('input[role="combobox"]') as HTMLInputElement;
    type(box, '08:15');
    expect(await form.save()).toBe(false);
    saidOnce(host, box, words.said);
    expect(box.value).toBe('08:15');
    expect(form.getState().values['at']).toBe('08:30');
  });
});

describe('every box that says why it took no name typed, and keeps the words', () => {
  it('a choice’s tags: left, then saved', async () => {
    const { host, away, form } = await mount();
    const box = at(host, 'f-rooms').querySelector('input[role="combobox"]') as HTMLInputElement;
    type(box, 'Attic');
    away.focus();
    const said = 'Rooms: nothing is called “Attic”; pick one from the list';
    saidOnce(host, box, said);
    expect(await form.save()).toBe(false);
    saidOnce(host, box, said);
    expect(form.getState().values['rooms']).toEqual(['k']);
  });

  it('a link: left — refused once its name was looked up — then saved', async () => {
    const { host, away, form } = await mount();
    const box = at(host, 'f-client').querySelector('input[role="combobox"]') as HTMLInputElement;
    type(box, 'Narnia');
    away.focus();
    await wait();
    const said = 'Client: nothing is called “Narnia”; pick one from the list';
    saidOnce(host, box, said, `${said}. Client still holds Acme`);
    expect(await form.save()).toBe(false);
    saidOnce(host, box, said);
    expect(box.value).toBe('Narnia');
    expect(form.getState().values['client_id']).toEqual({ id: 1, label: 'Acme' });
  });

  it('a link, saved while its name is still looked up: one sentence', async () => {
    const { host, form } = await mount();
    const box = at(host, 'f-client').querySelector('input[role="combobox"]') as HTMLInputElement;
    type(box, 'Narnia');
    expect(await form.save()).toBe(false);
    saidOnce(host, box, 'Client: nothing is called “Narnia”; pick one from the list');
  });

  it('a link’s tags: left, then saved', async () => {
    const { host, away, form } = await mount();
    const box = at(host, 'f-tags').querySelector('input[role="combobox"]') as HTMLInputElement;
    type(box, 'Retail');
    away.focus();
    await wait();
    const said = 'Tags: nothing is called “Retail”; pick one from the list';
    saidOnce(host, box, said);
    expect(await form.save()).toBe(false);
    saidOnce(host, box, said);
  });

  it('a path: left, then saved', async () => {
    const { host, away, form } = await mount();
    const box = at(host, 'f-iteration').querySelector('input[role="combobox"]') as HTMLInputElement;
    type(box, 'Sprint 99');
    await wait(400);
    away.focus();
    await wait();
    const said = 'Iteration: nothing is called “Sprint 99”; pick one from the list';
    saidOnce(host, box, said, `${said}. Iteration still holds Portal\\Sprint 14`);
    expect(await form.save()).toBe(false);
    saidOnce(host, box, said);
    expect(box.value).toBe('Sprint 99');
  });

  it('tags at their most: left, then saved', async () => {
    const { host, away, form } = await mount();
    const box = at(host, 'f-keywords').querySelector('input') as HTMLInputElement;
    type(box, 'steel');
    away.focus();
    const said = 'Keywords takes at most 2. Not added: steel';
    saidOnce(host, box, said);
    expect(await form.save()).toBe(false);
    saidOnce(host, box, said);
    expect(form.getState().values['keywords']).toBe('oak, glass');
  });

  it('a table’s cell: left, then saved', async () => {
    const { host, away, form } = await mount();
    const box = at(host, 'f-lines').querySelector('td[data-column="slot"] input[role="combobox"]') as HTMLInputElement;
    type(box, '08:15');
    away.focus();
    const said = 'Slot: nothing is called “08:15”; pick one from the list';
    saidOnce(host, box, said, `${said}. Slot still holds 09:00`);
    expect(await form.save()).toBe(false);
    saidOnce(host, box, said);
  });

  it('a card’s field: left, then saved', async () => {
    const { host, away, form } = await mount();
    const box = at(host, 'f-visits').querySelector('input[role="combobox"]') as HTMLInputElement;
    type(box, '08:15');
    away.focus();
    const said = 'Visit at: nothing is called “08:15”; pick one from the list';
    saidOnce(host, box, said, `${said}. Visit at still holds 10:00`);
    expect(await form.save()).toBe(false);
    saidOnce(host, box, said);
  });

  it('an account in a distribution: left, then saved', async () => {
    const { host, away, form } = await mount();
    const box = at(host, 'f-analytic').querySelector('input[role="combobox"]') as HTMLInputElement;
    type(box, 'Narnia');
    away.focus();
    await wait();
    const said = 'Account: nothing is called “Narnia”; pick one from the list';
    saidOnce(host, box, said);
    expect(await form.save()).toBe(false);
    saidOnce(host, box, said);
    expect(form.getState().values['analytic']).toEqual({ '1': 100 });
  });

  it('a tax amount that does not read, said by the totals’ own note: left, then saved', async () => {
    const { host, away, form } = await mount();
    const box = at(host, 'f-taxes').querySelector('input[aria-label="VAT 14%"]') as HTMLInputElement;
    box.focus();
    box.value = '14o';
    box.dispatchEvent(new Event('change', { bubbles: true }));
    away.focus();
    await wait(10);
    const said = form.getState().unread['tax_totals']?.message as string;
    expect(said).toContain("VAT 14%");
    saidOnce(host, box, said);
    expect(await form.save()).toBe(false);
    saidOnce(host, box, said);
  });
});
