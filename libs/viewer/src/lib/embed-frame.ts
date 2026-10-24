/**
 * fieldia-embed.js: a form from the app's own site on another — a partner's, a WordPress page, a broker's listing —
 * with one script tag and nothing else of Fieldia's. Where the tag stands, an iframe of the app's form page, which grows
 * and shrinks with the form (the page tells it its height: `<fieldia-form frame>`), and tells the page round it what
 * happened, as events on the iframe: `fieldia-ready`, `fieldia-step`, `fieldia-send` (the response's reference, never
 * the answers), `fieldia-error`.
 *
 *   <script src="…/@fieldia/viewer@<version>/bundle/fieldia-embed.js" integrity="sha256-…" crossorigin="anonymous"
 *     data-src="https://forms.example.com/enquiry" data-locale="ar" data-theme="material" async></script>
 *
 * (the tag fieldia.dev and the README print, each version's with its file's hash: tools/script-tags.mjs).
 *
 * `data-src` is the form's page; `data-locale`, `data-theme` and `data-skin` are passed on in its address
 * (`?locale=ar&theme=material`), as `<fieldia-form frame>` reads them; `data-title` names the frame for a screen reader
 * ("Form" unless said); `data-height` is its height before the form tells its own (600). The link's parameters a form
 * fills hidden fields from — `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` unless
 * `data-params` names others ("agent unit", or `*` for all) — are passed on too, so a campaign's link to the page round
 * it reaches the form. A message is taken only from the frame placed, from its page's own origin.
 */

/** The link's parameters passed on to a form unless the tag names others: a campaign's. */
export const CAMPAIGN_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

let frames = 0;

/** The iframe for a tag: its address, with what the tag and the page's link pass on, and its listener. */
export function embedFrame(script: HTMLScriptElement): HTMLIFrameElement | null {
  const doc = script.ownerDocument;
  const win = doc.defaultView;
  const src = script.dataset['src'];
  if (!src || !win) return null;
  const at = new URL(src, doc.baseURI);
  // A form on the web, never a script: the one place an address is not `safeUrl`'s, the embed script carrying no core.
  if (!/^https?:$/.test(at.protocol)) return null;
  const id = String(++frames);
  at.searchParams.set('fieldia-frame', id);
  at.searchParams.set('fieldia-origin', win.location.origin);
  for (const name of ['locale', 'theme', 'skin']) {
    const value = script.dataset[name];
    if (value) at.searchParams.set(name, value);
  }
  const named = script.dataset['params'];
  const wanted = named === undefined ? CAMPAIGN_PARAMS : named.split(/[\s,]+/).filter(Boolean);
  for (const [name, value] of new URLSearchParams(win.location.search)) {
    if ((wanted.includes('*') || wanted.includes(name)) && !at.searchParams.has(name)) at.searchParams.set(name, value);
  }
  const frame = doc.createElement('iframe');
  frame.src = at.href;
  frame.title = script.dataset['title'] || 'Form';
  // A provider's checkout drawn in the form's payment step may ask the browser to pay.
  frame.allow = 'payment';
  frame.setAttribute('data-fieldia-frame', id);
  frame.style.cssText = `display:block;width:100%;border:0;height:${Number(script.dataset['height']) || 600}px;`;
  win.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || event.origin !== at.origin) return;
    const data = event.data as { fieldia?: unknown; frame?: unknown; height?: unknown } | null;
    if (!data || typeof data.fieldia !== 'string' || data.frame !== id) return;
    if (data.fieldia === 'height') {
      if (typeof data.height === 'number' && data.height > 0) frame.style.height = `${Math.ceil(data.height)}px`;
      return;
    }
    const { fieldia: type, frame: _frame, ...detail } = data as Record<string, unknown>;
    frame.dispatchEvent(new CustomEvent(`fieldia-${String(type)}`, { bubbles: true, detail }));
    // A step shown, or the answers sent: the form's top brought into view where it went out of it.
    if ((type === 'step' || type === 'send') && frame.getBoundingClientRect().top < 0) frame.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  return frame;
}

/** The script's own tag, as the page runs it: its frame placed right after it. */
export function embedHere(doc: Document): HTMLIFrameElement | null {
  const script = doc.currentScript as HTMLScriptElement | null;
  if (!script) return null;
  const frame = embedFrame(script);
  if (frame) script.after(frame);
  return frame;
}
