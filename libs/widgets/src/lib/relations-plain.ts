import { foldDigits, foldForSearch, stripMarks, type ReferenceValue, type RelatedRecord } from '@fieldia/core';
import { quoted } from './input-rules';
import { describeState, fillIn, setAttr, setText, wordsFor } from './kind-parts';
import { plainLinksWidget } from './lines-plain';
import { stillShown } from './shown';
import { partFactory, relationsPart, type PartFactory } from './widget-parts';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * Links to other records drawn before the relations part came (relations.ts), by something that did not wait for it
 * as the viewer does. A many2one is a box showing its record's name; a many2many's tags are their names, beside a box
 * to type one more in: what is typed is kept, and the part's box takes it as typed — the caret and the focus with it —
 * when it comes (`takeTyped`). Checkboxes and a reference show their records' names as plain words, read only. The
 * part's widget takes the plain one's place with the last state it was given (`partWidget`).
 */

/** As many records of one exact name as are asked for: two tell there are several (relations.ts asks as many). */
const EXACT = 20;
/** Words as a search compares them: case, Arabic letter forms and digits folded. */
const folded = (text: string) => foldForSearch(text).trim();

/**
 * A box to type a record's name in, before the relations part came: one record's (a many2one), its name in the box at
 * rest; or one more of several (a many2many's tags), their names beside it. Words left in it before the part came — or
 * read for a save meanwhile (`form.settling`), which waits for them — are looked up as leaving the part's box looks
 * them up: the one record of that exact name is taken (added, for tags); else they stay as typed, kept unread with why,
 * so a save is refused rather than made without them. A many2one emptied and left is unlinked; Escape puts back what
 * the box held.
 */
function plainNameBox({ form, name, field, node, id, document, labels, locale }: WidgetContext, many: boolean): Widget {
  const words = wordsFor(labels, locale);
  const label = node.label ?? field.label;
  const input = document.createElement('input');
  Object.assign(input, { id, type: 'text', className: 'fd-input', autocomplete: 'off' });
  if (node.placeholder) input.placeholder = node.placeholder;
  // A many2many's names before its box, as words.
  const names = many ? document.createElement('output') : null;
  const element = names ? document.createElement('div') : input;
  if (names) {
    names.className = 'fd-value-text';
    element.append(names, input);
  }
  element.dataset['fdPlain'] = 'link';
  /** What the box holds at rest: a many2one's record's name; nothing, for tags. */
  let shown = '';
  /** Typed in since the box last read what it holds. */
  let typed = false;
  /** Words being looked up, and their end. */
  let reading: Promise<void> | null = null;
  const chosen = () => (form.getState().values[name] as RelatedRecord[] | null) ?? [];
  const unreadNow = () => form.getState().unread?.[name];
  const keep = (text: string, template: string) => form.setUnread(name, { text, message: fillIn(template, { label, text: quoted(text.trim()) }) });
  const letGo = () => unreadNow() && form.setUnread(name, null);

  function take(record: RelatedRecord) {
    letGo();
    if (!many) return form.setValue(name, record);
    input.value = '';
    if (!chosen().some((one) => one.id === record.id)) form.setValue(name, [...chosen(), record]);
  }

  /** What is typed, read as leaving the part's box reads it; a reading on its way is waited for. */
  function read(): Promise<void> | undefined {
    if (!typed) return reading ?? undefined;
    typed = false;
    const text = input.value;
    if (text.trim() === '') {
      letGo();
      if (!many && shown !== '') form.setValue(name, null);
      return undefined;
    }
    if (!many && text === shown) {
      letGo();
      return undefined;
    }
    keep(text, words.lookingUp);
    const asked = stillShown(form);
    const done: Promise<void> = form
      .search(name, foldDigits(stripMarks(text.trim())), EXACT, { exact: true })
      .catch(() => [] as RelatedRecord[])
      .then((found) => {
        if (reading === done) reading = null;
        // For a record no longer shown, or typed in again since: the latest reading acts.
        if (!asked() || typed || input.value !== text) return;
        const same = [...new Map(found.filter((record) => folded(record.label) === folded(text)).map((record) => [String(record.id), record])).values()];
        if (same.length === 1) take(same[0]);
        else keep(text, same.length ? words.severalCalled : words.noMatch);
      });
    reading = done;
    return done;
  }

  input.addEventListener('input', () => {
    typed = true;
  });
  // Left: read, as leaving the part's box reads it (a change, and the blur after it, read once).
  input.addEventListener('change', () => void read());
  input.addEventListener('blur', () => void read());
  input.addEventListener('keydown', (event) => {
    // A key an IME is composing with is the IME's.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && typed) {
      // Words typed: never the form's Enter.
      event.preventDefault();
      void read();
    } else if (event.key === 'Escape' && (typed || unreadNow())) {
      typed = false;
      input.value = shown;
      letGo();
    }
  });
  // Still typed in: autosave, which nobody pressed, waits until the box is left.
  const stopReading = typeof form.settling === 'function' ? form.settling(read, () => document.activeElement === input && typed) : null;

  return {
    element,
    focus: () => input.focus(),
    destroy() {
      // A name still being looked up is still read for a save: its reader goes once it is found, or not.
      if (reading) void reading.then(() => stopReading?.());
      else stopReading?.();
    },
    update(state) {
      if (names) setText(names, chosen().map((record) => record.label || String(record.id)).join(', '));
      else shown = (state.value as RelatedRecord | null | undefined)?.label ?? '';
      // Words the form keeps unread stay as typed; anything else shows what the field holds.
      const want = unreadNow()?.text ?? shown;
      if (!typed && input.value !== want) input.value = want;
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      setAttr(input, 'aria-required', String(state.required));
      describeState(input, state);
    },
  };
}

