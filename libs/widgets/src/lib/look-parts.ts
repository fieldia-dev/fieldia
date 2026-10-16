import type { Theme } from '@fieldia/core';
import { lazyPart, type Part } from './parts';
import type * as QuietModule from './quiet-part';
import type * as ThemesModule from './themes-part';

/** The themes part: the eight themes' tokens, light and dark, and their own shapes, as one sheet. */
export type ThemesPart = typeof ThemesModule;
/** The quiet look's part: its sheet. */
export type QuietPart = typeof QuietModule;

/** The themes, loaded the first time a form wears one. */
export const themesPart: Part<ThemesPart> = lazyPart('themes', () => import('./themes-part'));
/** The quiet look, loaded the first time a page wears it: its skin, or a group or a field that asks for it. */
export const quietPart: Part<QuietPart> = lazyPart('quiet', () => import('./quiet-part'));

/** The theme each element was asked to wear last: what the themes part puts on as it comes, if it is still that. */
const asked = new WeakMap<Element, Theme | null>();

/**
 * Wear a theme — on a form, a dialog, anything with Fieldia's tokens (`data-fd-theme`) — or none. At once when the
 * themes part has come. Else with no theme meanwhile, never a theme's name over the skin's own tokens, and on as the
 * part comes, unless another theme, or none, was asked for since. Its sheet is in the element's document before the
 * element wears it, so what watches the attribute (a code editor's colours) reads the theme's own tokens.
 */
export function wearTheme(element: HTMLElement, theme: Theme | null | undefined): void {
  const wanted = theme ?? null;
  asked.set(element, wanted);
  const part = themesPart.loaded;
  if (wanted && part) {
    part.installThemeStyles(element.ownerDocument);
    element.setAttribute('data-fd-theme', wanted);
    return;
  }
  element.removeAttribute('data-fd-theme');
  if (!wanted) return;
  themesPart.load().then(
    (module) => {
      if (asked.get(element) !== wanted) return;
      module.installThemeStyles(element.ownerDocument);
      element.setAttribute('data-fd-theme', wanted);
    },
    // It could not come: the form stays in its skin's own look, whole.
    () => undefined
  );
}

/**
 * The quiet look's sheet in a document, as a field is drawn in a quiet place: at once when its part has come, else as
 * it comes. Meanwhile the field is drawn boxed — the outlined skin's boxes, which the quiet one is drawn on — its value
 * shown and typed in as in any box.
 */
export function wearQuiet(doc: Document): void {
  const part = quietPart.loaded;
  if (part) part.installQuietStyles(doc);
  else quietPart.load().then((module) => module.installQuietStyles(doc), () => undefined);
}
