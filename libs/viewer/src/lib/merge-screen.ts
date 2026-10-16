import { BULK_KINDS, isEmpty, saveProblemOf, type Field, type LineField, type Page, type RecordId, type Value, type Values } from '@fieldia/core';
import { displayValue, keepTabIn } from '@fieldia/widgets';
import type { DuplicatesContext, MergeSide } from './duplicates';
import { nameFieldOf } from './related';

/**
 * The merge's screen (the duplicates part): the record shown and the one found like it, side by side — a column each,
 * a row for each field the page shows that they hold apart, a radio for each value. The record kept is picked over
 * its column (the one found, unless the person picks this one), and each row takes the kept record's value — but where
 * the kept one holds nothing and the other something, the other's, so nothing is let go unasked. A row the person
 * picked stays picked. What will happen is said in words before Merge: the record kept keeps the values picked and the
 * rest of its own, and what was the other's — its messages, activities and links — moves to it as the other goes:
 * the data source's work (`merge`). A merge the source refuses is said in the screen, which stays.
 */

/** Once merged: the record kept, its name as picked, and the source's own words about it. */
export interface Merged {
  id: RecordId;
  name: string;
  message?: string;
}

let screens = 0;

/** The fields a merge picks between: those the page shows, of a kind one value holds, that a person can set. */
function mergeFields(page: Page): string[] {
  const found: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    if (node['type'] === 'field' && typeof node['field'] === 'string') found.push(node['field']);
    // A sheet's title names its fields rather than placing them.
    const title = node['type'] === 'sheet' ? (node['title'] as { field?: unknown; subtitleField?: unknown } | undefined) : undefined;
    for (const name of [title?.field, title?.subtitleField]) if (typeof name === 'string') found.push(name);
    for (const key of Object.keys(node)) if (key !== 'title' && node[key] && typeof node[key] === 'object') visit(node[key]);
  };
  visit(page.layout);
  const settable = (def: Field | undefined) => !!def && BULK_KINDS.has(def.type) && def.readonly !== true && !def.compute;
  return [...new Set([...found, ...(page.duplicates?.fields ?? [])])].filter((name) => settable(page.fields[name]));
}

/** Two values the same: a link by its record, the rest as they are written. */
const same = (a: Value | undefined, b: Value | undefined): boolean => {
  const id = (v: Value | undefined) => (v && typeof v === 'object' && !Array.isArray(v) && 'id' in v ? String((v as { id: unknown }).id) : JSON.stringify(v ?? null));
  return id(a) === id(b);
};

/**
 * The two records side by side, to merge into one: resolves with the record kept once merged, or null when the person
 * cancelled. `opener` takes the focus back as it closes, where it is still on the page.
 */
