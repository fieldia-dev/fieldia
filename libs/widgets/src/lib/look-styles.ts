/**
 * The page's own look in Fieldia's tokens: its font, room, corners, light or
 * dark, and its accent, worn by the form and by a dialog it opens (look.ts in
 * @fieldia/viewer). In Fieldia's tokens' layer (styles.ts), after the skins',
 * so they win over a skin's, and a host's own rule sets them over the page's.
 * A theme's tokens (themes.ts, a part loaded on first use) stood before these
 * in the layer, and these won over them at the same weight: the themes' sheet
 * carries them again after its own, so they still do.
 */
export const LOOK_TOKENS_CSS = /* css */ `
@layer fieldia-tokens {
:is(.fd-form, .fd-form-dialog)[data-font="serif"] { --fd-font: "Source Serif 4", Georgia, serif; }
:is(.fd-form, .fd-form-dialog)[data-font="rounded"] { --fd-font: Nunito, "Varela Round", system-ui; }
/* Room between and inside parts: gaps, the height of a box, a group's padding, the space between groups. */
:is(.fd-form, .fd-form-dialog)[data-density="compact"] { --fd-gap-y: 10px; --fd-gap-x: 16px; --fd-control-height: 30px; --fd-gap-block: 16px; --fd-group-pad: 14px 16px; }
:is(.fd-form, .fd-form-dialog)[data-density="comfortable"] { --fd-gap-y: 16px; --fd-gap-x: 20px; --fd-control-height: 36px; --fd-gap-block: 22px; --fd-group-pad: 18px 22px; }
:is(.fd-form, .fd-form-dialog)[data-density="roomy"] { --fd-gap-y: 22px; --fd-gap-x: 28px; --fd-control-height: 42px; --fd-gap-block: 30px; --fd-group-pad: 24px 30px; }
:is(.fd-form, .fd-form-dialog)[data-corners="square"] { --fd-radius: 0px; --fd-control-radius: 0px; }
:is(.fd-form, .fd-form-dialog)[data-corners="soft"] { --fd-radius: 10px; --fd-control-radius: 6px; }
:is(.fd-form, .fd-form-dialog)[data-corners="round"] { --fd-radius: 16px; --fd-control-radius: 12px; }
.fd-form[data-scheme] { --fd-ground: var(--fd-page); }
:is(.fd-form, .fd-form-dialog)[data-scheme="dark"] {
  --fd-text: #e8eaed;
  --fd-muted: #a3a9b2;
  --fd-page: #16191e;
  --fd-surface: #1f2329;
  --fd-border: #3a4048;
  --fd-border-strong: #59616c;
  --fd-accent: #5aa2ff;
  --fd-accent-text: #0b1220;
  --fd-accent-soft: rgba(90, 162, 255, 0.16);
  --fd-focus: #5aa2ff;
  --fd-error: #ff8a7a;
  --fd-error-soft: rgba(255, 138, 122, 0.13);
  --fd-success: #6fd08e;
  --fd-success-soft: rgba(111, 208, 142, 0.14);
  --fd-warning: #f2b55c;
  --fd-warning-soft: rgba(242, 181, 92, 0.13);
  --fd-info: #7db7ff;
  --fd-info-soft: rgba(90, 162, 255, 0.14);
  --fd-edge: #59616c;
}
/* Auto follows the reader's system: the same dark tokens, when it is dark. */
@media (prefers-color-scheme: dark) {
  :is(.fd-form, .fd-form-dialog)[data-scheme="auto"] {
    --fd-text: #e8eaed;
    --fd-muted: #a3a9b2;
    --fd-page: #16191e;
    --fd-surface: #1f2329;
    --fd-border: #3a4048;
    --fd-border-strong: #59616c;
    --fd-accent: #5aa2ff;
    --fd-accent-text: #0b1220;
    --fd-accent-soft: rgba(90, 162, 255, 0.16);
    --fd-focus: #5aa2ff;
    --fd-error: #ff8a7a;
    --fd-error-soft: rgba(255, 138, 122, 0.13);
    --fd-success: #6fd08e;
    --fd-success-soft: rgba(111, 208, 142, 0.14);
    --fd-warning: #f2b55c;
    --fd-warning-soft: rgba(242, 181, 92, 0.13);
    --fd-info: #7db7ff;
    --fd-info-soft: rgba(90, 162, 255, 0.14);
    --fd-edge: #59616c;
  }
}

/* The page's accent, and the softer and hover shades mixed from it on whatever surface the scheme has. */
:is(.fd-form, .fd-form-dialog)[data-accent] {
  --fd-accent: var(--fd-look-accent);
  --fd-accent-text: var(--fd-look-accent-text);
  --fd-focus: var(--fd-look-accent);
  --fd-accent-soft: color-mix(in srgb, var(--fd-accent) 12%, var(--fd-surface));
  --fd-accent-hover: color-mix(in srgb, var(--fd-accent) 84%, var(--fd-text));
}
/* On a dark page, the accent the viewer lightened, when it had to be, so it still reads there. */
:is(.fd-form, .fd-form-dialog)[data-scheme="dark"][data-accent] {
  --fd-accent: var(--fd-look-accent-dark);
  --fd-accent-text: var(--fd-look-accent-dark-text);
  --fd-focus: var(--fd-look-accent-dark);
}
@media (prefers-color-scheme: dark) {
  :is(.fd-form, .fd-form-dialog)[data-scheme="auto"][data-accent] {
    --fd-accent: var(--fd-look-accent-dark);
    --fd-accent-text: var(--fd-look-accent-dark-text);
    --fd-focus: var(--fd-look-accent-dark);
  }
}
:is(.fd-form, .fd-form-dialog):is([data-fd-skin="outlined"], [data-fd-skin="quiet"])[data-accent] { --fd-focus-ring: 0 0 0 2px color-mix(in srgb, var(--fd-accent) 22%, transparent); }
}
`;
