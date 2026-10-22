/**
 * A formatted text's own looks under a strict Content-Security-Policy. Its value keeps a block's alignment and a
 * span's colour, highlight and size as style attributes — the HTML as it is stored, sent by e-mail and opened in Word
 * — but a policy with no `'unsafe-inline'` in `style-src` has the browser refuse a style attribute as it reads HTML: the
 * look is not shown, a violation is reported, and Chromium does not even read it in a `<template>` or a parsed document
 * of its own (where the sanitizer looks at it). So Fieldia never has the browser read one: a value's style attributes
 * are renamed `data-fd-style` before its HTML is read (`heldHtml`), read through a style object (`styleOf`) — which a
 * policy lets be — put on what is shown through it (`showHtml`), and written back as `style` in the value (`givenHtml`).
 * A page with no policy sees the same HTML and the same looks.
 */

/** The attribute a style attribute is held in while its HTML is read. */
export const HELD_STYLE = 'data-fd-style';

/** A start tag with its attributes, as the HTML parser reads them: each a name and a value, quoted or not. */
const TAG = /<[a-z][^\s/>]*(?:[\s/]+[^\s/>=]+(?:\s*=\s*(?:"[^"]*"?|'[^']*'?|[^\s>]*))?)*/gi;
/** A start tag's attribute: what stands before it, its name, its value. */
const ATTRIBUTE = /([\s/]+)([^\s/>=]+)(\s*=\s*(?:"[^"]*"?|'[^']*'?|[^\s>]*))?/g;

/**
 * Each start tag's attribute named `from` renamed `to` (both in small letters), everything else as it was: tags read
 * as the HTML parser reads them, so words and other attributes' values are never touched. An attribute already named
 * `to` is left out: only a renamed one carries that name. (In a comment, which no one reads as HTML, it may be renamed too.)
 */
export const renameAttribute = (html: string, from: string, to: string): string =>
  html.replace(TAG, (tag) =>
    tag.replace(ATTRIBUTE, (whole, before: string, name: string, value = '') => {
      const lower = name.toLowerCase();
      return lower === to ? '' : lower === from ? before + to + value : whole;
    })
  );

/** HTML whose style attributes are held (`data-fd-style`), to be read with no style attribute in it. */
export const heldHtml = (html: string): string => renameAttribute(html, 'style', HELD_STYLE);

/** HTML read with its styles held, written with them as style attributes again: the value as it is kept. */
export const givenHtml = (html: string): string => renameAttribute(html, HELD_STYLE, 'style');

/**
 * The style an element of HTML read with its styles held says, as a style object the browser's CSS parser fills —
 * through an element of the document's never put in it, whose style object a policy lets be. Empty where it says none.
 */
export function styleOf(element: Element, document: Document = element.ownerDocument): CSSStyleDeclaration {
  // A page's document, never the inert one a template's content belongs to.
  const page = document.defaultView ? document : (globalThis.document ?? document);
  const reader = page.createElement('span');
  const held = element.getAttribute(HELD_STYLE);
  if (held) reader.style.cssText = held;
  return reader.style;
}

/** The styles held in what is shown — `root` and what it holds — put on through each element's style object, which a policy lets be. */
export function wearStyles(root: ParentNode): void {
  const held = [...root.querySelectorAll<HTMLElement>(`[${HELD_STYLE}]`)];
  if ((root as Node).nodeType === 1 && (root as Element).hasAttribute(HELD_STYLE)) held.unshift(root as HTMLElement);
  for (const element of held) {
    const css = element.getAttribute(HELD_STYLE) ?? '';
    // Those after it written again after its style, which comes last: the element reads as its HTML was written.
    const after = [...element.attributes].slice([...element.attributes].findIndex((one) => one.name === HELD_STYLE) + 1).map((one) => [one.name, one.value]);
    element.removeAttribute(HELD_STYLE);
    element.style.cssText = css;
    // Read, so the browser writes it as an attribute now (Chromium does so lazily), before those after it.
    element.getAttribute('style');
    for (const [name, value] of after) {
      element.removeAttribute(name);
      element.setAttribute(name, value);
    }
  }
}

/**
 * What the browser's own editing wrote as style attributes as a person typed or used a tool (an alignment, a colour),
 * which a strict policy has Chromium and Safari refuse to apply: put on through each element's style object. Only an
 * element whose style was refused (none applied) is touched, so a page with no policy is as it was.
 */
export function restyle(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>('[style]')) if (!element.style.length) element.style.cssText = element.getAttribute('style') ?? '';
}

/** Formatted text shown in `element`, its looks on, under a strict policy as under none: `innerHTML`'s place for a value's HTML. */
export function showHtml(element: Element, html: string): void {
  element.innerHTML = heldHtml(html);
  wearStyles(element);
}

/** The same, after what `element` holds: `insertAdjacentHTML('beforeend', …)`'s place. Its looks put on once it is in the page. */
export function appendHtml(element: Element, html: string): void {
  const box = element.ownerDocument.createElement('template');
  box.innerHTML = heldHtml(html);
  const added = [...box.content.children];
  element.append(box.content);
  for (const one of added) wearStyles(one);
}
