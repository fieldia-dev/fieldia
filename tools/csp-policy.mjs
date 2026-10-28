/**
 * The strict Content-Security-Policy the pages under /csp/ are served under, as a bank's or a government's site serves
 * its own: scripts and styles only with the response's nonce — no 'unsafe-inline', no 'unsafe-eval' — nothing from
 * elsewhere. tools/serve.mjs sends it as a header, a new nonce for every response; tools/build-site.mjs writes it into
 * fieldia.dev's static copy as a meta tag (`meta`), which has no server to make a nonce per response — one a meta tag
 * cannot carry, `frame-ancestors`, left out there. Each refusal reports what was refused (`'report-sample'`): a style
 * attribute's words, by which a style written on a page is told from WebKit's own (the style inside each <select> it
 * draws, which it refuses on any page under such a policy — demos/csp/index.html).
 */
export const strictPolicy = (nonce, { meta = false } = {}) =>
  [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'report-sample'`,
    `style-src 'nonce-${nonce}' 'report-sample'`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    ...(meta ? [] : ["frame-ancestors 'self'"]),
  ].join('; ');
