import { MESSAGES, webAddress, type Locale } from '@fieldia/core';
import { htmlBox } from './extras';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import { linkAddress, sanitizeHtml } from './sanitize';
import { appendHtml, heldHtml, wearStyles } from './style-attributes';
import { styleNonce } from './style-nonce';
import { textPart } from './widget-parts';
import type { WidgetFactory } from './widgets';

/**
 * The classic formatted text's toolbar — bold, italic, underline, headings, lists, alignment, links — which drives the
 * browser's own editing, so no editor library is loaded; and a paste from Word, Excel, Google Docs or a page put in
 * plain. The html part's (widget-parts.ts, `htmlPart`): the box itself (`htmlBox`, extras.ts) is drawn plainly without
 * it, its words cleaned and typed in place, until it has come — or where it cannot.
 */

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

/** The classic formatted text: its toolbar on top, always, as it was before a page could ask for more. */
export const classicHtml: WidgetFactory = (context) => {
  const { document, labels = WIDGET_LABELS.en, locale, node, id } = context;
  const box = htmlBox(context);
  const { area } = box;
  const withToolbar = node.options?.['toolbar'] !== false && node.options?.['toolbar'] !== 'never';
  // What is pasted from Word, Excel, Google Docs or a page is put in plain by the text part's cleaner where the caret
  // was: at once once that part has come, else as soon as it comes; if it cannot, as any value is kept. Words alone
  // (no HTML) are the browser's to paste, as they were.
  area.addEventListener('paste', (event) => {
    const html = event.clipboardData?.getData('text/html') ?? '';
    if (area.getAttribute('contenteditable') !== 'true' || !html.trim()) return;
    event.preventDefault();
    const selection = document.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    // Under a strict Content-Security-Policy, its styles held as it goes in and put on through their style objects.
    const put = (clean: string, putHtml = (into: HTMLElement, html: string, doc: Document): unknown => (doc.execCommand?.('insertHTML', false, styleNonce(doc) ? heldHtml(html) : html), wearStyles(into))) => {
      if (document.activeElement === area && range && area.contains(range.commonAncestorContainer)) {
        selection?.removeAllRanges();
        selection?.addRange(range);
        putHtml(area, clean, document);
      }
      // The person has gone on elsewhere: the table at the text's end, the focus left where it is.
      else appendHtml(area, clean);
      area.dispatchEvent(new Event('input', { bubbles: true }));
    };
    // Once the part has come, its load answers before the next key: the paste is put in at once.
    textPart.load().then((part) => put(part.cleanPasted(html, document), part.putHtml), () => put(sanitizeHtml(html, document)));
  });
  const toolbar = withToolbar ? formattingToolbar(area, document, labels, locale, id) : null;
  if (!toolbar) return box;
  // The box is labelled by the field's label; the text inside it says so too.
  const element = document.createElement('div');
  element.className = 'fd-richtext-box';
  element.setAttribute('role', 'group');
  area.setAttribute('aria-labelledby', `${id}-label`);
  element.append(toolbar.bar, toolbar.linkRow, area);
  return {
    ...box,
    element,
    destroy: () => toolbar.destroy(),
    update(state) {
      if (toolbar.bar.hidden !== state.readonly) toolbar.bar.hidden = state.readonly;
      if (state.readonly && !toolbar.linkRow.hidden) toolbar.linkRow.hidden = true;
      box.update(state);
    },
  };
};

/**
 * The toolbar of a formatted text: buttons that keep the text's selection
 * (they act on mousedown's behalf), a text-style choice, and a row for a link's
 * address. One button takes Tab; the arrow keys move along the bar.
 */
function formattingToolbar(area: HTMLElement, doc: Document, labels: WidgetLabels, locale: Locale = 'en', id = 'fd-richtext') {
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
  // Why an address is refused, under it, as a web address field says it (0.35.1: a script's address went red and said nothing).
  const refused = doc.createElement('p');
  refused.className = 'fd-error fd-link-problem';
  refused.id = `${id}-link-problem`;
  refused.setAttribute('role', 'status');
  refused.hidden = true;
  linkRow.append(address, apply, unlink, refused);
  const said = (words: string | null) => {
    refused.hidden = !words;
    refused.textContent = words ?? '';
    if (words) address.setAttribute('aria-describedby', refused.id);
    else address.removeAttribute('aria-describedby');
  };
  address.addEventListener('input', () => said(null));
  apply.addEventListener('click', () => {
    const url = linkAddress(address.value);
    if (!url) {
      address.setAttribute('aria-invalid', 'true');
      const messages = MESSAGES[locale] ?? MESSAGES.en;
      said(webAddress(address.value) === 'scheme' ? messages.urlScheme : messages.url);
      return;
    }
    said(null);
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

