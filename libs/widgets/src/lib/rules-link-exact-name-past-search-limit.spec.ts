import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page, type RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/**
 * A link's typed name is read by asking the data source for its words as a search (`form.search(name, text, 9)` —
 * the list's own search, with the list's limit) and looking for the exact name among the answers
 * (relations.ts `named`). A search finds every record whose name HOLDS the words, in the source's order, and stops at
 * the limit; when nine others hold the words before it, the record of that exact name is never among them. The box
 * then says "nothing is called “Nile”" while a client is called Nile: a save refuses it, and leaving puts back what
 * the box held over the person's right name. The input rules: "Accept every right way to write a value"; W reads
 * "the exact name".
 */

const page = {
  fieldia: '0.1',
  id: 'project',
  data: { kind: 'record', model: 'project' },
  fields: { client_id: { type: 'many2one', label: 'Client', relation: 'partner' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-client', field: 'client_id', options: { create: false } }] },
} as unknown as Page;

/** Ten clients whose names hold "Nile" come first; the one called exactly "Nile" is the eleventh. */
const partners = Object.fromEntries([
  [1, { name: 'Acme' }],
  ...Array.from({ length: 10 }, (_, i) => [2 + i, { name: `Blue Nile ${i + 1}` }]),
  [12, { name: 'Nile' }],
]);

async function mount() {
  const dataSource = createMemoryDataSource({ records: { project: { 1: { client_id: { id: 1, label: 'Acme' } } }, partner: partners }, delayMs: 5 });
  const form = createForm({ page, dataSource, recordId: 1 });
  await form.load();
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'client_id', field: page.fields['client_id'] as Field, node, id: 'fd-client', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element, document.createElement('button'));
  const refresh = () => widget.update({ value: form.getState().values['client_id'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const input = widget.element.querySelector('input[role="combobox"]') as HTMLInputElement;
  return { form, input, stored: () => (dataSource.records['project'][1]['client_id'] as RelatedRecord | null)?.label ?? null };
}
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const wait = (ms = 80) => new Promise((done) => setTimeout(done, ms));

describe('a link whose exact name is held by more records than a search returns', () => {
  it('a save takes the client called exactly “Nile”', async () => {
    const { form, input, stored } = await mount();
    type(input, 'Nile');
    const saved = await form.save();
    expect(form.getState().errors['client_id']).toBeUndefined();
    expect(saved).toBe(true);
    expect(stored()).toBe('Nile');
  });

  it('leaving the box takes it, never putting back what it held with “nothing is called”', async () => {
    const { form, input } = await mount();
    type(input, 'Nile');
    input.blur();
    await wait();
    expect((form.getState().values['client_id'] as RelatedRecord | null)?.label).toBe('Nile');
    expect(input.value).toBe('Nile');
  });
});
