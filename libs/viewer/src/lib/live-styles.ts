import { fieldiaStyle } from '@fieldia/widgets';

/** Who else has a record open (live.ts, the live part): their initials, a ring round whoever is changing it, their names. */
const LIVE_CSS = /* css */ `
.fd-presence[hidden] { display: none; }
.fd-presence { display: flex; align-items: center; gap: 8px; margin-block-end: 12px; font-size: 13px; color: var(--fd-muted); }
.fd-content > .fd-presence-slot:has(~ .fd-sheet-page) > .fd-presence { margin: 12px 16px; }
.fd-presence-faces { display: flex; }
.fd-presence-face {
  display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; margin-inline-end: -6px; font-size: 11px; font-weight: 650;
  background: var(--fd-accent-soft); color: var(--fd-text); border: 2px solid var(--fd-surface);
}
.fd-presence-face[data-editing] { box-shadow: 0 0 0 2px var(--fd-accent); }
.fd-presence-words { margin-inline-start: 8px; }
`;

/**
 * The live part's sheet, once, after Fieldia's own, unranked as a list's own is: it names only its own parts, which a
 * theme reshapes by its tokens alone.
 */
export function installLiveStyles(doc: Document): void {
  if (doc.getElementById('fd-live-styles')) return;
  const style = fieldiaStyle(doc, LIVE_CSS, 'fd-live-styles');
  (doc.head ?? doc.documentElement).append(style);
}
