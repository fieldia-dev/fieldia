import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page, type ReferenceValue } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/**
 * A reference (a record of one of several models): a customer's name typed, the box left for the model's list while
 * the name is still being looked up (a server that answers in a moment), and the model changed there to "Country
 * campaign". The lookup was made among customers; when it answers, the box takes the customer it found and writes it
 * with the model chosen NOW (relations.ts `referenceWidget`: `pick: (record) => form.setValue(name, { model, id:
 * record.id, … })`, `model` read at pick time): a reference to country 2 named "Nile Interiors" — a record that does
 * not exist, or another one entirely, saved in silence. Changing the model took the value away (null), as it should;
 * the late answer must not put a customer back under the country model.
 */

const page = {
  fieldia: '0.1',
  id: 'project',
  data: { kind: 'record', model: 'project' },
  fields: { source: { type: 'reference', label: 'Came from', models: [{ value: 'partner', label: 'Customer' }, { value: 'country', label: 'Country campaign' }] } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-source', field: 'source' }] },
} as unknown as Page;

it('a customer found after the model was changed to a country is never written as a country', async () => {
  const dataSource = createMemoryDataSource({
    records: {
      project: { 1: { source: { model: 'partner', id: 1, label: 'Acme' } } },
      partner: { 1: { name: 'Acme' }, 2: { name: 'Nile Interiors' } },
      country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' } },
    },
    delayMs: 40,
  });
  const form = createForm({ page, dataSource, recordId: 1 });
  await form.load();
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'source', field: page.fields['source'] as Field, node, id: 'fd-source', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['source'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const input = widget.element.querySelector('input[role="combobox"]') as HTMLInputElement;
  const select = widget.element.querySelector('select') as HTMLSelectElement;
  input.focus();
  input.value = 'Nile Interiors';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  // Left for the model's list, the name still being looked up among customers; the model changed there.
  select.focus();
  select.value = 'country';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((done) => setTimeout(done, 200));
  const value = form.getState().values['source'] as ReferenceValue | null;
  // Never { model: 'country', id: 2, label: 'Nile Interiors' }: the model changed took the value away.
  expect(value).toBeNull();
});
