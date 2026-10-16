import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page, type RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/**
 * Tags of links (many2many): the name of a tag already chosen, typed again. The reader looks the words up with the
 * chosen tags left out (relations.ts `named`, `exclude`), finds none, and says "Tags: nothing is called “VIP” yet;
 * pick one or create it" — false (a tag is called VIP: it is right there as a chip) and it offers to make a second
 * VIP. A save is refused over it, Enter keeps the words in the box. A choice's tags (choice-tags.ts) take the same
 * case as done: the words go, nothing refused. The input rules: refuse only what can never be valid, and say why.
 */

const page = {
  fieldia: '0.1',
  id: 'project',
  data: { kind: 'record', model: 'project' },
  fields: { tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-tags', field: 'tag_ids' }] },
} as unknown as Page;

async function mount() {
  const dataSource = createMemoryDataSource({ records: { project: { 1: { tag_ids: [{ id: 10, label: 'VIP' }] } }, tag: { 10: { name: 'VIP' }, 11: { name: 'Wholesale' } } }, delayMs: 5 });
  const form = createForm({ page, dataSource, recordId: 1 });
  await form.load();
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'tag_ids', field: page.fields['tag_ids'] as Field, node, id: 'fd-tags', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element, document.createElement('button'));
  const refresh = () => widget.update({ value: form.getState().values['tag_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, input: widget.element.querySelector('input[role="combobox"]') as HTMLInputElement, element: widget.element };
}
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const wait = (ms = 80) => new Promise((done) => setTimeout(done, ms));

describe('tags of links: a tag already chosen, typed again', () => {
  it('a save is not refused with “nothing is called”', async () => {
    const { form, input } = await mount();
    type(input, 'vip');
    const saved = await form.save();
    expect(form.getState().errors['tag_ids']).toBeUndefined();
    expect(saved).toBe(true);
    expect((form.getState().values['tag_ids'] as RelatedRecord[]).map((r) => r.label)).toEqual(['VIP']);
  });

  it('Enter never says “nothing is called … create it” of a tag that is there', async () => {
    const { input, element } = await mount();
    type(input, 'VIP');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait();
    const said = [...element.querySelectorAll('.fd-refusal-hint')].map((hint) => (hint as HTMLElement).hidden ? '' : hint.textContent).join('');
    expect(said).not.toContain('nothing is called');
  });
});
