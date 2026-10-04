/** The viewer's way to make an element: a tag, its attributes (left out when undefined), and what goes in it. */
export type El = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string | undefined>, ...children: (Node | string)[]) => HTMLElementTagNameMap[K];

/**
 * Shown or hidden, written only when that changes. Every part of a form is
 * brought up to date at each change; writing what is there already still has
 * the browser look at the page anew, which on a big page is most of a key's time.
 */
export function setHidden(element: HTMLElement, hidden: boolean): void {
  if (element.hidden !== hidden) element.hidden = hidden;
}

/** Words written only when they change. */
export function setText(element: Node, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}
