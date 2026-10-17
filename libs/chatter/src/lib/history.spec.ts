import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { ageOf, firstDayOfWeek, historyEntries, mountHistory, stateColours, type HistoryHandle } from './history';
import { historySlot } from './history-slot';
import { createMemoryChatter } from './memory';
import type { ChatterMessage, ChatterSource } from './source';

const mona = { id: 1, name: 'Mona Adel' };
const karim = { id: 2, name: 'Karim Fathy', avatar: 'data:image/png;base64,AAAA' };
const bug = { model: 'work.item', id: 7 };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}

const event = (id: number, author: typeof mona, date: string, tracking: ChatterMessage['tracking']): ChatterMessage => ({ id, kind: 'event', author, date, body: '', tracking });
/** A bug's history, newest first: dates in the reader's own time. */
const MESSAGES: ChatterMessage[] = [
  event(9, mona, '2026-08-25T16:05:00', [{ field: 'stack_rank', label: 'Stack Rank', from: '1999976256', to: '1999964430' }]),
  event(8, mona, '2026-07-27T14:31:00', [{ field: 'assigned', label: 'Assigned To', from: 'Omar Hany', to: null }]),
  event(7, mona, '2026-07-22T12:59:00', [{ field: 'stack_rank', label: 'Stack Rank', from: '1999987060', to: '1999979534' }]),
  event(6, karim, '2026-07-08T15:12:00', [
    { field: 'state', label: 'State', from: 'New', to: 'Active' },
    { field: 'reason', label: 'Reason', from: 'Investigation Complete', to: 'Approved' },
  ]),
  event(5, karim, '2026-07-08T15:10:00', [
    { field: 'priority', label: 'Priority', from: '2', to: '1' },
    { field: 'severity', label: 'Severity', from: '2 - High', to: '3 - Medium' },
  ]),
  { id: 4, kind: 'message', author: karim, date: '2026-06-14T17:03:00', body: '<p>I need the night shift’s log.<script>alert(1)</script></p>' },
  { id: 40, kind: 'note', author: karim, date: '2026-06-14T17:04:00', body: '<p>A note for the team.</p>' },
  event(3, karim, '2026-06-14T16:58:00', [{ field: 'state', label: 'State', from: 'Active', to: 'New' }]),
  event(2, mona, '2026-06-11T09:30:00', [
    { field: 'state', label: 'State', from: 'New', to: 'Active' },
    { field: 'reason', label: 'Reason', from: 'New', to: 'Approved' },
  ]),
  event(1, mona, '2026-06-10T11:15:00', [
    { field: 'title', label: 'Title', from: null, to: 'Stock count wrong' },
    { field: 'state', label: 'State', from: null, to: 'New' },
    { field: 'reason', label: 'Reason', from: null, to: 'New' },
  ]),
];

const source = (messages: ChatterMessage[] = MESSAGES) => createMemoryChatter({ me: mona, people: [mona, karim], records: { 'work.item:7': { messages } } });

let handle: HistoryHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const COLOURS: Record<string, string> = { New: '#b2b2b2', Active: '#007acc' };
async function mount(options: Partial<Parameters<typeof mountHistory>[1]> = {}, from: ChatterSource = source()) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountHistory(host, {
    source: from,
    record: bug,
    stateField: 'state',
    reasonField: 'reason',
    kind: 'work item',
    now: () => new Date('2026-10-12T20:24:00'),
    stateColour: (words) => COLOURS[words] ?? null,
    ...options,
  });
  await flush();
  await flush();
  return host;
}
const rows = (root: Element) => [...root.querySelectorAll<HTMLElement>('[role=option]')];
const summaries = (root: Element) => rows(root).map((row) => row.querySelector('.fd-history-summary')?.textContent);
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

