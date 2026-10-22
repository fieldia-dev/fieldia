import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm, type Form } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { Line, Values } from './values';

/**
 * Undo and Redo while filling (`form.undo()`, `form.redo()`): the person's changes, one at a time across fields and
 * lines — typing on in one box one change until it is left — taken back as their own change back, never a step's or
 * the app's, and never over what someone else wrote since.
 */

const checked = validatePage({
  fieldia: '0.9',
  id: 'quote',
  title: 'Quote',
  data: { kind: 'record', model: 'quote' },
  fields: {
    name: { type: 'char', label: 'Customer' },
    note: { type: 'text', label: 'Note' },
    stage: { type: 'selection', label: 'Stage', options: [{ value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }] },
    total: { type: 'float', label: 'Total', compute: "sum(lines, 'amount')" },
    lines: {
      type: 'one2many',
      label: 'Lines',
      relation: 'quote.line',
      sequenceField: 'sequence',
      fields: { sequence: { type: 'integer', label: '#' }, item: { type: 'char', label: 'Item' }, amount: { type: 'float', label: 'Amount' } },
    },
  },
  on: { change: { stage: [{ do: 'set', field: 'note', value: "'Stage moved'" }] } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    children: [
      {
        type: 'section',
        id: 'main',
        children: [
          { type: 'field', id: 'f-note', field: 'note' },
          { type: 'field', id: 'f-stage', field: 'stage' },
          { type: 'field', id: 'f-total', field: 'total' },
          { type: 'field', id: 'f-lines', field: 'lines' },
        ],
      },
    ],
  },
});
if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
const quote = checked.page as Page;

const lines = (form: Form) => (form.getState().values['lines'] as Line[]).map((line) => line.values['item']);

async function opened(values: Values = {}): Promise<Form> {
  const dataSource = createMemoryDataSource({
    records: { quote: { 1: { name: 'Nile Traders', note: '', stage: 'draft', lines: [{ key: '1', id: 1, values: { sequence: 1, item: 'Desk', amount: 100 } }], ...values } } },
  });
  const form = createForm({ page: quote, dataSource, recordId: 1 });
  await form.load();
  return form;
}

describe('undo and redo while filling', () => {
  it('takes back the last change, then the one before, across fields, and makes them again in order', async () => {
    const form = await opened();
    form.setValue('name', 'Nile Traders Co.');
    form.boxLeft('name');
    form.setValue('note', 'Call first');
    expect(form.history().undo).toEqual({ field: 'note' });
    expect(form.undo()).toEqual({ field: 'note' });
    expect(form.getState().values['note']).toBe('');
    expect(form.undo()).toEqual({ field: 'name' });
    expect(form.getState().values['name']).toBe('Nile Traders');
    // Back where it was loaded: nothing is changed.
    expect(form.getState().dirty).toEqual([]);
    expect(form.undo()).toBeNull();
    expect(form.redo()).toEqual({ field: 'name' });
    expect(form.redo()).toEqual({ field: 'note' });
    expect(form.getState().values).toMatchObject({ name: 'Nile Traders Co.', note: 'Call first' });
    expect(form.redo()).toBeNull();
  });

  it('keeps typing on in one box as one change until the box is left', async () => {
    const form = await opened();
    for (const text of ['N', 'Ni', 'Nil', 'Nile']) form.setValue('note', text);
    form.boxLeft('note');
    form.setValue('note', 'Nile!');
    expect(form.undo()).toEqual({ field: 'note' });
    expect(form.getState().values['note']).toBe('Nile');
    expect(form.undo()).toEqual({ field: 'note' });
    expect(form.getState().values['note']).toBe('');
  });

  it('passes over a change typed back to where it started', async () => {
    const form = await opened();
    form.setValue('name', 'Nile');
    form.boxLeft('name');
    form.setValue('note', 'x');
    form.setValue('note', '');
    expect(form.undo()).toEqual({ field: 'name' });
    expect(form.getState().values['name']).toBe('Nile Traders');
  });

  it('takes back a cell typed in, a line added, taken away and moved, one at a time, and what is worked out from them follows', async () => {
    const form = await opened();
    const key = form.addLine('lines', { item: 'Chair', amount: 40 });
    expect(form.getState().values['total']).toBe(140);
    form.updateLine('lines', key, 'amount', 60);
    form.boxLeft(`lines.${key}.amount`);
    form.moveLine('lines', key, 0);
    form.removeLine('lines', '1');
    expect(lines(form)).toEqual(['Chair']);
    expect(form.undo()).toEqual({ field: 'lines', line: '1' });
    expect(lines(form)).toEqual(['Chair', 'Desk']);
    expect(form.undo()).toEqual({ field: 'lines' });
    expect(lines(form)).toEqual(['Desk', 'Chair']);
    expect(form.undo()).toEqual({ field: 'lines', line: key });
    expect(form.getState().values['total']).toBe(140);
    expect(form.undo()).toEqual({ field: 'lines', line: key });
    expect(lines(form)).toEqual(['Desk']);
    expect(form.getState().values['total']).toBe(100);
    expect(form.getState().dirty).toEqual([]);
    expect(form.redo()).toEqual({ field: 'lines', line: key });
    expect(lines(form)).toEqual(['Desk', 'Chair']);
  });

  it("is the person's change back: the page's change steps run, and a step's write is never a change to take back", async () => {
    const form = await opened();
    form.setValue('stage', 'sent');
    await form.settled();
    expect(form.getState().values['note']).toBe('Stage moved');
    // The step wrote the note: Undo takes back the stage, the person's.
    expect(form.history().undo).toEqual({ field: 'stage' });
    form.setValue('note', '');
    form.boxLeft('note');
    expect(form.undo()).toEqual({ field: 'note' });
    expect(form.undo()).toEqual({ field: 'stage' });
    await form.settled();
    expect(form.getState().values['stage']).toBe('draft');
    expect(form.getState().values['note']).toBe('Stage moved');
  });

  it('passes over a change whose field holds something else since, and starts again with each record', async () => {
    const form = await opened();
    form.setValue('name', 'Nile');
    form.boxLeft('name');
    form.setValue('note', 'Mine');
    form.boxLeft('note');
    // The app writes the note in its place: that change of the person's is no longer theirs to take back.
    form.setValues({ note: 'The app’s' });
    expect(form.undo()).toEqual({ field: 'name' });
    expect(form.getState().values['note']).toBe('The app’s');
    form.setValue('name', 'Again');
    await form.openRecord(1);
    expect(form.history()).toEqual({ undo: null, redo: null });
    expect(form.undo()).toBeNull();
  });

  it('a new change lets go of what Redo would make again; Discard keeps nothing to take back', async () => {
    const form = await opened();
    form.setValue('name', 'A');
    form.boxLeft('name');
    form.undo();
    expect(form.history().redo).toEqual({ field: 'name' });
    form.setValue('note', 'B');
    expect(form.history().redo).toBeNull();
    form.reset();
    expect(form.history()).toEqual({ undo: null, redo: null });
  });

  it('takes back nothing in a field locked now, nor in a form not being edited', async () => {
    const form = await opened();
    form.setValue('name', 'A');
    form.setEditing(false);
    expect(form.undo()).toBeNull();
    expect(form.getState().values['name']).toBe('A');
    // Kept meanwhile: editing again, it is there to take back.
    form.setEditing(true);
    expect(form.undo()).toEqual({ field: 'name' });
  });
});
