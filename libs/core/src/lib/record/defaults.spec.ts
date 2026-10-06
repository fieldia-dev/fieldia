import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import type { CreateRequest, DataSource } from './data-source';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { Line, Values } from './values';

/** A project task whose sub-tasks, contacts and owner start from what the task holds and who is using it. */
const task = {
  fieldia: '0.1',
  id: 'task',
  title: 'Task',
  data: { kind: 'record', model: 'project.task' },
  fields: {
    name: { type: 'char', label: 'Title' },
    project_id: { type: 'many2one', label: 'Project', relation: 'project.project' },
    company_id: { type: 'many2one', label: 'Company', relation: 'res.company' },
    user_id: { type: 'many2one', label: 'Assigned to', relation: 'res.users', defaultFrom: 'user' },
    tag_ids: { type: 'many2many', label: 'Tags', relation: 'project.tags' },
    partner_id: {
      type: 'many2one',
      label: 'Customer',
      relation: 'res.partner',
      // Flectra's context="{'default_company_id': company_id, 'default_is_company': True}".
      createValues: { company_id: 'company_id', is_company: 'True', comment: "'From ' + name" },
    },
    child_ids: {
      type: 'one2many',
      label: 'Sub-tasks',
      relation: 'project.task',
      // Flectra's context="{'default_project_id': project_id, 'default_tag_ids': tag_ids}".
      lineDefaults: { project_id: 'project_id', tag_ids: 'tag_ids', name: "name + ' (part)'" },
      fields: {
        name: { type: 'char', label: 'Title' },
        project_id: { type: 'many2one', label: 'Project', relation: 'project.project' },
        tag_ids: { type: 'many2many', label: 'Tags', relation: 'project.tags' },
        user_id: { type: 'many2one', label: 'Assigned to', relation: 'res.users', defaultFrom: 'user' },
        note: { type: 'char', label: 'Note', defaultFrom: "'For ' + parent.name" },
        vendor_id: { type: 'many2one', label: 'Vendor', relation: 'res.partner', createValues: { company_id: 'parent.company_id' } },
      },
    },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-project', field: 'project_id' },
      { type: 'field', id: 'f-company', field: 'company_id' },
      { type: 'field', id: 'f-user', field: 'user_id' },
      { type: 'field', id: 'f-tags', field: 'tag_ids' },
      { type: 'field', id: 'f-partner', field: 'partner_id' },
      { type: 'field', id: 'f-children', field: 'child_ids' },
    ],
  },
} as unknown as Page;

const nour = { id: 4, name: 'Nour El-Sayed', roles: [] };
const held: Values = {
  name: 'Fit-out',
  project_id: { id: 2, label: 'Villa 12' },
  company_id: { id: 3, label: 'Sherkety' },
  tag_ids: [{ id: 7, label: 'Urgent' }],
};
const line = (form: ReturnType<typeof createForm>, key: string) => ((form.getState().values['child_ids'] as Line[]).find((l) => l.key === key) as Line).values;

/** A data source that keeps every record it is asked to make. */
function making(): { source: DataSource; made: CreateRequest[] } {
  const made: CreateRequest[] = [];
  const memory = createMemoryDataSource({ records: { 'project.task': { 9: { ...held, user_id: { id: 5, label: 'Hany' } } } } });
  return { made, source: { ...memory, create: (request) => (made.push(request), memory.create!(request)) } };
}

describe('a new line starts from its record', () => {
  it('takes each of its fields from an expression over the record, a field named alone taken whole', () => {
    expect(validatePage(task)).toMatchObject({ ok: true });
    const form = createForm({ page: task, values: held, user: nour });
    const key = form.addLine('child_ids');
    expect(line(form, key)).toMatchObject({ project_id: { id: 2, label: 'Villa 12' }, tag_ids: [{ id: 7, label: 'Urgent' }], name: 'Fit-out (part)' });
  });

  it('lets what the line is given come first', () => {
    const form = createForm({ page: task, values: held });
    const key = form.addLine('child_ids', { name: 'Electrics' });
    expect(line(form, key)['name']).toBe('Electrics');
  });
});

