import { WIDGET_LABELS } from './labels';
import type { FieldNode, JsonValue } from '@fieldia/core';
import { fillIn } from './kind-parts';
import type { WidgetFactory } from './widgets';
import { jsonProblem, readJson } from './json-problem';
import { sanitizeHtml } from './sanitize';
import { restyle, showHtml } from './style-attributes';
import { htmlPart, partWidget, textPart, type PartFactory } from './widget-parts';
import type { Widget, WidgetContext } from './widgets';

export { linkAddress, sanitizeHtml } from './sanitize';

/**
 * Formatted text and JSON. Formatted text is edited in place, with a toolbar
 * (bold, italic, underline, headings, lists, alignment, links) that drives the
 * browser's own editing, so no editor library is loaded: the toolbar is the html
 * part's (html-classic.ts), its box (`htmlBox`) drawn alone until it comes. Every
 * value — typed, pasted or loaded — passes through `sanitizeHtml`, so stored
 * markup can never run script in the page.
 *
 * A page that asks for more — its toolbar only while the text is worked in
 * (`toolbar: 'focus'`), at its foot (`toolbarAt`), its own `tools`, Markdown
 * (`editor`), a switch between the two (`switchEditor`), people and records
 * linked in place (`mention`, `references`) — gets the work item's editor:
 * html-field.ts, in the text part, loaded the first time a page shows one.
 */

/** Whether a page asks this field for more than the classic toolbar. */
export function usesEditor(options: Record<string, JsonValue> | undefined): boolean {
  if (!options) return false;
  return (
    options['toolbar'] === 'focus' ||
    options['toolbarAt'] !== undefined ||
    Array.isArray(options['tools']) ||
    options['editor'] !== undefined ||
    options['switchEditor'] === true ||
    options['mention'] !== undefined ||
    options['references'] !== undefined
  );
}


/**
 * Formatted text: the classic box (html-classic.ts, the html part) with its toolbar on top, or the work item's editor
 * where a page asks for more (`usesEditor`: html-field.ts, the text part) — each drawn plainly (`htmlBox`, its words
 * cleaned and typed in place) until its part has come, or where it cannot, then by its part in the same place.
 */
export const htmlWidget: PartFactory = Object.assign(
  (context: WidgetContext) =>
    usesEditor(context.node.options)
      ? partWidget(textPart, context, (part) => part.modernHtml(context), htmlBox)
      : partWidget(htmlPart, context, (part) => part.classicHtml(context), toolbarHeld),
  { partOf: (node: FieldNode) => (usesEditor(node.options) ? textPart : htmlPart) }
);

/** How many tools the classic toolbar draws after its text style (html-classic.ts, `TOOLS`): each one's room held. */
const TOOLS_HELD = 10;

/**
 * The classic formatted text drawn before its toolbar's part has come: its box, and the toolbar's room held over it — the
 * same bar, its text style's box and its tools' room, wrapping where the toolbar would — so nothing under it moves as
 * the toolbar comes (the 0.37 walk: Signed and Submit pushed 37 px down, 67 on a phone). Nothing in it is pressed; read
 * only, it is hidden, as the toolbar is; where the part cannot come, it goes, the box shown plainly.
 */
function toolbarHeld(context: WidgetContext): Widget {
  const box = htmlBox(context);
  const { node, document: doc, labels = WIDGET_LABELS.en } = context;
  if (node.options?.['toolbar'] === false || node.options?.['toolbar'] === 'never') return box;
  const bar = doc.createElement('div');
  bar.className = 'fd-richtext-bar';
  bar.setAttribute('aria-hidden', 'true');
  bar.inert = true;
  const style = doc.createElement('select');
  style.className = 'fd-richtext-style';
  style.disabled = true;
  for (const key of ['paragraph', 'heading', 'subheading'] as const) style.append(Object.assign(doc.createElement('option'), { textContent: labels[key] }));
  bar.append(style);
  for (let tool = 0; tool < TOOLS_HELD; tool++) bar.append(Object.assign(doc.createElement('span'), { className: 'fd-richtext-tool' }));
  const element = doc.createElement('div');
  element.className = 'fd-richtext-box';
  element.append(bar, box.area);
  // Where the part cannot come, the box is shown plainly, as it was: no room held for tools that will not come.
  htmlPart.load().catch(() => bar.remove());
  return {
    ...box,
    element,
    update(state) {
      if (bar.hidden !== state.readonly) bar.hidden = state.readonly;
      box.update(state);
    },
  };
}

