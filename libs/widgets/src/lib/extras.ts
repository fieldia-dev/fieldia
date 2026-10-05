import { WIDGET_LABELS, type WidgetLabels } from './labels';
import type { WidgetFactory } from './widgets';

/**
 * Formatted text and JSON. Formatted text is edited in place, with a toolbar
 * (bold, italic, underline, headings, lists, alignment, links) that drives the
 * browser's own editing, so no editor library is loaded. Every value — typed,
 * pasted or loaded — passes through `sanitizeHtml`, so stored markup can never
 * run script in the page.
 */

const ALLOWED = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'A', 'H1', 'H2', 'H3', 'H4',
  'BLOCKQUOTE', 'CODE', 'PRE', 'SPAN', 'DIV',
]);
const DROPPED_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH']);
/** Blocks that may keep their alignment, the one style the toolbar sets. */
const ALIGNABLE = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI', 'BLOCKQUOTE', 'PRE']);
const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify', 'start', 'end']);

/** Keep text structure, block alignment and http(s)/mailto links; drop every other element and attribute. */
export function sanitizeHtml(html: string, document: Document = globalThis.document): string {
  const box = document.createElement('template');
  box.innerHTML = html;
  const clean = (parent: ParentNode) => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE) continue;
      if (node.nodeType !== Node.ELEMENT_NODE) {
        node.remove();
        continue;
      }
      const element = node as Element;
      if (DROPPED_WITH_CONTENT.has(element.tagName)) {
        element.remove();
        continue;
      }
      clean(element);
      if (!ALLOWED.has(element.tagName)) {
        element.replaceWith(...element.childNodes);
        continue;
      }
      const href = element.tagName === 'A' ? element.getAttribute('href') : null;
      const align = ALIGNABLE.has(element.tagName) ? (element as HTMLElement).style?.textAlign?.trim().toLowerCase() : '';
      for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
      if (href && /^(https?:|mailto:)/i.test(href.trim())) element.setAttribute('href', href.trim());
      if (align && ALIGNMENTS.has(align)) element.setAttribute('style', `text-align: ${align};`);
    }
  };
  clean(box.content);
  const out = document.createElement('div');
  out.append(box.content);
  return out.innerHTML;
}

/** A typed address as a link target: web and mail addresses only, "https://" added to a bare domain. */
export function linkAddress(typed: string): string | null {
  const text = typed.trim();
  if (/^(https?:\/\/|mailto:)\S+$/i.test(text)) return text;
  if (/^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/.test(text)) return `mailto:${text}`;
  if (/^[\w-]+(\.[\w-]+)+([/?#]\S*)?$/.test(text)) return `https://${text}`;
  return null;
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

export const htmlWidget: WidgetFactory = ({ form, name, node, id, document, labels = WIDGET_LABELS.en }) => {
  const area = document.createElement('div');
  area.id = id;
  area.className = 'fd-input fd-richtext';
  area.setAttribute('role', 'textbox');
  area.setAttribute('aria-multiline', 'true');
  area.setAttribute('contenteditable', 'true');
  const withToolbar = node.options?.['toolbar'] !== false;
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
    doc.execCommand?.(command, false, value);
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

export const jsonWidget: WidgetFactory = ({ form, name, id, document, labels = WIDGET_LABELS.en }) => {
  const element = document.createElement('div');
  element.className = 'fd-json';
  const area = document.createElement('textarea');
  area.id = id;
  area.className = 'fd-input fd-textarea fd-code';
  area.spellcheck = false;
  const error = document.createElement('div');
  error.className = 'fd-cell-error';
  error.hidden = true;
  element.append(area, error);
  area.addEventListener('input', () => {
    if (area.value.trim() === '') {
      error.hidden = true;
      form.setValue(name, null);
      return;
    }
    try {
      const parsed = JSON.parse(area.value);
      error.hidden = true;
      form.setValue(name, parsed);
    } catch {
      error.hidden = false;
      error.textContent = labels.invalidJson;
    }
  });
  return {
    element,
    focus: () => area.focus(),
    update(state) {
      if (document.activeElement !== area) {
        const text = state.value === null || state.value === undefined ? '' : JSON.stringify(state.value, null, 2);
        if (area.value !== text) area.value = text;
      }
      area.readOnly = state.readonly;
      area.setAttribute('aria-invalid', String(state.invalid || !error.hidden));
    },
  };
};