describe('defaultFrom: a field’s first value worked out', () => {
  it('starts a new record with the person using it, as a link', () => {
    const form = createForm({ page: task, user: nour });
    expect(form.getState().values['user_id']).toEqual({ id: 4, label: 'Nour El-Sayed' });
  });

  it('starts a new line with the person, and words from the record it is on', () => {
    const form = createForm({ page: task, values: held, user: nour });
    const key = form.addLine('child_ids');
    expect(line(form, key)).toMatchObject({ user_id: { id: 4, label: 'Nour El-Sayed' }, note: 'For Fit-out' });
  });

  it('leaves a saved record’s value as it was saved', async () => {
    const form = createForm({ page: task, dataSource: making().source, recordId: 9, user: nour });
    await form.load();
    expect(form.getState().values['user_id']).toEqual({ id: 5, label: 'Hany' });
  });

  it('starts empty with no person named', () => {
    expect(createForm({ page: task }).getState().values['user_id']).toBeNull();
  });
});

describe('createValues: what a record made from a link starts with', () => {
  it('reads them from the record, for Create and edit…', () => {
    const form = createForm({ page: task, values: held });
    expect(form.createValues('partner_id')).toEqual({ company_id: { id: 3, label: 'Sherkety' }, is_company: true, comment: 'From Fit-out' });
  });

  it('reads a line’s from the line and the record it is on', () => {
    const form = createForm({ page: task, values: held });
    const key = form.addLine('child_ids');
    expect(form.createValues('vendor_id', { lines: 'child_ids', key })).toEqual({ company_id: { id: 3, label: 'Sherkety' } });
  });

  it('hands them to the data source with the name, when a record is made at once', async () => {
    const { source, made } = making();
    const form = createForm({ page: task, dataSource: source, values: held });
    await form.quickCreate('partner_id', 'Delta Foods');
    expect(made.at(-1)).toEqual({ model: 'res.partner', name: 'Delta Foods', values: { company_id: { id: 3, label: 'Sherkety' }, is_company: true, comment: 'From Fit-out' } });
  });
});

describe('the page check reads defaults where they are worked out', () => {
  const lineFields = (task.fields['child_ids'] as { fields: Record<string, unknown> }).fields;
  const withField = (name: string, def: Record<string, unknown>) => validatePage({ ...task, fields: { ...task.fields, [name]: def } } as unknown as Page);
  const messages = (result: ReturnType<typeof validatePage>) => ('issues' in result ? result.issues.map((issue) => `${issue.path}: ${issue.message}`) : []);

  it('refuses a new line’s value for a field the lines lack, or read from a field the record lacks', () => {
    const child = task.fields['child_ids'] as Record<string, unknown>;
    expect(messages(withField('child_ids', { ...child, lineDefaults: { colour: 'name' } }))).toEqual(['fields.child_ids.lineDefaults.colour: "colour" is not a field of the lines of "child_ids"']);
    expect(messages(withField('child_ids', { ...child, lineDefaults: { name: 'nope' } }))).toEqual(['fields.child_ids.lineDefaults.name: "nope" reads "nope", which is not a field of this page']);
  });

  it('reads a line field’s defaultFrom and createValues on the line, with parent', () => {
    const child = task.fields['child_ids'] as Record<string, unknown>;
    expect(messages(withField('child_ids', { ...child, fields: { ...lineFields, note: { type: 'char', label: 'Note', defaultFrom: 'parent.nope' } } }))).toEqual([
      'fields.child_ids.fields.note.defaultFrom: "parent.nope" reads "parent.nope": "nope" is not a field of this page',
    ]);
    expect(messages(withField('owner_id', { type: 'many2one', label: 'Owner', relation: 'res.users', createValues: { company_id: 'parent.company_id' } }))).toEqual([
      'fields.owner_id.createValues.company_id: "parent.company_id" reads "parent", which is not a field of this page',
    ]);
  });
});
