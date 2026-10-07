import type { Page } from '../format/page';
import type { PropertyDefinition } from '../format/field';
import { validatePage } from '../format/validate';
import { checkPage } from '../format/check-page';
import { createForm } from './form';
import type { DataSource } from './data-source';

/** Properties defined by a linked record, as Flectra's definition_record: a task's properties are its project's. */
const page = {
  fieldia: '0.1',
  id: 'task',
  data: { kind: 'record', model: 'project.task' },
  fields: {
    project_id: { type: 'many2one', label: 'Project', relation: 'project.project' },
    task_properties: { type: 'properties', label: 'Properties', definitionsFrom: { list: 'task_properties', dependsOn: ['project_id'] } },
  },
  layout: { type: 'sheet', id: 'sheet', children: [{ type: 'field', id: 'f-props', field: 'task_properties' }] },
} as unknown as Page;

const BY_PROJECT: Record<number, PropertyDefinition[]> = {
  1: [{ name: 'site', label: 'Site', type: 'char' }],
  2: [
    { name: 'floor', label: 'Floor', type: 'integer' },
    { name: 'permit', label: 'Permit needed', type: 'boolean' },
  ],
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function source(saved: unknown[] = []): DataSource {
  return {
    definitions: async ({ list, values }) => (list === 'task_properties' ? (BY_PROJECT[(values['project_id'] as { id: number } | null)?.id ?? 0] ?? []) : []),
    saveDefinitions: async (request) => void saved.push(request),
  };
}

describe('properties defined by a linked record', () => {
  it('names the list and the fields it follows, each one the page has', () => {
    expect(validatePage(page)).toMatchObject({ ok: true });
    const wrong = { ...page, fields: { ...page.fields, task_properties: { type: 'properties', label: 'Properties', definitionsFrom: { list: 'x', dependsOn: ['stage_id'] } } } } as unknown as Page;
    expect(JSON.stringify(checkPage(wrong))).toContain('definitionsFrom.dependsOn[0]');
  });

  it('loads its definitions from the app, and again when the link changes', async () => {
    const form = createForm({ page, dataSource: source(), values: { project_id: { id: 1, label: 'Fit-out' } } });
    form.loadDefinitions('task_properties');
    expect(form.getState().definitions['task_properties']).toMatchObject({ loading: true });
    await settle();
    expect(form.getState().definitions['task_properties'].definitions?.map((d) => d.name)).toEqual(['site']);
    form.setValue('project_id', { id: 2, label: 'Clinic' });
    await settle();
    expect(form.getState().definitions['task_properties'].definitions?.map((d) => d.name)).toEqual(['floor', 'permit']);
  });

  it('adds a property in place, telling the app to keep it on the linked record', async () => {
    const saved: unknown[] = [];
    const form = createForm({ page, dataSource: source(saved), values: { project_id: { id: 1, label: 'Fit-out' } } });
    form.loadDefinitions('task_properties');
    await settle();
    await form.addDefinition('task_properties', { name: 'locker', label: 'Locker', type: 'char' });
    expect(form.getState().definitions['task_properties'].definitions?.map((d) => d.name)).toEqual(['site', 'locker']);
    expect(saved).toEqual([expect.objectContaining({ list: 'task_properties', definitions: [expect.objectContaining({ name: 'site' }), expect.objectContaining({ name: 'locker' })] })]);
  });

  it('says why when the app gives none', async () => {
    const form = createForm({ page, values: {} });
    form.loadDefinitions('task_properties');
    await settle();
    expect(form.getState().definitions['task_properties'].error).toMatch(/task_properties/);
  });
});

describe('the memory data source’s definitions', () => {
  it('gives those of the linked record, and keeps a property added in place with that record’s', async () => {
    const { createMemoryDataSource } = await import('./memory-data-source');
    const memory = createMemoryDataSource({ definitions: { task_properties: (values) => BY_PROJECT[(values['project_id'] as { id: number } | null)?.id ?? 0] ?? [] } });
    const form = createForm({ page, dataSource: memory, values: { project_id: { id: 1, label: 'Fit-out' } } });
    form.loadDefinitions('task_properties');
    await settle();
    await form.addDefinition('task_properties', { name: 'locker', label: 'Locker', type: 'char' });
    form.setValue('project_id', { id: 2, label: 'Clinic' });
    await settle();
    expect(form.getState().definitions['task_properties'].definitions?.map((d) => d.name)).toEqual(['floor', 'permit']);
    form.setValue('project_id', { id: 1, label: 'Fit-out' });
    await settle();
    expect(form.getState().definitions['task_properties'].definitions?.map((d) => d.name)).toEqual(['site', 'locker']);
  });
});
