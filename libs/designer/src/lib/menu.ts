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
}

export interface MenuOptions {
  el: ElementFactory;
  anchor: HTMLElement;
  title?: string;
  items: MenuItem[];
  /** A line under the items: why these, and not others. */
  note?: string;
  onPick(id: string): void;
}

let open: { close(focus?: boolean): void } | null = null;

export function openMenu(options: MenuOptions): { element: HTMLElement; close(): void } {
  open?.close(false);
  const { el, anchor } = options;
  const doc = anchor.ownerDocument;
  const menu = el('div', { class: 'fd-menu', role: 'menu', 'aria-label': options.title });
  if (options.title) menu.append(el('div', { class: 'fd-menu-title', 'aria-hidden': 'true' }, options.title));
  const buttons: HTMLButtonElement[] = [];
  for (const item of options.items) {
    if (item.heading) menu.append(el('div', { class: 'fd-menu-heading', role: 'presentation' }, item.heading));
    const button = el(
      'button',
      { type: 'button', class: 'fd-menu-item', role: 'menuitemradio', 'aria-checked': String(!!item.checked), 'data-item': item.id, tabindex: '-1' },
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
  if (options.note) menu.append(el('p', { class: 'fd-menu-note' }, options.note));

  const onKey = (event: KeyboardEvent) => {
    const at = buttons.indexOf(doc.activeElement as HTMLButtonElement);
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
  (buttons.find((b) => b.getAttribute('aria-checked') === 'true') ?? buttons[0])?.focus();
  open = { close };
  return { element: menu, close: () => close(false) };
}
