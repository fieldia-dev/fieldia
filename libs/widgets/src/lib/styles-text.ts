/**
 * What every page has of a work item's body: the tokens its parts share, a
 * group's own column widths, help in a light box and a link's mark that it
 * leaves the page. A group's heading with tools is the head part's
 * (@fieldia/viewer's group-styles.ts); the formatted text's editors and the
 * links box are the text part's (styles-editor.ts). Written with logical
 * properties, so right to left mirrors on its own; every colour from a token.
 */
export const TEXT_CSS = /* css */ `
.fd-form, .fd-theme {
  --fd-text-link: var(--fd-link, var(--fd-accent));
  --fd-text-fill: var(--fd-fill, color-mix(in srgb, var(--fd-text) 6%, var(--fd-surface)));
  --fd-text-hover: color-mix(in srgb, var(--fd-text) 4%, var(--fd-surface));
  --fd-text-pressed: color-mix(in srgb, var(--fd-text) 20%, var(--fd-surface));
  --fd-text-help: var(--fd-help, color-mix(in srgb, var(--fd-text) 4%, var(--fd-surface)));
  --fd-depth-4: 0 1.6px 3.6px rgb(0 0 0 / 0.132), 0 0.3px 0.9px rgb(0 0 0 / 0.108);
  --fd-depth-8: 0 3.2px 7.2px rgb(0 0 0 / 0.132), 0 0.6px 1.8px rgb(0 0 0 / 0.108);
}

/* ---- a group's own column widths (tracks), from a tablet's width up ---- */
@container (min-width: 761px) { .fd-form .fd-grid[data-tracks] { grid-template-columns: var(--fd-track-list); } }

/* ---- help in a light box, room for an icon at its start ---- */
.fd-help-box {
  position: relative; margin: 0; padding: 10px 12px 10px 50px; padding-inline: 50px 12px; min-height: 37px; box-sizing: border-box;
  background: var(--fd-text-help); color: var(--fd-text); font-size: 14px; line-height: 17px; overflow-wrap: anywhere;
}
.fd-help-box > p { margin: 0; }
.fd-help-box-icon, .fd-links-help-icon { position: absolute; inset-inline-start: 11px; inset-block-start: 50%; translate: 0 -50%; width: 28px; height: 30px; color: var(--fd-muted); stroke-width: 1.4; }
:is(.fd-help-box, .fd-links-help, .fd-text-help) a { color: var(--fd-text-link); text-decoration: underline; }

.fd-external { width: 12px; height: 12px; margin-inline-start: 4px; vertical-align: -1px; color: var(--fd-muted); stroke-width: 2; }
`;
