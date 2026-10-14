/**
 * Files on their way to the app's store (files-going.ts): each item as a
 * stored file's, its picture paler, with a bar inside its frame that fills
 * from the line's start — the right, right to left — and where it is in words
 * beside or under it, and × to cancel it. One that failed says so in the
 * error's colour, with Retry. In a list the bar is a line of its own under
 * the name; on a card, its foot; on a tile, over its foot. A bar with no
 * number yet moves, unless the person asked for less motion. Colours are the
 * form's tokens, so dark follows.
 */
export const UPLOADS_CSS = /* css */ `
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
`;