/** A formatted text's box alone: what it holds, cleaned, typed in place — every value through `sanitizeHtml`. */
export function htmlBox({ form, name, node, id, document }: WidgetContext): Widget & { area: HTMLElement } {
  const area = document.createElement('div');
  area.id = id;
  area.className = 'fd-input fd-richtext';
  area.setAttribute('role', 'textbox');
  area.setAttribute('aria-multiline', 'true');
  area.setAttribute('contenteditable', 'true');
  // The page's words in the empty box, drawn by the stylesheet while it can be typed in.
  if (node.placeholder) {
    area.setAttribute('data-placeholder', node.placeholder);
    area.setAttribute('aria-placeholder', node.placeholder);
  }
  let last = '';
  area.addEventListener('input', () => {
    // An alignment the browser's editing wrote, shown under a strict policy too (style-attributes.ts).
    restyle(area);
    const clean = sanitizeHtml(area.innerHTML, document);
    last = clean;
    form.setValue(name, clean.trim() === '' ? null : clean);
  });
  area.addEventListener('blur', () => {
    // Show what was stored: anything unsafe that was typed or pasted is gone.
    if (area.innerHTML !== last) showHtml(area, last);
  });
  /** An attribute written only once it changes: a contenteditable box's, rewritten, made the browser restyle the page (0.35.1). */
  const put = (name: string, value: string) => {
    if (area.getAttribute(name) !== value) area.setAttribute(name, value);
  };
  /** The value last drawn, as given, and its clean words: a value given again is not cleaned again. */
  let given: unknown = undefined;
  let cleaned = '';
  return {
    element: area,
    area,
    // It shows its own value alone: drawn again only once what it shows changed.
    reads: [],
    focus: () => area.focus(),
    update(state) {
      if (state.value !== given || !cleaned) {
        given = state.value;
        cleaned = sanitizeHtml(typeof state.value === 'string' ? state.value : '', document);
      }
      const clean = cleaned;
      if (clean !== last || document.activeElement !== area) {
        if (area.innerHTML !== clean) showHtml(area, clean);
        last = clean;
      }
      put('contenteditable', String(!state.readonly));
      if (area.classList.contains('fd-blank') !== !clean.trim()) area.classList.toggle('fd-blank', !clean.trim());
      put('aria-readonly', String(state.readonly));
      put('aria-invalid', String(state.invalid));
      if (state.describedBy) put('aria-describedby', state.describedBy);
    },
  };
}

/**
 * JSON, typed as text. While what is typed is not JSON it stays as typed —
 * never put back to the last value that was — and the form keeps it as text
 * that does not read (`FormState.unread`), so Save says so. Why, in words —
 * a comma with nothing after it, curly quotes, digits that are not 0-9, a
 * character that cannot be there — and where, by line and column, shows
 * under the box once typing pauses, a polite status the box is described by;
 * once the box is left, the field's own error says it.
 */
export const jsonWidget: WidgetFactory = ({ form, name, id, document, labels, locale }) => {
  const words = labels ?? WIDGET_LABELS[locale ?? 'en'] ?? WIDGET_LABELS.en;
  const element = document.createElement('div');
  element.className = 'fd-json';
  const area = document.createElement('textarea');
  area.id = id;
  area.className = 'fd-input fd-textarea fd-code';
  area.spellcheck = false;
  const error = document.createElement('div');
  error.className = 'fd-cell-error';
  error.id = `${id}-json`;
  error.setAttribute('role', 'status');
  error.hidden = true;
  element.append(area, error);
  const unread = () => form.getState().unread?.[name];
  let pause: ReturnType<typeof setTimeout> | undefined;
  /** Why the text is not JSON, in words, and where. */
  const said = (text: string) => {
    const problem = jsonProblem(text);
    if (!problem) return null;
    const where = { line: problem.line, column: problem.column };
    if (problem.reason === 'end') return fillIn(words.invalidJsonAt, where);
    if (problem.reason === 'number') return fillIn(words.jsonNumber, { number: problem.char ?? '', ...where });
    const reason = problem.reason === 'char' ? fillIn(words.jsonChar, { char: problem.char ?? '' }) : words[problem.reason === 'comma' ? 'jsonComma' : problem.reason === 'quotes' ? 'jsonQuotes' : 'jsonDigits'];
    return fillIn(words.json, { reason, ...where });
  };
  /** The field's own help and error, as the page describes the box. */
  let base = '';
  const describe = () => {
    const ids = [base, error.hidden ? '' : error.id].filter(Boolean).join(' ');
    if (ids) area.setAttribute('aria-describedby', ids);
    else area.removeAttribute('aria-describedby');
  };
  /** The words under the box: what the form keeps, while the box is being typed in; the field's error says them after. */
  const show = () => {
    const message = document.activeElement === area ? (unread()?.message ?? '') : '';
    if (error.textContent !== message) error.textContent = message;
    error.hidden = !message;
    describe();
  };
  area.addEventListener('input', () => {
    if (area.value.trim() === '') {
      form.setValue(name, null);
      form.setUnread(name, null);
    } else {
      // Where it goes wrong, by line and column: a long document is not read again to find it.
      const message = said(area.value);
      if (message) form.setUnread(name, { text: area.value, message });
      else {
        form.setValue(name, readJson(area.value) as JsonValue);
        form.setUnread(name, null);
      }
    }
    // Said once typing pauses, not at every key.
    clearTimeout(pause);
    pause = setTimeout(show, 600);
  });
  area.addEventListener('blur', () => {
    clearTimeout(pause);
    show();
  });
  return {
    element,
    focus: () => area.focus(),
    destroy: () => clearTimeout(pause),
    update(state) {
      const kept = unread();
      if (document.activeElement !== area) {
        // Text that does not read stays as it was typed; anything else shows the value.
        const text = kept ? kept.text : state.value === null || state.value === undefined ? '' : JSON.stringify(state.value, null, 2);
        if (area.value !== text) area.value = text;
      }
      area.readOnly = state.readonly;
      area.setAttribute('aria-invalid', String(state.invalid || !!kept));
      base = state.describedBy ?? '';
      // Put right, its words go at once; new ones wait for typing to pause.
      if (!kept) show();
      else describe();
    },
  };
};
