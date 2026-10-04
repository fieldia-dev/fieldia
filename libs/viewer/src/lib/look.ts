import type { PageLook } from '@fieldia/core';

/**
 * The page's look, worn by the form: what the page says about its accent,
 * font, room, corners, labels and colour scheme becomes attributes and tokens
 * on the form's root, and the stylesheet turns them into the form's own
 * colours and sizes — so every widget follows, in either skin, light or dark.
 * A page with no look is left exactly as its skin draws it.
 */

/** Words written on a light accent, and on the dark page's accent. */
const INK = '#111418';
/** The dark scheme's surface, which the dark page's accent has to read on. */
const DARK_SURFACE = '#1f2329';
/** WCAG's contrast for normal text. */
const READABLE = 4.5;
/** WCAG's floor for large words and for controls: a button's white words below it read poorly. */
const LEGIBLE = 3;

const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

/** How bright a colour looks, as WCAG measures it: 0 for black, 1 for white. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** How well one colour reads on another: 1 (not at all) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** White on a colour, as buttons are usually written; ink where white would read poorly. */
const textOn = (hex: string) => (contrast(hex, '#ffffff') >= LEGIBLE ? '#ffffff' : INK);
/** On a dark page the accent is light: whichever of ink or white reads better on it. */
const textOnDark = (hex: string) => (contrast(hex, INK) >= contrast(hex, '#ffffff') ? INK : '#ffffff');

/** A colour taken towards white by `amount` (0 to 1). */
const lighten = (hex: string, amount: number) => toHex(channels(hex).map((c) => c + (255 - c) * amount));

export interface AccentShades {
  /** The accent as the page gives it. */
  accent: string;
  /** What is written on it: a primary button's words. */
  accentText: string;
  /** The accent on a dark page: lightened, when it has to be, until it reads there. */
  dark: string;
  darkText: string;
}

/** The accent, and what goes with it in either scheme. The softer and hover shades are mixed from these by the stylesheet. */
export function accentShades(hex: string): AccentShades {
  const accent = hex.toLowerCase();
  let dark = accent;
  for (let step = 1; step <= 20 && contrast(dark, DARK_SURFACE) < READABLE; step++) dark = lighten(accent, step / 20);
  return { accent, accentText: textOn(accent), dark, darkText: textOnDark(dark) };
}

/** Put the page's look on the form's root. */
export function applyLook(root: HTMLElement, look: PageLook | undefined): void {
  if (!look) return;
  for (const name of ['font', 'density', 'corners', 'scheme'] as const) {
    const value = look[name];
    if (value) root.setAttribute(`data-${name}`, value);
  }
  if (look.labelWidth) root.style.setProperty('--fd-label-width', `${look.labelWidth}px`);
  if (look.accent) {
    const shades = accentShades(look.accent);
    root.setAttribute('data-accent', '');
    root.style.setProperty('--fd-look-accent', shades.accent);
    root.style.setProperty('--fd-look-accent-text', shades.accentText);
    root.style.setProperty('--fd-look-accent-dark', shades.dark);
    root.style.setProperty('--fd-look-accent-dark-text', shades.darkText);
  }
}