/** A many2one before its part came: a box showing its record's name, which keeps what is typed in it. */
export const plainLinkWidget: WidgetFactory = (context) => plainNameBox(context, false);
/** A many2many's tags before their part came: their names, beside a box that keeps a name typed to add. */
export const plainTagsWidget: WidgetFactory = (context) => plainNameBox(context, true);

/** A reference before its part came: its record's name as plain words, read only — its model is picked in the part's box. */
export const plainReferenceWidget: WidgetFactory = ({ id, document }) => {
  const output = document.createElement('output');
  output.id = id;
  output.className = 'fd-value-text';
  output.dataset['fdPlain'] = 'link';
  // Focus asked for meanwhile (a required field left empty, say) lands here, and moves to the part's widget with it.
  output.tabIndex = -1;
  return {
    element: output,
    focus: () => output.focus(),
    update(state) {
      setText(output, (state.value as ReferenceValue | null | undefined)?.label ?? '');
      describeState(output, state);
    },
  };
};

// The links' widgets, as 0.24 gave them, each the relations part's: drawn plainly until it comes.
/** A many2one: a search-as-you-type box of the records it may link to. */
export const many2oneWidget: PartFactory = partFactory(relationsPart, (part) => part.many2oneWidget, plainLinkWidget);
/** A many2many as tags, added from a search-as-you-type box. */
export const tagsWidget: PartFactory = partFactory(relationsPart, (part) => part.tagsWidget, plainTagsWidget);
/** A many2many as a checkbox for each record it may link to: the records' names meanwhile. */
export const linkCheckboxesWidget: PartFactory = partFactory(relationsPart, (part) => part.linkCheckboxesWidget, plainLinksWidget);
/** A reference: a model, then a record of it. */
export const referenceWidget: PartFactory = partFactory(relationsPart, (part) => part.referenceWidget, plainReferenceWidget);

/**
 * A many2one's box, for a part that draws one (an analytic distribution's account): a function, which a part takes from
 * the main script whenever it starts — a const of this module may be unset still as the script bundle's table of
 * shared names is made (tools/script-bundle.mjs).
 */
export function linkBox(context: WidgetContext): Widget {
  return many2oneWidget(context);
}
