import type { Field, FieldNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { findNode } from './page-tree';

/**
 * In a choice's options editor: whether its options are written here or come
 * from one of the app's lists — which list, a select of those the app names
 * or a box for a name, and the fields the list changes with.
 */

let sources = 0;

/** A choice's options as one of the app's lists: whether they are, which list, and the fields it changes with. */
export function listSource(el: ElementFactory, designer: Designer, nodeId: string) {
  // A name of its own: the canvas and the panel may both show this question's options.
  const name = `fd-q-source-${++sources}`;
  const written = el('input', { type: 'radio', name, value: 'written' });
  const listed = el('input', { type: 'radio', name, value: 'list' });
  const element = el(
    'div',
    { class: 'fd-q-source', role: 'radiogroup', 'aria-label': 'Choices' },
    el('span', { class: 'fd-q-source-words', 'aria-hidden': 'true' }, 'Choices'),
    el('label', { class: 'fd-q-source-pick' }, written, 'Written here'),
    el('label', { class: 'fd-q-source-pick' }, listed, 'From the app’s list')
  );
  const pick = el('select', { class: 'fd-input', 'aria-label': 'List' });
  const typed = el('input', { class: 'fd-input', 'aria-label': 'List name', autocomplete: 'off', spellcheck: 'false' });
  const depends = el('div', { class: 'fd-q-depends-boxes' });
  const none = el('p', { class: 'fd-q-list-note' }, 'No other fields on the page yet.');
  const list = el(
    'div',
    { class: 'fd-q-list', hidden: '' },
    el('label', { class: 'fd-q-list-name' }, el('span', {}, 'List'), pick, typed),
    el('fieldset', { class: 'fd-q-depends' }, el('legend', {}, 'Changes with'), depends, none),
    el('p', { class: 'fd-q-list-note' }, 'The app gives these choices as the form opens, and again when a field they change with changes.')
  );
  /** The choice's own field, and its list as the page has it now. */
  const own = () => {
    const found = findNode(designer.getPage(), nodeId);
    const field = found?.node.type === 'field' ? designer.getPage().fields[found.node.field] : undefined;
    return { name: (found?.node as FieldNode | undefined)?.field, from: field?.type === 'selection' ? field.optionsFrom : undefined, label: field?.label ?? '' };
  };
  const set = (patch: { list?: string; dependsOn?: string[] }) => {
    const from = own().from;
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
  return {
    element,
    list,
    /** Show the choice's source; true when its options come from a list. */
    update(field: Field, node?: FieldNode): boolean {
      const from = field.type === 'selection' ? field.optionsFrom : undefined;
      element.hidden = field.type !== 'selection' || designer.isFromModel(nodeId);
      written.checked = !from;
      listed.checked = !!from;
      list.hidden = !from;
      if (!from) return false;
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
