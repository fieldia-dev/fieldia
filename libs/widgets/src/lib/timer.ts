import type { Value } from '@fieldia/core';
import { maker, setAttr, setText } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * A live timer: Flectra's mrp_timer, and the legal timer. On a number, the
 * time logged — hours, or minutes with `options.unit: "minutes"` — and, while
 * the date and time `options.startField` names is set, the time since then on
 * top of it, ticking each second. On a date and time, the time since it.
 * Never typed: the page's buttons start and stop it, setting the start and
 * logging the time, as Flectra's do.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Seconds as HH:MM:SS. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

const instant = (value: Value | undefined): number | null => {
  if (typeof value !== 'string' || !value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

export const timerWidget: WidgetFactory = ({ field, node, id, document }) => {
  const make = maker(document);
  const own = field.type === 'datetime';
  const startField = !own && typeof node.options?.['startField'] === 'string' ? (node.options['startField'] as string) : null;
  const perSecond = node.options?.['unit'] === 'minutes' ? 60 : 3600;
  const time = make('span', { class: 'fd-timer-time' });
  const element = make('span', { id, role: 'timer', class: 'fd-timer' }, make('span', { class: 'fd-timer-dot', 'aria-hidden': 'true' }), time);
  setAttr(element, 'aria-label', field.label);
  let logged = 0;
  let start: number | null = null;
  let ticking: ReturnType<typeof setInterval> | undefined;
  const show = () => setText(time, formatClock(logged + (start === null ? 0 : (Date.now() - start) / 1000)));
  const stop = () => {
    clearInterval(ticking);
    ticking = undefined;
  };
  return {
    element,
    focus: () => undefined,
    destroy: stop,
    update(state) {
      logged = !own && typeof state.value === 'number' ? state.value * perSecond : 0;
      start = own ? instant(state.value) : startField ? instant(state.values[startField]) : null;
      if (start !== null) element.dataset['running'] = 'true';
      else delete element.dataset['running'];
      show();
      if (start === null) stop();
      else if (!ticking) ticking = setInterval(() => (element.isConnected ? show() : stop()), 1000);
    },
  };
};
