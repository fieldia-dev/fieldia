import type { FilterItem, Locale, RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { whileShown } from './shown';
import { installBusinessStyles } from './styles-business-part';
import type { WidgetFactory } from './widgets';

/**
 * Where a record stands, as a row of steps with the current one marked: a
 * selection's states, or the records a link may point to (stages). Used in a
 * sheet's header, and anywhere in a form with `"widget": "statusbar"`. Options:
 *
 *   clickable       true to let a click move the record to another step
 *   visibleStates   the values to show; the current one always shows
 *   durationsField  a json field holding the seconds spent in each step, by
 *                   the step's value (a stage's id): shown on each step
 *   fold            stages whose record is folded go under More at the end,
 *                   unless the record stands on one
 *   saves           a click also saves the record at once
 *
 * Where its steps are wider than its room (a phone), it scrolls: the step the
 * record is in is scrolled into view, at rest it starts on a step — never one cut
 * mid-word — and each edge with more steps past it fades, with a sign that it
 * scrolls (`data-more-before`, `data-more-after`).
 *
 * It comes in the business part (business-part.ts): the viewer waits for it
 * before it draws a sheet with a statusbar, or a form with one.
 */

interface Step {
  key: string;
  label: string;
  value: unknown;
  folded: boolean;
}

/** Seconds as a person reads time spent: days, else hours, else minutes, short. */
function timeSpent(seconds: number, locale: Locale): string {
  const [amount, unit] = seconds >= 86400 ? [seconds / 86400, 'day'] : seconds >= 3600 ? [seconds / 3600, 'hour'] : [Math.max(1, seconds / 60), 'minute'];
  try {
    return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'narrow', maximumFractionDigits: 0, numberingSystem: 'latn' }).format(Math.floor(amount));
  } catch {
    return `${Math.floor(amount)}${unit[0]}`;
  }
}

