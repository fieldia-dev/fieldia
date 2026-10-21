import * as z from 'zod';
import { makeSchemasJitless } from './jitless';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

/**
 * The pickers' own settings in a field's `options`, as a work tracker draws
 * them: a path picker for a record of a tree (`"widget": "path"` on a
 * many2one: an area, an iteration), Fieldia's own list for a choice
 * (`"list": "own"`), a state's dots in exact colours and its list with a tick
 * alone (`"widget": "dot"`), and tags added from a button (`"adder":
 * "button"`). Known to the format, so a word written wrong is refused before
 * anything draws; the other settings these widgets take (a link's picture,
 * a dot's tones) stay as they are.
 */

const COLOUR = /^#[0-9a-fA-F]{6}$/;

/** A path picker: `"widget": "path"` on a many2one. */
export const PathPickerOptionsSchema = z
  .object({
    /** What joins the names of a path: "\" unless said. */
    separator: z.string().min(1).max(3).optional(),
    /** How many the list suggests first — the value and the person's latest picks: 5 unless said, 0 for none. */
    suggestions: z.number().int().min(0).max(20).optional(),
    /** The tree of every record under the suggestions: shown unless false. */
    tree: z.boolean().optional(),
  })
  .meta({ id: 'PathPickerOptions' });

/** A state's dot: `"widget": "dot"` on a selection. */
export const StateDotOptionsSchema = z
  .object({
    /** Each value's own colour, as #rrggbb: it wins over the value's tone. */
    colours: z.record(z.string(), z.string().regex(COLOUR, 'a colour is #rrggbb, such as "#007acc"')).optional(),
    /** False: the list of states shows a tick by the one picked, and no dots. */
    listDots: z.boolean().optional(),
  })
  .meta({ id: 'StateDotOptions' });

/** The settings any picker of these may have on a node of the widget it names. */
const SHARED = z.object({
  /** "own": Fieldia's own list in place of the browser's, a tick by the option picked (a choice with no widget). */
  list: z.literal('own', { error: 'list is "own": Fieldia’s own list in place of the browser’s' }).optional(),
  /** "button": tags are added from a button that turns into the tag box ("Add Tag"). */
  adder: z.literal('button', { error: 'adder is "button": tags added from a button that turns into the tag box' }).optional(),
});

export type PathPickerOptions = z.infer<typeof PathPickerOptionsSchema>;
export type StateDotOptions = z.infer<typeof StateDotOptionsSchema>;

/** The issues of a field node's picker settings, each at its path under `options`. */
export function pickerOptionIssues(node: { widget?: string; options?: Record<string, unknown> }): { message: string; path: (string | number)[] }[] {
  const options = node.options ?? {};
  const schemas = [SHARED, ...(node.widget === 'path' ? [PathPickerOptionsSchema] : []), ...(node.widget === 'dot' ? [StateDotOptionsSchema] : [])];
  return schemas.flatMap((schema) => (schema.safeParse(options).error?.issues ?? []).map((issue) => ({ message: issue.message, path: ['options', ...issue.path] as (string | number)[] })));
}
