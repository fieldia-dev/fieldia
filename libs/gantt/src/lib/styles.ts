/**
 * A list's Gantt timeline in Fieldia's tokens, so a theme, a host's own
 * tokens and the dark scheme reach it: each bar a tint of the surface edged
 * in its colour, which reads on a light page and a dark one alike. Logical
 * sides throughout, so right to left runs the days from the right with
 * nothing of its own but the arrows' drawing, turned over. On paper, the
 * whole plan on the page's width, its colours kept (gantt-view.ts fits it).
 */
export const GANTT_CSS = `
.fd-gantt { position: relative; display: grid; gap: 10px; min-width: 0; color: var(--fd-text); container: fd-gantt / inline-size; }
.fd-gantt-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.fd-gantt .fd-button { min-height: 32px; }
.fd-gantt-title { margin: 0; flex: 1 1 12em; min-width: 0; font-size: 1.05rem; font-weight: 600; }
.fd-gantt-zone { flex: none; padding: 1px 8px; border: 1px solid var(--fd-border); border-radius: 999px; font-size: 12.5px; color: var(--fd-muted); white-space: nowrap; }
.fd-gantt-zooms { display: inline-flex; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); overflow: hidden; }
.fd-gantt-zooms .fd-button { border: 0; border-radius: 0; padding-inline: 10px; }
.fd-gantt-zooms .fd-button + .fd-button { border-inline-start: 1px solid var(--fd-border); }
.fd-gantt-zooms .fd-button[aria-pressed="true"] { background: var(--fd-accent-soft); color: var(--fd-accent); font-weight: 600; }
.fd-gantt-said:not(:empty), .fd-gantt-alert:not(:empty) { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 6px 10px; border-radius: var(--fd-control-radius); font-size: 13.5px; }
.fd-gantt-said:not(:empty) { background: var(--fd-info-soft); color: var(--fd-text); }
.fd-gantt-alert:not(:empty) { background: var(--fd-error-soft); color: var(--fd-text); }
.fd-gantt-said .fd-button { min-height: 28px; }
.fd-gantt-note { margin: 0; color: var(--fd-muted); font-size: 13px; }
.fd-gantt-body { --fd-gantt-names: 240px; min-width: 0; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); background: var(--fd-surface); overflow: hidden; }
.fd-gantt-body[aria-busy="true"] { cursor: progress; }
.fd-gantt-failed, .fd-gantt-empty { margin: 0; padding: 32px 16px; text-align: center; }
.fd-gantt-empty { color: var(--fd-muted); }
.fd-gantt-scroll { overflow: auto; max-height: min(70vh, 720px); overscroll-behavior-x: contain; }
.fd-gantt-sheet { position: relative; width: max-content; min-width: 100%; }

/* The axis: months over days or weeks, years over months; it stays in sight as the rows scroll under it. */
.fd-gantt-head { position: sticky; top: 0; z-index: 4; display: flex; background: var(--fd-surface); border-bottom: 1px solid var(--fd-border); }
/* The names kept in sight over the days, a little of their own colour past their start: at a screen's fractional scale
   no sliver of a bar shows between them and the timeline's edge. */
.fd-gantt-corner, .fd-gantt-name {
  --fd-gantt-cell: var(--fd-surface);
  position: sticky; inset-inline-start: 0; flex: none; box-sizing: border-box; width: var(--fd-gantt-names);
  background: var(--fd-gantt-cell); box-shadow: -3px 0 0 var(--fd-gantt-cell); border-inline-end: 1px solid var(--fd-border);
}
.fd-gantt-corner:dir(rtl), .fd-gantt-name:dir(rtl) { box-shadow: 3px 0 0 var(--fd-gantt-cell); }
.fd-gantt-corner { z-index: 5; padding: 6px 10px; display: flex; align-items: end; font-size: 12px; font-weight: 600; color: var(--fd-muted); }
.fd-gantt-axis { position: relative; flex: none; height: 48px; }
.fd-gantt-tick { position: absolute; box-sizing: border-box; overflow: clip; white-space: nowrap; font-size: 11.5px; color: var(--fd-muted); border-inline-start: 1px solid var(--fd-border); padding-inline: 4px; font-variant-numeric: tabular-nums; }
.fd-gantt-tick[data-row="upper"] { top: 0; height: 22px; line-height: 22px; font-weight: 600; color: var(--fd-text); border-bottom: 1px solid var(--fd-border); }
.fd-gantt-tick[data-row="lower"] { top: 22px; height: 26px; line-height: 26px; }
.fd-gantt-tick[data-sub] { display: grid; align-content: center; justify-items: center; padding: 0; line-height: 12px; }
.fd-gantt-tick-sub { font-size: 10px; }
/* A month's or a year's name kept in sight by the names as the days scroll under it. */
.fd-gantt-tick[data-row="upper"] > span { position: sticky; inset-inline-start: calc(var(--fd-gantt-names) + 4px); }
.fd-gantt-tick[aria-current] { color: var(--fd-error); font-weight: 700; }

/* The rows: a group's heading, then a row for each record — its name kept in sight, its bar on the days. */
.fd-gantt-rows { position: relative; }
/* Each cell its own line under it, so the names, kept over the days, hide what passes under them. */
.fd-gantt-row { display: flex; height: 36px; }
.fd-gantt-row > * { box-sizing: border-box; border-bottom: 1px solid color-mix(in srgb, var(--fd-border) 55%, var(--fd-surface)); }
.fd-gantt-row:hover > .fd-gantt-track, .fd-gantt-row.fd-gantt-hot > .fd-gantt-track { background: color-mix(in srgb, var(--fd-accent) 6%, transparent); }
.fd-gantt-name { z-index: 2; padding-inline: 10px; display: flex; align-items: center; gap: 6px; font-size: 13px; min-width: 0; }
.fd-gantt-name > bdi { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-gantt-name[data-opens] { cursor: pointer; }
.fd-gantt-name[data-opens]:hover > bdi { text-decoration: underline; }
.fd-gantt-name:focus { outline: none; }
.fd-gantt-name:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-gantt-row[data-head] { height: 32px; }
.fd-gantt-row[data-head] { background: color-mix(in srgb, var(--fd-text) 4%, var(--fd-surface)); }
.fd-gantt-row[data-head] > .fd-gantt-name { --fd-gantt-cell: color-mix(in srgb, var(--fd-text) 4%, var(--fd-surface)); }
.fd-gantt-toggle { display: flex; align-items: center; gap: 6px; min-width: 0; min-height: 28px; padding: 0 4px; border: 0; border-radius: var(--fd-control-radius); background: none; color: var(--fd-text); font: inherit; font-weight: 600; cursor: pointer; }
.fd-gantt-toggle:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-gantt-toggle > bdi { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-gantt-toggle svg { flex: none; width: 14px; height: 14px; }
.fd-gantt-toggle[aria-expanded="false"] svg { transform: rotate(-90deg); }
.fd-gantt-toggle[aria-expanded="false"]:dir(rtl) svg { transform: rotate(90deg); }
.fd-gantt-count { flex: none; color: var(--fd-muted); font-weight: 400; font-size: 12px; }
.fd-gantt-track { position: relative; flex: none; }
.fd-gantt-sum { position: absolute; top: 12px; height: 8px; border-radius: 2px; background: color-mix(in srgb, var(--fd-text) 40%, var(--fd-surface)); }
.fd-gantt-unplanned { position: sticky; inset-inline-start: calc(var(--fd-gantt-names) + 8px); align-self: center; font-size: 12px; font-style: italic; color: var(--fd-muted); white-space: nowrap; }
.fd-gantt-track:has(> .fd-gantt-unplanned) { display: flex; }

/* Under the bars: a line for each day, week or month, today's line, and the arrows from what each waits for. */
.fd-gantt-layer { position: absolute; top: 0; inset-inline-start: var(--fd-gantt-names); z-index: 0; pointer-events: none; }
.fd-gantt-line { position: absolute; top: 0; bottom: 0; width: 1px; background: color-mix(in srgb, var(--fd-border) 60%, transparent); }
.fd-gantt-today { position: absolute; top: 0; bottom: 0; width: 2px; margin-inline-start: -1px; background: var(--fd-error); z-index: 1; }
.fd-gantt-links { position: absolute; top: 0; inset-inline-start: 0; overflow: visible; z-index: 2; }
.fd-gantt-links:dir(rtl) { transform: scaleX(-1); }
.fd-gantt-link { fill: none; stroke: color-mix(in srgb, var(--fd-text) 55%, var(--fd-surface)); stroke-width: 1.5; }
.fd-gantt-link[data-late] { stroke: var(--fd-error); stroke-dasharray: 4 3; }
.fd-gantt-head-mark { fill: color-mix(in srgb, var(--fd-text) 55%, var(--fd-surface)); }
.fd-gantt-head-mark[data-late] { fill: var(--fd-error); }

/* A bar: a tint of the surface, edged in its colour; a milestone, a diamond with its words beside it. */
.fd-gantt-task {
  --fd-gantt-c: var(--fd-accent);
  position: absolute; z-index: 1; top: 6px; height: 24px; box-sizing: border-box; min-width: 8px; padding-inline: 6px; border-radius: 5px;
  background: color-mix(in srgb, var(--fd-gantt-c) 22%, var(--fd-surface)); border: 1px solid color-mix(in srgb, var(--fd-gantt-c) 60%, var(--fd-surface)); border-inline-start: 4px solid var(--fd-gantt-c);
  color: var(--fd-text); font-size: 12px; line-height: 22px; white-space: nowrap; overflow: hidden; cursor: default; user-select: none; -webkit-user-select: none; touch-action: pan-y;
}
.fd-gantt-task-text { display: block; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.fd-gantt-task[data-narrow] { padding: 0; }
.fd-gantt-task[data-narrow] > .fd-gantt-task-text { visibility: hidden; }
.fd-gantt-task[data-opens] { cursor: pointer; }
.fd-gantt-task[data-moves] { cursor: grab; }
.fd-gantt-task:hover, .fd-gantt-task.fd-gantt-hot { background: color-mix(in srgb, var(--fd-gantt-c) 34%, var(--fd-surface)); }
.fd-gantt-task:focus { outline: none; }
.fd-gantt-task:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; z-index: 3; }
.fd-gantt-task[data-late] { box-shadow: inset 0 -3px 0 var(--fd-error); }
.fd-gantt-task[data-moving] { z-index: 3; cursor: grabbing; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22); }
.fd-gantt-task[aria-busy="true"] { opacity: 0.75; }
.fd-gantt-task[data-milestone] { width: 20px; min-width: 0; margin-inline-start: -10px; padding: 0; border: 0; background: none; overflow: visible; }
.fd-gantt-task[data-milestone]::before { content: ""; position: absolute; inset: 4px; transform: rotate(45deg); border-radius: 2px; background: var(--fd-gantt-c); }
.fd-gantt-task[data-milestone] .fd-gantt-task-text { position: absolute; inset-inline-start: 24px; overflow: visible; }
.fd-gantt-grip { position: absolute; top: 0; bottom: 0; width: 8px; cursor: ew-resize; touch-action: none; }
.fd-gantt-grip[data-edge="start"] { inset-inline-start: -4px; }
.fd-gantt-grip[data-edge="end"] { inset-inline-end: 0; }
.fd-gantt-task:hover > .fd-gantt-grip[data-edge="end"]::after { content: ""; position: absolute; top: 6px; bottom: 6px; inset-inline-end: 2px; width: 2px; border-radius: 1px; background: var(--fd-gantt-c); }
@container fd-gantt (max-width: 640px) {
  .fd-gantt-body { --fd-gantt-names: 140px; }
  .fd-gantt-title { flex-basis: 100%; order: -1; }
}
@media print {
  /* A list showing its timeline alone prints it in the table's place (the viewer leaves a list's other views off paper). */
  .fd-form .fd-list[data-alone] .fd-list-addon[data-on]:has(.fd-gantt) { display: block !important; }
  .fd-gantt-bar > .fd-button, .fd-gantt-zooms, .fd-gantt-said, .fd-gantt-alert, .fd-gantt-grip { display: none !important; }
  .fd-gantt-body, .fd-gantt-scroll { overflow: visible; max-height: none; }
  .fd-gantt-head, .fd-gantt-corner, .fd-gantt-name { position: static; box-shadow: none; }
  .fd-gantt-row { break-inside: avoid; }
  .fd-gantt, .fd-gantt * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

/** The timeline's stylesheet, once per document, before the page's own so an app's rule wins. */
export function installGanttStyles(doc: Document) {
  if (doc.getElementById('fieldia-gantt-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fieldia-gantt-styles';
  style.textContent = GANTT_CSS;
  doc.head.prepend(style);
}
