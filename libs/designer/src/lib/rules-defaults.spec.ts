import type { Page } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { field, mount, openTab } from './test-editor';

/** Where values start: a field's first value, a new line's values, and what a record made from a link starts with. */

function task() {
  const page = blankPage('screen', 'Task');
  page.fields = {
    name: { type: 'char', label: 'Title' },
    user_id: { type: 'many2one', label: 'Assigned to', relation: 'res.users' },
    partner_id: { type: 'many2one', label: 'Customer', relation: 'res.partner' },
    child_ids: { type: 'one2many', label: 'Sub-tasks', relation: 'project.task', fields: { name: { type: 'char', label: 'Title' } } },
  };
  (page.layout as { children: unknown[] }).children = [
    { type: 'section', id: 'main', children: Object.keys(page.fields).map((name) => ({ type: 'field', id: `f-${name}`, field: name })) },
  ];
  return createDesigner({ page });
}
const def = (designer: ReturnType<typeof task>, name: string) => designer.getPage().fields[name] as Page['fields'][string] & Record<string, unknown>;

describe('where values start', () => {
  it('keeps a first value worked out — the person using it — and takes it away', () => {
    const designer = task();
    expect(designer.setDefaultFrom('f-user_id', 'user')).toBe(true);
    expect(def(designer, 'user_id')['defaultFrom']).toBe('user');
    expect(designer.setDefaultFrom('f-name', 'nope + 1')).toBe(false);
    designer.setDefaultFrom('f-user_id', null);
    expect('defaultFrom' in def(designer, 'user_id')).toBe(false);
  });

  it('keeps a new line’s values, refusing a field the lines lack', () => {
    const designer = task();
    expect(designer.setLineDefaults('f-child_ids', { name: "name + ' (part)'" })).toBe(true);
    expect(def(designer, 'child_ids')['lineDefaults']).toEqual({ name: "name + ' (part)'" });
    expect(designer.setLineDefaults('f-child_ids', { colour: 'name' })).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/“colour” is not a field of the lines of Sub-tasks/);
  });

  it('keeps what a record made from a link starts with', () => {
    const designer = task();
    expect(designer.setCreateValues('f-partner_id', { comment: "'From ' + name" })).toBe(true);
    expect(def(designer, 'partner_id')['createValues']).toEqual({ comment: "'From ' + name" });
    designer.setCreateValues('f-partner_id', {});
    expect('createValues' in def(designer, 'partner_id')).toBe(false);
  });

  it('is typed on the Rules tab, each setting where it fits', () => {
    const designer = task();
    designer.select('f-user_id');
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Rules');
    const shown = (name: string) => !(host.querySelector(`[data-setting="${name}"]`) as HTMLElement).hidden;
    expect([shown('Starts with'), shown('New lines start with'), shown('A record made from it starts with')]).toEqual([true, false, true]);
    const starts = field(host, 'Starts with') as HTMLInputElement;
    starts.focus();
    starts.value = 'user';
    starts.dispatchEvent(new Event('input', { bubbles: true }));
    starts.dispatchEvent(new Event('change', { bubbles: true }));
    starts.blur();
    expect(def(designer, 'user_id')['defaultFrom']).toBe('user');
    designer.select('f-child_ids');
    expect([shown('Starts with'), shown('New lines start with'), shown('A record made from it starts with')]).toEqual([false, true, false]);
  });
});