export const statusbarWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, locale = 'en' }) => {
  installBusinessStyles(document);
  const options = node.options ?? {};
  const clickable = options['clickable'] === true;
  const visible = Array.isArray(options['visibleStates']) ? options['visibleStates'] : null;
  const durationsField = typeof options['durationsField'] === 'string' ? options['durationsField'] : null;
  const fold = options['fold'] === true;
  const saves = options['saves'] === true;
  const list = document.createElement('ol');
  list.className = 'fd-statusbar';
  list.id = id;
  list.setAttribute('aria-label', field.label);
  // Its signs that more steps are past an edge, over the bar's edges, never scrolled with it.
  const sign = (side: 'before' | 'after') => {
    const mark = document.createElement('span');
    mark.className = 'fd-statusbar-sign';
    mark.dataset['side'] = side;
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = side === 'before' ? '‹' : '›';
    return mark;
  };
  const frame = document.createElement('div');
  frame.className = 'fd-statusbar-frame';
  frame.append(list, sign('before'), sign('after'));

  const keyOf = (value: unknown) =>
    value && typeof value === 'object' && 'id' in value ? `id:${String((value as RelatedRecord).id)}` : `v:${String(value)}`;
  /** A step's value as the record's time per step names it: a stage's id, or a choice's value. */
  const durationKey = (value: unknown) => (value && typeof value === 'object' && 'id' in value ? String((value as RelatedRecord).id) : String(value));
  // A selection knows its steps; a link's are looked up, and again whenever a
  // value its filter reads changes — the record's project, once it has loaded.
  let steps: Step[] =
    field.type === 'selection' ? field.options.map((o) => ({ key: keyOf(o.value), label: o.label, value: o.value, folded: false })) : [];
  const reads: string[] = [];
  const readsOf = (items: readonly FilterItem[]): void =>
    items.forEach((item) => ('any' in item ? readsOf(item.any) : 'all' in item ? readsOf(item.all) : item.valueFrom && reads.push(item.valueFrom)));
  if (field.type === 'many2one') readsOf(field.filter ?? []);
  let lookedUp: string | null = field.type === 'selection' ? '' : null;
  let asked = 0;
  let last: { value: unknown; readonly: boolean; durations: Record<string, unknown> } = { value: undefined, readonly: false, durations: {} };
  /** What the bar shows now: drawn again only when that changes — redrawing a focused step loses the focus, and the form redraws as focus leaves. */
  let drawn = '';
  let menuOpen = false;

  /** Move the record to a step; and, when told to, save it at once. */
  const pick = (step: Step) => {
    form.setValue(name, step.value as never);
    // Saved once what the server works out from the step is back, as Flectra saves after its onchange — the record it
    // was moved on, only while that one is shown: never another the form shows by then.
    if (saves) void form.settled().then(whileShown(form, () => void form.save()));
  };

  function draw() {
    const { value, readonly, durations } = last;
    // A step clicked becomes the current one: the focus stays on it as the bar is drawn again.
    const focused = list.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset['key'] : undefined;
    const currentKey = value === null || value === undefined ? null : keyOf(value);
    let shown = steps.filter((s) => !visible || visible.some((v) => keyOf(v) === s.key) || s.key === currentKey);
    if (currentKey && !shown.some((s) => s.key === currentKey) && value && typeof value === 'object') {
      shown = [...shown, { key: currentKey, label: (value as RelatedRecord).label, value, folded: false }];
    }
    // Folded stages wait under More, the one the record stands on excepted.
    const folded = fold ? shown.filter((s) => s.folded && s.key !== currentKey) : [];
    shown = shown.filter((s) => !folded.includes(s));
    const times = shown.map((s) => (durationsField ? Number(durations[durationKey(s.value)] ?? 0) : 0));
    const now = JSON.stringify([shown.map((s) => [s.key, s.label]), folded.map((s) => s.key), times, currentKey, readonly, menuOpen]);
    if (now === drawn) return;
    drawn = now;
    const items = shown.map((step, i) => {
      const label = document.createElement('span');
      label.textContent = step.label;
      const inner = document.createElement(clickable ? 'button' : 'span');
      if (inner instanceof HTMLButtonElement) {
        inner.type = 'button';
        inner.disabled = readonly;
        inner.dataset['key'] = step.key;
        inner.addEventListener('click', () => pick(step));
      }
      inner.append(label);
      // The time the record spent in it, when the app tells it.
      if (times[i] > 0) {
        const time = document.createElement('small');
        time.className = 'fd-step-time';
        time.textContent = timeSpent(times[i], locale);
        inner.title = labels.timeInStep.replace('{time}', time.textContent);
        inner.append(time);
      }
      if (step.key === currentKey) inner.setAttribute('aria-current', 'step');
      const item = document.createElement('li');
      item.append(inner);
      return item;
    });
    if (folded.length) items.push(moreItem(folded, readonly));
    list.replaceChildren(...items);
    // The menu is fixed to the page, so the bar's scrolling never cuts it: under More, from its end.
    const menu = list.querySelector<HTMLElement>('.fd-step-menu:not([hidden])');
    const toggle = menu?.previousElementSibling;
    if (menu && toggle) {
      const at = toggle.getBoundingClientRect();
      const view = document.defaultView;
      const rtl = getComputedStyle(list).direction === 'rtl';
      menu.style.top = `${at.bottom + 4}px`;
      if (rtl) menu.style.left = `${at.left}px`;
      else menu.style.right = `${Math.max(0, (view?.innerWidth ?? at.right) - at.right)}px`;
    }
    if (focused) [...list.querySelectorAll('button')].find((b) => b.dataset['key'] === focused)?.focus();
    fitEnd();
    // Another step now, or drawn anew: the one the record is in, in view.
    if (currentKey !== inView) {
      inView = currentKey;
      showCurrent();
    }
    edges();
  }

  /** The step the record is in when the bar was last brought to it: brought again only when that changes. */
  let inView: string | null | undefined;
  const rtl = () => getComputedStyle(list).direction === 'rtl';
  /** A step's start and end against the bar's start, as it reads: from its right, right to left. */
  const along = (item: Element) => {
    const room = list.getBoundingClientRect();
    const at = item.getBoundingClientRect();
    return rtl() ? { start: room.right - at.right, end: room.right - at.left } : { start: at.left - room.left, end: at.right - room.left };
  };
  /** Scroll the bar alone (never the page) by `by` towards its end, as it reads. */
  const scrollAlong = (by: number) => {
    if (by) list.scrollLeft += rtl() ? -by : by;
  };
  /** Where a step past the first starts at rest: after the room of the sign that more is before (the sheet's scroll-padding). */
  const SIGN = 24;
  /**
   * The step the record is in, in view: the bar starting on the step that shows the most of what comes before it with
   * it whole — the signs' room at either edge with more past it left free — a step too wide for the bar from its own start.
   */
  function showCurrent() {
    if (list.scrollWidth <= list.clientWidth + 1) return;
    const items = [...list.children];
    const at = items.findIndex((item) => item.querySelector('[aria-current="step"]'));
    if (at < 0) return;
    const end = along(items[at]).end + (at < items.length - 1 ? SIGN : 0);
    const room = (i: number) => list.clientWidth - (i > 0 ? SIGN : 0);
    const first = items.findIndex((item, i) => i <= at && end - along(item).start <= room(i));
    const start = first < 0 ? at : first;
    scrollAlong(along(items[start]).start - (start > 0 ? SIGN : 0));
  }
  /**
   * Room after the last step, where the bar scrolls, as much as lets it start on a step when scrolled to its end too:
   * every place it comes to rest starts on a step, never one cut mid-word.
   */
  function fitEnd() {
    const items = [...list.children] as HTMLElement[];
    const last = items[items.length - 1];
    if (!last) return;
    last.style.removeProperty('padding-inline-end');
    const room = list.clientWidth;
    if (list.scrollWidth <= room + 1) return;
    const scrolled = Math.abs(list.scrollLeft);
    const end = list.scrollWidth - room;
    // Each place it rests: the first step at the start, any other after the sign's room.
    const next = items.map((item, i) => along(item).start + scrolled - (i > 0 ? SIGN : 0)).find((start) => start >= end - 1);
    // Room inside the last step's own item, after its arrow: every engine scrolls over it, as it would not a margin.
    if (next !== undefined && next - end > 1) last.style.setProperty('padding-inline-end', `${Math.ceil(next - end)}px`);
  }
  /** Each edge with steps past it, said for its fade and its sign. */
  function edges() {
    const items = [...list.children];
    const first = items[0];
    const last = items[items.length - 1];
    list.toggleAttribute('data-more-before', !!first && along(first).start < -1);
    list.toggleAttribute('data-more-after', !!last && along(last).end > list.clientWidth + 1);
    // Scrolled from the keyboard too: steps no one may press give the bar itself the focus, where it scrolls.
    const scrolls = list.scrollWidth > list.clientWidth + 1 && !list.querySelector('button');
    if (scrolls !== list.hasAttribute('tabindex')) {
      if (scrolls) list.setAttribute('tabindex', '0');
      else list.removeAttribute('tabindex');
    }
  }
  list.addEventListener('scroll', edges, { passive: true });
  // Its room changed — the page laid out, turned, its window narrowed: the step it is in brought into view again.
  const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    fitEnd();
    showCurrent();
    edges();
  }) : null;
  resized?.observe(list);

  /** The folded stages, in a menu at the bar's end: picked as any step when the bar can be clicked. */
  function moreItem(folded: Step[], readonly: boolean): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'fd-step-more';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.dataset['key'] = 'more';
    toggle.setAttribute('aria-haspopup', 'menu');
    toggle.setAttribute('aria-expanded', String(menuOpen));
    toggle.setAttribute('aria-label', labels.moreSteps);
    toggle.title = labels.moreSteps;
    const dots = document.createElement('span');
    dots.textContent = '⋯';
    dots.setAttribute('aria-hidden', 'true');
    toggle.append(dots);
    const menu = document.createElement('div');
    menu.className = 'fd-step-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = !menuOpen;
    for (const step of folded) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.setAttribute('role', 'menuitem');
      choice.textContent = step.label;
      choice.disabled = readonly || !clickable;
      choice.addEventListener('click', () => {
        menuOpen = false;
        pick(step);
        draw();
      });
      menu.append(choice);
    }
    toggle.addEventListener('click', () => {
      menuOpen = !menuOpen;
      draw();
      if (menuOpen) list.querySelector<HTMLElement>('.fd-step-menu button:not([disabled])')?.focus();
    });
    menu.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      menuOpen = false;
      draw();
      list.querySelector<HTMLElement>('.fd-step-more > button')?.focus();
    });
    item.append(toggle, menu);
    return item;
  }

  // A click elsewhere, or the page scrolled from under it, puts the menu away.
  const away = (event: Event) => {
    if (menuOpen && !list.contains(event.target as Node)) {
      menuOpen = false;
      draw();
    }
  };
  document.addEventListener('pointerdown', away);
  document.addEventListener('scroll', away, true);

  return {
    element: frame,
    focus: () => list.querySelector<HTMLElement>('button:not([disabled])')?.focus(),
    destroy() {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('scroll', away, true);
      resized?.disconnect();
    },
    update(state) {
      const durations = durationsField ? state.values?.[durationsField] : null;
      last = { value: state.value, readonly: state.readonly, durations: durations && typeof durations === 'object' && !Array.isArray(durations) ? (durations as Record<string, unknown>) : {} };
      draw();
      const key = field.type === 'selection' ? '' : JSON.stringify(reads.map((read) => state.values?.[read] ?? null));
      if (lookedUp !== key) {
        lookedUp = key;
        const ask = ++asked;
        void form
          .search(name, '', 20)
          .then((records) => {
            // Only the latest answer counts: an earlier search may come back last.
            if (ask !== asked) return;
            steps = records.map((r) => ({ key: keyOf(r), label: r.label, value: r, folded: r.folded === true }));
            draw();
          })
          .catch(() => undefined);
      }
    },
  };
};
