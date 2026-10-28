import { answerOf, LINK_URL, plainWords, safeUrl, recordSentence, type Form, type MenuItem, type RecordId, type RecordToolbar, type RunResult, type Tone } from '@fieldia/core';
import { drawIcon, type IconSet, type Loading } from '@fieldia/widgets';
import { setAttr, setHidden, setText, type El } from './dom';
import { hotkeyOn } from './hotkeys';
import type { ViewerLabels } from './labels';
import { prefetchPrint } from './print';
import { later } from './later';
import { barredWords } from './save-safety';

/**
 * The records round the one shown, for the pager over it: how many there
 * are, where this one is among them (from 0), and the id at a place, which
 * may come from the server.
 */
export interface RecordPager {
  total: number;
  at: number;
  id(at: number): RecordId | Promise<RecordId>;
}

/** A page on the way to the record, as the breadcrumbs show it: its words, and what a press does — back to it. */
export interface Breadcrumb {
  label: string;
  /** Back to that page: the app's own way. */
  open?: () => void;
  /** Or an address to go to. */
  href?: string;
}

/** What the bar over a record needs of the viewer that draws it. */
export interface RecordBarContext {
  doc: Document;
  el: El;
  form: Form;
  toolbar: RecordToolbar | undefined;
  records: readonly RecordId[] | RecordPager | undefined;
  breadcrumbs: readonly Breadcrumb[] | undefined;
  labels: ViewerLabels;
  /** The language the bar's words are in, for a capital a record's name begins a sentence with ("Customers"). */
  locale?: string;
  icons?: IconSet;
  uid(id: string): string;
  fill(template: string, values: Record<string, string | number>): string;
  withIcon(name: string | undefined, text: string): (Node | string)[];
  /** A press of an item: one run at a time, the gear busy meanwhile. */
  press(button: HTMLElement, run: () => Promise<RunResult>): Promise<void>;
  /** The record's name, as its crumb says it; empty for a new one. */
  name(): string;
  /** Save what changed before the pager moves on, then the form's one check (`form.leave()`); false keeps the record where it is. */
  leave(): Promise<boolean>;
  /** Draw the form again: the pager's records changed, the record shown perhaps not. */
  render(): void;
  /** The menus inside the gear menu (`MenuItem.menu`, `menuFrom`): the head part's, which a page with any loads first. */
  submenus?: SubmenuMaker;
  /** A menu of the page's own before the gear: its record templates (the templates part). */
  extra?: { element: HTMLElement; update(): void };
  /** How the page waits (loading.ts in @fieldia/widgets): a menu's items the app gives, as they come. Fieldia's without it. */
  loading?: Loading;
  /** Words said as the viewer says them: why the app could not give the pager its next record, in the app's words. */
  say?(message: string, tone: Tone): void;
}

const GEAR: IconSet = {
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};

const same = (a: RecordId | null | undefined, b: RecordId | null | undefined) => a != null && b != null && String(a) === String(b);

/** One of the bar's sentences in the words the form's page names its records by (`records`), else as it says them plainly. */
const sentenceOf = (context: Pick<RecordBarContext, 'form' | 'locale'>) => (noun: string | undefined, words: string, values?: Record<string, string | number>) => recordSentence(context.form.page.records, noun, words, context.locale, values);

/**
 * The bar over a record, as Flectra's control panel: the breadcrumbs the app
 * gives, the gear menu the page fills (its Print group, then its actions),
 * and the pager over the records the app gives. Null when it would hold
 * nothing. A dialog is given neither breadcrumbs nor records, so there only
 * the menu shows; on a phone the trail folds to the page before this one.
 */
