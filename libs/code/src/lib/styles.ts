/** The editor in Fieldia's colours, so it sits among the other fields. Installed once per document. */
export const CODE_CSS = `
.fd-code { display: grid; gap: 4px; min-width: 0; }
.fd-code .cm-editor {
  border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); background: var(--fd-surface);
  color: var(--fd-text); font-size: 13px; min-height: 96px; max-height: 360px;
}
.fd-code .cm-editor.cm-focused { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-code .cm-scroller { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; line-height: 1.5; }
.fd-code .cm-gutters { background: var(--fd-page); color: var(--fd-muted); border-inline-end: 1px solid var(--fd-border); }
.fd-code .cm-content[aria-invalid="true"] { background: var(--fd-error-soft); }
`;

export function installCodeStyles(doc: Document) {
  if (doc.getElementById('fieldia-code-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fieldia-code-styles';
  style.textContent = CODE_CSS;
  doc.head.append(style);
}
