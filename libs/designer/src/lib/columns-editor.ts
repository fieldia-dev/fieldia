import type { Field } from '@fieldia/core';
import { iconButton, type ElementFactory } from './chrome';
import { columnKind, type Designer, type LineColumn } from './designer';

const KINDS: [LineColumn['kind'], string][] = [
  ['text', 'Text'],
  ['number', 'Number'],
  ['date', 'Date'],
  ['yes-no', 'Yes or no'],
];

/**
 * A table of lines' columns in the properties panel: a label and a kind for
 * each, one to take away, and one more to add. A column of a type it does
 * not offer, such as a link, keeps its type and shows it as "Other".
 */
export function columnsEditor(el: ElementFactory, designer: Designer, nodeId: string) {
  const list = el('ul', { class: 'fd-columns' });
  const add = el('button', { type: 'button', class: 'fd-button fd-button-link' }, 'Add column');
  const element = el('div', { class: 'fd-columns-box' }, el('span', { class: 'fd-prop-name' }, 'Columns'), list, add);
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const read = (): LineColumn[] =>
    [...list.children].map((row) => ({
      name: (row as HTMLElement).dataset['name'] || undefined,
      label: (row.querySelector('input') as HTMLInputElement).value,
      kind: (row.querySelector('select') as HTMLSelectElement).value as LineColumn['kind'],
    }));
  add.addEventListener('click', () => {
    const current = read();
    designer.setLineColumns(nodeId, [...current, { label: `Column ${current.length + 1}`, kind: 'text' }]);
    (list.lastElementChild?.querySelector('input') as HTMLInputElement | null)?.focus();
  });

  return {
    element,
    update(field: Field) {
      const columns = field.type === 'one2many' ? Object.entries(field.fields) : null;
      element.hidden = !columns;
      if (!columns) return;
      while (list.children.length > columns.length) list.lastElementChild?.remove();
      while (list.children.length < columns.length) {
        const index = list.children.length + 1;
        const input = el('input', { class: 'fd-input', 'aria-label': `Column ${index}` });
        input.addEventListener('input', () => designer.setLineColumns(nodeId, read()));
        const kind = el('select', { class: 'fd-input fd-select', 'aria-label': `Kind of column ${index}` }, ...KINDS.map(([value, text]) => el('option', { value }, text)), el('option', { value: 'other', hidden: '' }, 'Other'));
        kind.addEventListener('change', () => designer.setLineColumns(nodeId, read()));
        const remove = iconButton(el, 'Remove column', '×', () => {
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
        remove.setAttribute('aria-label', `Remove column ${def.label}`);
        remove.title = `Remove column ${def.label}`;
        remove.hidden = columns.length === 1;
      });
    },
  };
}
