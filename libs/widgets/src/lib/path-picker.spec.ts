import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page, type RelatedRecord } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';
import { memoryPreferences, type PreferenceStore } from './preferences';
import { recentPicksKey } from './path-picker';

/**
 * A path picker, as a work tracker's Area and Iteration: the value as its
 * path, a list of suggestions — the value and the person's latest picks —
 * then the tree, folded to the value's branch, each row's dates at its end.
 */

const ITERATIONS = {
  1: { name: 'Portal', path: ['Portal'] },
  2: { name: 'Test Plan', path: ['Portal', 'Test Plan'], dates: '8/3/2025 - 8/17/2025' },
  3: { name: 'Sprint 12', path: ['Portal', 'Sprint 12'], dates: '3/25/2026 - 4/16/2026' },
  4: { name: 'Sprint 14', path: ['Portal', 'Sprint 14'], dates: '4/12/2027 - 5/25/2027' },
  5: { name: 'Invoices', path: ['Portal', 'Invoices'], dates: '12/29/2027 - 2/9/2028' },
  6: { name: 'Warehouse', path: ['Warehouse'] },
  7: { name: 'Night shift', path: ['Warehouse', 'Night shift'] },
};

function mount(options: { value?: number | null; node?: Partial<FieldNode>; preferences?: PreferenceStore; dir?: 'rtl'; readonly?: boolean } = {}) {
  const page = {
    fieldia: '0.1',
    id: 'bug',
    data: { kind: 'record', model: 'work.item' },
    fields: { iteration: { type: 'many2one', label: 'Iteration', relation: 'work.iteration' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-iteration', field: 'iteration', widget: 'path', ...options.node }] },
  } as unknown as Page;
  const dataSource = createMemoryDataSource({ records: { 'work.iteration': ITERATIONS }, shows: { 'work.iteration': { path: 'path', aside: 'dates' } } });
  const form = createForm({ page, dataSource });
  const preferences = options.preferences ?? memoryPreferences();
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'iteration', field: page.fields['iteration'] as Field, node, id: 'fd-it', document, labels: WIDGET_LABELS.en, preferences });
  const host = document.createElement('div');
  if (options.dir) host.setAttribute('dir', options.dir);
  host.append(widget.element);
  document.body.replaceChildren(host);
  const refresh = () => widget.update({ value: form.getState().values['iteration'], values: form.getState().values, readonly: options.readonly ?? false, required: false, invalid: false });
  form.subscribe(refresh);
  if (options.value) {
    const record = ITERATIONS[options.value as keyof typeof ITERATIONS];
    form.setValue('iteration', { id: options.value, label: record.name, path: record.path, ...('dates' in record ? { aside: record.dates } : {}) });
  }
  refresh();
  const input = widget.element.querySelector('input') as HTMLInputElement;
  return { form, preferences, el: widget.element, input, value: () => form.getState().values['iteration'] as RelatedRecord | null };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const press = (target: Element, key: string, extra: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
  target.dispatchEvent(event);
  return event;
};
const tree = (el: Element) => el.querySelector('[role=tree]') as HTMLElement;
const callout = (el: Element) => el.querySelector('.fd-path-callout') as HTMLElement;
/** Each row as it reads: its words, and its dates after a bar. */
const rows = (el: Element) =>
  [...el.querySelectorAll<HTMLElement>('[role=treeitem]')].map((row) => [row.querySelector('.fd-path-words')?.textContent, row.querySelector('.fd-path-aside')?.textContent].filter(Boolean).join(' | '));
const active = (el: Element, input: HTMLInputElement) => el.ownerDocument.getElementById(input.getAttribute('aria-activedescendant') ?? '')?.querySelector('.fd-path-words')?.textContent;

async function open(el: HTMLElement, input: HTMLInputElement) {
  input.focus();
  input.click();
  await settle();
}

describe('a path picker', () => {
  it('shows its value as its path, its names joined by a backslash or the page’s own separator', () => {
    expect(mount({ value: 4 }).input.value).toBe('Portal\\Sprint 14');
    expect(mount({ value: 4, node: { options: { separator: ' / ' } } }).input.value).toBe('Portal / Sprint 14');
  });

  it('is a combobox whose list is a tree: suggestions in a group named by their heading, then the tree', async () => {
    const { el, input } = mount({ value: 4 });
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-haspopup')).toBe('tree');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    await open(el, input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(callout(el).hidden).toBe(false);
    expect(tree(el).getAttribute('aria-label')).toBe('Iteration');
    const group = tree(el).querySelector('[role=group]') as HTMLElement;
    expect(document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Suggestions');
    // The value first; the divider; the tree folded to the value's branch, each row's dates at its end.
    expect(rows(el)).toEqual([
      'Portal\\Sprint 14 | 4/12/2027 - 5/25/2027',
      'Portal',
      'Test Plan | 8/3/2025 - 8/17/2025',
      'Sprint 12 | 3/25/2026 - 4/16/2026',
      'Sprint 14 | 4/12/2027 - 5/25/2027',
      'Invoices | 12/29/2027 - 2/9/2028',
      'Warehouse',
    ]);
    expect(el.querySelector('.fd-path-divider')).not.toBeNull();
    const items = [...el.querySelectorAll<HTMLElement>('[role=tree] > [role=treeitem]')];
    expect(items.map((item) => [item.getAttribute('aria-level'), item.getAttribute('aria-expanded')])).toEqual([
      ['1', 'true'],
      ['2', null],
      ['2', null],
      ['2', null],
      ['2', null],
      ['1', 'false'],
    ]);
    // The value's row is the one reached, and read as chosen.
    expect(active(el, input)).toBe('Portal\\Sprint 14');
    expect(el.querySelector('[aria-selected="true"] .fd-path-words')?.textContent).toBe('Portal\\Sprint 14');
  });

  it('names each branch’s chevron by what it does, and a press on it folds or unfolds the branch without picking', async () => {
    const { el, input, value } = mount({ value: 4 });
    await open(el, input);
    const twists = [...el.querySelectorAll<HTMLButtonElement>('.fd-path-twist')];
    expect(twists.map((t) => [t.getAttribute('aria-label'), t.title, t.tabIndex])).toEqual([
      ['Collapse Portal', 'Collapse Portal', -1],
      ['Expand Warehouse', 'Expand Warehouse', -1],
    ]);
    twists[1].click();
    expect(rows(el)).toContain('Night shift');
    expect(value()?.id).toBe(4);
  });

  it('walks the tree by the arrows: → opens a branch, then goes to its first child; ← goes to the parent, then folds it', async () => {
    const { el, input } = mount({ value: 4 });
    await open(el, input);
    press(input, 'End');
    expect(active(el, input)).toBe('Warehouse');
    press(input, 'ArrowRight');
    expect(rows(el)).toContain('Night shift');
    expect(active(el, input)).toBe('Warehouse');
    press(input, 'ArrowRight');
    expect(active(el, input)).toBe('Night shift');
    press(input, 'ArrowLeft');
    expect(active(el, input)).toBe('Warehouse');
    press(input, 'ArrowLeft');
    expect(rows(el)).not.toContain('Night shift');
    press(input, 'Home');
    expect(active(el, input)).toBe('Portal\\Sprint 14');
    press(input, 'ArrowDown');
    expect(active(el, input)).toBe('Portal');
  });

  it('walks it the other way round right to left: ← opens, → goes back up', async () => {
    const { el, input } = mount({ value: 4, dir: 'rtl' });
    await open(el, input);
    press(input, 'End');
    press(input, 'ArrowLeft');
    press(input, 'ArrowLeft');
    expect(active(el, input)).toBe('Night shift');
    press(input, 'ArrowRight');
    expect(active(el, input)).toBe('Warehouse');
  });

  it('picks with Enter, and the pick leads its suggestions the next time, kept for the person under recent:<model>', async () => {
    const { el, input, value, preferences } = mount({ value: 4 });
    await open(el, input);
    press(input, 'ArrowDown'); // Portal
    press(input, 'ArrowDown'); // Test Plan
    press(input, 'Enter');
    expect(value()).toEqual({ id: 2, label: 'Test Plan', path: ['Portal', 'Test Plan'], aside: '8/3/2025 - 8/17/2025' });
    expect(input.value).toBe('Portal\\Test Plan');
    expect(callout(el).hidden).toBe(true);
    expect(preferences.get(recentPicksKey('work.iteration'))).toEqual([{ id: 2, label: 'Test Plan', path: ['Portal', 'Test Plan'], aside: '8/3/2025 - 8/17/2025' }]);
    await open(el, input);
    expect(rows(el).slice(0, 1)).toEqual(['Portal\\Test Plan | 8/3/2025 - 8/17/2025']);
  });

  it('keeps the latest picks in the order picked while the value is among them, as a work tracker suggests', async () => {
    const preferences = memoryPreferences();
    preferences.set(recentPicksKey('work.iteration'), [3, 4, 1, { id: 5, label: 'Invoices', path: ['Portal', 'Invoices'] }, 99]);
    const { el, input } = mount({ value: 4, preferences });
    await open(el, input);
    // The one no longer in the tree is left out; the tree's own dates are the newer.
    expect(rows(el).slice(0, 4)).toEqual(['Portal\\Sprint 12 | 3/25/2026 - 4/16/2026', 'Portal\\Sprint 14 | 4/12/2027 - 5/25/2027', 'Portal', 'Portal\\Invoices | 12/29/2027 - 2/9/2028']);
    expect(active(el, input)).toBe('Portal\\Sprint 14');
  });

  it('shows as many suggestions as the page says, none at 0, and no tree when told', async () => {
    const preferences = memoryPreferences();
    preferences.set(recentPicksKey('work.iteration'), [3, 1, 5]);
    const two = mount({ value: 4, preferences, node: { options: { suggestions: 2 } } });
    await open(two.el, two.input);
    expect(rows(two.el).slice(0, 3)).toEqual(['Portal\\Sprint 14 | 4/12/2027 - 5/25/2027', 'Portal\\Sprint 12 | 3/25/2026 - 4/16/2026', 'Portal']);
    const none = mount({ value: 4, node: { options: { suggestions: 0 } } });
    await open(none.el, none.input);
    expect(none.el.querySelector('[role=group]')).toBeNull();
    expect(none.el.querySelector('.fd-path-divider')).toBeNull();
    expect(rows(none.el)[0]).toBe('Portal');
    // No tree: the suggestions alone, the picks as they were kept.
    const kept = memoryPreferences();
    kept.set(recentPicksKey('work.iteration'), [{ id: 3, label: 'Sprint 12', path: ['Portal', 'Sprint 12'] }]);
    const flat = mount({ value: 4, preferences: kept, node: { options: { tree: false } } });
    await open(flat.el, flat.input);
    expect(rows(flat.el)).toEqual(['Portal\\Sprint 14 | 4/12/2027 - 5/25/2027', 'Portal\\Sprint 12']);
    expect(flat.el.querySelector('.fd-path-divider')).toBeNull();
  });

  it('shows the records whose path has the words typed, flat, each with its whole path; Enter picks the first', async () => {
    const { el, input, value } = mount({ value: 4 });
    await open(el, input);
    input.value = 'portal\\s';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(rows(el)).toEqual(['Portal\\Sprint 12 | 3/25/2026 - 4/16/2026', 'Portal\\Sprint 14 | 4/12/2027 - 5/25/2027']);
    expect(el.querySelector('[role=group]')).toBeNull();
    press(input, 'Enter');
    expect(value()?.id).toBe(3);
  });

  it('says so when nothing has the words typed', async () => {
    const { el, input } = mount({ value: 4 });
    await open(el, input);
    input.value = 'zzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(rows(el)).toEqual([]);
    expect((el.querySelector('.fd-path-empty') as HTMLElement).hidden).toBe(false);
    expect(el.querySelector('.fd-path-empty')?.textContent).toBe('No results');
  });

  it('puts back what the box showed on Escape and closes, keeping the key from a dialog round it', async () => {
    const { el, input, value } = mount({ value: 4 });
    await open(el, input);
    input.value = 'ware';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    let reached = false;
    document.body.addEventListener('keydown', () => (reached = true), { once: true });
    expect(press(input, 'Escape').defaultPrevented).toBe(true);
    expect(reached).toBe(false);
    expect(callout(el).hidden).toBe(true);
    expect(input.value).toBe('Portal\\Sprint 14');
    expect(value()?.id).toBe(4);
  });

  it('keeps its value when Tab leaves it, and opens from the keyboard with ↓', async () => {
    const { el, input, value } = mount({ value: 4 });
    input.focus();
    press(input, 'ArrowDown');
    await settle();
    expect(callout(el).hidden).toBe(false);
    press(input, 'ArrowDown');
    press(input, 'Tab');
    expect(callout(el).hidden).toBe(true);
    expect(value()?.id).toBe(4);
  });

  it('cannot be opened while read-only', async () => {
    const { el, input } = mount({ value: 4, readonly: true });
    await open(el, input);
    expect(callout(el).hidden).toBe(true);
    expect(input.readOnly).toBe(true);
  });
});
