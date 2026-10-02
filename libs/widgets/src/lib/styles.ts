/**
 * Fieldia's stylesheet: two skins and the layout chrome, all scoped to the
 * form's own root (`.fd-form[data-fd-skin=…]`), so two forms on one page can
 * wear different skins and the host page's own controls are never touched.
 *
 * underline — the Flectra and Odoo style: flat inputs on a single line, labels
 *             beside the field, navy accents.
 * outlined  — the Ant Design style: boxed inputs with rounded corners, labels
 *             above the field, a blue focus glow.
 *
 * Written with logical properties (inline/block, start/end), so a right-to-left
 * form mirrors without a second stylesheet.
 */
export const FIELDIA_CSS = /* css */ `
.fd-form {
  --fd-font: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", sans-serif;
  --fd-text: #212529;
  --fd-muted: #6b7280;
  --fd-page: #f2f3f5;
  --fd-surface: #ffffff;
  --fd-border: #cfd4da;
  --fd-border-strong: #9aa3ad;
  --fd-accent: #002855;
  --fd-accent-text: #ffffff;
  --fd-accent-soft: #e6ebf2;
  --fd-focus: #002855;
  --fd-focus-ring: none;
  --fd-error: #c62828;
  --fd-error-soft: #fdecea;
  --fd-success: #2e7d32;
  --fd-success-soft: #e8f5e9;
  --fd-warning: #8a5300;
  --fd-warning-soft: #fff4e0;
  --fd-info: #0b5cad;
  --fd-info-soft: #e7f0fb;
  --fd-radius: 0px;
  --fd-control-radius: 0px;
  --fd-pad-y: 3px;
  --fd-pad-x: 4px;
  --fd-input-border: 0 0 1px 0;
  --fd-label-weight: 600;
  --fd-gap-x: 32px;
  --fd-gap-y: 14px;
  container-type: inline-size;
  font-family: var(--fd-font);
  font-size: 14px;
  line-height: 1.45;
  color: var(--fd-text);
  -webkit-text-size-adjust: 100%;
}
.fd-form[data-fd-skin="outlined"] {
  --fd-text: rgba(0, 0, 0, 0.88);
  --fd-muted: rgba(0, 0, 0, 0.55);
  --fd-page: #f5f5f5;
  --fd-border: #d9d9d9;
  --fd-border-strong: #bfbfbf;
  --fd-accent: #1677ff;
  --fd-accent-soft: #e6f4ff;
  --fd-focus: #1677ff;
  --fd-focus-ring: 0 0 0 2px rgba(5, 145, 255, 0.12);
  --fd-error: #ff4d4f;
  --fd-error-soft: #fff2f0;
  --fd-radius: 8px;
  --fd-control-radius: 6px;
  --fd-pad-y: 4px;
  --fd-pad-x: 11px;
  --fd-input-border: 1px;
  --fd-label-weight: 400;
  --fd-gap-x: 24px;
  --fd-gap-y: 18px;
}
.fd-form *, .fd-form *::before, .fd-form *::after { box-sizing: border-box; }
.fd-form [hidden] { display: none !important; }

/* ---- page frame ---------------------------------------------------------- */
.fd-page-head { display: grid; gap: 4px; margin-block-end: 20px; }
.fd-page-title { font-size: 22px; font-weight: 650; margin: 0; line-height: 1.25; }
.fd-page-description { color: var(--fd-muted); margin: 0; }

/* ---- fields ---------------------------------------------------------------- */
.fd-grid {
  display: grid;
  grid-template-columns: repeat(var(--fd-columns, 1), minmax(0, 1fr));
  gap: var(--fd-gap-y) var(--fd-gap-x);
  align-items: start;
}
.fd-field { display: grid; gap: 4px; min-width: 0; grid-column: span min(var(--fd-span, 1), var(--fd-columns, 1)); }
.fd-label { font-weight: var(--fd-label-weight); color: var(--fd-text); }
.fd-field.fd-required > .fd-label::after { content: " *"; color: var(--fd-error); }
.fd-form[data-fd-skin="outlined"] .fd-field.fd-required > .fd-label::after { content: ""; }
.fd-form[data-fd-skin="outlined"] .fd-field.fd-required > .fd-label::before { content: "* "; color: var(--fd-error); }
.fd-help { color: var(--fd-muted); font-size: 12.5px; }
.fd-error { color: var(--fd-error); font-size: 12.5px; }
.fd-warning {
  color: var(--fd-warning); background: var(--fd-warning-soft); font-size: 12.5px;
  padding: 3px 8px; border-radius: var(--fd-control-radius); justify-self: start;
}

/* underline: label beside the value, the way a Flectra sheet reads */
.fd-form[data-fd-skin="underline"] .fd-field {
  /* One label width for every field, so a field spanning two columns lines up with its neighbours. */
  grid-template-columns: var(--fd-label-width, 11em) minmax(0, 1fr);
  column-gap: 12px;
  align-items: baseline;
}
.fd-form[data-fd-skin="underline"] .fd-field > .fd-label { grid-column: 1; }
/* A table of lines needs the full width: its label sits above it. */
.fd-form[data-fd-skin="underline"] .fd-field[data-type="one2many"] { grid-template-columns: minmax(0, 1fr); }
.fd-form[data-fd-skin="underline"] .fd-field[data-type="one2many"] > * { grid-column: 1 !important; }
.fd-form[data-fd-skin="underline"] .fd-field > :not(.fd-label) { grid-column: 2; }
/* A label beside every value needs room twice over: the underline skin stacks its columns sooner. */
@container (max-width: 760px) {
  .fd-form[data-fd-skin="underline"] .fd-grid { grid-template-columns: minmax(0, 1fr); }
  .fd-form[data-fd-skin="underline"] .fd-field { grid-column: auto; }
}
@container (max-width: 520px) {
  .fd-grid { grid-template-columns: minmax(0, 1fr); }
  .fd-field { grid-column: auto; }
  .fd-form[data-fd-skin="underline"] .fd-field { grid-template-columns: minmax(0, 1fr); }
  .fd-form[data-fd-skin="underline"] .fd-field > * { grid-column: 1 !important; }
}

/* ---- inputs ---------------------------------------------------------------- */
.fd-input {
  width: 100%;
  min-width: 0;
  font: inherit;
  color: inherit;
  background: var(--fd-surface);
  border: solid var(--fd-border);
  border-width: var(--fd-input-border);
  border-radius: var(--fd-control-radius);
  padding: var(--fd-pad-y) var(--fd-pad-x);
  min-height: 30px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.fd-input::placeholder { color: var(--fd-muted); opacity: 0.8; }
.fd-input:hover { border-color: var(--fd-border-strong); }
.fd-input:focus { outline: none; border-color: var(--fd-focus); box-shadow: var(--fd-focus-ring); }
.fd-form[data-fd-skin="underline"] .fd-input { background: transparent; }
.fd-form[data-fd-skin="underline"] .fd-input:focus { box-shadow: 0 1px 0 0 var(--fd-focus); }
.fd-form[data-fd-skin="underline"] .fd-field.fd-required .fd-input { border-color: var(--fd-accent); }
.fd-input[readonly] { background: transparent; border-color: transparent; padding-inline: 0; }
.fd-form[data-fd-skin="outlined"] .fd-input[readonly] { background: rgba(0, 0, 0, 0.04); border-color: var(--fd-border); padding-inline: var(--fd-pad-x); color: var(--fd-muted); }
.fd-input[aria-invalid="true"] { border-color: var(--fd-error); }
.fd-form[data-fd-skin="outlined"] .fd-input[aria-invalid="true"]:focus { box-shadow: 0 0 0 2px rgba(255, 38, 5, 0.06); }
.fd-textarea { resize: vertical; min-height: 64px; }
.fd-select { appearance: auto; }
.fd-number { display: flex; align-items: baseline; gap: 6px; }
.fd-number-input { font-variant-numeric: tabular-nums; }
.fd-currency { color: var(--fd-muted); font-size: 12.5px; font-weight: 600; }
/* With the currency after it, the amount ends right beside it. */
.fd-currency-after > .fd-number-input { text-align: end; }
/* A picked currency is a small box of its own beside the amount. */
.fd-currency-picked { align-items: center; }
.fd-currency-picked > :not(.fd-number-input) { flex: 0 0 104px; min-width: 0; }
.fd-currency-picked > .fd-number-input { flex: 1 1 auto; min-width: 0; }
.fd-pending { color: var(--fd-muted); font-style: italic; }
.fd-pending:empty::before { content: "—"; }

.fd-checkbox, .fd-choice input { width: 16px; height: 16px; accent-color: var(--fd-accent); margin: 0; }
.fd-switch {
  appearance: none; width: 34px; height: 20px; margin: 0; border-radius: 999px; position: relative;
  background: var(--fd-border-strong); cursor: pointer; transition: background 0.2s ease;
}
.fd-switch::after {
  content: ""; position: absolute; inset-block-start: 2px; inset-inline-start: 2px; width: 16px; height: 16px;
  border-radius: 50%; background: #fff; transition: transform 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.25);
}
.fd-switch:checked { background: var(--fd-accent); }
.fd-switch:checked::after { transform: translateX(14px); }
[dir="rtl"] .fd-switch:checked::after { transform: translateX(-14px); }
.fd-choices { display: flex; flex-wrap: wrap; gap: 6px 18px; }
.fd-choice { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
.fd-points { display: flex; flex-wrap: wrap; gap: 6px; }
.fd-points button {
  font: inherit; cursor: pointer; border: 1px solid var(--fd-border); background: var(--fd-surface);
  color: var(--fd-text); border-radius: var(--fd-control-radius); min-width: 34px; height: 34px; padding: 0 8px;
}
.fd-points button.fd-on { background: var(--fd-accent); color: var(--fd-accent-text); border-color: var(--fd-accent); }
.fd-rating button { border: none; background: none; font-size: 24px; color: var(--fd-border-strong); padding: 0 2px; min-width: 0; }
.fd-rating button.fd-on { background: none; color: #f5a623; }
.fd-points button:disabled, .fd-choice input:disabled { cursor: default; }
.fd-form :focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-form .fd-input:focus-visible { outline: none; }

/* ---- pickers: many2one, many2many, reference ------------------------------ */
.fd-combo { position: relative; display: flex; align-items: center; min-width: 0; }
.fd-combo-input { padding-inline-end: 28px; }
.fd-combo-clear {
  position: absolute; inset-inline-end: 4px; border: none; background: none; cursor: pointer; color: var(--fd-muted);
  font-size: 16px; line-height: 1; padding: 2px 6px; border-radius: 4px;
}
.fd-combo-clear:hover { color: var(--fd-text); background: var(--fd-page); }
.fd-listbox {
  position: absolute; inset-inline: 0; inset-block-start: calc(100% + 2px); z-index: 20; margin: 0; padding: 4px 0;
  list-style: none; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 4px);
  box-shadow: 0 8px 24px rgba(15, 20, 25, 0.12); max-height: 240px; overflow-y: auto;
}
.fd-option { padding: 6px 12px; cursor: pointer; }
.fd-option:hover, .fd-option.fd-active { background: var(--fd-accent-soft); }
.fd-empty { padding: 6px 12px; color: var(--fd-muted); font-style: italic; }
.fd-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-width: 0; }
.fd-chips { display: contents; list-style: none; margin: 0; padding: 0; }
.fd-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 1px 4px 1px 10px; border-radius: 999px;
  background: var(--fd-accent-soft); color: var(--fd-text); font-size: 13px; line-height: 22px;
}
.fd-chip-remove { border: none; background: none; cursor: pointer; color: var(--fd-muted); font-size: 15px; line-height: 1; padding: 0 4px; border-radius: 999px; }
.fd-chip-remove:hover { color: var(--fd-error); }
.fd-tags .fd-combo { flex: 1 1 140px; }
.fd-reference { display: grid; grid-template-columns: minmax(7em, 34%) minmax(0, 1fr); gap: 8px; }

/* ---- one2many lines ------------------------------------------------------- */
.fd-lines { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; min-width: 0; }
/* The table scrolls sideways inside its own box; the grid around it must not grow to the table's width. */
/* position: relative keeps the cells' hidden labels inside the scroll box; without it they widen the page. */
.fd-lines-scroll { overflow-x: auto; min-width: 0; position: relative; }
.fd-lines-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.fd-lines-table th { text-align: start; font-weight: 600; color: var(--fd-muted); font-size: 12.5px; padding: 6px 8px; border-block-end: 1px solid var(--fd-border); white-space: nowrap; }
.fd-lines-table td { padding: 4px 8px; border-block-end: 1px solid var(--fd-border); vertical-align: top; min-width: 7em; }
.fd-lines-table td.fd-lines-tools, .fd-lines-table th.fd-lines-tools { width: 32px; min-width: 32px; padding-inline: 0; text-align: center; }
.fd-lines-table .fd-input { min-height: 28px; }
/* A yes/no cell sits level with the inputs beside it. */
.fd-lines-table td > .fd-checkbox, .fd-lines-table td > .fd-switch { margin-block-start: 6px; }
.fd-line-delete { border: none; background: none; cursor: pointer; color: var(--fd-muted); font-size: 16px; line-height: 1; padding: 4px 6px; border-radius: 4px; }
.fd-line-delete:hover { color: var(--fd-error); background: var(--fd-error-soft); }
.fd-lines-totals td { padding: 8px; font-weight: 600; border-block-start: 1px solid var(--fd-border); font-variant-numeric: tabular-nums; }
.fd-lines-adds { display: flex; flex-wrap: wrap; gap: 4px 16px; justify-self: start; }
/* A section heads the lines below it; a note reads as a remark between them. */
.fd-line-section td { background: var(--fd-page); }
.fd-line-section .fd-input { font-weight: 600; }
.fd-line-note .fd-input { font-style: italic; }
.fd-cell-error { color: var(--fd-error); font-size: 12px; }
.fd-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* ---- files, images, rich text, json ------------------------------------ */
.fd-file { display: grid; gap: 8px; justify-items: start; padding: 6px 0; border-radius: var(--fd-control-radius); }
.fd-file.fd-dragging { outline: 2px dashed var(--fd-accent); outline-offset: 4px; }
.fd-file-pick { display: inline-flex; flex-wrap: wrap; gap: 8px; align-items: center; cursor: pointer; }
.fd-file-chosen { display: inline-flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; }
.fd-file-name { font-variant-numeric: tabular-nums; }
.fd-image-pick {
  width: 120px; height: 120px; border: 1px dashed var(--fd-border-strong); border-radius: var(--fd-control-radius);
  display: grid; place-content: center; justify-items: center; text-align: center; padding: 8px; background: var(--fd-page);
}
.fd-image-pick .fd-button { border: none; background: none; color: var(--fd-accent); padding: 0; min-height: 0; }
.fd-image-pick:hover { border-color: var(--fd-accent); }
.fd-avatar .fd-image-pick { width: 88px; height: 88px; }
.fd-image-preview { max-width: 160px; max-height: 160px; border-radius: var(--fd-control-radius); border: 1px solid var(--fd-border); object-fit: cover; background: var(--fd-page); }
.fd-richtext { min-height: 96px; line-height: 1.5; overflow-wrap: anywhere; }
.fd-richtext[contenteditable="false"] { background: transparent; border-color: transparent; padding-inline: 0; min-height: 0; }
.fd-richtext p { margin: 0 0 6px; }
.fd-code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; min-height: 96px; }

/* ---- sections, tabs ---------------------------------------------------- */
.fd-sections { display: grid; gap: 24px; }
.fd-section { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: 14px; }
.fd-section-title { font-size: 15px; font-weight: 650; padding: 0; margin: 0; float: inline-start; width: 100%; }
.fd-section-title + * { clear: both; }
.fd-form[data-fd-skin="underline"] .fd-section-title {
  text-transform: uppercase; letter-spacing: 0.05em; font-size: 12.5px; color: var(--fd-muted);
  border-block-end: 1px solid var(--fd-border); padding-block-end: 6px; width: 100%;
}
.fd-section-description { color: var(--fd-muted); margin: 0; }
.fd-section-toggle {
  font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px; text-align: start;
}
.fd-section-toggle:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; border-radius: 2px; }
.fd-section-chevron {
  width: 0.5em; height: 0.5em; border: solid currentColor; border-width: 0 2px 2px 0;
  transform: rotate(45deg); margin-block-start: -0.2em; transition: transform 0.15s ease; flex: none;
}
.fd-section-folded .fd-section-chevron { transform: rotate(-45deg); margin-block-start: 0; }
[dir="rtl"] .fd-section-folded .fd-section-chevron { transform: rotate(135deg); }
.fd-form[data-fd-skin="outlined"] .fd-sections > .fd-section {
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 20px 24px;
}
.fd-tablist { display: flex; gap: 2px; border-block-end: 1px solid var(--fd-border); overflow-x: auto; }
.fd-tab {
  font: inherit; background: none; border: none; cursor: pointer; padding: 8px 14px; color: var(--fd-muted);
  border-block-end: 2px solid transparent; margin-block-end: -1px; white-space: nowrap;
}
.fd-tab[aria-selected="true"] { color: var(--fd-accent); border-block-end-color: var(--fd-accent); font-weight: 600; }
.fd-tabpanel { padding-block: 16px; display: grid; gap: 16px; }

/* ---- buttons ---------------------------------------------------------- */
.fd-button {
  font: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; justify-content: center;
  min-height: 32px; padding: 4px 14px; border-radius: var(--fd-control-radius);
  border: 1px solid var(--fd-border); background: var(--fd-surface); color: var(--fd-text);
}
.fd-button:hover { border-color: var(--fd-accent); color: var(--fd-accent); }
.fd-button-primary { background: var(--fd-accent); border-color: var(--fd-accent); color: var(--fd-accent-text); }
.fd-button-primary:hover { color: var(--fd-accent-text); filter: brightness(1.12); }
.fd-button-danger { color: var(--fd-error); border-color: var(--fd-error); }
.fd-button-danger:hover { background: var(--fd-error); color: #fff; }
.fd-button-link { border-color: transparent; background: none; color: var(--fd-accent); padding-inline: 4px; }
.fd-form[data-fd-skin="underline"] .fd-button { border-radius: 3px; }
.fd-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.fd-actions-end { justify-content: flex-end; margin-block-start: 24px; }

/* ---- record sheet --------------------------------------------------------- */
.fd-sheet-page { background: var(--fd-page); padding: 0 0 32px; min-width: 0; }
.fd-header {
  display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: space-between;
  background: var(--fd-surface); border-block-end: 1px solid var(--fd-border); padding: 8px 16px;
}
.fd-statusbar { display: flex; list-style: none; margin: 0; padding: 0; overflow-x: auto; }
.fd-statusbar li { display: flex; }
.fd-statusbar button, .fd-statusbar span {
  font: inherit; font-size: 13px; border: none; background: var(--fd-page); color: var(--fd-muted);
  padding: 5px 18px 5px 22px; margin-inline-start: -6px; white-space: nowrap;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
}
.fd-statusbar li:first-child button, .fd-statusbar li:first-child span { margin-inline-start: 0; padding-inline-start: 14px;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%); }
.fd-statusbar button { cursor: pointer; }
.fd-statusbar [aria-current="step"] { background: var(--fd-accent); color: var(--fd-accent-text); font-weight: 600; }
[dir="rtl"] .fd-statusbar button, [dir="rtl"] .fd-statusbar span { transform: scaleX(-1); }
[dir="rtl"] .fd-statusbar button > *, [dir="rtl"] .fd-statusbar span > * { display: inline-block; transform: scaleX(-1); }
.fd-sheet-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; max-width: 1180px; margin: 16px auto 0; padding-inline: 16px; }
.fd-sheet-layout.fd-has-side { grid-template-columns: minmax(0, 1fr) minmax(220px, 300px); }
@container (max-width: 860px) { .fd-sheet-layout.fd-has-side { grid-template-columns: minmax(0, 1fr); } }
.fd-card {
  position: relative; background: var(--fd-surface); border: 1px solid var(--fd-border);
  border-radius: var(--fd-radius); padding: 24px 28px 28px; display: grid; gap: 18px; min-width: 0;
}
.fd-ribbon-frame { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none; }
.fd-ribbon {
  position: absolute; inset-block-start: 18px; inset-inline-end: -42px; transform: rotate(45deg); width: 160px;
  text-align: center; font-size: 12px; font-weight: 700; padding: 4px 0; color: #fff; background: var(--fd-muted);
  text-transform: uppercase; letter-spacing: 0.06em; pointer-events: none;
}
[dir="rtl"] .fd-ribbon { transform: rotate(-45deg); }
.fd-ribbon.fd-tone-danger { background: var(--fd-error); }
.fd-ribbon.fd-tone-success { background: var(--fd-success); }
.fd-ribbon.fd-tone-warning { background: #d97706; }
.fd-ribbon.fd-tone-info { background: var(--fd-info); }
.fd-alert { padding: 10px 14px; border-radius: var(--fd-control-radius); border: 1px solid; font-size: 13.5px; }
.fd-alert.fd-tone-warning { background: var(--fd-warning-soft); border-color: #f0c47a; color: var(--fd-warning); }
.fd-alert.fd-tone-danger { background: var(--fd-error-soft); border-color: #f1a7a7; color: var(--fd-error); }
.fd-alert.fd-tone-success { background: var(--fd-success-soft); border-color: #a7d7ab; color: var(--fd-success); }
.fd-alert.fd-tone-info, .fd-alert:not([class*="fd-tone-"]) { background: var(--fd-info-soft); border-color: #a9c8ef; color: var(--fd-info); }
.fd-stats { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0; margin: -24px -28px 0; border-block-end: 1px solid var(--fd-border); }
.fd-stats:empty { display: none; }
/* A visible ribbon owns the corner: stat buttons keep clear of it. */
.fd-card:has(> .fd-ribbon-frame > .fd-ribbon:not([hidden])) .fd-stats { padding-inline-end: 104px; }
.fd-stat {
  font: inherit; background: none; border: none; border-inline-start: 1px solid var(--fd-border); cursor: pointer;
  padding: 8px 18px; display: grid; justify-items: start; line-height: 1.2; color: var(--fd-text); min-width: 120px;
}
.fd-stat:hover { background: var(--fd-page); }
.fd-stat-value { font-weight: 700; font-size: 15px; color: var(--fd-accent); font-variant-numeric: tabular-nums; }
.fd-stat-label { font-size: 12.5px; color: var(--fd-muted); }
.fd-title-row { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; }
.fd-title { display: grid; gap: 4px; flex: 1 1 auto; min-width: 0; }
.fd-avatar { flex: none; }
.fd-avatar > .fd-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.fd-form[data-fd-skin="underline"] .fd-avatar { grid-template-columns: minmax(0, 1fr); }
.fd-form[data-fd-skin="underline"] .fd-avatar > * { grid-column: 1 !important; }
.fd-avatar .fd-image-pick {
  width: 120px; height: 120px; border: 1px dashed var(--fd-border-strong); border-radius: var(--fd-control-radius);
  display: grid; place-content: center; justify-items: center; text-align: center; padding: 8px; background: var(--fd-page);
}
.fd-image-pick .fd-button { border: none; background: none; color: var(--fd-accent); padding: 0; min-height: 0; }
.fd-image-pick:hover { border-color: var(--fd-accent); }
.fd-avatar .fd-image-pick { width: 88px; height: 88px; }
.fd-image-preview { width: 88px; height: 88px; }
.fd-avatar .fd-file-pick .fd-help { display: none; }
.fd-avatar .fd-file-name { display: none; }
.fd-avatar .fd-file { justify-items: center; gap: 2px; padding: 0; }
.fd-avatar .fd-file-chosen { gap: 2px 8px; justify-content: center; font-size: 12.5px; }
.fd-title .fd-input { font-size: 24px; font-weight: 600; min-height: 40px; }
.fd-form[data-fd-skin="underline"] .fd-title .fd-field { grid-template-columns: minmax(0, 1fr); }
.fd-form[data-fd-skin="underline"] .fd-title .fd-field > * { grid-column: 1; }
.fd-title .fd-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.fd-side { display: grid; gap: 12px; align-content: start; min-width: 0; }

/* ---- wizard -------------------------------------------------------------- */
.fd-wizard { display: grid; gap: 20px; }
.fd-progress { display: grid; gap: 8px; }
.fd-progress-text { color: var(--fd-muted); font-size: 13px; }
.fd-value-text { display: block; padding-block: 6px; font-variant-numeric: tabular-nums; }
.fd-date-pick { position: relative; display: flex; align-items: center; gap: 6px; min-width: 0; }
.fd-date-pick > .fd-input { flex: 1 1 auto; min-width: 0; }
.fd-calendar-button {
  flex: 0 0 auto; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; cursor: pointer;
  border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); background: var(--fd-surface); color: var(--fd-muted);
}
.fd-calendar-button:hover, .fd-calendar-button[aria-expanded="true"] { color: var(--fd-text); background: var(--fd-page); }
.fd-calendar-button svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; }
.fd-calendar {
  position: absolute; inset-block-start: calc(100% + 4px); inset-inline-end: 0; z-index: 30; padding: 8px;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 6px);
  box-shadow: 0 8px 24px rgba(15, 20, 25, 0.14);
}
.fd-calendar-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 2px 4px 6px; }
.fd-calendar-head button { border: none; background: none; cursor: pointer; font-size: 18px; line-height: 1; padding: 4px 8px; border-radius: 4px; color: var(--fd-text); }
.fd-calendar-head button:hover { background: var(--fd-page); }
.fd-calendar-title { font-weight: 600; }
.fd-calendar-grid { border-collapse: collapse; font-variant-numeric: tabular-nums; }
.fd-calendar-grid th { font-size: 11.5px; font-weight: 600; color: var(--fd-muted); padding: 4px 0; width: 34px; text-align: center; }
.fd-calendar-grid .fd-week { color: var(--fd-accent); font-weight: 600; border-inline-end: 1px solid var(--fd-border); }
.fd-calendar-grid td { padding: 1px; }
.fd-calendar-grid td button {
  width: 32px; height: 30px; border: none; border-radius: 4px; background: none; cursor: pointer; color: var(--fd-text); font: inherit; font-size: 13px;
}
.fd-calendar-grid td button:hover { background: var(--fd-accent-soft); }
.fd-calendar-grid td button.fd-outside { color: var(--fd-muted); opacity: 0.6; }
.fd-calendar-grid td button[aria-current="date"] { box-shadow: inset 0 0 0 1px var(--fd-accent); }
.fd-calendar-grid td button[aria-selected="true"] { background: var(--fd-accent); color: var(--fd-accent-text); font-weight: 600; }
.fd-calendar-grid td button:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-progressbar {
  position: relative; height: 22px; min-width: 120px; border-radius: 999px; overflow: hidden;
  background: var(--fd-page); border: 1px solid var(--fd-border); font-variant-numeric: tabular-nums;
}
.fd-progressbar-fill { height: 100%; background: var(--fd-success); transition: width 0.2s ease; }
.fd-progressbar[data-tone="warning"] .fd-progressbar-fill { background: #d97706; }
.fd-progressbar[data-tone="danger"] .fd-progressbar-fill { background: var(--fd-error); }
.fd-progressbar[data-tone="info"] .fd-progressbar-fill { background: var(--fd-info); }
.fd-progressbar-text { position: absolute; inset: 0; display: grid; place-items: center; font-size: 12px; font-weight: 600; color: var(--fd-text); }
.fd-progressbar-edit { display: flex; align-items: center; gap: 12px; min-width: 0; }
.fd-progressbar-edit > .fd-progressbar { flex: 1 1 auto; }
.fd-progressbar-edit > .fd-input { flex: 0 0 96px; }
.fd-progress-bar { height: 4px; background: var(--fd-border); border-radius: 999px; overflow: hidden; }
.fd-progress-bar > span { display: block; height: 100%; background: var(--fd-accent); transition: width 0.25s ease; }
.fd-step { display: grid; gap: 18px; }
.fd-step-title { font-size: 18px; font-weight: 650; margin: 0; }
.fd-wizard-nav { display: flex; gap: 8px; justify-content: space-between; }
.fd-wizard-nav .fd-spacer { flex: 1; }

/* ---- text, status, dialog ------------------------------------------------- */
.fd-text-heading { font-size: 16px; font-weight: 650; margin: 0; }
.fd-text-paragraph { margin: 0; }
.fd-text-note { margin: 0; color: var(--fd-muted); font-size: 13px; }
.fd-status { min-height: 1.4em; color: var(--fd-muted); font-size: 13px; }
.fd-status.fd-status-error { color: var(--fd-error); }
.fd-status.fd-status-saved { color: var(--fd-success); }
.fd-draft { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 10px 14px; margin-block-end: 16px;
  background: var(--fd-info-soft); border: 1px solid #a9c8ef; border-radius: var(--fd-control-radius); }
.fd-done { padding: 40px 0; text-align: center; display: grid; gap: 12px; justify-items: center; }
.fd-done-title { font-size: 20px; font-weight: 650; margin: 0; }
.fd-dialog-backdrop { position: fixed; inset: 0; background: rgba(15, 20, 25, 0.45); display: grid; place-items: center; z-index: 1000; padding: 16px; }
.fd-dialog {
  background: var(--fd-surface); color: var(--fd-text); border-radius: max(var(--fd-radius), 6px); max-width: 420px; width: 100%;
  padding: 20px 22px; display: grid; gap: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); font-family: var(--fd-font);
}
.fd-dialog p { margin: 0; }
@media (prefers-reduced-motion: reduce) { .fd-form *, .fd-form *::before, .fd-form *::after { transition: none !important; } }
`;

const STYLE_ID = 'fieldia-styles';

/** Add Fieldia's stylesheet to a document, once. */
export function installStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = FIELDIA_CSS;
  (document.head ?? document.documentElement).append(style);
}
