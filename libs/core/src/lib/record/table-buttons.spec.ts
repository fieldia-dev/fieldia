import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm, type ActionRequest } from './form';

/**
 * A table's buttons besides those on each line: buttons for the lines chosen
 * in it — Flectra's list header buttons, Start, Pause, Done on the selected
 * work orders — and buttons in its control row beside Add a line, as Flectra's
 * <control> (Catalog).
 */
const order = {
  fieldia: '0.1',
  id: 'mo',
  data: { kind: 'record', model: 'mrp.production' },
  fields: {
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'progress', label: 'In progress' }] },
    workorder_ids: {
      type: 'one2many',
      label: 'Work orders',
      relation: 'mrp.workorder',
      fields: { name: { type: 'char', label: 'Operation' }, state: { type: 'char', label: 'Status' } },
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      {
        type: 'field',
        id: 'f-wo',
        field: 'workorder_ids',
        selectedButtons: [
          { type: 'button', id: 'wo-start', label: 'Start', action: 'button_start', invisible: "state == 'draft'" },
          { type: 'button', id: 'wo-done', label: 'Done', action: 'button_finish', confirm: 'Mark the chosen work orders done?' },
        ],
        controlButtons: [{ type: 'button', id: 'wo-catalog', label: 'Catalog', action: 'action_add_from_catalog', invisible: "state == 'draft'" }],
        rowButtons: [{ type: 'button', id: 'wo-block', label: 'Block', action: 'button_block', confirm: 'Block this work order?' }],
      },
    ],
  },
} as unknown as Page;

const lines = [
  { key: 'a', id: 11, values: { name: 'Cut', state: 'ready' } },
  { key: 'b', id: 12, values: { name: 'Glue', state: 'ready' } },
  { key: 'c', values: { name: 'Paint', state: 'pending' } },
];

function make(state: string, answer = true) {
  const asked: ActionRequest[] = [];
  const questions: string[] = [];
  const form = createForm({
    page: order,
    values: { state, workorder_ids: lines } as never,
    onAction: (request) => void asked.push(request),
    confirm: (message) => (questions.push(message), answer),
  });
  return { form, asked, questions };
}

describe('buttons for the lines chosen in a table', () => {
  it('is a valid page; a button’s id is unique and its condition reads the record', () => {
    expect(validatePage(order)).toMatchObject({ ok: true });
    const clash = structuredClone(order) as unknown as { layout: { children: { controlButtons: { id: string }[] }[] } };
    clash.layout.children[0].controlButtons[0].id = 'wo-start';
    expect(JSON.stringify(validatePage(clash as unknown as Page))).toContain('duplicate id \\"wo-start\\"');
    const wrong = structuredClone(order) as unknown as { layout: { children: { selectedButtons: { invisible: string }[] }[] } };
    wrong.layout.children[0].selectedButtons[0].invisible = 'name == 1';
    expect(validatePage(wrong as unknown as Page).ok).toBe(false);
  });

  it('runs with the chosen lines: every call carries their keys, ids and values', async () => {
    const { form, asked } = make('progress');
    const result = await form.runLinesAction('f-wo', 'wo-start', ['a', 'c']);
    expect(result.done).toBe(true);
    expect(asked[0]).toMatchObject({ action: 'button_start', lines: { field: 'workorder_ids', keys: ['a', 'c'], ids: [11], values: [{ name: 'Cut' }, { name: 'Paint' }] } });
  });

  it('is shown by a condition on the record, and hidden it does not run', async () => {
    const { form, asked } = make('draft');
    expect(form.node('wo-start').invisible).toBe(true);
    expect(form.node('wo-done').invisible).toBe(false);
    expect(await form.runLinesAction('f-wo', 'wo-start', ['a'])).toMatchObject({ done: false, reason: 'cannot' });
    expect(asked).toEqual([]);
  });

  it('asks first when it says so, and runs with none chosen never', async () => {
    const { form, asked, questions } = make('progress', false);
    expect(await form.runLinesAction('f-wo', 'wo-done', ['a'])).toMatchObject({ done: false, reason: 'no' });
    expect(questions).toEqual(['Mark the chosen work orders done?']);
    expect(await form.runLinesAction('f-wo', 'wo-start', [])).toMatchObject({ done: false, reason: 'cannot' });
    expect(asked).toEqual([]);
    await expect(form.runLinesAction('f-wo', 'nope', ['a'])).rejects.toThrow(/no button "nope"/);
    // A key the table does not hold is no line to run with.
    await expect(form.runLinesAction('f-wo', 'wo-start', ['zzz'])).rejects.toThrow(/no line "zzz"/);
  });
});

describe('buttons in a table’s control row', () => {
  it('run as any button of the record, shown by a condition on it', async () => {
    const { form, asked } = make('draft');
    expect(form.node('wo-catalog').invisible).toBe(true);
    form.setValue('state', 'progress');
    expect(form.node('wo-catalog').invisible).toBe(false);
    await form.runAction('wo-catalog');
    expect(asked[0]).toMatchObject({ action: 'action_add_from_catalog' });
    expect(asked[0].lines).toBeUndefined();
  });
});

describe('a button on a line', () => {
  it('asks first when it says so, as any button does', async () => {
    const { form, asked, questions } = make('progress', false);
    expect(await form.runRowAction('f-wo', 'wo-block', 'a')).toMatchObject({ done: false, reason: 'no' });
    expect(questions).toEqual(['Block this work order?']);
    expect(asked).toEqual([]);
  });
});
