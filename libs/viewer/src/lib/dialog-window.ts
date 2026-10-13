import { drawIcon } from '@fieldia/widgets';

/**
 * A dialog's window tools, as a work item's popup has them: ⤢ that fills the
 * window and Restore that puts it back, and a grip that resizes it. The head
 * part's (head-part.ts), with the inset size's and the clear backdrop's rules.
 */

/** How far the grip's arrow keys resize a dialog, in pixels; and the least it is resized to. */
const RESIZE_STEP = 16;
const LEAST = { width: 320, height: 240 };

/** ⤢: the dialog fills the window, and Restore puts it back where it was, at its size. */
export function wireMaximise(box: HTMLElement, button: HTMLElement, labels: { maximise: string; restoreSize: string }, doc: Document) {
  const face = (maximised: boolean) => {
    const name = maximised ? labels.restoreSize : labels.maximise;
    button.setAttribute('aria-label', name);
    button.title = name;
    button.replaceChildren(...[drawIcon(doc, maximised ? 'restore' : 'maximise')].filter((icon): icon is SVGSVGElement => !!icon));
  };
  face(false);
  button.addEventListener('click', () => {
    const maximised = !box.hasAttribute('data-maximised');
    box.toggleAttribute('data-maximised', maximised);
    face(maximised);
  });
}

/**
 * The grip at the dialog's end-bottom corner: dragged, the corner follows the
 * pointer; focused, the arrow keys move it by 16 pixels — the way the page
 * reads, so right to left ArrowLeft widens it. The other corner stays put.
 */
export function wireGrip(box: HTMLElement, grip: HTMLElement, doc: Document) {
  const view = doc.defaultView as Window;
  const rtl = () => getComputedStyle(box).direction === 'rtl';
  /** Held where it is, at the size it is: its own place from now on, not the window's inset. */
  const hold = () => {
    const at = box.getBoundingClientRect();
    box.setAttribute('data-resized', '');
    box.style.top = `${at.top}px`;
    if (rtl()) {
      box.style.right = `${view.innerWidth - at.right}px`;
      box.style.left = 'auto';
    } else {
      box.style.left = `${at.left}px`;
      box.style.right = 'auto';
    }
    box.style.bottom = 'auto';
    return at;
  };
  const size = (width: number, height: number) => {
    const at = box.getBoundingClientRect();
    const roomX = rtl() ? at.right : view.innerWidth - at.left;
    const roomY = view.innerHeight - at.top;
    box.style.width = `${Math.round(Math.max(LEAST.width, Math.min(width, roomX)))}px`;
    box.style.height = `${Math.round(Math.max(LEAST.height, Math.min(height, roomY)))}px`;
  };
  grip.addEventListener('pointerdown', (event) => {
    if (box.hasAttribute('data-maximised')) return;
    event.preventDefault();
    const start = hold();
    const from = { x: event.clientX, y: event.clientY };
    grip.setPointerCapture?.(event.pointerId);
    const move = (moved: PointerEvent) => size(start.width + (moved.clientX - from.x) * (rtl() ? -1 : 1), start.height + (moved.clientY - from.y));
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });
  grip.addEventListener('keydown', (event) => {
    const by = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[event.key];
    if (!by || box.hasAttribute('data-maximised')) return;
    event.preventDefault();
    const start = hold();
    size(start.width + by[0] * RESIZE_STEP * (rtl() ? -1 : 1), start.height + by[1] * RESIZE_STEP);
  });
}
