import { createForm, optionRulesPart, type Field, type FieldNode, type Form, type Line, type Page, type Values } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { linesWidget } from './lines-table';
import { createWidget, type Widget, type WidgetContext } from './widgets';

/**
 * A table of lines draws again only the lines whose inputs changed (the performance audit's H3): 0.34 drew every cell
 * of every line on each change anywhere in the form — a key in the record's name drew 1,000 cells at 200 lines, and
 * counted the lines before each line for every line (O(lines²)). Held two ways: by an oracle — for generated tables
 * and random edits, the table kept up to date change by change draws the same as a table drawn afresh on the form as it
 * stands (a full redraw) — and by counts: the cells drawn again for a key.
 */

/** A small seeded random: the same tables and edits each run, a failure named by its seed. */
const random = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

interface Made {
  page: Page;
  node: FieldNode;
}

/** A record with a table of lines, its columns, rules, totals and options drawn by lot. */
function tableOf(pick: () => number): Made {
  const chance = (p: number) => pick() < p;
  const kinds = chance(0.5);
  const sequence = chance(0.6);
  const fields: Record<string, unknown> = {
    product: { type: 'char', label: 'Product', required: chance(0.5) },
    qty: { type: 'integer', label: 'Quantity', min: 0 },
    price: { type: 'monetary', label: 'Price', currencyField: 'parent.currency', digits: [12, 2] },
    subtotal: { type: 'monetary', label: 'Subtotal', currencyField: 'parent.currency', compute: 'qty * price' },
    flag: { type: 'boolean', label: 'Flag' },
    grade: {
      type: 'selection',
      label: 'Grade',
      options: [
        { value: 'a', label: 'A' },
        // An option the record hides while it is done: the column's options follow the record.
        { value: 'b', label: 'B', ...(chance(0.5) ? { invisible: "parent.state == 'done'" } : {}) },
        { value: 'c', label: 'C' },
      ],
    },
    ...(kinds ? { kind: { type: 'selection', label: 'Kind', options: [{ value: 'section', label: 'Section' }, { value: 'note', label: 'Note' }] }, text: { type: 'char', label: 'Text' } } : {}),
    ...(sequence ? { seq: { type: 'integer', label: 'Sequence' } } : {}),
  };
  const all = ['product', 'qty', 'price', 'subtotal', 'grade', 'flag'];
  const columns = all.filter(() => chance(0.8));
  if (!columns.length) columns.push('qty');
  const cells: Record<string, unknown> = {};
  if (chance(0.5)) cells['product'] = { readonly: "parent.state == 'done'" };
  if (chance(0.5)) cells['qty'] = { tones: [{ tone: 'danger', when: 'qty > 5' }], bold: 'qty > 7' };
  if (chance(0.5)) cells['price'] = { invisible: 'flag' };
  if (chance(0.4)) cells['grade'] = { required: 'qty > 3' };
  const node = {
    type: 'field',
    id: 'f-lines',
    field: 'lines',
    columns,
    ...(chance(0.6) ? { totals: ['subtotal', 'qty'].filter((one) => columns.includes(one)) } : {}),
    ...(Object.keys(cells).length ? { cells } : {}),
    ...(chance(0.4) ? { rowTones: [{ tone: 'muted', when: 'flag' }] } : {}),
    ...(chance(0.3) ? { rowButtons: [{ type: 'button', id: 'split', label: 'Split', invisible: 'qty < 2', steps: [] }] } : {}),
    ...(chance(0.3) ? { selectedButtons: [{ type: 'button', id: 'drop', label: 'Drop', steps: [] }] } : {}),
    ...(chance(0.4) ? { lineDelete: "parent.state != 'done'" } : {}),
    options: { ...(chance(0.3) ? { min: 1 } : {}), ...(chance(0.3) ? { max: 9 } : {}), ...(chance(0.4) ? { copy: true } : {}) },
  } as unknown as FieldNode;
  const page = {
    fieldia: '0.13',
    id: 'order',
    data: { kind: 'record', model: 'order' },
    fields: {
      name: { type: 'char', label: 'Reference' },
      state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'done', label: 'Done' }] },
      currency: { type: 'char', label: 'Currency' },
      lines: { type: 'one2many', label: 'Lines', relation: 'order.line', fields, ...(kinds ? { lineKinds: { field: 'kind', text: 'text' } } : {}), ...(sequence ? { sequenceField: 'seq' } : {}) },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, node] },
  } as unknown as Page;
  return { page, node };
}