export function recordBar(context: RecordBarContext): { element: HTMLElement; update(): void; destroy(): void } | null {
  const { el, labels, toolbar } = context;
  const menuItems = toolbar?.menu ?? [];
  const trail = toolbar?.breadcrumbs === false ? undefined : context.breadcrumbs;
  const given = toolbar?.pager === false ? undefined : context.records;
  if (!menuItems.length && !trail?.length && !given && !context.extra) return null;
  const updaters: (() => void)[] = [];
  const cleanups: (() => void)[] = [];
  const bar = el('div', { class: 'fd-record-bar' });

  // ---- the trail ----
  if (trail?.length) {
    const current = el('span', { class: 'fd-crumb-current', 'aria-current': 'page' });
    const list = el(
      'ol',
      {},
      ...trail.map((crumb) => {
        const link = crumb.href !== undefined ? el('a', { class: 'fd-crumb', href: safeUrl(crumb.href, LINK_URL) }, crumb.label) : el('button', { type: 'button', class: 'fd-crumb' }, crumb.label);
        // The app's way back, through the form's one check — which waits for a save on its way, and asks only about
        // work at risk — then the app's own way, or the address in this tab. A link opened in another tab, or with a
        // key held, leaves the form as it is: the browser's.
        const plain = (event: Event) => {
          const click = event as MouseEvent;
          return !click.button && !click.ctrlKey && !click.metaKey && !click.shiftKey && !click.altKey;
        };
        link.addEventListener('click', (event) => {
          if (crumb.href !== undefined && !plain(event)) return;
          // Nothing to wait for and nothing at risk: at once, as always — an address followed as the browser follows it.
          if (context.form.leaveNow()) {
            if (!crumb.open) return;
            event.preventDefault();
            return crumb.open();
          }
          event.preventDefault();
          void context.form.leave().then((yes) => {
            if (!yes) return;
            if (crumb.open) crumb.open();
            else if (safeUrl(crumb.href, LINK_URL)) context.doc.defaultView?.location.assign(safeUrl(crumb.href, LINK_URL) as string);
          });
        });
        return el('li', {}, link);
      }),
      el('li', {}, current)
    );
    bar.append(el('nav', { class: 'fd-breadcrumbs', 'aria-label': labels.breadcrumbs }, list));
    const newRecord = sentenceOf(context)(labels.newRecordNoun, labels.newRecord);
    updaters.push(() => setText(current, context.name() || newRecord));
  }

  // ---- the page's templates, then the gear menu ----
  if (context.extra) {
    bar.append(context.extra.element);
    updaters.push(context.extra.update);
  }
  if (menuItems.length) bar.append(recordMenu(context, menuItems, updaters, cleanups));

  // ---- the pager ----
  if (given) bar.append(pager(context, given, trail, updaters, cleanups));

  return {
    element: bar,
    update: () => {
      for (const update of updaters) update();
    },
    destroy: () => {
      for (const cleanup of cleanups) cleanup();
    },
  };
}

/** What the record's menu needs of the viewer that draws it. */
export type RecordMenuContext = Pick<RecordBarContext, 'doc' | 'el' | 'form' | 'labels' | 'locale' | 'uid' | 'withIcon' | 'press' | 'submenus' | 'loading'>;

/** An item of a menu as drawn: its button, or a divider's line. */
export interface MenuEntry {
  item: MenuItem;
  button: HTMLElement;
}

/** A menu, as the menus inside it are given it to open beside its items: what an item pressed in them needs of it. */
export interface MenuTree {
  context: RecordMenuContext;
  /** The button the menu opens from, busy while an item runs. */
  opener: HTMLElement;
  /** The whole menu closed, the focus back on its button when `refocus`. */
  close(refocus: boolean): void;
  /** Draw what shows again: the app gave a menu's items. */
  refresh(): void;
  /** An item's words: its own, else a built-in's. */
  words(item: MenuItem): string;
}

/** A menu's dividers and the menus inside it, opened beside the items that hold them (menu-flyout.ts, the head part's). */
export interface Submenus {
  /** A key pressed in the menu: the arrow toward an item's menu opens it. True when it took the key. */
  key(event: KeyboardEvent): boolean;
  /** The menu opened: the items the app gives asked for again. */
  opened(): void;
  /** The menu closed: its menus with it. */
  closed(): void;
  /** At each change of the form, after its items' conditions: an item with nothing in its menu to show hidden, the dividers left only between items that show. */
  update(): void;
}

