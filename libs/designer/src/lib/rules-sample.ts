import { createForm, isRightToLeft, localizePage, MESSAGES, type AnswerRule, type Field, type FieldNode, type Form, type FormState, type Locale, type Page, type Values } from '@fieldia/core';
import { createWidget, WIDGET_LABELS, type Widget, type WidgetFactory } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import { findNode } from './page-tree';
import { fieldsReadBy } from './rules-formula';
import { languageName, languagesOf, pageLanguage } from './translations';

/**
 * Try a value, under a field's answer rules: the field drawn by its own
 * widget — the one the form and the canvas draw — and what the form would say
 * of what is typed or picked there: "Passes", the message of each rule that
 * stops sending, each warning's, marked as still sending. Said by the form
 * itself: a form made of the page checks the value, as it does when people
 * send. A field a rule reads — across fields, or in its "only when" — gets a
 * box of its own; one that cannot take a value here is named, with Try it.
 * Nothing typed is kept in the page or undone: the sample lasts while the
 * field stays picked.
 */

export interface SampleOptions {
  /** The app's own widgets, by `type` or `type.widget`, as the canvas and Try it draw with them. */
  widgets?: Record<string, WidgetFactory>;
  /** Try the whole page, for a field that cannot take a value here. Left out, it is not offered. */
  tryIt?: () => void;
  /** The clock, for dates in the past or the future. The computer's own when left out. */
  now?: () => Date;
}

export interface AnswerSample {
  element: HTMLElement;
  update(page: Page): void;
  destroy(): void;
}

/** What the form says of a sample: an error stops sending, a warning still sends. */
export interface SampleResult {
  level: 'error' | 'warning';
  message: string;
  /** The answer rule that says it, by its place; null for the field's own checks — required, what its kind takes. */
  rule: number | null;
}

// ---- what the form says ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

/** Every object in a layout, with the ones it sits in. */
function eachPart(value: unknown, visit: (part: Json, above: Json[]) => void, above: Json[] = []): void {
  if (Array.isArray(value)) return value.forEach((item) => eachPart(item, visit, above));
  if (!value || typeof value !== 'object') return;
  const part = value as Json;
  visit(part, above);
  for (const [key, inner] of Object.entries(part)) if (key !== 'validate' && key !== 'options') eachPart(inner, visit, [...above, part]);
}

/**
 * The page as one sample checks it: the field's place with only these rules,
 * shown whatever its conditions or those of what holds it say, and the
 * field's other places with no rules of their own.
 */
function variantOf(page: Page, nodeId: string, field: string, rules: AnswerRule[]): Page {
  const copy = JSON.parse(JSON.stringify(page)) as Page;
  eachPart(copy.layout, (part, above) => {
    if (part['type'] !== 'field' || part['field'] !== field) return;
    if (part['id'] !== nodeId) return void delete part['validate'];
    part['validate'] = rules;
    for (const shown of [part, ...above]) delete shown['invisible'];
  });
  return copy;
}

/** Fieldia's own words for a language tag: the language's when it has them, else English. */
const localeOf = (tag: string): Locale => {
  const base = tag.split('-')[0];
  return (Object.prototype.hasOwnProperty.call(MESSAGES, base) ? base : 'en') as Locale;
};

/**
 * What the form says of values for one field's place, in a language: its own
 * checks first, then each answer rule that speaks, in order. Each rule is
 * checked alone and read as a warning, so the field's own checks never hide
 * it — the form words a rule's message the same at either level.
 */
