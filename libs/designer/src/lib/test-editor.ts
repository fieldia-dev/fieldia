import type { Designer } from './designer';
import { mountScreenEditor, type ScreenEditorHandle } from './screen-editor';

/** Helpers for the screen editor's tests: mount it, and find what a person would find. */

let handle: ScreenEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

export function mount(designer: Designer) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountScreenEditor(host, { designer });
  return { host, handle };
}

const shown = (element: Element) => !element.closest('[hidden]');

/** A button on show, by its words or its accessible name. */
export function button(scope: Element, name: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => shown(b) && (b.getAttribute('aria-label') === name || b.textContent?.trim() === name));
}

/** A box on show, by its accessible name. */
export function field(scope: Element, name: string): (HTMLInputElement & HTMLSelectElement) | undefined {
  return [...scope.querySelectorAll<HTMLInputElement & HTMLSelectElement>('input, select, textarea')].find((f) => shown(f) && f.getAttribute('aria-label') === name);
}

/** A toolbox tile, by what it adds. */
export function tile(scope: Element, spec: string): HTMLButtonElement {
  return scope.querySelector(`.fd-toolbox [data-tool="${spec}"]`) as HTMLButtonElement;
}

export function type(input: HTMLInputElement | undefined, text: string): void {
  if (!input) throw new Error('No box to type in');
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function choose(select: HTMLSelectElement | undefined, value: string): void {
  if (!select) throw new Error('No list to choose from');
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

export function press(key: string, options: KeyboardEventInit = {}, target: Element = document.activeElement ?? document.body): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
}
