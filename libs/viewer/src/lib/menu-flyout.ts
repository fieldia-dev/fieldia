import type { ActionStep, MenuItem } from '@fieldia/core';
import { drawIcon } from '@fieldia/widgets';
import { setHidden } from './dom';
import { installHeadStyles } from './head-styles';
import { menuEntries, opensMenu, type MenuEntry, type MenuTree, type Submenus } from './record-bar';

/**
 * The menus inside a menu (the head part's): an item with a `menu` of its own,
 * or one the app gives as the menu opens (`menuFrom`), shows › and opens its
 * menu beside it — pointed at, pressed, or with Enter, Space or the arrow
 * toward it; the arrow back and Escape close it, the focus back on its item.
 * It stands beside the menu it is in, on the side with room, kept on the
 * screen, over everything else (the page's top layer, where the browser has
 * one). Its items run as the menu's own do — the app's by their steps, then
 * their action, their `confirm` asked first. An item whose menu has nothing to
 * show is not shown.
 */

/** The items the app gave as a menu opened: pressed by what they say, never by an id of the page. */
const given = new WeakSet<MenuItem>();

/** What an item the app gave does: its question, its steps, then its action. */
const stepsOf = (item: MenuItem): ActionStep[] => [
  ...(item.confirm ? [{ do: 'ask' as const, message: item.confirm }] : []),
  ...(item.steps ?? []),
  ...(item.action !== undefined ? [{ do: 'call' as const, action: item.action, ...(item.params ? { params: item.params } : {}) }] : []),
];

/** The app's items as they can be drawn: each by an id, named unless a divider; a built-in is the page's alone. */
function takeGiven(items: unknown): MenuItem[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((one): MenuItem[] => {
    const item = one as MenuItem | null;
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || item.builtin !== undefined) return [];
    if (item.type !== 'divider' && typeof item.label !== 'string') return [];
    const kept: MenuItem = { ...item, ...(item.menu ? { menu: takeGiven(item.menu) } : {}) };
    given.add(kept);
    return [kept];
  });
}

/**
 * Dividers only between items that show, in each part of a menu (its Print group, its actions): none first, last, or
 * two together. Their own conditions are read first.
 */
export function tidyRules(entries: readonly MenuEntry[]): void {
  const parts = new Map<Element | null, MenuEntry[]>();
  for (const entry of entries) parts.set(entry.button.parentElement, [...(parts.get(entry.button.parentElement) ?? []), entry]);
  for (const part of parts.values()) {
    let before = false;
    let rule: HTMLElement | null = null;
    for (const { item, button } of part) {
      if (item.type === 'divider') {
        if (before && !button.hidden) rule ??= button;
        button.hidden = true;
      } else if (!button.hidden) {
        if (rule) rule.hidden = false;
        rule = null;
        before = true;
      }
    }
  }
}

/** The items of a menu that show, to move along: its menu items, not its lines. */
export const menuItemsShown = (entries: readonly MenuEntry[]): HTMLElement[] => entries.filter((d) => d.item.type !== 'divider' && !d.button.hidden).map((d) => d.button);

/** Time a pointer may take crossing another item on its way into an open menu before that menu closes. */
const CROSSING = 250;

/** The menus inside a menu, and how to take them away again (the app's, given anew). */
type Nested = Submenus & { openersOnly(): void; drop(): void };

