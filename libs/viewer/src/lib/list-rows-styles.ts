/**
 * The look of a list's richer rows (list-cells.ts): a pill, chips, a picture or a person's initials, a bar, a phone's
 * links, a row's tone and bold, and its own buttons at its end. Put in the page with the list's own (list-styles.ts),
 * after it, in the same sheet.
 */
export const LIST_ROW_STYLES = `
/* ---- what a cell draws: a pill, chips, a picture, a bar, a phone's links ---- */
.fd-list-table .fd-list-pill { vertical-align: middle; max-width: 100%; }
.fd-list-chips { display: inline-flex; gap: 4px; vertical-align: middle; max-width: 100%; overflow: hidden; }
.fd-list-chip { flex: none; padding: 0 8px; border-radius: 999px; background: var(--fd-accent-soft); color: var(--fd-text); font-size: 12.5px; line-height: 20px; white-space: nowrap; }
.fd-list-thumb { display: inline-block; width: 48px; height: 32px; object-fit: cover; border-radius: 4px; vertical-align: middle; background: var(--fd-page); }
.fd-list-avatar { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; object-fit: cover; vertical-align: middle; }
.fd-list-initials::before { content: attr(data-initials); }
.fd-list-initials { background: color-mix(in srgb, hsl(var(--fd-face, 210) 55% 50%) 20%, var(--fd-surface)); color: color-mix(in srgb, hsl(var(--fd-face, 210) 60% 32%) 75%, var(--fd-text)); font-size: 11.5px; font-weight: 600; line-height: 1; }
.fd-list-table td:has(> .fd-list-thumb, > .fd-list-avatar, > .fd-list-person) { padding-block: 3px; }
.fd-list-person { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; vertical-align: middle; }
.fd-list-person > bdi { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.fd-list-meter { display: inline-block; width: 72px; height: 6px; border-radius: 999px; background: var(--fd-border); vertical-align: middle; overflow: hidden; margin-inline-end: 8px; }
.fd-list-meter-fill { display: block; height: 100%; border-radius: inherit; background: var(--fd-accent); }
.fd-list-meter-words { color: var(--fd-muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.fd-list-links { display: inline-flex; gap: 2px; margin-inline-start: 6px; vertical-align: middle; }
.fd-list-link { display: inline-grid; place-items: center; width: 26px; height: 26px; margin-block: -4px; border-radius: 50%; color: var(--fd-accent); }
.fd-list-link:hover { background: var(--fd-accent-soft); }
.fd-list-link:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 0; }
.fd-list-link svg { width: 16px; height: 16px; }
/* A row's own tone (rowTones), its words in that colour as Flectra's decoration-*, and bold (rowBold). */
.fd-list-row[data-tone="info"] { --fd-row-tone: var(--fd-info); }
.fd-list-row[data-tone="success"] { --fd-row-tone: var(--fd-success); }
.fd-list-row[data-tone="warning"] { --fd-row-tone: var(--fd-warning); }
.fd-list-row[data-tone="danger"] { --fd-row-tone: var(--fd-error); }
.fd-list-row[data-tone="muted"] { --fd-row-tone: var(--fd-muted); }
.fd-list-row[data-tone] > td { color: var(--fd-row-tone); }
.fd-list-row[data-bold] > td { font-weight: 600; }
/* A row's own buttons, at its end; the Columns menu's button over them. */
.fd-list-table .fd-list-tail { width: 1%; white-space: nowrap; text-align: end; padding-block: 3px; padding-inline: 6px; }
.fd-list-tail-words { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.fd-list-row-button { min-height: 28px; padding-block: 2px; padding-inline: 10px; font-size: 13px; white-space: nowrap; }
.fd-list-row-button svg { width: 15px; height: 15px; }
.fd-list-tail > .fd-list-row-button + .fd-list-row-button { margin-inline-start: 6px; }

`;
