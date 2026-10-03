import type { ButtonNode, Field, FilterCondition, ListNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { storedAs } from './kinds';
import { openMenu } from './menu';
import type { PropertiesView } from './screen-properties';

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

function testsFor(field: Field): Test[] {
  const filled: Test[] = [['set', 'is filled in'], ['notset', 'is empty']];
  switch (field.type) {
    case 'selection':
      return [['=', 'is'], ['!=', 'is not'], ...filled];
    case 'boolean':
      return [['=', 'is']];
    case 'integer':
    case 'float':
    case 'monetary':
      return [['=', 'is'], ['>', 'is more than'], ['<', 'is less than'], ['>=', 'is at least'], ['<=', 'is at most'], ...filled];
    case 'date':
    case 'datetime':
      return [['=', 'is'], ['>', 'is after'], ['<', 'is before'], ...filled];
    case 'char':
    case 'text':
      return [['ilike', 'contains'], ['=', 'is'], ['!=', 'is not'], ...filled];
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
  const name = el('input', { class: 'fd-input', 'aria-label': 'Filter name' }) as HTMLInputElement;
  name.addEventListener('input', () => designer.updateListFilter(id, { label: name.value }));
  const which = el('select', { class: 'fd-input fd-select', 'aria-label': 'Filter field' }) as HTMLSelectElement;
  const test = el('select', { class: 'fd-input fd-select', 'aria-label': 'Filter test' }) as HTMLSelectElement;
  const valueBox = el('span', { class: 'fd-list-filter-value' });
  const on = el('input', { type: 'checkbox', 'aria-label': 'On when the list opens' }) as HTMLInputElement;
  on.addEventListener('change', () => designer.updateListFilter(id, { on: on.checked }));
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-link fd-button-danger' }, 'Remove');
  remove.addEventListener('click', () => designer.removeListFilter(id));
  const byHand = el('p', { class: 'fd-properties-hint', hidden: '' }, 'Its conditions were written by hand: they stay as they are.');
  const condition = el('div', { class: 'fd-list-filter-condition' }, which, test, valueBox);
  const element = el(
    'fieldset',
    { class: 'fd-list-filter', 'data-filter': id },
    name,
    condition,
    byHand,
    el('div', { class: 'fd-list-filter-foot' }, el('label', { class: 'fd-q-required' }, on, el('span', {}, 'On when the list opens')), remove)
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
    const [op] = testsFor(field)[0];
    designer.updateListFilter(id, { filter: [op === 'set' ? { field: which.value, op } : { field: which.value, op, value: firstValue(field) }] });
  });
  test.addEventListener('change', () => {
    const current = listOf(page()).filters?.find((f) => f.id === id)?.filter[0] as FilterCondition;
    const field = fieldOf(current.field);
    save({ op: test.value as FilterCondition['op'], ...(current.value === undefined && field ? { value: firstValue(field) } : {}) });
  });

  function valueControl(field: Field, condition: FilterCondition): HTMLElement {
    if (field.type === 'selection' || field.type === 'boolean') {
      const options: [string, string][] = field.type === 'boolean' ? [['true', 'Yes'], ['false', 'No']] : field.options.map((o) => [String(o.value), o.label]);
      const box = select(el, 'Filter value', options);
      box.value = String(condition.value);
      box.addEventListener('change', () => {
        const picked = field.type === 'boolean' ? box.value === 'true' : field.options.find((o) => String(o.value) === box.value)?.value;
        save({ value: picked });
      });
      return box;
    }
    const numeric = ['integer', 'float', 'monetary'].includes(field.type);
    const kind = numeric ? 'number' : field.type === 'date' || field.type === 'datetime' ? 'date' : 'text';
    const box = el('input', { class: 'fd-input', type: kind, 'aria-label': 'Filter value' }) as HTMLInputElement;
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
      remove.setAttribute('aria-label', `Remove the filter ${label}`);
      const single = items.filter.length === 1 && !('any' in items.filter[0]) && !('all' in items.filter[0]) ? (items.filter[0] as FilterCondition) : null;
      const field = single ? fieldOf(single.field) : undefined;
      condition.hidden = !single || !field;
      byHand.hidden = !condition.hidden;
      if (!single || !field) return;
      const fields = everyField(page(), designer).filter(({ field: f }) => testsFor(f).length > 0 && !['one2many', 'json'].includes(f.type));
      which.replaceChildren(...fields.map(({ name: n, field: f }) => el('option', { value: n }, f.label)));
      which.value = single.field;
      test.replaceChildren(...testsFor(field).map(([op, words]) => el('option', { value: op }, words)));
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
  const size = el('input', { class: 'fd-input', type: 'number', min: '1', max: '500', placeholder: '40', 'aria-label': 'Rows on a page' }) as HTMLInputElement;
  size.addEventListener('input', () => {
    if (size.value.trim() !== '') designer.setListOptions({ pageSize: Number(size.value) });
  });
  const sortBy = el('select', { class: 'fd-input fd-select', 'aria-label': 'Sorted by' }) as HTMLSelectElement;
  const direction = select(el, 'Direction', [['asc', 'A to Z, low to high, old to new'], ['desc', 'Z to A, high to low, new to old']]);
  const saveSort = () => designer.setListOptions({ sort: sortBy.value ? [{ field: sortBy.value, desc: direction.value === 'desc' }] : [] });
  sortBy.addEventListener('change', saveSort);
  direction.addEventListener('change', saveSort);
  const directionRow = prop(el, 'Direction', direction);

  const searchBox = el('div', { class: 'fd-list-search-fields' });
  const filtersBox = el('div', { class: 'fd-list-filters' });
  const addFilter = el('button', { type: 'button', class: 'fd-button' }, 'Add a filter');
  const rows = new Map<string, ReturnType<typeof filterRow>>();
  addFilter.addEventListener('click', () => {
    const page = designer.getPage();
    const created = designer.addListFilter('New filter', [{ field: listOf(page).columns[0], op: 'set' }]);
    if (created) rows.get(created)?.focus();
  });
  const groupsBox = el('div', { class: 'fd-chips' });
  const addGroup = el('button', { type: 'button', class: 'fd-button' }, 'Add a grouping');
  addGroup.addEventListener('click', () => {
    const page = designer.getPage();
    const taken = new Set(listOf(page).groupBy ?? []);
    const choices = everyField(page, designer).filter(({ name, field }) => !taken.has(name) && GROUPABLE.has(field.type));
    openMenu({
      el,
      anchor: addGroup,
      title: 'Group by',
      items: choices.map(({ name, field }) => ({ id: name, label: field.label })),
      note: choices.length ? 'People pick a grouping from the search bar; the list then shows a row for each value.' : 'No other field can group the list.',
      onPick: (name) => designer.setListOptions({ groupBy: [...taken, name] }),
    });
  });

  const element = el(
    'div',
    { class: 'fd-props' },
    prop(el, 'Rows on a page', size),
    prop(el, 'Sorted by', sortBy),
    directionRow,
    el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, 'Search looks in'), searchBox, el('p', { class: 'fd-properties-hint' }, 'None ticked: it looks in every column.')),
    el('div', { class: 'fd-prop fd-prop-filters', 'data-part': 'filters' }, el('span', { class: 'fd-prop-name' }, 'Filters'), filtersBox, addFilter),
    el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, 'Group by'), groupsBox, addGroup),
    el('p', { class: 'fd-properties-hint' }, 'A row opens its record. The buttons for the rows chosen are added on the canvas, under the search bar.')
  );

  return {
    element,
    update(page) {
      const list = listOf(page);
      if (!focused(size)) size.value = list.pageSize === undefined ? '' : String(list.pageSize);
      const sortable = everyField(page, designer).filter(({ field }) => !UNSORTABLE.has(field.type));
      sortBy.replaceChildren(el('option', { value: '' }, 'As the app orders them'), ...sortable.map(({ name, field }) => el('option', { value: name }, field.label)));
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
          const box = el('input', { type: 'checkbox', 'aria-label': `Search looks in ${label}` }) as HTMLInputElement;
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
          const remove = el('button', { type: 'button', class: 'fd-chip-remove', 'aria-label': `Remove the grouping ${label}` }, '×');
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
  const about = el('p', { class: 'fd-properties-hint' });
  const order = select(el, 'Order the list by it', [['', 'No'], ['asc', 'A to Z, low to high'], ['desc', 'Z to A, high to low']]);
  order.addEventListener('change', () => {
    const others = (listOf(designer.getPage()).sort ?? []).filter((s) => s.field !== name);
    designer.setListOptions({ sort: order.value ? [{ field: name, desc: order.value === 'desc' }, ...others] : others });
  });
  const orderRow = prop(el, 'Order the list by it', order);
  const left = el('button', { type: 'button', class: 'fd-button' }, 'Move left');
  const right = el('button', { type: 'button', class: 'fd-button' }, 'Move right');
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Remove the column');
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
      about.textContent = `${field.label}: ${storedAs(field)}, from the model. A column shows the field under its own name.`;
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
  const words = el('input', { class: 'fd-input', 'aria-label': 'Words' }) as HTMLInputElement;
  words.addEventListener('input', () => designer.updateListAction(id, { label: words.value }));
  const action = el('input', { class: 'fd-input', 'aria-label': 'Action', placeholder: 'archive' }) as HTMLInputElement;
  action.addEventListener('input', () => action.value.trim() && designer.updateListAction(id, { action: action.value }));
  const look = select(el, 'Look', [['secondary', 'Plain'], ['primary', 'Main'], ['danger', 'Danger'], ['link', 'A link']]);
  look.addEventListener('change', () => designer.updateListAction(id, { style: look.value as ButtonNode['style'] }));
  const asks = el('input', { class: 'fd-input', 'aria-label': 'Asks first', placeholder: 'Nothing: it acts at once' }) as HTMLInputElement;
  asks.addEventListener('input', () => designer.updateListAction(id, { confirm: asks.value }));
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Delete');
  remove.addEventListener('click', () => designer.removeListAction(id));
  const element = el(
    'div',
    { class: 'fd-props' },
    prop(el, 'Words', words),
    el('div', { class: 'fd-prop' }, prop(el, 'Action', action), el('p', { class: 'fd-properties-hint' }, 'The name the app receives with the rows chosen; the app decides what it does.')),
    prop(el, 'Look', look),
    prop(el, 'Asks first', asks),
    el('div', { class: 'fd-props-actions' }, remove)
  );
  return {
    element,
    update(page) {
      const button = listOf(page).actions?.find((a) => a.id === id);
      if (!button) return;
      if (!focused(words)) words.value = button.label;
      if (!focused(action)) action.value = button.action;
      look.value = button.style ?? 'secondary';
      if (!focused(asks)) asks.value = button.confirm ?? '';
    },
  };
}
