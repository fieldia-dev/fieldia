import type { ButtonNode, Field, FilterCondition, FilterItem, ListCalendar, ListCell, ListMap, ListNode, Page } from '@fieldia/core';
import { storedAs } from './kinds';
import { allIds, fieldReads, keptFields, listCalendarFields, listMapFields, nextName } from './page-tree';
import { Refusal } from './refusal';

/**
 * A list page, as the designer edits it: its columns, its order, how many
 * rows a page holds, where the search bar looks, its named filters and
 * groupings, the buttons for the rows chosen, and its records on a map. A field a list names comes
 * onto the page from the model as the model has it, and leaves when nothing
 * names it any more.
 */

export interface ListOptionsPatch {
  sort?: { field: string; desc?: boolean }[];
  pageSize?: number;
  /** The fields the search bar looks in; empty for the columns. */
  searchFields?: string[];
  /** The fields people can group by; empty for none. */
  groupBy?: string[];
  /** The records on a map too: where each is, its pin and its card; null for no map. */
  map?: ListMap | null;
  /** A box to choose each row; false for none (a list with no buttons for the rows chosen). */
  choose?: boolean;
  /** Whether a header's press sorts the list; false for a ranked list that keeps its own order. */
  sortable?: boolean;
  /** The search bar, or a keyword and a list of values for each of `filterFields`. */
  search?: 'bar' | 'fields';
  /** The fields the filter bar offers the values of, in order; empty for none. A field taken away takes its own name with it. */
  filterFields?: string[];
  /** A filter's own name on the bar, for a field it offers; empty for the field's label. */
  filterLabel?: { field: string; label: string };
  /** The link to the list's own records its rows nest under; null for none. */
  parentField?: string | null;
  /** The records on a calendar too: when each starts and ends, its words, its colour, a column for each; null for none. */
  calendar?: ListCalendar | null;
}

export interface ListActionPatch {
  label?: string;
  action?: string;
  style?: ButtonNode['style'];
  confirm?: string;
}

export interface ListCommands {
  /** A field as a column: at `index`, or last. */
  addColumn(field: string, index?: number): boolean;
  moveColumn(field: string, index: number): boolean;
  removeColumn(field: string): boolean;
  setListOptions(options: ListOptionsPatch): boolean;
  /** How a column draws its cells: a widget, an icon from another field, a width, a side, its header’s rule; null draws it as its kind does. */
  setListCell(column: string, cell: ListCell | null): boolean;
  /** A named filter for the search bar. Returns its id. */
  addListFilter(label: string, filter: FilterCondition[]): string | false;
  /** Its words, its conditions, and whether it is on when the list opens. */
  updateListFilter(id: string, patch: { label?: string; filter?: FilterCondition[]; on?: boolean }): boolean;
  removeListFilter(id: string): boolean;
  /** A button for the rows chosen. Returns its id. */
  addListAction(label: string): string | false;
  updateListAction(id: string, patch: ListActionPatch): boolean;
  removeListAction(id: string): boolean;
}

/** Its header's rule: none (false), or set in "0px" to "400px" from the column's end. */
export const ruleIsGood = (rule: unknown): boolean => rule === false || (typeof rule === 'string' && /^(\d|[1-9]\d|[1-3]\d{2}|400)px$/.test(rule));

/** A column's width: 1 to 200 characters, or "8px" to "4000px" for the whole column. */
export const widthIsGood = (width: unknown): boolean =>
  typeof width === 'number' ? Number.isInteger(width) && width >= 1 && width <= 200 : typeof width === 'string' && /^([89]|[1-9]\d{1,2}|[1-3]\d{3}|4000)px$/.test(width);

/** Kinds of field whose values a list's filter bar can offer to tick. */
export const FILTERABLE = new Set(['selection', 'many2one', 'many2many', 'boolean', 'char', 'integer']);

/** Kinds of field a column cannot show: lines, rich text, files and raw data. */
const NOT_IN_A_COLUMN = new Set(['one2many', 'html', 'binary', 'json']);

