import { fill, type Field, type Option } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * A choice whose options are one of the app's lists: the widget the field
 * would have anyway, drawn afresh from each answer the list gives. While the
 * choices load it says so; when they fail it offers to load them again; and
 * a value the list no longer offers is kept — the person decides — and said.
 */
export function listChoices(factory: WidgetFactory, context: WidgetContext): Widget {
  const { form, name, document: doc } = context;
  const words = context.labels ?? WIDGET_LABELS[context.locale ?? 'en'];
  const box = doc.createElement('div');
  const note = doc.createElement('p');
  const retry = doc.createElement('button');
  retry.type = 'button';
  retry.className = 'fd-button fd-button-link';
  retry.textContent = words.choicesFailed;
  retry.onclick = () => form.loadChoices(name);
  note.setAttribute('role', 'status');
  /** Every choice the list has given, to name a value it no longer offers. */
  const named = new Map<unknown, string>();
  let inner: Widget;
  let shown: Option[] | null = null;
  const draw = (options: Option[]) => {
    inner?.destroy?.();
    inner = factory({ ...context, field: { ...context.field, options } as Field });
    // Named by the field's label, as the viewer names a widget with a role of its own.
    if (inner.element.getAttribute('role')) inner.element.setAttribute('aria-labelledby', `${context.id}-label`);
    box.replaceChildren(inner.element, note, retry);
  };
  draw([]);
  if (!form.getState().choices[name]) form.loadChoices(name);
  return {
    element: box,
    focus: () => inner.focus(),
    destroy: () => inner.destroy?.(),
    update(state) {
      const choices = form.getState().choices[name];
      if (choices?.options && choices.options !== shown) {
        shown = choices.options;
        for (const option of shown) named.set(option.value, option.label);
        draw(shown);
      }
      inner.update(state);
      // With "Other", a value not among them is an answer of the person's own.
      const lost = shown && !(context.field as { other?: boolean }).other ? [state.value].flat().filter((v) => v != null && !shown?.some((o) => o.value === v)) : [];
      note.className = choices?.loading ? 'fd-help' : 'fd-warning';
      note.textContent = choices?.loading ? words.loadingChoices : lost.length ? fill(words.notOffered, { name: lost.map((v) => named.get(v) ?? String(v)).join(', ') }) : '';
      note.hidden = !note.textContent;
      retry.hidden = !choices?.error || !!choices.loading;
    },
  };
}
