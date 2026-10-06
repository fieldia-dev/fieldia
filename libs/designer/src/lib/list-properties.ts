import type { ButtonNode, Field, FilterCondition, ListNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { DesignerWords } from './designer-words';
import { storedAs } from './kinds';
import { openMenu } from './menu';
import type { PropertiesView } from './screen-properties';
import { whenClicked } from './steps-panel';

/**
 * The panels of a list page: the list's own — the rows a page holds, its
 * order, where the search looks, its named filters and its groupings — a
 * column's, and a button's for the rows chosen.
 */

const prop = (el: ElementFactory, text: string, control: HTMLElement) => el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, text), control);
const select = (el: ElementFactory, label: string, options: [string, string][]) =>
  el('select', { class: 'fd-input fd-select', 'aria-label': label }, ...options.map(([value, text]) => el('option', { value }, text))) as HTMLSelectElement;
const focused = (node: Element) => node.ownerDocument.activeElement === node;
const listOf = (page: Page) => page.layout as ListNode;

/** Fields no list can put in order. */
const UNSORTABLE = new Set(['one2many', 'many2many', 'binary', 'image', 'html', 'json', 'properties']);
/** Fields a list can be grouped by: those whose values repeat. */
const GROUPABLE = new Set(['selection', 'many2one', 'boolean', 'char', 'date', 'datetime', 'integer']);

/** The page's fields first, then the model's not on it yet. */
function everyField(page: Page, designer: Designer): { name: string; field: Field }[] {
  return [...Object.entries(page.fields).map(([name, field]) => ({ name, field })), ...designer.modelFields()];
}

// ---- a filter's one condition ----------------------------------------------------------------

type Test = [FilterCondition['op'], string];

function testsFor(field: Field, words: DesignerWords): Test[] {
  const t = words.list.tests;
  const filled: Test[] = [['set', t.filled], ['notset', t.empty]];
  switch (field.type) {
    case 'selection':
      return [['=', t.is], ['!=', t.isNot], ...filled];
    case 'boolean':
      return [['=', t.is]];
    case 'integer':
    case 'float':
    case 'monetary':
      return [['=', t.is], ['>', t.more], ['<', t.less], ['>=', t.atLeast], ['<=', t.atMost], ...filled];
    case 'date':
    case 'datetime':
      return [['=', t.is], ['>', t.after], ['<', t.before], ...filled];
    case 'char':
    case 'text':
      return [['ilike', t.contains], ['=', t.is], ['!=', t.isNot], ...filled];
    default:
      // A link or a file: whether there is one. The designer knows no record to compare with.
      return filled;
  }
}

function firstValue(field: Field): FilterCondition['value'] {
  if (field.type === 'selection') return field.options[0]?.value ?? '';
  if (field.type === 'boolean') return true;
  if (['integer', 'float', 'monetary'].includes(field.type)) return 0;
  if (field.type === 'date' || field.type === 'datetime') return new Date().toISOString().slice(0, 10);
  return '';
}

