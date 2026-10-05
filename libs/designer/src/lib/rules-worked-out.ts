import type { Field, FieldNode, Page, SetWhen } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { findNode } from './page-tree';
import { cannotHold } from './rules-commands';
import { formulaBox } from './rules-formula-box';
import { formulaProblem, literalOf, sampleResult, wouldCircle } from './rules-formula';
import { pageRules } from './rules-words';

/**
 * A field's value from others, on the Rules tab. "Worked out from": a
 * formula, typed with the page's fields suggested by their labels, a short
 * list of functions put in where the cursor is, and the result on made-up
 * values; the field is then read-only, which the form already makes it.
 * "Set when…": values set when something holds, each a sentence that opens
 * in place to the value and when, as the answer rules do.
 */

/** The kinds a formula is offered for: numbers, amounts and text. */
const WORKED_OUT = new Set(['char', 'text', 'integer', 'float', 'monetary']);
/** The kinds a value can be set for by a rule: those, choices of one, yes or no, and dates. */
const SET = new Set([...WORKED_OUT, 'selection', 'boolean', 'date', 'datetime']);

/** The functions offered, with where the cursor goes: the first value to type. */
const FUNCTIONS: { name: 'round' | 'min' | 'max' | 'if' | 'abs'; text: string; back: number }[] = [
  { name: 'round', text: 'round(, 2)', back: 4 },
  { name: 'min', text: 'min(, )', back: 3 },
  { name: 'max', text: 'max(, )', back: 3 },
  { name: 'if', text: 'if(, , )', back: 5 },
  { name: 'abs', text: 'abs()', back: 1 },
];

interface Own {
  node: FieldNode;
  name: string;
  def: Field;
}

function ownOf(page: Page, id: string): Own | null {
  const found = findNode(page, id)?.node;
  if (found?.type !== 'field' || !page.fields[found.field]) return null;
  return { node: found, name: found.field, def: page.fields[found.field] };
}

export interface RulesSetting {
  element: HTMLElement;
  update(page: Page): void;
}

// ---- worked out from ------------------------------------------------------------------------------

export function workedOutSetting(el: ElementFactory, designer: Designer, id: string): RulesSetting {
  const words = designer.words;
  const w = words.rulesUi;
  let own: Own | null = null;
  const box = formulaBox(el, {
    words,
    label: w.workedOutFrom,
    placeholder: w.typeAName,
    own: () => own?.name,
    check: (page, source) => formulaProblem(page, source, words) ?? (own && wouldCircle(page, own.name, source) ? { words: wouldCircle(page, own.name, source, words) as string } : null),
    commit(source) {
      const was = own?.def.compute ?? '';
      if (source === was) return;
      designer.setCompute(id, source || null);
    },
    said: (page, source) => (own ? sampleResult(page, own.name, source, words) : ''),
  });
  const functions = el(
    'div',
    { class: 'fd-formula-functions', role: 'group', 'aria-label': w.functions },
    ...FUNCTIONS.map((fn) => {
      const button = el('button', { type: 'button', class: 'fd-formula-function', title: w.functionTips[fn.name] }, fn.name);
      // The box keeps its cursor: the function goes in where it was.
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => box.insert(fn.text, fn.back));
      return button;
    })
  );
  const hint = el('p', { class: 'fd-properties-hint fd-set-hint' });
  const element = el('div', { class: 'fd-prop fd-worked-out', 'data-tab': 'rules', 'data-setting': 'Worked out from' }, el('span', { class: 'fd-prop-name' }, w.workedOutFrom), box.element, functions, box.problem, box.result, hint);
  return {
    element,
    update(page) {
      own = ownOf(page, id);
      element.hidden = !own || !WORKED_OUT.has(own.def.type) || designer.isFromModel(id);
      if (!own || element.hidden) return;
      box.update(page, own.def.compute ?? '');
      hint.textContent = own.def.compute ? w.computedHint : w.computeHint;
    },
  };
}