/** Whether a column can show this field. */
export const canBeColumn = (field: Field) => !NOT_IN_A_COLUMN.has(field.type);

/** How a column is picked on the canvas: by its field. */
export const columnId = (field: string) => `column:${field}`;

const actionName = (label: string) =>
  label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'action';

/** The fields a filter reads, through its groups. */
export function filterFields(items: readonly FilterItem[]): string[] {
  return items.flatMap((item) => ('any' in item ? filterFields(item.any) : 'all' in item ? filterFields(item.all) : [item.field]));
}

export function listCommands(context: {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
  select(id: string | null): void;
  selected(): string | null;
  model: Record<string, Field>;
}): ListCommands {
  const { apply, model } = context;
  /** What was picked is gone: nothing is. */
  const unpick = (id: string) => {
    if (context.selected() === id) context.select(null);
  };
  const listOf = (draft: Page): ListNode => {
    if (draft.layout.type !== 'list') throw new Refusal((w) => w.refusals.onlyListColumns);
    return draft.layout;
  };
  const fieldFor = (draft: Page, name: string): Field => {
    const own = draft.fields[name] ?? model[name];
    if (!own) throw new Refusal((w) => w.refusals.noField(name));
    draft.fields[name] = own;
    // An amount comes with what its words read: its currency's field, its money look's conditions' fields.
    for (const read of fieldReads(own)) if (!draft.fields[read] && model[read]) draft.fields[read] = model[read];
    return own;
  };
  const prune = (draft: Page) => {
    const kept = keptFields(draft);
    for (const name of Object.keys(draft.fields)) if (!kept.has(name)) delete draft.fields[name];
  };
  const filterOf = (list: ListNode, id: string) => {
    const at = (list.filters ?? []).findIndex((f) => f.id === id);
    if (at === -1) throw new Refusal((w) => w.refusals.noFilter(id));
    return at;
  };
  const actionOf = (list: ListNode, id: string) => {
    const at = (list.actions ?? []).findIndex((a) => a.id === id);
    if (at === -1) throw new Refusal((w) => w.refusals.noButton(id));
    return at;
  };
  const fresh = (draft: Page, prefix: string) => {
    const ids = allIds(draft);
    return nextName((id) => ids.has(id), prefix, '-');
  };

  return {
    addColumn(field, index) {
      return apply((draft) => {
        const list = listOf(draft);
        const def = fieldFor(draft, field);
        if (list.columns.includes(field)) throw new Refusal((w) => w.refusals.columnAlready(def.label));
        if (!canBeColumn(def)) throw new Refusal((w) => w.refusals.cannotBeColumn(def.label, storedAs(def, w)));
        list.columns.splice(index === undefined ? list.columns.length : Math.max(0, Math.min(index, list.columns.length)), 0, field);
      });
    },

    moveColumn(field, index) {
      return apply((draft) => {
        const list = listOf(draft);
        const at = list.columns.indexOf(field);
        if (at === -1) throw new Refusal((w) => w.refusals.notAColumn(field));
        list.columns.splice(at, 1);
        list.columns.splice(Math.max(0, Math.min(index, list.columns.length)), 0, field);
      });
    },

    removeColumn(field) {
      const ok = apply((draft) => {
        const list = listOf(draft);
        const at = list.columns.indexOf(field);
        if (at === -1) throw new Refusal((w) => w.refusals.notAColumn(field));
        if (list.columns.length === 1) throw new Refusal((w) => w.refusals.listNeedsColumn);
        list.columns.splice(at, 1);
        // The order and the search leave a column that is gone, and so do its cells.
        if (list.sort) list.sort = list.sort.filter((s) => s.field !== field);
        if (!list.sort?.length) delete list.sort;
        if (list.cells) delete list.cells[field];
        if (list.cells && !Object.keys(list.cells).length) delete list.cells;
        prune(draft);
      });
      if (ok) unpick(columnId(field));
      return ok;
    },

    setListOptions(options) {
      return apply((draft) => {
        const list = listOf(draft);
        if (options.pageSize !== undefined) {
          if (!Number.isInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 500) throw new Refusal((w) => w.refusals.pageSize);
          list.pageSize = options.pageSize;
        }
        const fields = (key: 'searchFields' | 'groupBy', names: string[] | undefined) => {
          if (names === undefined) return;
          for (const name of names) fieldFor(draft, name);
          if (names.length) list[key] = [...names];
          else delete list[key];
        };
        if (options.sort !== undefined) {
          for (const s of options.sort) fieldFor(draft, s.field);
          if (options.sort.length) list.sort = options.sort.map((s) => (s.desc ? { field: s.field, desc: true } : { field: s.field }));
          else delete list.sort;
        }
        fields('searchFields', options.searchFields);
        fields('groupBy', options.groupBy);
        if (options.choose === true) delete list.choose;
        else if (options.choose === false) {
          if (list.actions?.length) throw new Refusal((w) => w.refusals.chooseHasButtons);
          list.choose = false;
        }
        if (options.sortable === true) delete list.sortable;
        else if (options.sortable === false) list.sortable = false;
        if (options.search === 'fields') list.search = 'fields';
        else if (options.search === 'bar') {
          // The fields' values, and their names on the bar, belong to the filter bar alone.
          delete list.search;
          delete list.filterFields;
          delete list.filterLabels;
        }
        if (options.filterFields !== undefined) {
          for (const name of options.filterFields) {
            const def = fieldFor(draft, name);
            if (!FILTERABLE.has(def.type)) throw new Refusal((w) => w.refusals.notFilterable(def.label));
          }
          if (options.filterFields.length) list.filterFields = [...options.filterFields];
          else delete list.filterFields;
          // A filter no longer offered takes its own name with it.
          const named = Object.entries(list.filterLabels ?? {}).filter(([name]) => list.filterFields?.includes(name));
          if (named.length) list.filterLabels = Object.fromEntries(named);
          else delete list.filterLabels;
        }
        if (options.filterLabel !== undefined) {
          const { field, label } = options.filterLabel;
          const def = fieldFor(draft, field);
          if (!list.filterFields?.includes(field)) throw new Refusal((w) => w.refusals.filterLabelNotOffered(def.label));
          const words = label.trim();
          const labels = { ...list.filterLabels };
          if (words && words !== def.label) labels[field] = words;
          else delete labels[field];
          if (Object.keys(labels).length) list.filterLabels = labels;
          else delete list.filterLabels;
        }
        if (options.parentField === null) delete list.parentField;
        else if (options.parentField !== undefined) {
          const def = fieldFor(draft, options.parentField);
          const own = draft.data.kind === 'record' ? draft.data.model : '';
          if (def.type !== 'many2one' || def.relation !== own) throw new Refusal((w) => w.refusals.parentNotOwnLink(def.label));
          list.parentField = options.parentField;
        }
        if (options.map === null) delete list.map;
        else if (options.map !== undefined) {
          // The fields it names come onto the page from the model; the page check says what is wrong with the rest.
          for (const name of listMapFields(options.map)) fieldFor(draft, name);
          list.map = JSON.parse(JSON.stringify(options.map)) as ListMap;
        }
        if (options.calendar === null) delete list.calendar;
        else if (options.calendar !== undefined) {
          // As a map's: its fields come from the model, and the page check says what is wrong with the rest.
          for (const name of listCalendarFields(options.calendar)) fieldFor(draft, name);
          list.calendar = JSON.parse(JSON.stringify(options.calendar)) as ListCalendar;
        }
        prune(draft);
      });
    },

    setListCell(column, cell) {
      return apply(
        (draft) => {
          const list = listOf(draft);
          if (!list.columns.includes(column)) throw new Refusal((w) => w.refusals.notAColumn(column));
          const cells = { ...list.cells };
          if (!cell || !Object.keys(cell).length) delete cells[column];
          else {
            if (cell.width !== undefined && !widthIsGood(cell.width)) throw new Refusal((w) => w.refusals.cellWidth);
            if (cell.rule !== undefined && !ruleIsGood(cell.rule)) throw new Refusal((w) => w.refusals.cellRule);
            const own = fieldFor(draft, column);
            if (cell.widget === 'dot' && own.type !== 'selection') throw new Refusal((w) => w.refusals.dotNeedsChoice(own.label));
            if (cell.lead) {
              const from = fieldFor(draft, cell.lead.field);
              if (from.type !== 'selection') throw new Refusal((w) => w.refusals.leadNeedsChoice(from.label));
            }
            cells[column] = JSON.parse(JSON.stringify(cell)) as ListCell;
          }
          if (Object.keys(cells).length) list.cells = cells;
          else delete list.cells;
          prune(draft);
        },
        `cell:${column}`
      );
    },

    addListFilter(label, filter) {
      let created = '';
      const ok = apply((draft) => {
        const list = listOf(draft);
        if (!label.trim()) throw new Refusal((w) => w.refusals.filterName);
        if (!filter.length) throw new Refusal((w) => w.refusals.filterCondition);
        for (const name of filterFields(filter)) fieldFor(draft, name);
        created = fresh(draft, 'filter');
        list.filters = [...(list.filters ?? []), { id: created, label: label.trim(), filter }];
      });
      return ok ? created : false;
    },

    updateListFilter(id, patch) {
      return apply(
        (draft) => {
          const list = listOf(draft);
          const filters = list.filters ?? [];
          const at = filterOf(list, id);
          if (patch.label !== undefined) filters[at].label = patch.label;
          if (patch.filter !== undefined) {
            if (!patch.filter.length) throw new Refusal((w) => w.refusals.filterCondition);
            for (const name of filterFields(patch.filter)) fieldFor(draft, name);
            filters[at].filter = patch.filter;
          }
          if (patch.on !== undefined) {
            const on = new Set(list.defaultFilters ?? []);
            if (patch.on) on.add(id);
            else on.delete(id);
            if (on.size) list.defaultFilters = [...on];
            else delete list.defaultFilters;
          }
          prune(draft);
        },
        Object.keys(patch).length === 1 && patch.label !== undefined ? `filter:${id}` : null
      );
    },

    removeListFilter(id) {
      return apply((draft) => {
        const list = listOf(draft);
        const at = filterOf(list, id);
        list.filters?.splice(at, 1);
        if (!list.filters?.length) delete list.filters;
        if (list.defaultFilters) list.defaultFilters = list.defaultFilters.filter((f) => f !== id);
        if (!list.defaultFilters?.length) delete list.defaultFilters;
        prune(draft);
      });
    },

    addListAction(label) {
      let created = '';
      const ok = apply((draft) => {
        const list = listOf(draft);
        if (!label.trim()) throw new Refusal((w) => w.refusals.buttonWords);
        created = fresh(draft, 'button');
        list.actions = [...(list.actions ?? []), { type: 'button', id: created, label: label.trim(), action: actionName(label) }];
      });
      if (ok) context.select(created);
      return ok ? created : false;
    },

    updateListAction(id, patch) {
      return apply(
        (draft) => {
          const list = listOf(draft);
          const button = (list.actions ?? [])[actionOf(list, id)];
          if (patch.label !== undefined) button.label = patch.label;
          if (patch.action !== undefined) {
            if (!patch.action.trim()) throw new Refusal((w) => w.refusals.listButtonAction);
            button.action = patch.action.trim();
          }
          if (patch.style !== undefined) button.style = patch.style;
          if (patch.confirm !== undefined) {
            if (patch.confirm.trim()) button.confirm = patch.confirm;
            else delete button.confirm;
          }
        },
        Object.keys(patch).length === 1 && (patch.label !== undefined || patch.action !== undefined || patch.confirm !== undefined) ? `action:${Object.keys(patch)[0]}:${id}` : null
      );
    },

    removeListAction(id) {
      const ok = apply((draft) => {
        const list = listOf(draft);
        list.actions?.splice(actionOf(list, id), 1);
        if (!list.actions?.length) delete list.actions;
      });
      if (ok) unpick(id);
      return ok;
    },
  };
}
