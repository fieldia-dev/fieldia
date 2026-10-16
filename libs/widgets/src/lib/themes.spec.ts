import { THEMES } from '@fieldia/core';
import { LOOK_TOKENS_CSS } from './look-styles';
import { FIELDIA_CSS, installStyles } from './styles';
import { PARTS_CSS } from './styles-parts';
import { installQuietStyles } from './styles-quiet';
import { installThemeStyles, THEME_RULES_CSS, THEME_TOKENS, THEME_TOKENS_CSS, THEMES_CSS, type ThemeTokens } from './themes';

/** A colour as [r, g, b, a], from #rrggbb or rgb(a)(). */
function parse(colour: string): [number, number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as [number, number, number, number];
  const fn = /^rgba?\(([^)]+)\)$/.exec(colour);
  if (!fn) throw new Error(`not a colour: ${colour}`);
  const [r, g, b, a = 1] = fn[1].split(',').map((n) => Number(n.trim()));
  return [r, g, b, a];
}
/** A colour laid over an opaque ground, as the browser paints it. */
const over = (colour: string, ground: string) => {
  const [r, g, b, a] = parse(colour);
  const [R, G, B] = parse(ground);
  return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
};
const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG's contrast of words in `fore` on `ground`. */
function contrast(fore: string, ground: string): number {
  const ground3 = over(ground, '#ffffff');
  const groundHex = `#${ground3.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
  const [a, b] = [luminance(over(fore, groundHex)), luminance(ground3)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

describe('the themes', () => {
  it('are one for each theme the format names, with light and dark tokens', () => {
    expect(Object.keys(THEME_TOKENS).sort()).toEqual([...THEMES].sort());
    for (const theme of THEMES) {
      expect(THEME_TOKENS_CSS).toContain(`[data-fd-theme="${theme}"]`);
      expect(THEME_TOKENS_CSS).toContain(`[data-fd-theme="${theme}"][data-scheme="dark"]`);
    }
  });

  // Every pair a reader reads: words on the card and the page, quiet words, the accent as words (a link, the picked
  // tab) and words on it (a primary button), and an error — WCAG 2.2 AA, 4.5:1, in light and in dark.
  it.each(THEMES.flatMap((theme) => (['light', 'dark'] as const).map((scheme) => [theme, scheme] as const)))('%s, %s: every word reads at 4.5:1 or more', (theme, scheme) => {
    const t: ThemeTokens = scheme === 'light' ? THEME_TOKENS[theme].light : { ...THEME_TOKENS[theme].light, ...THEME_TOKENS[theme].dark };
    // A read-only box in the outlined skin: a 4% shade over the card (styles.ts), as the browser paints it.
    const shaded = over('rgba(0, 0, 0, 0.04)', t.surface as string).map((c) => Math.round(c).toString(16).padStart(2, '0'));
    const colours: Record<string, string> = { ...(t as Record<string, string>), readonly: `#${shaded.join('')}` };
    const pairs: [string, string, string][] = [
      ['words on a card', 'text', 'surface'],
      ['words on the page', 'text', 'page'],
      ['quiet words on a card', 'muted', 'surface'],
      ['quiet words on the page', 'muted', 'page'],
      ['quiet words in a read-only box', 'muted', 'readonly'],
      ['the accent as words on a card', 'accent', 'surface'],
      ['words on the accent', 'accent-text', 'accent'],
      ['an error on a card', 'error', 'surface'],
    ];
    const low = pairs
      .map(([what, fore, ground]) => ({ what, ratio: Math.round(contrast(colours[fore], colours[ground]) * 100) / 100 }))
      .filter((p) => p.ratio < 4.5);
    expect(low).toEqual([]);
  });

  // In a sheet of their own, a part loaded the first time a form wears a theme (themes-part.ts), put in after Fieldia's
  // own and before the quiet look's, every other part's and the page's own looks (PART_RANK.themes).
  it('come after the skins and before the page’s own look, their shapes before the page’s looks for each kind of part', () => {
    // Their tokens after the skins', in Fieldia's tokens' layer: after Fieldia's own sheet, whose skins' tokens are there.
    expect(THEME_TOKENS_CSS.startsWith('@layer fieldia-tokens {')).toBe(true);
    expect(LOOK_TOKENS_CSS.trim().startsWith('@layer fieldia-tokens {')).toBe(true);
    const at = (text: string) => FIELDIA_CSS.indexOf(text);
    expect(at(':is(.fd-form, .fd-theme):is([data-fd-skin="outlined"], [data-fd-skin="quiet"]) {')).toBeGreaterThan(-1);
    expect(at(LOOK_TOKENS_CSS)).toBeGreaterThan(at(':is(.fd-form, .fd-theme):is([data-fd-skin="outlined"], [data-fd-skin="quiet"]) {'));
    // Before the page's own look's tokens, which win over them at the same weight: those come again after theirs.
    expect(THEMES_CSS).toBe(THEME_TOKENS_CSS + LOOK_TOKENS_CSS + THEME_RULES_CSS);
    expect(LOOK_TOKENS_CSS).toContain(':is(.fd-form, .fd-form-dialog)[data-accent] {');
    // Their shapes after the parts they reshape (Fieldia's own sheet), before the page's looks for each kind of part.
    document.head.replaceChildren();
    installStyles(document);
    installQuietStyles(document);
    installThemeStyles(document);
    installThemeStyles(document);
    expect([...document.head.querySelectorAll('style')].map((style) => style.id)).toEqual(['fieldia-styles', 'fieldia-theme-styles', 'fieldia-quiet-styles', 'fieldia-styles-looks']);
    expect(document.getElementById('fieldia-styles')?.textContent).toContain('.fd-button-primary {');
    expect(document.getElementById('fieldia-styles-looks')?.textContent).toContain(PARTS_CSS);
    expect(document.getElementById('fieldia-theme-styles')?.textContent).toBe(THEMES_CSS);
    // Nothing of them left in Fieldia's own.
    expect(at('[data-fd-theme')).toBe(-1);
    document.head.replaceChildren();
  });
});
