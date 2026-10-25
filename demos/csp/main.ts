import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
// ag-Grid's and CodeMirror's widgets, fetched by the pages that draw one (shared/lazy-widgets.ts).
import { codeWidgets, gridWidgets } from '../shared/lazy-widgets';
import { chatterSlot } from '@fieldia/chatter';
import { appPages, pageFromQuery, recordFromQuery, sampleDataSource } from '../shared/sample-data';
import { sampleChatter } from '../shared/sample-chatter';
import { demoGanttViews } from '../shared/gantt';

/**
 * Fieldia under a strict Content-Security-Policy (index.html, served by tools/serve.mjs under /csp/): the app hands
 * the viewer — or the designer — its page's nonce, and every <style> Fieldia adds carries it; nothing Fieldia does
 * needs 'unsafe-inline' or 'unsafe-eval'. `?page=` names one of the demos' pages; `?designer=1` opens it in the
 * designer instead.
 */
const params = new URLSearchParams(location.search);
// The app knows its nonce: its server wrote it into the page — here, on the tag that loaded this script.
const nonce = document.querySelector<HTMLScriptElement>('script[data-app]')?.nonce ?? '';
const host = document.getElementById('app') as HTMLElement;
// The page the address names, fetched first: each demo page's JSON is a file of its own (shared/lazy-page.ts).
const page = await pageFromQuery(params);

let handle: ViewerHandle | null = null;
if (params.get('designer') === '1') {
  // The designer, fetched only where it is opened: an app's own route to it.
  const { createDesigner, createMemoryPageStore, mountScreenEditor } = await import('@fieldia/designer');
  const designer = createDesigner({ page, store: createMemoryPageStore() });
  mountScreenEditor(host, { designer, nonce });
} else {
  const dataSource = sampleDataSource();
  handle = mountViewer(host, {
    page,
    dataSource,
    recordId: recordFromQuery(params, page),
    nonce,
    pages: appPages,
    widgets: { ...gridWidgets, ...codeWidgets },
    // A list's timeline (0.31): the Gantt view on its switcher, drawn under the policy too.
    listViews: demoGanttViews,
    slots: { chatter: chatterSlot({ source: sampleChatter() }) },
  });
}
Object.assign(window, { fieldiaDemo: { handle } });
