import { THEME_TOKENS } from '../../../widgets/src/lib/themes';
import { CODE_COLOURS, CODE_COLOURS_CSS } from './palette';

/** WCAG's relative luminance of #rrggbb. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const s = parseInt(hex.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Every surface a code box is drawn on, by scheme: Fieldia's own (both skins share it) and each theme's. */
const SURFACES = {
  light: ['#ffffff', ...Object.values(THEME_TOKENS).map((theme) => theme.light.surface as string)],
  dark: ['#1f2329', ...Object.values(THEME_TOKENS).map((theme) => (theme.dark.surface ?? theme.light.surface) as string)],
};

describe('the colours code is drawn in', () => {
  it.each(['light', 'dark'] as const)('read at 4.5:1 or more on every %s surface', (scheme) => {
    const low: string[] = [];
    for (const [role, colour] of Object.entries(CODE_COLOURS[scheme])) {
      for (const surface of SURFACES[scheme]) {
        const ratio = contrast(colour, surface);
        if (ratio < 4.5) low.push(`${role} ${colour} on ${surface}: ${ratio.toFixed(2)}`);
      }
    }
    expect(low).toEqual([]);
  });

  it('tell a keyword from the words round it: each colour stands apart from the text of its scheme', () => {
    // Fieldia's text, light and dark: a keyword in a colour this close to it would read as plain text.
    for (const [scheme, text] of [['light', '#212529'], ['dark', '#e8eaed']] as const) {
      for (const colour of Object.values(CODE_COLOURS[scheme])) expect(colour).not.toBe(text);
      expect(Math.abs(luminance(CODE_COLOURS[scheme].keyword) - luminance(text))).toBeGreaterThan(0.05);
    }
  });

  it('draw a key, a string and a number in colours of different families, so JSON reads at a glance', () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b);
      const d = max - Math.min(r, g, b);
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    const apart = (a: string, b: string) => Math.min(Math.abs(hue(a) - hue(b)), 360 - Math.abs(hue(a) - hue(b)));
    for (const scheme of ['light', 'dark'] as const) {
      const { property, string, literal } = CODE_COLOURS[scheme];
      for (const [x, y] of [[property, string], [property, literal], [string, literal]]) expect([scheme, x, y, apart(x, y) >= 40]).toEqual([scheme, x, y, true]);
    }
  });

  it('are tokens a host can set, light on any code box and dark where the page is dark', () => {
    expect(CODE_COLOURS_CSS).toContain('@layer fieldia-tokens');
    expect(CODE_COLOURS_CSS).toContain(`.fd-code { --fd-code-keyword: ${CODE_COLOURS.light.keyword};`);
    expect(CODE_COLOURS_CSS).toContain(`[data-scheme="dark"] .fd-code { --fd-code-keyword: ${CODE_COLOURS.dark.keyword};`);
    expect(CODE_COLOURS_CSS).toMatch(/@media \(prefers-color-scheme: dark\) \{ [^{]*\[data-scheme="auto"\] \.fd-code \{ --fd-code-keyword: #ff7b72;/);
  });
});
