import type { FileValue } from '@fieldia/core';
import { heightOf } from './embed';
import { binaryWidget } from './files';
import { maker, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * A PDF kept in a file field, shown inline in the browser's own viewer under
 * the field's own file box: Flectra's widget="pdf_viewer". In the files part
 * (files-part.ts), with the file box it draws under; the file's name
 * meanwhile. `options.height` is the frame's height in pixels (480), as a web
 * page's (embed.ts).
 */

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
