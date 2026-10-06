import type { Page } from '@fieldia/core';
import { iconButton, type ElementFactory } from './chrome';
import type { DesignerWords } from './designer-words';
import { formulaBox, type FormulaBox } from './rules-formula-box';
import { formulaProblem } from './rules-formula';

/**
 * A small map of names to values, as a step passes them: what a page it
 * opens starts with, where its answers go, a new line's values. Each row is
 * a name — picked from those offered, or typed when none are known — and a
 * value: a formula typed with the fields of the page it reads suggested, or
 * one of a few picked. A row is kept once both read; a row half-made stays
 * here, so the page keeps the last map that did.
 */

export interface MapChoice {
  value: string;
  label: string;
}

export interface StepMapOptions {
  words: DesignerWords;
  /** Its name, for the group and for a screen reader: "It starts with". */
  label: string;
  /** "Add a value". */
  addWords: string;
  /** The names a row can take; null when they are not known, and are typed. */
  names(): MapChoice[] | null;
  /** The words over each name's box. */
  nameLabel: string;
  /** Values picked from a few, when the value is one of them; null for a formula typed. */
  values?(): MapChoice[] | null;
  valueLabel: (name: string) => string;
  /** The page a value's formula reads, for its suggestions and its check. */
  reads(): Page;
  /** The map, as one edit; `typing`: a run of typing in its boxes is one undo step. */
  commit(map: Record<string, string>, typing: boolean): void;
}

export interface StepMap {
  element: HTMLElement;
  update(map: Record<string, string>): void;
}

interface Row {
  element: HTMLElement;
  name(): string;
  value(): string;
  set(name: string, value: string): void;
  focus(): void;
}

export function stepMap(el: ElementFactory, options: StepMapOptions): StepMap {
  const w = options.words.steps;
  const list = el('div', { class: 'fd-do-map-rows' });
  const add = el('button', { type: 'button', class: 'fd-button fd-button-link fd-do-map-add' }, options.addWords);
  const element = el('div', { class: 'fd-do-map', role: 'group', 'aria-label': options.label }, el('span', { class: 'fd-answer-rule-word' }, options.label), list, add);
  let rows: Row[] = [];
  /** The map as kept, to tell a row begun from one kept. */
  let kept: Record<string, string> = {};
  let shape = '';

  /** The rows that read, as a map: a row with no name or no value is not one yet. */
  function read(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const row of rows) {
      const [name, value] = [row.name().trim(), row.value().trim()];
      if (name && value) map[name] = value;
    }
    return map;
  }
  const save = (typing = false) => {
    const map = read();
    if (JSON.stringify(map) !== JSON.stringify(kept)) options.commit(map, typing);
  };

  function row(name: string, value: string): Row {
    const names = options.names();
    const nameBox: HTMLInputElement | HTMLSelectElement = names
      ? el('select', { class: 'fd-input fd-select', 'aria-label': options.nameLabel }, el('option', { value: '' }, w.pick), ...names.map((n) => el('option', { value: n.value }, n.label)))
      : el('input', { class: 'fd-input fd-answer-rule-code', 'aria-label': options.nameLabel, spellcheck: 'false', autocomplete: 'off' });
    nameBox.value = name;
    nameBox.addEventListener(names ? 'change' : 'input', () => {
      named();
      save(!names);
    });
    const values = options.values?.() ?? null;
    let box: FormulaBox | null = null;
    let pick: HTMLSelectElement | null = null;
    let typed = value;
    const valueLabel = () => options.valueLabel(names?.find((n) => n.value === nameBox.value)?.label || nameBox.value || w.value);
    if (values) {
      pick = el('select', { class: 'fd-input fd-select', 'aria-label': valueLabel() }, el('option', { value: '' }, w.pick), ...values.map((v) => el('option', { value: v.value }, v.label)));
      pick.value = value;
      pick.addEventListener('change', () => save());
    } else {
      box = formulaBox(el, {
        words: options.words,
        label: valueLabel(),
        placeholder: w.expressionPlaceholder,
        check: (_page, source) => formulaProblem(options.reads(), source, options.words),
        commit(source) {
          typed = source;
          save(true);
        },
      });
      box.update(options.reads(), value);
    }
    const said = (n: string) => w.removeValue(names?.find((c) => c.value === n)?.label || n || w.value);
    const remove = iconButton(el, said(name), '×', () => {
      rows = rows.filter((r) => r !== made);
      made.element.remove();
      save();
      add.focus();
    });
    remove.classList.add('fd-do-map-remove');
    /** The value's box named after the name it is for, as the name changes. */
    const named = () => (pick ?? box?.input)?.setAttribute('aria-label', valueLabel());
    const element = el('div', { class: 'fd-do-map-row' }, nameBox, ...(pick ? [pick] : box ? [box.element] : []), remove, ...(box ? [box.problem] : []));
    const made: Row = {
      element,
      name: () => nameBox.value,
      value: () => (pick ? pick.value : typed),
      set(n, v) {
        const doc = element.ownerDocument;
        if (doc.activeElement !== nameBox) nameBox.value = n;
        if (pick && doc.activeElement !== pick) pick.value = v;
        if (box) {
          typed = v;
          box.update(options.reads(), v);
        }
        remove.setAttribute('aria-label', said(n));
        remove.title = said(n);
        named();
      },
      focus: () => nameBox.focus(),
    };
    return made;
  }

  add.addEventListener('click', () => {
    // The first name not taken yet, when names are offered.
    const taken = new Set(rows.map((r) => r.name()));
    const free = options.names()?.find((n) => !taken.has(n.value))?.value ?? '';
    const made = row(free, '');
    rows.push(made);
    list.append(made.element);
    made.focus();
  });

  return {
    element,
    update(map) {
      kept = map;
      const entries = Object.entries(map);
      // Drawn again when what is offered changes, or rows were added or taken away elsewhere; else patched, so a box keeps its cursor.
      const offered = JSON.stringify([options.names(), options.values?.() ?? null]);
      const complete = rows.filter((r) => r.name().trim() && r.value().trim());
      if (offered !== shape || complete.length !== entries.length) {
        shape = offered;
        rows = entries.map(([name, value]) => row(name, value));
        list.replaceChildren(...rows.map((r) => r.element));
        return;
      }
      entries.forEach(([name, value], i) => complete[i].set(name, value));
    },
  };
}
