/**
 * The JSON view's look, and Try it's drawer of data and problems: the box the
 * page is typed in, its line numbers and marked lines, the problems under it.
 */
export const DESIGNER_JSON_CSS = /* css */ `
.fd-json { display: grid; gap: 12px; min-width: 0; }
.fd-json[hidden] { display: none; }
.fd-json-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 10px 14px; }
.fd-json-title { display: grid; gap: 2px; flex: 1 1 260px; min-width: 0; }
.fd-json-heading { margin: 0; font-size: 15px; font-weight: 650; line-height: 1.35; }
.fd-json-state { margin: 0; font-size: 13px; line-height: 1.4; color: var(--fd-muted); }
.fd-json-actions { display: flex; flex-wrap: wrap; gap: 8px; }
/* Leaving with changes not applied: asked here, never in a browser dialog. */
.fd-json-leave { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 10px 14px; border-radius: var(--fd-radius); background: var(--fd-warning-soft); color: var(--fd-text); }
.fd-json-leave[hidden] { display: none; }
.fd-json-leave-text { margin: 0; flex: 1 1 240px; font-weight: 600; }
/* The box: numbers and text in one scroll of their own; long lines scroll inside the text. Its line is 20px and its top 12px, as json-code.ts counts. */
.fd-json-code {
  position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start;
  max-height: min(56vh, 640px); overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius);
  font: 13px/20px ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
.fd-json-code:focus-within { border-color: var(--fd-accent); }
.fd-json-gutter {
  margin: 0; padding: 12px 10px 24px 12px; min-width: 3ch; box-sizing: border-box; min-height: 100%;
  font: inherit; text-align: end; color: var(--fd-muted); background: var(--fd-page); border-inline-end: 1px solid var(--fd-border);
  user-select: none; -webkit-user-select: none;
}
.fd-json-input {
  display: block; box-sizing: border-box; width: 100%; min-width: 0; margin: 0; padding: 12px 14px 24px; border: 0; border-radius: 0;
  font: inherit; color: var(--fd-text); background: transparent; resize: none; outline: none; box-shadow: none;
  white-space: pre; overflow-x: auto; overflow-y: hidden; tab-size: 2; caret-color: var(--fd-accent);
  height: calc(var(--fd-json-lines, 1) * 20px + 36px);
}
.fd-designer .fd-json-input:focus, .fd-designer .fd-json-input:focus-visible { outline: none; box-shadow: none; }
.fd-json-marks { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.fd-json-mark { position: absolute; inset-inline: 0; height: 20px; background: color-mix(in srgb, var(--fd-error) 12%, transparent); border-inline-start: 3px solid var(--fd-error); }
.fd-json-mark[data-severity="should"] { background: color-mix(in srgb, var(--fd-warning) 12%, transparent); border-inline-start-color: var(--fd-warning); }
.fd-json-hint { margin: 0; font-size: 12.5px; color: var(--fd-muted); }
.fd-json-problems { list-style: none; margin: 0; padding: 0; display: grid; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); }
.fd-json-problems:empty { display: none; }
.fd-json-problem { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 8px 12px; font-size: 13.5px; line-height: 1.45; }
.fd-json-problem + .fd-json-problem { border-block-start: 1px solid var(--fd-border); }
.fd-json-at {
  all: unset; box-sizing: border-box; cursor: pointer; white-space: nowrap; padding: 1px 7px; border-radius: 5px;
  font: 12.5px/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: var(--fd-accent); background: var(--fd-accent-soft);
}
.fd-json-at:hover { text-decoration: underline; }
.fd-json-at:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-json-severity { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; border-radius: 4px; padding: 1px 6px; color: var(--fd-error); background: var(--fd-error-soft); }
.fd-json-problem[data-severity="should"] .fd-json-severity { color: var(--fd-warning); background: var(--fd-warning-soft); }
.fd-json-message { flex: 1 1 240px; min-width: 0; overflow-wrap: anywhere; }
.fd-json-fix { min-height: 28px; padding: 2px 6px; font-size: 13px; font-weight: 600; }
/* Try it's drawer: the answers as JSON and the problems they have, kept in sight as the page is filled. */
.fd-try-drawer {
  position: sticky; bottom: 8px; z-index: 5; display: grid; margin-inline: auto; width: 100%; max-width: 1100px; box-sizing: border-box;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); box-shadow: 0 -6px 18px rgba(15, 20, 25, 0.08);
}
.fd-try-drawer-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 12px; padding: 2px 10px; }
.fd-try-drawer-bar:has(+ .fd-try-panels:not([hidden])) { border-block-end: 1px solid var(--fd-border); }
.fd-try-tabs { display: flex; gap: 2px; margin-inline-end: auto; }
.fd-try-tab {
  all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 9px 10px 7px;
  font-size: 13.5px; font-weight: 600; color: var(--fd-muted); border-block-end: 2px solid transparent;
}
.fd-try-tab[aria-selected="true"] { color: var(--fd-text); border-block-end-color: var(--fd-accent); }
.fd-try-tab:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; border-radius: 4px; }
.fd-try-count { min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px; display: inline-grid; place-items: center; font-size: 11.5px; font-weight: 700; font-variant-numeric: tabular-nums; background: var(--fd-error-soft); color: var(--fd-error); }
.fd-try-count[hidden] { display: none; }
.fd-try-said { font-size: 12.5px; color: var(--fd-muted); }
.fd-try-said:empty { display: none; }
.fd-try-copy, .fd-try-fold { min-height: 30px; padding: 2px 6px; font-size: 13px; font-weight: 600; }
.fd-try-panels { max-height: min(260px, 38vh); overflow: auto; overscroll-behavior: contain; }
.fd-try-panels[hidden] { display: none; }
.fd-try-panel { padding: 10px 14px; }
.fd-try-panel[hidden] { display: none; }
.fd-try-data { margin: 0; font: 12.5px/1.55 ui-monospace, "SF Mono", Menlo, Consolas, monospace; white-space: pre; overflow-x: auto; color: var(--fd-text); }
.fd-try-data:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; border-radius: 2px; }
.fd-try-problems { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.fd-try-problems:empty { display: none; }
.fd-try-problem { all: unset; box-sizing: border-box; cursor: pointer; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; width: 100%; padding: 6px 8px; border-radius: 6px; font-size: 13.5px; line-height: 1.45; }
.fd-try-problem:hover { background: var(--fd-page); }
.fd-try-problem:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-try-problem strong { font-weight: 600; }
.fd-try-problem span { color: var(--fd-error); }
.fd-try-problem[data-warning] span { color: var(--fd-warning); }
.fd-try-none { margin: 0; color: var(--fd-muted); font-size: 13.5px; }
.fd-try-none[hidden] { display: none; }
/* A choice's options written here, or taken from one of the app's lists: which list, and what it changes with. */
.fd-q-source { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; margin-block-end: 8px; }
.fd-q-source[hidden] { display: none; }
.fd-q-source-words { flex-basis: 100%; font-size: 13px; font-weight: 600; }
.fd-q-source-pick { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; cursor: pointer; }
.fd-q-list { display: grid; gap: 10px; }
.fd-q-list[hidden] { display: none; }
.fd-q-list-name { display: grid; gap: 4px; font-size: 13px; font-weight: 600; }
.fd-q-list-name > [hidden] { display: none; }
.fd-q-depends { display: grid; gap: 4px; min-width: 0; margin: 0; padding: 0; border: 0; }
.fd-q-depends > legend { padding: 0; margin-block-end: 4px; font-size: 13px; font-weight: 600; }
.fd-q-depends-boxes { display: flex; flex-wrap: wrap; gap: 4px 14px; max-height: 120px; overflow: auto; }
.fd-q-depends-pick { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; cursor: pointer; }
.fd-q-list-note { margin: 0; font-size: 12.5px; color: var(--fd-muted); }
.fd-q-list-note[hidden] { display: none; }
`;
