import { MEDIA_URL, safeUrl, type FileValue } from '@fieldia/core';
import { heightOf } from './embed';
import { shownFile, whenShown, type Shown } from './file-formats';
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

export const pdfWidget: WidgetFactory = (context) => {
  const make = maker(context.document);
  const words = wordsFor(context.labels, context.locale);
  const files = binaryWidget({ ...context, node: { ...context.node, widget: undefined } });
  const frame = make('iframe', { class: 'fd-embed-frame' });
  frame.style.height = `${heightOf(context.node.options?.['height'])}px`;
  const none = make('div', { class: 'fd-embed-none' }, words.noDocument);
  const view = make('div', { class: 'fd-embed-view' });
  let shown: unknown;
  /** The PDF in the frame, as every file is shown (`shownFile`): its bytes checked, in a blob typed as a PDF's. */
  let made: Shown | null = null;
  let readonly = false;
  const free = () => {
    made?.free();
    made = null;
  };
  // While there is none, the file box says what to do; read-only, these words say there is none.
  const paint = () => view.replaceChildren(...(made ? [frame] : readonly ? [none] : []));
  return {
    element: make('div', { class: 'fd-embed fd-embed-pdf' }, files.element, view),
    focus: () => files.focus(),
    destroy() {
      shown = undefined;
      free();
      files.destroy?.();
    },
    update(state) {
      files.update(state);
      readonly = state.readonly;
      const file = (Array.isArray(state.value) ? state.value[0] : state.value) as FileValue | null | undefined;
      if (file !== shown) {
        shown = file;
        free();
        whenShown(file ? shownFile(file) : null, (one) => {
          if (shown !== file || one?.kind !== 'pdf') return void one?.free();
          made = one;
          frame.title = file?.name ?? context.field.label;
          frame.src = safeUrl(one.url, MEDIA_URL) ?? '';
          paint();
        });
      }
      paint();
    },
  };
};
