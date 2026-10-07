import type { Page } from './page';
import { checkPage } from './check-page';
import { validatePage } from './validate';

/** A table whose cells are drawn by a widget of their own: Flectra's widget= on a list's column. */
const page = (cells: unknown) =>
  ({
    fieldia: '0.1',
    id: 'task',
    data: { kind: 'record', model: 'project.task' },
    fields: {
      child_ids: {
        type: 'one2many',
        label: 'Sub-tasks',
        relation: 'project.task',
        fields: {
          name: { type: 'char', label: 'Title' },
          allocated_hours: { type: 'float', label: 'Allocated' },
          effective_hours: { type: 'float', label: 'Spent' },
          progress: { type: 'float', label: 'Progress' },
          priority: { type: 'selection', label: 'Priority', options: [{ value: '0', label: 'Normal' }, { value: '1', label: 'High' }] },
        },
      },
    },
    layout: { type: 'sheet', id: 'sheet', children: [{ type: 'field', id: 'f-lines', field: 'child_ids', cells }] },
  }) as unknown as Page;

describe('a cell’s widget', () => {
  it('takes a widget and its options, as a field node does', () => {
    const cells = { progress: { widget: 'progressbar', options: { maxField: 'allocated_hours' } }, allocated_hours: { widget: 'duration' }, priority: { widget: 'priority' } };
    expect(validatePage(page(cells))).toMatchObject({ ok: true });
    expect(checkPage(page(cells))).toMatchObject({ ok: true });
  });

  it('finds an option naming a field among the line’s fields, and says so when it is not one', () => {
    const wrong = { progress: { widget: 'progressbar', options: { maxField: 'planned' } } };
    for (const result of [validatePage(page(wrong)), checkPage(page(wrong))]) {
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).toContain('cells.progress.options.maxField');
    }
  });

  it('refuses an empty widget name', () => {
    expect(validatePage(page({ progress: { widget: '' } })).ok).toBe(false);
  });
});

/** Fields on the title's own line, as Flectra's <h1> holds the priority star, the name and the state's dot. */
const titled = (before: unknown, after: unknown) =>
  ({
    fieldia: '0.1',
    id: 'task',
    data: { kind: 'record', model: 'project.task' },
    fields: {
      name: { type: 'char', label: 'Title' },
      priority: { type: 'selection', label: 'Priority', options: [{ value: '0', label: 'Normal' }, { value: '1', label: 'High' }] },
      kanban_state: { type: 'selection', label: 'State', options: [{ value: 'normal', label: 'In progress' }, { value: 'done', label: 'Ready' }] },
    },
    layout: { type: 'sheet', id: 'sheet', title: { field: 'name', before, after }, children: [] },
  }) as unknown as Page;

describe('fields on the title’s line', () => {
  it('takes fields before the title and after it', () => {
    const page = titled([{ type: 'field', id: 'f-priority', field: 'priority', widget: 'priority' }], [{ type: 'field', id: 'f-state', field: 'kanban_state', widget: 'dot' }]);
    expect(validatePage(page)).toMatchObject({ ok: true });
    expect(checkPage(page)).toMatchObject({ ok: true });
  });

  it('checks them as any field: a field the page has, an id of its own', () => {
    const page = titled([{ type: 'field', id: 'f-priority', field: 'stars' }], [{ type: 'field', id: 'f-priority', field: 'kanban_state' }]);
    const said = JSON.stringify(checkPage(page));
    expect(said).toContain('title.before[0]');
    expect(said).toContain('title.after[0]');
  });
});
