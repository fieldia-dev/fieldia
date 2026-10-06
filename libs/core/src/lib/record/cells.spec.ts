import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm, type ActionRequest } from './form';

/**
 * A table's lines by their own rules, as Flectra's lists have them: a cell
 * hidden, locked or required by its line, a column hidden by the record, a
 * line's tone and a cell's, and buttons on each line.
 */
const transfer = {
  fieldia: '0.1',
  id: 'transfer',
  title: 'Transfer',
  data: { kind: 'record', model: 'stock.picking' },
  fields: {
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'assigned', label: 'Ready' }, { value: 'done', label: 'Done' }] },
    move_ids: {
      type: 'one2many',
      label: 'Operations',
      relation: 'stock.move',
      fields: {
        product: { type: 'char', label: 'Product' },
        demand: { type: 'float', label: 'Demand' },
        quantity: { type: 'float', label: 'Quantity' },
        tracking: { type: 'selection', label: 'Tracking', options: [{ value: 'none', label: 'None' }, { value: 'lot', label: 'Lot' }] },
        lot: { type: 'char', label: 'Lot' },
        scrapped: { type: 'boolean', label: 'Scrapped' },
      },
    },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    children: [
      { type: 'field', id: 'f-state', field: 'state' },
      {
        type: 'field',
        id: 'f-moves',
        field: 'move_ids',
        columns: ['product', 'demand', 'quantity', 'lot'],
        cells: {
          // Flectra: readonly="parent.state != 'draft'", column_invisible="parent.state == 'draft'", decoration-danger="quantity > demand".
          product: { readonly: "parent.state != 'draft'" },
          quantity: { hidden: "state == 'draft'", tones: [{ tone: 'danger', when: 'quantity > demand' }, { tone: 'success', when: 'quantity == demand' }], bold: 'quantity > 0' },
          lot: { invisible: "tracking == 'none'", required: "tracking == 'lot' and parent.state == 'assigned'" },
        },
        rowTones: [{ tone: 'muted', when: 'scrapped' }],
        rowButtons: [
          { type: 'button', id: 'serials', label: 'Assign serial numbers', invisible: "tracking == 'none'", steps: [{ do: 'call', action: 'action_assign_serial' }] },
        ],
      },
    ],
  },
} as unknown as Page;

const lines = [
  { key: 'a', values: { product: 'Beech planks', demand: 60, quantity: 60, tracking: 'none', lot: null, scrapped: false } },
  { key: 'b', values: { product: 'MDF board', demand: 25, quantity: 30, tracking: 'lot', lot: null, scrapped: false } },
  { key: 'c', values: { product: 'Glue', demand: 4, quantity: 0, tracking: 'none', lot: null, scrapped: true } },
];
const make = (state: string, onAction?: (request: ActionRequest) => void) => createForm({ page: transfer, values: { state, move_ids: lines } as never, onAction });

describe('a table’s lines by their own rules', () => {
  it('reads each cell’s conditions on its line, with the record as parent', () => {
    expect(validatePage(transfer)).toMatchObject({ ok: true });
    const draft = make('draft');
    expect(draft.lineState('f-moves', 'a').cells['product']).toMatchObject({ readonly: false });
    const ready = make('assigned');
    expect(ready.lineState('f-moves', 'a').cells['product']).toMatchObject({ readonly: true });
    expect(ready.lineState('f-moves', 'a').cells['lot']).toMatchObject({ invisible: true, required: false });
    expect(ready.lineState('f-moves', 'b').cells['lot']).toMatchObject({ invisible: false, required: true });
  });

  it('hides a whole column by the record, again when it changes', () => {
    const form = make('draft');
    expect(form.columnHidden('f-moves', 'quantity')).toBe(true);
    form.setValue('state', 'assigned');
    expect(form.columnHidden('f-moves', 'quantity')).toBe(false);
    expect(form.columnHidden('f-moves', 'product')).toBe(false);
  });

  it('gives a line and a cell the tone of the first condition that holds, and bold', () => {
    const form = make('assigned');
    expect(form.lineState('f-moves', 'b').cells['quantity']).toMatchObject({ tone: 'danger', bold: true });
    expect(form.lineState('f-moves', 'a').cells['quantity']).toMatchObject({ tone: 'success', bold: true });
    expect(form.lineState('f-moves', 'c').cells['quantity']).toMatchObject({ tone: null, bold: false });
    expect(form.lineState('f-moves', 'c').tone).toBe('muted');
    expect(form.lineState('f-moves', 'a').tone).toBeNull();
  });

  it('asks a cell its line requires for a value, and nothing of one its line hides', () => {
    const form = make('assigned');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors).toEqual({ 'move_ids.b.lot': expect.any(String) });
    form.updateLine('move_ids', 'b', 'lot', 'LOT-0042');
    expect(form.validate()).toBe(true);
  });

  it('shows a line’s buttons by its own condition, and runs them with the line', async () => {
    const asked: ActionRequest[] = [];
    const form = make('assigned', (request) => void asked.push(request));
    expect(form.lineState('f-moves', 'a').buttons).toEqual({ serials: false });
    expect(form.lineState('f-moves', 'b').buttons).toEqual({ serials: true });
    expect(await form.runRowAction('f-moves', 'serials', 'b')).toEqual({ done: true });
    expect(asked[0]).toMatchObject({ action: 'action_assign_serial', line: { field: 'move_ids', key: 'b', values: expect.objectContaining({ product: 'MDF board' }) } });
    expect(await form.runRowAction('f-moves', 'serials', 'a')).toMatchObject({ done: false, reason: 'cannot' });
  });
});

describe('the page check reads a table’s rules where they hold', () => {
  const withCells = (cells: unknown, extra: Record<string, unknown> = {}) => {
    const layout = transfer.layout as unknown as { children: Record<string, unknown>[] };
    return validatePage({ ...transfer, layout: { ...layout, children: [layout.children[0], { ...layout.children[1], cells, ...extra }] } } as unknown as Page);
  };
  const said = (result: ReturnType<typeof validatePage>) => ('issues' in result ? result.issues.map((issue) => `${issue.path}: ${issue.message}`) : []);

  it('refuses a column the lines lack, a line rule reading what the line lacks, a hidden rule reading a line field', () => {
    expect(said(withCells({ colour: { invisible: 'True' } }))).toEqual(['layout.children[1].cells.colour: "colour" is not a field of the lines of "move_ids"']);
    expect(said(withCells({ lot: { invisible: 'nope' } }))).toEqual(['layout.children[1].cells.lot.invisible: "nope" reads "nope", which is not a field of the lines of "move_ids"']);
    expect(said(withCells({ lot: { hidden: "tracking == 'none'" } }))).toEqual(['layout.children[1].cells.lot.hidden: "tracking == \'none\'" reads "tracking", which is not a field of this page']);
    expect(said(withCells({}, { rowTones: [{ tone: 'muted', when: 'nope' }] }))).toEqual(['layout.children[1].rowTones[0].when: "nope" reads "nope", which is not a field of the lines of "move_ids"']);
  });
});
