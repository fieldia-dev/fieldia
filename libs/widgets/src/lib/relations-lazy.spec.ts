import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page } from '@fieldia/core';
import { plainLinkWidget, plainReferenceWidget, plainTagsWidget } from './relations-plain';
import { choicePart, linesPart, relationsPart, type PartFactory } from './widget-parts';
import { builtInWidgets, createWidget, widgetPart, type Widget, type WidgetFactory } from './widgets';

/**
 * Links to other records in the relations part (relations-part.ts) — a many2one's and a reference's box, a many2many's
 * tags and checkboxes, a char field's tags — and, moved with them out of the main script (0.25), several answers chosen
 * as tags and a long choice's search box in the choice part, and a one2many's cards in the lines part. Each kind's
 * factory names its part; a widget made before the part came — by something that did not wait for it, as the viewer
 * does — keeps the value and what is typed in it (relations-plain.ts), and the part's own widget takes its place with
 * them. This file starts with no part loaded (src/test-parts.ts leaves it so).
 */

const fields: Record<string, Field> = {
  partner: { type: 'many2one', label: 'Customer', relation: 'partner' },
  tags: { type: 'many2many', label: 'Tags', relation: 'tag' },
  labels: { type: 'char', label: 'Labels' },
  doc: { type: 'reference', label: 'Document', models: [{ value: 'partner', label: 'Customer' }] },
  rooms: { type: 'selection', label: 'Rooms', multiple: true, options: [{ value: 'kitchen', label: 'Kitchen' }, { value: 'gym', label: 'Gym' }] },
  floor: { type: 'selection', label: 'Floor', options: Array.from({ length: 20 }, (_, i) => ({ value: String(i), label: `Floor ${i}` })) },
  guests: { type: 'one2many', label: 'Guests', relation: 'guest', fields: { name: { type: 'char', label: 'Name' } } },
};
const page = { fieldia: '0.1', id: 'p', data: { kind: 'record', model: 'order' }, fields, layout: { type: 'sections', id: 's', children: [] } } as unknown as Page;
const RECORDS = { partner: { 1: { name: 'Nile Traders' }, 2: { name: 'Delta Foods' }, 3: { name: 'Twin' }, 4: { name: 'Twin' } }, tag: { 1: { name: 'Alpha' }, 2: { name: 'Beta' } } };
const formFor = (values: Record<string, unknown> = {}) => createForm({ page, values: values as never, dataSource: createMemoryDataSource({ records: RECORDS }) });
const node = (field: string, more: Partial<FieldNode> = {}) => ({ type: 'field', id: `f-${field}`, field, ...more }) as FieldNode;

/**
 * A field's widget, drawn as an app that did not wait for its part draws it — or by a plain factory itself, as the part
 * never came — and kept up to date with its form.
 */
