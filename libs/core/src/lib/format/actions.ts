import * as z from 'zod';
import { FilterItemSchema, type FilterItem } from './field';
import { JsonValueSchema, type JsonValue } from './json';
import type { Modifier, Tone } from './layout';

/**
 * What a press, a change or a moment of the form does: steps, run in order,
 * each plain data — never code. Anything only the app can do is a `call` of
 * one of its own actions, by name. A step may run only `when` a condition
 * holds. A step that fails or is refused stops the ones after it: a check
 * that finds problems, a question answered No, a save that cannot be made,
 * an app action that says stop, a page opened and closed without saving.
 *
 * Expressions are the format's own (`price * quantity`, `'Cairo'`,
 * `today()`), read against the form's values where the step runs.
 */

/** Values for fields, by name: each an expression. */
export type ValueMap = { [field: string]: string };

interface StepBase {
  /** Run this step only while this holds; skipped, the steps after it still run. */
  when?: Modifier;
}

/**
 * The edge a panel comes from: the end of the line (the default: the right,
 * or the left in a page written right to left) or its start, as the page
 * reads; or the left, right, top or bottom of the screen, whatever the page's
 * direction. A panel at the top or bottom runs the whole width.
 */
export type PanelSide = 'end' | 'start' | 'right' | 'left' | 'top' | 'bottom';

/**
 * Open another page: in a dialog over this form (the default), in a panel
 * beside it, or in its place. A list page shows only the records its
 * `filter` lets through — each `valueFrom` read from this form — such as the
 * invoices of this order, as Flectra's smart buttons open them. A panel comes from the `side` named, the end of
 * the line unless told. It starts on a record (`record`, an expression
 * giving its id) or a new one with `values`. Once it is saved or sent, `into`
 * sets this form's fields from its answers — each an expression over the
 * opened form's values, where `id` is the record it saved — and `then` runs
 * here. Closed without saving, the steps after it do not run.
 */
export interface OpenStep extends StepBase {
  do: 'open';
  /** The page's id, as the app's `pages` finds it. */
  page: string;
  /** One published version; left out, the latest. */
  version?: number;
  as?: 'dialog' | 'panel' | 'page';
  /** Where a panel comes from (`as: 'panel'` alone): the end of the line unless told. */
  side?: PanelSide;
  /** The words over it; left out, the page's own title. */
  title?: string;
  record?: string;
  /** What the opened form starts with: its fields, each an expression over this form's values. */
  values?: ValueMap;
  /** On a list page, the records it shows: conditions as a link's filter, `valueFrom` naming this form's fields. */
  filter?: FilterItem[];
  /** This form's fields, each an expression over the opened form's values once it is saved or sent. */
  into?: ValueMap;
  then?: ActionStep[];
}

/** Give a field of this form a value: an expression over its values. */
export interface SetStep extends StepBase {
  do: 'set';
  field: string;
  value: string;
}

/** Empty a field of this form. */
export interface ClearStep extends StepBase {
  do: 'clear';
  field: string;
}

/** Add a line to a table of lines (a one2many), its fields from expressions over this form's values. */
export interface AddLineStep extends StepBase {
  do: 'addLine';
  field: string;
  values?: ValueMap;
}

/** Check the form — or only these fields — as sending does: problems are shown, and stop the steps after it. */
export interface CheckStep extends StepBase {
  do: 'check';
  fields?: string[];
}

/** Save the record, or send the answers: a page of responses sends. Refused, it stops the steps after it. */
export interface SaveStep extends StepBase {
  do: 'save';
}

/** Put the form back as it was loaded, or empty for a new one. */
export interface ResetStep extends StepBase {
  do: 'reset';
}

/** Show a wizard's step or a tab, by its id. */
export interface GoToStep extends StepBase {
  do: 'goTo';
  target: string;
}

/** Say something to the person, in a tone. */
export interface SayStep extends StepBase {
  do: 'say';
  message: string;
  tone?: Tone;
}

/** Ask a question answered Yes or No: No stops the steps after it. */
export interface AskStep extends StepBase {
  do: 'ask';
  message: string;
}

/**
 * One of the app's own actions, by the name its `onAction` receives, with
 * `params`. The app may answer: values to set, something to say, a page to
 * open, or to stop the steps after it.
 */
