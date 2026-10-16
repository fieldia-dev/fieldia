import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import type { DataSource, SaveRequest } from './data-source';
import { createForm, workAtRisk, type Form } from './form';
import type { ActionHost } from './run';
import type { Line, RecordId, Values } from './values';

/**
 * The person's work at risk is told field by field, from who wrote each last (docs/plans/wave1-contract.md, section
 * 10, part 3). A step that writes a field the person changed after the last save — their own change tidied by the
 * page's `change` steps, or a line added to the table whose other lines they edited — must not take their change out
 * of what a way out asks about: the value they typed is still on screen, and still not saved.
 */

const order = {
  fieldia: '0.1',
  id: 'order',
  title: 'Order',
  data: { kind: 'record', model: 'order' },
  fields: {
    name: { type: 'char', label: 'Name', required: true },
    budget: { type: 'float', label: 'Budget' },
    lines: { type: 'one2many', label: 'Lines', relation: 'order.line', fields: { label: { type: 'char', label: 'Label' }, qty: { type: 'float', label: 'Qty' } } },
  },
  // The page tidies a budget as it is typed: whole pounds.
  on: { change: { budget: [{ do: 'set', field: 'budget', value: 'round(budget, 0)' }] } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    children: [
      {
        type: 'section',
        id: 'main',
        children: [
          { type: 'field', id: 'f-budget', field: 'budget' },
          { type: 'field', id: 'f-lines', field: 'lines' },
          { type: 'button', id: 'b-delivery', label: 'Add delivery', steps: [{ do: 'addLine', field: 'lines', values: { label: "'Delivery'", qty: '1' } }] },
        ],
      },
    ],
  },
} as Page;

function source() {
  const records: Record<string, Values> = {
    1: { name: 'Order one', budget: 1000, lines: [{ key: 'l1', id: 11, values: { label: 'Desk', qty: 1 } }] as unknown as Values['lines'] },
    2: { name: 'Order two', budget: 2000, lines: [] },
  };
  return {
    records,
    async load({ id }: { id: RecordId }) {
      return structuredClone(records[id as number]);
    },
    async save(request: SaveRequest) {
      const id = (request.id ?? 3) as number;
      records[id] = { ...(records[id] ?? {}), ...structuredClone(request.values) };
      return { id };
    },
  } satisfies DataSource & Record<string, unknown>;
}

function host() {
  const asked: string[] = [];
  const made: ActionHost = {
    open: async () => ({ saved: false }),
    say: () => undefined,
    ask: (message) => {
      asked.push(message);
      return Promise.resolve(false);
    },
    close: () => undefined,
  };
  return { host: made, asked };
}

/** Order 1 opened, a change of the person's saved: what they change from here is at risk until saved. */
async function savedOnce(): Promise<{ form: Form; asked: string[]; ds: ReturnType<typeof source> }> {
  const ds = source();
  const made = host();
  const form = createForm({ page: order, dataSource: ds, recordId: 1, host: made.host });
  await form.load();
  await form.settled();
  form.setValue('name', 'Order one, Nile Traders');
  expect(await form.save()).toBe(true);
  return { form, asked: made.asked, ds };
}

beforeAll(() => expect(validatePage(order)).toMatchObject({ ok: true }));

it('a budget typed after the save, tidied by the page’s change step: a way out still asks before it goes', async () => {
  const { form, asked, ds } = await savedOnce();
  form.setValue('budget', 4300000.4);
  await form.settled();
  expect(form.getState().values['budget']).toBe(4300000);
  expect(workAtRisk(form.getState())).toBe(true);
  expect(await form.openRecord(2)).toBe(false);
  expect(asked).toEqual(['Discard your changes?']);
  expect(ds.records[1]['budget']).toBe(1000);
});

it('a line edited after the save, then a line added by the page’s button: a way out still asks before the edit goes', async () => {
  const { form, asked } = await savedOnce();
  const [desk] = form.getState().values['lines'] as Line[];
  form.updateLine('lines', desk.key, 'qty', 7);
  expect(form.getState().unsent).toEqual(['lines']);
  expect(await form.runAction('b-delivery')).toMatchObject({ done: true });
  expect(workAtRisk(form.getState())).toBe(true);
  expect(await form.openRecord(2)).toBe(false);
  expect(asked).toEqual(['Discard your changes?']);
  expect((form.getState().values['lines'] as Line[])[0].values['qty']).toBe(7);
});