export function sampleChecker(page: Page, nodeId: string, tag: string, now?: () => Date): (values: Values) => SampleResult[] {
  const found = findNode(page, nodeId)?.node;
  if (found?.type !== 'field') return () => [];
  const { field } = found;
  const rules = found.validate ?? [];
  const messages = MESSAGES[localeOf(tag)];
  const own = localizePage(variantOf(page, nodeId, field, []), tag);
  const alone = rules.map((rule) => localizePage(variantOf(page, nodeId, field, [{ ...rule, level: 'warning' }]), tag));
  const ask = <T>(variant: Page, values: Values, read: (form: Form) => T): T | null => {
    try {
      const form = createForm({ page: variant, values, messages, now });
      try {
        return read(form);
      } finally {
        form.dispose();
      }
    } catch {
      return null;
    }
  };
  return (values) => {
    const said: SampleResult[] = [];
    const problem = ask(own, values, (form) => form.problem(field));
    if (problem) said.push({ level: 'error', message: problem, rule: null });
    alone.forEach((variant, index) => {
      const message = ask(variant, values, (form) => form.getState().warnings[field]);
      if (message) said.push({ level: rules[index].level === 'warning' ? 'warning' : 'error', message, rule: index });
    });
    return said;
  };
}

// ---- which fields it takes ------------------------------------------------------------------------

/** Kinds that need the app — its records, its files — to take a value. */
const NEEDS_THE_APP = new Set(['many2one', 'many2many', 'one2many', 'reference', 'binary', 'image', 'properties', 'json']);

/** Why a field cannot take a value here, in words after its name; null when it can. */
function notHere(def: Field): string | null {
  if (def.compute !== undefined) return 'worked out from other answers';
  if (def.type === 'selection' && def.optionsFrom) return 'whose choices come from the app';
  if (def.type === 'binary' || def.type === 'image') return 'which takes files';
  if (NEEDS_THE_APP.has(def.type)) return 'which needs the app’s records';
  return null;
}

/** The other fields the rules read — across fields, in their "only when", in when the field is required — in the order they come. */
function fieldsRead(page: Page, node: FieldNode): string[] {
  const read = new Set<string>();
  const add = (source: unknown) => {
    for (const name of fieldsReadBy(typeof source === 'string' ? source : undefined)) if (name !== node.field && page.fields[name]) read.add(name);
  };
  for (const rule of node.validate ?? []) {
    add(rule.holds);
    add(rule.when);
  }
  add(node.required);
  return [...read];
}

/** The place a field is drawn from: its first on the page, or a plain one when no part shows it. */
function placeOf(page: Page, name: string): FieldNode {
  let place: FieldNode | null = null;
  eachPart(page.layout, (part) => {
    if (!place && part['type'] === 'field' && part['field'] === name) place = part as unknown as FieldNode;
  });
  return place ?? { type: 'field', id: `sample-${name}`, field: name };
}

// ---- the box --------------------------------------------------------------------------------------

let made = 0;

interface Box {
  name: string;
  widget: Widget;
  required: boolean;
}

