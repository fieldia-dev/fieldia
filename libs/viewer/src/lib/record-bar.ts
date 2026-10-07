import type { Form, MenuItem, RecordId, RecordToolbar, RunResult } from '@fieldia/core';
import { drawIcon, type IconSet } from '@fieldia/widgets';
import { setAttr, setHidden, setText, type El } from './dom';
import { hotkeyOn } from './hotkeys';
import type { ViewerLabels } from './labels';

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
  icons?: IconSet;
  uid(id: string): string;
  fill(template: string, values: Record<string, string | number>): string;
  withIcon(name: string | undefined, text: string): (Node | string)[];
  /** A press of an item: one run at a time, the gear busy meanwhile. */
  press(button: HTMLElement, run: () => Promise<RunResult>): Promise<void>;
  /** The record's name, as its crumb says it; empty for a new one. */
  name(): string;
  /** Save what changed before the pager moves on; false keeps the record where it is. */
  leave(): Promise<boolean>;
}

const GEAR: IconSet = {
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};

const same = (a: RecordId | null | undefined, b: RecordId | null | undefined) => a != null && b != null && String(a) === String(b);

/**
 * The bar over a record, as Flectra's control panel: the breadcrumbs the app
 * gives, the gear menu the page fills (its Print group, then its actions),
 * and the pager over the records the app gives. Null when it would hold
 * nothing. A dialog is given neither breadcrumbs nor records, so there only
 * the menu shows; on a phone the trail folds to the page before this one.
 */
export function recordBar(context: RecordBarContext): { element: HTMLElement; update(): void; destroy(): void } | null {
  const { doc, el, form, labels, toolbar } = context;
  const menuItems = toolbar?.menu ?? [];
  const trail = toolbar?.breadcrumbs === false ? undefined : context.breadcrumbs;
  const given = toolbar?.pager === false ? undefined : context.records;
  if (!menuItems.length && !trail?.length && !given) return null;
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
        const link = crumb.href !== undefined ? el('a', { class: 'fd-crumb', href: crumb.href }, crumb.label) : el('button', { type: 'button', class: 'fd-crumb' }, crumb.label);
        if (crumb.open) {
          link.addEventListener('click', (event) => {
            event.preventDefault();
            crumb.open?.();
          });
        }
        return el('li', {}, link);
      }),
      el('li', {}, current)
    );
    bar.append(el('nav', { class: 'fd-breadcrumbs', 'aria-label': labels.breadcrumbs }, list));
    updaters.push(() => setText(current, context.name() || labels.newRecord));
  }

  // ---- the gear menu ----
  if (menuItems.length) bar.append(gearMenu(context, menuItems, updaters, cleanups));

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

/** The gear and its menu: a real menu, opened with Enter, Space or the arrows, its items reached with the arrows, gone with Escape. */
function gearMenu(context: RecordBarContext, items: readonly MenuItem[], updaters: (() => void)[], cleanups: (() => void)[]): HTMLElement {
  const { doc, el, form, labels } = context;
  const id = context.uid('record-menu');
  const gear = el('button', { type: 'button', class: 'fd-button fd-record-gear', id: `${id}-button`, 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': id, title: labels.actions });
  const icon = drawIcon(doc, 'gear', GEAR);
  if (icon) gear.append(icon);
  gear.append(el('span', { class: 'fd-record-gear-words' }, labels.actions));
  const menu = el('div', { class: 'fd-record-menu', role: 'menu', id, 'aria-labelledby': gear.id, hidden: '' });
  const drawn = items.map((item) => {
    const words = item.label ?? (item.builtin ? labels[item.builtin] : item.id);
    const button = el('button', { type: 'button', role: 'menuitem', tabindex: '-1', class: 'fd-record-menu-item', 'data-node': item.id }, ...context.withIcon(item.icon, words));
    if (item.builtin === 'delete') button.classList.add('fd-record-menu-danger');
    button.addEventListener('click', () => {
      close(true);
      void context.press(gear, () => form.runAction(item.id));
    });
    return { item, button };
  });
  const printed = drawn.filter((d) => d.item.group === 'print');
  const acted = drawn.filter((d) => d.item.group !== 'print');
  const heading = el('div', { class: 'fd-record-menu-heading', role: 'presentation' }, labels.print);
  const printGroup = el('div', { role: 'group', 'aria-label': labels.print }, heading, ...printed.map((d) => d.button));
  const rule = el('div', { class: 'fd-record-menu-rule', role: 'separator' });
  menu.append(...(printed.length ? [printGroup] : []), ...(printed.length && acted.length ? [rule] : []), ...acted.map((d) => d.button));
  const wrap = el('div', { class: 'fd-record-actions' }, gear, menu);

  const shown = () => drawn.filter((d) => !d.button.hidden).map((d) => d.button);
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
    const items = shown();
    (at === 'first' ? items[0] : items[items.length - 1])?.focus();
  }
  function close(refocus: boolean) {
    if (menu.hidden) return;
    menu.hidden = true;
    gear.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('pointerdown', onOutside, true);
    if (refocus) gear.focus();
  }
  cleanups.push(() => doc.removeEventListener('pointerdown', onOutside, true));
  gear.addEventListener('click', () => (menu.hidden ? open('first') : close(false)));
  gear.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  });
  menu.addEventListener('keydown', (event) => {
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

  updaters.push(() => {
    for (const { item, button } of drawn) setHidden(button, form.node(item.id).invisible);
    setHidden(printGroup, !printed.some((d) => !d.button.hidden));
    setHidden(rule, printGroup.hidden || !acted.some((d) => !d.button.hidden));
    setHidden(wrap, !drawn.some((d) => !d.button.hidden));
  });
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
  const previous = el('button', { type: 'button', class: 'fd-button fd-record-step', 'aria-label': labels.previousRecord }, el('span', { 'aria-hidden': 'true', class: 'fd-record-arrow' }, '‹'));
  const next = el('button', { type: 'button', class: 'fd-button fd-record-step', 'aria-label': labels.nextRecord }, el('span', { 'aria-hidden': 'true', class: 'fd-record-arrow' }, '›'));
  hotkeyOn(previous, 'p', labels.previousRecord);
  hotkeyOn(next, 'n', labels.nextRecord);
  const box = el('div', { class: 'fd-record-pager', role: 'group', 'aria-label': labels.records }, text, previous, next);

  const idAt = async (place: number): Promise<RecordId> => (ids ? ids[place] : (asked as RecordPager).id(place));
  async function move(by: number) {
    const from = here();
    if (moving || from === -1 || total < 2) return;
    moving = true;
    try {
      const to = (from + by + total) % total;
      if (!(await context.leave())) return;
      const id = await idAt(to);
      at = to;
      placed = id;
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
    }),
    form.on('delete', ({ recordId }) => {
      const place = ids ? ids.findIndex((id) => same(id, recordId)) : same(placed, recordId) ? at : -1;
      if (place === -1) return;
      if (ids) ids.splice(place, 1);
      total = ids ? ids.length : total - 1;
      if (total < 1) return void trail?.[trail.length - 1]?.open?.();
      at = Math.min(place, total - 1);
      // At once when the id is at hand, so the form never starts a new record meanwhile.
      const go = (id: RecordId) => {
        placed = id;
        void form.openRecord(id);
      };
      const id = ids ? ids[at] : (asked as RecordPager).id(at);
      if (id instanceof Promise) void id.then(go);
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
