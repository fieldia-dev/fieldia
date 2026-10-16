/**
 * What the quiet look's part (styles-quiet.ts) leaves in Fieldia's own
 * stylesheet, because it styles things outside a quiet place too: a state's
 * words by its dot kept out of sight where the page does not ask for them (the
 * quiet look shows them, as the value it reads), and the lock of a field
 * read-only by a rule, by its label, which says why in any look. Where the
 * quiet look's rules stood, before the pickers'.
 */
export const LOCK_CSS = /* css */ `
/* A state's words by its dot, where the page does not ask for them: the quiet look shows them, as the value it reads. */
.fd-dot-label[data-quiet-words] { display: none; }

/* The lock of a field read-only by a rule, by its label: why, in a bubble, when pointed at or focused. */
.fd-lock-wrap { position: relative; display: inline-flex; vertical-align: -0.15em; margin-inline-start: 6px; }
.fd-lock { display: inline-grid; place-items: center; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 4px; background: none; color: var(--fd-muted); }
button.fd-lock { cursor: help; }
.fd-lock .fd-icon { width: 14px; height: 14px; margin: 0; }
.fd-lock:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
`;
