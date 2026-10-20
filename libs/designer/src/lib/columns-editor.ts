import { optionsList, type Field, type OptionsFromList, type Option } from '@fieldia/core';
import { iconButton, type ElementFactory } from './chrome';
import { columnKind, type Designer, type LineColumn } from './designer';
import { lineOptionWhen, type LineOptionWhen } from './option-when';

const KINDS: Exclude<LineColumn['kind'], 'other'>[] = ['text', 'number', 'date', 'yes-no', 'choice'];

let sources = 0;

/**
 * A table of lines' columns in the properties panel: a label and a kind for
 * each, one to take away, and one more to add. A column of a type it does
 * not offer, such as a link, keeps its type and shows it as "Other". A choice
 * column has its choices under it: written here — each with "Show when…", a
 * condition on the line's other columns or the record's fields — or one of the
 * app's lists, changing with the line's other columns or the record's fields.
 */
export function columnsEditor(el: ElementFactory, designer: Designer, nodeId: string) {
  const w = designer.words.questions;
  const list = el('ul', { class: 'fd-columns' });
  const add = el('button', { type: 'button', class: 'fd-button fd-button-link', 'data-add-column': '' }, w.addColumn);
  const element = el('div', { class: 'fd-columns-box' }, el('span', { class: 'fd-prop-name' }, w.columns), list, add);
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const read = (): LineColumn[] =>
    [...list.children].map((row) => ({
      name: (row as HTMLElement).dataset['name'] || undefined,
      label: (row.querySelector('input') as HTMLInputElement).value,
      kind: (row.querySelector('select') as HTMLSelectElement).value as LineColumn['kind'],
    }));
  add.addEventListener('click', () => {
    const current = read();
    designer.setLineColumns(nodeId, [...current, { label: designer.words.defaults.column(current.length + 1), kind: 'text' }]);
    (list.lastElementChild?.querySelector('input') as HTMLInputElement | null)?.focus();
  });
  /** A choice column's choices, by its row: made as a column becomes a choice, gone as it stops being one. */
  const boxes = new Map<Element, ReturnType<typeof choicesBox>>();

  return {
    element,
    update(field: Field) {
      const columns = field.type === 'one2many' ? Object.entries(field.fields) : null;
      element.hidden = !columns;
      if (!columns) return;
      while (list.children.length > columns.length) {
        boxes.delete(list.lastElementChild as Element);
        list.lastElementChild?.remove();
      }
      while (list.children.length < columns.length) {
        const index = list.children.length + 1;
        const input = el('input', { class: 'fd-input', 'aria-label': w.column(index) });
        input.addEventListener('input', () => designer.setLineColumns(nodeId, read()));
        const kind = el('select', { class: 'fd-input fd-select', 'aria-label': w.kindOfColumn(index) }, ...KINDS.map((value) => el('option', { value }, w.columnKinds[value])), el('option', { value: 'other', hidden: '' }, w.columnKinds.other));
        kind.addEventListener('change', () => designer.setLineColumns(nodeId, read()));
        const remove = iconButton(el, w.removeColumn, '×', () => {
          const current = read();
          current.splice([...list.children].indexOf(remove.parentElement as Element), 1);
          designer.setLineColumns(nodeId, current);
        });
        list.append(el('li', { class: 'fd-column' }, input, kind, remove));
      }
      columns.forEach(([name, def], i) => {
        const row = list.children[i] as HTMLElement;
        row.dataset['name'] = name;
        const input = row.querySelector('input') as HTMLInputElement;
        if (!focused(input)) input.value = def.label;
        (row.querySelector('select') as HTMLSelectElement).value = columnKind(def);
        const remove = row.querySelector('button') as HTMLButtonElement;
        remove.setAttribute('aria-label', w.removeColumnNamed(def.label));
        remove.title = w.removeColumnNamed(def.label);
        remove.hidden = columns.length === 1;
        let box = boxes.get(row);
        if (def.type === 'selection' && !box) {
          box = choicesBox(el, designer, nodeId, () => row.dataset['name'] ?? '');
          boxes.set(row, box);
          row.append(box.element);
        } else if (def.type !== 'selection' && box) {
          box.element.remove();
          boxes.delete(row);
          box = undefined;
        }
        box?.update(field as Extract<Field, { type: 'one2many' }>, name);
      });
    },
  };
}

/**
 * A choice column's choices, under its row: written here — each option's words, one to add, one to take away, and when
 * it shows on a line (`lineOptionWhen`) — or from one of the app's lists, by its name, and the line's other columns or
 * the record's fields they change with.
 */
