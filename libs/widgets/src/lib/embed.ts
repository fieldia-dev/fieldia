import { boxPurpose, maker, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * A document shown inline, in the browser's own viewer: a web page at the
 * address a text field holds, with a link to open it in a tab of its own
 * (Flectra's embed_viewer: a Google Slides deck), or a PDF kept in a file
 * field, under the field's own file box (its pdf_viewer: pdf.ts, in the files
 * part). Nothing is drawn by Fieldia: the frame shows what the browser does.
 * `options.height` is the frame's height in pixels (480).
 */

/** A frame's height: the page's, in pixels, or 480. */
export const heightOf = (value: unknown) => (typeof value === 'number' && value > 0 ? value : 480);
const isWeb = (text: string) => /^https?:\/\//i.test(text);

export const embedWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale }) => {
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const input = make('input', { id, type: 'url', class: 'fd-input', ...boxPurpose(node, { autocomplete: 'url' }) });
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
