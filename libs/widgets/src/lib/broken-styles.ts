/** The box's look: quiet, the size of a field's box, in the page's own colours, light or dark. */
export const BROKEN_CSS = /* css */ `
.fd-broken {
  display: flex; align-items: center; gap: 8px; min-height: 32px; box-sizing: border-box; min-width: 0;
  padding: 5px 10px; border: 1px dashed var(--fd-error); border-radius: var(--fd-control-radius);
  background: var(--fd-error-soft); color: var(--fd-text); font-size: 13px; line-height: 1.4; text-align: start;
}
.fd-broken-mark {
  flex: none; display: inline-grid; place-items: center; inline-size: 18px; block-size: 18px; border-radius: 50%;
  background: var(--fd-error); color: var(--fd-surface); font-size: 12px; font-weight: 700; line-height: 1;
}
.fd-broken-mark::before { content: '!'; }
.fd-broken-words { min-width: 0; overflow-wrap: anywhere; }
td > .fd-broken { min-height: 0; padding: 2px 6px; font-size: 12px; }
`;
