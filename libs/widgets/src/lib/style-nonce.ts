/**
 * A strict Content-Security-Policy: `style-src 'nonce-…'` with no `'unsafe-inline'`. Every `<style>` element Fieldia
 * adds — its own sheet, each part's, the calendar's, the chatter's, a map's, the designer's — carries the page's nonce,
 * and nothing Fieldia draws writes a style attribute: what is worked out as it is drawn (a width, a colour) is set
 * through the element's `style` object, which a policy lets be.
 *
 * The nonce is the document's, kept on it under a name every copy of this module shares (`Symbol.for`): the one-tag
 * script and its parts, or two packages bundled apart, all read the same. Given by the app (the viewer's, the
 * designer's and the components' `nonce`), else read from the page: the `<script nonce>` that loaded the one-tag script
 * (tools/script-parts.ts), or `<meta property="csp-nonce" nonce="…">`, which Vite writes and others follow.
 */

const NONCE = Symbol.for('fieldia.styleNonce');

type Holding = Document & { [NONCE]?: string };

/** The nonce Fieldia's `<style>` elements carry in a document: given in this document, else the page's `csp-nonce` meta's, else none. */
export function styleNonce(document: Document): string | undefined {
  const given = (document as Holding)[NONCE];
  if (given) return given;
  // The meta's nonce is its property: a browser hides the attribute once a policy came with the page.
  const meta = document.querySelector?.<HTMLMetaElement>('meta[property="csp-nonce"]');
  return meta?.nonce || meta?.getAttribute('nonce') || undefined;
}

/** Fieldia's `<style>` elements in this document carry `nonce` from now on. Empty or none leaves the document's as it was. */
export function useStyleNonce(document: Document, nonce: string | null | undefined): void {
  if (nonce) (document as Holding)[NONCE] = nonce;
}

/** A `<style>` element of Fieldia's, not yet in the document: its rules, its id, and the document's nonce. */
export function fieldiaStyle(document: Document, css: string, id?: string): HTMLStyleElement {
  const style = document.createElement('style');
  if (id) style.id = id;
  const nonce = styleNonce(document);
  if (nonce) style.nonce = nonce;
  style.textContent = css;
  return style;
}
