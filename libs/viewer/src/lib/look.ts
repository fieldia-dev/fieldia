import type { PageLook, PartLook } from '@fieldia/core';

/**
 * The page's look, worn by the form: what the page says about its accent,
 * font, room, corners, labels and colour scheme becomes attributes and tokens
 * on the form's root, and the stylesheet turns them into the form's own
 * colours and sizes — so every widget follows, in either skin, light or dark.
 * A look for a kind of part (text boxes, choices, groups, buttons, tables)
 * becomes tokens of that kind, worn by it alone. A page with no look is left
 * exactly as its skin draws it.
 */

/** Words written on a light accent, and on the dark page's accent. */
const INK = '#111418';
/** The dark scheme's surface, which the dark page's accent has to read on. */
const DARK_SURFACE = '#1f2329';
/** The darkest ground of a light page (the underline skin's), which the light page's accent has to read on. */
const LIGHT_GROUND = '#f2f3f5';
/** WCAG's contrast for normal text (1.4.3, AA): the accent is words on the page, and has words on it. */
const READABLE = 4.5;

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
const textOn = (hex: string) => (contrast(hex, '#ffffff') >= READABLE ? '#ffffff' : INK);
/** On a dark page the accent is light: whichever of ink or white reads better on it. */
const textOnDark = (hex: string) => (contrast(hex, INK) >= contrast(hex, '#ffffff') ? INK : '#ffffff');

/** A colour taken towards another by `amount` (0 to 1). */
const towards = (hex: string, to: string, amount: number) => toHex(channels(hex).map((c, i) => c + (channels(to)[i] - c) * amount));
/** The accent's softer shade on a surface, as the stylesheet mixes it: 12% of the accent. */
const softOn = (hex: string, surface: string) => towards(surface, hex, 0.12);
/** Reads as words on a surface, on the lightest ground there, and on its own softer shade (a picked tab, a chip). */
const readsOn = (hex: string, grounds: string[]) => [...grounds, softOn(hex, grounds[0])].every((ground) => contrast(hex, ground) >= READABLE);
/** A colour moved towards `to` in small steps, only as far as it has to be, until it `reads`; at worst it is `to`. */
function moved(hex: string, to: string, reads: (colour: string) => boolean): string {
  let colour = hex;
  for (let step = 1; step <= 40 && !reads(colour); step++) colour = towards(hex, to, step / 40);
  return colour;
}

export interface AccentShades {
  /** The accent on a light page: as the page gives it, or darkened, when it has to be, until it reads there. */
  accent: string;
  /** What is written on it: a primary button's words. */
  accentText: string;
  /** The accent on a dark page: lightened, when it has to be, until it reads there. */
  dark: string;
  darkText: string;
}

/**
 * The accent, and what goes with it in either scheme. Each is moved, in small
 * steps and only as far as it has to be, until words in it and on it read at
 * 4.5:1 — darker on a light page, lighter on a dark one — on the page and on
 * any `grounds` of its parts. The softer and hover shades are mixed from these
 * by the stylesheet.
 */
export function accentShades(hex: string, grounds: { light: string[]; dark: string[] } = { light: [], dark: [] }): AccentShades {
  const given = hex.toLowerCase();
  const accent = moved(given, '#000000', (colour) => readsOn(colour, ['#ffffff', LIGHT_GROUND, ...grounds.light]));
  const dark = moved(given, '#ffffff', (colour) => readsOn(colour, [DARK_SURFACE, ...grounds.dark]));
  return { accent, accentText: textOn(accent), dark, darkText: textOnDark(dark) };
}

/** Each scheme's words that every ground of a part must keep readable: its text, muted words and errors. */
const LIGHT_WORDS = ['#212529', '#636976', '#c63c3d'];
const DARK_WORDS = ['#e8eaed', '#a3a9b2', '#ff8a7a'];
/** The skins' own accent where the page names none: outlined's, the lighter of the two, which has the most to read on. */
const SKIN_ACCENT = { accent: '#1365d9', dark: '#5aa2ff' };
/** What a part's settings are called on the form, `data-inputs="bg radius"`, and in its tokens, `--fd-inputs-bg`. */
const NAMES: Record<keyof PartLook, string> = { background: 'bg', border: 'border', corners: 'radius', textSize: 'size', accent: 'accent' };
const SIZES = { small: '13px', large: '16px' };
/** The corners of a box, and of a group, in pixels: the page's own (`data-corners`) for each. */
const RADII = { square: [0, 0], soft: [6, 10], round: [12, 16] };

/**
 * A look for each kind of part, as its own tokens on the form, each worked out
 * for the page's scheme (both, for auto, as `light-dark()`): a ground moved
 * until the page's words and accent read on it — lighter on a light page,
 * towards the dark surface on a dark one; an accent moved until words in it
 * and on it read, on the page and on every ground given; an edge as given.
 */
function applyParts(root: HTMLElement, look: PageLook): void {
  const wear = (light: string, dark: string) => (look.scheme === 'dark' ? dark : look.scheme === 'auto' ? `light-dark(${light}, ${dark})` : light);
  const page = look.accent ? accentShades(look.accent) : SKIN_ACCENT;
  const parts = Object.entries(look.parts ?? {}) as [string, PartLook][];
  const set = (kind: string, name: string, value: string) => root.style.setProperty(`--fd-${kind}-${name}`, value);
  // The grounds first: every accent has to read on each of them.
  const grounds = { light: [] as string[], dark: [] as string[] };
  const readsAll = (words: string[]) => (colour: string) => words.every((word) => contrast(word, colour) >= READABLE);
  for (const [kind, part] of parts) {
    const given = part.background?.toLowerCase();
    if (!given) continue;
    const light = moved(given, '#ffffff', readsAll([...LIGHT_WORDS, page.accent]));
    const dark = moved(given, DARK_SURFACE, readsAll([...DARK_WORDS, page.dark]));
    grounds.light.push(light);
    grounds.dark.push(dark);
    set(kind, 'bg', wear(light, dark));
  }
  for (const [kind, part] of parts) {
    const names = (Object.keys(NAMES) as (keyof PartLook)[]).filter((name) => part[name]).map((name) => NAMES[name]);
    if (names.length) root.setAttribute(`data-${kind}`, names.join(' '));
    if (part.border) set(kind, 'border', part.border);
    if (part.corners) set(kind, 'radius', `${RADII[part.corners][kind === 'groups' ? 1 : 0]}px`);
    if (part.textSize) set(kind, 'size', SIZES[part.textSize]);
    if (part.accent) {
      const shades = accentShades(part.accent, grounds);
      set(kind, 'accent', wear(shades.accent, shades.dark));
      set(kind, 'accent-text', wear(shades.accentText, shades.darkText));
    }
  }
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
  applyParts(root, look);
}
