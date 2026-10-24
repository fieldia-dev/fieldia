/**
 * Waiting for an answer (loading.ts): what every page may draw before the loading part has come — a loader's place,
 * its words (text, Loading more…, Searching…, Still loading…), what is shown dimmed (`dim`) or out of sight while it is
 * drawn the first time, and a failure in its place with Retry. The skeletons, the bars, the spinners, the overlay and
 * their tokens are the loading part's (styles-loading-part.ts).
 *
 * A region that waits is marked as its loader shows: data-fd-wait (the moment), data-fd-way (the technique), and
 * data-fd-shaped where its own shapes stand in the place of its content (a list's rows, a form's boxes, a page's
 * layout). On paper there is no loader.
 *
 * What a person has open stays theirs: a part of the place holding an open popup (a box's list, a date's calendar, a
 * menu — its opener expanded) is never hidden, dimmed or shaped under a wait, so the popup stays over everything,
 * whole and pressed as ever, while the rest waits.
 */
export const LOADING_CSS = /* css */ `
@media not print {
/* Its loader over it: a list's records, a form's place (a search's list and a row's end float or flow as they are). */
.fd-form [data-fd-wait]:not([data-fd-wait="search"], [data-fd-wait="more"]) { position: relative; }
.fd-form [data-fd-wait="first"]:not([data-fd-shaped]) { min-height: 96px; }
.fd-form [data-fd-wait]:is([data-fd-wait="first"], [data-fd-way="skeleton"]):not([data-fd-shaped]) > :not(.fd-loader, :has(:is([aria-haspopup], [role="combobox"])[aria-expanded="true"])) { visibility: hidden; }
.fd-form [data-fd-way="dim"] > :not(.fd-loader, :has(:is([aria-haspopup], [role="combobox"])[aria-expanded="true"])) { opacity: 0.55; transition: opacity 0.2s; }
.fd-loader { box-sizing: border-box; color: var(--fd-muted); font-size: 13px; line-height: 1.4; }
.fd-loader[data-moment="first"] { position: absolute; inset: 0; z-index: 3; display: grid; align-content: center; justify-items: center; gap: 10px; padding: 16px; text-align: center; }
.fd-loader:is([data-moment="more"], [data-moment="search"]) { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 12px; }
.fd-loader-slow { display: block; font-size: 12px; }
/* A field's choices from the app, said where its help is. */
.fd-loader.fd-help { display: block; padding: 0; }
.fd-loader[data-way="failed"] { position: static; display: block; padding: 10px 12px; color: var(--fd-text); text-align: start; }
}
@media print { .fd-loader, .fd-loading-said { display: none !important; } }
`;
