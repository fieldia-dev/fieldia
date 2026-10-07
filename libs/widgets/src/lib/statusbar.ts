import type { FilterItem, Locale, RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
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
    if (saves) void form.save();
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
  }

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
    element: list,
    focus: () => list.querySelector<HTMLElement>('button:not([disabled])')?.focus(),
    destroy() {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('scroll', away, true);
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
