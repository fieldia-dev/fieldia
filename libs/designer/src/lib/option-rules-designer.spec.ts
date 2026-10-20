import type { FieldNode, Page, SectionNode, SelectionOption } from '@fieldia/core';
import { elementFactory, optionsEditor } from './chrome';
import { blankPage, createDesigner } from './designer';

/**
 * Per-option rules in the designer: an option's row gets "Show when…", its
 * condition on another question's answer under it; and a choice's options
 * carried from another question, the answers picked there or not.
 */

function setup() {
  const designer = createDesigner({ page: blankPage('screen', 'Listing') });
  const kind = designer.addQuestion('multiple-choice') as string;
  designer.updateQuestion(kind, { label: 'Unit type' });
  designer.setOptions(kind, ['Villa', 'Apartment']);
  const outside = designer.addQuestion('checkboxes') as string;
  designer.updateQuestion(outside, { label: 'Outside' });
  designer.setOptions(outside, ['Garden', 'Balcony']);
  const notes = designer.addQuestion('short-answer') as string;
  const node = (id: string) => (designer.getPage().layout as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;
  const field = (id: string) => designer.getPage().fields[node(id).field] as Extract<Page['fields'][string], { type: 'selection' }>;
  return { designer, kind, outside, notes, node, field };
}

function mountEditor(designer: ReturnType<typeof createDesigner>, id: string, node: (id: string) => FieldNode) {
  const editor = optionsEditor(elementFactory(document), designer, id);
  document.body.replaceChildren(editor.element);
  const update = () => editor.update(designer.getPage().fields[node(id).field], node(id));
  designer.subscribe(update);
  update();
  const el = editor.element;
  const shown = (selector: string) => [...el.querySelectorAll<HTMLElement>(selector)].filter((e) => !e.closest('[hidden]'));
  const rows = () => [...el.querySelectorAll<HTMLElement>('.fd-q-options > li')];
  const radio = (words: string) => [...el.querySelectorAll('label')].find((l) => l.textContent === words)?.querySelector('input') as HTMLInputElement;
  return { el, shown, rows, radio };
}

const change = (input: HTMLInputElement | HTMLSelectElement, value?: string) => {
  if (value !== undefined) input.value = value;
  if (input instanceof HTMLInputElement && input.type === 'radio' && value === undefined) input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('an option shown by a condition, in the designer', () => {
  it('is kept as the option’s own, and taken away again', () => {
    const { designer, kind, outside, field, node } = setup();
    const condition = `${node(kind).field} != 'villa'`;
    expect(designer.setOptionDetails(outside, 0, { invisible: condition })).toBe(true);
    expect((field(outside).options[0] as SelectionOption).invisible).toBe(condition);
    expect(designer.setOptionDetails(outside, 0, { invisible: null })).toBe(true);
    expect((field(outside).options[0] as SelectionOption).invisible).toBeUndefined();
  });

  it('is refused when it does not read on the page', () => {
    const { designer, outside } = setup();
    expect(designer.setOptionDetails(outside, 0, { invisible: "kind != 'villa'" })).toBe(false);
    expect(designer.getState().issues[0]).toMatch(/reads "kind", which is not a field of this page/);
  });

  it('is begun from its row: Show when… tests another question’s answer, shown under the row', () => {
    const { designer, kind, outside, node, field } = setup();
    const { rows, shown } = mountEditor(designer, outside, node);
    const [garden] = rows();
    const begin = garden.querySelector('.fd-q-option-when') as HTMLButtonElement;
    expect(begin.hidden).toBe(false);
    expect(begin.textContent).toBe('Show when…');
    begin.click();
    expect((field(outside).options[0] as SelectionOption).invisible).toBe(`${node(kind).field} != '${field(kind).options[0].value}'`);
    expect(begin.hidden).toBe(true);
    const box = garden.querySelector('.fd-q-option-when-box') as HTMLElement;
    expect(box.hidden).toBe(false);
    expect(shown('.fd-q-option-when-box select').map((s) => (s as HTMLSelectElement).selectedOptions[0]?.textContent)).toEqual(['Unit type', 'is Villa']);
    // Balcony shows always: its row has no rules drawn.
    expect(rows()[1].querySelector('.fd-q-option-when-box select')).toBeNull();
    // Taken away: shown always again.
    change(shown('.fd-q-option-when-box select')[0] as HTMLSelectElement, '');
    expect((field(outside).options[0] as SelectionOption).invisible).toBeUndefined();
  });

  it('is not offered where no other question has answers to test', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Alone') });
    const only = designer.addQuestion('dropdown') as string;
    const node = (id: string) => (designer.getPage().layout as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;
    const { rows } = mountEditor(designer, only, node);
    expect((rows()[0].querySelector('.fd-q-option-when') as HTMLElement).hidden).toBe(true);
  });
});

describe('options carried from another question, in the designer', () => {
  it('are set by the question and which answers, its own options following', () => {
    const { designer, kind, outside, notes, field, node } = setup();
    expect(designer.setOptionsFrom(outside, { field: node(kind).field })).toBe(true);
    expect(field(outside).optionsFrom).toEqual({ field: node(kind).field });
    expect(designer.setOptionsFrom(outside, { field: node(kind).field, picked: false })).toBe(true);
    expect(field(outside).optionsFrom).toEqual({ field: node(kind).field, picked: false });
    expect(designer.setOptionsFrom(outside, { field: node(notes).field })).toBe(false);
    expect(designer.getState().issues).toEqual(['Options are carried from another choice of the page']);
    expect(designer.setOptionsFrom(outside, { field: node(outside).field })).toBe(false);
  });

  it('are picked in the options editor: Picked in another question, which, and the answers picked or not', () => {
    const { designer, kind, outside, node, field } = setup();
    const { el, radio, shown } = mountEditor(designer, outside, node);
    change(radio('Picked in another question'));
    expect(field(outside).optionsFrom).toEqual({ field: node(kind).field });
    const [question, which] = shown('.fd-q-carried select') as HTMLSelectElement[];
    expect([...question.options].map((o) => o.textContent)).toEqual(['Unit type']);
    expect([...which.options].map((o) => o.textContent)).toEqual(['The answers picked there', 'The answers not picked there']);
    change(which, 'unpicked');
    expect(field(outside).optionsFrom).toEqual({ field: node(kind).field, picked: false });
    // Its own options stay, after those carried.
    expect(shown('.fd-q-options > li > input')).toHaveLength(2);
    expect(el.querySelector('.fd-q-carried .fd-q-list-note')?.textContent).toMatch(/this question’s own options follow them/);
    change(radio('Written here'));
    expect(field(outside).optionsFrom).toBeUndefined();
  });
});
