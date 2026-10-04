import type { ElementFactory } from './chrome';
import { designerIcon } from './icons';

/**
 * A small menu of choices under the button that opened it: the editor a
 * field is shown with, or its width. The current choice is marked and takes
 * the keyboard first; arrows move, Enter picks, Escape gives focus back.
 * One is open at a time, and pressing anywhere else closes it.
 */

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  checked?: boolean;
  /** Starts a group of items, under this heading. */
  heading?: string;
  /** Starts a group of items, under a line. */
  divider?: boolean;
}

export interface MenuOptions {
  el: ElementFactory;
  anchor: HTMLElement;
  title?: string;
  items: MenuItem[];
  /** A line under the items: why these, and not others. */
  note?: string;
  /**
   * Things to do rather than one to choose: items are actions, and an item
   * with `checked` set is a switch, on or off.
   */
  actions?: boolean;
  /** Google Forms' roomy rows, for a menu with an icon on each. */
  roomy?: boolean;
  onPick(id: string): void;
}

let open: { close(focus?: boolean): void } | null = null;
/** Ids for menus' notes, unique on the page. */
let notes = 0;

export function openMenu(options: MenuOptions): { element: HTMLElement; close(): void } {
  open?.close(false);
  const { el, anchor } = options;
  const doc = anchor.ownerDocument;
  // A menu holds items. With none — no versions yet — its note is all there is: a small dialog that takes focus, so it is read.
  const empty = options.items.length === 0;
  const menu = el('div', { class: options.roomy ? 'fd-menu fd-menu-roomy' : 'fd-menu', role: empty ? 'dialog' : 'menu', 'aria-label': options.title, tabindex: empty ? '-1' : undefined });
  if (options.title) menu.append(el('div', { class: 'fd-menu-title', 'aria-hidden': 'true' }, options.title));
  const buttons: HTMLButtonElement[] = [];
  for (const item of options.items) {
    if (item.divider && buttons.length) menu.append(el('div', { class: 'fd-menu-divider', role: 'separator' }));
    if (item.heading) menu.append(el('div', { class: 'fd-menu-heading', role: 'presentation' }, item.heading));
    const role = !options.actions ? 'menuitemradio' : item.checked === undefined ? 'menuitem' : 'menuitemcheckbox';
    const button = el(
      'button',
      { type: 'button', class: 'fd-menu-item', role, 'aria-checked': role === 'menuitem' ? undefined : String(!!item.checked), 'data-item': item.id, tabindex: '-1' },
      ...(item.icon ? [designerIcon(doc, item.icon)] : []),
      el('span', { class: 'fd-menu-label' }, item.label)
    );
    button.addEventListener('click', () => {
      close(true);
      options.onPick(item.id);
    });
    buttons.push(button);
    menu.append(button);
  }
  if (options.note) {
    const note = el('p', { class: 'fd-menu-note', id: `fd-menu-note-${++notes}` }, options.note);
    menu.append(note);
    if (empty) menu.setAttribute('aria-describedby', note.id);
  }

  const onKey = (event: KeyboardEvent) => {
    const at = buttons.indexOf(doc.activeElement as HTMLButtonElement);
    // With nothing to pick, only Escape and Tab are the menu's: the rest go on to the page.
    if (!buttons.length && event.key !== 'Escape' && event.key !== 'Tab') return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      buttons[at]?.click();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(false);
  };
  menu.addEventListener('keydown', onKey);
  const onOutside = (event: Event) => {
    if (!menu.contains(event.target as Node) && event.target !== anchor && !anchor.contains(event.target as Node)) close(false);
  };
  doc.addEventListener('pointerdown', onOutside, true);

  function close(focusAnchor = false) {
    if (!menu.isConnected) return;
    menu.remove();
    doc.removeEventListener('pointerdown', onOutside, true);
    anchor.setAttribute('aria-expanded', 'false');
    if (open?.close === close) open = null;
    if (focusAnchor) anchor.focus();
  }

  // Inside the editor, so the menu keeps the form's look; fixed, so nothing clips it.
  (anchor.closest('.fd-form') ?? doc.body).append(menu);
  anchor.setAttribute('aria-expanded', 'true');
  const r = anchor.getBoundingClientRect();
  const view = doc.defaultView;
  const width = menu.offsetWidth || 240;
  const height = menu.offsetHeight || 0;
  const left = Math.max(8, Math.min(r.left, (view?.innerWidth ?? 1024) - width - 8));
  const below = r.bottom + 6;
  const top = view && below + height > view.innerHeight - 8 && r.top - height - 6 > 8 ? r.top - height - 6 : below;
  Object.assign(menu.style, { left: `${left}px`, top: `${top}px` });
  // The current choice takes the keyboard first; in a menu of things to do, the first of them.
  (options.actions ? buttons[0] : buttons.find((b) => b.getAttribute('aria-checked') === 'true') ?? buttons[0])?.focus();
  if (empty) menu.focus();
  open = { close };
  return { element: menu, close: () => close(false) };
}
