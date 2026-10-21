import { installPartStyles, PART_RANK } from './styles';

/**
 * A repeat field (repeat.ts): the schedule part's sheet, put in its place among Fieldia's the first time a page draws
 * one (installPartStyles, PART_RANK.schedule). Its boxes are Fieldia's own (`.fd-input`, a number's and a date's),
 * which every page has.
 */
export const SCHEDULE_CSS = /* css */ `
/* ---- a repeat field: how often, which days, when it ends, in words ----------------------------------------------- */
.fd-repeat { display: grid; gap: 8px; min-width: 0; }
.fd-repeat-head, .fd-repeat-ends, .fd-repeat-month { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-width: 0; }
.fd-repeat-head > .fd-select { flex: 0 1 auto; width: auto; max-width: 100%; }
.fd-repeat-every, .fd-repeat-end-part, .fd-repeat-part { display: inline-flex; align-items: center; gap: 6px; }
.fd-repeat-every[hidden], .fd-repeat-end-part[hidden], .fd-repeat-days[hidden], .fd-repeat-month[hidden], .fd-repeat-ends[hidden],
.fd-repeat-month > [hidden] { display: none; }
.fd-repeat-every .fd-input, .fd-repeat-end-part .fd-input[inputmode="numeric"] { width: 5em; }
.fd-repeat-month > .fd-select, .fd-repeat-ends .fd-select { width: auto; }
.fd-repeat-name, .fd-repeat-unit { color: var(--fd-muted); font-size: 13px; }
.fd-repeat-days { display: flex; flex-wrap: wrap; gap: 6px; }
.fd-repeat-day {
  min-width: 44px; min-height: 36px; padding: 4px 8px; border: 1px solid var(--fd-border); border-radius: 999px;
  background: var(--fd-surface); color: var(--fd-text); font: inherit; font-size: 13px; cursor: pointer;
}
.fd-repeat-day[aria-pressed="true"] { background: var(--fd-accent); border-color: var(--fd-accent); color: var(--fd-accent-text); font-weight: 600; }
.fd-repeat-day[aria-disabled="true"] { cursor: default; }
.fd-repeat-day:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-repeat-words { margin: 0; font-size: 13px; color: var(--fd-text); }

`;

/** The schedule part's sheet, once, in its place. */
export function installScheduleStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-schedule-styles', SCHEDULE_CSS, PART_RANK.schedule);
}
