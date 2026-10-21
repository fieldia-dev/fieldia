/**
 * The languages part (widget-parts.ts, `languagesPart`): a text kept in several languages (`translate`), each typed by a
 * person — a switch between its languages over its box, the reader's first, each language's box its field's own (a
 * line, a paragraph, formatted text) written its own way, Arabic right to left; and a list's cell or card showing it in
 * the reader's language, else another's, marked. Nothing is translated by a machine. It comes with the form's code for
 * it, @fieldia/core's (`formLanguagesPart`): checked in each language, read in the reader's.
 */
import { formLanguagesPart, isRightToLeft, languagesOf, type Field, type Form, type FormLanguagesPart, type LineField, type Value } from '@fieldia/core';
import { fillIn, maker, rightToLeft, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import { installLanguagesStyles } from './styles-languages';
export { installLanguagesStyles } from './styles-languages';
import type { WidgetLabels } from './labels';
import type { Widget, WidgetContext, WidgetFactory, WidgetState } from './widgets';

/** The form's code for a text in several languages: in before this part's (`languagesPart` waits for it). */
const core = (): FormLanguagesPart => formLanguagesPart.loaded as FormLanguagesPart;

/** A box a language's text is typed in, inside its widget. */
const BOX = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), textarea, [contenteditable="true"]';

const primary = (tag: string) => tag.toLowerCase().split('-')[0];

/** The field's languages, the reader's first (its tag, or the same language's); the rest in the field's order. */
export function readerFirst(languages: readonly string[], reader: string): string[] {
  const own = languages.find((tag) => tag.toLowerCase() === reader.toLowerCase()) ?? languages.find((tag) => primary(tag) === primary(reader));
  return own ? [own, ...languages.filter((tag) => tag !== own)] : [...languages];
}

/** A language's name in itself, as a switch between languages names each: "English", "العربية", "Français"; else its tag. */
export function ownName(tag: string): string {
  try {
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag);
    if (name && name !== tag) return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1);
  } catch {
    // A browser with no names of languages, or a tag it cannot read.
  }
  return tag.toUpperCase();
}

/** Its text as an object by language: a plain text (a source that gives one language) as its first language's. */
const textsOf = (value: Value | undefined, languages: readonly string[]): Record<string, unknown> =>
  typeof value === 'string' ? { [languages[0]]: value } : value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * A text in several languages typed: one box of the field's own kind for each language (`base`, its widget), shown one
 * at a time under a switch, the reader's language first. Each box is the field's box — its rules as typed, its most
 * characters counted, its reading as it is left — writing its language's text into the value, `{ ar, en }`, a language
 * emptied taken out of it, none left no value. A language a required answer still needs, or whose text the field does
 * not take, is marked on its tab, and the field's focus goes to the first such where the field is said to be wrong.
 */
