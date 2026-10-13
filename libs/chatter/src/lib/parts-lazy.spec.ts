import { createForm, createMemoryDataSource, type Page } from '@fieldia/core';
import { textPart } from '@fieldia/widgets';
import { discussionPart, historyPart } from './chatter-parts';
import { historySlot } from './history-slot';
import { createMemoryChatter } from './memory';
import { chatterSlot } from './slot';

/**
 * Before their parts have come (parts.ts in @fieldia/widgets): a Discussion
 * and a History are drawn once their code — and the Discussion's editor — has
 * come, for the record the form shows by then; a chatter of messages and notes
 * needs neither, and is drawn at once. This file starts with no part loaded.
 */

const me = { id: 1, name: 'Ramy Fathi' };
const page = {
  fieldia: '0.1',
  id: 'item',
  title: 'Item',
  data: { kind: 'record', model: 'work.item' },
  fields: { title: { type: 'char', label: 'Title' }, state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }] } },
  layout: { type: 'sections', id: 's', children: [] },
} as unknown as Page;
const message = (id: number, body: string) => ({ id, kind: 'message' as const, author: me, date: '2026-10-01T10:00:00Z', body });
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(check()).toBeTruthy();
}

afterEach(() => document.body.replaceChildren());

describe('a chatter slot before its parts came', () => {
  it('draws a chatter of messages at once, asking for no part', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const form = createForm({ page, dataSource: createMemoryDataSource() });
    const stop = chatterSlot({ source: createMemoryChatter({ me }) })(element, { form });
    expect(element.querySelector('.fd-chatter')).not.toBeNull();
    expect([discussionPart.loaded, historyPart.loaded, textPart.loaded]).toEqual([undefined, undefined, undefined]);
    stop();
  });

  it('draws a Discussion once its code and its editor have come, for the record shown by then', async () => {
    const source = createMemoryChatter({ me, records: { 'work.item:2': { messages: [message(1, '<p>On the second.</p>')] } } });
    const dataSource = createMemoryDataSource({ records: { 'work.item': { 1: { title: 'One' }, 2: { title: 'Two' } } } });
    const form = createForm({ page, dataSource, recordId: 1 });
    await form.load();
    const element = document.createElement('div');
    document.body.append(element);
    const stop = chatterSlot({ source, look: 'discussion' })(element, { form });
    expect(element.children).toHaveLength(0);
    // The form moves to another record before the code has come: the Discussion is drawn for that one.
    await form.openRecord(2);
    await until(() => element.querySelector('.fd-comment-card'));
    expect(element.querySelector('.fd-comment-body')?.textContent).toBe('On the second.');
    expect(discussionPart.loaded && textPart.loaded).toBeTruthy();
    stop();
  });

  it('draws a History once its code has come; destroyed before, never', async () => {
    const source = createMemoryChatter({ me });
    const form = createForm({ page, dataSource: createMemoryDataSource({ records: { 'work.item': { 1: { title: 'One' } } } }), recordId: 1 });
    await form.load();
    const gone = document.createElement('div');
    document.body.append(gone);
    historySlot({ source })(gone, { form })();
    const element = document.createElement('div');
    document.body.append(element);
    const stop = historySlot({ source })(element, { form });
    expect(element.children).toHaveLength(0);
    await until(() => element.querySelector('.fd-history'));
    expect(gone.children).toHaveLength(0);
    // From now on, at once.
    const now = document.createElement('div');
    const again = historySlot({ source })(now, { form });
    expect(now.querySelector('.fd-history')).not.toBeNull();
    again();
    stop();
  });
});