export function submenus(tree: MenuTree, entries: readonly MenuEntry[], menu: HTMLElement): Nested {
  const { context } = tree;
  const { doc, form } = context;
  installHeadStyles(doc);
  const openers = entries.filter((entry) => opensMenu(entry.item)).map(flyout);
  let crossing: ReturnType<typeof setTimeout> | undefined;
  // Which way its words run: as the page lays it out, else as the nearest element that says so.
  const rtl = () => (doc.defaultView?.getComputedStyle(menu).direction || menu.closest('[dir]')?.getAttribute('dir')) === 'rtl';
  const closeAll = () => {
    clearTimeout(crossing);
    for (const one of openers) one.shut(false);
  };
  // A pointer on another item of this menu: the open one closes, unless the pointer goes on into it meanwhile.
  const crossed = (event: Event) => {
    const on = entries.find((entry) => entry.button.contains(event.target as Node));
    if (!on) return;
    clearTimeout(crossing);
    const open = openers.find((one) => one.isOpen() && one.entry !== on);
    if (open) crossing = setTimeout(() => open.shut(false), CROSSING);
  };
  if (openers.length) menu.addEventListener('pointerover', crossed);

  return {
    key(event) {
      const at = openers.find((one) => one.entry.button === doc.activeElement);
      if (!at || event.key !== (rtl() ? 'ArrowLeft' : 'ArrowRight')) return false;
      event.preventDefault();
      at.open(true);
      return true;
    },
    opened: () => openers.forEach((one) => one.ask()),
    closed: closeAll,
    update() {
      for (const one of openers) one.update();
      tidyRules(entries);
    },
    /** Its items that open a menu, alone: a menu whose own and the app's items are tidied as one. */
    openersOnly: () => openers.forEach((one) => one.update()),
    drop() {
      closeAll();
      menu.removeEventListener('pointerover', crossed);
      for (const one of openers) one.drop();
    },
  };

  /** An item's menu: drawn once, its own items first, the app's after them as they come. */
  function flyout(entry: MenuEntry) {
    const { item, button } = entry;
    const id = context.uid(`${item.id}-menu`);
    button.id ||= context.uid(`${item.id}-item`);
    for (const [name, value] of Object.entries({ 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': id })) button.setAttribute(name, value);
    const chevron = drawIcon(doc, 'chevron-right');
    if (chevron) {
      chevron.classList.add('fd-menu-more');
      button.append(chevron);
    }
    const box = context.el('div', { class: 'fd-record-menu fd-menu-flyout', role: 'menu', id, 'aria-labelledby': button.id, tabindex: '-1', hidden: '' });
    const topLayer = typeof box.showPopover === 'function';
    if (topLayer) box.setAttribute('popover', 'manual');
    const waiting = context.el('div', { class: 'fd-menu-waiting', role: 'none', hidden: '' }, context.labels.loading);
    const run = (one: MenuItem) => {
      tree.close(true);
      void context.press(tree.opener, () => (given.has(one) ? form.run(stepsOf(one), { id: one.id, ...(one.label ? { yes: one.label } : {}) }) : form.runAction(one.id)));
    };
    const own = menuEntries(context, item.menu ?? [], tree.words, run);
    const ownNested = submenus(tree, own, box);
    let theirs: MenuEntry[] = [];
    let theirNested: Nested | null = null;
    /** Whether the app has answered since the menu opened (always, for a menu of the page's alone); the latest ask. */
    let answered = item.menuFrom === undefined;
    let asked = 0;
    const all = () => [...own, ...theirs];
    box.prepend(...own.map((one) => one.button), waiting);
    menu.append(box);

    box.addEventListener('keydown', (event) => {
      if (ownNested.key(event) || theirNested?.key(event)) return event.stopPropagation();
      const items = menuItemsShown(all());
      const at = items.indexOf(doc.activeElement as HTMLElement);
      const to = ({ ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 } as Record<string, number>)[event.key];
      if (to !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        items[(to + items.length) % items.length]?.focus();
      } else if (event.key === 'Escape' || event.key === (rtl() ? 'ArrowRight' : 'ArrowLeft')) {
        // Back to its item, the menu it is in still open; never the dialog round the form.
        event.preventDefault();
        event.stopPropagation();
        shut(true);
      }
    });
    box.addEventListener('pointerover', () => clearTimeout(crossing));
    button.addEventListener('click', () => open(true));
    button.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') open(false);
    });

    /**
     * Beside the menu it is in, toward where its words run where there is room, else the other side; with room on
     * neither (a phone's), under its item, set in a little, so the item stays in sight. On the screen.
     */
    function place() {
      // As tall as its items: WebKit's popover is as tall as the window unless told (its `fit-content` height).
      Object.assign(box.style, { position: 'fixed', inset: 'auto', margin: '0', height: 'auto' });
      const [at, beside] = [button.getBoundingClientRect(), menu.getBoundingClientRect()];
      const [width, height] = [doc.documentElement.clientWidth, doc.documentElement.clientHeight];
      const [wide, tall] = [box.offsetWidth, box.offsetHeight];
      const after = rtl() ? beside.left - wide : beside.right;
      const before = rtl() ? beside.right : beside.left - wide;
      const fits = (left: number) => left >= 8 && left + wide <= width - 8;
      const side = fits(after) ? after : fits(before) ? before : null;
      const under = at.bottom + tall + 8 <= height ? at.bottom + 2 : at.top - tall - 2;
      const left = side ?? (rtl() ? beside.right - wide - 16 : beside.left + 16);
      // Beside: its first item level with the item that opened it, the menu's own room above its items (its edge and 4px) taken off.
      const top = side === null ? under : at.top - 5;
      Object.assign(box.style, { left: `${Math.round(Math.max(8, Math.min(left, width - wide - 8)))}px`, top: `${Math.round(Math.max(8, Math.min(top, height - tall - 8)))}px` });
    }
    const follow = () => {
      if (isOpen()) place();
    };

    function isOpen() {
      return !box.hidden;
    }
    function open(focus: boolean) {
      clearTimeout(crossing);
      for (const other of openers) if (other.entry !== entry) other.shut(false);
      if (!isOpen()) {
        box.hidden = false;
        if (topLayer && !box.matches(':popover-open')) box.showPopover();
        button.setAttribute('aria-expanded', 'true');
        box.setAttribute('aria-busy', String(!answered));
        place();
        doc.addEventListener('scroll', follow, true);
        doc.defaultView?.addEventListener('resize', follow);
        ownNested.opened();
        theirNested?.opened();
      }
      if (focus) (menuItemsShown(all())[0] ?? box).focus();
    }
    function shut(refocus: boolean) {
      if (!isOpen()) return;
      ownNested.closed();
      theirNested?.closed();
      if (topLayer && box.matches(':popover-open')) box.hidePopover();
      box.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      doc.removeEventListener('scroll', follow, true);
      doc.defaultView?.removeEventListener('resize', follow);
      if (refocus) button.focus();
    }

    /** The app's items, asked for each time the menu it is in opens: the latest ask's answer, for the record it was asked on. */
    function ask() {
      const action = item.menuFrom;
      if (action === undefined) return;
      const round = ++asked;
      const shown = form.recordShown();
      answered = false;
      box.setAttribute('aria-busy', 'true');
      let answer: unknown;
      const heard = form.on('action', ({ request, result }) => {
        if (request.id === item.id && request.action === action) answer = result?.menu;
      });
      paint();
      void form
        .run([{ do: 'call', action, ...(item.params ? { params: item.params } : {}) }], { id: item.id })
        .catch(() => undefined)
        .then(() => {
          heard();
          if (round !== asked || !shown()) return;
          answered = true;
          box.setAttribute('aria-busy', 'false');
          const waited = doc.activeElement === box;
          theirNested?.drop();
          for (const one of theirs) one.button.remove();
          theirs = menuEntries(context, takeGiven(answer), tree.words, run);
          box.append(...theirs.map((one) => one.button));
          theirNested = submenus(tree, theirs, box);
          tree.refresh();
          if (!isOpen()) return;
          place();
          // Waited for in the open menu: its first item, now there is one; with none, its item again (or the menu's first).
          if (!waited) return;
          const first = menuItemsShown(all())[0];
          if (first) first.focus();
          else (button.hidden ? menuItemsShown(entries)[0] : button)?.focus();
        });
    }

    /**
     * Its items by their conditions — the app's as it gave them — its dividers between those that show, and its item
     * hidden where its menu has nothing to show once the app has answered.
     */
    function paint() {
      for (const { item: one, button: drawn } of all()) setHidden(drawn, !given.has(one) && form.node(one.id).invisible);
      ownNested.openersOnly();
      theirNested?.openersOnly();
      tidyRules(all());
      setHidden(waiting, answered);
      if (answered && !menuItemsShown(all()).length) setHidden(button, true);
      if (button.hidden) shut(false);
    }

    function drop() {
      shut(false);
      ownNested.drop();
      theirNested?.drop();
      box.remove();
    }

    return { entry, open, shut, isOpen, ask, update: paint, drop };
  }
}
