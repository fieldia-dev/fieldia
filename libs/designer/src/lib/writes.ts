/**
 * Writes that happen only when they change something. A view is brought up to
 * date at each edit; writing what is there already still has the browser look
 * at the page anew, which on a page of 500 fields is most of the time a key
 * takes.
 */

/** Shown or hidden. */
export function setHidden(element: HTMLElement, hidden: boolean): void {
  if (element.hidden !== hidden) element.hidden = hidden;
}

/** An element's words. */
export function setText(element: Node, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

/** An attribute, or none with null. */
export function setAttr(element: Element, name: string, value: string | null): void {
  if (element.getAttribute(name) === value) return;
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/** A data attribute, by its name in `dataset`, or none with undefined. */
export function setData(element: HTMLElement, name: string, value: string | undefined): void {
  if (element.dataset[name] === value) return;
  if (value === undefined) delete element.dataset[name];
  else element.dataset[name] = value;
}