export type SubmenuMaker = (tree: MenuTree, entries: readonly MenuEntry[], menu: HTMLElement) => Submenus;

/** Whether an item opens a menu of its own, or the app's, rather than doing something. */
export const opensMenu = (item: MenuItem): boolean => !!item.menu?.length || item.menuFrom !== undefined;

/**
 * A menu's items, drawn: each a menu item with its icon and words, `run` at a press; a divider a line; one that opens
 * a menu its words alone, its menu wired by the head part.
 */
export function menuEntries(context: Pick<RecordMenuContext, 'el' | 'withIcon'>, items: readonly MenuItem[], words: (item: MenuItem) => string, run: (item: MenuItem) => void): MenuEntry[] {
  const { el } = context;
  return items.map((item) => {
    if (item.type === 'divider') return { item, button: el('div', { class: 'fd-record-menu-rule', role: 'separator', 'data-node': item.id }) };
    const button = el('button', { type: 'button', role: 'menuitem', tabindex: '-1', class: 'fd-record-menu-item', 'data-node': item.id }, ...context.withIcon(item.icon, words(item)));
    if (!opensMenu(item)) button.addEventListener('click', () => run(item));
    return { item, button };
  });
}

/**
 * The record's menu: the gear with its words over a record, or — `more` —
 * ⋮ alone at the end of a record head's buttons, named "More actions". A
 * real menu, opened with Enter, Space or the arrows, its items reached with
 * the arrows, gone with Escape; its dividers and the menus inside it as the
 * page says (`MenuItem.type`, `menu`, `menuFrom`).
 */
