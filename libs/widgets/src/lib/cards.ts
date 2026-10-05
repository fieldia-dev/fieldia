import type { Field, FieldNode, Line, LineField } from '@fieldia/core';
import { announcer, describeState, fillIn, maker, wordsFor } from './kind-parts';
import { moveLineTo } from './line-moves';
import { lineForm } from './lines';
import { createWidget, type Widget, type WidgetFactory } from './widgets';

/**
 * A repeating group on a one2many (`one2many.cards`): each line a small card
 * of the lines' fields, one under another, its title numbered ("Guest 2",
 * from `options.itemLabel`, or "Entry 2"). "Add another" (`options.addLabel`)
 * adds a card and puts the cursor in its first field; × takes one away, the
 * cursor going to the card that took its place, and the removal is said
 * aloud. `options.min` cards at least — a new form starts with them — and
 * `options.max` at most. ↑ and ↓ move a card, where it went said aloud; Copy puts a copy of a card, its answers too,
 * right after it.
 */

interface Card {
  element: HTMLElement;
  title: HTMLElement;
  remove: HTMLButtonElement;
  /** Up, down and Copy, by their label in `words`. */
  tools: [HTMLButtonElement, 'moveUp' | 'moveDown' | 'copy'][];
  fields: { name: string; def: LineField; widget: Widget; error: HTMLElement }[];
}

const count = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined);