function drawn(form: ReturnType<typeof formFor>, name: string, more: Partial<FieldNode> = {}, factory?: WidgetFactory): Widget {
  const context = { form, name, field: fields[name], node: node(name, more), id: `w-${name}`, document };
  const made = factory ? factory(context) : createWidget(context);
  document.body.append(made.element);
  const refresh = () => made.update({ value: form.getState().values[name], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return made;
}

/** Keys typed where the focus is: each lands, then an input says so. */
function type(box: HTMLInputElement, text: string) {
  for (const char of text) {
    const start = box.selectionStart ?? box.value.length;
    box.setRangeText(char, start, box.selectionEnd ?? start, 'end');
    box.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}
const settle = () => new Promise((done) => setTimeout(done, 0));
const box = (id: string) => document.getElementById(id) as HTMLInputElement;

afterEach(() => document.body.replaceChildren());

describe('the relations part', () => {
  it('is named by each link’s factory; a path picker needs it not, nor a link drawn by the app', () => {
    for (const [name, widget] of [['partner', undefined], ['tags', undefined], ['tags', 'tags'], ['tags', 'checkboxes'], ['labels', 'tags'], ['doc', undefined]] as const) {
      expect(widgetPart(fields[name], node(name, widget ? { widget } : {}))).toBe(relationsPart);
    }
    expect((builtInWidgets['many2one'] as PartFactory).partOf(node('partner'))).toBe(relationsPart);
    expect(widgetPart(fields['partner'], node('partner', { widget: 'path' }))?.name).toBe('path');
    const own = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(widgetPart(fields['partner'], node('partner'), { many2one: own })).toBeUndefined();
    // A char field without tags is a text box, as ever.
    expect(widgetPart(fields['labels'], node('labels'))).toBeUndefined();
  });
});

describe('a link left before its part came (drawn plainly, as a part that never came leaves it)', () => {
  it('a many2one takes the record of the exact name typed, as leaving the part’s box does; a save waits for it', async () => {
    const form = formFor({ partner: { id: 1, label: 'Nile Traders' } });
    drawn(form, 'partner', {}, plainLinkWidget);
    const plain = box('w-partner');
    expect([plain.tagName, plain.value, plain.dataset['fdPlain']]).toEqual(['INPUT', 'Nile Traders', 'link']);
    plain.focus();
    plain.select();
    type(plain, 'delta foods');
    // Read for a save before it is left: looked up, kept unread meanwhile, and the save waits.
    const saved = form.settle();
    expect(form.getState().unread['partner']).toMatchObject({ text: 'delta foods', message: expect.stringContaining('still looking for') });
    await saved;
    await settle();
    expect(form.getState().values['partner']).toMatchObject({ id: 2, label: 'Delta Foods' });
    expect(form.getState().unread['partner'] ?? null).toBeNull();
    expect(plain.value).toBe('Delta Foods');
  });

  it('words that name none, or several, stay as typed, kept unread with why; Escape puts back what it held', async () => {
    const form = formFor({ partner: { id: 1, label: 'Nile Traders' } });
    drawn(form, 'partner', {}, plainLinkWidget);
    const plain = box('w-partner');
    plain.focus();
    plain.select();
    type(plain, 'Nobody');
    plain.blur();
    await form.settle();
    await settle();
    expect(form.getState().values['partner']).toMatchObject({ id: 1 });
    expect(form.getState().unread['partner']).toMatchObject({ text: 'Nobody', message: expect.stringContaining('nothing is called') });
    expect(plain.value).toBe('Nobody');
    plain.focus();
    plain.select();
    type(plain, 'Twin');
    plain.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await form.settle();
    expect(form.getState().unread['partner']).toMatchObject({ text: 'Twin', message: expect.stringContaining('more than one is called') });
    plain.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect([plain.value, form.getState().unread['partner'] ?? null, form.getState().values['partner']]).toEqual(['Nile Traders', null, { id: 1, label: 'Nile Traders' }]);
  });

  it('a many2one emptied and left is unlinked', () => {
    const form = formFor({ partner: { id: 1, label: 'Nile Traders' } });
    drawn(form, 'partner', {}, plainLinkWidget);
    const plain = box('w-partner');
    plain.focus();
    plain.select();
    plain.setRangeText('', 0, plain.value.length, 'end');
    plain.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
    plain.blur();
    expect(form.getState().values['partner']).toBeNull();
  });

  it('a many2many’s tags are their names, beside a box whose name typed is added once left', async () => {
    const form = formFor({ tags: [{ id: 1, label: 'Alpha' }] });
    const widget = drawn(form, 'tags', {}, plainTagsWidget);
    expect(widget.element.querySelector('output')?.textContent).toBe('Alpha');
    const plain = box('w-tags');
    plain.focus();
    type(plain, 'beta');
    plain.blur();
    await form.settle();
    await settle();
    expect((form.getState().values['tags'] as { label: string }[]).map((tag) => tag.label)).toEqual(['Alpha', 'Beta']);
    expect([plain.value, widget.element.querySelector('output')?.textContent]).toEqual(['', 'Alpha, Beta']);
  });

  it('a reference shows its record’s name, read only', () => {
    const form = formFor({ doc: { model: 'partner', id: 2, label: 'Delta Foods' } });
    const reference = drawn(form, 'doc', {}, plainReferenceWidget);
    expect([reference.element.tagName, reference.element.textContent]).toEqual(['OUTPUT', 'Delta Foods']);
  });
});

describe('a link drawn before its part came', () => {
  it('a many2one’s words typed go to the part’s box as typed, the caret and the focus with them; the tags too', async () => {
    const form = formFor({ partner: { id: 1, label: 'Nile Traders' }, tags: [], labels: 'red, blue', doc: { model: 'partner', id: 2, label: 'Delta Foods' } });
    expect(relationsPart.loaded).toBeUndefined();
    const widget = drawn(form, 'partner');
    const tags = drawn(form, 'tags');
    const labels = drawn(form, 'labels', { widget: 'tags' });
    const doc = drawn(form, 'doc');
    const plain = box('w-partner');
    // Each drawn plainly at once: a many2one's box, the tags' box, a char field's tags as its words in a text box, a
    // reference's name.
    expect([plain.tagName, plain.value, plain.dataset['fdPlain']]).toEqual(['INPUT', 'Nile Traders', 'link']);
    expect(tags.element.dataset['fdPlain']).toBe('link');
    expect([labels.element.tagName, (labels.element as HTMLInputElement).value]).toEqual(['INPUT', 'red, blue']);
    expect(doc.element.textContent).toBe('Delta Foods');
    box('w-tags').focus();
    type(box('w-tags'), 'Al');
    plain.focus();
    plain.select();
    type(plain, 'Del');
    await relationsPart.load();
    await settle();
    const real = box('w-partner');
    expect(real).not.toBe(plain);
    expect(real.getAttribute('role')).toBe('combobox');
    expect(widget.element.contains(real)).toBe(true);
    expect([real.value, real.selectionStart, document.activeElement === real]).toEqual(['Del', 3, true]);
    // Nothing read under the keys: the field still holds its record.
    expect(form.getState().values['partner']).toEqual({ id: 1, label: 'Nile Traders' });
    // The tags' box, left for the many2one's before the part came, read "Al" then: no tag of that name, kept unread.
    expect(tags.element.classList.contains('fd-tags')).toBe(true);
    await form.settle();
    expect(form.getState().unread['tags']).toMatchObject({ text: 'Al', message: expect.stringContaining('nothing is called') });
    // The others, the part's own in their places, with their values.
    expect(labels.element.querySelectorAll('.fd-chip')).toHaveLength(2);
    expect(doc.element.classList.contains('fd-reference')).toBe(true);
    widget.destroy?.();
    // From now on a link is the part's own, at once.
    expect(drawn(formFor(), 'doc').element.classList.contains('fd-reference')).toBe(true);
  });
});

describe('the choice part’s tags and search, and the lines part’s cards, drawn before their parts came', () => {
  it('several chosen as tags are their words; a long choice is the browser’s list; then each is the part’s own', async () => {
    const form = formFor({ rooms: ['gym', 'kitchen'], floor: '3' });
    const tags = drawn(form, 'rooms', { widget: 'tags' });
    const floor = drawn(form, 'floor');
    expect(tags.element.textContent).toBe('GymKitchen');
    expect(floor.element.tagName).toBe('SELECT');
    (floor.element as HTMLSelectElement).value = '4';
    floor.element.dispatchEvent(new Event('change', { bubbles: true }));
    expect(form.getState().values['floor']).toBe('4');
    await choicePart.load();
    await settle();
    expect(tags.element.querySelectorAll('.fd-chip')).toHaveLength(2);
    expect(floor.element.classList.contains('fd-choice-search')).toBe(true);
    expect((floor.element.querySelector('input') as HTMLInputElement).value).toBe('Floor 4');
  });

  it('cards are their lines as words, then the lines part’s cards', async () => {
    const form = formFor({ guests: [{ key: 'a', values: { name: 'Mona' } }, { key: 'b', values: { name: 'Omar' } }] });
    const cards = drawn(form, 'guests', { widget: 'cards' });
    expect(cards.element.textContent).toBe('MonaOmar');
    await linesPart.load();
    await settle();
    expect(cards.element.querySelectorAll('.fd-repeat-card')).toHaveLength(2);
    expect(document.getElementById('fieldia-cards-styles')).not.toBeNull();
  });
});
