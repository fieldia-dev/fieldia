import { fill, MESSAGES, type Tone } from '@fieldia/core';
import { partsOf, pressedControl, pressing, type WidgetDialogs } from '@fieldia/widgets';
import { later } from './later';
import type { SayAct } from './say';
import { findPage } from './find-page';
import { ownLocale, viewerWords } from './labels';
import { mountViewer, type ViewerOptions } from './viewer';
import { actsPart, withActs, type ActsPart } from './viewer-parts';

// The field a page's records are named by: a module of its own, which the duplicates part takes too without this one's
// dialogs (and the viewer they import) coming with it.
import { nameFieldOf } from './name-field';
export { nameFieldOf };
// The app's page for a request: a module of its own, which the acts part takes too (open.ts) without this one's dialogs.
export { findPage, type PageFinder, type PageRequest } from './find-page';

/**
 * The dialogs a page's widgets may open, made from the viewer's own options: whether a linked record can be opened (asked
 * as a link is drawn), and the dialogs themselves — the acts part's (link-dialogs.ts), opened at once once it came, else
 * once it does. The control pressed for one waits as every press does, till the dialog shows (`withActs`); a second press
 * of it meanwhile asks nothing more. Where the acts part cannot come, it is said as a press's steps that could not come
 * are, with Retry, which asks again — the dialog then the one first asked for, its answer the first ask's; let go, nothing
 * is picked, made or saved. A dialog that cannot open for another reason is said as a form that could not be loaded. A
 * linked record's page says its words through `say`, the opener's, so they show over the dialog and outlive it.
 */
export function pageDialogs(options: ViewerOptions, say?: (message: string, tone: Tone, act?: SayAct) => void, signal?: AbortSignal): WidgetDialogs {
  const pageFor = (model: string) => findPage(options, { model });
  const doc = typeof document === 'undefined' ? undefined : document;
  const words = () => viewerWords(ownLocale(options.locale ?? options.page.language), options.labels);
  const unopened = (): null => {
    say?.(words().formNotLoaded, 'danger');
    return null;
  };
  const dialogs = <T>(open: (them: ReturnType<ActsPart['linkDialogs']>) => Promise<T>, from?: Element | null): Promise<T | null> => {
    const control = from ?? pressedControl(doc);
    if (pressing(control)) return Promise.resolve(null);
    const ask = (): Promise<T | null> =>
      withActs((part) => open(part.linkDialogs(options, say, signal, mountViewer)), doc, control).catch(() => {
        if (actsPart.loaded || !say) return unopened();
        const messages = options.messages ?? MESSAGES[ownLocale(options.locale ?? options.page.language)] ?? MESSAGES.en;
        // Asked anew by Retry where each half that failed can be; else the page reloaded.
        const again = messages[partsOf(actsPart).every((half) => half.loaded || half.asksAgain) ? 'guardTryAgain' : 'guardReload'];
        return new Promise<T | null>((resolve) => say(fill(messages.guardNotDone, { part: messages.guardSteps, again }), 'warning', { label: words().retry, run: () => resolve(ask()), gone: () => resolve(null) }));
      });
    return ask();
  };
  return {
    // Whether the app has a page for the model: one it is still fetching counts. Asked as a link is drawn, where nothing
    // waits for it — its failure (a network's, or the page left as it came) is the opening's, asked anew then: never left
    // unhandled here.
    canOpen: (model) => {
      const found = pageFor(model);
      if (later(found)) found.then(undefined, () => undefined);
      return found !== null;
    },
    openRecord: (model, request) => dialogs((them) => them.openRecord(model, request), request.from),
    searchMore: (request) => dialogs((them) => them.searchMore(request), request.from),
    editValues: (request) => dialogs((them) => them.editValues(request), request.from),
  };
}