export function languagesWidget(base: WidgetFactory, context: WidgetContext): Widget {
  const { form, name, field, node, id, document: doc, labels, locale = 'en' } = context;
  installLanguagesStyles(doc);
  const languages = languagesOf(field) ?? [];
  const order = readerFirst(languages, locale);
  const words = wordsFor(labels, locale);
  const make = maker(doc);
  const label = node.label ?? field.label;
  const tabs = make('div', { class: 'fd-lang-tabs', role: 'tablist', 'aria-label': fillIn(words.languageSwitch, { label }) });
  const element = make('div', { class: 'fd-langs', role: 'group', id }, tabs);
  let shown = order[0];
  let last: WidgetState | null = null;

  /** The form as one language's box sees it: its value that language's text; its text written into the whole. */
  const formIn = (tag: string): Form =>
    Object.create(form, {
      getState: {
        value: () => {
          const state = form.getState();
          const text = textsOf(state.values[name], languages)[tag];
          return { ...state, values: { ...state.values, [name]: typeof text === 'string' ? text : null } };
        },
      },
      setValue: {
        value: (own: string, text: Value, how?: Parameters<Form['setValue']>[2]) => {
          if (own !== name) return form.setValue(own, text, how);
          const texts = { ...textsOf(form.getState().values[name], languages) };
          if (typeof text === 'string' && text !== '') texts[tag] = text;
          else delete texts[tag];
          form.setValue(name, (Object.keys(texts).length ? texts : null) as Value, how);
        },
      },
    }) as Form;

  const each = order.map((tag) => {
    const tab = make('button', { type: 'button', role: 'tab', class: 'fd-lang-tab', id: `${id}-tab-${tag}`, 'aria-controls': `${id}-pane-${tag}`, lang: tag, dir: 'auto' }, make('span', {}, ownName(tag)));
    const state = make('span', { class: 'fd-lang-state', 'aria-hidden': 'true' });
    const said = make('span', { class: 'fd-sr-only' });
    tab.append(state, said);
    const widget = base({ ...context, form: formIn(tag), id: `${id}-${tag}` });
    // Each language written its own way, whatever the page's: Arabic right to left on an English page, English left to
    // right on an Arabic one; on paper, under its name.
    const pane = make('div', { class: 'fd-lang-pane', role: 'tabpanel', id: `${id}-pane-${tag}`, 'aria-labelledby': tab.id, lang: tag, dir: isRightToLeft(tag) ? 'rtl' : 'ltr', 'data-language': ownName(tag) }, widget.element);
    tabs.append(tab);
    element.append(pane);
    tab.addEventListener('click', () => show(tag, true));
    return { tag, tab, said, pane, widget };
  });

  /**
   * A language's box: the one its widget gave its id (formatted text's editor, never the link row's box before it), else
   * the first it holds — named by the field's label and its language's tab.
   */
  const boxOf = (one: (typeof each)[number]) => {
    const own = `${id}-${one.tag}`;
    const element = one.widget.element;
    return element.id === own ? element : (element.querySelector<HTMLElement>(`[id="${own}"]`) ?? (element.matches(BOX) ? element : element.querySelector<HTMLElement>(BOX)));
  };

  function show(tag: string, focusTab = false) {
    shown = tag;
    for (const one of each) {
      const on = one.tag === tag;
      one.tab.setAttribute('aria-selected', String(on));
      one.tab.tabIndex = on ? 0 : -1;
      setHidden(one.pane, !on);
    }
    if (focusTab) each.find((one) => one.tag === tag)?.tab.focus();
  }

  // The arrows move between the languages as they run on the page (mirrored right to left), Home and End to the ends.
  tabs.addEventListener('keydown', (event) => {
    const at = each.findIndex((one) => one.tab === doc.activeElement);
    if (at < 0) return;
    const back = rightToLeft(tabs) ? 'ArrowRight' : 'ArrowLeft';
    const forth = rightToLeft(tabs) ? 'ArrowLeft' : 'ArrowRight';
    const next = event.key === forth ? (at + 1) % each.length : event.key === back ? (at - 1 + each.length) % each.length : event.key === 'Home' ? 0 : event.key === 'End' ? each.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    show(each[next].tag, true);
  });

  // A save refused takes the focus to the first box said to be wrong (the viewer's `fd-focus-problem`, sent to it): its
  // language shown first, so the focus lands where the person sees it.
  element.addEventListener('fd-focus-problem', (event) => {
    const pane = (event.target as Element).closest?.('.fd-lang-pane');
    const one = each.find((own) => own.pane === pane);
    if (one && one.tag !== shown) show(one.tag);
  }, true);

  /** The languages a problem is in: those a required answer misses, those whose text the field does not take. */
  const atFault = (state: WidgetState): string[] => (state.invalid ? core().languagesAtFault(field as Field, state.value, state.required) : []);

  show(shown);
  return {
    element,
    update(state) {
      last = state;
      const texts = textsOf(state.value, languages);
      const asked = (field as { requiredIn?: string[] }).requiredIn ?? languages;
      const faults = atFault(state);
      for (const one of each) {
        const text = texts[one.tag];
        const typed = typeof text === 'string' && text.trim() !== '';
        const required = state.required && asked.includes(one.tag);
        // Wrong in this language, or — a problem none of its languages holds alone (a rule's) — in every one.
        const invalid = state.invalid && (faults.length ? faults.includes(one.tag) : true);
        one.widget.update({ ...state, value: typeof text === 'string' ? text : null, required, invalid });
        setAttr(one.tab, 'data-empty', typed ? null : '');
        setAttr(one.tab, 'data-fault', faults.includes(one.tag) ? '' : null);
        setText(one.said, typed ? '' : ` ${required ? words.languageNeeded : words.languageEmpty}`);
        const box = boxOf(one);
        if (box) setAttr(box, 'aria-labelledby', `${id}-label ${one.tab.id}`);
      }
    },
    focus() {
      // Said to be wrong: the first language the problem is in, where the one shown holds none of it.
      const faults = last ? atFault(last) : [];
      if (faults.length && !faults.includes(shown)) show(order.find((tag) => faults.includes(tag)) ?? shown);
      each.find((one) => one.tag === shown)?.widget.focus();
    },
    destroy() {
      for (const one of each) one.widget.destroy?.();
    },
  };
}

/** Words of formatted text, its tags left out, as a cell reads it. */
const plainWords = (field: Field | LineField, text: string) => (field.type === 'html' ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : text);

/**
 * A text in several languages as words where it is read, not typed — a value shown as words, a record's name: in the
 * reader's language (`locale`), else in the first of the field's it was typed in. A plain text is itself.
 */
export function languageText(value: Value | undefined, field: Field | LineField, locale: string): string {
  const found = core().textIn(value, locale, languagesOf(field));
  return found ? plainWords(field, found.text) : '';
}

/**
 * A text in several languages drawn where it is read — a list's cell, a card's title or line: in the reader's language,
 * else in another's, written its own way (its `lang`), its language's code beside it ("EN"), said in words to a screen
 * reader ("in English"). Nothing for none.
 */
export function languageWords(doc: Document, value: Value | undefined, field: Field | LineField, locale: string, labels?: WidgetLabels): Node[] {
  installLanguagesStyles(doc);
  const found = core().textIn(value, locale, languagesOf(field));
  if (!found) return [];
  const make = maker(doc);
  const words = make('bdi', found.language ? { lang: found.language } : {}, plainWords(field, found.text));
  if (!found.other || !found.language) return [words];
  const said = fillIn(wordsFor(labels, locale as WidgetContext['locale']).inLanguage, { language: core().languageName(found.language, locale) });
  const mark = make('span', { class: 'fd-lang-mark', title: said }, make('span', { 'aria-hidden': 'true' }, primary(found.language).toUpperCase()), make('span', { class: 'fd-sr-only' }, ` (${said})`));
  return [words, mark];
}
