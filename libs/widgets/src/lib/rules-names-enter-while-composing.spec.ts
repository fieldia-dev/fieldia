import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page, type RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { mountKind } from './test-kinds';
import { createWidget } from './widgets';

/**
 * Enter pressed to end an IME's composition — the key a Japanese, Chinese or Korean keyboard (and a phone's) uses to
 * take the word it is building — arrives as a keydown of Enter with `isComposing` true. That Enter is the IME's, not
 * the box's: the viewer leaves it alone (viewer.ts `if (event.isComposing …) return`), and so do the designer's
 * boxes. The boxes that read names act on it as their own Enter, on the half-built text: tags typed as words add
 * the kana "かん" as a tag before the IME has made it "漢" (relations.ts `charTagsWidget` keydown), and a choice
 * typed by name takes, or refuses with "nothing is called …", the text still being composed (choice-tags.ts
 * keydown), and a link takes the only record whose name holds the pinyin "zhang" before the IME has made it 张
 * (relations.ts `combobox` keydown). Seen in Chromium through its IME (CDP): the char.tags box of the fields demo
 * saved the tag "かん" and kept "漢" in the box. The input rules §3: "IME (composition) — what it makes is put back and held … judged once it ends".
 */

function composing(input: HTMLInputElement, text: string) {
  input.focus();
  input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
  input.value = text;
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: text, isComposing: true }));
}
const imeEnter = (input: HTMLInputElement) => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true }));

describe('Enter that ends an IME’s word is the IME’s', () => {
  it('tags typed as words: the word being composed is not added as a tag', () => {
    const { el, value } = mountKind({ type: 'char', label: 'Materials' }, { widget: 'tags' });
    const input = el.querySelector('input') as HTMLInputElement;
    composing(input, 'かん');
    imeEnter(input);
    expect(value() ?? null).toBeNull();
    expect(input.value).toBe('かん');
  });

  it('a choice typed by name: the word being composed is neither taken nor refused', () => {
    const { el, value } = mountKind({ type: 'selection', label: 'Rooms', multiple: true, options: [{ value: 'k', label: 'かんさい' }, { value: 'q', label: 'Quiet room' }] }, { widget: 'tags' });
    const input = el.querySelector('input') as HTMLInputElement;
    composing(input, 'かん');
    imeEnter(input);
    expect(value()).toEqual([]);
    const hint = el.querySelector('.fd-refusal-hint') as HTMLElement | null;
    expect(hint?.hidden ?? true).toBe(true);
  });

  it('a link: the word being composed is not read as Enter’s only match', async () => {
    const page = {
      fieldia: '0.1',
      id: 'p',
      data: { kind: 'record', model: 'project' },
      fields: { client_id: { type: 'many2one', label: 'Client', relation: 'partner' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-client', field: 'client_id', options: { create: false } }] },
    } as unknown as Page;
    const dataSource = createMemoryDataSource({ records: { project: { 1: { client_id: { id: 1, label: 'Acme' } } }, partner: { 1: { name: 'Acme' }, 2: { name: 'Zhang Wei Trading' } } } });
    const form = createForm({ page, dataSource, recordId: 1 });
    await form.load();
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'client_id', field: page.fields['client_id'] as Field, node, id: 'fd-c', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['client_id'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    const input = widget.element.querySelector('input[role="combobox"]') as HTMLInputElement;
    // Pinyin on its way to 张: Enter picks the IME's candidate.
    composing(input, 'zhang');
    imeEnter(input);
    await new Promise((done) => setTimeout(done, 60));
    expect((form.getState().values['client_id'] as RelatedRecord).label).toBe('Acme');
  });
});
