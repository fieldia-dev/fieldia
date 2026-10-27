import { installPartStyles, PART_RANK } from './styles';

/**
 * File and picture fields (files.ts), files on their way to the app's store
 * (files-going.ts) and a signature's pad (signature.ts): the files part's
 * sheet, put in its place among Fieldia's — before the pickers', as the
 * file fields' rules stood in it — the first time a page draws one, or a file
 * on its way (installPartStyles, PART_RANK.files).
 *
 * Files show as a list, as thumbnails or as cards; one opens in a dialog. A
 * file on its way is an item as a stored file's, its picture paler, with a bar
 * inside its frame that fills from the line's start — the right, right to
 * left — and where it is in words beside or under it, and × to cancel it. One
 * that failed says so in the error's colour, with Retry. In a list the bar is
 * a line of its own under the name; on a card, its foot; on a tile, over its
 * foot. A bar with no number yet moves, unless the person asked for less
 * motion. Colours are the form's tokens, so dark follows.
 */
export const FILES_CSS = /* css */ `
/* ---- files and pictures: a list, thumbnails or cards, and the dialog one opens in ---------------------------- */
@container (max-width: 520px) {
  /* A file open on a phone: its name and Close on a row, the tools on the next. */
  .fd-form .fd-file-viewer > :first-child { padding-inline-end: 16px; }
  .fd-form .fd-file-viewer h2 { flex-basis: 100%; margin-inline-end: 36px; }
}
.fd-file { display: grid; gap: 8px; justify-items: start; padding: 6px 0; border-radius: var(--fd-control-radius); min-width: 0; }
.fd-file.fd-dragging { outline: 2px dashed var(--fd-accent); outline-offset: 4px; }
.fd-file-pick { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; cursor: pointer; }
.fd-file input:focus-visible + .fd-file-pick { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-files-list .fd-file-pick { justify-self: stretch; padding: 10px 14px; border: 1px dashed var(--fd-border-strong); border-radius: var(--fd-control-radius); background: var(--fd-page); }
.fd-file-pick:hover, .fd-dragging .fd-file-pick { border-color: var(--fd-accent); }
.fd-files { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; justify-self: stretch; min-width: 0; }
.fd-files:empty { display: none; }
.fd-file-item { position: relative; display: flex; align-items: center; gap: 2px; min-width: 0; }
.fd-file-open {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 5px 8px; font: inherit; color: inherit; text-align: start; cursor: pointer;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius);
}
.fd-file-open:hover { border-color: var(--fd-accent); }
.fd-file-thumb, .fd-file-icon { flex: none; width: 36px; height: 36px; border-radius: 3px; object-fit: cover; }
/* A page with its corner folded, its colour by kind, its extension on it. */
.fd-file-icon {
  display: grid; place-items: end center; padding-block-end: 4px; font-size: 9px; font-weight: 700; color: #fff;
  background: var(--fd-kind, #5b6573); clip-path: polygon(0 0, 68% 0, 100% 28%, 100% 100%, 0 100%);
}
.fd-file-icon::before { content: attr(data-ext); }
.fd-file-icon[data-kind="pdf"] { --fd-kind: #c62828; }
.fd-file-icon[data-kind="doc"] { --fd-kind: #1f5fbf; }
.fd-file-icon[data-kind="sheet"] { --fd-kind: #1d7a3e; }
.fd-file-icon[data-kind="zip"] { --fd-kind: #8a5300; }
.fd-file-icon[data-kind="video"] { --fd-kind: #6d3fc0; }
.fd-file-icon[data-kind="audio"] { --fd-kind: #0f766e; }
/* A film's picture: its poster frame, filling its box, a play mark over it — a media mark, which never turns right to
   left. A sound in a list: the browser's own player under its name, the whole line wide. */
.fd-file-film { position: relative; display: grid; place-items: center; overflow: hidden; background: #14181d; }
.fd-file-film > * { width: 100%; height: 100%; object-fit: cover; }
.fd-file-film::after {
  content: ""; position: absolute; width: 0; height: 0; border-style: solid; border-width: 7px 0 7px 12px; border-color: transparent transparent transparent #fff;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.7)); translate: 2px 0;
}
:is(.fd-files-thumbs, .fd-files-cards) .fd-file-film::after { border-width: 13px 0 13px 22px; }
.fd-file-item:has(> .fd-file-player) { flex-wrap: wrap; }
.fd-file-player { flex-basis: 100%; min-width: 0; height: 40px; }
.fd-file-name { flex: 1; display: flex; min-width: 0; white-space: pre; }
.fd-file-name > span { overflow: hidden; text-overflow: ellipsis; }
/* A size reads in its own direction, right to left too. */
.fd-file-size { color: var(--fd-muted); font-size: 12.5px; font-variant-numeric: tabular-nums; unicode-bidi: plaintext; }
.fd-file-remove { flex: none; width: 32px; height: 32px; border: none; border-radius: 999px; background: none; color: var(--fd-muted); font-size: 20px; line-height: 1; cursor: pointer; }
.fd-file-remove:hover { color: var(--fd-error); background: var(--fd-error-soft); }
.fd-file-note:empty { display: none; }
.fd-file-note { color: var(--fd-warning); }
/* Over the files: how many, and the switch between a list and pictures, at the end. */
.fd-file-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; justify-self: stretch; }
.fd-file-views { display: flex; gap: 2px; margin-inline-start: auto; padding: 2px; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); background: var(--fd-page); }
.fd-file-views button {
  display: flex; align-items: center; gap: 6px; min-height: 28px; padding: 2px 10px; font: inherit; font-size: 13px; color: var(--fd-muted); cursor: pointer;
  border: none; border-radius: calc(var(--fd-control-radius) - 2px); background: none;
}
.fd-file-views [aria-pressed="true"] { color: var(--fd-text); background: var(--fd-surface); box-shadow: 0 0 0 1px var(--fd-border); }
/* Thumbnails: tiles in a row that wraps, the picker the last of them. */
.fd-files-thumbs { display: flex; flex-wrap: wrap; align-items: flex-start; }
.fd-files-thumbs > * { flex-basis: 100%; }
:is(.fd-files-thumbs, .fd-files-cards) > .fd-files { display: contents; }
.fd-files-thumbs .fd-file-item, .fd-image-pick { flex: none; width: 96px; height: 96px; }
.fd-files-thumbs .fd-file-open { height: 100%; padding: 6px; flex-direction: column; justify-content: center; gap: 4px; overflow: hidden; font-size: 12px; }
:is(.fd-files-thumbs, .fd-files-cards) .fd-file-thumb { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: inherit; }
.fd-files-thumbs .fd-file-name { flex: none; max-width: 100%; }
.fd-files-thumbs .fd-file-size, .fd-files-thumbs .fd-file-thumb ~ * { display: none; }
:is(.fd-files-thumbs, .fd-files-cards) .fd-file-remove {
  position: absolute; inset-block-start: 4px; inset-inline-end: 4px; width: 26px; height: 26px; font-size: 17px;
  background: rgba(15, 20, 25, 0.62); color: #fff; opacity: 0;
}
.fd-file-item:is(:hover, :focus-within) .fd-file-remove { opacity: 1; }
/* A screen with no pointer to hover with shows each tile's remove. */
@media (hover: none) { .fd-file-item .fd-file-remove { opacity: 1; } }
.fd-image-pick {
  display: grid; place-content: center; justify-items: center; gap: 2px; padding: 6px; text-align: center; font-size: 12px;
  border: 1px dashed var(--fd-border-strong); border-radius: var(--fd-control-radius); background: var(--fd-page);
}
/* Cards: a picture over each file's name, in two lines at most, and its size; as many to a row as fit. */
.fd-files-cards { grid-template-columns: repeat(auto-fill, minmax(min(100%, 130px), 1fr)); }
.fd-files-cards > * { grid-column: 1 / -1; }
.fd-files-cards > .fd-image-pick { grid-column: auto; justify-self: stretch; width: auto; height: auto; min-height: 96px; }
.fd-files-cards .fd-file-item { justify-self: stretch; align-items: stretch; }
.fd-files-cards .fd-file-open { flex-direction: column; align-items: stretch; gap: 2px; padding: 0 0 8px; overflow: hidden; }
/* The picture fills its box; with none, the kind's page, large, on the box's ground. */
.fd-file-picture { position: relative; display: grid; place-items: center; aspect-ratio: 4 / 3; margin-block-end: 6px; background: var(--fd-page); border-block-end: 1px solid var(--fd-border); }
.fd-file-picture .fd-file-icon { width: 44px; height: 56px; padding-block-end: 8px; font-size: 12px; }
.fd-files-cards :is(.fd-file-name, .fd-file-size) { padding-inline: 8px; }
.fd-files-cards .fd-file-name { flex: none; flex-wrap: wrap; font-size: 13px; line-height: 1.35; }
.fd-files-cards .fd-file-name > span { max-width: 100%; }
.fd-image-pick .fd-button { border: none; background: none; color: var(--fd-accent); padding: 0; min-height: 0; font-size: 13px; }
/* A file open to look at: its name and tools over it, the image whole, a PDF or text filling the box, on a dialog's
   own ground (.fd-form-dialog's). */
.fd-file-viewer { max-width: 1000px; height: min(88vh, 100%); }
/* Close in the corner, beside the name however the tools wrap. */
.fd-file-viewer > :first-child { position: relative; flex-wrap: wrap; justify-content: start; gap: 6px 10px; padding-block: 8px; padding-inline-end: 52px; }
.fd-file-viewer .fd-dialog-close { position: absolute; inset-block-start: 10px; inset-inline-end: 10px; }
.fd-file-viewer h2 { flex: 1 1 10em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Previous and Next, their arrows in a button's own words (.fd-button's font). */
.fd-file-step { min-width: 34px; }
.fd-file-viewer a { text-decoration: none; }
.fd-file-viewer-body { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: auto; background: var(--fd-page); }
.fd-file-viewer-body :is(img, video) { max-width: 100%; max-height: 100%; object-fit: contain; }
.fd-file-viewer-body video { background: #000; }
.fd-file-sound audio { width: min(420px, 100%); margin-block-start: 12px; }
.fd-file-viewer-body :is(iframe, pre) { flex: 1; align-self: stretch; margin: 0; border: 0; background: var(--fd-surface); }
.fd-file-viewer-body pre { padding: 14px 16px; overflow: auto; font: 13px/1.5 monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.fd-file-none { display: grid; justify-items: center; gap: 4px; padding: 24px; text-align: center; color: var(--fd-muted); }
.fd-file-none strong { color: var(--fd-text); overflow-wrap: anywhere; }
.fd-file-none .fd-file-icon { width: 64px; height: 64px; font-size: 14px; padding-block-end: 8px; }
/* A picture field as a record's avatar, beside its title. */
.fd-avatar .fd-file { justify-items: center; gap: 4px 8px; padding: 0; justify-content: center; }
.fd-avatar :is(.fd-file-item, .fd-image-pick) { width: 88px; height: 88px; }
.fd-avatar :is(.fd-image-pick .fd-help, .fd-file-limits) { display: none; }
/* ---- files on their way to the app's store ------------------------------------------------------------------ */
.fd-file-going > .fd-file-open { flex-wrap: wrap; cursor: default; }
.fd-file-going > .fd-file-open:hover { border-color: var(--fd-border); }
.fd-file-going .fd-file-thumb { opacity: 0.55; }
.fd-file-progress-box { flex: 1 1 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 10px; min-width: 0; color: var(--fd-muted); font-size: 12.5px; }
.fd-file-state { flex: 0 1 auto; min-width: 0; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; unicode-bidi: plaintext; }
.fd-file-going:is([data-status="failed"], [data-status="refused"]) .fd-file-state { color: var(--fd-error); }
.fd-file-retry.fd-button { flex: none; min-height: 0; padding: 0; font-size: 12.5px; }
.fd-file-progress {
  -webkit-appearance: none; appearance: none; flex: 1 1 60px; min-width: 40px; height: 6px; margin: 0;
  border: 0; border-radius: 999px; background: var(--fd-border); color: var(--fd-accent); overflow: hidden;
}
.fd-file-progress::-webkit-progress-bar { background: var(--fd-border); border-radius: 999px; }
.fd-file-progress::-webkit-progress-value { background: var(--fd-accent); border-radius: 999px; transition: width 0.2s; }
.fd-file-progress::-moz-progress-bar { background: var(--fd-accent); border-radius: 999px; }
/* No number yet: a stripe that moves, as a bar that waits does. */
.fd-file-progress:indeterminate { background: linear-gradient(90deg, var(--fd-border) 0 35%, var(--fd-accent) 35% 65%, var(--fd-border) 65%) 0 0 / 300% 100%; animation: fd-file-going 1.4s linear infinite; }
.fd-file-progress:indeterminate::-webkit-progress-bar { background: transparent; }
.fd-file-progress:indeterminate::-moz-progress-bar { background: transparent; }
@keyframes fd-file-going { from { background-position: 100% 0; } }
@media (prefers-reduced-motion: reduce) { .fd-file-progress:indeterminate { animation: none; background-position: 50% 0; } }
/* A card: the bar across its foot, the words under it. */
:is(.fd-files-cards, .fd-files-thumbs) .fd-file-going > .fd-file-open { flex-wrap: nowrap; }
.fd-files-cards .fd-file-going .fd-file-progress-box { flex: none; padding: 4px 8px 0; }
.fd-files-cards .fd-file-progress { flex-basis: 100%; }
/* A tile: the bar and its words over its foot, on the surface. */
.fd-files-thumbs .fd-file-going .fd-file-progress-box {
  position: absolute; inset-inline: 5px; inset-block-end: 5px; display: flex; flex-direction: column; align-items: stretch; gap: 2px; padding: 4px 6px;
  border-radius: 4px; background: var(--fd-surface); box-shadow: 0 0 0 1px var(--fd-border); font-size: 11px; text-align: center;
}
.fd-files-thumbs .fd-file-progress { flex: none; width: 100%; min-width: 0; }
.fd-files-thumbs .fd-file-going[data-status="refused"] .fd-file-state { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
/* × stays in sight while a file is on its way, a pointer or not. */
:is(.fd-files-thumbs, .fd-files-cards) .fd-file-going .fd-file-remove { opacity: 1; }
/* What came of the uploads, on its own line in the help's colour — the error's for one not uploaded. */
.fd-file-news:empty { display: none; }
.fd-file-news[data-failed] { color: var(--fd-error); }
/* A signature: a pad with a line to sign on, a box to type a name in instead, and Clear. */
.fd-signature { display: grid; gap: 8px; justify-items: start; width: 100%; max-width: 480px; min-width: 0; }
.fd-signature-box {
  position: relative; width: 100%; aspect-ratio: 10 / 3; border: 1px dashed var(--fd-border-strong);
  border-radius: var(--fd-control-radius); background: #fff; overflow: hidden;
}
.fd-signature-box:has(.fd-signature-pad:not([hidden]):not(.fd-signature-locked)):hover { border-color: var(--fd-accent); }
.fd-signature-pad, .fd-signature-image { display: block; width: 100%; height: 100%; }
.fd-signature-pad { touch-action: none; cursor: crosshair; }
.fd-signature-pad.fd-signature-locked { cursor: default; }
.fd-signature-image { object-fit: contain; }
.fd-signature-hint {
  position: absolute; inset-inline: 18px; inset-block-end: 16px; padding-block-start: 4px; pointer-events: none;
  border-block-start: 1px solid var(--fd-border-strong); color: var(--fd-muted); font-size: 12.5px;
}
.fd-signature-tools { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; width: 100%; }
.fd-signature-typed { flex: 1 1 200px; min-width: 0; }
.fd-signature-footer { margin-block-start: -4px; color: var(--fd-muted); font-size: 12.5px; }
/* On paper: a file's name and picture, not the ways to pick, switch or remove one. */
@media print { .fd-form :is(.fd-file-remove, .fd-file-pick, .fd-file-views, .fd-file-limits) { display: none !important; } }
`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installFilesStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-files-styles', FILES_CSS, PART_RANK.files);
}
