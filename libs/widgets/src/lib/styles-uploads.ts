/**
 * Files on their way to the app's store (files-going.ts): each item as a
 * stored file's, its picture paler, with a bar under it that fills from the
 * line's start — the right, right to left — where it is in words at its end,
 * and × to cancel it. One that failed says so in the error's colour, with
 * Retry. In thumbnails the bar and its words sit over the tile's foot; in
 * cards, under the card. A bar with no number yet moves, unless the person
 * asked for less motion. Colours are the form's tokens, so dark follows.
 */
export const UPLOADS_CSS = /* css */ `
.fd-file-going { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 2px; }
.fd-file-going > .fd-file-open { cursor: default; }
.fd-file-going > .fd-file-open:hover { border-color: var(--fd-border); }
.fd-file-going .fd-file-thumb { opacity: 0.55; }
.fd-file-progress-box { grid-row: 2; display: flex; align-items: center; gap: 2px 10px; min-width: 0; padding: 4px 2px 0; color: var(--fd-muted); font-size: 12.5px; }
.fd-file-state { flex: none; max-width: 100%; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; unicode-bidi: plaintext; }
.fd-file-going:is([data-status="failed"], [data-status="refused"]) .fd-file-state { flex: 1; color: var(--fd-error); }
.fd-file-retry.fd-button { flex: none; min-height: 0; padding: 0; font-size: 12.5px; }
.fd-file-progress {
  -webkit-appearance: none; appearance: none; flex: 1; min-width: 40px; height: 6px; margin: 0;
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
/* A tile: its bar and words over its foot, on the surface, × always there. */
.fd-files-thumbs .fd-file-going { display: block; }
.fd-files-thumbs .fd-file-progress-box {
  position: absolute; inset-inline: 5px; inset-block-end: 5px; flex-direction: column; align-items: stretch; gap: 3px; padding: 4px 6px;
  border-radius: 4px; background: var(--fd-surface); box-shadow: 0 0 0 1px var(--fd-border); font-size: 11px; text-align: center;
}
.fd-files-thumbs .fd-file-progress { flex: none; width: 100%; min-width: 0; }
.fd-files-thumbs .fd-file-going[data-status="refused"] .fd-file-state { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
:is(.fd-files-thumbs, .fd-files-cards) .fd-file-going .fd-file-remove { opacity: 1; }
/* A card: the bar under the picture and the name. */
.fd-files-cards .fd-file-going { display: flex; flex-direction: column; }
.fd-files-cards .fd-file-progress-box { padding: 6px 4px 0; }
`;