// ---- set when -------------------------------------------------------------------------------------

/** A value as the formula language writes it, from what a control holds; null while it holds nothing. */
function literalFrom(def: Field, raw: string): string | null {
  if (raw === '') return null;
  switch (def.type) {
    case 'boolean':
      return raw === 'True' || raw === 'False' ? raw : null;
    case 'integer':
    case 'float':
    case 'monetary':
      return Number.isFinite(Number(raw)) ? String(Number(raw)) : null;
    case 'selection': {
      const option = def.options.find((o) => String(o.value) === raw);
      if (!option) return null;
      return typeof option.value === 'number' ? String(option.value) : `'${option.value.replace(/'/g, '')}'`;
    }
    default:
      // A quote cannot sit inside text in a formula: it is left out.
      return `'${raw.replace(/'/g, '')}'`;
  }
}

/** What a control shows for a value as written: a literal by its value, anything else as the formula it is. */
function rawFrom(value: string): string {
  const literal = literalOf(value);
  if (!literal) return value;
  if (literal.value === true) return 'True';
  if (literal.value === false) return 'False';
  return literal.value === null ? '' : String(literal.value);
}

export function setWhenSetting(el: ElementFactory, designer: Designer, id: string): RulesSetting {
  const words = designer.words;
  const w = words.rulesUi;
  const list = el('ul', { class: 'fd-answer-rules fd-set-when-list', 'aria-label': w.valuesSetWhen });
  const add = el('button', { type: 'button', class: 'fd-button fd-button-link fd-answer-rules-add' }, w.setWhenAdd);
  const hint = el('p', { class: 'fd-properties-hint fd-set-hint' }, w.setWhenHint);
  const element = el('div', { class: 'fd-prop fd-answer-rules-box fd-set-when', 'data-tab': 'rules', 'data-setting': 'Set when' }, el('span', { class: 'fd-prop-name' }, w.setWhen), list, add, hint);
  let page = designer.getPage();
  let own: Own | null = null;
  let rows: Row[] = [];
  /** A row begun with Set when…, not kept until both its parts read. */
  let drafting = false;

  const stored = (): SetWhen[] => own?.def.setWhen ?? [];

  add.addEventListener('click', () => {
    drafting = true;
    draw();
    rows[rows.length - 1]?.open(true);
    rows[rows.length - 1]?.focusFirst();
  });

  interface Row {
    element: HTMLLIElement;
    kind: string;
    update(item: SetWhen | null): void;
    open(on: boolean): void;
    focusFirst(): void;
  }

  function row(index: number, def: Field, raw: boolean): Row {
    const say = el('button', { type: 'button', class: 'fd-answer-rule-say fd-set-when-say', 'aria-expanded': 'false' });
    const remove = el('button', { type: 'button', class: 'fd-icon-button fd-answer-rule-remove', title: w.remove }, '×');
    const problem = el('p', { class: 'fd-answer-rule-problem', role: 'alert', hidden: '' });
    let value: HTMLInputElement | HTMLSelectElement;
    if (raw) value = el('input', { class: 'fd-input fd-answer-rule-code', 'aria-label': w.setTo, spellcheck: 'false', autocomplete: 'off' });
    else if (def.type === 'selection' || def.type === 'boolean') {
      const options = def.type === 'boolean' ? [{ value: 'True', label: w.yes }, { value: 'False', label: w.no }] : def.options.map((o) => ({ value: String(o.value), label: o.label }));
      value = el('select', { class: 'fd-input fd-select', 'aria-label': w.setTo }, el('option', { value: '' }, w.choose), ...options.map((o) => el('option', { value: o.value }, o.label)));
    } else {
      const type = ['integer', 'float', 'monetary'].includes(def.type) ? 'number' : def.type === 'date' ? 'date' : def.type === 'datetime' ? 'datetime-local' : 'text';
      value = el('input', { class: 'fd-input', type, 'aria-label': w.setTo, autocomplete: 'off' });
    }
    let when = '';
    const whenBox = formulaBox(el, {
      words,
      label: w.when,
      placeholder: w.whenPlaceholder,
      check: (p, source) => formulaProblem(p, source, words),
      commit(source) {
        when = source;
        save();
      },
    });
    const body = el(
      'div',
      { class: 'fd-answer-rule-body', hidden: '' },
      el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, w.setTo), value),
      el('div', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, w.when), whenBox.element, whenBox.problem),
      problem
    );
    const element = el('li', { class: 'fd-answer-rule' }, el('div', { class: 'fd-answer-rule-head' }, say, remove), body);

    /** Kept once both parts read: the value one the field can hold, when a condition that reads. */
    function save() {
      if (!own) return;
      const expression = raw ? value.value.trim() : literalFrom(own.def, value.value);
      const wrong = !expression ? null : raw ? formulaProblem(page, expression, words)?.words ?? null : cannotHold(own.def, own.node.label ?? own.def.label, expression, words);
      problem.textContent = wrong ?? '';
      problem.hidden = !wrong;
      if (!expression || !when || wrong) return;
      const items = [...stored()];
      items[index] = { when, value: expression };
      if (JSON.stringify(items) === JSON.stringify(stored())) return;
      if (designer.setSetWhen(id, items) && index === stored().length - 1) drafting = false;
    }
    value.addEventListener(value.tagName === 'SELECT' ? 'change' : 'input', save);
    say.addEventListener('click', () => open(say.getAttribute('aria-expanded') !== 'true'));
    remove.addEventListener('click', () => {
      if (index >= stored().length) {
        drafting = false;
        draw();
        add.focus();
        return;
      }
      const items = stored().filter((_, i) => i !== index);
      designer.setSetWhen(id, items.length ? items : null);
      add.focus();
    });
    body.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      open(false);
      say.focus();
    });

    function open(on: boolean) {
      if (on) for (const other of rows) if (other.element !== element) other.open(false);
      say.setAttribute('aria-expanded', String(on));
      body.hidden = !on;
      element.classList.toggle('fd-answer-rule-open', on);
    }

    return {
      element,
      kind: raw ? 'raw' : def.type,
      open,
      focusFirst: () => value.focus(),
      update(item) {
        const sentence = item ? (pageRules(page, words).find((r) => r.kind === 'set' && r.field === own?.name && r.index === index)?.sentence ?? '') : w.setToWhen;
        say.textContent = sentence;
        remove.setAttribute('aria-label', item ? w.removeSet(sentence) : w.removeNewRule);
        const doc = element.ownerDocument;
        if (item && doc.activeElement !== value) value.value = rawFrom(item.value);
        if (item) when = item.when;
        whenBox.update(page, item?.when ?? when);
      },
    };
  }

  function draw() {
    if (!own) return;
    const items = stored();
    const count = items.length + (drafting ? 1 : 0);
    const def = own.def;
    rows = Array.from({ length: count }, (_, i) => {
      const item = items[i] ?? null;
      const raw = !!item && literalOf(item.value) === null;
      const kind = raw ? 'raw' : def.type;
      const was = rows[i];
      const view = was && was.kind === kind ? was : row(i, def, raw);
      view.update(item);
      return view;
    });
    rows.forEach((view, i) => {
      if (list.children[i] !== view.element) list.insertBefore(view.element, list.children[i] ?? null);
    });
    while (list.children.length > rows.length) list.lastElementChild?.remove();
    list.hidden = !rows.length;
    add.hidden = drafting || !!def.compute;
  }

  return {
    element,
    update(next) {
      page = next;
      own = ownOf(page, id);
      element.hidden = !own || !SET.has(own.def.type) || (own.def.type === 'selection' && !!own.def.multiple) || designer.isFromModel(id) || (!!own.def.compute && !own.def.setWhen);
      if (!own || element.hidden) return;
      draw();
    },
  };
}