/** A line's values by lot: some empty, a few unread-worthy. */
function lineValues(pick: () => number, i: number, kinds: boolean): Values {
  if (kinds && pick() < 0.15) return { kind: pick() < 0.5 ? 'section' : 'note', text: `Heading ${i}` };
  return { product: pick() < 0.1 ? null : `Product ${i}`, qty: Math.floor(pick() * 10), price: Math.round(pick() * 1000) / 10, flag: pick() < 0.3, grade: ['a', 'b', 'c', null][Math.floor(pick() * 4)], ...(kinds ? { kind: null, text: null } : {}) };
}

/** A table drawn on a form, kept up to date as the form changes; `readonly` as the test says. */
function drawn(form: Form, made: Made, flags: { readonly: boolean }, create = createWidget): Widget {
  const widget = create({ form, name: 'lines', field: made.page.fields['lines'] as Field, node: made.node, id: 'fd-lines', document, labels: WIDGET_LABELS.en } as WidgetContext);
  return widget;
}
const refreshOf = (form: Form, widget: Widget, flags: { readonly: boolean }) => () => widget.update({ value: form.getState().values['lines'], values: form.getState().values, readonly: flags.readonly, required: false, invalid: false });

/**
 * What a table shows: its markup (what is said only as a box is left — aria-live — and the columns' widths, measured
 * only as lines come and go, set aside), then every box's value and tick as the person sees them.
 */
function shown(widget: Widget): string {
  const lines: string[] = [];
  // Each element on a line of its own, its attributes in one order (the order they were set in is no difference).
  const walk = (node: Node, depth: number) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) lines.push(`${'  '.repeat(depth)}"${node.textContent}"`);
      return;
    }
    if (!(node instanceof Element)) return;
    const skip = (name: string) => name === 'aria-live' || (name === 'style' && node.tagName === 'TH');
    const attributes = [...node.attributes].filter((one) => !skip(one.name)).map((one) => `${one.name}="${one.value}"`).sort();
    const box = node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement;
    const value = !box ? '' : node instanceof HTMLInputElement && (node.type === 'checkbox' || node.type === 'radio') ? ` checked=${node.checked}` : ` value=${JSON.stringify(node.value)}`;
    lines.push(`${'  '.repeat(depth)}<${node.tagName.toLowerCase()} ${attributes.join(' ')}>${value}`);
    for (const child of node.childNodes) walk(child, depth + 1);
  };
  walk(widget.element, 0);
  return lines.join('\n');
}

beforeAll(() => optionRulesPart.load());
afterEach(() => document.body.replaceChildren());