export function openMergeScreen(context: DuplicatesContext, here: MergeSide, there: MergeSide, opener: HTMLElement | null): Promise<Merged | null> {
  const { el, labels, fill, form, page } = context;
  const nameField = nameFieldOf(page);
  const id = `fd-merge-${++screens}`;
  const fields = mergeFields(page);
  const blank = (field: string, value: Value | undefined) => isEmpty(page.fields[field], value as Value);
  const apart = fields.filter((field) => !same(here.values[field], there.values[field]) && !(blank(field, here.values[field]) && blank(field, there.values[field])));
  const alike = fields.filter((field) => !apart.includes(field) && !blank(field, here.values[field]));
  const sides = { here, there } as const;
  type Side = keyof typeof sides;
  /** The record kept: the one found, unless the person picks this one. */
  let keep: Side = 'there';
  /** Each row's pick, and the rows the person picked themselves. */
  const picks = new Map<string, Side>();
  const touched = new Set<string>();
  const other = (side: Side): Side => (side === 'here' ? 'there' : 'here');
  /** The kept record's value; where it holds nothing and the other something, the other's. */
  const byDefault = (field: string): Side => (blank(field, sides[keep].values[field]) && !blank(field, sides[other(keep)].values[field]) ? other(keep) : keep);

  return new Promise((resolve) => {
    const title = el('h2', { id: `${id}-title`, class: 'fd-form-dialog-title' }, labels.mergeTitle);
    const close = el('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': labels.close, title: labels.close }, '×');
    const radio = (name: string, value: Side, labelledBy?: string) => el('input', { type: 'radio', name: `${id}-${name}`, value, ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}) }) as HTMLInputElement;
    // The columns: each record by its name, the one shown marked, its radio keeping it.
    const keepRadios = (['here', 'there'] as const).map((side) => radio('keep', side));
    const head = el(
      'tr',
      {},
      el('td', {}),
      ...(['here', 'there'] as const).map((side, i) =>
        el('th', { scope: 'col' }, el('label', { class: 'fd-merge-pick' }, keepRadios[i], el('span', {}, fill(labels.mergeKeep, { name: sides[side].name }), ...(side === 'here' ? [el('span', { class: 'fd-merge-shown' }, labels.mergeShown)] : []))))
      )
    );
    // A row for each field they hold apart: its label, then each record's value with its radio.
    const rows = apart.map((field) => {
      const def = page.fields[field];
      const rowHead = el('th', { scope: 'row', id: `${id}-${field}` }, def.label);
      const cells = (['here', 'there'] as const).map((side) => {
        const value = sides[side].values[field];
        const words = blank(field, value) ? '' : def.type === 'boolean' ? (value ? labels.yes : labels.no) : displayValue(def as LineField, value as Value, sides[side].values, context.locale);
        const text = el('span', { id: `${id}-${field}-${side}`, class: words ? '' : 'fd-merge-empty' }, words || labels.mergeEmpty);
        const input = radio(field, side, `${rowHead.id} ${text.id}`);
        // A press on a value is the person's pick, though it was picked already: it stays as the kept record changes.
        input.addEventListener('click', () => {
          touched.add(field);
          picks.set(field, side);
          tell();
        });
        return { side, input, cell: el('td', {}, el('label', { class: 'fd-merge-pick' }, input, text)) };
      });
      return { field, cells, row: el('tr', { 'data-field': field }, rowHead, ...cells.map((c) => c.cell)) };
    });
    const table = el('table', { class: 'fd-merge-table' }, el('thead', {}, head), el('tbody', {}, ...rows.map((r) => r.row)));
    const labelOf = (field: string) => page.fields[field].label;
    const separator = (context.tag ?? context.locale).split('-')[0] === 'ar' ? '، ' : ', ';
    const sameWords = apart.length ? (alike.length ? fill(labels.mergeSame, { fields: alike.map(labelOf).join(separator) }) : '') : labels.mergeAllSame;
    const what = el('p', { class: 'fd-merge-what', id: `${id}-what` });
    const problem = el('p', { class: 'fd-merge-error', role: 'alert', hidden: '' });
    const body = el('div', { class: 'fd-form-dialog-body' }, el('p', { class: 'fd-merge-intro' }, labels.mergeIntro), ...(apart.length ? [table] : []), ...(sameWords ? [el('p', { class: 'fd-merge-same' }, sameWords)] : []), what, problem);
    const cancel = el('button', { type: 'button', class: 'fd-button' }, labels.cancel);
    const merge = el('button', { type: 'button', class: 'fd-button fd-button-primary', 'aria-describedby': what.id }, labels.merge);
    const box = el('div', { class: 'fd-form-dialog fd-size-medium fd-merge', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title.id, tabindex: '-1' }, el('div', { class: 'fd-form-dialog-head' }, title, close), body, el('div', { class: 'fd-actions fd-actions-end fd-form-dialog-foot' }, cancel, merge));
    const backdrop = el('div', { class: 'fd-dialog-backdrop fd-form-dialog-backdrop' }, box);

    /** The name the kept record will have: its name field's value as picked, else its own. */
    const keptName = () => {
      const named = rows.find((r) => r.field === nameField);
      const value = named ? sides[picks.get(named.field) ?? keep].values[named.field] : null;
      return typeof value === 'string' && value.trim() ? value : sides[keep].name;
    };
    /** Each row as picked, the radios over the columns as kept, and what will happen in words. */
    function tell() {
      keepRadios.forEach((input) => (input.checked = input.value === keep));
      for (const { field, cells } of rows) {
        const side = touched.has(field) ? (picks.get(field) as Side) : byDefault(field);
        picks.set(field, side);
        for (const cell of cells) cell.input.checked = cell.side === side;
      }
      // The records as they are named now: the one kept may take the other's name, which would leave the words naming one twice.
      what.textContent = fill(labels.mergeWhat, { kept: sides[keep].name, gone: sides[other(keep)].name });
    }
    keepRadios.forEach((input) =>
      input.addEventListener('change', () => {
        keep = input.value as Side;
        tell();
      })
    );
    tell();

    const finish = (merged: Merged | null) => {
      backdrop.remove();
      if (opener?.isConnected && !opener.closest('[hidden]')) opener.focus();
      resolve(merged);
    };
    cancel.addEventListener('click', () => finish(null));
    close.addEventListener('click', () => finish(null));
    merge.addEventListener('click', async () => {
      if (merge.hasAttribute('aria-busy')) return;
      merge.setAttribute('aria-busy', 'true');
      merge.textContent = labels.merging;
      problem.hidden = true;
      const kept = sides[keep];
      const values: Values = Object.fromEntries(rows.map(({ field }) => [field, JSON.parse(JSON.stringify(sides[picks.get(field) ?? keep].values[field] ?? null)) as Value]));
      try {
        const result = await form.merge({ keepId: kept.id, mergeIds: [sides[other(keep)].id], values });
        finish({ id: kept.id, name: keptName(), ...(result && result.message ? { message: result.message } : {}) });
      } catch (error) {
        problem.textContent = saveProblemOf(error).message;
        problem.hidden = false;
      } finally {
        merge.removeAttribute('aria-busy');
        merge.textContent = labels.merge;
      }
    });
    // Its keys are its own: Escape cancels it, and closes no dialog or panel under it; Tab stays in it.
    backdrop.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape' && !merge.hasAttribute('aria-busy')) {
        event.preventDefault();
        finish(null);
      } else keepTabIn(box, event);
    });
    context.root.append(backdrop);
    // The focus on the record kept, so the arrows move between the two at once.
    (keepRadios.find((input) => input.checked) ?? box).focus();
  });
}
