/** The box's look: quiet, the size of a field's box, in the page's own colours, light or dark. */
export const BROKEN_CSS = /* css */ `
.fd-broken {
  display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; min-height: 32px; box-sizing: border-box; min-width: 0;
  padding: 5px 10px; border: 1px dashed var(--fd-error); border-radius: var(--fd-control-radius);
  background: var(--fd-error-soft); color: var(--fd-text); font-size: 13px; line-height: 1.4; text-align: start;
}
.fd-broken-mark {
  flex: none; display: inline-grid; place-items: center; inline-size: 18px; block-size: 18px; border-radius: 50%;
  background: var(--fd-error); color: var(--fd-surface); font-size: 12px; font-weight: 700; line-height: 1;
}
.fd-broken-mark::before { content: '!'; }
.fd-broken-words { flex: 1 1 0; min-width: 0; overflow-wrap: anywhere; }
/* What the field went back to, under the words that name it, in line with them. */
.fd-broken-kept { flex: 1 0 100%; box-sizing: border-box; padding-inline-start: 26px; min-width: 0; overflow-wrap: anywhere; }
td > .fd-broken { min-height: 0; padding: 2px 6px; font-size: 12px; }
td > .fd-broken .fd-broken-kept { padding-inline-start: 0; }
`;