describe('a table of lines drawn again only where its inputs changed', () => {
  it('draws, edit after edit, what a table drawn afresh draws: generated tables, random edits (the oracle)', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const pick = random(seed);
      const made = tableOf(pick);
      const kinds = !!(made.page.fields['lines'] as { lineKinds?: unknown }).lineKinds;
      const sequence = !!(made.page.fields['lines'] as { sequenceField?: string }).sequenceField;
      const lines: Line[] = Array.from({ length: 3 + Math.floor(pick() * 8) }, (_, i) => ({ key: `l${i}`, values: { ...lineValues(pick, i, kinds), ...(sequence ? { seq: i + 1 } : {}) } }));
      const form = createForm({ page: made.page, values: { name: 'SO-1', state: 'draft', currency: 'EGP', lines } as never });
      const flags = { readonly: false };
      const kept = drawn(form, made, flags);
      document.body.replaceChildren(kept.element);
      const refresh = refreshOf(form, kept, flags);
      form.subscribe(refresh);
      refresh();
      const keys = () => ((form.getState().values['lines'] as Line[] | null) ?? []).map((line) => line.key);
      const anyKey = () => keys()[Math.floor(pick() * keys().length)];
      for (let step = 0; step < 30; step++) {
        const what = pick();
        const key = anyKey();
        if (what < 0.12) form.setValue('name', `SO-${Math.floor(pick() * 100)}`);
        else if (what < 0.2) form.setValue('state', form.getState().values['state'] === 'done' ? 'draft' : 'done');
        else if (what < 0.27) form.setValue('currency', form.getState().values['currency'] === 'EGP' ? 'USD' : 'EGP');
        else if (what < 0.55 && key) {
          const column = ['qty', 'price', 'product', 'flag', 'grade'][Math.floor(pick() * 5)];
          const value = { qty: Math.floor(pick() * 12) - 1, price: Math.round(pick() * 900) / 10, product: pick() < 0.2 ? null : `Item ${step}`, flag: pick() < 0.5, grade: ['a', 'b', 'c'][Math.floor(pick() * 3)] }[column];
          if (!(kinds && (form.getState().values['lines'] as Line[]).find((line) => line.key === key)?.values['kind'])) form.updateLine('lines', key, column, value ?? null);
        } else if (what < 0.63) form.addLine('lines', kinds && pick() < 0.3 ? { kind: 'note', text: 'A note' } : {});
        else if (what < 0.69 && key && keys().length > 1) {
          try {
            form.removeLine('lines', key);
          } catch {
            // A line the table keeps (lineDelete): it stays.
          }
        } else if (what < 0.75 && key && sequence) form.moveLine('lines', key, Math.floor(pick() * keys().length));
        else if (what < 0.82 && key) form.setUnread(`lines.${key}.qty`, pick() < 0.6 ? { text: 'lots', message: 'Quantity must be a whole number' } : null);
        else if (what < 0.9) form.validate();
        else {
          flags.readonly = !flags.readonly;
          refresh();
        }
        // A table drawn afresh on the form as it stands: the full redraw the kept one must match.
        const fresh = drawn(form, made, flags);
        refreshOf(form, fresh, flags)();
        expect({ seed, step, shown: shown(kept) }).toEqual({ seed, step, shown: shown(fresh) });
        fresh.destroy?.();
      }
      kept.destroy?.();
      form.dispose();
    }
  });

  it('draws again only the cells of the line typed in, and none for a key in the record’s own fields: 200 lines', () => {
    const page = {
      fieldia: '0.13',
      id: 'order',
      data: { kind: 'record', model: 'order' },
      fields: {
        name: { type: 'char', label: 'Reference' },
        currency: { type: 'char', label: 'Currency' },
        lines: {
          type: 'one2many',
          label: 'Lines',
          relation: 'order.line',
          fields: {
            product: { type: 'char', label: 'Product', required: true },
            qty: { type: 'integer', label: 'Quantity', min: 1 },
            price: { type: 'monetary', label: 'Unit price', currencyField: 'parent.currency', digits: [12, 2] },
            subtotal: { type: 'monetary', label: 'Subtotal', currencyField: 'parent.currency', compute: 'qty * price' },
            note: { type: 'char', label: 'Note' },
          },
        },
      },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-lines', field: 'lines', totals: ['subtotal'] }] },
    } as unknown as Page;
    const lines: Line[] = Array.from({ length: 200 }, (_, i) => ({ key: `l${i + 1}`, values: { product: `Product ${i + 1}`, qty: (i % 9) + 1, price: 10 + (i % 50), subtotal: ((i % 9) + 1) * (10 + (i % 50)), note: null } }));
    const form = createForm({ page, values: { name: 'SO-001', currency: 'EGP', lines } as never });
    let drawnCells = 0;
    // Each cell's widget counted as it is drawn again.
    const counting = ((context: WidgetContext) => {
      const widget = createWidget(context);
      const update = widget.update.bind(widget);
      widget.update = (state) => {
        drawnCells++;
        update(state);
      };
      return widget;
    }) as typeof createWidget;
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const table = linesWidget(counting)({ form, name: 'lines', field: page.fields['lines'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(table.element);
    const refresh = () => table.update({ value: form.getState().values['lines'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    expect(drawnCells).toBe(1000);
    // A key in the record's reference: no line reads it.
    drawnCells = 0;
    for (const name of ['SO-0017', 'SO-00177', 'SO-001777']) form.setValue('name', name);
    expect(drawnCells).toBe(0);
    // A key in a line's quantity: that line's cells, its subtotal worked out with it.
    drawnCells = 0;
    form.updateLine('lines', 'l101', 'qty', 7);
    expect(drawnCells).toBe(5);
    // The record's currency, which every line's money is in: every line, once.
    drawnCells = 0;
    form.setValue('currency', 'USD');
    expect(drawnCells).toBe(1000);
    // A line taken away: the others as they were, its row alone gone.
    drawnCells = 0;
    form.removeLine('lines', 'l100');
    expect(drawnCells).toBe(0);
    expect(table.element.querySelectorAll('tbody tr')).toHaveLength(199);
    expect(table.element.querySelector('tbody tr[data-line="l101"] .fd-line-delete')).not.toBeNull();
    table.destroy?.();
    form.dispose();
  });
});