export const cardsWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale, dialogs }) => {
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const def = field as Extract<Field, { type: 'one2many' }>;
  const options = node.options ?? {};
  const min = count(options['min']) ?? 0;
  const max = count(options['max']) ?? Infinity;
  const itemLabel = typeof options['itemLabel'] === 'string' && options['itemLabel'].trim() ? options['itemLabel'].trim() : null;
  const titleOf = (n: number) => (itemLabel ? `${itemLabel} ${n}` : fillIn(words.entry, { n }));
  // The fields that keep the lines' order or say what a line is are not asked for.
  const names = (node.columns ?? Object.keys(def.fields)).filter((f) => def.fields[f] && f !== def.sequenceField && f !== def.lineKinds?.field);

  const list = make('div', { class: 'fd-repeat-list' });
  const addButton = make('button', { type: 'button', class: 'fd-button fd-repeat-add' }, typeof options['addLabel'] === 'string' && options['addLabel'] ? options['addLabel'] : words.addAnother);
  const voice = announcer(make);
  const element = make('div', { id, class: 'fd-repeat', role: 'group' }, list, addButton, voice.element);

  const cards = new Map<string, Card>();
  const lines = () => (form.getState().values[name] as Line[] | null) ?? [];
  let readonly = false;
  /** Where the cursor goes once the cards are drawn again. */
  let focusNext: (() => void) | null = null;

  // A new form starts with the cards it needs at least.
  for (let have = lines().length; have < min; have++) form.addLine(name);

  addButton.addEventListener('click', () => {
    if (readonly || lines().length >= max) return;
    const key = form.addLine(name);
    focusNext = () => cards.get(key)?.fields[0]?.widget.focus();
    settle();
  });

  function makeCard(line: Line): Card {
    const titleId = `${id}-${line.key}-title`;
    const title = make('span', { id: titleId, class: 'fd-repeat-title' });
    const remove = make('button', { type: 'button', class: 'fd-repeat-remove' }, '×');
    const tool = (text: string, word: 'moveUp' | 'moveDown' | 'copy', act: () => void): [HTMLButtonElement, typeof word] => {
      const button = make('button', { type: 'button', class: 'fd-repeat-tool' }, text);
      button.addEventListener('click', act);
      return [button, word];
    };
    const at = () => lines().findIndex((l) => l.key === line.key);
    const tools = [tool('↑', 'moveUp', () => move(line.key, at() - 1)), tool('↓', 'moveDown', () => move(line.key, at() + 1)), tool('⧉', 'copy', () => copy(line.key))];
    const body = make('div', { class: 'fd-repeat-fields' });
    const cardElement = make('div', { class: 'fd-repeat-card', role: 'group', 'aria-labelledby': titleId, 'data-line': line.key }, make('div', { class: 'fd-repeat-head' }, title, ...tools.map(([b]) => b), remove), body);
    const fields = names.map((column) => {
      const sub = def.fields[column];
      const cellId = `${id}-${line.key}-${column}`;
      const subNode: FieldNode = { type: 'field', id: `${node.id}.${line.key}.${column}`, field: column };
      const widget = createWidget({ form: lineForm(form, name, line.key), name: column, field: sub as Field, node: subNode, id: cellId, document, labels, locale, dialogs });
      const label = make('label', { class: 'fd-repeat-label', for: cellId }, sub.label);
      if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(widget.element.tagName)) label.addEventListener('click', () => widget.focus());
      const error = make('div', { class: 'fd-cell-error', hidden: '' });
      body.append(make('div', { class: 'fd-repeat-field' }, label, widget.element, error));
      return { name: column, def: sub, widget, error };
    });
    remove.addEventListener('click', () => {
      const all = lines();
      const at = all.findIndex((l) => l.key === line.key);
      if (readonly || at === -1 || all.length <= min) return;
      const gone = title.textContent ?? '';
      form.removeLine(name, line.key);
      voice.say(fillIn(words.removed, { name: gone }));
      // The card that took its place, else the one before, else "Add another".
      const after = lines();
      const next = after[Math.min(at, after.length - 1)];
      focusNext = () => (next ? cards.get(next.key)?.fields[0]?.widget.focus() : addButton.focus());
      settle();
    });
    return { element: cardElement, title, remove, tools, fields };
  }

  /** A card to another place, the focus kept on what had it, and where it went said aloud. */
  function move(key: string, to: number) {
    const from = lines().findIndex((l) => l.key === key);
    if (readonly || to < 0 || to >= lines().length || to === from) return;
    const gone = cards.get(key)?.title.textContent ?? '';
    moveLineTo(form, name, def, key, to);
    // The focus stays on the button pressed; at an end, the other way takes it.
    const way = (from > to && to > 0) || to === lines().length - 1 ? 0 : 1;
    cards.get(key)?.tools[way][0].focus();
    voice.say(fillIn(words.movedTo, { label: gone, n: to + 1, total: lines().length }));
  }

  /** A copy of a card, its answers too, right after it, the cursor in its first field. */
  function copy(key: string) {
    const all = lines();
    const at = all.findIndex((l) => l.key === key);
    if (readonly || at < 0 || all.length >= max) return;
    const values = { ...all[at].values };
    if (def.sequenceField) delete values[def.sequenceField];
    const made = form.addLine(name, values);
    moveLineTo(form, name, def, made, at + 1);
    cards.get(made)?.fields[0]?.widget.focus();
  }

  function settle() {
    const run = focusNext;
    focusNext = null;
    run?.();
  }

  return {
    element,
    focus: () => ([...cards.values()].find((card) => card.element === list.firstElementChild)?.fields[0]?.widget ?? addButton).focus(),
    update(state) {
      readonly = state.readonly;
      const current = (state.value as Line[] | null) ?? [];
      const errors = form.getState().errors;
      const keep = new Set(current.map((l) => l.key));
      for (const [key, card] of cards) {
        if (keep.has(key)) continue;
        card.element.remove();
        for (const f of card.fields) f.widget.destroy?.();
        cards.delete(key);
      }
      current.forEach((line, index) => {
        let card = cards.get(line.key);
        if (!card) cards.set(line.key, (card = makeCard(line)));
        if (list.children[index] !== card.element) list.insertBefore(card.element, list.children[index] ?? null);
        card.title.textContent = titleOf(index + 1);
        card.remove.setAttribute('aria-label', fillIn(words.remove, { name: card.title.textContent }));
        card.remove.hidden = readonly || current.length <= min;
        for (const [button, word] of card.tools) {
          button.setAttribute('aria-label', fillIn(words[word], { label: card.title.textContent, name: card.title.textContent }));
          button.hidden = readonly || (word === 'moveUp' ? index === 0 : word === 'moveDown' ? index === current.length - 1 : current.length >= max);
        }
        for (const f of card.fields) {
          const message = errors[`${name}.${line.key}.${f.name}`];
          f.error.hidden = !message;
          f.error.textContent = message ?? '';
          f.widget.update({ value: line.values[f.name], values: line.values, readonly: readonly || f.def.readonly === true, required: f.def.required === true, invalid: !!message });
        }
      });
      addButton.hidden = readonly || current.length >= max;
      describeState(element, state);
    },
  };
};
