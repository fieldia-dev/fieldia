import type { FieldNode, Page, SectionNode } from '@fieldia/core';
import { elementFactory, optionsEditor } from './chrome';
import { blankPage, createDesigner } from './designer';

/** Choices written in the page, or taken from one of the app's lists: in the store, and in the options editor. */

const LISTS = [
  { name: 'countries', label: 'Countries' },
  { name: 'cities', label: 'Cities' },
];

function setup(options: { lists?: { name: string; label: string }[]; model?: boolean } = {}) {
  const designer = createDesigner({
    page: blankPage('screen', 'Site visit'),
    lists: options.lists,
    model: options.model ? { region: { type: 'selection', label: 'Region', options: [{ value: 'n', label: 'North' }] } } : undefined,
  });
  const country = designer.addQuestion('dropdown') as string;
  designer.updateQuestion(country, { label: 'Country' });
  const city = designer.addQuestion('dropdown') as string;
  designer.updateQuestion(city, { label: 'City' });
  const notes = designer.addQuestion('short-answer') as string;
  const node = (id: string) => (designer.getPage().layout as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;
  const field = (id: string) => designer.getPage().fields[node(id).field] as Extract<Page['fields'][string], { type: 'selection' }>;
  return { designer, country, city, notes, node, field };
}

function mountEditor(designer: ReturnType<typeof createDesigner>, id: string, node: (id: string) => FieldNode) {
  const editor = optionsEditor(elementFactory(document), designer, id);
  document.body.replaceChildren(editor.element);
  const update = () => editor.update(designer.getPage().fields[node(id).field], node(id));
  designer.subscribe(update);
  update();
  const el = editor.element;
  const radio = (words: string) => [...el.querySelectorAll('label')].find((l) => l.textContent === words)?.querySelector('input') as HTMLInputElement;
  const shown = (selector: string) => [...el.querySelectorAll<HTMLElement>(selector)].filter((e) => !e.closest('[hidden]'));
  return { el, radio, shown };
}

const change = (input: HTMLInputElement | HTMLSelectElement, value?: string) => {
  if (value !== undefined) input.value = value;
  if (input instanceof HTMLInputElement && (input.type === 'radio' || input.type === 'checkbox') && value === undefined) input.checked = !input.checked;
  input.dispatchEvent(new Event(input instanceof HTMLInputElement && input.type === 'text' ? 'input' : 'change', { bubbles: true }));
};

describe('choices from the app’s lists, in the designer', () => {
  it('takes a choice’s options from a list, with the fields it changes with, as one step each', () => {
    const { designer, country, city, field, node } = setup({ lists: LISTS });
    expect(designer.lists()).toEqual(LISTS);
    const written = field(city).options;
    expect(designer.setOptionsFrom(city, { list: 'cities', dependsOn: [node(country).field] })).toBe(true);
    expect(field(city).optionsFrom).toEqual({ list: 'cities', dependsOn: [node(country).field] });
    // The options written stay, for a way back.
    expect(field(city).options).toEqual(written);
    expect(designer.setOptionsFrom(city, { list: 'cities', dependsOn: [] })).toBe(true);
    expect(field(city).optionsFrom).toEqual({ list: 'cities' });
    expect(designer.setOptionsFrom(city, null)).toBe(true);
    expect(field(city).optionsFrom).toBeUndefined();
    designer.undo();
    expect(field(city).optionsFrom).toEqual({ list: 'cities' });
    expect(field(country).optionsFrom).toBeUndefined();
  });

  it('gives a choice written again an option to start from, when it had none', () => {
    const { designer, city, node } = setup();
    const page = JSON.parse(designer.pageJson());
    page.fields[node(city).field] = { ...page.fields[node(city).field], options: [], optionsFrom: { list: 'cities' } };
    designer.setPageJson(JSON.stringify(page));
    expect(designer.setOptionsFrom(city, null)).toBe(true);
    expect(designer.getPage().fields[node(city).field]).toMatchObject({ options: [{ value: 'option_1', label: 'Option 1' }] });
  });

  it('refuses a list with no name, a field that is not a choice, and a choice the model owns', () => {
    const { designer, city, notes } = setup({ model: true });
    expect(designer.setOptionsFrom(city, { list: '' })).toBe(false);
    expect(designer.setOptionsFrom(notes, { list: 'x' })).toBe(false);
    expect(designer.getState().issues).toEqual(['Only a choice takes its options from a list']);
    const region = designer.addModelField('region') as string;
    expect(designer.setOptionsFrom(region, { list: 'regions' })).toBe(false);
    expect(designer.getState().issues).toEqual(['The choices of Region come from the model']);
  });

  it('offers the app’s lists by name in the options editor, and what the list changes with', () => {
    const { designer, country, city, field, node } = setup({ lists: LISTS });
    const { el, radio, shown } = mountEditor(designer, city, node);
    expect(radio('Written here').checked).toBe(true);
    expect(shown('.fd-q-options input')).toHaveLength(1);
    change(radio('From the app’s list'));
    expect(field(city).optionsFrom).toEqual({ list: 'countries' });
    expect(shown('.fd-q-options input')).toHaveLength(0);
    const list = el.querySelector('select') as HTMLSelectElement;
    expect([...list.options].map((o) => o.textContent)).toEqual(['Countries', 'Cities']);
    change(list, 'cities');
    expect(field(city).optionsFrom).toEqual({ list: 'cities' });
    // Changes with: the page's other fields, by their words.
    const boxes = shown('.fd-q-depends input');
    expect(boxes.map((b) => b.closest('label')?.textContent)).toEqual(['Country', 'Untitled question']);
    change(boxes[0] as HTMLInputElement);
    expect(field(city).optionsFrom).toEqual({ list: 'cities', dependsOn: [node(country).field] });
    change(radio('Written here'));
    expect(field(city).optionsFrom).toBeUndefined();
    expect(shown('.fd-q-options input')).toHaveLength(1);
  });

  it('takes a list’s name typed in a box when the app names no lists', () => {
    const { designer, city, field, node } = setup();
    const { el, radio } = mountEditor(designer, city, node);
    change(radio('From the app’s list'));
    const name = el.querySelector('input[aria-label="List name"]') as HTMLInputElement;
    // A name made from the question's words, to be typed over.
    expect(name.value).toBe('city');
    change(name, 'town');
    change(name, 'towns');
    expect(field(city).optionsFrom).toEqual({ list: 'towns' });
    // The name typed is one step.
    designer.undo();
    expect(field(city).optionsFrom).toEqual({ list: 'city' });
    designer.redo();
    // Emptied, the box waits for a name: the list keeps the one it had.
    change(name, '');
    expect(field(city).optionsFrom).toEqual({ list: 'towns' });
  });

  it('keeps each editor’s pick its own when the canvas and the panel both show the options', () => {
    const { designer, city, node } = setup({ lists: LISTS });
    const first = optionsEditor(elementFactory(document), designer, city);
    const second = optionsEditor(elementFactory(document), designer, city);
    document.body.replaceChildren(first.element, second.element);
    designer.setOptionsFrom(city, { list: 'cities' });
    for (const editor of [first, second]) editor.update(designer.getPage().fields[node(city).field], node(city));
    const picked = (root: Element) => (root.querySelector('input[value="list"]') as HTMLInputElement).checked;
    expect([picked(first.element), picked(second.element)]).toEqual([true, true]);
  });

  it('shows no such choice for a field the model owns', () => {
    const { designer, node } = setup({ model: true });
    const region = designer.addModelField('region') as string;
    const { el } = mountEditor(designer, region, node);
    expect((el.querySelector('.fd-q-source') as HTMLElement).hidden).toBe(true);
  });
});
