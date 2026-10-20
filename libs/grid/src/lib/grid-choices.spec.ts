import { createMemoryDataSource, type Line, type Option, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { gridApiOf, gridWidgets } from './grid';

/**
 * A grid's lines with choices from the app's lists: an agent's triggers, each line's events from the connection on
 * it — said by their labels at rest, asked once for lines alike, asked again as a line's connection changes, an event
 * the new one does not offer cleared and said aloud.
 */

const EVENTS: Record<string, Option[]> = {
  gmail: [
    { value: 'new_email', label: 'New email' },
    { value: 'starred', label: 'Email starred' },
  ],
  slack: [
    { value: 'new_message', label: 'New message' },
    { value: 'starred', label: 'Message saved' },
  ],
};

const agent: Page = {
  fieldia: '0.5',
  id: 'agent',
  title: 'Agent',
  data: { kind: 'record', model: 'agent' },
  fields: {
    name: { type: 'char', label: 'Name' },
    trigger_ids: {
      type: 'one2many',
      label: 'Triggers',
      relation: 'agent.trigger',
      fields: {
        connection: { type: 'selection', label: 'Connection', options: [{ value: 'gmail', label: 'Gmail' }, { value: 'slack', label: 'Slack' }] },
        event: { type: 'selection', label: 'Event', options: [], optionsFrom: { list: 'events', dependsOn: ['connection'] } },
      },
    },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-lines', field: 'trigger_ids', widget: 'grid' }] },
};

const triggers: Line[] = [
  { key: 't1', id: 1, values: { connection: 'gmail', event: 'new_email' } },
  { key: 't2', id: 2, values: { connection: 'gmail', event: 'starred' } },
  { key: 't3', id: 3, values: { connection: 'slack', event: 'new_message' } },
];

let handle: ViewerHandle | null = null;
/** AG Grid draws cell renderers on an animation frame. */
const frames = () => new Promise((resolve) => setTimeout(resolve, 50));
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const asked: string[] = [];
  const dataSource = createMemoryDataSource({
    records: { agent: { 1: { name: 'Inbox helper', trigger_ids: triggers } } },
    lists: {
      events: (values) => {
        asked.push(values['connection'] as string);
        return EVENTS[values['connection'] as string] ?? [];
      },
    },
  });
  handle = mountViewer(host, { page: agent, dataSource, recordId: 1, widgets: gridWidgets });
  await handle.form.settled();
  await frames();
  const box = host.querySelector('[data-node="f-lines"] .fd-grid-lines') as HTMLElement;
  return { form: handle.form, box, api: gridApiOf(box), asked };
}
const rowCells = (box: HTMLElement, index: number) => ['connection', 'event'].map((column) => box.querySelector(`.ag-row[row-index="${index}"] .ag-cell[col-id="${column}"]`)?.textContent?.trim() ?? '');
const said = (box: HTMLElement) => [...box.querySelectorAll('.fd-sr-only[role=status]')].map((voice) => voice.textContent).filter(Boolean);

describe('a grid’s lines with choices from the app’s lists', () => {
  it('says each line’s choice by its label, its choices asked once for lines alike', async () => {
    const { box, asked } = await mount();
    expect(rowCells(box, 0)).toEqual(['Gmail', 'New email']);
    expect(rowCells(box, 1)).toEqual(['Gmail', 'Email starred']);
    expect(rowCells(box, 2)).toEqual(['Slack', 'New message']);
    expect(asked).toEqual(['gmail', 'slack']);
  });

  it('asks again as a line’s connection changes, clearing and saying an event the new one does not offer', async () => {
    const { form, box, api, asked } = await mount();
    form.updateLine('trigger_ids', 't1', 'connection', 'slack');
    form.updateLine('trigger_ids', 't2', 'connection', 'slack');
    await form.settled();
    await frames();
    expect(asked).toEqual(['gmail', 'slack']);
    expect(rowCells(box, 0)).toEqual(['Slack', '']);
    // One the new connection offers too stays, said by its label there.
    expect(rowCells(box, 1)).toEqual(['Slack', 'Message saved']);
    expect(said(box)).toEqual(['Line 1: New email was cleared: no longer offered']);
    expect(api?.getDisplayedRowAtIndex(0)?.data?.values['event']).toBeNull();
  });
});
