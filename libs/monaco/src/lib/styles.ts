import { CODE_COLOURS } from './theme';

const declare = (scheme: 'light' | 'dark') =>
  Object.entries(CODE_COLOURS[scheme])
    .map(([role, colour]) => `--fd-code-${role}: ${colour};`)
    .join(' ');

/**
 * The editor's frame in Fieldia's colours, so it sits among the other
 * fields, and the code colours the theme is read from: light, dark where the
 * page is dark, in Fieldia's tokens' layer so a host sets its own over them.
 * Installed once per document.
 */
export const MONACO_CSS = `
.fd-monaco { display: grid; gap: 4px; min-width: 0; }
.fd-monaco-box {
  box-sizing: border-box; height: 96px; min-width: 0; overflow: hidden;
  border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); background: var(--fd-surface);
}
.fd-monaco-box:focus-within { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-monaco[data-invalid] .fd-monaco-box { border-color: var(--fd-error); }
.fd-monaco-plain { min-height: 96px; }
/* Only to be read: shaded as Fieldia shades such a box, over the colours Monaco's theme gives it. */
.fd-monaco[data-readonly] .monaco-editor { --vscode-editor-background: color-mix(in srgb, var(--fd-text) 4%, var(--fd-surface)); }
@layer fieldia-tokens {
.fd-monaco { ${declare('light')} }
:is(.fd-form, .fd-form-dialog, .fd-theme)[data-scheme="dark"] .fd-monaco { ${declare('dark')} }
@media (prefers-color-scheme: dark) { :is(.fd-form, .fd-form-dialog, .fd-theme)[data-scheme="auto"] .fd-monaco { ${declare('dark')} } }
}
`;

export function installMonacoStyles(doc: Document) {
  if (doc.getElementById('fieldia-monaco-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fieldia-monaco-styles';
  style.textContent = MONACO_CSS;
  doc.head.append(style);
}
