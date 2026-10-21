import type { ListNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { detailColumns } from './list-work-commands';

const listOf = (page: Page) => page.layout as ListNode;
/** The page's fields, then the model's not on it yet: a table of lines no column shows is offered too. */
const fieldsOf = (page: Page, designer: Designer) => {
  const own = Object.entries(page.fields).map(([name, field]) => ({ name, field }));
  return [...own, ...designer.modelFields().filter(({ name }) => !page.fields[name])];
};

/**
 * A list's rows a person works in, in its panel, under a heading of their own: what a row opens to in place — one of the
 * page's tables of lines, its first plain fields as columns (the JSON says more: the records pointing at a row, its
 * columns, order and page).
 */
export function workSection(el: ElementFactory, designer: Designer) {
  const w = designer.words.list.work;
  const opens = el('select', { class: 'fd-input fd-select', 'aria-label': w.opensTo }) as HTMLSelectElement;
  opens.addEventListener('change', () => {
    const def = opens.value ? fieldsOf(designer.getPage(), designer).find(({ name }) => name === opens.value)?.field : undefined;
    // Back as it was where the change is refused: the panel shows what the page says.
    if (!designer.setListOptions({ detail: def ? { lines: opens.value, columns: detailColumns(def) } : null })) opens.value = listOf(designer.getPage()).detail?.lines ?? '';
  });
  const opensRow = el('label', { class: 'fd-prop', 'data-part': 'detail' }, el('span', { class: 'fd-prop-name' }, w.opensTo), opens, el('span', { class: 'fd-properties-hint' }, w.opensToHint));
  const element = el('div', { class: 'fd-prop', 'data-part': 'work' }, el('span', { class: 'fd-prop-name' }, w.title), opensRow);
  return {
    element,
    update(page: Page) {
      const list = listOf(page);
      const lines = fieldsOf(page, designer).filter(({ field }) => field.type === 'one2many');
      // Records pointing at a row: said by the JSON alone, and kept as it is.
      const own = list.detail && !list.detail.lines ? [el('option', { value: '' }, w.opensToRecords)] : [];
      opens.replaceChildren(...(own.length ? own : [el('option', { value: '' }, w.opensToNothing)]), ...lines.map(({ name, field }) => el('option', { value: name }, field.label)));
      opens.value = list.detail?.lines ?? '';
      opensRow.hidden = !lines.length && !list.detail;
      element.hidden = opensRow.hidden;
    },
  };
}
