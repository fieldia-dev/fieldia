import type { Page } from '../format/page';
import { createForm, workAtRisk } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { ActionRequest } from './run';
import type { RelatedRecord } from './values';

/**
 * Every step that hands the form's values on reads what is typed first. A run the person or the app set off — a
 * button, its key, a line's button, `form.run` — reads every box (`settling`), waiting while a name is looked up,
 * before its first step that reads the form or hands its values on; text that does not read stops it there, said
 * under its box. A moment's run takes the values as they are. And text left that does not read is the person's
 * work, at risk after a save as a change is, kept through a conflict's Reload.
 */

const page = {
  fieldia: '0.1',
  id: 'quote',
  data: { kind: 'record', model: 'quote' },
  fields: {
    name: { type: 'char', label: 'Name' },
    seats: { type: 'integer', label: 'Seats' },
    who: { type: 'many2one', label: 'Customer', relation: 'person' },
    line_ids: { type: 'one2many', label: 'Lines', relation: 'quote.line', fields: { qty: { type: 'integer', label: 'Qty' } } },
  },
  on: { change: { name: [{ do: 'call', action: 'named' }] } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-seats', field: 'seats' },
      { type: 'field', id: 'f-who', field: 'who' },
      { type: 'field', id: 'f-lines', field: 'line_ids', rowButtons: [{ id: 'b-line', label: 'Price it', action: 'price_line' }] },
      { type: 'button', id: 'b-send', label: 'Send', steps: [{ do: 'call', action: 'send' }, { do: 'save' }] },
      { type: 'button', id: 'b-name', label: 'Name it', steps: [{ do: 'set', field: 'name', value: "'Seats: ' + seats" }] },
      { type: 'button', id: 'b-say', label: 'Hello', steps: [{ do: 'say', message: 'Hello' }] },
      { type: 'button', id: 'b-when', label: 'When', steps: [{ do: 'say', message: 'Many', when: 'seats > 2' }] },
    ],
  },
} as unknown as Page;

function quote() {
  const dataSource = createMemoryDataSource({
    records: { quote: { 1: { name: 'Fit-out', seats: 3, who: null, line_ids: [{ key: 'l1', id: 11, values: { qty: 1 } }] } }, person: { 1: { name: 'Mona' }, 2: { name: 'Omar' } } },
  });
  const handed: ActionRequest[] = [];
  const form = createForm({ page, dataSource, recordId: 1, onAction: (request) => void handed.push(request) });
  return { form, dataSource, handed };
}

/** A whole-number box with "1.5" typed: its reader keeps the text unread, the field the 1 it took on the way. */
function typedSeats(form: ReturnType<typeof createForm>) {
  form.setValue('seats', 1);
  const read = jest.fn(() => form.setUnread('seats', { text: '1.5', message: 'Seats takes whole numbers' }));
  form.settling(read);
  return read;
}

describe('a run the person sets off reads what is typed first', () => {
  it('a call never hands the app a value under text that does not read: the run stops, said under its box', async () => {
    const { form, handed, dataSource } = quote();
    await form.load();
    const read = typedSeats(form);
    const result = await form.runAction('b-send');
    expect(read).toHaveBeenCalled();
    expect(handed).toEqual([]);
    expect(result).toMatchObject({ done: false, stoppedAt: 0, reason: 'check', message: 'Seats takes whole numbers' });
    expect(form.getState().errors['seats']).toBe('Seats takes whole numbers');
    expect(dataSource.records['quote'][1]['seats']).toBe(3);
  });

  it('a call hands the app the record a name typed names, waiting while it is looked up', async () => {
    const { form, handed } = quote();
    await form.load();
    let found: ((record: RelatedRecord) => void) | null = null;
    let looking = true;
    form.settling(() => {
      if (!looking) return;
      form.setUnread('who', { text: 'Omar', message: 'still looking for “Omar”' });
      return new Promise<void>((done) => {
        found = (record) => {
          looking = false;
          form.setUnread('who', null);
          form.setValue('who', record);
          done();
        };
      });
    });
    const running = form.runAction('b-send');
    while (!found) await new Promise((next) => setTimeout(next));
    expect(handed).toEqual([]);
    (found as (record: RelatedRecord) => void)({ id: 2, label: 'Omar' });
    expect(await running).toMatchObject({ done: true });
    expect(handed[0].values['who']).toEqual({ id: 2, label: 'Omar' });
  });

  it('a set step never works a value out from one passed on the way', async () => {
    const { form } = quote();
    await form.load();
    typedSeats(form);
    expect(await form.runAction('b-name')).toMatchObject({ done: false, reason: 'check' });
    expect(form.getState().values['name']).toBe('Fit-out');
  });

  it('a step’s `when` reads the form: typed is read before it', async () => {
    const { form } = quote();
    await form.load();
    const read = typedSeats(form);
    expect(await form.runAction('b-when')).toMatchObject({ done: false, reason: 'check' });
    expect(read).toHaveBeenCalled();
  });

  it('a run whose steps read nothing reads no box', async () => {
    const { form } = quote();
    await form.load();
    const read = typedSeats(form);
    expect(await form.runAction('b-say')).toEqual({ done: true });
    expect(read).not.toHaveBeenCalled();
  });

  it('the app’s own form.run reads what is typed first, as a button does', async () => {
    const { form, handed } = quote();
    await form.load();
    typedSeats(form);
    expect(await form.run([{ do: 'call', action: 'send' }])).toMatchObject({ done: false, reason: 'check' });
    expect(handed).toEqual([]);
  });

  it('a moment’s run takes the values as they are: it never reads a box under the person’s keys', async () => {
    const { form, handed } = quote();
    await form.load();
    const read = jest.fn();
    form.settling(read);
    form.setValue('name', 'Fit-out 2');
    await form.settled();
    expect(handed.map((request) => request.action)).toEqual(['named']);
    expect(read).not.toHaveBeenCalled();
  });

  it('a line’s button hands on the line as what was typed in it reads', async () => {
    const { form, handed } = quote();
    await form.load();
    form.settling(() => form.updateLine('line_ids', 'l1', 'qty', 7));
    expect(await form.runRowAction('f-lines', 'b-line', 'l1')).toMatchObject({ done: true });
    expect(handed[0].line?.values['qty']).toBe(7);
  });
});

