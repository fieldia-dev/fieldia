import type { Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/** Fields on the title's own line: a task's priority star before its name, as Flectra's <h1> has it. */
let handle: ViewerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
});

const page = {
  fieldia: '0.1',
  id: 'task',
  data: { kind: 'record', model: 'project.task' },
  fields: {
    name: { type: 'char', label: 'Title' },
    priority: { type: 'selection', label: 'Priority', options: [{ value: '0', label: 'Normal' }, { value: '1', label: 'High' }] },
    note: { type: 'char', label: 'Note' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name', before: [{ type: 'field', id: 'f-priority', field: 'priority', widget: 'priority', invisible: "name == '/'" }], after: [{ type: 'field', id: 'f-note', field: 'note' }] },
    children: [],
  },
} as unknown as Page;

describe('fields on the title’s line', () => {
  it('draws them on the title’s line, before and after its name, each as a field of its own', () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page, values: { name: 'Lay the floor', priority: '0' } as never });
    const line = host.querySelector('.fd-title .fd-title-line') as HTMLElement;
    expect([...line.children].map((child) => (child as HTMLElement).dataset['node'])).toEqual(['f-priority', '#title', 'f-note']);
    const star = line.querySelector('[data-node="f-priority"] button[role="radio"]') as HTMLButtonElement;
    star.click();
    expect(handle.form.getState().values['priority']).toBe('1');
    // Named by its label, which only screen readers read.
    expect(line.querySelector('[data-node="f-priority"] .fd-label')?.textContent).toContain('Priority');
  });

  it('hides one by its condition, as any field', () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page, values: { name: '/', priority: '0' } as never });
    expect((host.querySelector('[data-node="f-priority"]') as HTMLElement).hidden).toBe(true);
  });
});