describe('the history’s lines', () => {
  it('reads changes from events with tracking and comments from messages, newest first; the oldest event from nothing is the making', () => {
    const entries = historyEntries(MESSAGES, 'state', 'reason');
    expect(entries.map((e) => `${e.key}:${e.kind}`)).toEqual(['9:change', '8:change', '7:change', '6:change', '5:change', '4:comment', '3:change', '2:change', '1:created']);
    expect(entries[3].state).toEqual({ field: 'state', label: 'State', from: 'New', to: 'Active' });
    expect(entries[3].reason?.to).toBe('Approved');
    expect(entries[0].state).toBeNull();
  });

  it('has no making when the oldest event changed a value that was there', () => {
    expect(historyEntries([MESSAGES[0], MESSAGES[2]]).map((e) => e.kind)).toEqual(['change', 'change']);
  });

  it('groups by age: today, yesterday, this week, last week, this month, older, the week starting where the language starts it', () => {
    // Wednesday 14 October 2026.
    const now = new Date('2026-10-14T09:00:00');
    const age = (date: string, firstDay = 1) => ageOf(new Date(date), now, firstDay);
    expect(age('2026-10-14T00:00:00')).toBe('today');
    expect(age('2026-10-13T23:59:00')).toBe('yesterday');
    expect(age('2026-10-12T08:00:00')).toBe('thisWeek');
    expect(age('2026-10-11T08:00:00')).toBe('lastWeek');
    expect(age('2026-10-11T08:00:00', 0)).toBe('thisWeek');
    expect(age('2026-10-10T08:00:00', 6)).toBe('thisWeek');
    expect(age('2026-10-05T08:00:00')).toBe('lastWeek');
    expect(age('2026-10-04T08:00:00')).toBe('thisMonth');
    expect(age('2026-09-30T08:00:00')).toBe('older');
    expect(firstDayOfWeek('en')).toBe(0);
    expect(firstDayOfWeek('de')).toBe(1);
    expect(firstDayOfWeek('ar')).toBe(6);
  });

  it('colours a state as the page’s dot does: its colours, else its tones, else as the dot knows it; by label or value', () => {
    const page = {
      fieldia: '0.1',
      id: 'bug',
      data: { kind: 'record', model: 'work.item' },
      fields: {
        state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }, { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' }] },
      },
      layout: {
        type: 'sheet',
        id: 'sheet',
        // Anywhere in the layout: here under a head of the page's own.
        head: { band: { children: [{ type: 'field', id: 'f-state', field: 'state', widget: 'dot', options: { colours: { new: '#b2b2b2', active: '#007acc' }, tones: { resolved: 'warning' } } }] } },
        children: [],
      },
    } as unknown as Page;
    const colour = stateColours(page, 'state');
    expect(colour('New')).toBe('#b2b2b2');
    expect(colour('active')).toBe('#007acc');
    expect(colour('Resolved')).toBe('#d97706');
    // Closed has neither: its place, the fourth, is the dot's warning.
    expect(colour('Closed')).toBe('#d97706');
    expect(colour('Nowhere')).toBeNull();
  });
});

describe('the State Graph', () => {
  it('shows each move in time order: why above the arrow, who and when under it, then the state it came to with its dot', async () => {
    const host = await mount();
    const steps = [...host.querySelectorAll('.fd-history-step')];
    expect(steps.map((step) => step.querySelector('.fd-history-reason')?.textContent)).toEqual(['New', 'Approved', '', 'Approved']);
    expect(steps.map((step) => step.querySelector('.fd-history-who')?.textContent)).toEqual(['MAMona Adel', 'MAMona Adel', 'Karim Fathy', 'Karim Fathy']);
    expect(steps.map((step) => step.querySelector('.fd-history-when')?.textContent)).toEqual(['Jun 10', 'Jun 11', 'Jun 14', 'Jul 8']);
    expect(steps.map((step) => step.querySelector('.fd-history-state')?.textContent)).toEqual(['New', 'Active', 'New', 'Active']);
    expect((steps[1].querySelector('.fd-history-state .fd-history-dot') as HTMLElement).style.background).toBe('rgb(0, 122, 204)');
    expect(steps[2].querySelector('img.fd-history-avatar')?.getAttribute('src')).toBe(karim.avatar);
    expect(host.querySelector('.fd-history-graph')?.getAttribute('aria-label')).toBe('State Graph');
  });

  it('starts from the state the first move left, when the history starts mid-way; and is not there without a state field', async () => {
    let host = await mount({}, source([MESSAGES[3]]));
    expect([...host.querySelectorAll('.fd-history-state')].map((chip) => chip.textContent)).toEqual(['New', 'Active']);
    handle?.destroy();
    host = await mount({ stateField: undefined });
    expect((host.querySelector('.fd-history-states') as HTMLElement).hidden).toBe(true);
  });

  it('folds and maximises from its heading, each tool named for what it does next', async () => {
    const host = await mount();
    const fold = host.querySelector('[data-tool=fold]') as HTMLButtonElement;
    const maximise = host.querySelector('[data-tool=maximise]') as HTMLButtonElement;
    expect([fold.getAttribute('aria-label'), fold.title, fold.getAttribute('aria-expanded')]).toEqual(['Collapse State Graph', 'Collapse State Graph', 'true']);
    fold.click();
    expect((host.querySelector('.fd-history-graph') as HTMLElement).hidden).toBe(true);
    expect([fold.getAttribute('aria-label'), fold.getAttribute('aria-expanded')]).toEqual(['Expand State Graph', 'false']);
    maximise.click();
    expect(host.querySelector('.fd-history-states')?.hasAttribute('data-maximised')).toBe(true);
    expect([maximise.getAttribute('aria-label'), maximise.getAttribute('aria-pressed')]).toEqual(['Restore State Graph', 'true']);
    // Escape puts it back, and goes no further: not a dialog's Escape.
    const outer = jest.fn();
    document.addEventListener('keydown', outer);
    key(maximise, 'Escape');
    document.removeEventListener('keydown', outer);
    expect(host.querySelector('.fd-history-states')?.hasAttribute('data-maximised')).toBe(false);
    expect(outer).not.toHaveBeenCalled();
  });
});

