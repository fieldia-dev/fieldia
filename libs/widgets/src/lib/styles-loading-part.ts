import { installPartStyles, PART_RANK } from './styles';

/**
 * The loading part's looks (loading-part.ts): the skeleton — a few bars in a place, a form's boxes under their labels,
 * a list's rows (drawn by the list part), a page's layout while its parts come — shimmering, pulsing or still; the bar
 * along the top (what is shown kept as it is asked again, an action's bar, a first's progress) or across the middle; a
 * spinner, a ring or three dots; the overlay over a form while it saves. Their tokens are here too, and every theme
 * sets its own (themes.ts), light and dark: --fd-skeleton (the shapes' tint), --fd-skeleton-shine (the shimmer's band),
 * --fd-shimmer (one pass), --fd-spinner (the ring's and the bar's colour, the accent unless said), --fd-bar (the bar's
 * height). The words of a wait drawn here are a screen reader's alone (the wait says them once). Nothing moves for a
 * reader who asks for no motion; the system's colours where they are forced; nothing on paper.
 *
 * Its rank (PART_RANK.loading) is the last: it styles only its own elements and a waiting form's boxes, which no theme
 * and no quiet look reshapes while they wait — a theme speaks to them through the tokens alone.
 */
export const LOADING_PART_CSS = /* css */ `
@layer fieldia-tokens {
.fd-form, .fd-theme:is([data-fd-skin], :not(.fd-form *)) {
  --fd-skeleton: color-mix(in srgb, var(--fd-text) 9%, var(--fd-surface));
  --fd-skeleton-shine: color-mix(in srgb, var(--fd-text) 3%, var(--fd-surface));
  --fd-shimmer: 1.6s;
  --fd-spinner: var(--fd-accent);
  --fd-bar: 3px;
}
/* On a dark page the shimmer's band is the lighter one. */
:is(.fd-form, .fd-form-dialog)[data-scheme="dark"] { --fd-skeleton-shine: color-mix(in srgb, var(--fd-text) 16%, var(--fd-surface)); }
@media (prefers-color-scheme: dark) { :is(.fd-form, .fd-form-dialog)[data-scheme="auto"] { --fd-skeleton-shine: color-mix(in srgb, var(--fd-text) 16%, var(--fd-surface)); } }
}
@media not print {
.fd-loader:is([data-way="skeleton"]:not([data-moment="more"]), [data-moment="refresh"][data-way="spinner"], [data-way="overlay"]) {
  position: absolute; inset: 0; z-index: 3; display: grid; align-content: center; justify-items: center; gap: 10px; padding: 16px;
}
/* A few bars from the top of its place, each as wide as it says — never two short ones in its middle, the first unseen:
   as heavy as the rule over it, which it follows. */
.fd-loader[data-way="skeleton"][data-moment] { align-content: start; justify-items: stretch; }
.fd-loader[data-moment="more"][data-way="skeleton"] { display: grid; justify-content: stretch; inline-size: 100%; }
.fd-loader:is([data-way="spinner"], [data-way="overlay"], [data-way="progress"]) > .fd-loader-words { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.fd-form [data-fd-wait="refresh"][data-fd-way="spinner"] > :not(.fd-loader, :has(:is([aria-haspopup], [role="combobox"])[aria-expanded="true"])) { opacity: 0.55; transition: opacity 0.2s; }
/* Asked again, a ring over what is shown: what is shown still pressed and typed in, as when it is kept (a popup opened meanwhile works). */
.fd-loader[data-moment="refresh"][data-way="spinner"] { pointer-events: none; }
/* A bar along the top: what is shown kept as it is asked again, an action's, a first's progress. */
.fd-loader:is([data-way="keep"], [data-way="bar"], [data-way="progress"][data-look="top"]) { position: absolute; inset: 0 0 auto; height: var(--fd-bar); padding: 0; overflow: hidden; z-index: 3; pointer-events: none; }
.fd-bar { position: absolute; inset-block: 0; inset-inline-start: -40%; inline-size: 40%; background: var(--fd-spinner); border-radius: var(--fd-bar); animation: fd-bar 1.2s ease-in-out infinite; }
@keyframes fd-bar { to { inset-inline-start: 100%; } }
/* The bar across the middle: its track, the bar running along it. */
.fd-loader[data-way="progress"][data-look="inline"] .fd-bar { position: relative; inset: auto; display: block; inline-size: min(200px, 60%); block-size: var(--fd-bar); background: color-mix(in srgb, var(--fd-spinner) 22%, transparent); overflow: hidden; animation: none; }
.fd-loader[data-way="progress"][data-look="inline"] .fd-bar::before { content: ""; position: absolute; inset-block: 0; inset-inline-start: -40%; inline-size: 40%; background: var(--fd-spinner); border-radius: inherit; animation: fd-bar 1.2s ease-in-out infinite; }
/* A spinner: a turning ring, or three dots; small in a row's place and at a box's end. */
.fd-spin { display: block; inline-size: 28px; block-size: 28px; border: 3px solid color-mix(in srgb, var(--fd-spinner) 22%, transparent); border-block-start-color: var(--fd-spinner); border-radius: 50%; animation: fd-spin 0.8s linear infinite; }
.fd-loader:is([data-moment="more"], [data-moment="search"]) .fd-spin { inline-size: 18px; block-size: 18px; border-width: 2px; }
.fd-loader[data-look="dots"] .fd-spin { inline-size: 8px; block-size: 8px; border: 0; background: var(--fd-spinner); box-shadow: -14px 0 var(--fd-spinner), 14px 0 var(--fd-spinner); animation: fd-dots 0.9s ease-in-out infinite alternate; }
@keyframes fd-dots { to { opacity: 0.25; } }
.fd-loader[data-moment="search"][data-way="spinner"] { position: absolute; inset-block: 0; inset-inline-end: 8px; padding: 0; pointer-events: none; }
/* Over a form while it saves: a veil, a ring, nothing pressed or typed under it. */
.fd-loader[data-way="overlay"] { background: color-mix(in srgb, var(--fd-surface) 72%, transparent); border-radius: inherit; pointer-events: auto; cursor: progress; }
/* Shapes where the content will be: a few bars in its place, a list's rows, a form's boxes under their labels — a box
   whose popup is open (its opener expanded) kept as it is, its popup over everything (styles-loading.ts); a box the
   browser draws itself (WebKit's select) drawn as a shape too, none of it showing through. */
.fd-sk { display: block; block-size: 0.9em; margin-block: 7px; border-radius: 4px; background-color: var(--fd-skeleton); }
.fd-loader[data-way="skeleton"] > .fd-sk:nth-child(2) { inline-size: 82%; }
.fd-loader[data-way="skeleton"] > .fd-sk:nth-child(3) { inline-size: 64%; }
.fd-form [data-fd-shaped] .fd-field:not(:has(:is([aria-haspopup], [role="combobox"])[aria-expanded="true"])) > :is(.fd-label + *, :first-child:not(.fd-label)) { min-block-size: 1.6em; border-color: transparent !important; box-shadow: none !important; color: transparent !important; background-color: var(--fd-skeleton) !important; border-radius: max(var(--fd-control-radius), 4px); appearance: none !important; }
.fd-form [data-fd-shaped] .fd-field:not(:has(:is([aria-haspopup], [role="combobox"])[aria-expanded="true"])) > :is(.fd-label + *, :first-child:not(.fd-label)) * { visibility: hidden; }
.fd-form [data-fd-look="shimmer"] :is(.fd-sk, .fd-field:not(:has(:is([aria-haspopup], [role="combobox"])[aria-expanded="true"])) > .fd-label + *, .fd-field:not(:has(:is([aria-haspopup], [role="combobox"])[aria-expanded="true"])) > :first-child:not(.fd-label)), .fd-loader[data-look="shimmer"] .fd-sk {
  background-image: linear-gradient(90deg, transparent 30%, var(--fd-skeleton-shine) 50%, transparent 70%) !important; background-size: 300% 100% !important; background-position: 100% 0; animation: fd-shimmer var(--fd-shimmer) linear infinite;
}
.fd-form [data-fd-look="shimmer"] :dir(rtl) { animation-direction: reverse; }
.fd-form [data-fd-look="pulse"] :is(.fd-sk, .fd-field:not(:has(:is([aria-haspopup], [role="combobox"])[aria-expanded="true"])) > .fd-label + *, .fd-field:not(:has(:is([aria-haspopup], [role="combobox"])[aria-expanded="true"])) > :first-child:not(.fd-label)), .fd-loader[data-look="pulse"] .fd-sk { animation: fd-pulse 1.4s ease-in-out infinite alternate; }
@keyframes fd-shimmer { to { background-position: 0 0; } }
@keyframes fd-pulse { to { opacity: 0.45; } }
/* A page's skeleton from its layout, while its parts come (page-skeleton.ts): its groups as cards, each field a label's bar over its box. */
.fd-sk-page { display: grid; gap: var(--fd-gap-block, 20px); }
.fd-sk-grid { display: grid; grid-template-columns: repeat(var(--fd-sk-cols, 1), minmax(0, 1fr)); gap: var(--fd-gap-y) var(--fd-gap-x); }
.fd-sk-group { display: grid; gap: 12px; padding: var(--fd-group-pad, 16px 20px); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); background: var(--fd-surface); }
.fd-sk-field, .fd-sk-rows { display: grid; gap: 6px; }
.fd-sk-page .fd-sk { margin: 0; }
.fd-sk-label { inline-size: 35%; block-size: 0.8em; }
.fd-sk-box { block-size: var(--fd-control-height, 32px); border-radius: var(--fd-control-radius); }
.fd-sk-title { inline-size: 28%; }
.fd-sk-tabs { inline-size: 50%; block-size: 1.6em; }
.fd-sk-rows .fd-sk { block-size: 1.8em; }
@container (max-width: 520px) { .fd-sk-grid { grid-template-columns: minmax(0, 1fr); } }
}
@media (prefers-reduced-motion: reduce) {
  .fd-sk, .fd-bar, .fd-bar::before, .fd-spin, .fd-form [data-fd-wait] * { animation: none !important; }
  .fd-bar, .fd-bar::before { inset-inline-start: 0 !important; inline-size: 100% !important; opacity: 0.7; }
}
@media (forced-colors: active) {
  .fd-sk, .fd-form [data-fd-shaped] .fd-field:not(:has(:is([aria-haspopup], [role="combobox"])[aria-expanded="true"])) > :is(.fd-label + *, :first-child:not(.fd-label)) { forced-color-adjust: none; background: GrayText !important; }
  .fd-bar, .fd-bar::before { forced-color-adjust: none; background: Highlight !important; }
  .fd-spin { forced-color-adjust: none; border-color: GrayText; border-block-start-color: Highlight; }
  .fd-loader[data-look="dots"] .fd-spin { background: Highlight; box-shadow: -14px 0 Highlight, 14px 0 Highlight; }
  .fd-loader[data-way="overlay"] { forced-color-adjust: none; background: Canvas; opacity: 0.85; }
}
`;

/** The loading part's sheet in a document, once, in its place among Fieldia's (PART_RANK.loading). */
export function installLoadingStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-loading-styles', LOADING_PART_CSS, PART_RANK.loading);
}
