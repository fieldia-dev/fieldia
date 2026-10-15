/**
 * Every CSS selector compiled once per test file, not once per measure.
 *
 * jsdom works out getComputedStyle by matching each rule of the document's
 * style sheets through nwsapi, whose caches keep the last 1000 selectors
 * compiled. Fieldia's styles hold more than that (1265 at 0.20), so each call
 * walked them in an order that always missed the cache and compiled every
 * selector again. AG Grid measures on every draw: a grid test took 3 to 10
 * seconds, most of it compiling selectors, and on a busy machine some passed
 * their time limit. Caches without a limit, for this document's engines, keep
 * what is compiled; the selectors a file meets are a few thousand at most.
 *
 * Reaches jsdom's own document (its `impl`): should a later jsdom keep its
 * engines elsewhere, nothing changes but the speed.
 */
if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
  const implSymbol = Object.getOwnPropertySymbols(document).find((symbol) => symbol.description === 'impl');
  const impl = implSymbol ? document[implSymbol] : undefined;
  // Both engines are made on first use: one for computed styles, one for matches and querySelector.
  getComputedStyle(document.documentElement);
  document.documentElement.matches('html');
  const unbounded = (cache) => {
    if (!cache || typeof cache.get !== 'function' || typeof cache.set !== 'function') return;
    const all = new Map();
    Object.assign(cache, {
      get: (key) => all.get(key),
      has: (key) => all.has(key),
      set: (key, value) => (all.set(key, value), value),
      clear: () => all.clear(),
      size: () => all.size,
    });
  };
  for (const engine of [impl?._nwsapiDontThrow, impl?._nwsapi]) {
    for (const name of ['matchResolvers', 'matchLambdas', 'selectResolvers', 'selectLambdas']) unbounded(engine?.[name]);
  }
}