function filterRow(el: ElementFactory, designer: Designer, id: string) {
  const w = designer.words.list;
  const name = el('input', { class: 'fd-input', 'aria-label': w.filterName }) as HTMLInputElement;
  name.addEventListener('input', () => designer.updateListFilter(id, { label: name.value }));
  const which = el('select', { class: 'fd-input fd-select', 'aria-label': w.filterField }) as HTMLSelectElement;
  const test = el('select', { class: 'fd-input fd-select', 'aria-label': w.filterTest }) as HTMLSelectElement;
  const valueBox = el('span', { class: 'fd-list-filter-value' });
  const on = el('input', { type: 'checkbox', 'aria-label': w.onWhenOpens }) as HTMLInputElement;
  on.addEventListener('change', () => designer.updateListFilter(id, { on: on.checked }));
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-link fd-button-danger' }, w.remove);
  remove.addEventListener('click', () => designer.removeListFilter(id));
  const byHand = el('p', { class: 'fd-properties-hint', hidden: '' }, w.byHand);
  const condition = el('div', { class: 'fd-list-filter-condition' }, which, test, valueBox);
  const element = el(
    'fieldset',
    { class: 'fd-list-filter', 'data-filter': id },
    name,
    condition,
    byHand,
    el('div', { class: 'fd-list-filter-foot' }, el('label', { class: 'fd-q-required' }, on, el('span', {}, w.onWhenOpens)), remove)
  );

  const page = () => designer.getPage();
  const fieldOf = (n: string) => page().fields[n] ?? designer.modelFields().find((m) => m.name === n)?.field;
  let valueKey = '';
  const save = (patch: Partial<FilterCondition>) => {
    const current = listOf(page()).filters?.find((f) => f.id === id)?.filter[0] as FilterCondition;
    const next = { ...current, ...patch };
    if (next.op === 'set' || next.op === 'notset') delete next.value;
    designer.updateListFilter(id, { filter: [next] });
  };
  which.addEventListener('change', () => {
    const field = fieldOf(which.value);
    if (!field) return;
    const [op] = testsFor(field, designer.words)[0];
    designer.updateListFilter(id, { filter: [op === 'set' ? { field: which.value, op } : { field: which.value, op, value: firstValue(field) }] });
  });
  test.addEventListener('change', () => {
    const current = listOf(page()).filters?.find((f) => f.id === id)?.filter[0] as FilterCondition;
    const field = fieldOf(current.field);
    save({ op: test.value as FilterCondition['op'], ...(current.value === undefined && field ? { value: firstValue(field) } : {}) });
  });

  function valueControl(field: Field, condition: FilterCondition): HTMLElement {
    if (field.type === 'selection' || field.type === 'boolean') {
      const options: [string, string][] = field.type === 'boolean' ? [['true', w.yes], ['false', w.no]] : field.options.map((o) => [String(o.value), o.label]);
      const box = select(el, w.filterValue, options);
      box.value = String(condition.value);
      box.addEventListener('change', () => {
        const picked = field.type === 'boolean' ? box.value === 'true' : field.options.find((o) => String(o.value) === box.value)?.value;
        save({ value: picked });
      });
      return box;
    }
    const numeric = ['integer', 'float', 'monetary'].includes(field.type);
    const kind = numeric ? 'number' : field.type === 'date' || field.type === 'datetime' ? 'date' : 'text';
    const box = el('input', { class: 'fd-input', type: kind, 'aria-label': w.filterValue }) as HTMLInputElement;
    box.value = String(condition.value ?? '');
    box.addEventListener('input', () => {
      if (numeric && box.value.trim() === '') return;
      save({ value: numeric ? Number(box.value) : box.value });
    });
    return box;
  }

  return {
    element,
    update(label: string, items: NonNullable<ListNode['filters']>[number], isOn: boolean) {
      if (!focused(name)) name.value = label;
      on.checked = isOn;
      remove.setAttribute('aria-label', w.removeFilter(label));
      const single = items.filter.length === 1 && !('any' in items.filter[0]) && !('all' in items.filter[0]) ? (items.filter[0] as FilterCondition) : null;
      const field = single ? fieldOf(single.field) : undefined;
      condition.hidden = !single || !field;
      byHand.hidden = !condition.hidden;
      if (!single || !field) return;
      const fields = everyField(page(), designer).filter(({ field: f }) => testsFor(f, designer.words).length > 0 && !['one2many', 'json'].includes(f.type));
      which.replaceChildren(...fields.map(({ name: n, field: f }) => el('option', { value: n }, f.label)));
      which.value = single.field;
      test.replaceChildren(...testsFor(field, designer.words).map(([op, words]) => el('option', { value: op }, words)));
      test.value = single.op;
      const key = `${single.field}:${single.op}`;
      if (key !== valueKey) {
        valueKey = key;
        valueBox.replaceChildren(...(single.op === 'set' || single.op === 'notset' ? [] : [valueControl(field, single)]));
      }
    },
    focus() {
      name.focus();
      name.select();
    },
  };
}

// ---- the list --------------------------------------------------------------------------------

