import { fieldiaStyle } from '@fieldia/widgets';
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
textarea.fd-monaco-plain { min-height: 96px; }
input.fd-monaco-plain { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
/* Only to be read: shaded as Fieldia shades such a box, over the colours Monaco's theme gives it. */
.fd-monaco[data-readonly] .monaco-editor { --vscode-editor-background: color-mix(in srgb, var(--fd-text) 4%, var(--fd-surface)); }
/* A char field's code: one line, in a frame drawn as the form's text boxes are in each skin, the code on its ground. */
.fd-monaco-line .fd-monaco-frame {
  box-sizing: border-box; display: grid; align-content: center; min-width: 0; cursor: text;
  min-height: var(--fd-control-height, 30px); padding: var(--fd-pad-y) var(--fd-pad-x);
  background: var(--fd-surface); border: solid var(--fd-border); border-width: var(--fd-input-border); border-radius: var(--fd-control-radius);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.fd-monaco-line .fd-monaco-box { height: 20px; border: 0; border-radius: 0; background: none; }
.fd-monaco-line .fd-monaco-box:focus-within { outline: none; }
.fd-monaco.fd-monaco-line .monaco-editor, .fd-monaco.fd-monaco-line[data-readonly] .monaco-editor { --vscode-editor-background: transparent; --vscode-editorGutter-background: transparent; }
.fd-monaco-line .fd-monaco-frame:hover { border-color: var(--fd-border-strong); }
.fd-monaco-line .fd-monaco-frame:focus-within { border-color: var(--fd-focus); box-shadow: var(--fd-focus-ring); }
.fd-form[data-fd-skin="underline"] .fd-monaco-line .fd-monaco-frame { background: transparent; }
.fd-form[data-fd-skin="underline"] .fd-monaco-line .fd-monaco-frame:focus-within { box-shadow: 0 1px 0 0 var(--fd-focus); }
.fd-form[data-fd-skin="underline"] .fd-field.fd-required .fd-monaco-line .fd-monaco-frame { border-color: var(--fd-accent); }
.fd-monaco-line[data-readonly] .fd-monaco-frame { background: transparent; border-color: transparent; padding-inline: 0; }
.fd-form:is([data-fd-skin="outlined"], [data-fd-skin="quiet"]) .fd-monaco-line[data-readonly] .fd-monaco-frame { background: color-mix(in srgb, var(--fd-text) 5%, var(--fd-surface)); border-color: var(--fd-border); padding-inline: var(--fd-pad-x); }
.fd-form[data-readonly] .fd-monaco-line[data-readonly] .fd-monaco-frame { background: transparent; border-color: transparent; padding-inline: 0; }
.fd-monaco-line:is([data-invalid], :has(.inputarea[aria-invalid="true"])) .fd-monaco-frame { border-color: var(--fd-error); }
@layer fieldia-tokens {
.fd-monaco { ${declare('light')} }
:is(.fd-form, .fd-form-dialog, .fd-theme)[data-scheme="dark"] .fd-monaco { ${declare('dark')} }
@media (prefers-color-scheme: dark) { :is(.fd-form, .fd-form-dialog, .fd-theme)[data-scheme="auto"] .fd-monaco { ${declare('dark')} } }
}
`;

export function installMonacoStyles(doc: Document) {
  if (doc.getElementById('fieldia-monaco-styles')) return;
  const style = fieldiaStyle(doc, MONACO_CSS, 'fieldia-monaco-styles');
  doc.head.append(style);
}