export function recordMenu(context: RecordMenuContext, items: readonly MenuItem[], updaters: (() => void)[], cleanups: (() => void)[], look: 'gear' | 'more' = 'gear'): HTMLElement {
  const { doc, el, form, labels } = context;
  const id = context.uid(look === 'more' ? 'record-more' : 'record-menu');
  const name = look === 'more' ? labels.moreActions : labels.actions;
  const gear = el('button', { type: 'button', class: look === 'more' ? 'fd-button fd-record-gear fd-head-more' : 'fd-button fd-record-gear', id: `${id}-button`, 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': id, title: name, 'aria-label': look === 'more' ? name : undefined });
  const icon = drawIcon(doc, look === 'more' ? 'more' : 'gear', GEAR);
  if (icon) gear.append(icon);
  if (look === 'gear') gear.append(el('span', { class: 'fd-record-gear-words' }, labels.actions));
  const menu = el('div', { class: 'fd-record-menu', role: 'menu', id, 'aria-labelledby': gear.id, hidden: '' });
  // The built-in Print is under its Print heading: "This record".
  const words = (item: MenuItem) => plainWords(item.label) ?? (item.builtin === 'print' ? sentenceOf(context)(labels.printRecordNoun, labels.printRecord) : item.builtin ? labels[item.builtin] : item.id);
  const drawn = menuEntries(context, items, words, (item) => {
    close(true);
    void context.press(gear, () => form.runAction(item.id));
  });
  // Under Print: the app's reports, and the built-in Print unless it says otherwise.
  const underPrint = (item: MenuItem) => (item.group ?? (item.builtin === 'print' ? 'print' : 'actions')) === 'print';
  const printed = drawn.filter((d) => underPrint(d.item));
  const acted = drawn.filter((d) => !underPrint(d.item));
  const heading = el('div', { class: 'fd-record-menu-heading', role: 'presentation' }, labels.print);
  const printGroup = el('div', { role: 'group', 'aria-label': labels.print }, heading, ...printed.map((d) => d.button));
  const rule = el('div', { class: 'fd-record-menu-rule', role: 'separator' });
  menu.append(...(printed.length ? [printGroup] : []), ...(printed.length && acted.length ? [rule] : []), ...acted.map((d) => d.button));
  // Why a built-in the record's source does not open to this person is not here: at the menu's foot, and with the gear for a screen reader.
  const builtins = items.flatMap((item) => (item.builtin && !item.steps?.length && item.action === undefined ? [item.builtin] : []));
  const note = el('div', { class: 'fd-record-menu-note', id: `${id}-note`, role: 'none', hidden: '' });
  if (builtins.length) menu.append(note);
  const wrap = el('div', { class: 'fd-record-actions' }, gear, menu);
  // Its dividers, and the menus inside it beside the items that open them: the head part's; where it could not come,
  // neither is shown.
  const nested = drawn.some((d) => d.item.type || opensMenu(d.item)) ? context.submenus?.({ context, opener: gear, close, refresh: () => paint(), words }, drawn, menu) : undefined;

  const shown = () => drawn.filter((d) => !d.button.hidden && !d.item.type).map((d) => d.button);
  const onOutside = (event: Event) => {
    if (!wrap.contains(event.target as Node)) close(false);
  };
  function open(at: 'first' | 'last') {
    if (!menu.hidden) return;
    menu.hidden = false;
    // From the gear's start, unless that runs past the screen's edge: then from its end.
    menu.removeAttribute('data-end');
    const box = menu.getBoundingClientRect();
    if (box.right > doc.documentElement.clientWidth - 4 || box.left < 4) menu.setAttribute('data-end', '');
    gear.setAttribute('aria-expanded', 'true');
    doc.addEventListener('pointerdown', onOutside, true);
    // Its built-in Print in sight: the print part fetched, for the press that may come.
    if (drawn.some((d) => d.item.builtin === 'print' && !d.button.hidden)) prefetchPrint();
    nested?.opened();
    const items = shown();
    (at === 'first' ? items[0] : items[items.length - 1])?.focus();
  }
  function close(refocus: boolean) {
    if (menu.hidden) return;
    nested?.closed();
    menu.hidden = true;
    gear.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('pointerdown', onOutside, true);
    if (refocus) gear.focus();
  }
  cleanups.push(() => doc.removeEventListener('pointerdown', onOutside, true), () => nested?.closed());
  gear.addEventListener('click', () => (menu.hidden ? open('first') : close(false)));
  gear.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  });
  menu.addEventListener('keydown', (event) => {
    if (nested?.key(event)) return;
    const items = shown();
    const at = items.indexOf(doc.activeElement as HTMLButtonElement);
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[event.key];
    if (to !== undefined) {
      event.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    } else if (event.key === 'Escape') {
      // Escape closes the menu, not the dialog round the form.
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(false);
  });

  function paint() {
    // Each item by its condition; a divider, and one that opens a menu, by what is round it and in it (`nested`).
    for (const { item, button } of drawn) setHidden(button, form.node(item.id).invisible || ((!!item.type || opensMenu(item)) && !nested));
    nested?.update();
    setHidden(printGroup, !printed.some((d) => !d.button.hidden));
    setHidden(rule, printGroup.hidden || !acted.some((d) => !d.button.hidden));
    setHidden(wrap, !shown().length);
    if (!builtins.length) return;
    const why = barredWords(form.getState().can, builtins, labels);
    setHidden(note, !why);
    setText(note, why ?? '');
    setAttr(gear, 'aria-describedby', why ? note.id : null);
  }
  updaters.push(paint);
  return wrap;
}

/** "3 / 42" with Previous and Next, round from the last to the first as Flectra's; Alt+P and Alt+N press them. */
function pager(context: RecordBarContext, given: readonly RecordId[] | RecordPager, trail: readonly Breadcrumb[] | undefined, updaters: (() => void)[], cleanups: (() => void)[]): HTMLElement {
  const { el, form, labels } = context;
  /** The ids, when the app gave them; else the app's count and its place, followed as the pager moves. */
  const ids: RecordId[] | null = Array.isArray(given) ? [...given] : null;
  const asked = Array.isArray(given) ? null : (given as RecordPager);
  let total = ids ? ids.length : (asked as RecordPager).total;
  let at = ids ? -1 : (asked as RecordPager).at;
  /** The record the app's place stands for: once the form shows another, its place is unknown. */
  let placed: RecordId | null = ids ? null : form.getState().recordId;
  let moving = false;
  const here = () => {
    const id = form.getState().recordId;
    if (ids) return ids.findIndex((other) => same(other, id));
    return same(placed, id) ? at : -1;
  };
  // "3 / 42" reads left to right in every language, as numbers do.
  const text = el('span', { class: 'fd-record-pager-text', dir: 'ltr' });
  const sentence = sentenceOf(context);
  const [before, after] = [sentence(labels.previousRecordNoun, labels.previousRecord), sentence(labels.nextRecordNoun, labels.nextRecord)];
  const previous = el('button', { type: 'button', class: 'fd-button fd-record-step', 'aria-label': before }, el('span', { 'aria-hidden': 'true', class: 'fd-record-arrow' }, '‹'));
  const next = el('button', { type: 'button', class: 'fd-button fd-record-step', 'aria-label': after }, el('span', { 'aria-hidden': 'true', class: 'fd-record-arrow' }, '›'));
  hotkeyOn(previous, 'p', before);
  hotkeyOn(next, 'n', after);
  const box = el('div', { class: 'fd-record-pager', role: 'group', 'aria-label': sentence(labels.recordsNoun, labels.records) }, text, previous, next);

  /** The id at a place: the app's, where it gives a count — its answer handled as it is given, the engine's own (`answerOf`). */
  const idAt = (place: number): RecordId | PromiseLike<RecordId> => answerOf(ids ? ids[place] : (asked as RecordPager).id(place));
  const cannot = (error: unknown) => context.say?.((error as Error)?.message ?? String(error), 'danger');
  async function move(by: number) {
    const from = here();
    if (moving || from === -1 || total < 2) return;
    moving = true;
    try {
      const to = (from + by + total) % total;
      // The id first, which may come from the server: a change made while it is looked up is saved with the rest. The
      // record shown replaced meanwhile (the app opened another), the place it was counted from is gone: no move.
      const shown = form.recordShown();
      let id: RecordId;
      try {
        id = await idAt(to);
      } catch (error) {
        // The app could not give it: said; the record stays, and the next press asks again.
        return void (shown() && cannot(error));
      }
      if (!shown()) return;
      if (!(await context.leave())) return;
      at = to;
      placed = id;
      // Through the one check again, by construction: nothing is left to ask about by now.
      await form.openRecord(id);
    } finally {
      moving = false;
    }
  }
  previous.addEventListener('click', () => void move(-1));
  next.addEventListener('click', () => void move(1));

  // A copy joins the records after the one it was made from; a record deleted leaves them, the pager moving to the next.
  cleanups.push(
    form.on('duplicate', ({ from, recordId }) => {
      if (!ids) return;
      const place = ids.findIndex((id) => same(id, from));
      ids.splice(place + 1, 0, recordId);
      total = ids.length;
      // Told once the copy shows: the pager counts it now.
      context.render();
    }),
    form.on('delete', ({ recordId }) => {
      const place = ids ? ids.findIndex((id) => same(id, recordId)) : same(placed, recordId) ? at : -1;
      if (place === -1) return;
      if (ids) ids.splice(place, 1);
      total = ids ? ids.length : total - 1;
      // Deleted once the pager had moved on: it leaves the records, and the one shown — with what is typed in it — stays.
      if (!same(form.getState().recordId, recordId)) return context.render();
      if (total < 1) return void trail?.[trail.length - 1]?.open?.();
      at = Math.min(place, total - 1);
      // At once when the id is at hand, so the form never starts a new record meanwhile.
      const go = (id: RecordId) => {
        placed = id;
        void form.openRecord(id);
      };
      const id = idAt(at);
      if (later(id)) id.then(go, cannot);
      else go(id);
    })
  );

  updaters.push(() => {
    const place = here();
    setHidden(box, place === -1);
    setText(text, context.fill(labels.recordAt, { n: place + 1, total }));
    const alone = total < 2;
    setAttr(previous, 'aria-disabled', alone ? 'true' : null);
    setAttr(next, 'aria-disabled', alone ? 'true' : null);
  });
  return box;
}
