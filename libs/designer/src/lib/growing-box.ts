import type { ElementFactory } from './chrome';

/**
 * A title's box that wraps its words onto another line where its room ends, never cutting them: a page's title on a
 * phone read "Your ex" for "Your experience". A text area of one row, as tall as its words at the width it has — grown
 * as they are typed, set or pasted, and as its width changes — that keeps to one line of text: Enter never breaks it,
 * and lines pasted come in joined by spaces. The box's own keys (a question's Enter going on to its description) are
 * the editor's to add.
 */
export function growingBox(el: ElementFactory, attrs: Record<string, string | undefined>): HTMLTextAreaElement {
  const box = el('textarea', { rows: '1', ...attrs, class: `${attrs['class'] ?? ''} fd-growing`.trim() });
  const grow = () => growToWords(box);
  // Set by the editor as the page changes (`box.value = …`): grown to what it now holds.
  const own = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  if (own?.get && own.set) {
    const { get, set } = own;
    Object.defineProperty(box, 'value', {
      configurable: true,
      get: () => get.call(box),
      set: (value: string) => {
        set.call(box, value);
        grow();
      },
    });
  }
  box.addEventListener('input', () => {
    // A line break come in some other way — dropped words, a phone's keyboard — is a space: the box keeps one line.
    if (/[\r\n]/.test(box.value)) {
      const at = box.selectionStart;
      box.value = box.value.replace(/\r\n?|\n/g, ' ');
      box.setSelectionRange(at, at);
    }
    grow();
  });
  // Enter, and Shift with it, would break the line: never. With Ctrl, ⌘ or Alt it is the editor's (a question after this one).
  box.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing) event.preventDefault();
  });
  box.addEventListener('paste', (event) => {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!/[\r\n]/.test(text)) return;
    event.preventDefault();
    box.setRangeText(text.replace(/\s*[\r\n]+\s*/g, ' ').trim(), box.selectionStart, box.selectionEnd, 'end');
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  watchWidth(box);
  return box;
}

/** As tall as its words: its border box round its scrolled height (the CSS gives it `box-sizing: border-box`). */
function growToWords(box: HTMLTextAreaElement) {
  if (!box.isConnected) return;
  const style = box.ownerDocument.defaultView?.getComputedStyle(box);
  const borders = (parseFloat(style?.borderTopWidth ?? '') || 0) + (parseFloat(style?.borderBottomWidth ?? '') || 0);
  box.style.height = 'auto';
  box.style.height = `${box.scrollHeight + borders}px`;
}

/** One watcher a page, for every growing box on it, and the width each was last grown at. */
const watchers = new WeakMap<Document, ResizeObserver>();
const widths = new WeakMap<Element, number>();

/**
 * Its width found as it is laid out, and changed with the window: its words wrap anew. Grown in the next frame, never
 * inside the watcher's call, so its own new height is no change the watcher must answer in the same frame.
 */
function watchWidth(box: HTMLTextAreaElement) {
  const doc = box.ownerDocument;
  const view = doc.defaultView as (Window & { ResizeObserver?: typeof ResizeObserver }) | null;
  if (!view?.ResizeObserver) return;
  let watcher = watchers.get(doc);
  if (!watcher) {
    watcher = new view.ResizeObserver((entries) => {
      const targets = entries.map((entry) => entry.target as HTMLTextAreaElement);
      // Taken off the page (a card put down): watched no more, so the page keeps nothing of it.
      for (const gone of targets.filter((target) => !target.isConnected)) watcher?.unobserve(gone);
      const grown = targets.filter((target) => target.isConnected && widths.get(target) !== target.clientWidth);
      for (const target of grown) widths.set(target, target.clientWidth);
      if (grown.length) view.requestAnimationFrame(() => grown.forEach(growToWords));
    });
    watchers.set(doc, watcher);
  }
  watcher.observe(box);
}
