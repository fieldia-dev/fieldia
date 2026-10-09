import type { Theme } from '@fieldia/core';

/**
 * Themes in the style of design systems people know: the form's own tokens,
 * light and dark, over the skin each is drawn on (Odoo's over `underline`,
 * the rest over `outlined`), and a few rules of their own for what tokens
 * cannot say — Material's filled boxes, Apple's pill buttons, Google Forms'
 * question cards. They are looks in those systems' style, not their kits: a
 * theme names its typeface and falls back to the system's when the app has
 * not loaded it. Every colour pair a reader reads is checked against WCAG AA
 * (styles-themes.spec.ts), so a few are a shade darker than the original.
 */

/** The tokens a theme sets, by their names without `--fd-`. */
export type ThemeTokens = Partial<Record<'font' | 'text' | 'muted' | 'page' | 'surface' | 'border' | 'border-strong' | 'accent' | 'accent-text' | 'accent-soft' | 'focus' | 'focus-ring' | 'error' | 'error-soft' | 'success' | 'warning' | 'info' | 'radius' | 'control-radius' | 'control-height' | 'pad-y' | 'pad-x' | 'input-border' | 'label-weight' | 'gap-x' | 'gap-y' | 'fill' | 'edge', string>>;

const SYSTEM = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", sans-serif';