function choicesBox(el: ElementFactory, designer: Designer, nodeId: string, column: () => string) {
  const w = designer.words.questions;
  const o = designer.words.options;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const set = (choices: { labels?: string[]; from?: OptionsFromList | null }) => designer.setColumnChoices(nodeId, column(), choices);
  const name = `fd-column-source-${++sources}`;
  const written = el('input', { type: 'radio', name, value: 'written' }) as HTMLInputElement;
  const listed = el('input', { type: 'radio', name, value: 'list' }) as HTMLInputElement;
  const source = el('div', { class: 'fd-q-source', role: 'radiogroup' }, el('label', { class: 'fd-q-source-pick' }, written, w.writtenHere), el('label', { class: 'fd-q-source-pick' }, listed, w.fromAppList));
  // Written here: each option's words.
  const items = el('ul', { class: 'fd-kind-items' });
  const labels = () => [...items.querySelectorAll('input')].map((input) => input.value);
  const focusAt = (index: number) => (items.querySelectorAll('input')[index] as HTMLInputElement | undefined)?.focus();
  const addOption = el('button', { type: 'button', class: 'fd-button fd-button-link', 'data-add-option': '' }, o.addOption);
  addOption.addEventListener('click', () => {
    const now = labels();
    if (set({ labels: [...now, designer.words.defaults.option(now.length + 1)] })) focusAt(now.length);
  });
  const writtenBox = el('div', { class: 'fd-column-written' }, items, addOption);
  // From the app's list: its name, and what it changes with.
  const pick = el('select', { class: 'fd-input', 'aria-label': w.listWord }) as HTMLSelectElement;
  const typed = el('input', { class: 'fd-input', 'aria-label': w.listName, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const depends = el('div', { class: 'fd-q-depends-boxes' });
  const none = el('p', { class: 'fd-q-list-note' }, w.noOtherFields);
  const listBox = el(
    'div',
    { class: 'fd-q-list' },
    el('label', { class: 'fd-q-list-name' }, el('span', {}, w.listWord), pick, typed),
    el('fieldset', { class: 'fd-q-depends' }, el('legend', {}, w.changesWith), depends, none),
    el('p', { class: 'fd-q-list-note' }, w.columnListNote)
  );
  const element = el('div', { class: 'fd-column-choices' }, source, writtenBox, listBox);
  let from: OptionsFromList | undefined;
  written.addEventListener('change', () => set({ from: null }));
  listed.addEventListener('change', () => set({ from: { list: designer.lists()[0]?.name ?? 'choices' } }));
  pick.addEventListener('change', () => from && set({ from: { ...from, list: pick.value } }));
  // An emptied box waits for a name: the list keeps the one it had.
  typed.addEventListener('input', () => from && typed.value.trim() && set({ from: { ...from, list: typed.value.trim() } }));
  depends.addEventListener('change', () => from && set({ from: { list: from.list, dependsOn: [...depends.querySelectorAll<HTMLInputElement>('input:checked')].map((box) => box.value) } }));
  let drawn = '';
  /** Each option row's "Show when…", by its row. */
  const whens = new WeakMap<Element, LineOptionWhen>();

  /** The options' boxes, as many as the options, each with its words and when it shows on a line. */
  function drawOptions(options: Option[], lines: Extract<Field, { type: 'one2many' }>, own: string) {
    while (items.children.length > options.length) items.lastElementChild?.remove();
    while (items.children.length < options.length) {
      const index = items.children.length;
      const input = el('input', { class: 'fd-inline-input fd-kind-item', 'aria-label': o.option(index + 1), autocomplete: 'off' }) as HTMLInputElement;
      // Emptied while typed in, it stays until the cursor leaves; then it goes.
      input.addEventListener('input', () => input.value.trim() && set({ labels: labels() }));
      input.addEventListener('change', () => !input.value.trim() && set({ labels: labels() }));
      const remove = iconButton(el, o.removeOption, '×', () => {
        const now = labels();
        now.splice(index, 1);
        set({ labels: now });
      });
      const when = lineOptionWhen(el, designer);
      const row = el('li', { class: 'fd-kind-item-row' }, input, remove, when.button, when.box);
      whens.set(row, when);
      items.append(row);
    }
    const page = designer.getPage();
    options.forEach((option, i) => {
      const row = items.children[i] as HTMLElement;
      const input = row.querySelector('input') as HTMLInputElement;
      if (!focused(input)) input.value = option.label;
      const remove = row.querySelector(':scope > .fd-icon-button') as HTMLButtonElement;
      remove.setAttribute('aria-label', o.removeNamed(option.label));
      remove.title = remove.getAttribute('aria-label') ?? '';
      remove.hidden = options.length === 1;
      whens.get(row)?.update(page, lines, nodeId, own, i);
    });
  }

  return {
    element,
    update(lines: Extract<Field, { type: 'one2many' }>, own: string) {
      const def = lines.fields[own];
      if (def?.type !== 'selection') return;
      source.setAttribute('aria-label', w.choicesOfColumn(def.label));
      from = optionsList(def.optionsFrom);
      written.checked = !from;
      listed.checked = !!from;
      writtenBox.hidden = !!from;
      listBox.hidden = !from;
      if (!from) return drawOptions(def.options, lines, own);
      const lists = designer.lists();
      // A name the app does not list, from a page written by hand, stays offered.
      const offered = lists.some((l) => l.name === from?.list) || !lists.length ? lists : [...lists, { name: from.list, label: from.list }];
      pick.hidden = !lists.length;
      typed.hidden = !!lists.length;
      // The line's other columns, then the record's fields (`parent.`), as their labels say them.
      const page = designer.getPage();
      const others = [
        ...Object.entries(lines.fields)
          .filter(([name]) => name !== own)
          .map(([name, f]) => [name, f.label || name] as const),
        ...Object.entries(page.fields)
          .filter(([, f]) => f.type !== 'one2many')
          .map(([name, f]) => [`parent.${name}`, w.ofTheRecord(f.label || name)] as const),
      ];
      const key = JSON.stringify([offered, others]);
      if (key !== drawn) {
        drawn = key;
        pick.replaceChildren(...offered.map((l) => el('option', { value: l.name }, l.label)));
        depends.replaceChildren(...others.map(([name, label]) => el('label', { class: 'fd-q-depends-pick' }, el('input', { type: 'checkbox', value: name }), label)));
      }
      pick.value = from.list;
      if (!focused(typed)) typed.value = from.list;
      for (const box of depends.querySelectorAll<HTMLInputElement>('input')) box.checked = !!from.dependsOn?.includes(box.value);
      none.hidden = others.length > 0;
    },
  };
}
