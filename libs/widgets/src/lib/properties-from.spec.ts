import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page, type PropertyDefinition } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/** A properties field whose definitions are its project's (Flectra's definition_record), in two columns, added to in place. */
const page = {
  fieldia: '0.1',
  id: 'task',
  data: { kind: 'record', model: 'project.task' },
  fields: {
    project_id: { type: 'many2one', label: 'Project', relation: 'project.project' },
    task_properties: { type: 'properties', label: 'Properties', definitionsFrom: { list: 'task_properties', dependsOn: ['project_id'] } },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-props', field: 'task_properties', options: { columns: 2, add: true } }] },
} as unknown as Page;

const BY_PROJECT: Record<number, PropertyDefinition[]> = {
  1: [{ name: 'site', label: 'Site', type: 'char' }, { name: 'floor', label: 'Floor', type: 'integer' }],
  2: [{ name: 'permit', label: 'Permit needed', type: 'boolean' }],
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(readonly = false) {
  const dataSource = createMemoryDataSource({ definitions: { task_properties: (values) => BY_PROJECT[(values['project_id'] as { id: number } | null)?.id ?? 0] ?? [] } });
  const form = createForm({ page, dataSource, values: { project_id: { id: 1, label: 'Fit-out' }, task_properties: { site: 'Nile Towers', floor: 12 } } });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'task_properties', field: page.fields['task_properties'] as Field, node, id: 'fd-props', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['task_properties'], values: form.getState().values, readonly, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  await settle();
  return { form, el: widget.element, value: () => form.getState().values['task_properties'] };
}

const labelsOf = (el: HTMLElement) => [...el.querySelectorAll('.fd-property > label')].map((label) => label.textContent);

describe('properties defined by a linked record', () => {
  it('loads the definitions its link’s record keeps, and lays them in the columns asked for', async () => {
    const { el } = await mount();
    expect(labelsOf(el)).toEqual(['Site', 'Floor']);
    expect(el.dataset['columns']).toBe('2');
    expect((el.querySelector('#fd-props-site') as HTMLInputElement).value).toBe('Nile Towers');
  });

  it('takes the new record’s definitions when the link changes', async () => {
    const { el, form } = await mount();
    form.setValue('project_id', { id: 2, label: 'Clinic' });
    await settle();
    expect(labelsOf(el)).toEqual(['Permit needed']);
  });

  it('adds a property in place: its name and its kind, then it is there to fill', async () => {
    const { el, form } = await mount();
    (el.querySelector('.fd-property-add') as HTMLButtonElement).click();
    const name = el.querySelector('input[aria-label="Property name"]') as HTMLInputElement;
    expect(document.activeElement).toBe(name);
    name.value = 'Locker number';
    (el.querySelector('select[aria-label="Kind"]') as HTMLSelectElement).value = 'integer';
    (el.querySelector('.fd-property-new form, .fd-property-new') as HTMLElement).querySelector<HTMLButtonElement>('button.fd-button-primary')?.click();
    await settle();
    expect(labelsOf(el)).toEqual(['Site', 'Floor', 'Locker number']);
    expect(form.getState().definitions['task_properties'].definitions?.at(-1)).toEqual({ name: 'locker_number', label: 'Locker number', type: 'integer' });
    expect(document.activeElement?.id).toBe('fd-props-locker_number');
  });

  it('offers no adding while read-only', async () => {
    const { el } = await mount(true);
    expect((el.querySelector('.fd-property-add') as HTMLElement).hidden).toBe(true);
  });
});
