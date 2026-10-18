import { fill, labelAt, type LineField, type Value } from '@fieldia/core';
import { cellText } from './display';
import { handedForm } from './handed';
import { wordsFor } from './kind-parts';
import type { Widget, WidgetContext, WidgetState } from './widgets';

/**
 * Errors kept to the part that made them. A widget — the app's own, or one of Fieldia's given what it cannot draw — a
 * slot or a map that throws as it is drawn or brought up to date draws a small box in its place, which names it; the
 * rest of the page goes on working, saving included. The error goes to the console, and to the page's `onError`.
 *
 * A field that fails on a change the person made in it — typing, as it took the key that broke it — does not keep that
 * change unseen, to be saved: the field goes back to the value its widget last showed, and the box says so, with the
 * value. The focus that was in the widget goes to the box, which can take it: it says what failed.
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

/** Each box's own ids, for the words that name it. */
let boxes = 0;

/**
 * The box drawn in a broken part's place: a mark, and words that name what could not be shown. A status, so a screen
 * reader says it as it appears, without the urgency of an alert: nothing the person did went wrong. It takes the focus
 * in the part's place in the order — Tab finds it, and a part that held the focus as it failed hands it here — and is
 * named by its words. `more`, when given, is said after them: a field's change that was not kept, and what it holds.
 */
export function brokenBox(doc: Document, words: string, more?: string): HTMLElement {
  const box = doc.createElement('div');
  box.className = 'fd-broken';
  box.setAttribute('role', 'status');
  box.tabIndex = 0;
  const id = `fd-broken-${++boxes}`;
  box.setAttribute('aria-labelledby', `${id}-words`);
  const mark = doc.createElement('span');
  mark.className = 'fd-broken-mark';
  mark.setAttribute('aria-hidden', 'true');
  const text = doc.createElement('span');
  text.className = 'fd-broken-words';
  text.id = `${id}-words`;
  text.textContent = words;
  box.append(mark, text);
  if (more) {
    const kept = doc.createElement('span');
    kept.className = 'fd-broken-kept';
    kept.id = `${id}-kept`;
    kept.textContent = more;
    box.setAttribute('aria-describedby', kept.id);
    box.append(kept);
  }
  return box;
}

/**
 * The box for a field: "This field could not be shown: Price", in the page's language. With `back`, the value it went
 * back to as it failed on the person's change, as the field shows it — an amount in its currency, a share as a per
 * cent: "Your change was not kept: it is back to EGP 450.00."
 */
export function brokenFieldBox(
  context: Pick<WidgetContext, 'document' | 'labels' | 'locale' | 'field' | 'node'> & Partial<Pick<WidgetContext, 'form'>>,
  back?: { value: Value | undefined; values: Readonly<Record<string, Value>>; parent?: Readonly<Record<string, Value>> }
): HTMLElement {
  const words = wordsFor(context.labels, context.locale);
  const { widget, options } = context.node;
  const shown = back ? cellText(context.field as LineField, back.value, back.values as Record<string, Value>, context.locale, back.parent, { widget, options }) : '';
  const more = back ? (shown ? fill(words.brokenKept, { value: shown }) : words.brokenKeptEmpty) : undefined;
  const label = labelAt(words.brokenField, 'label', context.form?.page.lowerLabels, context.locale)(context.node.label ?? context.field.label);
  return brokenBox(context.document, fill(words.brokenField, { label }), more);
}

/**
 * Whether the focus is in an element, or was until the part of it that held it was taken out of the page — a
 * framework's component that threw, which its framework drew as nothing — and it has gone nowhere since.
 */