export function listProperties(el: ElementFactory, designer: Designer): PropertiesView {
  const w = designer.words.list;
  const size = el('input', { class: 'fd-input', type: 'number', min: '1', max: '500', placeholder: '40', 'aria-label': w.rowsOnPage }) as HTMLInputElement;
  size.addEventListener('input', () => {
    if (size.value.trim() !== '') designer.setListOptions({ pageSize: Number(size.value) });
  });
  const sortBy = el('select', { class: 'fd-input fd-select', 'aria-label': w.sortedBy }) as HTMLSelectElement;
  const direction = select(el, w.direction, [['asc', w.ascending], ['desc', w.descending]]);
  const saveSort = () => designer.setListOptions({ sort: sortBy.value ? [{ field: sortBy.value, desc: direction.value === 'desc' }] : [] });
  sortBy.addEventListener('change', saveSort);
  direction.addEventListener('change', saveSort);
  const directionRow = prop(el, w.direction, direction);

  const searchBox = el('div', { class: 'fd-list-search-fields' });
  const filtersBox = el('div', { class: 'fd-list-filters' });
  const addFilter = el('button', { type: 'button', class: 'fd-button' }, w.addFilter);
  const rows = new Map<string, ReturnType<typeof filterRow>>();
  addFilter.addEventListener('click', () => {
    const page = designer.getPage();
    const created = designer.addListFilter(w.newFilter, [{ field: listOf(page).columns[0], op: 'set' }]);
    if (created) rows.get(created)?.focus();
  });
  const groupsBox = el('div', { class: 'fd-chips' });
  const addGroup = el('button', { type: 'button', class: 'fd-button' }, w.addGrouping);
  addGroup.addEventListener('click', () => {
    const page = designer.getPage();
    const taken = new Set(listOf(page).groupBy ?? []);
    const choices = everyField(page, designer).filter(({ name, field }) => !taken.has(name) && GROUPABLE.has(field.type));
    openMenu({
      el,
      anchor: addGroup,
      title: w.groupBy,
      items: choices.map(({ name, field }) => ({ id: name, label: field.label })),
      note: w.groupingNote(choices.length > 0),
      onPick: (name) => designer.setListOptions({ groupBy: [...taken, name] }),
    });
  });

  const element = el(
    'div',
    { class: 'fd-props' },
    prop(el, w.rowsOnPage, size),
    prop(el, w.sortedBy, sortBy),
    directionRow,
    el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.searchLooksIn), searchBox, el('p', { class: 'fd-properties-hint' }, w.noneTicked)),
    el('div', { class: 'fd-prop fd-prop-filters', 'data-part': 'filters' }, el('span', { class: 'fd-prop-name' }, w.filters), filtersBox, addFilter),
    el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.groupBy), groupsBox, addGroup),
    el('p', { class: 'fd-properties-hint' }, w.rowOpens)
  );

  return {
    element,
    update(page) {
      const list = listOf(page);
      if (!focused(size)) size.value = list.pageSize === undefined ? '' : String(list.pageSize);
      const sortable = everyField(page, designer).filter(({ field }) => !UNSORTABLE.has(field.type));
      sortBy.replaceChildren(el('option', { value: '' }, w.appOrder), ...sortable.map(({ name, field }) => el('option', { value: name }, field.label)));
      const order = list.sort?.[0];
      sortBy.value = order?.field ?? '';
      direction.value = order?.desc ? 'desc' : 'asc';
      directionRow.hidden = !order;

      // Where the search looks: the columns, and any field named that is not one.
      const looked = new Set(list.searchFields ?? []);
      const names = [...new Set([...list.columns, ...looked])];
      searchBox.replaceChildren(
        ...names.map((name) => {
          const label = page.fields[name]?.label ?? name;
          const box = el('input', { type: 'checkbox', 'aria-label': w.searchLooksInField(label) }) as HTMLInputElement;
          box.checked = looked.has(name);
          box.addEventListener('change', () => designer.setListOptions({ searchFields: names.filter((n) => (n === name ? box.checked : looked.has(n))) }));
          return el('label', { class: 'fd-q-required' }, box, el('span', {}, label));
        })
      );

      const on = new Set(list.defaultFilters ?? []);
      const filters = list.filters ?? [];
      for (const id of [...rows.keys()]) if (!filters.some((f) => f.id === id)) rows.delete(id);
      const drawn = filters.map((filter) => {
        let row = rows.get(filter.id);
        if (!row) {
          row = filterRow(el, designer, filter.id);
          rows.set(filter.id, row);
        }
        row.update(filter.label, filter, on.has(filter.id));
        return row.element;
      });
      drawn.forEach((child, index) => {
        if (filtersBox.children[index] !== child) filtersBox.insertBefore(child, filtersBox.children[index] ?? null);
      });
      while (filtersBox.children.length > drawn.length) filtersBox.lastElementChild?.remove();

      const groups = list.groupBy ?? [];
      groupsBox.replaceChildren(
        ...groups.map((name) => {
          const label = page.fields[name]?.label ?? name;
          const remove = el('button', { type: 'button', class: 'fd-chip-remove', 'aria-label': w.removeGrouping(label) }, '×');
          remove.addEventListener('click', () => designer.setListOptions({ groupBy: groups.filter((g) => g !== name) }));
          return el('span', { class: 'fd-chip' }, label, remove);
        })
      );
    },
    focus() {
      const filters = element.querySelector<HTMLElement>('[data-part="filters"]');
      filters?.scrollIntoView?.({ block: 'nearest' });
    },
  };
}

