import { fill, optionsList, type Field, type Option } from '@fieldia/core';
import { wordsFor } from './kind-parts';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';
import { startLoading, type Wait } from './loading';

/**
 * A choice whose options change: one of the app's lists, options shown by a
 * condition on the other answers, or those carried from an earlier question —
 * the widget the field would have anyway, drawn afresh as the options it
 * offers change (`form.offered`). While a list's choices load it says so, as its wait says (`search`, loading.ts:
 * "Loading choices…" past the delay, never a flash); when
 * they fail it offers to load them again; and a value no longer offered that
 * the record held as it was opened is kept — the person decides — and said.
 * One a change no longer offers is taken out by the form, which says so
 * (`takenOut`): under the field on a page, and here, under its cell, in a
 * table's line (its `lineForm`) — whose choices are the line's own, asked
 * again where the form let them go (another record's line of the same key).
 */
export function listChoices(factory: WidgetFactory, context: WidgetContext): Widget {
  const { form, name, document: doc } = context;
  const listed = context.field.type === 'selection' && !!optionsList(context.field.optionsFrom);
  const words = wordsFor(context.labels, context.locale);
  const box = doc.createElement('div');
  const note = doc.createElement('div');
  const retry = doc.createElement('button');
  retry.type = 'button';
  retry.className = 'fd-button fd-button-link';
  retry.textContent = words.choicesFailed;
  retry.onclick = () => form.loadChoices(name);
  retry.hidden = true;
  note.setAttribute('role', 'status');
  note.hidden = true;
  // Spaced as a field's own parts are.
  box.style.cssText = 'display:grid;gap:4px';
  /** Every choice it has offered, to name a value it no longer offers. */
  const named = new Map<unknown, string>();
  let inner: Widget;
  let shown: readonly Option[] | null = null;
  /** The options drawn, by their values and words: drawn again only when they change. */
  let drawnKey = '';
  /** Its choices' wait, while they load. */
  let wait: Wait | null = null;
  const draw = (options: readonly Option[]) => {
    inner?.destroy?.();
    inner = factory({ ...context, field: { ...context.field, options } as Field });
    // Named by the field's label, as the viewer names a widget with a role of its own.
    if (inner.element.getAttribute('role')) inner.element.setAttribute('aria-labelledby', `${context.id}-label`);
    box.replaceChildren(inner.element, note, retry);
  };
  /**
   * The options offered now: a list's once loaded, else what the form offers — an option's words that show an answer
   * given (`{branch}`) as they read now, whether it is the choice's own, shown by a condition or carried from another.
   */
  const offeredNow = (): readonly Option[] | null => {
    if (listed && !form.getState().choices[name]?.options) return null;
    const options = form.offered?.(name) ?? form.getState().choices[name]?.options ?? null;
    return options?.some((option) => option.label.includes('{')) ? options.map((option) => (option.label.includes('{') ? { ...option, label: form.words(option.label) } : option)) : options;
  };
  const first = offeredNow();
  if (first) {
    shown = first;
    drawnKey = keyOf(first);
    for (const option of first) named.set(option.value, option.label);
  }
  draw(first ?? []);
  if (listed && !form.getState().choices[name]) form.loadChoices(name);
  return {
    element: box,
    focus: (options?: FocusOptions) => inner.focus(options),
    destroy: () => {
      wait?.stop();
      inner.destroy?.();
    },
    update(state) {
      let choices = listed ? form.getState().choices[name] : undefined;
      // A line's, let go by the form (another record's line of the same key), asked again.
      if (listed && !choices) {
        form.loadChoices(name);
        choices = form.getState().choices[name];
      }
      // Its choices asked for: their wait, said under it past the delay; failed, its button to load them again.
      if (choices?.loading && !wait) {
        wait = startLoading(box, 'search', context.loading, {
          part: context.node.id,
          words: words.loadingChoices,
          place: (loader) => {
            loader.classList.add('fd-help');
            note.before(loader);
          },
          failed: () => !(retry.hidden = false),
        });
      } else if (!choices?.loading && wait) {
        const asked = wait;
        wait = null;
        if (choices?.error) asked.fail(new Error(choices.error), () => form.loadChoices(name));
        else void asked.done();
      }
      const options = offeredNow();
      if (options && keyOf(options) !== drawnKey) {
        shown = options;
        drawnKey = keyOf(options);
        for (const option of options) named.set(option.value, option.label);
        draw(options);
      }
      inner.update(state);
      // With "Other", a value not among them is an answer of the person's own.
      const lost = shown && !(context.field as { other?: boolean }).other ? [state.value].flat().filter((v) => v != null && !shown?.some((o) => o.value === v)) : [];
      note.className = 'fd-warning';
      note.textContent = lost.length
        ? fill(words.notOffered, { name: lost.map((v) => named.get(v) ?? labelIn(context.field, v)).join(', ') })
        : // A line's, taken out as its line changed: the page says a field's under it.
          ((form.line ? form.getState().takenOut?.[name] : undefined) ?? '');
      note.hidden = !note.textContent;
      // Loading again sets the failure aside, and the button with it.
      if (!choices?.error) retry.hidden = true;
    },
  };
}

/** Options as their values and words, to tell when they change. */
const keyOf = (options: readonly Option[]) => JSON.stringify(options.map((o) => [o.value, o.label, o.image ?? null]));

/** A value's label among the field's own options, else the value. */
const labelIn = (field: Field, value: unknown) => (field.type === 'selection' ? field.options.find((o) => o.value === value)?.label : undefined) ?? String(value);