export function focusHeld(element: HTMLElement): () => boolean {
  let inside = false;
  let left: Element | null = null;
  element.addEventListener('focusin', () => {
    inside = true;
    left = null;
  });
  element.addEventListener('focusout', (event) => {
    if (element.contains(event.relatedTarget as Node | null)) return;
    inside = false;
    left = event.target as Element;
  });
  return () => {
    const doc = element.ownerDocument;
    const now = doc.activeElement;
    if (now && now !== doc.body) return element.contains(now);
    // Taken out: some browsers say the focus left (Chrome), some never do (Firefox).
    return inside || (left !== null && !left.isConnected);
  };
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * A widget made by `make`, kept from throwing: made, brought up to date, focused and taken away inside a guard. Made
 * wrong, it is the box from the start; wrong later, the box takes its element's place in the page and the widget is
 * left alone from then on. A widget that works is handed back as it was made.
 *
 * `make` is handed the form the widget is to write through, which notes the person's changes made in it; `fail`, for
 * a widget that learns of its own failure later, where no guard is round it: a React or Vue component that threw as it
 * rendered, caught by the binding's boundary — the same as throwing in an update; and `drew`, for such a widget to say
 * each value it has drawn.
 *
 * Failing on a change the person made in it and it never showed, the field goes back to the value it last showed: a
 * change it cannot show is not kept, to be saved unseen. The box says so, with that value.
 */
export function containWidget(make: (own: Pick<WidgetContext, 'form' | 'fail' | 'drew'>) => Widget, context: WidgetContext): Widget {
  const where = (stage: FailureStage): PartFailure => ({
    stage,
    part: 'field',
    field: context.name,
    node: context.node.id,
    widget: context.node.widget ? `${context.field.type}.${context.node.widget}` : context.field.type,
  });
  const own = handedForm(context.form, context.name);
  /** The value it last showed: drawn without throwing. */
  let good: { value: Value | undefined } | null = null;
  /** In a table's cell, the record its line is on, as its last update told: an amount there is in that record's currency. */
  let parent: Readonly<Record<string, Value>> | undefined;
  /** It says what it drew (`drew`): an update that returns has not drawn anything yet. */
  let drawsLater = false;
  const shown = (value: Value | undefined) => {
    good = { value };
    if (own.written && same(own.written.value, value)) own.written = null;
  };
  let inner: Widget | undefined;
  /** A failure told while it is still being made: it is made wrong. */
  let early: { error: unknown } | null = null;
  let box: HTMLElement | null = null;
  /** Where the focus is, for a widget its framework draws: what threw is drawn as nothing, the focus with it. */
  let held: (() => boolean) | null = null;
  try {
    inner = make({
      form: own.form,
      fail: (error) => (inner ? fail(error, 'update') : (early ??= { error })),
      drew: (value) => {
        drawsLater = true;
        if (inner && !held) held = focusHeld(inner.element);
        if (!box) shown(value);
      },
    });
  } catch (error) {
    early = { error };
  }
  if (early || !inner) {
    reportFailure(early?.error, where('draw'), context.onError);
    const broken = brokenFieldBox(context);
    return { element: broken, update: () => undefined, focus: () => broken.focus() };
  }
  const made: Widget = inner;
  /** The value to go back to: the person changed it in this widget, which failed on it, never having shown it. */
  const backTo = (): { value: Value | undefined; values: Readonly<Record<string, Value>>; parent?: Readonly<Record<string, Value>> } | null => {
    const written = own.written;
    if (!written || !good) return null;
    let values: Readonly<Record<string, Value>>;
    try {
      values = context.form.getState().values;
    } catch {
      return null;
    }
    if (!same(values[context.name], written.value) || same(values[context.name], good.value)) return null;
    own.written = null;
    return { value: good.value, values, ...(parent ? { parent } : {}) };
  };
  const fail = (error: unknown, stage: FailureStage) => {
    reportFailure(error, where(stage), context.onError);
    if (stage !== 'update' || box) return;
    const focused = held ? held() : made.element.contains(made.element.ownerDocument.activeElement);
    const back = backTo();
    box = brokenFieldBox(context, back ?? undefined);
    const element = made.element;
    if (element.parentNode) element.replaceWith(box);
    if (focused) box.focus();
    // Its own clean-up still runs: what it holds open (a timer, a listener on the page) is let go.
    try {
      made.destroy?.();
    } catch {
      // Broken already: said once.
    }
    // Put back once the change that broke it has gone round the form: not in the middle of telling it.
    if (back) {
      queueMicrotask(() => {
        try {
          context.form.setValue(context.name, (back.value ?? null) as Value);
        } catch (thrown) {
          reportFailure(thrown, where('update'), context.onError);
        }
      });
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
      parent = state.parent;
      try {
        made.update(state);
        if (!drawsLater) shown(state.value);
      } catch (error) {
        fail(error, 'update');
      }
    },
    focus() {
      if (box) return box.focus();
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
