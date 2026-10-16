import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page, type RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/**
 * Two clients with the very same name — two branches both called "Nile Interiors", as real contact lists have.
 * A link's typed name is read as "the exact name" (input rules §2, W) by `kept.find(…)` in relations.ts `named`:
 * the first record of that name is taken in silence and saved. The path picker refuses the same case with
 * "more than one is called “…”; pick one from the list" (path-picker.ts `named`, `severalCalled`), a word the
 * link's labels already carry in four languages. A record linked by a guess, unsaid, is a value changed without
 * being said: the link must refuse it the same way and keep the words, so the person picks which one.
 */

const page = {
  fieldia: '0.1',
  id: 'project',
  data: { kind: 'record', model: 'project' },
  fields: { client_id: { type: 'many2one', label: 'Client', relation: 'partner' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-client', field: 'client_id', options: { create: false } }] },
} as unknown as Page;

async function mount() {
  const dataSource = createMemoryDataSource({
    records: { project: { 1: { client_id: { id: 1, label: 'Acme' } } }, partner: { 1: { name: 'Acme' }, 2: { name: 'Nile Interiors' }, 3: { name: 'Nile Interiors' } } },
    delayMs: 5,
  });
  const form = createForm({ page, dataSource, recordId: 1 });
  await form.load();
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'client_id', field: page.fields['client_id'] as Field, node, id: 'fd-client', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element, document.createElement('button'));
  const refresh = () => widget.update({ value: form.getState().values['client_id'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const input = widget.element.querySelector('input[role="combobox"]') as HTMLInputElement;
  return { form, input, stored: () => (dataSource.records['project'][1]['client_id'] as RelatedRecord | null)?.id ?? null };
}
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('a link typed with a name two records have', () => {
  it('a save refuses it with “more than one is called”, never linking the first of them unsaid', async () => {
    const { form, input, stored } = await mount();
    type(input, 'Nile Interiors');
    const saved = await form.save();
    expect({ saved, stored: stored(), error: form.getState().errors['client_id'] }).toEqual({
      saved: false,
      stored: 1,
      error: 'Client: more than one is called “⁨Nile Interiors⁩”; pick one from the list',
    });
    expect(input.value).toBe('Nile Interiors');
  });
});
