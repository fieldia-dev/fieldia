import { optionsField, optionsList, type Field, type FieldNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { findNode } from './page-tree';

/**
 * In a choice's options editor: whether its options are written here, come
 * from one of the app's lists — which list, a select of those the app names
 * or a box for a name, and the fields the list changes with — or are carried
 * from another choice of the page: the answers picked there, or those not.
 */

let sources = 0;

/** A choice's options as one of the app's lists: whether they are, which list, and the fields it changes with. */
export function listSource(el: ElementFactory, designer: Designer, nodeId: string) {
  // A name of its own: the canvas and the panel may both show this question's options.
  const w = designer.words.questions;
  const name = `fd-q-source-${++sources}`;
  const written = el('input', { type: 'radio', name, value: 'written' });
  const listed = el('input', { type: 'radio', name, value: 'list' });
  const answers = el('input', { type: 'radio', name, value: 'answers' });
  const answersPick = el('label', { class: 'fd-q-source-pick' }, answers, w.fromAnswers);
  const element = el(
    'div',
    { class: 'fd-q-source', role: 'radiogroup', 'aria-label': w.choices },
    el('span', { class: 'fd-q-source-words', 'aria-hidden': 'true' }, w.choices),
    el('label', { class: 'fd-q-source-pick' }, written, w.writtenHere),
    el('label', { class: 'fd-q-source-pick' }, listed, w.fromAppList),
    answersPick
  );
  // Carried from another choice: which, and whether the answers picked there or those not.
  const question = el('select', { class: 'fd-input', 'aria-label': w.carriedFrom });
  const which = el('select', { class: 'fd-input', 'aria-label': w.carriedWhich }, el('option', { value: 'picked' }, w.carriedPicked), el('option', { value: 'unpicked' }, w.carriedUnpicked));
  const carried = el(
    'div',
    { class: 'fd-q-list fd-q-carried', hidden: '' },
    el('label', { class: 'fd-q-list-name' }, el('span', {}, w.carriedFrom), question),
    el('label', { class: 'fd-q-list-name' }, el('span', {}, w.carriedWhich), which),
    el('p', { class: 'fd-q-list-note' }, w.carriedNote)
  );
  /** The page's other choices, which this one may carry its options from. */
  const choicesBeside = () => {
    const page = designer.getPage();
    const own = (findNode(page, nodeId)?.node as FieldNode | undefined)?.field;
    return Object.entries(page.fields).filter(([field, def]) => field !== own && def.type === 'selection');
  };
  const carry = () => designer.setOptionsFrom(nodeId, { field: question.value, ...(which.value === 'unpicked' ? { picked: false } : {}) });
  answers.addEventListener('change', () => {
    const first = choicesBeside()[0];
    if (first) designer.setOptionsFrom(nodeId, { field: first[0] });
  });
  question.addEventListener('change', carry);
  which.addEventListener('change', carry);
  const pick = el('select', { class: 'fd-input', 'aria-label': w.listWord });
  const typed = el('input', { class: 'fd-input', 'aria-label': w.listName, autocomplete: 'off', spellcheck: 'false' });
  const depends = el('div', { class: 'fd-q-depends-boxes' });
  const none = el('p', { class: 'fd-q-list-note' }, w.noOtherFields);
  const list = el(
    'div',
    { class: 'fd-q-list', hidden: '' },
    el('label', { class: 'fd-q-list-name' }, el('span', {}, w.listWord), pick, typed),
    el('fieldset', { class: 'fd-q-depends' }, el('legend', {}, w.changesWith), depends, none),
    el('p', { class: 'fd-q-list-note' }, w.listNote)
  );
  /** The choice's own field, and its list as the page has it now. */
  const own = () => {
    const found = findNode(designer.getPage(), nodeId);
    const field = found?.node.type === 'field' ? designer.getPage().fields[found.node.field] : undefined;
    return { name: (found?.node as FieldNode | undefined)?.field, from: field?.type === 'selection' ? field.optionsFrom : undefined, label: field?.label ?? '' };
  };
  const set = (patch: { list?: string; dependsOn?: string[] }) => {
    const from = optionsList(own().from);
    if (from) designer.setOptionsFrom(nodeId, { ...from, ...patch });
  };
  written.addEventListener('change', () => designer.setOptionsFrom(nodeId, null));
  listed.addEventListener('change', () => {
    // The app's first list, or a name made from the question's words, to be typed over.
    const words = own().label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    designer.setOptionsFrom(nodeId, { list: designer.lists()[0]?.name ?? (words || 'choices') });
  });
  pick.addEventListener('change', () => set({ list: pick.value }));
  // An emptied box waits for a name: the list keeps the one it had.
  typed.addEventListener('input', () => typed.value.trim() && set({ list: typed.value.trim() }));
  depends.addEventListener('change', () => set({ dependsOn: [...depends.querySelectorAll<HTMLInputElement>('input:checked')].map((box) => box.value) }));
  let drawn = '';
  let beside = '';
  /** Carried from another choice: its question and which answers; false when the options are not carried. */
  function drawCarried(field: Field): boolean {
    const from = field.type === 'selection' ? optionsField(field.optionsFrom) : undefined;
    const others = choicesBeside();
    // Offered only where there is a question to carry from.
    answersPick.hidden = !others.length && !from;
    answers.checked = !!from;
    carried.hidden = !from;
    if (!from) return false;
    const key = JSON.stringify(others.map(([name, f]) => [name, f.label]));
    if (key !== beside) {
      beside = key;
      question.replaceChildren(...others.map(([name, f]) => el('option', { value: name }, f.label || name)));
    }
    // A question written by hand that is not a choice here stays shown, as a list's name does.
    if (!others.some(([name]) => name === from.field)) question.append(el('option', { value: from.field }, from.field));
    question.value = from.field;
    which.value = from.picked === false ? 'unpicked' : 'picked';
    return true;
  }
  return {
    element,
    list: el('div', { class: 'fd-q-sources' }, list, carried),
    /** Show the choice's source; true when its options come from a list. Carried ones are followed by those written here. */
    update(field: Field, node?: FieldNode): boolean {
      const from = field.type === 'selection' ? optionsList(field.optionsFrom) : undefined;
      element.hidden = field.type !== 'selection' || designer.isFromModel(nodeId);
      const isCarried = drawCarried(field);
      written.checked = !from && !isCarried;
      listed.checked = !!from;
      list.hidden = !from;
      if (isCarried || !from) return false;
      const lists = designer.lists();
      // A name the app does not list, from a page written by hand, stays offered.
      const offered = lists.some((l) => l.name === from.list) || !lists.length ? lists : [...lists, { name: from.list, label: from.list }];
      pick.hidden = !lists.length;
      typed.hidden = !!lists.length;
      const page = designer.getPage();
      const others = Object.entries(page.fields).filter(([name]) => name !== (node?.field ?? own().name));
      const key = JSON.stringify([offered, others.map(([name, f]) => [name, f.label])]);
      if (key !== drawn) {
        drawn = key;
        pick.replaceChildren(...offered.map((l) => el('option', { value: l.name }, l.label)));
        depends.replaceChildren(...others.map(([name, f]) => el('label', { class: 'fd-q-depends-pick' }, el('input', { type: 'checkbox', value: name }), f.label || name)));
      }
      pick.value = from.list;
      if (typed.ownerDocument.activeElement !== typed) typed.value = from.list;
      for (const box of depends.querySelectorAll<HTMLInputElement>('input')) box.checked = !!from.dependsOn?.includes(box.value);
      none.hidden = others.length > 0;
      return true;
    },
  };
}