export const THEME_TOKENS: Record<Theme, { light: ThemeTokens; dark: ThemeTokens }> = {
  // Material 3's baseline: a purple primary, filled boxes on a tinted surface, pill buttons.
  material: {
    light: {
      font: `Roboto, ${SYSTEM}`, text: '#1d1b20', muted: '#49454f', page: '#fef7ff', surface: '#ffffff', border: '#79747e', 'border-strong': '#49454f',
      accent: '#6750a4', 'accent-text': '#ffffff', 'accent-soft': '#eaddff', focus: '#6750a4', 'focus-ring': 'none', error: '#b3261e', 'error-soft': '#f9dedc',
      radius: '12px', 'control-radius': '4px', 'control-height': '48px', 'pad-y': '10px', 'pad-x': '16px', 'input-border': '0 0 1px 0', 'label-weight': '500', 'gap-x': '24px', 'gap-y': '20px', fill: '#ece6f0',
    },
    dark: {
      text: '#e6e0e9', muted: '#cac4d0', page: '#141218', surface: '#1d1b20', border: '#938f99', 'border-strong': '#cac4d0',
      accent: '#d0bcff', 'accent-text': '#381e72', 'accent-soft': '#4f378b', focus: '#d0bcff', error: '#f2b8b5', 'error-soft': '#601410', fill: '#36343b', edge: '#938f99',
    },
  },
  // Fluent 2 for the web: Segoe, a darker bottom edge on boxes, a semibold primary button.
  fluent: {
    light: {
      font: `"Segoe UI Variable Text", "Segoe UI", ${SYSTEM}`, text: '#242424', muted: '#616161', page: '#f5f5f5', surface: '#ffffff', border: '#d1d1d1', 'border-strong': '#616161',
      accent: '#0f6cbd', 'accent-text': '#ffffff', 'accent-soft': '#ebf3fc', focus: '#0f6cbd', 'focus-ring': 'none', error: '#c50f1f', 'error-soft': '#fdf3f4',
      radius: '8px', 'control-radius': '4px', 'control-height': '32px', 'pad-y': '5px', 'pad-x': '10px', 'input-border': '1px', 'label-weight': '400', 'gap-x': '24px', 'gap-y': '16px',
    },
    dark: {
      text: '#ffffff', muted: '#d6d6d6', page: '#1f1f1f', surface: '#292929', border: '#666666', 'border-strong': '#adadad',
      accent: '#479ef5', 'accent-text': '#0a0a0a', 'accent-soft': '#0e4775', focus: '#479ef5', error: '#e37d80', 'error-soft': '#3b1012', edge: '#adadad',
    },
  },
  // Apple's: grouped white cards on a pale grey, filled boxes without a frame, pill buttons, its blue.
  apple: {
    light: {
      font: `-apple-system, BlinkMacSystemFont, "SF Pro Text", ${SYSTEM}`, text: '#1d1d1f', muted: '#6e6e73', page: '#f2f2f7', surface: '#ffffff', border: '#d1d1d6', 'border-strong': '#8e8e93',
      accent: '#0066cc', 'accent-text': '#ffffff', 'accent-soft': '#e5f0fb', focus: '#0066cc', 'focus-ring': '0 0 0 4px rgba(0, 113, 227, 0.25)', error: '#d70015', 'error-soft': '#ffebec',
      radius: '12px', 'control-radius': '10px', 'control-height': '40px', 'pad-y': '8px', 'pad-x': '12px', 'input-border': '1px', 'label-weight': '500', 'gap-x': '20px', 'gap-y': '16px', fill: '#f2f2f7',
    },
    dark: {
      text: '#f5f5f7', muted: '#a1a1a6', page: '#000000', surface: '#1c1c1e', border: '#38383a', 'border-strong': '#636366',
      accent: '#409cff', 'accent-text': '#000000', 'accent-soft': '#0f2b4d', focus: '#409cff', 'focus-ring': '0 0 0 4px rgba(64, 156, 255, 0.3)', error: '#ff6961', 'error-soft': '#3a1412', fill: '#2c2c2e', edge: '#636366',
    },
  },
  // Bootstrap 5: its blue, a soft blue ring on focus, six-pixel corners.
  bootstrap: {
    light: {
      font: SYSTEM, text: '#212529', muted: '#6c757d', page: '#f8f9fa', surface: '#ffffff', border: '#dee2e6', 'border-strong': '#adb5bd',
      accent: '#0a58ca', 'accent-text': '#ffffff', 'accent-soft': '#cfe2ff', focus: '#86b7fe', 'focus-ring': '0 0 0 0.25rem rgba(13, 110, 253, 0.25)', error: '#b02a37', 'error-soft': '#f8d7da',
      radius: '6px', 'control-radius': '6px', 'control-height': '38px', 'pad-y': '6px', 'pad-x': '12px', 'input-border': '1px', 'label-weight': '400', 'gap-x': '24px', 'gap-y': '16px',
    },
    dark: {
      text: '#dee2e6', muted: '#adb5bd', page: '#212529', surface: '#2b3035', border: '#495057', 'border-strong': '#6c757d',
      accent: '#6ea8fe', 'accent-text': '#000000', 'accent-soft': '#031633', focus: '#6ea8fe', 'focus-ring': '0 0 0 0.25rem rgba(110, 168, 254, 0.25)', error: '#ea868f', 'error-soft': '#2c0b0e', edge: '#6c757d',
    },
  },
  // shadcn/ui on zinc: near-black primary, quiet borders, a grey ring, segmented tabs.
  shadcn: {
    light: {
      font: `Geist, Inter, ${SYSTEM}`, text: '#09090b', muted: '#71717a', page: '#fafafa', surface: '#ffffff', border: '#e4e4e7', 'border-strong': '#a1a1aa',
      accent: '#18181b', 'accent-text': '#fafafa', 'accent-soft': '#f4f4f5', focus: '#a1a1aa', 'focus-ring': '0 0 0 3px rgba(161, 161, 170, 0.5)', error: '#dc2626', 'error-soft': '#fef2f2',
      radius: '10px', 'control-radius': '8px', 'control-height': '36px', 'pad-y': '6px', 'pad-x': '12px', 'input-border': '1px', 'label-weight': '500', 'gap-x': '24px', 'gap-y': '16px',
    },
    dark: {
      text: '#fafafa', muted: '#a1a1aa', page: '#09090b', surface: '#18181b', border: '#3f3f46', 'border-strong': '#71717a',
      accent: '#e4e4e7', 'accent-text': '#18181b', 'accent-soft': '#27272a', focus: '#71717a', 'focus-ring': '0 0 0 3px rgba(113, 113, 122, 0.5)', error: '#f87171', 'error-soft': '#450a0a', edge: '#71717a',
    },
  },
  // Ant Design 5: the outlined skin's own tokens, and its dark algorithm.
  ant: {
    light: {
      font: SYSTEM, text: 'rgba(0, 0, 0, 0.88)', muted: 'rgba(0, 0, 0, 0.55)', page: '#f5f5f5', surface: '#ffffff', border: '#d9d9d9', 'border-strong': '#bfbfbf',
      accent: '#1365d9', 'accent-text': '#ffffff', 'accent-soft': '#e6f4ff', focus: '#1365d9', 'focus-ring': '0 0 0 2px rgba(5, 145, 255, 0.12)', error: '#c63c3d', 'error-soft': '#fff2f0',
      radius: '8px', 'control-radius': '6px', 'pad-y': '4px', 'pad-x': '11px', 'input-border': '1px', 'label-weight': '400', 'gap-x': '24px', 'gap-y': '18px',
    },
    dark: {
      text: 'rgba(255, 255, 255, 0.85)', muted: 'rgba(255, 255, 255, 0.6)', page: '#000000', surface: '#141414', border: '#424242', 'border-strong': '#595959',
      accent: '#3c89e8', 'accent-text': '#000000', 'accent-soft': '#111a2c', focus: '#3c89e8', 'focus-ring': '0 0 0 2px rgba(60, 137, 232, 0.2)', error: '#e86e6b', 'error-soft': '#2c1618', edge: '#595959',
    },
  },
  // Odoo 17: labels beside underlined boxes, its plum for buttons and the picked tab.
  odoo: {
    light: {
      font: SYSTEM, text: '#1f2937', muted: '#4b5563', page: '#f9fafb', surface: '#ffffff', border: '#d1d5db', 'border-strong': '#9ca3af',
      accent: '#714b67', 'accent-text': '#ffffff', 'accent-soft': '#f3edf2', focus: '#714b67', 'focus-ring': 'none', error: '#c4161c', 'error-soft': '#fdecec',
      radius: '4px', 'control-radius': '0px', 'pad-y': '3px', 'pad-x': '4px', 'input-border': '0 0 1px 0', 'label-weight': '600', 'gap-x': '32px', 'gap-y': '14px',
    },
    dark: {
      text: '#e5e7eb', muted: '#9ca3af', page: '#111827', surface: '#1f2937', border: '#4b5563', 'border-strong': '#6b7280',
      accent: '#c79fbc', 'accent-text': '#1f1020', 'accent-soft': '#3b2836', focus: '#c79fbc', error: '#f6878b', 'error-soft': '#3a1214', edge: '#6b7280',
    },
  },
  // Google Forms: each question a white card on a tinted page, a purple band over the title, underlined answers.
  'google-forms': {
    light: {
      font: `Roboto, Arial, ${SYSTEM}`, text: '#202124', muted: '#5f6368', page: '#f0ebf8', surface: '#ffffff', border: '#dadce0', 'border-strong': '#80868b',
      accent: '#673ab7', 'accent-text': '#ffffff', 'accent-soft': '#ede7f6', focus: '#673ab7', 'focus-ring': 'none', error: '#d93025', 'error-soft': '#fce8e6',
      radius: '8px', 'control-radius': '0px', 'control-height': '36px', 'pad-y': '6px', 'pad-x': '0px', 'input-border': '0 0 1px 0', 'label-weight': '400', 'gap-x': '24px', 'gap-y': '12px',
    },
    dark: {
      text: '#e8e3ee', muted: '#b8b0c4', page: '#1c1822', surface: '#2a2431', border: '#4a4255', 'border-strong': '#7b7088',
      accent: '#c4abf2', 'accent-text': '#1d1528', 'accent-soft': '#3b2f52', focus: '#c4abf2', error: '#f28b82', 'error-soft': '#3c1714', edge: '#7b7088',
    },
  },
};

