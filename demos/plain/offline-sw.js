/*
 * The viewing report's service worker (registered by demos/shared/viewing-report.ts, its scope that page alone): the
 * page and every script, sheet and part it loaded, kept on the device so the page opens again with no signal at all —
 * a reload in a compound, the phone in airplane mode. Network first: online, the page is always the newest, and what
 * came is kept for next time; the kept copy is used only when the network fails. Fieldia's outbox keeps the sends
 * themselves (IndexedDB); opening the page without signal is the app's service worker, as this one is.
 */
const KEPT = 'fieldia-viewing-report-1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// What the page loaded before this worker was there to see it — its address, scripts, sheets, parts — as it says.
self.addEventListener('message', (event) => {
  const urls = event.data && Array.isArray(event.data.keep) ? event.data.keep : [];
  event.waitUntil(caches.open(KEPT).then((cache) => Promise.all(urls.map((url) => cache.add(url).catch(() => undefined)))));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request).then(
      (response) => {
        if (response.ok && response.status === 200) {
          const copy = response.clone();
          event.waitUntil(caches.open(KEPT).then((cache) => cache.put(request, copy)));
        }
        return response;
      },
      async (failed) => {
        const cache = await caches.open(KEPT);
        // The page under any of its addresses: the same file, whatever its query says.
        const kept = (await cache.match(request)) ?? (request.mode === 'navigate' ? await cache.match(request, { ignoreSearch: true }) : undefined);
        if (kept) return kept;
        throw failed;
      }
    )
  );
});
