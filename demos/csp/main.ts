import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { gridWidgets } from '@fieldia/grid';
import { codeWidgets } from '@fieldia/code';
import { chatterSlot } from '@fieldia/chatter';
import { createDesigner, createMemoryPageStore, mountScreenEditor } from '@fieldia/designer';
import { appPages, pageFromQuery, recordFromQuery, sampleDataSource } from '../shared/sample-data';
import { sampleChatter } from '../shared/sample-chatter';

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
const page = pageFromQuery(params);

let handle: ViewerHandle | null = null;
if (params.get('designer') === '1') {
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
    slots: { chatter: chatterSlot({ source: sampleChatter() }) },
  });
}
Object.assign(window, { fieldiaDemo: { handle } });
