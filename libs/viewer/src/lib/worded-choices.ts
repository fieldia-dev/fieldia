import type { Field, Option } from '@fieldia/core';
import type { Widget, WidgetContext } from '@fieldia/widgets';

/**
 * A choice whose options' words show answers given — "Yes, call me at {branch}" — drawn by the widget it would have
 * anyway (`draw`: the viewer's createWidget), each option's words filled in as the page shows them (`form.words`) and
 * again as those answers change: in the options it reads them from (a list that opens later, a search, "Other" naming
 * one) and where it shows them already. Its value, its box and its focus stay as they are. Any other field's widget is
 * drawn as it is.
 */
export function wordedWidget(context: WidgetContext, draw: (context: WidgetContext) => Widget): Widget {
  const { form, field } = context;
  // Any other field, or a choice whose words name no answer: its widget as it is. A choice whose options change — a
  // list's, a condition's, carried from another question — is drawn afresh as they do, its words filled in (choices-from.ts).
  if (field.type !== 'selection' || field.optionsFrom || form.offersChange?.(context.name) || !field.options.some((option) => option.label.includes('{'))) return draw(context);
  const written = field.options.map((option) => option.label);
  // The widget's own options: their words written over as the answers they show change.
  const options: Option[] = field.options.map((option) => ({ ...option, label: form.words(option.label) }));
  const inner = draw({ ...context, field: { ...field, options } as Field });
  return {
    ...inner,
    update(state) {
      options.forEach((option, i) => {
        if (!written[i].includes('{')) return;
        const now = form.words(written[i]);
        if (now === option.label) return;
        rewrite(inner.element, option.label, now);
        option.label = now;
      });
      inner.update(state);
    },
  };
}

/** Words shown in a widget as they were drawn — a picture's caption, a list's row — written over with what they say now. */
function rewrite(root: Element, was: string, now: string) {
  if (!was) return;
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.nodeValue === was) node.nodeValue = now;
}
