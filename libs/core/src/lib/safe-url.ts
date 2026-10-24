/**
 * Every address Fieldia writes into a link, a picture, a player or a frame,
 * and every page it sends the browser to, goes through `safeUrl`: read as the
 * browser reads it — with the URL parser, which drops tabs, line breaks and
 * control characters where a person never sees them (`java\tscript:`), and
 * lower-cases the scheme (`JaVaScRiPt:`) — and kept only when its scheme is
 * one the place it goes to allows. Anything else is no address at all:
 * `javascript:`, `vbscript:`, a `data:` page, another site's `blob:`.
 *
 * - `http`, `https`, `mailto`, `tel`: the web, a mail address, a phone.
 * - `relative`: a path of this site (`/orders/7`, `?page=2`), where the place means one.
 * - `blob`: a blob this page made (its origin this page's, or none) — a file shown from the bytes a value holds.
 * - `image`: a picture written as data (`data:image/png;base64,…`), for a picture alone: the browser draws it, and
 *   never runs it.
 * - `data`: a file written as data, for a download alone: a page opened from it has no origin, never this page's.
 *
 * The address comes back as written when the browser reads it the same way, else as the browser reads it; undefined
 * when it may not go there. An element factory leaves an undefined attribute out.
 */
export type UrlKind = 'http' | 'https' | 'mailto' | 'tel' | 'relative' | 'blob' | 'image' | 'data';

/** A link a person presses, or a page this one goes to: the web, a mail address, a phone, a path of this site. */
export const LINK_URL: readonly UrlKind[] = ['http', 'https', 'mailto', 'tel', 'relative'];
/** A picture: from the web or this site, a blob this page made, or written as data. */
export const PICTURE_URL: readonly UrlKind[] = ['http', 'https', 'relative', 'blob', 'image'];
/** A film, a sound, a file to download or a document in a frame: from the web or this site, or a blob this page made. */
export const MEDIA_URL: readonly UrlKind[] = ['http', 'https', 'relative', 'blob'];
/** A file a link downloads: from the web or this site, a blob this page made, or written as data. */
export const DOWNLOAD_URL: readonly UrlKind[] = ['http', 'https', 'relative', 'blob', 'data'];

/** The URL parser every runtime has — the browser's, Node's, a worker's — as far as core needs it (core is typed for none). */
interface Parsed {
  href: string;
  protocol: string;
  origin: string;
}
const Url = (globalThis as unknown as { URL: new (url: string, base?: string) => Parsed }).URL;

/** What a relative address is read against where the page has no address of its own (a server, a test). */
const NOWHERE = 'https://fieldia.invalid/';
/** A picture written as data: its media type an image's. */
const DATA_IMAGE = /^data:image\/[\w.+-]+[;,]/i;
/** What the browser drops from an address: tabs, line breaks, control characters (a space it keeps, or encodes). */
// eslint-disable-next-line no-control-regex
const UNCLEAN = /[\0-\x1f\x7f]/;

export function safeUrl(value: unknown, allowed: readonly UrlKind[], base?: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return undefined;
  // Data, megabytes of it, is not read whole: its start says what it is.
  if (/^data:/i.test(text)) return allowed.includes('data') || (allowed.includes('image') && DATA_IMAGE.test(text)) ? text : undefined;
  const here = base ?? (globalThis as { location?: { href?: string } }).location?.href;
  let url: Parsed;
  try {
    url = new Url(text);
  } catch {
    // No scheme of its own: a path of this site, read against the page's address.
    if (!allowed.includes('relative')) return undefined;
    try {
      url = new Url(text, here ?? NOWHERE);
    } catch {
      return undefined;
    }
    // Whole, where markup could read it otherwise — a character reference, a space: "javascript&#58;…" is a path here,
    // and stays one in an attribute.
    // eslint-disable-next-line no-control-regex
    return here && /&(#|[a-z][a-z\d]*;)|[\0-\x1f\x7f]/i.test(text) ? url.href : text;
  }
  const scheme = url.protocol.slice(0, -1) as UrlKind;
  if (scheme === 'blob') {
    // A blob this page made carries this page's origin; one made in a sandbox carries none. Another site's is not ours.
    const own = !here || url.origin === 'null' || url.origin === new Url(here).origin;
    if (!own || !allowed.includes('blob')) return undefined;
  } else if (!(['http', 'https', 'mailto', 'tel'] as UrlKind[]).includes(scheme) || !allowed.includes(scheme)) return undefined;
  return UNCLEAN.test(text) ? url.href : text;
}
