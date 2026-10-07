import type { ButtonNode, CellRules, Field, FieldNode, LayoutNode, Page, ScreenWidth, ToneWhen } from '@fieldia/core';
import { findNode } from './page-tree';
import { Refusal } from './refusal';

/** The widgets a column's cells may be drawn with, by what the column holds. */
export const CELL_WIDGETS: Readonly<Record<string, readonly string[]>> = {
  float: ['duration', 'percentage', 'progressbar'],
  integer: ['progressbar', 'color'],
  monetary: ['progressbar'],
  selection: ['priority', 'dot'],
  boolean: ['priority'],
};
/** The kind each cell widget is named by. */
export const CELL_WIDGET_KINDS: Readonly<Record<string, string>> = { duration: 'duration', percentage: 'percentage', progressbar: 'progress', color: 'colour', priority: 'priority', dot: 'state-dot' };
import { formulaProblem, problemWords } from './rules-formula';

/**
 * A table's own rules and a field's tone, as the designer edits them: each
 * column's cells by their line (blank, read-only, required, tones, bold, a
 * pill, a width) and the column hidden by the record; the lines' tones and
 * bold; the buttons on each line, for the lines chosen and beside Add a line;
 * how its lines open and show on a phone; a field's value in a tone; the
 * widths a part is hidden at. Each goes through the designer's `apply`: one
 * undo step, typing in one box merged into one, refused in words.
 */

export interface TableCommandsDeps {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
}

/** A cell's conditions, each read on its line — but `hidden`, read on the record. */
export type CellRule = 'invisible' | 'readonly' | 'required' | 'hidden' | 'bold';

/** Where a table's buttons are: on each line, for the lines chosen, beside Add a line. */
export type TableButtonPlace = 'rowButtons' | 'selectedButtons' | 'controlButtons';

/** A table's button as the panel edits it: its words, the app's action, when it is hidden; the rest of it kept. */
export interface TableButton {
  id?: string;
  label: string;
  action?: string;
  invisible?: string;
}

/** How a table's lines open and show: `null` takes a choice back to the usual. */
export interface TableShape {
  lineOpens?: 'fields' | 'record' | null;
  cards?: 'narrow' | 'always' | null;
  fit?: 'content' | 'shrink' | null;
  /** A ⧉ on each line that puts a copy of it after it (the widget's `copy`). */
  copy?: boolean | null;
}

export interface TableCommands {
  /** A field's value in a tone while a condition on the record holds, the first that holds; `null` takes them away. */
  setFieldTones(id: string, tones: ToneWhen[] | null): boolean;
  /** A field's value in bold while a condition holds; `null` takes it away. */
  setFieldBold(id: string, when: string | null): boolean;
  /** A column's cells: blank, read-only, required or bold while a condition on their line holds, or the column hidden while one on the record does. */
  setCellRule(id: string, column: string, rule: CellRule, when: string | null): boolean;
  /** A column's cells' tones, each while a condition on its line holds. */
  setCellTones(id: string, column: string, tones: ToneWhen[] | null): boolean;
  /** A column's cells drawn as pills, and its width in characters; `null` takes either back. */
  /** A column's look: a pill, a width, or a widget its cells are drawn with — one that suits what the column holds (`CELL_WIDGETS`). */
  setCellLook(id: string, column: string, look: { badge?: boolean | null; width?: number | null; widget?: string | null; roles?: string[] | null }): boolean;
  /** The lines' tones, each while a condition on the line holds. */
  setRowTones(id: string, tones: ToneWhen[] | null): boolean;
  /** The lines in bold while a condition on the line holds. */
  setRowBold(id: string, when: string | null): boolean;
  /** A line deleted only while a condition on it holds (`lineDelete`); `null` lets every line go. */
  setLineDelete(id: string, when: string | null): boolean;
  /** A table's buttons in one place; `null` or none takes them away. A button kept keeps its id and steps. */
  setTableButtons(id: string, place: TableButtonPlace, buttons: TableButton[] | null): boolean;
  /** How a table's lines open, show on a phone, size their columns, and whether a line can be copied. */
  setTableShape(id: string, shape: TableShape): boolean;
  /** The widths of the form a part is hidden at; `null` shows it at every width. */
  setHideOn(id: string, widths: ScreenWidth[] | null): boolean;
}

