import type { MonacoThemeData } from './types';

/**
 * Monaco's theme, made from Fieldia's tokens as the page has them: the code
 * box on the form's surface, in its words, its gutter on the page, the chosen
 * text in its accent; the code itself in the same colours as @fieldia/code's
 * editor, light or dark with the page's scheme. Read again when the page's
 * look or scheme changes.
 */

/** The colours code is drawn in, by what a word is: @fieldia/code's (a spec holds the two together). */
export const CODE_COLOURS = {
  light: { keyword: '#cf222e', string: '#0a3069', literal: '#0550ae', function: '#6639ba', type: '#953800', tag: '#116329', property: '#0550ae' },
  dark: { keyword: '#ff7b72', string: '#a5d6ff', literal: '#79c0ff', function: '#d2a8ff', type: '#ffa657', tag: '#7ee787', property: '#79c0ff' },
} as const;

export type CodeRole = keyof (typeof CODE_COLOURS)['light'];
type PageRole = 'text' | 'muted' | 'surface' | 'page' | 'border' | 'accent' | 'focus' | 'error';
/** The colours a theme is made of, each #rrggbb or #rrggbbaa. */
export type FieldiaColours = Record<PageRole | CodeRole, string>;

/** Fieldia's own light tokens: what a colour the page does not give falls back to. */
const FALLBACK: FieldiaColours = {
  text: '#212529', muted: '#636976', surface: '#ffffff', page: '#f2f3f5', border: '#cfd4da', accent: '#002855', focus: '#002855', error: '#c62828',
  ...CODE_COLOURS.light,
};

const PAGE_ROLES: readonly PageRole[] = ['text', 'muted', 'surface', 'page', 'border', 'accent', 'focus', 'error'];
const CODE_ROLES = Object.keys(CODE_COLOURS.light) as CodeRole[];
const variable = (role: PageRole | CodeRole) => (CODE_ROLES.includes(role as CodeRole) ? `--fd-code-${role}` : `--fd-${role}`);

const byte = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
const alphaOf = (given: string | undefined) => (given === undefined ? 1 : given.endsWith('%') ? Number(given.slice(0, -1)) / 100 : Number(given));

/**
 * A colour as the browser computes it — #rgb, #rrggbb(aa), rgb(), rgba() or
 * color(srgb …) — as Monaco takes one: #rrggbb, or #rrggbbaa when it is see-through.
 * Null for anything else.
 */
export function hexOf(css: string): string | null {
  const text = css.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/.test(text)) return text;
  const number = '([\\d.]+)';
  const rgb = new RegExp(`^rgba?\\(\\s*${number}[\\s,]+${number}[\\s,]+${number}(?:\\s*[,/]\\s*([\\d.]+%?))?\\s*\\)$`).exec(text);
  const srgb = new RegExp(`^color\\(srgb\\s+${number}\\s+${number}\\s+${number}(?:\\s*/\\s*([\\d.]+%?))?\\s*\\)$`).exec(text);
  const found = rgb ?? srgb;
  if (!found) return null;
  const scale = rgb ? 1 : 255;
  const [r, g, b] = [found[1], found[2], found[3]].map((n) => Number(n) * scale);
  const alpha = alphaOf(found[4]);
  return `#${byte(r)}${byte(g)}${byte(b)}${alpha >= 1 ? '' : byte(alpha * 255)}`;
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const alpha = (hex: string) => (hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 : 1);
/** A see-through colour laid over its ground, as the browser paints it: #rrggbb. */
function solid(colour: string, ground: string): string {
  const a = alpha(colour);
  const over = channels(ground);
  return `#${channels(colour).map((c, i) => byte(c * a + over[i] * (1 - a))).join('')}`;
}
const luminance = (hex: string) =>
  channels(hex)
    .map((c) => c / 255)
    .map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4))
    .reduce((sum, s, i) => sum + s * [0.2126, 0.7152, 0.0722][i], 0);

