import type { ActionStep, ButtonNode, Form, FormState, RunResult, Tone } from '@fieldia/core';
import type { IconSet, Loading } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';

/** What a button of the newer kinds needs of the viewer that draws it. */
export interface ButtonContext {
  doc: Document;
  el: El;
  form: Form;
  labels: ViewerLabels;
  icons?: IconSet;
  uid(id: string): string;
  withIcon(name: string | undefined, text: string): (Node | string)[];
  /** A press: one run at a time, the button busy meanwhile. */
  press(button: HTMLElement, run: () => Promise<RunResult>): Promise<void>;
  say(message: string, tone: Tone): void;
  /** Its updater, run at every change of the form. */
  watch(update: (state: FormState) => void): void;
  cleanups: (() => void)[];
  /** How the page waits (loading.ts): a menu's items the app gives, as they come. */
  loading?: Loading;
}

/** Whether a button asks for more than words and steps: its icon alone, a toggle, a menu, a look that follows the record's changes. */
export function isRichButton(node: ButtonNode): boolean {
  return !!(node.iconOnly || node.pressed !== undefined || node.menu?.length || node.primaryWhenChanged);
}

/** Steps that only put back what changed: Undo's. */
export const onlyResets = (steps: readonly ActionStep[] | undefined, action?: string) => !!steps?.length && action === undefined && steps.every((step) => step.do === 'reset');

/**
 * A press that has nothing to do says so instead: Undo with nothing changed
 * ("Nothing has changed."), never a control greyed out without a reason.
 * True when it said so.
 */
export function nothingToUndo(node: ButtonNode, form: Form, say: (message: string, tone: Tone) => void, labels: ViewerLabels): boolean {
  if (!onlyResets(node.steps, node.action) || form.getState().dirty.length) return false;
  say(labels.nothingChanged, 'info');
  return true;
}