const WIDTHS: ScreenWidth[] = ['narrow', 'medium', 'wide'];
/** A role's name, as the format takes it. */
const ROLE = /^!?[A-Za-z0-9_][A-Za-z0-9_.:-]*$/;

export function tableCommands({ apply }: TableCommandsDeps): TableCommands {
  function fieldNode(draft: Page, id: string): FieldNode {
    const found = findNode(draft, id);
    if (!found || found.node.type !== 'field') throw new Refusal((w) => w.refusals.noQuestion(id));
    return found.node;
  }

  /** A field node of a table of lines, and its lines' definition. */
  function table(draft: Page, id: string): { node: FieldNode; def: Extract<Field, { type: 'one2many' }> } {
    const node = fieldNode(draft, id);
    const def = draft.fields[node.field];
    if (def?.type !== 'one2many') throw new Refusal((w) => w.tables.onlyTables);
    return { node, def };
  }

  /** The page a line's conditions are read on: its fields, the record as `parent`. */
  const linePage = (draft: Page, def: Extract<Field, { type: 'one2many' }>): Page =>
    ({ ...draft, fields: { ...def.fields, parent: { type: 'json', label: 'parent' } } }) as unknown as Page;

  /** A condition that does not read is refused, saying what is wrong with it. */
  function refuseCondition(scope: Page, when: string) {
    if (formulaProblem(scope, when)) throw new Refusal((w) => w.rules.inWhen(problemWords(formulaProblem(scope, when, w), w)));
  }

  /** Tones as kept: each condition trimmed and read, none an empty list. */
  function tonesFrom(scope: Page, tones: ToneWhen[] | null): ToneWhen[] | undefined {
    const kept = (tones ?? []).map((item) => ({ tone: item.tone, when: typeof item.when === 'string' ? item.when.trim() : item.when }));
    for (const item of kept) if (typeof item.when === 'string') refuseCondition(scope, item.when);
    return kept.length ? kept : undefined;
  }

  const put = <T extends object, K extends keyof T>(owner: T, key: K, value: T[K] | undefined) => {
    if (value === undefined) delete owner[key];
    else owner[key] = value;
  };

  function cellsOf(node: FieldNode, column: string, def: Extract<Field, { type: 'one2many' }>): CellRules {
    if (!def.fields[column]) throw new Refusal((w) => w.tables.notAColumn(column));
    node.cells ??= {};
    return (node.cells[column] ??= {});
  }

  /** A column left with no rules goes from `cells`, and `cells` with none goes too. */
  function tidy(node: FieldNode) {
    for (const [column, rules] of Object.entries(node.cells ?? {})) if (!Object.keys(rules).length) delete node.cells![column];
    if (node.cells && !Object.keys(node.cells).length) delete node.cells;
  }

  /** An id no part of the page has. */
  function freshId(draft: Page, base: string): string {
    const text = JSON.stringify(draft);
    for (let n = 1; ; n++) if (!text.includes(`"id":"${base}-${n}"`)) return `${base}-${n}`;
  }

  return {
    setFieldTones(id, tones) {
      return apply((draft) => put(fieldNode(draft, id), 'tones', tonesFrom(draft, tones)), `tones:${id}`);
    },

    setFieldBold(id, when) {
      return apply((draft) => {
        const node = fieldNode(draft, id);
        const said = when?.trim() || undefined;
        if (said) refuseCondition(draft, said);
        put(node, 'bold', said);
      }, `bold:${id}`);
    },

    setCellRule(id, column, rule, when) {
      return apply((draft) => {
        const { node, def } = table(draft, id);
        const cell = cellsOf(node, column, def);
        const said = when?.trim() || undefined;
        if (said) refuseCondition(rule === 'hidden' ? draft : linePage(draft, def), said);
        put(cell, rule, said);
        tidy(node);
      }, `cell:${id}:${column}:${rule}`);
    },

    setCellTones(id, column, tones) {
      return apply((draft) => {
        const { node, def } = table(draft, id);
        put(cellsOf(node, column, def), 'tones', tonesFrom(linePage(draft, def), tones));
        tidy(node);
      }, `cell-tones:${id}:${column}`);
    },

    setCellLook(id, column, look) {
      return apply((draft) => {
        const { node, def } = table(draft, id);
        const cell = cellsOf(node, column, def);
        if (look.badge !== undefined) put(cell, 'badge', look.badge ? true : undefined);
        if (look.widget !== undefined) {
          const sub = def.fields[column];
          if (look.widget !== null && !(CELL_WIDGETS[sub?.type ?? ''] ?? []).includes(look.widget)) {
            const widget = look.widget;
            throw new Refusal((w) => w.tables.widgetUnsuited(sub?.label ?? column, w.kinds.names[CELL_WIDGET_KINDS[widget] as keyof typeof w.kinds.names] ?? widget));
          }
          put(cell, 'widget', look.widget ?? undefined);
          // A widget's settings go with it.
          put(cell, 'options', undefined);
        }
        // The roles the column shows to, as a part's: each a name, `!` before one hiding it from people holding it.
        if (look.roles !== undefined) {
          const named = (look.roles ?? []).map((role) => role.trim()).filter(Boolean);
          const wrong = named.find((role) => !ROLE.test(role));
          if (wrong !== undefined) throw new Refusal((w) => w.tables.notARole(wrong));
          put(cell, 'roles', named.length ? named : undefined);
        }
        if (look.width !== undefined) {
          if (look.width !== null && !(Number.isInteger(look.width) && look.width >= 1 && look.width <= 200)) throw new Refusal((w) => w.tables.widthRange);
          put(cell, 'width', look.width ?? undefined);
        }
        tidy(node);
      }, look.width !== undefined ? `cell-width:${id}:${column}` : null);
    },

    setRowTones(id, tones) {
      return apply((draft) => {
        const { node, def } = table(draft, id);
        put(node, 'rowTones', tonesFrom(linePage(draft, def), tones));
      }, `row-tones:${id}`);
    },

    setRowBold(id, when) {
      return apply((draft) => {
        const { node, def } = table(draft, id);
        const said = when?.trim() || undefined;
        if (said) refuseCondition(linePage(draft, def), said);
        put(node, 'rowBold', said);
      }, `row-bold:${id}`);
    },

    setLineDelete(id, when) {
      return apply((draft) => {
        const { node, def } = table(draft, id);
        const said = when?.trim() || undefined;
        if (said) refuseCondition(linePage(draft, def), said);
        put(node, 'lineDelete', said);
      }, `line-delete:${id}`);
    },

    setTableButtons(id, place, buttons) {
      return apply((draft) => {
        const { node, def } = table(draft, id);
        const before = new Map((node[place] ?? []).map((button) => [button.id, button]));
        const scope = place === 'rowButtons' ? linePage(draft, def) : draft;
        const kept: ButtonNode[] = (buttons ?? []).map((button) => {
          const label = button.label.trim();
          if (!label) throw new Refusal((w) => w.tables.buttonNeedsWords);
          const was = button.id ? before.get(button.id) : undefined;
          const made: ButtonNode = { ...(was ?? { type: 'button', id: freshId(draft, `${id}-button`) }), label };
          put(made, 'action', button.action?.trim() || undefined);
          const hidden = button.invisible?.trim() || undefined;
          if (hidden) refuseCondition(scope, hidden);
          put(made, 'invisible', hidden);
          // A button does something: an app action, or the steps it had.
          if (!made.action && !made.steps?.length) made.action = 'action_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
          return made;
        });
        put(node, place, kept.length ? kept : undefined);
      }, `buttons:${id}:${place}`);
    },

    setTableShape(id, shape) {
      return apply((draft) => {
        const { node } = table(draft, id);
        if (shape.lineOpens !== undefined) put(node, 'lineOpens', shape.lineOpens ?? undefined);
        if (shape.cards !== undefined) put(node, 'cards', shape.cards ?? undefined);
        if (shape.fit !== undefined) put(node, 'fit', shape.fit ?? undefined);
        if (shape.copy !== undefined) {
          const options = { ...(node.options ?? {}) };
          if (shape.copy) options['copy'] = true;
          else delete options['copy'];
          put(node, 'options', Object.keys(options).length ? options : undefined);
        }
      });
    },

    setHideOn(id, widths) {
      return apply((draft) => {
        const found = findNode(draft, id);
        if (!found) throw new Refusal((w) => w.refusals.noElement(id));
        const kept = WIDTHS.filter((width) => widths?.includes(width));
        put(found.node as LayoutNode & { hideOn?: ScreenWidth[] }, 'hideOn', kept.length ? kept : undefined);
      });
    },
  };
}
