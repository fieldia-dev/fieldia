import type { Tone } from '@fieldia/core';
import type { WidgetDialogs } from '@fieldia/widgets';
import { later } from './later';
import { findPage } from './find-page';
import { ownLocale, viewerWords } from './labels';
import { mountViewer, type ViewerOptions } from './viewer';
import { withActs, type ActsPart } from './viewer-parts';

// The field a page's records are named by: a module of its own, which the duplicates part takes too without this one's
// dialogs (and the viewer they import) coming with it.
import { nameFieldOf } from './name-field';
export { nameFieldOf };
// The app's page for a request: a module of its own, which the acts part takes too (open.ts) without this one's dialogs.
export { findPage, type PageFinder, type PageRequest } from './find-page';

/**
 * The dialogs a page's widgets may open, made from the viewer's own options: whether a linked record can be opened (asked
 * as a link is drawn), and the dialogs themselves — the acts part's (link-dialogs.ts), opened at once once it came, else
 * once it does, what asked busy meanwhile. A dialog that cannot come is said as a form that could not be loaded is,
 * nothing picked, made or saved; asked for anew at the next press. A linked record's page says its words through `say`,
 * the opener's, so they show over the dialog and outlive it.
 */
export function pageDialogs(options: ViewerOptions, say?: (message: string, tone: Tone) => void, signal?: AbortSignal): WidgetDialogs {
  const pageFor = (model: string) => findPage(options, { model });
  const unopened = (): null => {
    say?.(viewerWords(ownLocale(options.locale ?? options.page.language), options.labels).formNotLoaded, 'danger');
    return null;
  };
  const dialogs = <T>(open: (them: ReturnType<ActsPart['linkDialogs']>) => Promise<T>) => withActs((part) => open(part.linkDialogs(options, say, signal, mountViewer))).catch(unopened);
  return {
    // Whether the app has a page for the model: one it is still fetching counts. Asked as a link is drawn, where nothing
    // waits for it — its failure (a network's, or the page left as it came) is the opening's, asked anew then: never left
    // unhandled here.
    canOpen: (model) => {
      const found = pageFor(model);
      if (later(found)) found.then(undefined, () => undefined);
      return found !== null;
    },
    openRecord: (model, request) => dialogs((them) => them.openRecord(model, request)),
    searchMore: (request) => dialogs((them) => them.searchMore(request)),
    editValues: (request) => dialogs((them) => them.editValues(request)),
  };
}
