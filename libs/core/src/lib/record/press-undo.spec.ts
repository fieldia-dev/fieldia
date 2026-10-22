import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm, type Form } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { ActionHost, ActionResult, OnAction, SayUndo } from './run';
import type { Values } from './values';

/**
 * Undo on the toast after a one-tap press (`undo` on a button or a menu item, or the app answering with one): what the
 * press said is said once it ends, the last with Undo; Undo takes back what it did — or runs the page's own steps for
 * it, or the app's own undo — and is never offered for what Fieldia cannot take back.
 */

function page(buttons: object[], menu: object[] = []): Page {
  const checked = validatePage({
    fieldia: '0.7',
    id: 'followup',
    title: 'Follow-up',
    data: { kind: 'record', model: 'followup' },
    fields: {
      name: { type: 'char', label: 'Name' },
      state: { type: 'selection', label: 'State', options: [{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }] },
      active: { type: 'boolean', label: 'Active' },
      note: { type: 'char', label: 'Note' },
    },
    layout: { type: 'sheet', id: 'sheet', title: { field: 'name' }, ...(menu.length ? { toolbar: { menu } } : {}), buttons, children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-state', field: 'state' }, { type: 'field', id: 'f-note', field: 'note' }] }] },
  });
  if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
  return checked.page as Page;
}

interface Said {
  message: string;
  tone: string;
  undo?: SayUndo;
}

async function opened(buttons: object[], more: { menu?: object[]; onAction?: OnAction; values?: Values } = {}) {
  const said: Said[] = [];
  const asked: string[] = [];
  const host: ActionHost = {
    open: async () => ({ saved: false }),
    say: (message, tone, undo) => said.push({ message, tone, ...(undo ? { undo } : {}) }),
    ask: async (message) => (asked.push(message), true),
  };
  const dataSource = createMemoryDataSource({ records: { followup: { 1: { name: 'Call Mona', state: 'open', active: true, note: '', ...more.values } } } });
  const form: Form = createForm({ page: page(buttons, more.menu), dataSource, recordId: 1, host, ...(more.onAction ? { onAction: more.onAction } : {}) });
  await form.load();
  return { form, said, asked, stored: () => dataSource.records['followup'][1] };
}

const markDone = (more: object = {}) => ({ type: 'button', id: 'b-done', label: 'Mark done', steps: [{ do: 'set', field: 'state', value: "'done'" }, { do: 'save' }], ...more });

describe('Undo on the toast after a one-tap press', () => {
  it('says "Done: {label}" with Undo, which puts back what the steps set and saves it again', async () => {
    const { form, said, stored } = await opened([markDone({ undo: true })]);
    expect((await form.runAction('b-done')).done).toBe(true);
    expect(stored()['state']).toBe('done');
    expect(said).toHaveLength(1);
    expect(said[0]).toMatchObject({ message: 'Done: Mark done', tone: 'success' });
    const taken = await (said[0].undo as SayUndo).undo();
    expect(taken.done).toBe(true);
    expect(form.getState().values['state']).toBe('open');
    expect(stored()['state']).toBe('open');
    expect(form.getState().dirty).toEqual([]);
  });

  it("carries the press's own last words, said once, the ones before them said plainly", async () => {
    const button = markDone({ undo: true, steps: [{ do: 'say', message: 'Marking…' }, { do: 'set', field: 'state', value: "'done'" }, { do: 'save' }, { do: 'say', message: 'Follow-up marked done', tone: 'success' }] });
    const { form, said } = await opened([button]);
    await form.runAction('b-done');
    expect(said.map((one) => [one.message, !!one.undo])).toEqual([
      ['Marking…', false],
      ['Follow-up marked done', true],
    ]);
  });

  it('puts back only what still holds what the press left: a change made since stays', async () => {
    const button = markDone({ undo: true, steps: [{ do: 'set', field: 'state', value: "'done'" }, { do: 'set', field: 'note', value: "'Called'" }, { do: 'save' }] });
    const { form, said, stored } = await opened([button]);
    await form.runAction('b-done');
    form.setValue('note', 'Called twice');
    await (said[0].undo as SayUndo).undo();
    expect(stored()).toMatchObject({ state: 'open', note: 'Called twice' });
  });

  it('archives at once from the menu, asking nothing, and Undo brings the record back', async () => {
    const { form, said, asked, stored } = await opened([], { menu: [{ id: 'm-archive', builtin: 'archive', undo: true }] });
    expect((await form.runAction('m-archive')).done).toBe(true);
    expect(asked).toEqual([]);
    expect(stored()['active']).toBe(false);
    expect(said[0].message).toBe('Archived.');
    await (said[0].undo as SayUndo).undo();
    expect(stored()['active']).toBe(true);
    expect(form.getState().values['active']).toBe(true);
  });

  it("offers the app's own undo where it answers with one, and lays what that answers", async () => {
    const calls: string[] = [];
    const onAction: OnAction = (request) => {
      calls.push(request.action);
      return { values: { state: 'done' }, say: { message: 'Message sent to Mona', tone: 'success' }, undo: () => (calls.push('unsend'), { values: { state: 'open' }, say: 'Not sent' }) } satisfies ActionResult;
    };
    const { form, said } = await opened([{ type: 'button', id: 'b-send', label: 'Send', action: 'send' }], { onAction });
    await form.runAction('b-send');
    expect(said).toHaveLength(1);
    expect(said[0]).toMatchObject({ message: 'Message sent to Mona', tone: 'success' });
    expect((await (said[0].undo as SayUndo).undo()).done).toBe(true);
    expect(calls).toEqual(['send', 'unsend']);
    expect(form.getState().values['state']).toBe('open');
    expect(said[1]).toMatchObject({ message: 'Not sent', tone: 'info' });
    expect(said[1].undo).toBeUndefined();
  });

  it('runs the page’s own steps for Undo where its button gives them', async () => {
    const calls: string[] = [];
    const { form, said } = await opened([markDone({ undo: [{ do: 'call', action: 'reopen' }] })], { onAction: (request) => void calls.push(request.action) });
    await form.runAction('b-done');
    await (said[0].undo as SayUndo).undo();
    expect(calls).toEqual(['reopen']);
  });

  it('offers no Undo for what Fieldia cannot take back, nor after a press that stopped: its words said plainly', async () => {
    const calls: string[] = [];
    const call = { type: 'button', id: 'b-call', label: 'Notify', undo: true, steps: [{ do: 'set', field: 'state', value: "'done'" }, { do: 'call', action: 'notify' }, { do: 'say', message: 'Notified' }] };
    const stops = { type: 'button', id: 'b-stop', label: 'Try', undo: true, steps: [{ do: 'set', field: 'state', value: "'done'" }, { do: 'call', action: 'refuse' }, { do: 'say', message: 'Never said' }] };
    const { form, said } = await opened([call, stops], {
      onAction: (request) => {
        calls.push(request.action);
        return request.action === 'refuse' ? { stop: 'Mona is away' } : undefined;
      },
    });
    await form.runAction('b-call');
    expect(said).toEqual([{ message: 'Notified', tone: 'info' }]);
    said.length = 0;
    expect((await form.runAction('b-stop')).done).toBe(false);
    expect(said).toEqual([{ message: 'Mona is away', tone: 'warning' }]);
  });

  it('says as before for a button with no undo', async () => {
    const { form, said } = await opened([markDone({ steps: [{ do: 'set', field: 'state', value: "'done'" }, { do: 'save' }, { do: 'say', message: 'Done' }] })]);
    await form.runAction('b-done');
    expect(said).toEqual([{ message: 'Done', tone: 'info' }]);
  });
});
