import { THEMES } from '@fieldia/core';
import { FIELDIA_CSS } from './styles';
import { PARTS_CSS } from './styles-parts';
import { THEME_RULES_CSS, THEME_TOKENS, THEME_TOKENS_CSS, type ThemeTokens } from './styles-themes';

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
    const pairs: [string, keyof ThemeTokens, keyof ThemeTokens][] = [
      ['words on a card', 'text', 'surface'],
      ['words on the page', 'text', 'page'],
      ['quiet words on a card', 'muted', 'surface'],
      ['the accent as words on a card', 'accent', 'surface'],
      ['words on the accent', 'accent-text', 'accent'],
      ['an error on a card', 'error', 'surface'],
    ];
    const low = pairs
      .map(([what, fore, ground]) => ({ what, ratio: Math.round(contrast(t[fore] as string, t[ground] as string) * 100) / 100 }))
      .filter((p) => p.ratio < 4.5);
    expect(low).toEqual([]);
  });

  it('come after the skins and before the page’s own look, their shapes before the page’s looks for each kind of part', () => {
    const at = (text: string) => FIELDIA_CSS.indexOf(text);
    expect(at(THEME_TOKENS_CSS)).toBeGreaterThan(at('.fd-form[data-fd-skin="outlined"], .fd-theme[data-fd-skin="outlined"]'));
    expect(at(THEME_TOKENS_CSS)).toBeLessThan(at(':is(.fd-form, .fd-form-dialog)[data-accent] {'));
    expect(at(THEME_RULES_CSS)).toBeGreaterThan(at('.fd-button-primary {'));
    expect(at(THEME_RULES_CSS)).toBeLessThan(at(PARTS_CSS));
  });
});
