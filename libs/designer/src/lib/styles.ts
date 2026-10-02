/** The designer's own chrome, on top of Fieldia's form stylesheet and tokens. */
export const DESIGNER_CSS = /* css */ `
.fd-designer { display: grid; gap: 14px; }
.fd-designer-bar {
  display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; position: sticky; top: env(safe-area-inset-top, 0px); z-index: 30;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 10px 14px;
}
.fd-designer-title { font-size: 17px; font-weight: 600; max-width: 420px; }
.fd-designer-status { color: var(--fd-muted); font-size: 13px; }
.fd-designer .fd-spacer { flex: 1; }
.fd-designer-issues { white-space: pre-line; }
.fd-designer-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 0.8fr); gap: 20px; align-items: start; }
@container (max-width: 900px) { .fd-designer-body { grid-template-columns: minmax(0, 1fr); } }
.fd-designer-editor { display: grid; gap: 14px; justify-items: start; }
.fd-designer-editor > * { width: 100%; }
.fd-designer-editor > .fd-button { width: auto; }
.fd-designer-pages { display: grid; gap: 18px; }
.fd-design-step { display: grid; gap: 10px; padding: 14px; border-radius: var(--fd-radius); background: var(--fd-page); border: 1px solid var(--fd-border); }
.fd-step-head { display: flex; gap: 8px; align-items: center; }
.fd-step-title { font-weight: 650; font-size: 15px; }
.fd-step-when { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; color: var(--fd-muted); font-size: 13px; }
.fd-step-when .fd-select { width: auto; min-width: 140px; }
.fd-step-cards { display: grid; gap: 10px; }
.fd-step-cards:empty::before { content: "No questions on this page yet."; color: var(--fd-muted); font-size: 13px; padding: 4px 2px; }
.fd-q {
  display: grid; gap: 10px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius);
  padding: 14px 16px; border-inline-start: 4px solid transparent; cursor: default;
}
.fd-q-selected { border-inline-start-color: var(--fd-accent); box-shadow: 0 2px 10px rgba(15, 20, 25, 0.08); }
.fd-q-head { display: grid; grid-template-columns: minmax(0, 1fr) minmax(130px, 200px); gap: 10px; }
.fd-q-label { font-size: 15px; }
.fd-q-options { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.fd-q-option { display: flex; gap: 8px; align-items: center; }
.fd-q-bullet { color: var(--fd-muted); width: 16px; text-align: center; }
.fd-q-option-box { display: grid; gap: 4px; justify-items: start; }
.fd-q-option-box > ul { width: 100%; }
.fd-q-foot { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; border-block-start: 1px solid var(--fd-border); padding-block-start: 10px; }
.fd-q-required { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; }
.fd-q-help { flex: 1 1 180px; min-width: 0; font-size: 13px; }
.fd-q-tools { display: flex; gap: 2px; margin-inline-start: auto; }
.fd-icon-button {
  font: inherit; border: none; background: none; cursor: pointer; color: var(--fd-muted); width: 30px; height: 30px; border-radius: 6px;
  display: inline-grid; place-items: center; font-size: 15px;
}
.fd-icon-button:hover { background: var(--fd-page); color: var(--fd-text); }
.fd-icon-danger:hover { color: var(--fd-error); background: var(--fd-error-soft); }
.fd-designer-preview { position: sticky; top: 76px; display: grid; gap: 8px; }
.fd-designer-preview-title { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fd-muted); }
.fd-designer-preview-host { background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 18px; max-height: 80vh; overflow: auto; }
`;

const STYLE_ID = 'fieldia-designer-styles';

export function installDesignerStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = DESIGNER_CSS;
  (document.head ?? document.documentElement).append(style);
}
