import type { ButtonNode, Field, FilterCondition, FilterItem, ListNode, Page } from '@fieldia/core';
import { storedAs } from './kinds';
import { allIds, nextName, shownFields } from './page-tree';
import { Refusal } from './refusal';

/**
 * A list page, as the designer edits it: its columns, its order, how many
 * rows a page holds, where the search bar looks, its named filters and
 * groupings, and the buttons for the rows chosen. A field a list names comes
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
    if (draft.layout.type !== 'list') throw new Refusal('Only a list has columns');
    return draft.layout;
  };
  const fieldFor = (draft: Page, name: string): Field => {
    const own = draft.fields[name] ?? model[name];
    if (!own) throw new Refusal(`There is no field "${name}"`);
    draft.fields[name] = own;
    return own;
  };
  const prune = (draft: Page) => {
    const shown = shownFields(draft);
    for (const name of Object.keys(draft.fields)) if (!shown.has(name)) delete draft.fields[name];
  };
  const filterOf = (list: ListNode, id: string) => {
    const at = (list.filters ?? []).findIndex((f) => f.id === id);
    if (at === -1) throw new Refusal(`There is no filter "${id}"`);
    return at;
  };
  const actionOf = (list: ListNode, id: string) => {
    const at = (list.actions ?? []).findIndex((a) => a.id === id);
    if (at === -1) throw new Refusal(`There is no button "${id}"`);
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
        if (list.columns.includes(field)) throw new Refusal(`${def.label} is a column already`);
        if (!canBeColumn(def)) throw new Refusal(`A list cannot show ${def.label} in a column: it holds ${storedAs(def)}`);
        list.columns.splice(index === undefined ? list.columns.length : Math.max(0, Math.min(index, list.columns.length)), 0, field);
      });
    },

    moveColumn(field, index) {
      return apply((draft) => {
        const list = listOf(draft);
        const at = list.columns.indexOf(field);
        if (at === -1) throw new Refusal(`"${field}" is not a column`);
        list.columns.splice(at, 1);
        list.columns.splice(Math.max(0, Math.min(index, list.columns.length)), 0, field);
      });
    },

    removeColumn(field) {
      const ok = apply((draft) => {
        const list = listOf(draft);
        const at = list.columns.indexOf(field);
        if (at === -1) throw new Refusal(`"${field}" is not a column`);
        if (list.columns.length === 1) throw new Refusal('A list needs a column');
        list.columns.splice(at, 1);
        // The order and the search leave a column that is gone.
        if (list.sort) list.sort = list.sort.filter((s) => s.field !== field);
        if (!list.sort?.length) delete list.sort;
        prune(draft);
      });
      if (ok) unpick(columnId(field));
      return ok;
    },

    setListOptions(options) {
      return apply((draft) => {
        const list = listOf(draft);
        if (options.pageSize !== undefined) {
          if (!Number.isInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 500) throw new Refusal('A page of the list holds 1 to 500 rows');
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
        prune(draft);
      });
    },

    addListFilter(label, filter) {
      let created = '';
      const ok = apply((draft) => {
        const list = listOf(draft);
        if (!label.trim()) throw new Refusal('A filter needs a name people will recognise, such as Active');
        if (!filter.length) throw new Refusal('A filter needs a condition');
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
            if (!patch.filter.length) throw new Refusal('A filter needs a condition');
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
        if (!label.trim()) throw new Refusal('A button needs words');
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
            if (!patch.action.trim()) throw new Refusal('A button needs the name of its action, such as archive');
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