describe('text left that does not read is the person’s work', () => {
  it('is at risk after a save, as a change is; before the first save it is not', async () => {
    const { form } = quote();
    await form.load();
    form.setUnread('seats', { text: '12a', message: 'Seats: “12a” is not a number' });
    expect(workAtRisk(form.getState())).toBe(false);
    form.setUnread('seats', null);
    form.setValue('name', 'Fit-out 2');
    expect(await form.save()).toBe(true);
    expect(workAtRisk(form.getState())).toBe(false);
    form.setUnread('seats', { text: '12a', message: 'Seats: “12a” is not a number' });
    expect(form.getState().unsent).toEqual(['seats']);
    expect(workAtRisk(form.getState())).toBe(true);
    // Put right, it is no longer at risk.
    form.setUnread('seats', null);
    expect(workAtRisk(form.getState())).toBe(false);
  });

  it('a way out asks about it; Cancel keeps it, Discard lets it go with the box showing the value', async () => {
    const asked: string[] = [];
    let answer = false;
    const dataSource = createMemoryDataSource({ records: { quote: { 1: { name: 'Fit-out', seats: 3 }, 2: { name: 'Other', seats: 1 } } } });
    const form = createForm({ page, dataSource, recordId: 1, confirm: (message) => (asked.push(message), answer) });
    await form.load();
    form.setValue('name', 'Fit-out 2');
    await form.save();
    form.setUnread('seats', { text: '12a', message: 'Seats: “12a” is not a number' });
    expect(await form.openRecord(2)).toBe(false);
    expect(asked).toHaveLength(1);
    expect(form.getState()).toMatchObject({ recordId: 1, unread: { seats: { text: '12a' } } });
    answer = true;
    expect(await form.leave()).toBe(true);
    expect(form.getState().unread).toEqual({});
    expect(form.getState().unsent).toEqual([]);
  });

  it('is kept through a conflict’s Reload, beside the changes set aside', async () => {
    const dataSource = createMemoryDataSource({ records: { quote: { 1: { name: 'Fit-out', seats: 3 } } }, versions: true });
    const form = createForm({ page, dataSource, recordId: 1 });
    await form.load();
    // Someone else saves first.
    dataSource.changeElsewhere('quote', 1, { name: 'Theirs' }, { by: 'Mona' });
    form.setValue('name', 'Mine');
    expect(await form.save()).toBe(false);
    expect(form.getState().conflict).not.toBeNull();
    form.setUnread('seats', { text: '12a', message: 'Seats: “12a” is not a number' });
    expect(await form.reloadTheirs()).toBe(true);
    expect(form.getState()).toMatchObject({ setAside: { name: 'Mine' }, unread: { seats: { text: '12a' } }, values: { name: 'Theirs' } });
  });
});

describe('a name asked for exactly', () => {
  it('is handed to the data source as `exact`, and the memory source finds that name alone', async () => {
    const dataSource = createMemoryDataSource({ records: { quote: { 1: {} }, person: { 1: { name: 'Blue Nile' }, 2: { name: 'Nile' }, 3: { name: 'nile' } } } });
    const form = createForm({ page, dataSource, recordId: 1 });
    await form.load();
    expect((await form.search('who', 'Nile', 8)).map((r) => r.id)).toEqual([1, 2, 3]);
    expect((await form.search('who', 'Nile', 8, { exact: true })).map((r) => r.id)).toEqual([2, 3]);
    const asked = dataSource.calls.filter((call) => call.method === 'search').map((call) => (call.request as { exact?: boolean }).exact ?? false);
    expect(asked).toEqual([false, true]);
  });
});