export interface CallStep extends StepBase {
  do: 'call';
  action: string;
  params?: { [key: string]: JsonValue };
}

/** Close the dialog or panel this form was opened in, without saving it. */
export interface CloseStep extends StepBase {
  do: 'close';
}

/** Load the record again, as its data source now has it: after the app has changed it on its server. */
export interface ReloadStep extends StepBase {
  do: 'reload';
}

/** Open a web address, an expression: in a new tab unless `newTab` is false. Flectra's `act_url`. */
export interface OpenUrlStep extends StepBase {
  do: 'openUrl';
  url: string;
  newTab?: boolean;
}

export type ActionStep = OpenStep | SetStep | ClearStep | AddLineStep | CheckStep | SaveStep | ResetStep | GoToStep | SayStep | AskStep | CallStep | CloseStep | ReloadStep | OpenUrlStep;

/**
 * The moments of a form that run steps. A change is a person's: values set by
 * a step, a rule or the app do not run `change` again, so steps never chase
 * each other round.
 */
export interface PageEvents {
  /** When the form has its values: loaded, or new. */
  open?: ActionStep[];
  /** When a person changes a field, by its name. */
  change?: { [field: string]: ActionStep[] };
  /** Before it is saved or sent: a step that stops keeps it unsaved. */
  beforeSave?: ActionStep[];
  /** After it is saved or sent. */
  afterSave?: ActionStep[];
  /** When a wizard's step or a tab is shown, by its id. */
  show?: { [id: string]: ActionStep[] };
}

/** The steps of a step, a button or a moment: what each kind of step may say, nothing else. */
const when = z.union([z.boolean(), z.string().min(1)]).optional();
const expression = z.string().min(1);
const name = z.string().min(1);
const valueMap = z.record(z.string().min(1), expression);
const steps = (): z.ZodArray<typeof ActionStepSchema> => z.array(ActionStepSchema).min(1);

export const OpenStepSchema = z.strictObject({
  do: z.literal('open'),
  when,
  page: name,
  version: z.int().min(1).optional(),
  as: z.enum(['dialog', 'panel', 'page']).optional(),
  side: z.enum(['end', 'start', 'right', 'left', 'top', 'bottom']).optional(),
  title: z.string().optional(),
  record: expression.optional(),
  values: valueMap.optional(),
  filter: z.array(FilterItemSchema).min(1).optional(),
  into: valueMap.optional(),
  get then(): z.ZodOptional<z.ZodArray<typeof ActionStepSchema>> {
    return steps().optional();
  },
});

export const ActionStepSchema = z
  .discriminatedUnion('do', [
    OpenStepSchema,
    z.strictObject({ do: z.literal('set'), when, field: name, value: expression }),
    z.strictObject({ do: z.literal('clear'), when, field: name }),
    z.strictObject({ do: z.literal('addLine'), when, field: name, values: valueMap.optional() }),
    z.strictObject({ do: z.literal('check'), when, fields: z.array(name).min(1).optional() }),
    z.strictObject({ do: z.literal('save'), when }),
    z.strictObject({ do: z.literal('reset'), when }),
    z.strictObject({ do: z.literal('goTo'), when, target: name }),
    z.strictObject({ do: z.literal('say'), when, message: z.string().min(1), tone: z.enum(['info', 'success', 'warning', 'danger', 'muted']).optional() }),
    z.strictObject({ do: z.literal('ask'), when, message: z.string().min(1) }),
    z.strictObject({ do: z.literal('call'), when, action: name, params: z.record(z.string(), JsonValueSchema).optional() }),
    z.strictObject({ do: z.literal('close'), when }),
    z.strictObject({ do: z.literal('reload'), when }),
    z.strictObject({ do: z.literal('openUrl'), when, url: expression, newTab: z.boolean().optional() }),
  ])
  .meta({ id: 'ActionStep' });

export const ActionStepsSchema = steps();

export const PageEventsSchema = z
  .strictObject({
    open: steps().optional(),
    change: z.record(z.string().min(1), steps()).optional(),
    beforeSave: steps().optional(),
    afterSave: steps().optional(),
    show: z.record(z.string().min(1), steps()).optional(),
  })
  .meta({ id: 'PageEvents' });
