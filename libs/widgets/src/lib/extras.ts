import { WIDGET_LABELS, type WidgetLabels } from './labels';
import type { JsonValue } from '@fieldia/core';
import { fillIn } from './kind-parts';
import type { WidgetFactory } from './widgets';
import { jsonProblem } from './json-problem';
import { linkAddress, sanitizeHtml } from './sanitize';
import { partFactory, textPart } from './widget-parts';

export { linkAddress, sanitizeHtml } from './sanitize';

/**
 * Formatted text and JSON. Formatted text is edited in place, with a toolbar
 * (bold, italic, underline, headings, lists, alignment, links) that drives the
 * browser's own editing, so no editor library is loaded. Every value — typed,
 * pasted or loaded — passes through `sanitizeHtml`, so stored markup can never
 * run script in the page.
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


/** The toolbar's buttons: [label key, editing command, drawn icon]. */
const TOOLS: [keyof WidgetLabels, string, string][] = [
  ['bold', 'bold', '<b>B</b>'],
  ['italic', 'italic', '<i>I</i>'],
  ['underline', 'underline', '<u>U</u>'],
  // A heading, or back to words: the text style list's first two, in one press.
  ['heading', 'heading', '<b>H</b>'],
  ['bulletList', 'insertUnorderedList', '<svg viewBox="0 0 16 16"><circle cx="3" cy="4" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="3" cy="12" r="1.2"/><path d="M6 4h8M6 8h8M6 12h8"/></svg>'],
  ['numberList', 'insertOrderedList', '<svg viewBox="0 0 16 16"><path d="M2.5 3h1v3M2 10.5c.5-.8 2-.8 2 .2 0 .8-2 1.3-2 2.3h2M6 4h8M6 8h8M6 12h8"/></svg>'],
  ['alignLeft', 'justifyLeft', '<svg viewBox="0 0 16 16"><path d="M2 3.5h12M2 6.5h8M2 9.5h12M2 12.5h8"/></svg>'],
  ['alignCenter', 'justifyCenter', '<svg viewBox="0 0 16 16"><path d="M2 3.5h12M4 6.5h8M2 9.5h12M4 12.5h8"/></svg>'],
  ['alignRight', 'justifyRight', '<svg viewBox="0 0 16 16"><path d="M2 3.5h12M6 6.5h8M2 9.5h12M6 12.5h8"/></svg>'],
  ['link', 'createLink', '<svg viewBox="0 0 16 16"><path d="M7 9a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2L8.2 3.6M9 7a3 3 0 0 0-4.2 0L2.5 9.3a3 3 0 0 0 4.2 4.2l1.1-1.1"/></svg>'],
];

export const htmlWidget: WidgetFactory = partFactory(textPart, (part) => part.modernHtml, (context) => classicHtml(context), (node) => usesEditor(node.options));

/** The classic formatted text: its toolbar on top, always, as it was before a page could ask for more. */
const classicHtml: WidgetFactory = ({ form, name, node, id, document, labels = WIDGET_LABELS.en }) => {
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
  const withToolbar = node.options?.['toolbar'] !== false && node.options?.['toolbar'] !== 'never';
  let last = '';
  area.addEventListener('input', () => {
    const clean = sanitizeHtml(area.innerHTML, document);
    last = clean;
    form.setValue(name, clean.trim() === '' ? null : clean);
  });
  area.addEventListener('blur', () => {
    // Show what was stored: anything unsafe that was typed or pasted is gone.
    if (area.innerHTML !== last) area.innerHTML = last;
  });
  const toolbar = withToolbar ? formattingToolbar(area, document, labels) : null;
  let element: HTMLElement = area;
  if (toolbar) {
    // The box is labelled by the field's label; the text inside it says so too.
    element = document.createElement('div');
    element.className = 'fd-richtext-box';
    element.setAttribute('role', 'group');
    area.setAttribute('aria-labelledby', `${id}-label`);
    element.append(toolbar.bar, toolbar.linkRow, area);
  }
  return {
    element,
    focus: () => area.focus(),
    destroy: () => toolbar?.destroy(),
    update(state) {
      if (toolbar) {
        toolbar.bar.hidden = state.readonly;
        if (state.readonly) toolbar.linkRow.hidden = true;
      }
      const clean = sanitizeHtml(typeof state.value === 'string' ? state.value : '', document);
      if (clean !== last || document.activeElement !== area) {
        if (area.innerHTML !== clean) area.innerHTML = clean;
        last = clean;
      }
      area.setAttribute('contenteditable', String(!state.readonly));
      area.classList.toggle('fd-blank', !clean.trim());
      area.setAttribute('aria-readonly', String(state.readonly));
      area.setAttribute('aria-invalid', String(state.invalid));
      if (state.describedBy) area.setAttribute('aria-describedby', state.describedBy);
    },
  };
};

/**
 * The toolbar of a formatted text: buttons that keep the text's selection
 * (they act on mousedown's behalf), a text-style choice, and a row for a link's
 * address. One button takes Tab; the arrow keys move along the bar.
 */
