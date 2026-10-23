import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { DesignerWords } from './designer-words';

/**
 * Delete asks nothing: what it takes away — a question, a field, a page, a section, tabs, a tab, a part of a record's
 * head — goes at once, and a toast at the foot of the screen says what went, with Undo: "Question deleted · Undo".
 * Undo brings it back as it was, picked again, the focus on it. The toast stays ten seconds, longer while it is
 * pointed at or holds the focus, and goes at the next change, when Undo would take back something else.
 *
 * Every Delete a designer offers — a card's bin and its ⋮, a page's, the bar's, the panel's, the Delete key — goes
 * through `removeWithUndo`, so each says what it did the same way. A designer with no editor mounted (an app's own
 * chrome over the Designer) takes the part away as `removeNode` does.
 */

type What = keyof DesignerWords['canvas']['deleted'];
const STAY_MS = 10000;
const removers = new WeakMap<Designer, (id: string, remove: () => boolean, what?: What) => boolean>();

/** Take a part away as a person's Delete does: at once, then Undo in a toast where an editor offers one. */
export function removeWithUndo(designer: Designer, id: string, remove: () => boolean = () => designer.removeNode(id), what?: What): boolean {
  const removing = removers.get(designer);
  return removing ? removing(id, remove, what) : remove();
}

/** A node of a page's layout, of any kind: a wizard's step, a tab, a group, a field. */
interface Placed {
  readonly id?: string;
  readonly type?: string;
  readonly children?: readonly Placed[];
}

/** What a node is, as the toast names it. */
function whatIs(page: Page, id: string, survey: boolean): What {
  const find = (nodes: readonly Placed[]): Placed | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const inside = Array.isArray(node.children) ? find(node.children) : undefined;
      if (inside) return inside;
    }
    return undefined;
  };
  const type = find([page.layout as Placed])?.type;
  if (type === 'field') return survey ? 'question' : 'field';
  if (type === 'step') return 'page';
  return type === 'section' || type === 'tabs' || type === 'tab' ? type : 'part';
}

/** The editor's toast for what a Delete took away: its words and Undo, over the page at the foot of the screen. */
export function deletedToast(root: HTMLElement, designer: Designer, el: ElementFactory, survey: boolean): { destroy(): void } {
  const doc = root.ownerDocument;
  const words = el('span', {});
  const undo = el('button', { type: 'button', class: 'fd-button fd-button-link fd-say-undo' }, designer.words.canvas.deleted.undo);
  const toast = el('div', { class: 'fd-say fd-deleted' }, words, undo);
  // Its edge in the info colour; set through the style object, as a strict Content-Security-Policy allows.
  toast.style.setProperty('--fd-tone', 'var(--fd-info)');
  // Over the page wherever the editor is scrolled to, in the editor's look: its tokens, its scheme, its direction.
  const region = el('div', { class: 'fd-theme fd-says fd-deleted-says', role: 'status', 'aria-live': 'polite' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** What went, and the page the Delete left: another change after it puts the toast away. */
  let gone: { id: string; left: Page } | null = null;
  const hide = () => {
    clearTimeout(timer);
    gone = null;
    toast.remove();
  };
  const wait = () => {
    clearTimeout(timer);
    timer = setTimeout(hide, STAY_MS);
  };
  toast.addEventListener('mouseenter', () => clearTimeout(timer));
  toast.addEventListener('mouseleave', wait);
  toast.addEventListener('focusin', () => clearTimeout(timer));
  toast.addEventListener('focusout', wait);
  undo.addEventListener('click', (event) => {
    // Its own press: not one on the page round the editor, which would put down what Undo picks again.
    event.stopPropagation();
    if (!gone) return;
    const { id } = gone;
    hide();
    designer.undo();
    // Back where it was, picked again, the focus on it: its words' box picked open, else the part itself (on the
    // canvas, not a map or an outline that names it too). A part the canvas draws by no node of its own (a list's
    // column) is back, picked as it was.
    const placed = () => [...root.querySelectorAll<HTMLElement>('[data-node]')].filter((node) => node.getAttribute('data-node') === id);
    if (placed().length && designer.getState().selected !== id) designer.select(id);
    const places = placed();
    const words = places.map((place) => place.querySelector<HTMLElement>('.fd-q-label, .fd-canvas-label-input, .fd-step-title, .fd-q-open')).find(Boolean);
    (words ?? places.find((place) => place.matches('[tabindex], button')))?.focus();
  });
  const leave = designer.subscribe((state) => {
    if (gone && state.page !== gone.left) hide();
  });
  removers.set(designer, (id, remove, what) => {
    const said = designer.words.canvas.deleted[what ?? whatIs(designer.getPage(), id, survey)];
    if (!remove()) return false;
    for (const { name, value } of [...root.attributes]) if (name.startsWith('data-') || name === 'dir' || name === 'lang') region.setAttribute(name, value);
    const direction = getComputedStyle(root).direction;
    region.setAttribute('dir', direction === 'rtl' ? 'rtl' : 'ltr');
    words.textContent = said;
    // Over a bar kept at the foot of the screen (a phone's + and toolbox), never on it.
    const foot = [...root.querySelectorAll<HTMLElement>('.fd-foot-bar, .fd-q-rail')].filter((bar) => {
      const style = getComputedStyle(bar);
      return bar.getClientRects().length > 0 && style.position === 'sticky' && style.bottom !== 'auto';
    });
    const clear = foot.reduce((most, bar) => Math.max(most, doc.documentElement.clientHeight - bar.getBoundingClientRect().top + 8), 0);
    if (clear > 20) region.style.setProperty('bottom', `${Math.round(clear)}px`);
    else region.style.removeProperty('bottom');
    gone = { id, left: designer.getPage() };
    if (!toast.isConnected) region.append(toast);
    wait();
    return true;
  });
  (doc.body ?? doc.documentElement).append(region);
  return {
    destroy() {
      clearTimeout(timer);
      leave();
      removers.delete(designer);
      region.remove();
    },
  };
}
