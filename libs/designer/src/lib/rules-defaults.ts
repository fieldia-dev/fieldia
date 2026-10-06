import type { Field, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { findNode } from './page-tree';
import { formulaBox } from './rules-formula-box';
import { formulaProblem } from './rules-formula';
import { stepMap } from './steps-map';

/**
 * Where a value starts, as Flectra's context defaults: "Starts with" — a
 * field's first value on a new record, `user` for the person using it — and
 * for a table of lines what each new line starts with, and for a link what a
 * record made from it starts with. Each on the Rules tab, each one undo step.
 */

interface Own {
  name: string;
  def: Field;
}

function ownOf(page: Page, id: string): Own | null {
  const found = findNode(page, id)?.node;
  if (found?.type !== 'field' || !page.fields[found.field]) return null;
  return { name: found.field, def: page.fields[found.field] };
}

/** The kinds that cannot start from a formula: lines, files, grids of answers, properties. */
const NO_START = new Set(['one2many', 'binary', 'image', 'matrix', 'properties']);

export interface DefaultsSetting {
  rows: HTMLElement[];
  update(page: Page): void;
}

export function defaultsSettings(el: ElementFactory, designer: Designer, id: string): DefaultsSetting {
  const words = designer.words;
  const w = words.rulesUi;
  let own: Own | null = null;

  // ---- Starts with: a new record's first value ----
  const box = formulaBox(el, {
    words,
    label: w.startsWith,
    placeholder: w.startsWithPlaceholder,
    check: (page, source) => formulaProblem(page, source, words),
    commit(source) {
      if (source === (own?.def.defaultFrom ?? '')) return;
      designer.setDefaultFrom(id, source || null);
    },
  });
  const startsHint = el('p', { class: 'fd-properties-hint fd-set-hint' }, w.startsWithHint);
  const starts = el('div', { class: 'fd-prop fd-starts-with', 'data-tab': 'rules', 'data-setting': 'Starts with' }, el('span', { class: 'fd-prop-name' }, w.startsWith), box.element, box.problem, startsHint);

  // ---- A table of lines: what a new line starts with ----
  const lineDefaults = stepMap(el, {
    words,
    label: w.newLinesStartWith,
    addWords: words.steps.addValue,
    nameLabel: words.steps.itsField,
    names: () => (own?.def.type === 'one2many' ? Object.entries(own.def.fields).map(([value, def]) => ({ value, label: def.label || value })) : null),
    valueLabel: (name) => words.steps.valueFrom(name),
    reads: () => designer.getPage(),
    commit: (map) => designer.setLineDefaults(id, map),
  });
  const lines = el('div', { class: 'fd-prop', 'data-tab': 'rules', 'data-setting': 'New lines start with' }, lineDefaults.element);

  // ---- A link: what a record made from it starts with ----
  const createValues = stepMap(el, {
    words,
    label: w.madeStartsWith,
    addWords: words.steps.addValue,
    nameLabel: words.steps.itsField,
    // The other record's fields are the app's: typed by their names.
    names: () => null,
    valueLabel: (name) => words.steps.valueFrom(name),
    reads: () => designer.getPage(),
    commit: (map) => designer.setCreateValues(id, map),
  });
  const made = el('div', { class: 'fd-prop', 'data-tab': 'rules', 'data-setting': 'A record made from it starts with' }, createValues.element, el('p', { class: 'fd-properties-hint fd-set-hint' }, w.madeStartsWithHint));

  return {
    rows: [starts, lines, made],
    update(page) {
      own = ownOf(page, id);
      const fromModel = designer.isFromModel(id);
      starts.hidden = !own || NO_START.has(own.def.type) || !!own.def.compute || fromModel;
      if (!starts.hidden && own) box.update(page, own.def.defaultFrom ?? '');
      lines.hidden = own?.def.type !== 'one2many' || fromModel;
      if (!lines.hidden && own?.def.type === 'one2many') lineDefaults.update(own.def.lineDefaults ?? {});
      const link = own?.def.type === 'many2one' || own?.def.type === 'many2many';
      made.hidden = !link || fromModel;
      if (!made.hidden && (own?.def.type === 'many2one' || own?.def.type === 'many2many')) createValues.update(own.def.createValues ?? {});
    },
  };
}
