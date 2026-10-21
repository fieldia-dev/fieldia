import { createForm, createMemoryDataSource, type FieldNode, type Form, type Locale, type Page } from '@fieldia/core';
import { createWidget, widgetPart } from './widgets';
import { displayValue } from './display';
import { languagesPart, textPart } from './widget-parts';
import { partsOf } from './parts';
import { languageWords, ownName, readerFirst } from './languages-part';
import { WIDGET_LABELS } from './labels';

/**
 * A text kept in several languages (`translate`), typed by a person in each: a listing's title in Arabic and English
 * under a switch between them, the reader's first, each language's box its field's own and written its own way — and,
 * where it is read, the reader's language, else another's, marked. Nothing is translated by a machine.
 */

const page = (fields: Page['fields'] = {}): Page =>
  ({
    fieldia: '0.8',
    id: 'listing',
    data: { kind: 'record', model: 'listing' },
    fields: {
      title: { type: 'char', label: 'Title', translate: ['ar', 'en'], required: true, size: 12 },
      description: { type: 'text', label: 'Description', translate: ['ar', 'en'] },
      notes: { type: 'html', label: 'Notes', translate: ['en', 'ar'] },
      ...fields,
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-title', field: 'title' }] },
  }) as Page;

function draw(form: Form, name = 'title', locale: Locale = 'en', node: Partial<FieldNode> = {}) {
  const made = createWidget({ form, name, field: form.page.fields[name], node: { type: 'field', id: `f-${name}`, field: name, ...node }, id: `fd-${name}`, document, locale, labels: WIDGET_LABELS[locale] });
  document.body.replaceChildren(made.element);
  const refresh = () => {
    const state = form.getState();
    made.update({ value: state.values[name], values: state.values, readonly: !!node.readonly, required: form.page.fields[name].required === true, invalid: !!state.errors[name], describedBy: `fd-${name}-error` });
  };
  form.subscribe(refresh);
  refresh();
  return made;
}

const tabs = (element: Element) => [...element.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const shownPane = (element: Element) => element.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])') as HTMLElement;
const boxIn = (pane: Element) => pane.querySelector<HTMLInputElement>('input, textarea') as HTMLInputElement;
function type(box: HTMLInputElement | HTMLTextAreaElement, text: string) {
  box.focus();
  box.value = text;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('a text kept in several languages, typed', () => {
  it('is a switch over its box, the reader’s language first, each named in itself and written its own way', () => {
    const form = createForm({ page: page(), dataSource: createMemoryDataSource() });
    const english = draw(form, 'title', 'en');
    expect(tabs(english.element).map((tab) => [tab.querySelector('span')?.textContent, tab.lang, tab.getAttribute('aria-selected')])).toEqual([
      ['English', 'en', 'true'],
      ['العربية', 'ar', 'false'],
    ]);
    expect(english.element.getAttribute('role')).toBe('group');
    expect(english.element.id).toBe('fd-title');
    expect(english.element.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Languages of Title');
    const pane = shownPane(english.element);
    expect([pane.lang, pane.dir]).toEqual(['en', 'ltr']);
    expect(boxIn(pane).getAttribute('aria-labelledby')).toBe('fd-title-label fd-title-tab-en');
    // An Arabic reader: Arabic first, written right to left.
    const arabic = draw(form, 'title', 'ar');
    expect(tabs(arabic.element).map((tab) => tab.lang)).toEqual(['ar', 'en']);
    expect([shownPane(arabic.element).lang, shownPane(arabic.element).dir]).toEqual(['ar', 'rtl']);
    expect(readerFirst(['ar', 'en'], 'en')).toEqual(['en', 'ar']);
    expect(readerFirst(['ar', 'en-GB'], 'en')).toEqual(['en-GB', 'ar']);
    expect(readerFirst(['ar', 'en'], 'de')).toEqual(['ar', 'en']);
    expect(ownName('fr')).toBe('Français');
  });

  it('writes each language’s text into the value as it is typed; a language emptied goes; none left, no value', () => {
    const form = createForm({ page: page(), dataSource: createMemoryDataSource() });
    const made = draw(form);
    type(boxIn(shownPane(made.element)), 'Sea-view villa');
    expect(form.getState().values['title']).toEqual({ en: 'Sea-view villa' });
    tabs(made.element)[1].click();
    expect(tabs(made.element)[1].getAttribute('aria-selected')).toBe('true');
    type(boxIn(shownPane(made.element)), 'فيلا');
    expect(form.getState().values['title']).toEqual({ en: 'Sea-view villa', ar: 'فيلا' });
    type(boxIn(shownPane(made.element)), '');
    expect(form.getState().values['title']).toEqual({ en: 'Sea-view villa' });
    tabs(made.element)[0].click();
    type(boxIn(shownPane(made.element)), '');
    expect(form.getState().values['title']).toBeNull();
  });

  it('shows each language’s text; a plain text, from a source that gives one language, as its first language’s', () => {
    const form = createForm({ page: page(), dataSource: createMemoryDataSource() });
    form.setValues({ title: { ar: 'فيلا على البحر', en: 'Sea-view villa' } });
    const made = draw(form);
    expect(boxIn(shownPane(made.element)).value).toBe('Sea-view villa');
    tabs(made.element)[1].click();
    expect(boxIn(shownPane(made.element)).value).toBe('فيلا على البحر');
    // Arabic is the field's first language.
    form.setValues({ title: 'Villa' });
    expect(boxIn(shownPane(made.element)).value).toBe('Villa');
    tabs(made.element)[0].click();
    expect(boxIn(shownPane(made.element)).value).toBe('');
  });

  it('marks a language a required answer still needs, says it, and takes the focus there when the field is said to be wrong', async () => {
    const form = createForm({ page: page(), dataSource: createMemoryDataSource() });
    const made = draw(form);
    expect(tabs(made.element).map((tab) => [tab.hasAttribute('data-empty'), tab.querySelector('.fd-sr-only')?.textContent])).toEqual([
      [true, ' required, not typed yet'],
      [true, ' required, not typed yet'],
    ]);
    type(boxIn(shownPane(made.element)), 'Villa');
    await form.save();
    expect(form.getState().errors['title']).toBe('Title is required in Arabic');
    expect(tabs(made.element).map((tab) => [tab.lang, tab.hasAttribute('data-empty'), tab.hasAttribute('data-fault')])).toEqual([
      ['en', false, false],
      ['ar', true, true],
    ]);
    // Only the Arabic box is wrong.
    const panes = [...made.element.querySelectorAll('[role="tabpanel"]')];
    expect(panes.map((pane) => boxIn(pane).getAttribute('aria-invalid'))).toEqual(['false', 'true']);
    made.focus();
    expect(tabs(made.element)[1].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(boxIn(shownPane(made.element)));
  });

  it('shows the language of the box a refused save takes the focus to (the viewer’s fd-focus-problem)', async () => {
    const form = createForm({ page: page(), dataSource: createMemoryDataSource() });
    const made = draw(form);
    type(boxIn(shownPane(made.element)), 'Villa');
    await form.save();
    const arabic = [...made.element.querySelectorAll('[role="tabpanel"]')][1];
    expect(arabic.hasAttribute('hidden')).toBe(true);
    // As the viewer finds the first box said to be wrong, and sends it the event before it focuses it.
    boxIn(arabic).dispatchEvent(new CustomEvent('fd-focus-problem', { cancelable: true }));
    expect(arabic.hasAttribute('hidden')).toBe(false);
    expect(tabs(made.element)[1].getAttribute('aria-selected')).toBe('true');
  });

  it('keeps each language within the field’s most characters, counted under its box', () => {
    const form = createForm({ page: page(), dataSource: createMemoryDataSource() });
    const made = draw(form);
    // Pasted over its most (a key at the most is refused): kept whole, counted, and said once the box is left.
    form.setValues({ title: { ar: 'فيلا', en: 'A sea-view villa' } });
    form.boxLeft('title');
    expect(form.getState().errors['title']).toBe('Title (English) is 4 characters too long: shorten it to 12');
    expect(shownPane(made.element).querySelector('.fd-count')?.textContent).toBe('16 / 12');
    expect(tabs(made.element).map((tab) => tab.hasAttribute('data-fault'))).toEqual([true, false]);
    tabs(made.element)[1].click();
    expect(shownPane(made.element).querySelector('.fd-count')?.textContent).toBe('4 / 12');
  });

  it('moves between its languages with the arrows, mirrored right to left, and Home and End', () => {
    const form = createForm({ page: page(), dataSource: createMemoryDataSource() });
    const made = draw(form);
    const [en, ar] = tabs(made.element);
    en.focus();
    en.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(ar);
    expect(ar.getAttribute('aria-selected')).toBe('true');
    expect([en.tabIndex, ar.tabIndex]).toEqual([-1, 0]);
    ar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(en);
    document.body.dir = 'rtl';
    en.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(ar);
    document.body.removeAttribute('dir');
  });

  it('a paragraph and formatted text in each language, its own box', () => {
    const form = createForm({ page: page(), dataSource: createMemoryDataSource() });
    const paragraph = draw(form, 'description');
    expect(shownPane(paragraph.element).querySelector('textarea')).not.toBeNull();
    const rich = draw(form, 'notes');
    const editor = shownPane(rich.element).querySelector<HTMLElement>('[contenteditable="true"]') as HTMLElement;
    editor.innerHTML = '<p>Pool <b>heated</b></p>';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.getState().values['notes']).toEqual({ en: '<p>Pool <b>heated</b></p>' });
  });

  it('read-only, each language is read, its switch still switching', () => {
    const form = createForm({ page: page(), dataSource: createMemoryDataSource() });
    form.setValues({ title: { ar: 'فيلا', en: 'Villa' } });
    const made = draw(form, 'title', 'en', { readonly: true });
    expect(boxIn(shownPane(made.element)).readOnly).toBe(true);
    tabs(made.element)[1].click();
    expect(boxIn(shownPane(made.element)).value).toBe('فيلا');
  });

  it('asks for its part, with formatted text’s editor where it has one', () => {
    const fields = page().fields;
    expect(partsOf(widgetPart(fields['title'], { type: 'field', id: 't', field: 'title' }) as never)).toEqual([languagesPart]);
    const withEditor = partsOf(widgetPart(fields['notes'], { type: 'field', id: 'n', field: 'notes', options: { editor: 'rich' } }) as never);
    expect(withEditor).toEqual([languagesPart, textPart]);
    expect(widgetPart({ type: 'char', label: 'Name' }, { type: 'field', id: 'n', field: 'name' })).toBeUndefined();
  });
});

describe('a text kept in several languages, read', () => {
  const title = page().fields['title'];

  it('as words: the reader’s language, else the first typed; formatted text’s words', () => {
    expect(displayValue(title as never, { ar: 'فيلا', en: 'Villa' }, {}, 'ar')).toBe('فيلا');
    expect(displayValue(title as never, { ar: 'فيلا', en: 'Villa' }, {}, 'en')).toBe('Villa');
    expect(displayValue(title as never, { ar: 'فيلا' }, {}, 'en')).toBe('فيلا');
    expect(displayValue(page().fields['notes'] as never, { en: '<p>Pool <b>heated</b></p>' }, {}, 'en')).toBe('Pool heated');
  });

  it('drawn in a list’s cell: in its own language, marked with it where it is not the reader’s', () => {
    const [own] = languageWords(document, { ar: 'فيلا', en: 'Villa' }, title, 'en');
    expect([(own as HTMLElement).lang, own.textContent]).toEqual(['en', 'Villa']);
    expect(languageWords(document, { ar: 'فيلا', en: 'Villa' }, title, 'en')).toHaveLength(1);
    const [words, mark] = languageWords(document, { ar: 'فيلا' }, title, 'en') as HTMLElement[];
    expect([words.lang, words.textContent]).toEqual(['ar', 'فيلا']);
    expect(mark.className).toBe('fd-lang-mark');
    expect(mark.textContent).toBe('AR (in Arabic)');
    expect(mark.title).toBe('in Arabic');
    const [, inArabic] = languageWords(document, { en: 'Villa' }, title, 'ar', WIDGET_LABELS.ar) as HTMLElement[];
    expect(inArabic.title).toBe('باللغة الإنجليزية');
    expect(languageWords(document, null, title, 'en')).toEqual([]);
    expect(document.getElementById('fieldia-languages-styles')).not.toBeNull();
  });
});
