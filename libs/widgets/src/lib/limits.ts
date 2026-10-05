import type { FieldNode } from '@fieldia/core';
import { fillIn, maker, setHidden, setText, wordsFor } from './kind-parts';
import type { Widget, WidgetContext } from './widgets';

/**
 * What a text box shows of its limits: a count of the characters typed
 * against its field's most, under it — "12 / 100", in the warning colour from
 * nine tenths on, and how many are left said to a screen reader once typing
 * pauses — for a page's own field, not a table's cell; and a paragraph's rows,
 * growing as people type unless the page says not to (`autoGrow: false`).
 */
export function counted(widget: Widget, { form, name, field, document, labels, locale }: WidgetContext, box: HTMLInputElement | HTMLTextAreaElement): Widget {
  const size = field.type === 'char' || field.type === 'text' ? field.size : undefined;
  if (!size || form.page.fields[name] !== field) return widget;
  const make = maker(document);
  const shown = make('div', { class: 'fd-count', 'aria-hidden': 'true' });
  const said = make('div', { class: 'fd-sr-only', 'aria-live': 'polite' });
  let pause: ReturnType<typeof setTimeout> | undefined;
  return {
    ...widget,
    element: make('div', { class: 'fd-counted' }, widget.element, shown, said),
    update(state) {
      widget.update(state);
      const n = box.value.length;
      setText(shown, `${n} / ${size}`);
      shown.classList.toggle('fd-count-near', n >= size * 0.9);
      setHidden(shown, state.readonly);
      if (document.activeElement !== box) return;
      clearTimeout(pause);
      pause = setTimeout(() => setText(said, fillIn(wordsFor(labels, locale).charactersLeft, { n: size - n })), 700);
    },
  };
}

/** A paragraph's rows (`options.rows`), and a way to grow it to what it holds — nothing when it keeps its height. */
export function grower(area: HTMLTextAreaElement, node: FieldNode): () => void {
  const rows = node.options?.['rows'];
  if (typeof rows === 'number') area.rows = rows;
  if (node.options?.['autoGrow'] === false) return () => undefined;
  return () => {
    area.style.height = '';
    // Its height takes its borders too: what scrolls, and the borders round it.
    if (area.scrollHeight) area.style.height = `${area.scrollHeight + area.offsetHeight - area.clientHeight}px`;
  };
}