function formattingToolbar(area: HTMLElement, doc: Document, labels: WidgetLabels) {
  const bar = doc.createElement('div');
  bar.className = 'fd-richtext-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', labels.formatting);
  // The last selection made in the text: the style box and the address box take
  // the focus, and a command must act where the person had selected.
  let lastRange: Range | null = null;
  const restore = () => {
    area.focus();
    const selection = doc.getSelection();
    if (lastRange && selection) {
      selection.removeAllRanges();
      selection.addRange(lastRange);
    }
  };
  const run = (command: string, value?: string) => {
    restore();
    // An alignment as a style, in every browser: Firefox would write an align attribute, which the stored text keeps
    // only as a style, and the box would be drawn again under the selection.
    const aligns = command.startsWith('justify');
    if (aligns) doc.execCommand?.('styleWithCSS', false, 'true');
    doc.execCommand?.(command, false, value);
    if (aligns) doc.execCommand?.('styleWithCSS', false, 'false');
  };

  const style = doc.createElement('select');
  style.className = 'fd-richtext-style';
  style.setAttribute('aria-label', labels.textStyle);
  for (const [value, key] of [['p', 'paragraph'], ['h2', 'heading'], ['h3', 'subheading']] as const) {
    const option = doc.createElement('option');
    option.value = value;
    option.textContent = labels[key];
    style.append(option);
  }
  style.addEventListener('change', () => run('formatBlock', `<${style.value}>`));

  const linkRow = doc.createElement('div');
  linkRow.className = 'fd-link-row';
  linkRow.hidden = true;
  const address = doc.createElement('input');
  address.className = 'fd-input';
  address.type = 'url';
  address.placeholder = 'https://';
  address.setAttribute('aria-label', labels.linkAddress);
  const apply = doc.createElement('button');
  apply.type = 'button';
  apply.className = 'fd-button fd-link-apply';
  apply.textContent = labels.applyLink;
  const unlink = doc.createElement('button');
  unlink.type = 'button';
  unlink.className = 'fd-button fd-button-link fd-link-remove';
  unlink.textContent = labels.removeLink;
  linkRow.append(address, apply, unlink);
  apply.addEventListener('click', () => {
    const url = linkAddress(address.value);
    if (!url) {
      address.setAttribute('aria-invalid', 'true');
      return;
    }
    address.setAttribute('aria-invalid', 'false');
    restore();
    doc.execCommand?.('createLink', false, url);
    linkRow.hidden = true;
  });
  unlink.addEventListener('click', () => {
    restore();
    doc.execCommand?.('unlink', false);
    linkRow.hidden = true;
  });
  address.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      apply.click();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      linkRow.hidden = true;
      restore();
    }
  });

  const buttons = TOOLS.map(([key, command, icon]) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'fd-richtext-tool';
    button.setAttribute('aria-label', labels[key]);
    button.title = labels[key];
    button.innerHTML = icon;
    button.querySelector('svg')?.setAttribute('aria-hidden', 'true');
    if (['bold', 'italic', 'underline', 'heading'].includes(command)) button.setAttribute('aria-pressed', 'false');
    // Keep the text's selection when the button is pressed.
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      if (command === 'heading') return run('formatBlock', style.value === 'h2' ? '<p>' : '<h2>');
      if (command !== 'createLink') return run(command);
      linkRow.hidden = false;
      address.value = '';
      address.focus();
    });
    return button;
  });
  bar.append(style, ...buttons);

  // One stop on Tab; the arrow keys move along the bar.
  const stops = [style, ...buttons];
  stops.forEach((stop, i) => (stop.tabIndex = i === 0 ? 0 : -1));
  bar.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const at = stops.indexOf(doc.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const rtl = getComputedStyle(bar).direction === 'rtl';
    const step = (event.key === 'ArrowRight') !== rtl ? 1 : -1;
    const next = stops[(at + step + stops.length) % stops.length];
    event.preventDefault();
    stops.forEach((stop) => (stop.tabIndex = stop === next ? 0 : -1));
    next.focus();
  });

  // Show which formats the selection already has.
  const reflect = () => {
    const selection = doc.getSelection();
    if (!selection || !selection.rangeCount || !area.contains(selection.anchorNode)) return;
    lastRange = selection.getRangeAt(0).cloneRange();
    const block = String(doc.queryCommandValue?.('formatBlock') ?? '').toLowerCase().replace(/[<>]/g, '');
    style.value = block === 'h2' || block === 'h3' ? block : 'p';
    for (const button of buttons) {
      const command = TOOLS[buttons.indexOf(button)][1];
      if (button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', String(command === 'heading' ? block === 'h2' : (doc.queryCommandState?.(command) ?? false)));
    }
  };
  doc.addEventListener('selectionchange', reflect);
  return { bar, linkRow, destroy: () => doc.removeEventListener('selectionchange', reflect) };
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
        form.setValue(name, JSON.parse(area.value) as JsonValue);
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