export function answerSample(el: ElementFactory, nodeId: string, options: SampleOptions = {}): AnswerSample {
  const base = `fd-sample-${++made}`;
  const title = el('span', { class: 'fd-prop-name fd-answer-sample-title', id: `${base}-title` }, 'Try a value');
  const language = el('select', { class: 'fd-input fd-select', 'aria-label': 'Words in' }) as HTMLSelectElement;
  const languageRow = el('label', { class: 'fd-answer-sample-language', hidden: '' }, el('span', { 'aria-hidden': 'true' }, 'Words in'), language);
  const own = el('div', { class: 'fd-answer-sample-boxes' });
  const readsTitle = el('p', { class: 'fd-answer-sample-reads', hidden: '' }, 'The rules also read');
  const others = el('div', { class: 'fd-answer-sample-boxes' });
  const elsewhereWords = el('div', { class: 'fd-answer-sample-elsewhere-words' });
  const tryButton = el('button', { type: 'button', class: 'fd-button fd-button-link fd-answer-sample-try' }, 'Try it');
  const elsewhere = el('div', { class: 'fd-answer-sample-elsewhere', hidden: '' }, elsewhereWords, tryButton);
  const results = el('div', { class: 'fd-answer-sample-results', id: `${base}-results`, 'aria-live': 'polite' });
  const element = el(
    'div',
    { class: 'fd-answer-sample', role: 'group', 'aria-labelledby': title.id, hidden: '' },
    el('div', { class: 'fd-answer-sample-head' }, title, languageRow),
    own,
    readsTitle,
    others,
    elsewhere,
    results
  );
  const doc = element.ownerDocument;
  tryButton.hidden = !options.tryIt;
  tryButton.addEventListener('click', () => options.tryIt?.());
  // Keys pressed in the sample are the sample's: Delete in a rating never takes the field off the page.
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Delete' || event.key === 'Backspace') event.stopPropagation();
  });

  let page: Page | null = null;
  /** The language picked here; the page's own when none is. */
  let picked: string | null = null;
  /** Something was typed or picked: until then the sample says what to do, not a verdict. */
  let touched = false;
  /** What was typed and picked, by field: kept while the boxes are drawn again. */
  let values: Values = {};
  let drawn: { key: string; form: Form; boxes: Box[]; stop: () => void } | null = null;
  let checker: { page: Page; tag: string; check: (values: Values) => SampleResult[] } | null = null;
  let saidKey = '';

  const tagNow = () => picked ?? pageLanguage(page as Page);
  const node = (): FieldNode | null => {
    const found = page ? findNode(page, nodeId)?.node : null;
    return found?.type === 'field' ? found : null;
  };

  language.addEventListener('change', () => {
    picked = language.value || null;
    if (page) update(page);
  });

  /** The boxes, drawn again only when what they draw changed: the fields, their places, the language. */
  function drawBoxes(current: Page, names: string[]) {
    const tag = tagNow();
    const shown = localizePage(current, tag);
    const places = names.map((name) => placeOf(shown, name));
    const strip = ({ validate: _rules, ...place }: FieldNode) => place;
    const key = JSON.stringify([tag, names, places.map(strip), names.map((name) => shown.fields[name])]);
    if (drawn?.key === key) return;
    const kept = drawn ? pick(drawn.form.getState().values, names) : values;
    forget();
    const form = createForm({ page: shown, values: kept });
    const locale = localeOf(tag);
    const boxes = names.map((name, index): Box => {
      const place = places[index];
      const def = shown.fields[name];
      const id = `${base}-${name}`;
      const label = el('label', { class: 'fd-label', id: `${id}-label`, for: id }, place.label ?? def.label);
      const widget = createWidget({ form, name, field: def, node: place, id, document: doc, labels: WIDGET_LABELS[locale], locale }, options.widgets);
      if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(widget.element.tagName)) {
        // A group of choices is named by its label, as the form names it.
        const named = widget.element.getAttribute('role') ? widget.element : widget.element.querySelector(`[id="${id}"][role]`);
        named?.setAttribute('aria-labelledby', label.id);
        label.addEventListener('click', () => widget.focus());
      }
      const wrap = el('div', { class: 'fd-field fd-answer-sample-field', 'data-field': name, 'data-type': def.type }, label, widget.element);
      (index === 0 ? own : others).append(wrap);
      return { name, widget, required: def.required === true || place.required === true };
    });
    const direction = isRightToLeft(tag) ? 'rtl' : null;
    for (const area of [own, others]) {
      area.setAttribute('lang', tag);
      if (direction) area.setAttribute('dir', direction);
      else area.removeAttribute('dir');
    }
    const stop = form.subscribe((state) => {
      touched = true;
      values = pick(state.values, names);
      check(state);
    });
    drawn = { key, form, boxes, stop };
    values = pick(form.getState().values, names);
  }

  /** Say what the form says now, and mark the field's box when it would not send. */
  function check(state: FormState) {
    if (!drawn || !page) return;
    const tag = tagNow();
    if (checker?.page !== page || checker.tag !== tag) checker = { page, tag, check: sampleChecker(page, nodeId, tag, options.now) };
    const said = touched ? checker.check(values) : null;
    const stops = !!said?.some((result) => result.level === 'error');
    drawn.boxes.forEach((box, index) => {
      box.widget.update({
        value: state.values[box.name],
        values: state.values,
        readonly: false,
        required: box.required,
        invalid: index === 0 && stops,
        describedBy: index === 0 ? results.id : undefined,
      });
    });
    say(said, tag);
  }

  function say(said: SampleResult[] | null, tag: string) {
    const key = JSON.stringify([said, tag]);
    if (key === saidKey) return;
    saidKey = key;
    const line = (level: string, mark: string, words: Node, tag?: string) =>
      el('p', { class: 'fd-answer-sample-result', 'data-level': level }, ...(mark ? [el('span', { class: 'fd-answer-sample-mark', 'aria-hidden': 'true' }, mark)] : []), words, ...(tag ? [el('span', { class: 'fd-answer-sample-tag' }, tag)] : []));
    if (said === null) return results.replaceChildren(line('idle', '', el('span', { class: 'fd-answer-sample-message' }, 'Type or pick an answer to see what the form says.')));
    if (!said.length) return results.replaceChildren(line('pass', '✓', el('span', { class: 'fd-answer-sample-message' }, 'Passes')));
    results.replaceChildren(
      ...said.map((result) => {
        const words = el('span', { class: 'fd-answer-sample-message', lang: tag, dir: isRightToLeft(tag) ? 'rtl' : 'ltr' }, result.message);
        return result.level === 'error' ? line('error', '×', words, 'Stops sending') : line('warning', '!', words, 'Still sends');
      })
    );
  }

  /** Fields named, each with why it cannot take a value here. */
  function sayElsewhere(current: Page, names: string[], ownField: boolean) {
    const tag = tagNow();
    const shown = localizePage(current, tag);
    const lines = names.map((name) => {
      const def = shown.fields[name];
      const label = placeOf(shown, name).label ?? def.label;
      const why = notHere(def) as string;
      return el('p', {}, ownField ? `${label}, ${why}: try its rules with the whole form.` : `Also reads ${label}, ${why}: try it with the whole form.`);
    });
    elsewhereWords.replaceChildren(...lines);
    elsewhere.hidden = !lines.length;
  }

  function forget() {
    if (!drawn) return;
    drawn.stop();
    for (const box of drawn.boxes) box.widget.destroy?.();
    drawn.form.dispose();
    drawn = null;
    own.replaceChildren();
    others.replaceChildren();
  }

  function update(next: Page) {
    page = next;
    const place = node();
    const def = place ? next.fields[place.field] : undefined;
    element.hidden = !place || !def || !place.validate?.length;
    if (element.hidden || !place || !def) return;
    // The page's languages, when it keeps any: its rules' messages are said in the one picked.
    const languages = languagesOf(next);
    if (picked && !languages.includes(picked)) picked = null;
    languageRow.hidden = !languages.length;
    const choices = JSON.stringify([pageLanguage(next), languages]);
    if (language.dataset['choices'] !== choices) {
      language.dataset['choices'] = choices;
      language.replaceChildren(el('option', { value: '' }, `${languageName(pageLanguage(next))}, as written`), ...languages.map((tag) => el('option', { value: tag }, languageName(tag))));
    }
    language.value = picked ?? '';
    // The field itself cannot take a value here: said, with Try it.
    if (notHere(def)) {
      forget();
      readsTitle.hidden = true;
      results.replaceChildren();
      saidKey = '';
      sayElsewhere(next, [place.field], true);
      return;
    }
    const read = fieldsRead(next, place);
    const boxed = read.filter((name) => !notHere(next.fields[name]));
    readsTitle.hidden = !boxed.length;
    sayElsewhere(next, read.filter((name) => notHere(next.fields[name])), false);
    drawBoxes(next, [place.field, ...boxed]);
    if (drawn) check(drawn.form.getState());
  }

  return {
    element,
    update,
    destroy: forget,
  };
}

/** Some of the values, by name. */
function pick(values: Readonly<Values>, names: string[]): Values {
  return Object.fromEntries(names.filter((name) => name in values).map((name) => [name, values[name]]));
}
