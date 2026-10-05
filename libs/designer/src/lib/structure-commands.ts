import type { FieldNode, FilterCondition, Page } from '@fieldia/core';
import { findNode } from './page-tree';
import { Refusal } from './refusal';

/**
 * The edits the structures need beyond their widget's settings: a table of
 * lines' totals and the columns people may hide, and the records a link
 * offers, by one condition. Each goes through the designer's `apply`, so it
 * is validated, undone and saved as every other edit is.
 */

export interface StructureCommandsDeps {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
  /** Whether a field is the backend's, whose definition the page does not change. */
  fromModel(name: string): boolean;
}

/** A link's records, by one of their fields and a value it must have: "only where active is true". */
export interface LinkCondition {
  field: string;
  value: string | number | boolean;
}

export interface StructureCommands {
  /**
   * A table of lines' number columns added up under it, and the columns people
   * may hide or show, each shown or hidden to start with; `null` or none takes
   * either away.
   */
  setLineTable(id: string, table: { totals?: string[] | null; optionalColumns?: Record<string, 'show' | 'hide'> | null }): boolean;
  /** The records a link or links offer: only those where a field has a value; `null` offers them all. */
  setLinkFilter(id: string, condition: LinkCondition | null): boolean;
}

export function structureCommands({ apply, fromModel }: StructureCommandsDeps): StructureCommands {
  function question(draft: Page, id: string): FieldNode {
    const found = findNode(draft, id);
    if (!found || found.node.type !== 'field') throw new Refusal((w) => w.refusals.noQuestion(id));
    return found.node;
  }

  return {
    setLineTable(id, table) {
      return apply((draft) => {
        const node = question(draft, id);
        const field = draft.fields[node.field];
        if (field.type !== 'one2many') throw new Refusal((w) => w.refusals.onlyLinesTotals);
        const numbers = (name: string) => ['integer', 'float', 'monetary'].includes(field.fields[name]?.type ?? '');
        if (table.totals !== undefined) {
          const totals = (table.totals ?? []).filter((name) => field.fields[name]);
          if (totals.some((name) => !numbers(name))) throw new Refusal((w) => w.refusals.onlyNumbersAdd);
          if (totals.length) node.totals = totals;
          else delete node.totals;
        }
        if (table.optionalColumns !== undefined) {
          const optional = Object.entries(table.optionalColumns ?? {}).filter(([name]) => field.fields[name]);
          if (optional.length) node.optionalColumns = Object.fromEntries(optional);
          else delete node.optionalColumns;
        }
      });
    },

    setLinkFilter(id, condition) {
      return apply(
        (draft) => {
          const node = question(draft, id);
          const field = draft.fields[node.field];
          if (field.type !== 'many2one' && field.type !== 'many2many') throw new Refusal((w) => w.refusals.onlyLinksOffer);
          if (fromModel(node.field)) throw new Refusal((w) => w.refusals.offersFromModel(field.label));
          const name = condition?.field.trim() ?? '';
          if (condition && !name) throw new Refusal((w) => w.refusals.sayWhichFields);
          const kept: FilterCondition[] = condition ? [{ field: name, op: '=', value: condition.value }] : [];
          if (kept.length) field.filter = kept;
          else delete field.filter;
        },
        `link-filter:${id}`
      );
    },
  };
}