/** Monaco's theme in these colours. */
export function monacoTheme(given: FieldiaColours): MonacoThemeData {
  const surface = solid(given.surface, '#ffffff');
  const on = (colour: string) => solid(colour, surface);
  const c = Object.fromEntries(Object.entries(given).map(([role, colour]) => [role, role === 'surface' ? surface : on(colour)])) as FieldiaColours;
  /** Monaco takes a rule's colour without its #. */
  const fg = (role: keyof FieldiaColours) => c[role].slice(1);
  const see = (role: keyof FieldiaColours, opacity: string) => `${c[role]}${opacity}`;
  const roles: [string[], keyof FieldiaColours][] = [
    [['keyword', 'keyword.flow', 'keyword.control', 'storage'], 'keyword'],
    [['string', 'string.escape', 'string.value.json', 'regexp', 'attribute.value'], 'string'],
    [['number', 'number.hex', 'number.float', 'constant', 'variable.predefined'], 'literal'],
    [['predefined', 'function'], 'function'],
    [['type', 'type.identifier', 'namespace', 'annotation'], 'type'],
    [['tag', 'metatag'], 'tag'],
    [['attribute.name', 'string.key.json', 'key', 'variable.name'], 'property'],
    [['delimiter', 'operator', 'identifier', 'variable'], 'text'],
  ];
  return {
    base: luminance(surface) < 0.4 ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: fg('text') },
      ...roles.flatMap(([tokens, role]) => tokens.map((token) => ({ token, foreground: fg(role) }))),
      { token: 'comment', foreground: fg('muted'), fontStyle: 'italic' },
      { token: 'comment.doc', foreground: fg('muted'), fontStyle: 'italic' },
      { token: 'invalid', foreground: fg('error') },
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'strong', fontStyle: 'bold' },
    ],
    colors: {
      'editor.background': surface,
      'editor.foreground': c.text,
      'editorGutter.background': solid(given.page, surface),
      'editorLineNumber.foreground': c.muted,
      'editorLineNumber.activeForeground': c.text,
      'editorCursor.foreground': c.text,
      'editor.selectionBackground': see('accent', '40'),
      'editor.inactiveSelectionBackground': see('accent', '26'),
      'editor.selectionHighlightBackground': see('accent', '1f'),
      'editor.wordHighlightBackground': see('accent', '1a'),
      'editor.findMatchBackground': see('accent', '59'),
      'editor.findMatchHighlightBackground': see('accent', '2e'),
      'editor.rangeHighlightBackground': see('accent', '14'),
      'editor.lineHighlightBackground': see('text', '0a'),
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background1': c.border,
      'editorIndentGuide.activeBackground1': c.muted,
      'editorWhitespace.foreground': c.border,
      'editorBracketMatch.background': see('accent', '1f'),
      'editorBracketMatch.border': c.muted,
      'editorError.foreground': c.error,
      'editorOverviewRuler.border': '#00000000',
      focusBorder: c.focus,
      'editorWidget.background': surface,
      'editorWidget.foreground': c.text,
      'editorWidget.border': c.border,
      'input.background': surface,
      'input.foreground': c.text,
      'input.border': c.border,
      'scrollbarSlider.background': see('muted', '40'),
      'scrollbarSlider.hoverBackground': see('muted', '66'),
      'scrollbarSlider.activeBackground': see('muted', '80'),
    },
  };
}

/**
 * The colours the page gives an element: each of Fieldia's tokens as the
 * browser resolves it there (through the theme, the scheme and the page's
 * look), the ones it does not give from Fieldia's own light tokens.
 */
export function readColours(element: HTMLElement): FieldiaColours {
  const view = element.ownerDocument.defaultView;
  if (!view) return { ...FALLBACK };
  const probe = element.ownerDocument.createElement('span');
  probe.hidden = true;
  element.append(probe);
  const declared = view.getComputedStyle(element);
  const colours = { ...FALLBACK };
  for (const role of [...PAGE_ROLES, ...CODE_ROLES]) {
    const name = variable(role);
    if (declared.getPropertyValue(name).trim() === '') continue;
    probe.style.color = `var(${name})`;
    colours[role] = hexOf(view.getComputedStyle(probe).color) ?? colours[role];
  }
  probe.remove();
  return colours;
}
