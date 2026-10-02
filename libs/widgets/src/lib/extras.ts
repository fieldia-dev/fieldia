import { WIDGET_LABELS } from './labels';
import type { WidgetFactory } from './widgets';

/**
 * Formatted text and JSON. Formatted text is edited in place (the browser's
 * own shortcuts give bold, italic and underline) and every value — typed,
 * pasted or loaded — passes through `sanitizeHtml`, so stored markup can never
 * run script in the page.
 */

const ALLOWED = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'A', 'H1', 'H2', 'H3', 'H4',
  'BLOCKQUOTE', 'CODE', 'PRE', 'SPAN', 'DIV',
]);
const DROPPED_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH']);

/** Keep text structure and http(s)/mailto links; drop every other element and attribute. */
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
      for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
      if (href && /^(https?:|mailto:)/i.test(href.trim())) element.setAttribute('href', href.trim());
    }
  };
  clean(box.content);
  const out = document.createElement('div');
  out.append(box.content);
  return out.innerHTML;
}

export const htmlWidget: WidgetFactory = ({ form, name, id, document }) => {
  const area = document.createElement('div');
  area.id = id;
  area.className = 'fd-input fd-richtext';
  area.setAttribute('role', 'textbox');
  area.setAttribute('aria-multiline', 'true');
  area.setAttribute('contenteditable', 'true');
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
  return {
    element: area,
    focus: () => area.focus(),
    update(state) {
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
