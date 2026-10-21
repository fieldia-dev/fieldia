import { createMemoryDataSource } from '@fieldia/core';
import { mountViewer } from '@fieldia/viewer';
import { page, record } from './page';

/**
 * The browser's side of a server-drawn form: the page arrived with the enquiry's first paint in #app (server.ts); this
 * mounts the viewer over it, as an app does after a Next or Nuxt page is served. The first paint stays until the live
 * form is drawn and its record in, then gives way to it in one step, carrying over what was typed in it meanwhile.
 */
const dataSource = createMemoryDataSource({ records: { 'crm.enquiry': { 1: record } } });
const handle = mountViewer(document.getElementById('app') as HTMLElement, { page, dataSource, recordId: 1 });
Object.assign(window, { fieldiaDemo: { handle, dataSource } });
