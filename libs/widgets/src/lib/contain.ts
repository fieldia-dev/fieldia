import { fill } from '@fieldia/core';
import { wordsFor } from './kind-parts';
import type { Widget, WidgetContext, WidgetState } from './widgets';

/**
 * Errors kept to the part that made them. A widget — the app's own, or one of Fieldia's given what it cannot draw — a
 * slot or a map that throws as it is drawn or brought up to date draws a small box in its place, which names it; the
 * rest of the page goes on working, saving included. The error goes to the console, and to the page's `onError`.
 */

/** What was being done when a part failed. */
export type FailureStage = 'draw' | 'update' | 'focus' | 'remove';

/** Where a part of a page failed, as `onError` is told. */
export interface PartFailure {
  stage: FailureStage;
  /** `field` for a field's widget (a table's cell too); else the page part's type: `slot`, `map`, `section`, `text`, … */
  part: string;
  /** The part's id in the page; for a table's cell, `table.line.column`. */
  node?: string;
  /** The field's name, for a field's widget. */
  field?: string;
  /** The widget asked for: `float.fancy`, or the field's type when the page names none. */
  widget?: string;
  /** A slot's name. */
  name?: string;
}

/** Told of each part that failed: once for each, with the error it threw. */
export type ErrorHandler = (error: unknown, where: PartFailure) => void;

/**
 * Tell of a failure: to the page's handler, which tells the console itself (the viewer's does), else to the console.
 * A handler that throws in turn is told to the console too; nothing goes further.
 */
export function reportFailure(error: unknown, where: PartFailure, onError: ErrorHandler | undefined): void {
  if (!onError) {
    console.error(`[Fieldia] ${describeFailure(where)}`, error);
    return;
  }
  try {
    onError(error, where);
  } catch (thrown) {
    console.error('[Fieldia] The page\'s onError threw while it was told of a failure:', thrown);
  }
}

/** A failure in words, for the console: `The field "price" (widget float.fancy) could not be drawn.` */
export function describeFailure(where: PartFailure): string {
  const doing = { draw: 'drawn', update: 'brought up to date', focus: 'focused', remove: 'taken away' }[where.stage];
  const what =
    where.part === 'field' ? `The field "${where.field}"${where.widget ? ` (widget ${where.widget})` : ''}`
    : where.part === 'slot' ? `The slot "${where.name}"`
    : `The ${where.part}${where.node ? ` "${where.node}"` : ''}`;
  return `${what} could not be ${doing}; the rest of the page goes on.`;
}

/**
 * The box drawn in a broken part's place: a mark, and words that name what could not be shown. A status, so a screen
 * reader says it as it appears, without the urgency of an alert: nothing the person did went wrong.
 */
export function brokenBox(doc: Document, words: string): HTMLElement {
  const box = doc.createElement('div');
  box.className = 'fd-broken';
  box.setAttribute('role', 'status');
  const mark = doc.createElement('span');
  mark.className = 'fd-broken-mark';
  mark.setAttribute('aria-hidden', 'true');
  const text = doc.createElement('span');
  text.className = 'fd-broken-words';
  text.textContent = words;
  box.append(mark, text);
  return box;
}

/** The box for a field: "This field could not be shown: Price", in the page's language. */
export function brokenFieldBox(context: Pick<WidgetContext, 'document' | 'labels' | 'locale' | 'field' | 'node'>): HTMLElement {
  const words = wordsFor(context.labels, context.locale);
  return brokenBox(context.document, fill(words.brokenField, { label: context.node.label ?? context.field.label }));
}

/**
 * A widget made by `make`, kept from throwing: made, brought up to date, focused and taken away inside a guard. Made
 * wrong, it is the box from the start; wrong later, the box takes its element's place in the page and the widget is
 * left alone from then on. A widget that works is handed back as it was made.
 *
 * `make` is handed `fail`, for a widget that learns of its own failure later, where no guard is round it: a React or
 * Vue component that threw as it rendered, caught by the binding's boundary. It is the same as throwing in an update.
 */
export function containWidget(make: (fail: (error: unknown) => void) => Widget, context: WidgetContext): Widget {
  const where = (stage: FailureStage): PartFailure => ({
    stage,
    part: 'field',
    field: context.name,
    node: context.node.id,
    widget: context.node.widget ? `${context.field.type}.${context.node.widget}` : context.field.type,
  });
  let inner: Widget | undefined;
  /** A failure told while it is still being made: it is made wrong. */
  let early: { error: unknown } | null = null;
  try {
    inner = make((error) => (inner ? fail(error, 'update') : (early ??= { error })));
  } catch (error) {
    early = { error };
  }
  if (early || !inner) {
    reportFailure(early?.error, where('draw'), context.onError);
    const box = brokenFieldBox(context);
    return { element: box, update: () => undefined, focus: () => box.focus() };
  }
  const made: Widget = inner;
  let box: HTMLElement | null = null;
  const fail = (error: unknown, stage: FailureStage) => {
    reportFailure(error, where(stage), context.onError);
    if (stage !== 'update' || box) return;
    box = brokenFieldBox(context);
    const element = made.element;
    if (element.parentNode) element.replaceWith(box);
    // Its own clean-up still runs: what it holds open (a timer, a listener on the page) is let go.
    try {
      made.destroy?.();
    } catch {
      // Broken already: said once.
    }
  };
  return {
    get element() {
      return box ?? made.element;
    },
    get tools() {
      return box ? undefined : made.tools;
    },
    update(state: WidgetState) {
      if (box) return;
      try {
        made.update(state);
      } catch (error) {
        fail(error, 'update');
      }
    },
    focus() {
      if (box) return;
      try {
        made.focus();
      } catch (error) {
        fail(error, 'focus');
      }
    },
    destroy() {
      if (box) return;
      try {
        made.destroy?.();
      } catch (error) {
        fail(error, 'remove');
      }
    },
  };
}