// ---- a column -----------------------------------------------------------------------------------

export function columnProperties(el: ElementFactory, designer: Designer, name: string): PropertiesView {
  const w = designer.words.list;
  const about = el('p', { class: 'fd-properties-hint' });
  const order = select(el, w.orderBy, [['', w.notOrdered], ['asc', w.ascendingShort], ['desc', w.descendingShort]]);
  order.addEventListener('change', () => {
    const others = (listOf(designer.getPage()).sort ?? []).filter((s) => s.field !== name);
    designer.setListOptions({ sort: order.value ? [{ field: name, desc: order.value === 'desc' }, ...others] : others });
  });
  const orderRow = prop(el, w.orderBy, order);
  const left = el('button', { type: 'button', class: 'fd-button' }, w.moveLeft);
  const right = el('button', { type: 'button', class: 'fd-button' }, w.moveRight);
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, w.removeColumn);
  const at = () => listOf(designer.getPage()).columns.indexOf(name);
  left.addEventListener('click', () => designer.moveColumn(name, at() - 1));
  right.addEventListener('click', () => designer.moveColumn(name, at() + 1));
  remove.addEventListener('click', () => designer.removeColumn(name));
  const element = el('div', { class: 'fd-props' }, about, orderRow, el('div', { class: 'fd-props-actions' }, left, right, remove));
  return {
    element,
    update(page) {
      const list = listOf(page);
      const field = page.fields[name];
      if (!field) return;
      about.textContent = w.columnAbout(field.label, storedAs(field, designer.words));
      orderRow.hidden = UNSORTABLE.has(field.type);
      const first = list.sort?.[0];
      order.value = first?.field === name ? (first.desc ? 'desc' : 'asc') : '';
      const index = list.columns.indexOf(name);
      left.hidden = index <= 0;
      right.hidden = index === list.columns.length - 1;
      remove.hidden = list.columns.length === 1;
    },
  };
}

// ---- a button for the rows chosen ----------------------------------------------------------------

export function listActionProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const w = designer.words.list;
  const p = designer.words.panel;
  const words = el('input', { class: 'fd-input', 'aria-label': w.words }) as HTMLInputElement;
  words.addEventListener('input', () => designer.updateListAction(id, { label: words.value }));
  // steps lane: what it does when clicked, its app action one of the steps.
  const pressed = whenClicked(el, designer, id);
  const look = select(el, w.look, [['secondary', p.buttonLooks.secondary], ['primary', p.buttonLooks.primary], ['danger', p.buttonLooks.danger], ['link', p.buttonLooks.link]]);
  look.addEventListener('change', () => designer.updateListAction(id, { style: look.value as ButtonNode['style'] }));
  const asks = el('input', { class: 'fd-input', 'aria-label': p.asksFirst, placeholder: p.actsAtOnce }) as HTMLInputElement;
  asks.addEventListener('input', () => designer.updateListAction(id, { confirm: asks.value }));
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, w.delete);
  remove.addEventListener('click', () => designer.removeListAction(id));
  const element = el(
    'div',
    { class: 'fd-props' },
    prop(el, w.words, words),
    pressed.element,
    prop(el, w.look, look),
    prop(el, p.asksFirst, asks),
    el('div', { class: 'fd-props-actions' }, remove)
  );
  return {
    element,
    update(page) {
      const button = listOf(page).actions?.find((a) => a.id === id);
      if (!button) return;
      if (!focused(words)) words.value = button.label;
      pressed.update(page);
      look.value = button.style ?? 'secondary';
      if (!focused(asks)) asks.value = button.confirm ?? '';
    },
  };
}
