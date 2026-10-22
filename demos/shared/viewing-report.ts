import type { Page } from '@fieldia/core';
import viewingReport from '../../examples/pages/viewing-report.page.json';

/**
 * A broker's viewing report in a compound with no signal (examples/pages/viewing-report.page.json): its page keeps a send made
 * without signal on the phone — photos and all — and sends it when the signal comes back (`outbox`).
 */
export const viewingReportPage = (): Page => viewingReport as Page;

/** Working offline by the bar's button: kept for the tab, so a reload is still without signal. */
const KEY = 'fieldia-demo-offline';
const kept = () => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
let working = typeof sessionStorage === 'undefined' ? false : kept();

/**
 * The browser's connection, as it says it goes and comes back (`offline`, `online`) — the demo's source is in memory,
 * so it fails as a network does only by the browser's word. Taken as there at first: some browsers say offline throughout.
 */
let away = false;
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => (away = true));
  window.addEventListener('online', () => (away = false));
}

/** Whether the demo works offline now: by its bar's button, or because the browser said its network went. */
export const demoOffline = (): boolean => working || away;

/**
 * A bar over the visit: Work offline, as a compound with no signal would have it — the demo's source fails as a network
 * does — and Back online, which tells the page the signal is back (the browser's `online`), as a phone would.
 */
export function offlineBar(doc: Document): HTMLElement {
  const bar = doc.createElement('div');
  bar.className = 'demo-bar demo-panel-bar demo-meanwhile-bar fd-theme';
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'fd-button';
  const said = doc.createElement('span');
  said.className = 'demo-meanwhile-said';
  said.setAttribute('role', 'status');
  const show = () => {
    button.textContent = working ? 'Back online' : 'Work offline';
    said.textContent = working ? 'No signal: what you send is kept on this device.' : 'Press Work offline to visit as in a compound with no signal.';
  };
  button.addEventListener('click', () => {
    working = !working;
    try {
      if (working) sessionStorage.setItem(KEY, '1');
      else sessionStorage.removeItem(KEY);
    } catch {
      // A browser that keeps nothing: offline until the page is left.
    }
    show();
    if (!working) doc.defaultView?.dispatchEvent(new Event('online'));
  });
  show();
  bar.append(button, said);
  return bar;
}
