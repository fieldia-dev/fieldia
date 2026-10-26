import { wordsRead, type Field, type Option } from '@fieldia/core';
import type { Widget, WidgetContext } from '@fieldia/widgets';

/**
 * A choice whose options' words show answers given — "Yes, call me at {branch}" — drawn by the widget it would have
 * anyway (`draw`: the viewer's createWidget), each option's words filled in as the page shows them (`form.words`) and
 * again as those answers change: in the options it reads them from (a list that opens later, a search, "Other" naming
 * one) and where it shows them already. Its value, its box and its focus stay as they are. Any other field's widget is
 * drawn as it is.
 */
export function wordedWidget(context: WidgetContext, draw: (context: WidgetContext) => Widget, source: Field = context.field): Widget {
  const { form, field } = context;
  // Any other field, or a choice whose words name no answer: its widget as it is. A choice whose options change — a
  // list's, a condition's, carried from another question — is drawn afresh as they do, its words filled in (choices-from.ts).
  if (field.type !== 'selection' || source.type !== 'selection' || field.optionsFrom || form.offersChange?.(context.name) || !source.options.some((option) => option.label.includes('{'))) return draw(context);
  // Read from the page's own words (`source`); the rest of each option as the widget is given it.
  const written = source.options.map((option) => option.label);
  // The widget's own options: their words written over as the answers they show change.
  const options: Option[] = field.options.map((option, i) => ({ ...option, label: form.words(written[i]) }));
  const inner = draw({ ...context, field: wordsRead({ ...field, options } as Field) });
  return {
    ...inner,
    // Its options' words follow other answers: drawn every time.
    reads: undefined,
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