describe('the list and the change chosen', () => {
  it('says what each change did, in one line: one field, a field emptied, the state among others, several, a comment, the making', async () => {
    const host = await mount();
    expect(summaries(host)).toEqual([
      'Mona Adel changed Stack Rank to 1999964430',
      'Mona Adel cleared Assigned To',
      'Mona Adel changed Stack Rank to 1999979534',
      'Karim Fathy changed State from New to Active and made field changes',
      'Karim Fathy made field changes',
      'Karim Fathy commented',
      'Karim Fathy changed State from Active to New',
      'Mona Adel changed State from New to Active and made field changes',
      'Mona Adel created the work item',
    ]);
    // A state's words with their dots inline, and its dot at the row's end.
    const moved = rows(host)[3];
    expect([...moved.querySelectorAll('.fd-history-summary .fd-history-dot')].map((dot) => (dot as HTMLElement).style.background)).toEqual(['rgb(178, 178, 178)', 'rgb(0, 122, 204)']);
    expect((moved.querySelector('.fd-history-end-dot') as HTMLElement).style.background).toBe('rgb(0, 122, 204)');
    expect(rows(host)[0].querySelector('.fd-history-end-dot')).toBeNull();
    expect(rows(host).map((row) => row.querySelector('time')?.textContent).slice(0, 3)).toEqual(['8/25/2026', '7/27/2026', '7/22/2026']);
  });

  it('groups the lines by age, each group a listbox under a heading that folds it', async () => {
    const host = await mount({ now: () => new Date('2026-07-23T09:00:00') }, source(MESSAGES.slice(2)));
    const heads = [...host.querySelectorAll<HTMLButtonElement>('.fd-history-group-head')];
    expect(heads.map((head) => head.textContent)).toEqual(['Yesterday', 'This month', 'Older']);
    expect([...host.querySelectorAll('[role=listbox]')].map((box) => box.getAttribute('aria-label'))).toEqual(['Yesterday', 'This month', 'Older']);
    heads[1].click();
    const folded = host.querySelector('.fd-history-group-head[data-age=thisMonth]') as HTMLButtonElement;
    expect(folded.getAttribute('aria-expanded')).toBe('false');
    expect((host.querySelector(`#${folded.getAttribute('aria-controls')}`) as HTMLElement).hidden).toBe(true);
    expect(folded.querySelector('svg')?.getAttribute('data-icon')).toBe('chevron-right');
  });

  it('chooses the newest at first, and shows its change: who, what, when, each field’s new value and the one it replaced', async () => {
    const host = await mount();
    expect(rows(host)[0].getAttribute('aria-selected')).toBe('true');
    expect(rows(host)[0].tabIndex).toBe(0);
    rows(host)[2].click();
    const detail = host.querySelector('.fd-history-detail') as HTMLElement;
    expect(detail.querySelector('.fd-history-detail-name')?.textContent).toBe('Mona Adel');
    expect(detail.querySelector(`#${detail.getAttribute('aria-labelledby')}`)?.textContent).toBe('Mona Adel changed Stack Rank to 1999979534');
    expect(detail.querySelector('time')?.textContent).toBe('Wed 7/22/2026 12:59\u202fPM');
    expect(detail.querySelector('dt')?.textContent).toBe('Stack Rank');
    expect(detail.querySelector('.fd-history-new')?.textContent).toBe('1999979534');
    const old = detail.querySelector('.fd-history-old') as HTMLElement;
    expect(old.querySelector('.fd-sr-only')?.textContent).toBe('was 1999987060');
    expect(old.querySelector('s')?.textContent).toBe('1999987060');
    expect(old.querySelector('s')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows a cleared field’s old value alone, a comment’s words cleaned, and the making’s values alone', async () => {
    const host = await mount();
    rows(host)[1].click();
    expect([...host.querySelectorAll('.fd-history-detail dd > *')].map((chip) => chip.className)).toEqual(['fd-history-chip fd-history-old']);
    rows(host)[5].click();
    expect(host.querySelector('.fd-history-comment')?.innerHTML).toBe('<p>I need the night shift’s log.</p>');
    rows(host)[8].click();
    expect([...host.querySelectorAll('.fd-history-detail .fd-history-field')].map((field) => field.textContent)).toEqual(['TitleStock count wrong', 'StateNew', 'ReasonNew']);
    expect(host.querySelectorAll('.fd-history-detail .fd-history-old')).toHaveLength(0);
  });

  it('moves and chooses with the arrow keys through the groups’ headings and rows, Home and End, the change following', async () => {
    const host = await mount({ now: () => new Date('2026-07-23T09:00:00') }, source(MESSAGES.slice(2)));
    const list = rows(host);
    list[0].focus();
    key(list[0], 'ArrowDown');
    // From Yesterday's one row down to This month's heading.
    expect(document.activeElement?.textContent).toBe('This month');
    key(document.activeElement as Element, 'ArrowDown');
    expect(document.activeElement).toBe(rows(host)[1]);
    expect(rows(host)[1].getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('.fd-history-detail-head span[id]')?.textContent).toBe('Karim Fathy changed State from New to Active and made field changes');
    key(document.activeElement as Element, 'End');
    expect(document.activeElement).toBe(rows(host).at(-1));
    expect(host.querySelector('.fd-history-detail-head span[id]')?.textContent).toBe('Mona Adel created the work item');
    key(document.activeElement as Element, 'Home');
    expect(document.activeElement).toBe(rows(host)[0]);
    // ← on a heading folds its group, → opens it: the other way round right to left.
    const head = host.querySelector('.fd-history-group-head[data-age=older]') as HTMLButtonElement;
    head.focus();
    key(head, 'ArrowLeft');
    expect(host.querySelector('.fd-history-group-head[data-age=older]')?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(host.querySelector('.fd-history-group-head[data-age=older]'));
    key(document.activeElement as Element, 'ArrowRight');
    expect(host.querySelector('.fd-history-group-head[data-age=older]')?.getAttribute('aria-expanded')).toBe('true');
    // One stop in the Tab order among the rows.
    expect(rows(host).filter((row) => row.tabIndex === 0)).toHaveLength(1);
  });

  it('filters by its menu: field changes, comments, either ticked or not; says so when nothing is left', async () => {
    const host = await mount();
    const filter = host.querySelector('[data-tool=filter]') as HTMLButtonElement;
    expect([filter.getAttribute('aria-label'), filter.title, filter.getAttribute('aria-haspopup')]).toEqual(['Filter', 'Filter', 'menu']);
    filter.click();
    const menu = host.querySelector('[role=menu]') as HTMLElement;
    expect(menu.hidden).toBe(false);
    expect(filter.getAttribute('aria-expanded')).toBe('true');
    const items = [...menu.querySelectorAll<HTMLElement>('[role=menuitemcheckbox]')];
    expect(items.map((item) => [item.textContent, item.getAttribute('aria-checked')])).toEqual([
      ['Field changes', 'true'],
      ['Comments', 'true'],
    ]);
    expect(document.activeElement).toBe(items[0]);
    key(items[0], 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    key(items[1], ' ');
    expect(items[1].getAttribute('aria-checked')).toBe('false');
    expect(summaries(host)).not.toContain('Karim Fathy commented');
    items[0].click();
    expect(host.querySelector('.fd-history-none')?.textContent).toBe('No changes yet');
    expect(host.querySelector('.fd-history-detail')?.childElementCount).toBe(0);
    items[1].click();
    expect(summaries(host)).toEqual(['Karim Fathy commented']);
    key(items[1], 'Escape');
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(filter);
  });
});

describe('in other languages', () => {
  it('speaks Arabic right to left with Latin digits, German and French in their own words and dates', async () => {
    let host = await mount({ locale: 'ar', dir: 'rtl' });
    expect(host.querySelector('.fd-history')?.getAttribute('dir')).toBe('rtl');
    expect(host.querySelector('.fd-history-states .fd-history-title')?.textContent).toBe('مخطط الحالات');
    expect(summaries(host)[0]).toBe('غيّر Mona Adel Stack Rank إلى 1999964430');
    expect(rows(host)[0].querySelector('time')?.textContent).toMatch(/^25\D+8\D+2026$/);
    expect(host.querySelector('.fd-history-group-head')?.textContent).toBe('أقدم');
    handle?.destroy();
    host = await mount({ locale: 'de' });
    expect(summaries(host).at(-1)).toBe('Mona Adel hat work item erstellt');
    expect(host.querySelector('.fd-history-detail time')?.textContent).toBe('Di. 25.8.2026 16:05');
    handle?.destroy();
    host = await mount({ locale: 'fr', kind: undefined });
    expect(summaries(host).at(-1)).toBe('Mona Adel a créé l’enregistrement');
    expect(host.querySelector('.fd-history-step .fd-history-when')?.textContent).toBe('10 juin');
  });
});

describe('historySlot', () => {
  let viewer: ViewerHandle | null = null;
  afterEach(() => {
    viewer?.destroy();
    viewer = null;
  });
  const page = {
    fieldia: '0.1',
    id: 'bug',
    data: { kind: 'record', model: 'work.item' },
    fields: {
      title: { type: 'char', label: 'Title' },
      state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }] },
    },
    layout: {
      type: 'sheet',
      id: 'sheet',
      title: { field: 'title' },
      children: [
        { type: 'field', id: 'f-state', field: 'state', widget: 'dot', options: { colours: { new: '#b2b2b2', active: '#007acc' } } },
        { type: 'tabs', id: 'tabs', children: [{ type: 'tab', id: 't-history', label: 'History', children: [{ type: 'slot', id: 's-history', name: 'history' }] }] },
      ],
    },
  } as unknown as Page;

  it('fills the page’s history slot with the record’s history, its states coloured as the page’s dot, and follows the form', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const chatter = source();
    const dataSource = createMemoryDataSource({ records: { 'work.item': { 7: { title: 'Stock count wrong', state: 'active' }, 8: { title: 'Another', state: 'new' } } } });
    viewer = mountViewer(host, { page, dataSource, recordId: 7, slots: { history: historySlot({ source: chatter, stateField: 'state', reasonField: 'reason', kind: 'work item' }) } });
    await until(() => host.querySelector('.fd-slot[data-slot="history"] .fd-history-row'));
    const chip = host.querySelectorAll<HTMLElement>('.fd-history-state .fd-history-dot')[1];
    expect(chip.style.background).toBe('rgb(0, 122, 204)');
    expect(host.querySelectorAll('.fd-history-row')).toHaveLength(9);
    // Saved again, it fetches what the backend wrote meanwhile.
    await chatter.post(bug, { kind: 'message', body: '<p>Seen.</p>' });
    viewer.form.setValue('title', 'Stock count wrong after a release');
    await viewer.save();
    await until(() => host.querySelectorAll('.fd-history-row').length === 10);
    expect(host.querySelector('.fd-history-summary')?.textContent).toBe('Mona Adel commented');
    // Another record: its own history, which has none.
    await viewer.form.openRecord(8);
    await until(() => host.querySelector('.fd-history-none'));
    expect(host.querySelector('.fd-history-none')?.textContent).toBe('No changes yet');
  });
});

describe('the history on a page that names its records', () => {
  it('tells its making in the page’s words where the app gives no kind of its own', async () => {
    const host = await mount({ kind: undefined, records: { one: 'bug', other: 'bugs', a: 'a bug' } });
    expect(summaries(host)).toContain('Mona Adel created the bug');
    handle?.destroy();
    const own = await mount({ records: { one: 'bug', other: 'bugs', a: 'a bug' } });
    expect(summaries(own)).toContain('Mona Adel created the work item');
  });
});