const block = (tokens: ThemeTokens) =>
  Object.entries(tokens)
    .map(([name, value]) => `--fd-${name}: ${value};`)
    .join(' ');
const forms = (theme: Theme) => `:is(.fd-form, .fd-form-dialog, .fd-theme)[data-fd-theme="${theme}"]`;
/** A group drawn as a card on the page's ground, as the outlined skin draws one: on the page, or set as a card. */
const CARDS = ':is(.fd-sections > .fd-section:not([data-style]), .fd-section[data-style="card"][data-on-page])';

/**
 * The themes' tokens: after the skins' (they win over them), before the page's
 * look (whose accent, room, corners and scheme win over them). A theme's dark
 * tokens are more specific than the plain dark scheme's, so they win over it.
 */
export const THEME_TOKENS_CSS = (Object.keys(THEME_TOKENS) as Theme[])
  .map((theme) => {
    const { light, dark } = THEME_TOKENS[theme];
    const darkOn = `${forms(theme)}[data-scheme="dark"]`;
    return `${forms(theme)} { ${block(light)} }
${darkOn} { color-scheme: dark; ${block(dark)} }
@media (prefers-color-scheme: dark) { ${forms(theme)}[data-scheme="auto"] { color-scheme: dark; ${block(dark)} } }`;
  })
  .join('\n');

