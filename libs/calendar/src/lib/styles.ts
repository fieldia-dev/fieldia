import { fieldiaStyle } from '@fieldia/widgets';
/**
 * A list's calendar in Fieldia's tokens, so a theme, a host's own tokens and
 * the dark scheme reach it: each record a tint of the surface with a bar in
 * its colour, which reads on a light page and a dark one alike. Logical
 * sides throughout, so right to left needs nothing of its own but the arrows.
 */
export const CALENDAR_CSS = `
.fd-cal { position: relative; display: grid; gap: 10px; min-width: 0; color: var(--fd-text); container: fd-cal / inline-size; --fd-cal-hour: 48px; }
.fd-cal-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.fd-cal-nav { display: inline-flex; gap: 4px; align-items: center; }
.fd-cal .fd-button { min-height: 32px; }
.fd-cal-step { min-width: 32px; padding-inline: 6px; display: inline-grid; place-items: center; }
.fd-cal-step svg { width: 16px; height: 16px; }
.fd-cal-step:dir(rtl) svg { transform: scaleX(-1); }
.fd-cal-title { margin: 0; flex: 1 1 12em; min-width: 0; font-size: 1.05rem; font-weight: 600; }
/* The zone the times are on, after the span, where it is not the reader's own: its short name, as a date box says it. */
.fd-cal-zone { flex: none; padding: 1px 8px; border: 1px solid var(--fd-border); border-radius: 999px; font-size: 12.5px; color: var(--fd-muted); white-space: nowrap; }
.fd-cal-ranges { display: inline-flex; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); overflow: hidden; }
.fd-cal-ranges .fd-button { border: 0; border-radius: 0; padding-inline: 10px; }
.fd-cal-ranges .fd-button + .fd-button { border-inline-start: 1px solid var(--fd-border); }
.fd-cal-ranges .fd-button[aria-pressed="true"] { background: var(--fd-accent-soft); color: var(--fd-accent); font-weight: 600; }
.fd-cal-said:not(:empty), .fd-cal-alert:not(:empty) { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 6px 10px; border-radius: var(--fd-control-radius); font-size: 13.5px; }
.fd-cal-said:not(:empty) { background: var(--fd-info-soft); color: var(--fd-text); }
.fd-cal-alert:not(:empty) { background: var(--fd-error-soft); color: var(--fd-text); }
.fd-cal-said .fd-button { min-height: 28px; }
.fd-cal-note { margin: 0; color: var(--fd-muted); font-size: 13px; }
.fd-cal-body { min-width: 0; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); background: var(--fd-surface); overflow: hidden; }
.fd-cal-body[aria-busy="true"] { cursor: progress; }
.fd-cal-failed { margin: 0; padding: 24px; text-align: center; }
.fd-cal-empty { margin: 0; padding: 32px 16px; text-align: center; color: var(--fd-muted); }

/* The day and the week: the hours down the side, a column for each day or each person. */
.fd-cal-scroll { overflow-x: auto; }
.fd-cal-grid { display: grid; grid-template-columns: 52px repeat(var(--fd-cal-cols), minmax(var(--fd-cal-min, 0px), 1fr)); min-width: min-content; }
.fd-cal-corner, .fd-cal-head { box-sizing: border-box; padding: 6px 4px; border-bottom: 1px solid var(--fd-border); font-size: 12px; color: var(--fd-muted); text-align: center; min-width: 0; }
.fd-cal-head { border-inline-start: 1px solid var(--fd-border); overflow-wrap: anywhere; }
.fd-cal-head-day { display: inline-grid; justify-items: center; gap: 2px; border: 0; background: none; color: inherit; font: inherit; padding: 2px 6px; border-radius: var(--fd-control-radius); cursor: pointer; }
.fd-cal-head-day:hover { background: var(--fd-accent-soft); }
.fd-cal-head-day:focus-visible, .fd-cal-daynum:focus-visible, .fd-cal-more:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-cal-head-num { font-size: 18px; line-height: 28px; min-width: 28px; border-radius: 999px; color: var(--fd-text); }
.fd-cal-head[aria-current="date"] .fd-cal-head-num { background: var(--fd-accent); color: var(--fd-accent-text); }
.fd-cal-head-who { font-size: 13px; font-weight: 600; color: var(--fd-text); }
.fd-cal-corner { font-size: 11px; display: grid; align-items: end; justify-items: end; padding-inline-end: 6px; }
.fd-cal-allday { box-sizing: border-box; display: grid; align-content: start; gap: 2px; padding: 2px; min-height: 30px; min-width: 0; border-inline-start: 1px solid var(--fd-border); border-bottom: 1px solid var(--fd-border); }
.fd-cal-allday[data-alone] { min-height: 240px; }
.fd-cal-hours { position: relative; height: calc(var(--fd-cal-span) * var(--fd-cal-hour)); }
.fd-cal-hour { position: absolute; inset-inline-end: 6px; transform: translateY(-50%); font-size: 11px; color: var(--fd-muted); font-variant-numeric: tabular-nums; }
.fd-cal-hour:first-child { transform: none; }
.fd-cal-col {
  position: relative; min-width: 0; border-inline-start: 1px solid var(--fd-border); height: calc(var(--fd-cal-span) * var(--fd-cal-hour));
  background-image: repeating-linear-gradient(to bottom, var(--fd-border) 0 1px, transparent 1px calc(var(--fd-cal-hour) / 2), color-mix(in srgb, var(--fd-border) 50%, transparent) calc(var(--fd-cal-hour) / 2) calc(var(--fd-cal-hour) / 2 + 1px), transparent calc(var(--fd-cal-hour) / 2 + 1px) var(--fd-cal-hour));
}
.fd-cal-col[data-today] { background-color: color-mix(in srgb, var(--fd-accent) 4%, transparent); }
.fd-cal-slot { box-sizing: border-box; height: calc(var(--fd-cal-hour) * var(--fd-cal-slot) / 60); }
.fd-cal[data-creates] .fd-cal-slot, .fd-cal[data-creates] .fd-cal-allday, .fd-cal[data-creates] .fd-cal-day { cursor: cell; }
.fd-cal-slot:focus { outline: none; }
.fd-cal-slot:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; background: var(--fd-accent-soft); }
.fd-cal-picking { position: absolute; inset-inline: 2px; z-index: 2; box-sizing: border-box; border: 1px dashed var(--fd-accent); border-radius: 4px; background: var(--fd-accent-soft); pointer-events: none; }
/* Under the records, so a record's words are never struck through. */
.fd-cal-now { position: absolute; inset-inline: 0; z-index: 0; height: 2px; margin-top: -1px; background: var(--fd-error); pointer-events: none; }
.fd-cal-now::before { content: ""; position: absolute; inset-inline-start: -5px; top: -4px; width: 10px; height: 10px; border-radius: 50%; background: var(--fd-error); }

/* A record: a tint of the surface, a bar in its colour. */
.fd-cal-event {
  --fd-cal-c: var(--fd-accent);
  box-sizing: border-box; min-width: 0; overflow: hidden; padding: 2px 6px; border-radius: 4px; font-size: 12.5px; line-height: 1.3;
  background: color-mix(in srgb, var(--fd-cal-c) 16%, var(--fd-surface)); color: var(--fd-text); border-inline-start: 3px solid var(--fd-cal-c);
  cursor: default; user-select: none; -webkit-user-select: none;
}
.fd-cal-event[data-opens], .fd-cal-event[data-moves] { cursor: pointer; }
.fd-cal-event:hover, .fd-cal-event.fd-cal-hot { background: color-mix(in srgb, var(--fd-cal-c) 26%, var(--fd-surface)); }
.fd-cal-event:focus { outline: none; }
.fd-cal-event:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; z-index: 3; }
.fd-cal-col > .fd-cal-event { position: absolute; z-index: 1; box-shadow: 0 0 0 1px var(--fd-surface); line-height: 16px; container: fd-cal-ev / inline-size; }
/* Its words in the whole lines its height holds (--fd-cal-lines, by linesIn): none cut through. */
.fd-cal-col > .fd-cal-event > .fd-cal-event-text { display: block; max-height: calc(var(--fd-cal-lines, 1) * 16px); overflow: hidden; text-overflow: ellipsis; }
/* Each word whole, a long one cut with "…"; too narrow for its time, the name alone (the hours say when). */
.fd-cal-col .fd-cal-event-title { overflow-wrap: normal; }
.fd-cal-col .fd-cal-event-who { overflow: hidden; text-overflow: ellipsis; }
@container fd-cal-ev (max-width: 56px) { .fd-cal-col .fd-cal-event-time, .fd-cal-col .fd-cal-event-who { display: none; } }
.fd-cal-event[data-moving] { opacity: 0.9; z-index: 6; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22); pointer-events: none; }
.fd-cal-event[aria-busy="true"] { opacity: 0.75; }
.fd-cal-event-time { font-variant-numeric: tabular-nums; }
.fd-cal-event-title { font-weight: 600; overflow-wrap: anywhere; text-align: match-parent; }
.fd-cal-event-who { display: block; opacity: 0.85; }
/* 24 pixels at least, so a finger or a pointer can hit each (WCAG 2.5.8). */
:is(.fd-cal-allday, .fd-cal-day) > .fd-cal-event, :is(.fd-cal-allday, .fd-cal-day) > .fd-cal-visit > .fd-cal-event { position: relative; min-height: 24px; box-sizing: border-box; line-height: 20px; white-space: nowrap; padding-inline-end: 24px; }
.fd-cal-col > .fd-cal-event[data-short] .fd-cal-event-who { display: none; }
/* One line (a short record, a month's day, all day): the name cut with "…" at its own end, so a Latin one right to left
   keeps its start; whole when pointed at, and to a screen reader. */
.fd-cal-col > .fd-cal-event[data-short] > .fd-cal-event-text, .fd-cal-allday .fd-cal-event-text, .fd-cal-day .fd-cal-event-text { display: flex; gap: 0.3em; white-space: nowrap; }
:is(.fd-cal-col > .fd-cal-event[data-short], .fd-cal-allday .fd-cal-event, .fd-cal-day .fd-cal-event) .fd-cal-event-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.fd-cal-resize { position: absolute; inset-inline: 0; bottom: 0; height: 8px; cursor: ns-resize; touch-action: none; }
.fd-cal-event-menu {
  position: absolute; top: 0; inset-inline-end: 0; z-index: 2; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 4px;
  display: none; place-items: center; background: var(--fd-surface); color: var(--fd-text); font: 700 14px/1 system-ui, sans-serif; cursor: pointer;
}
/* Beside its block, over its end corner, never in it (a button in a button is no button). */
.fd-cal-col > .fd-cal-event-menu { inset-inline-end: auto; }
.fd-cal-visit { position: relative; display: grid; min-width: 0; }
.fd-cal-event:is(:hover, :focus) + .fd-cal-event-menu, .fd-cal-event-menu:is(:hover, :focus-visible), .fd-cal-event:is(:hover, :focus-within) > .fd-cal-event-menu { display: grid; }
.fd-cal-event-menu:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
@media (hover: none) { .fd-cal-event-menu { display: grid; } }
.fd-cal-event[data-moving] + .fd-cal-event-menu { display: none; }

/* The month: whole weeks, each day its records, and how many more. */
.fd-cal-month { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.fd-cal-weekday { padding: 6px 4px; border-bottom: 1px solid var(--fd-border); font-size: 12px; color: var(--fd-muted); text-align: center; }
.fd-cal-weekday + .fd-cal-weekday, .fd-cal-day:not(:nth-child(7n + 1)) { border-inline-start: 1px solid var(--fd-border); }
.fd-cal-day { box-sizing: border-box; min-width: 0; min-height: 104px; padding: 3px; display: grid; align-content: start; gap: 2px; border-bottom: 1px solid var(--fd-border); }
.fd-cal-day[data-out] { background: color-mix(in srgb, var(--fd-text) 3%, var(--fd-surface)); }
.fd-cal-daynum { justify-self: start; min-width: 26px; height: 26px; padding: 0 6px; border: 0; border-radius: 999px; background: none; color: var(--fd-text); font: inherit; font-size: 12.5px; cursor: pointer; }
.fd-cal-day[data-out] .fd-cal-daynum { color: var(--fd-muted); }
.fd-cal-day[aria-current="date"] .fd-cal-daynum { background: var(--fd-accent); color: var(--fd-accent-text); font-weight: 600; }
.fd-cal-more { justify-self: start; min-height: 24px; padding: 0 6px; border: 0; background: none; color: var(--fd-accent); font: inherit; font-size: 12px; cursor: pointer; }
/* A crowded slot's "+N more", in the last lane over the records it holds. */
.fd-cal-col > .fd-cal-more {
  position: absolute; z-index: 1; box-sizing: border-box; display: block; padding: 3px 2px; line-height: 14px; text-align: center; overflow: hidden;
  border-radius: 4px; border: 1px dashed color-mix(in srgb, var(--fd-accent) 55%, transparent); background: var(--fd-accent-soft); font-weight: 600;
}
.fd-cal-col > .fd-cal-more:hover { background: color-mix(in srgb, var(--fd-accent) 22%, var(--fd-surface)); }
.fd-cal-day .fd-cal-event .fd-cal-event-who { display: none; }

/* The agenda: each day that has something, its records in order. */
.fd-cal-agenda-day { display: grid; grid-template-columns: minmax(8em, 11em) minmax(0, 1fr); border-bottom: 1px solid var(--fd-border); }
.fd-cal-agenda-day:last-child { border-bottom: 0; }
.fd-cal-agenda-head { margin: 0; padding: 10px 12px; font-size: 13px; font-weight: 600; }
.fd-cal-agenda-day[aria-current="date"] .fd-cal-agenda-head { color: var(--fd-accent); }
.fd-cal-agenda-list { list-style: none; margin: 0; padding: 6px 8px; display: grid; gap: 4px; min-width: 0; }
.fd-cal-agenda-list .fd-cal-event { position: relative; padding: 0; font-size: 13.5px; }
.fd-cal-event-open { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; padding-block: 8px; padding-inline: 10px 48px; border-radius: inherit; }
.fd-cal-event[data-opens] .fd-cal-event-open { cursor: pointer; }
.fd-cal-event-open:focus { outline: none; }
.fd-cal-event-open:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-cal-agenda-list .fd-cal-event-who { grid-column: 2; }
.fd-cal-agenda-list .fd-cal-event-menu { display: grid; top: 50%; transform: translateY(-50%); inset-inline-end: 6px; width: 36px; height: 36px; }
.fd-cal-agenda-list .fd-cal-event-menu:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
@container fd-cal (max-width: 520px) {
  .fd-cal-agenda-day { grid-template-columns: minmax(0, 1fr); }
  .fd-cal-agenda-head { padding-bottom: 0; }
  .fd-cal-title { flex-basis: 100%; order: -1; }
}

/* "Move to…": its day, its time, its person; and a crowded slot's list, in the same kind of box. */
.fd-cal-move, .fd-cal-crowd {
  position: absolute; z-index: 30; box-sizing: border-box; width: min(320px, calc(100% - 16px)); padding: 14px; display: grid; gap: 10px;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: max(var(--fd-radius), 6px); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
}
.fd-cal-move-title { margin: 0; font-size: 14px; font-weight: 600; }
.fd-cal-move label { display: grid; gap: 4px; font-size: 13px; }
.fd-cal-move-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.fd-cal-move-problem { margin: 0; color: var(--fd-error); font-size: 13px; }
.fd-cal-move-problem:empty { display: none; }
.fd-cal-move .fd-input[aria-invalid="true"] { border-color: var(--fd-error); }
.fd-cal-crowd { padding: 10px; gap: 6px; }
.fd-cal-crowd-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-inline-start: 4px; }
.fd-cal-crowd .fd-cal-agenda-list { padding: 0; max-height: min(60vh, 360px); overflow-y: auto; }
`;

/** The calendar's stylesheet, once per document, before the page's own so an app's rule wins. */
export function installCalendarStyles(doc: Document) {
  if (doc.getElementById('fieldia-calendar-styles')) return;
  const style = fieldiaStyle(doc, CALENDAR_CSS, 'fieldia-calendar-styles');
  doc.head.prepend(style);
}
