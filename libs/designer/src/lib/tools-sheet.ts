import { keepTabIn } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { DesignerWords } from './designer-words';

/**
 * Where the toolbox cannot sit beside the page — a phone, a tablet held upright — the editor's side (Add, Outline and
 * Data: rail.ts) is not drawn above the page, where the page would start a screen or more down; it waits behind a +
 * (the bar beside the card picked in a survey, the bar at the foot of a screen). Pressed, the + brings it up from the
 * foot of the screen in a sheet over the page, a dialog while it is open: Tab goes round inside it, and the + says it
 * is open. A kind picked puts it away, the new part taking the focus; so do its ×, Escape and a press beside it, the
 * focus back on the +. A tile a mouse or a pen carries out of it puts it away as the drag begins (`stepAside`), so the
 * page it covered takes the drop: a laptop's window beside an app's menu may be too narrow for the toolbox beside the
 * page too. The editor's side is the same element in the sheet as beside the page — moved there while the
 * sheet is open and back after — so what it holds (the pane open, a search typed, a group folded) stays as it was. A
 * window grown wide enough for the toolbox beside the page while it is open puts it back there.
 */
export interface ToolsSheet {
  /** Whether the sheet is up. */
  readonly open: boolean;
  /** The sheet up, its + said to be open, the focus on its tab shown. */
  show(opener: HTMLElement): void;
  /** The sheet put away: the focus back on its + unless `giveBack` is false. */
  close(giveBack?: boolean): void;
  /** What a pick does, with the sheet put away first: the focus on what it made, else back on the +. */
  closeFor(run: () => void): void;
  /**
   * A drag begun in it: the sheet put away at once, the focus on its + — until the part dropped takes it, or kept there
   * if the drag is called off — without the page moving under the pointer.
   */
  stepAside(): void;
  destroy(): void;
}

let sheets = 0;

export function toolsSheet(options: { el: ElementFactory; doc: Document; root: HTMLElement; side: HTMLElement; words: DesignerWords }): ToolsSheet {
  const { el, doc, root, side } = options;
  const w = options.words.toolbox;
  const id = `fd-tools-sheet-${++sheets}`;
  const shut = el('button', { type: 'button', class: 'fd-icon-button fd-tools-sheet-close', 'aria-label': w.closeToolbox, title: w.closeToolbox }, '×');
  const sheet = el('div', { class: 'fd-tools-sheet', id, role: 'dialog', 'aria-modal': 'true', 'aria-label': w.railLabel }, shut);
  const backdrop = el('div', { class: 'fd-dialog-backdrop fd-tools-backdrop' }, sheet);
  let opener: HTMLElement | null = null;
  /** Where the side stands beside the page, to go back to. */
  let home: { parent: Node; next: Node | null } | null = null;

  /** Whether the + is on show: the toolbox does not fit beside the page. */
  const narrow = () => !!opener?.isConnected && (doc.defaultView?.getComputedStyle(opener).display ?? 'none') !== 'none' && opener.getClientRects().length > 0;

  function show(by: HTMLElement) {
    if (backdrop.isConnected) return;
    opener = by;
    home = { parent: side.parentNode as Node, next: side.nextSibling };
    sheet.append(side);
    root.append(backdrop);
    by.setAttribute('aria-expanded', 'true');
    // The tab shown takes the focus, as a dialog's first stop: a box to type in would bring up a phone's keyboard.
    side.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }

  function close(giveBack = true) {
    if (!backdrop.isConnected) return;
    if (home) {
      const { parent, next } = home;
      parent.insertBefore(side, next && next.parentNode === parent ? next : parent.firstChild);
    }
    backdrop.remove();
    opener?.setAttribute('aria-expanded', 'false');
    if (giveBack && narrow()) opener?.focus();
  }

  shut.addEventListener('click', () => close());
  // A press beside the sheet, on the page under it: put away, the page as it was.
  backdrop.addEventListener('click', (event) => event.target === backdrop && close());
  sheet.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      // The editor's own Escape puts the card picked down: this one only puts the sheet away.
      event.stopPropagation();
      close();
    } else keepTabIn(sheet, event);
  });
  // Grown wide enough for the toolbox beside the page: it goes back there.
  const View = doc.defaultView as (Window & { ResizeObserver?: typeof ResizeObserver }) | null;
  const watcher = View?.ResizeObserver ? new View.ResizeObserver(() => backdrop.isConnected && !narrow() && close(false)) : null;
  watcher?.observe(root);

  return {
    get open() {
      return backdrop.isConnected;
    },
    show,
    close,
    closeFor(run) {
      const was = backdrop.isConnected;
      const by = opener;
      close(false);
      run();
      const now = doc.activeElement;
      if (was && (!now || now === doc.body || !now.isConnected)) by?.focus();
    },
    stepAside() {
      if (!backdrop.isConnected) return;
      close(false);
      // The tile pressed went back with the side, out of sight: the keys stay with the sheet's +.
      if (narrow()) opener?.focus({ preventScroll: true });
    },
    destroy() {
      watcher?.disconnect();
      close(false);
    },
  };
}
