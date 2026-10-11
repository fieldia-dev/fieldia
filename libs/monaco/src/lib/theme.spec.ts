import { THEME_TOKENS } from '../../../widgets/src/lib/themes';
import { CODE_COLOURS as CODEMIRROR_COLOURS } from '../../../code/src/lib/palette';
import { CODE_COLOURS, hexOf, monacoTheme, type FieldiaColours } from './theme';

const LIGHT: FieldiaColours = {
  text: '#212529', muted: '#636976', surface: '#ffffff', page: '#f2f3f5', border: '#cfd4da', accent: '#002855', focus: '#002855', error: '#c62828',
  ...CODE_COLOURS.light,
};
const DARK: FieldiaColours = {
  text: '#e8eaed', muted: '#a3a9b2', surface: '#1f2329', page: '#16191e', border: '#3a4048', accent: '#5aa2ff', focus: '#5aa2ff', error: '#ff8a7a',
  ...CODE_COLOURS.dark,
};
const rule = (theme: ReturnType<typeof monacoTheme>, token: string) => theme.rules.find((r) => r.token === token);

describe('a colour as the browser computes it, as Monaco takes it', () => {
  it.each([
    ['#0a3069', '#0a3069'],
    ['#ABC', '#aabbcc'],
    ['rgb(10, 48, 105)', '#0a3069'],
    ['rgba(0, 0, 0, 0.88)', '#000000e0'],
    ['rgb(90 162 255 / 0.16)', '#5aa2ff29'],
    ['color(srgb 0.5 0 1)', '#8000ff'],
    ['color(srgb 0.5 0 1 / 0.5)', '#8000ff80'],
    ['rgba(0, 0, 0, 0)', '#00000000'],
  ])('%s is %s', (css, hex) => expect(hexOf(css)).toBe(hex));

  it('is nothing for what is not a colour', () => {
    expect(hexOf('')).toBeNull();
    expect(hexOf('var(--fd-text)')).toBeNull();
    expect(hexOf('oklch(0.5 0.1 200)')).toBeNull();
  });
});

describe('Monaco’s theme from Fieldia’s tokens', () => {
  it('draws the editor on the surface in the page’s words, its gutter on the page, line numbers quiet', () => {
    const theme = monacoTheme(LIGHT);
    expect(theme.base).toBe('vs');
    expect(theme.inherit).toBe(true);
    expect(theme.colors['editor.background']).toBe('#ffffff');
    expect(theme.colors['editor.foreground']).toBe('#212529');
    expect(theme.colors['editorGutter.background']).toBe('#f2f3f5');
    expect(theme.colors['editorLineNumber.foreground']).toBe('#636976');
    expect(theme.colors['editorCursor.foreground']).toBe('#212529');
    expect(theme.colors['focusBorder']).toBe('#002855');
    // Chosen text in the accent, see-through, so the words stay readable over it.
    expect(theme.colors['editor.selectionBackground']).toMatch(/^#002855[0-9a-f]{2}$/);
    // Found text's line too, rather than Monaco's own yellow.
    expect(theme.colors['editor.rangeHighlightBackground']).toMatch(/^#002855[0-9a-f]{2}$/);
  });

  it('is Monaco’s dark base on a dark surface', () => {
    const theme = monacoTheme(DARK);
    expect(theme.base).toBe('vs-dark');
    expect(theme.colors['editor.background']).toBe('#1f2329');
  });

  it('colours each kind of word Monaco’s tokenizers name in the code colours', () => {
    const theme = monacoTheme(LIGHT);
    expect(rule(theme, 'keyword')?.foreground).toBe(CODE_COLOURS.light.keyword.slice(1));
    expect(rule(theme, 'string')?.foreground).toBe(CODE_COLOURS.light.string.slice(1));
    expect(rule(theme, 'number')?.foreground).toBe(CODE_COLOURS.light.literal.slice(1));
    expect(rule(theme, 'type')?.foreground).toBe(CODE_COLOURS.light.type.slice(1));
    expect(rule(theme, 'tag')?.foreground).toBe(CODE_COLOURS.light.tag.slice(1));
    expect(rule(theme, 'attribute.name')?.foreground).toBe(CODE_COLOURS.light.property.slice(1));
    expect(rule(theme, 'string.key.json')?.foreground).toBe(CODE_COLOURS.light.property.slice(1));
    expect(rule(theme, 'comment')).toEqual({ token: 'comment', foreground: '636976', fontStyle: 'italic' });
    expect(rule(theme, 'invalid')?.foreground).toBe('c62828');
    // Monaco takes a rule's colour without its #.
    for (const r of theme.rules) if (r.foreground) expect(r.foreground).toMatch(/^[0-9a-f]{6}$/);
  });
});

describe('the code colours', () => {
  it('are @fieldia/code’s, so both editors colour code alike', () => {
    expect(CODE_COLOURS).toEqual(CODEMIRROR_COLOURS);
  });

  it.each(['light', 'dark'] as const)('read at 4.5:1 or more on every %s surface of every theme', (scheme) => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const s = parseInt(hex.slice(i, i + 2), 16) / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const surfaces = scheme === 'light' ? ['#ffffff', ...Object.values(THEME_TOKENS).map((t) => t.light.surface as string)] : ['#1f2329', ...Object.values(THEME_TOKENS).map((t) => (t.dark.surface ?? t.light.surface) as string)];
    const low = Object.entries(CODE_COLOURS[scheme]).flatMap(([role, colour]) => surfaces.filter((s) => contrast(colour, s) < 4.5).map((s) => `${role} on ${s}`));
    expect(low).toEqual([]);
  });
});

describe('the editor’s frame', () => {
  it('shades a read-only editor as Fieldia shades a box only to be read, over Monaco’s own colours', () => {
    const { MONACO_CSS } = jest.requireActual('./styles') as typeof import('./styles');
    expect(MONACO_CSS).toContain('.fd-monaco[data-readonly] .monaco-editor { --vscode-editor-background: color-mix(in srgb, var(--fd-text) 4%, var(--fd-surface));');
  });
});
