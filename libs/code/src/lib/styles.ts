import { fieldiaStyle } from '@fieldia/widgets';
import { CODE_COLOURS_CSS } from './palette';

/** The editor in Fieldia's colours, so it sits among the other fields. Installed once per document. */
export const CODE_CSS = `
/* One column, as wide as the field: a long line scrolls inside the editor, never widens the page. */
.fd-code { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; min-width: 0; }
.fd-code .cm-editor {
  border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); background: var(--fd-surface);
  color: var(--fd-text); font-size: 13px; min-height: 96px; max-height: 360px;
}
.fd-code .cm-editor.cm-focused { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-code .cm-scroller { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; line-height: 1.5; }
.fd-code .cm-gutters { background: var(--fd-page); color: var(--fd-muted); border-inline-end: 1px solid var(--fd-border); }
/* JSON that does not read: the box's edge in the error colour, the line where it breaks shaded, the character that cannot be there underlined. */
.fd-code .cm-editor:has(.cm-content[aria-invalid="true"]) { border-color: var(--fd-error); }
.fd-code .fd-code-bad-line { background: var(--fd-error-soft); }
.fd-code .fd-code-bad-spot { text-decoration: wavy underline var(--fd-error); text-decoration-skip-ink: none; text-underline-offset: 3px; }
.fd-code-error { font-family: var(--fd-font); }
/* Code in a language: its words in the code colours, the box shaded when it is only to be read. */
.fd-code-text .cm-editor { color: var(--fd-text); }
.fd-code-text[data-readonly] .cm-editor { background: color-mix(in srgb, var(--fd-text) 4%, var(--fd-surface)); }
.fd-code-text .cm-placeholder { color: var(--fd-muted); }
/* A char field's code is one line: as tall as a text box, no line numbers. */
.fd-code-line { min-height: 0; }
.fd-code-line .cm-editor { min-height: 0; }
.fd-code-line .cm-content { padding-block: max(2px, calc(var(--fd-pad-y, 4px) - 1px)); }
${CODE_COLOURS_CSS}
`;

export function installCodeStyles(doc: Document) {
  if (doc.getElementById('fieldia-code-styles')) return;
  const style = fieldiaStyle(doc, CODE_CSS, 'fieldia-code-styles');
  doc.head.append(style);
}
