import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/**
 * The colours code is drawn in, by what a word is: a keyword, a string, a
 * number… Light and dark, each reading at 4.5:1 or more (WCAG AA) on the
 * surface of every Fieldia theme in that scheme (palette.spec.ts). Comments
 * take the page's quiet words (`--fd-muted`), errors its error colour, and
 * the rest of the text its words, so the code sits among the other fields.
 *
 * They are CSS variables, `--fd-code-keyword` and the rest, in Fieldia's
 * tokens' layer: a host sets its own over them as it sets any token.
 */
export const CODE_COLOURS = {
  light: { keyword: '#cf222e', string: '#0a3069', literal: '#0550ae', function: '#6639ba', type: '#953800', tag: '#116329', property: '#0550ae' },
  dark: { keyword: '#ff7b72', string: '#a5d6ff', literal: '#79c0ff', function: '#d2a8ff', type: '#ffa657', tag: '#7ee787', property: '#79c0ff' },
} as const;

export type CodeRole = keyof (typeof CODE_COLOURS)['light'];

const declare = (scheme: 'light' | 'dark') =>
  Object.entries(CODE_COLOURS[scheme])
    .map(([role, colour]) => `--fd-code-${role}: ${colour};`)
    .join(' ');

/** The colours as CSS: light on any code box, dark where the page's scheme is dark, or follows a dark system. */
export const CODE_COLOURS_CSS = `@layer fieldia-tokens {
.fd-code { ${declare('light')} }
:is(.fd-form, .fd-form-dialog, .fd-theme)[data-scheme="dark"] .fd-code { ${declare('dark')} }
@media (prefers-color-scheme: dark) { :is(.fd-form, .fd-form-dialog, .fd-theme)[data-scheme="auto"] .fd-code { ${declare('dark')} } }
}`;

const v = (role: CodeRole) => `var(--fd-code-${role})`;

/** What each kind of word in a grammar is drawn as, in the colours above. */
export const codeHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.self], color: v('keyword') },
  { tag: [t.string, t.special(t.string), t.character, t.regexp, t.escape], color: v('string') },
  { tag: [t.number, t.bool, t.null, t.atom, t.unit, t.constant(t.name), t.standard(t.name)], color: v('literal') },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.function(t.definition(t.variableName)), t.macroName], color: v('function') },
  { tag: [t.typeName, t.className, t.namespace, t.labelName], color: v('type') },
  { tag: [t.tagName, t.angleBracket], color: v('tag') },
  { tag: [t.attributeName, t.propertyName], color: v('property') },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment, t.meta, t.processingInstruction, t.documentMeta], color: 'var(--fd-muted)', fontStyle: 'italic' },
  { tag: t.heading, color: v('keyword'), fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: v('string'), textDecoration: 'underline' },
  { tag: t.inserted, color: v('tag') },
  { tag: t.deleted, color: v('keyword') },
  { tag: t.changed, color: v('type') },
  { tag: t.invalid, color: 'var(--fd-error)' },
]);
