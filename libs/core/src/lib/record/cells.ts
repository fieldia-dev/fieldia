import type { ButtonNode, CellRules, FieldNode, Tone, ToneWhen } from '../format/layout';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import type { ExpressionEnv } from '../expression/functions';
import { rolesAllow } from './roles';

/** A cell of a table's line, as its rules have it now. */
export interface CellState {
  invisible: boolean;
  readonly: boolean;
  required: boolean;
  tone: Tone | null;
  bold: boolean;
}

/** A table's line, as its rules have it now: its tone, each column's cells, and which of its buttons show. */
export interface LineState {
  tone: Tone | null;
  bold: boolean;
  cells: Record<string, CellState>;
  buttons: Record<string, boolean>;
}

interface CompiledTone {
  tone: Tone;
  when: CompiledModifier;
}

interface CompiledCell {
  invisible: CompiledModifier;
  readonly: CompiledModifier;
  required: CompiledModifier;
  hidden: CompiledModifier;
  tones: CompiledTone[];
  bold: CompiledModifier;
}

/** A table node's rules, each read once. */
export interface CompiledTable {
  /** The line as its rules have it: `line` its fields as expressions read them, with `parent`. */
  line(context: Record<string, unknown>, env: ExpressionEnv, roles: readonly string[]): LineState;
  /** Whether a column is hidden now, read on the record. */
  hidden(column: string, record: Record<string, unknown>, env: ExpressionEnv): boolean;
  buttons: readonly ButtonNode[];
}

/** A field's own value as its tones have it now: Flectra's decoration-* on a field. */
export interface FieldTone {
  tone: Tone | null;
  bold: boolean;
}

/** A field node's tones and bold, read once; read on the record. */
export function compileFieldTone(node: Pick<FieldNode, 'tones' | 'bold'>): (context: Record<string, unknown>, env: ExpressionEnv) => FieldTone {
  const tones = tonesOf(node.tones);
  const bold = compileModifier(node.bold);
  return (context, env) => ({ tone: toneNow(tones, context, env), bold: bold.evaluate(context, env) });
}

const tonesOf = (list: readonly ToneWhen[] | undefined): CompiledTone[] => (list ?? []).map((item) => ({ tone: item.tone, when: compileModifier(item.when) }));
const toneNow = (list: readonly CompiledTone[], context: Record<string, unknown>, env: ExpressionEnv) => list.find((item) => item.when.evaluate(context, env))?.tone ?? null;

export function compileTable(node: FieldNode): CompiledTable {
  const cells = new Map<string, CompiledCell>();
  for (const [column, rules] of Object.entries(node.cells ?? {}) as [string, CellRules][]) {
    cells.set(column, {
      invisible: compileModifier(rules.invisible),
      readonly: compileModifier(rules.readonly),
      required: compileModifier(rules.required),
      hidden: compileModifier(rules.hidden),
      tones: tonesOf(rules.tones),
      bold: compileModifier(rules.bold),
    });
  }
  const rowTones = tonesOf(node.rowTones);
  const rowBold = compileModifier(node.rowBold);
  const buttons = node.rowButtons ?? [];
  const shown = buttons.map((button) => ({ id: button.id, roles: button.roles, invisible: compileModifier(button.invisible) }));
  return {
    buttons,
    line(context, env, roles) {
      const state: LineState = { tone: toneNow(rowTones, context, env), bold: rowBold.evaluate(context, env), cells: {}, buttons: {} };
      for (const [column, cell] of cells) {
        state.cells[column] = {
          invisible: cell.invisible.evaluate(context, env),
          readonly: cell.readonly.evaluate(context, env),
          required: cell.required.evaluate(context, env),
          tone: toneNow(cell.tones, context, env),
          bold: cell.bold.evaluate(context, env),
        };
      }
      for (const button of shown) state.buttons[button.id] = rolesAllow(button.roles, roles) && !button.invisible.evaluate(context, env);
      return state;
    },
    hidden: (column, record, env) => cells.get(column)?.hidden.evaluate(record, env) ?? false,
  };
}

/** What a cell is when its column has no rules. */
export const PLAIN_CELL: CellState = { invisible: false, readonly: false, required: false, tone: null, bold: false };