/** What tokens cannot say: each theme's own shapes. After every other rule, so they win at the same weight. */
export const THEME_RULES_CSS = /* css */ `
/* A themed form paints its own ground, as one with a scheme does: Google Forms' lilac, Apple's grey. In a dialog, the dialog is its ground. */
.fd-form[data-fd-theme] { background: var(--fd-page); color: var(--fd-text); border-radius: var(--fd-radius); }
.fd-form[data-fd-theme] > .fd-content:not(:has(> .fd-sheet-page)) { padding: 20px; }
.fd-form-dialog-body > .fd-form[data-fd-theme] { background: none; border-radius: 0; }
.fd-form-dialog-body > .fd-form[data-fd-theme] > .fd-content:not(:has(> .fd-sheet-page)) { padding: 0; }
/* Material: boxes filled and underlined, the line thickening on focus; pill buttons; borderless tinted cards. */
${forms('material')} .fd-input:not([readonly]) { background: var(--fd-fill); border-start-start-radius: var(--fd-control-radius); border-start-end-radius: var(--fd-control-radius); border-end-start-radius: 0; border-end-end-radius: 0; }
${forms('material')} .fd-input:focus { box-shadow: inset 0 -1px 0 0 var(--fd-focus); }
${forms('material')} .fd-button { border-radius: 20px; min-height: 40px; padding-inline: 24px; font-weight: 500; letter-spacing: 0.01em; border-color: var(--fd-border); }
${forms('material')} .fd-tab[aria-selected="true"] { border-block-end-width: 3px; }
${forms('material')} ${CARDS} { border-color: transparent; background: color-mix(in srgb, var(--fd-accent) 4%, var(--fd-surface)); }

/* Fluent: a darker bottom edge under every box, an accent bar on focus; semibold buttons; the picked tab in words, not the accent. */
${forms('fluent')} .fd-input:not([readonly]) { border-block-end-color: var(--fd-border-strong); }
${forms('fluent')} .fd-input:focus { box-shadow: inset 0 -2px 0 0 var(--fd-focus); border-block-end-color: var(--fd-focus); }
${forms('fluent')} .fd-button { font-weight: 600; }
${forms('fluent')} .fd-tab[aria-selected="true"] { color: var(--fd-text); border-block-end-width: 3px; }

/* Apple: boxes filled, no frame until focused; pill buttons; grouped cards with no edge. */
${forms('apple')} .fd-input:not([readonly]) { background: var(--fd-fill); border-color: transparent; }
${forms('apple')} .fd-input:not([readonly]):focus { background: var(--fd-surface); border-color: var(--fd-focus); }
${forms('apple')} .fd-button { border-radius: 980px; padding-inline: 18px; font-weight: 500; }
${forms('apple')} ${CARDS} { border-color: transparent; }

/* Bootstrap: its buttons' weight and padding. */
${forms('bootstrap')} .fd-button { padding-inline: 12px; }

/* shadcn: a hairline shadow under boxes and buttons; the picked tab a raised segment on a grey strip. */
${forms('shadcn')} :is(.fd-input:not([readonly]), .fd-button:not(.fd-button-link)) { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
${forms('shadcn')} .fd-input:focus { box-shadow: var(--fd-focus-ring); }
${forms('shadcn')} .fd-button { font-weight: 500; }
${forms('shadcn')} .fd-button:hover { color: var(--fd-text); background: var(--fd-accent-soft); border-color: var(--fd-border); }
${forms('shadcn')} .fd-button-primary:hover { color: var(--fd-accent-text); background: var(--fd-accent); filter: brightness(1.25); }
${forms('shadcn')} .fd-tablist { gap: 2px; padding: 3px; border: 0; border-radius: var(--fd-radius); background: var(--fd-accent-soft); width: max-content; max-width: 100%; }
${forms('shadcn')} .fd-tab { border: 0; margin: 0; padding: 5px 12px; border-radius: calc(var(--fd-radius) - 3px); color: var(--fd-muted); }
${forms('shadcn')} .fd-tab[aria-selected="true"] { color: var(--fd-text); background: var(--fd-surface); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); font-weight: 500; }

/* Odoo: square buttons with small corners. */
${forms('odoo')} .fd-button { border-radius: 4px; }

/* Google Forms: the title a card with a band of the accent along its top; each question its own card; answers underlined. */
${forms('google-forms')} .fd-page-head { background: var(--fd-surface); border: 1px solid var(--fd-border); border-block-start: 10px solid var(--fd-accent); border-radius: var(--fd-radius); padding: 22px 24px; }
${forms('google-forms')} .fd-page-title { font-size: 32px; font-weight: 400; line-height: 1.2; }
${forms('google-forms')} ${CARDS} { background: none; border: 0; padding: 0; }
${forms('google-forms')} ${CARDS} > .fd-grid > .fd-field:not(.fd-oneline) { background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 22px 24px; }
${forms('google-forms')} ${CARDS} > .fd-grid > .fd-field:focus-within { border-inline-start: 6px solid var(--fd-accent); padding-inline-start: 19px; }
${forms('google-forms')} .fd-label { font-size: 16px; }
${forms('google-forms')} .fd-input:not([readonly]) { background: transparent; }
${forms('google-forms')} .fd-input:focus { box-shadow: inset 0 -1px 0 0 var(--fd-focus); }
${forms('google-forms')} .fd-button { border-radius: 4px; font-weight: 500; }
`;
