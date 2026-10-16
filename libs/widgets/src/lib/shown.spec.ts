import { createForm, createMemoryDataSource, type Field, type FieldNode, type Line, type Page, type RelatedRecord, type Values } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { openLineDialog } from './lines';
import { memoryPreferences } from './preferences';
import { stillShown, whileShown } from './shown';
import { createWidget, type WidgetDialogs } from './widgets';

/**
 * A part's answer that comes after the record it was asked for has gone — a name typed and looked up, a record made
 * from it, a line's dialog closed — is laid on no other record (`whileShown`, `stillShown`: the form's
 * `recordShown`). Two orders, both with a first line of the same key, as two made in two visits have.
 */

const wait = (ms = 60) => new Promise((done) => setTimeout(done, ms));
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const page = {
  fieldia: '0.1',
  id: 'order',
  data: { kind: 'record', model: 'order' },
  fields: {
    partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' },
    lines: { type: 'one2many', label: 'Lines', relation: 'order.line', fields: { label: { type: 'char', label: 'Label' }, qty: { type: 'float', label: 'Qty' } } },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-partner', field: 'partner_id' },
      { type: 'field', id: 'f-lines', field: 'lines' },
    ],
  },
} as unknown as Page;

async function mount() {
  const dataSource = createMemoryDataSource({
    records: {
      order: {
        1: { partner_id: { id: 1, label: 'Nile Traders' }, lines: [{ key: '1', id: 1, values: { label: 'Desk', qty: 1 } }] as unknown as Values['lines'] },
        2: { partner_id: null, lines: [{ key: '1', id: 2, values: { label: 'Chair', qty: 4 } }] as unknown as Values['lines'] },
      },
      partner: { 1: { name: 'Nile Traders' }, 2: { name: 'Delta Foods' } },
    },
    delayMs: 10,
  });
  // A search, and a record made, that take longer than a record's load, as a busy server's may.
  const slow = <A extends unknown[], R>(call: (...args: A) => Promise<R>) => async (...args: A) => {
    await wait(120);
    return call(...args);
  };
  dataSource.search = slow(dataSource.search.bind(dataSource));
  dataSource.create = slow(dataSource.create.bind(dataSource));
  const form = createForm({ page, dataSource, recordId: 1 });
  await form.load();
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: node.field, field: page.fields[node.field] as Field, node, id: 'fd-partner', document, labels: WIDGET_LABELS.en, preferences: memoryPreferences() });
  const after = document.createElement('button');
  document.body.replaceChildren(widget.element, after);
  const refresh = () => widget.update({ value: form.getState().values[node.field], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const input = widget.element.querySelector('input[role="combobox"]') as HTMLInputElement;
  return { form, input, dataSource };
}

describe('the test, as a part takes it', () => {
  it('acts while the record it was asked for is shown, and not once another is; a form of the app’s own always acts', async () => {
    const { form } = await mount();
    const done: string[] = [];
    const now = whileShown(form, (what: string) => void done.push(what));
    const shown = stillShown(form);
    expect(now('first')).toBe(true);
    expect(await form.openRecord(2)).toBe(true);
    expect(now('late')).toBe(false);
    expect(shown()).toBe(false);
    expect(done).toEqual(['first']);
    expect(whileShown({}, () => undefined)()).toBe(true);
    expect(stillShown(undefined)()).toBe(true);
  });
});

describe('a link’s name typed on order 1, answered once order 2 is shown', () => {
  it('left, and found once the app opened order 2: order 2 keeps its own customer, and its box shows it', async () => {
    const { form, input } = await mount();
    type(input, 'Delta Foods');
    input.blur();
    expect(await form.openRecord(2)).toBe(true);
    await wait(200);
    await form.settled();
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: [], values: { partner_id: null } });
    expect(input.value).toBe('');
  });

  it('“Create …” chosen, the record made once order 2 is shown: made, and not taken by order 2', async () => {
    const { form, input, dataSource } = await mount();
    type(input, 'Cairo Mills');
    await wait(400);
    const create = [...document.querySelectorAll<HTMLElement>('.fd-listbox [role="option"]')].find((option) => option.textContent?.includes('Cairo Mills'));
    expect(create).toBeDefined();
    create?.click();
    expect(await form.openRecord(2)).toBe(true);
    await wait(200);
    await form.settled();
    expect(Object.values(dataSource.records['partner']).map((p) => p['name'])).toContain('Cairo Mills');
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: [], values: { partner_id: null } });
  });
});

describe('a line’s dialog closed once another record is shown', () => {
  /** Dialogs whose line form the test closes, with the values it hands back. */
  function heldDialogs() {
    let close!: (values: Values | null) => void;
    const opened: Values[] = [];
    const dialogs: WidgetDialogs = {
      canOpen: () => false,
      openRecord: async () => null,
      searchMore: async () => null,
      editValues: (request) => {
        opened.push(request.values);
        return new Promise((resolve) => (close = resolve));
      },
    };
    return { dialogs, opened, close: (values: Values | null) => close(values) };
  }
  const node = (page.layout as { children: FieldNode[] }).children[1];
  const first = (lines: unknown) => (lines as Line[])[0];

  it('saved on order 1’s line once order 2 is shown: order 2’s line of the same key keeps its own values', async () => {
    const { form } = await mount();
    const held = heldDialogs();
    const editing = openLineDialog(form, 'lines', node, first(form.getState().values['lines']), held.dialogs, false);
    expect(held.opened).toEqual([{ label: 'Desk', qty: 1 }]);
    expect(await form.openRecord(2)).toBe(true);
    held.close({ label: 'Desk', qty: 9 });
    await editing;
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: [] });
    expect(first(form.getState().values['lines']).values).toEqual({ label: 'Chair', qty: 4 });
  });

  it('saved while its record is shown: written back to its line, as always', async () => {
    const { form } = await mount();
    const held = heldDialogs();
    const editing = openLineDialog(form, 'lines', node, first(form.getState().values['lines']), held.dialogs, false);
    held.close({ label: 'Desk', qty: 9 });
    await editing;
    expect(first(form.getState().values['lines']).values).toEqual({ label: 'Desk', qty: 9 });
    expect(form.getState().dirty).toEqual(['lines']);
  });
});

const label = (value: unknown) => (value as RelatedRecord | null)?.label ?? null;
it('the same name typed and left with order 1 still shown is taken, as always', async () => {
  const { form, input } = await mount();
  type(input, 'Delta Foods');
  input.blur();
  await wait(200);
  await form.settled();
  expect(label(form.getState().values['partner_id'])).toBe('Delta Foods');
});
