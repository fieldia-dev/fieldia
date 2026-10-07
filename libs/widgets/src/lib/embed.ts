import type { FileValue } from '@fieldia/core';
import { binaryWidget } from './files';
import { maker, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * A document shown inline, in the browser's own viewer: a PDF kept in a file
 * field, under the field's own file box (Flectra's widget="pdf_viewer"), or a
 * web page at the address a text field holds, with a link to open it in a tab
 * of its own (its embed_viewer: a Google Slides deck). Nothing is drawn by
 * Fieldia: the frame shows what the browser does. `options.height` is the
 * frame's height in pixels (480).
 */

const heightOf = (value: unknown) => (typeof value === 'number' && value > 0 ? value : 480);
const isWeb = (text: string) => /^https?:\/\//i.test(text);

/** A file's address for a frame: its data as a blob the browser shows (freed by `free`), or the address the app gave. */
function addressOf(file: FileValue): string {
  if (file.data) {
    const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: file.type || 'application/pdf' }));
  }
  return file.url ?? '';
}

export const pdfWidget: WidgetFactory = (context) => {
  const make = maker(context.document);
  const words = wordsFor(context.labels, context.locale);
  const files = binaryWidget({ ...context, node: { ...context.node, widget: undefined } });
  const frame = make('iframe', { class: 'fd-embed-frame' });
  frame.style.height = `${heightOf(context.node.options?.['height'])}px`;
  const none = make('div', { class: 'fd-embed-none' }, words.noDocument);
  const view = make('div', { class: 'fd-embed-view' });
  let shown: unknown;
  let address = '';
  const free = () => address.startsWith('blob:') && URL.revokeObjectURL(address);
  return {
    element: make('div', { class: 'fd-embed fd-embed-pdf' }, files.element, view),
    focus: () => files.focus(),
    destroy() {
      free();
      files.destroy?.();
    },
    update(state) {
      files.update(state);
      const file = (Array.isArray(state.value) ? state.value[0] : state.value) as FileValue | null | undefined;
      if (file !== shown) {
        shown = file;
        free();
        address = file ? addressOf(file) : '';
        if (address) {
          frame.title = file?.name ?? context.field.label;
          frame.src = address;
        }
      }
      // While there is none, the file box says what to do; read-only, these words say there is none.
      view.replaceChildren(...(address ? [frame] : state.readonly ? [none] : []));
    },
  };
};

export const embedWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale }) => {
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const input = make('input', { id, type: 'url', class: 'fd-input', autocomplete: 'url' });
  if (node.placeholder) input.placeholder = node.placeholder;
  input.addEventListener('input', () => form.setValue(name, input.value === '' ? null : input.value));
  // Its own scripts run, as an embedded deck's must; it cannot reach the form, nor leave the frame but for a new tab.
  const frame = make('iframe', { class: 'fd-embed-frame', title: field.label, sandbox: 'allow-scripts allow-same-origin allow-popups allow-presentation', referrerpolicy: 'no-referrer', loading: 'lazy' });
  frame.style.height = `${heightOf(node.options?.['height'])}px`;
  const open = make('a', { class: 'fd-button fd-button-link fd-embed-open', target: '_blank', rel: 'noopener noreferrer', hidden: '' }, words.openInNewTab);
  const view = make('div', { class: 'fd-embed-view' });
  let shown = '';
  return {
    element: make('div', { class: 'fd-embed' }, make('div', { class: 'fd-embed-bar' }, input, open), view),
    focus: () => input.focus(),
    update(state) {
      const text = typeof state.value === 'string' ? state.value.trim() : '';
      if (document.activeElement !== input && input.value !== (typeof state.value === 'string' ? state.value : '')) input.value = typeof state.value === 'string' ? state.value : '';
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      input.hidden = state.readonly;
      const web = isWeb(text) ? text : '';
      if (web !== shown) {
        shown = web;
        if (web) frame.src = web;
        view.replaceChildren(...(web ? [frame] : []));
      }
      open.hidden = !web;
      if (web) open.href = web;
    },
  };
};
