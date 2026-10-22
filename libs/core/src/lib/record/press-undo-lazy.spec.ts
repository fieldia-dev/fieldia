import type { Page } from '../format/page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { SayUndo } from './run';
import { pressUndoPart } from './undo-later';

/** The undo part, before it came: a press that offers Undo asks for it as it ends, and its words wait for it. */
const page = {
  fieldia: '0.10',
  id: 'task',
  data: { kind: 'record', model: 'task' },
  fields: { state: { type: 'char', label: 'State' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'button', id: 'b-done', label: 'Mark done', undo: true, steps: [{ do: 'set', field: 'state', value: "'done'" }, { do: 'save' }] }] },
} as unknown as Page;

it('asks for the undo part as a press that offers Undo ends, then says its words with Undo', async () => {
  expect(pressUndoPart.loaded).toBeUndefined();
  const said: { message: string; undo?: SayUndo }[] = [];
  const ds = createMemoryDataSource({ records: { task: { 1: { state: 'open' } } } });
  const form = createForm({ page, dataSource: ds, recordId: 1, host: { open: async () => ({ saved: false }), say: (message, _tone, undo) => void said.push({ message, ...(undo ? { undo } : {}) }), ask: async () => true } });
  await form.load();
  await form.runAction('b-done');
  await form.settled();
  expect(pressUndoPart.loaded).toBeDefined();
  expect(said.map((one) => one.message)).toEqual(['Done: Mark done']);
  await said[0].undo?.undo();
  expect(ds.records['task']['1']['state']).toBe('open');
});
