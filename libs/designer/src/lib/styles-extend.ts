/**
 * The designer's part for what an app adds: its own kinds' settings, the
 * templates a blank page starts from, and the app's assistant. Appended to
 * the designer's stylesheet.
 */
export const DESIGNER_EXTEND_CSS = /* css */ `
/* ---- an app's kind: its settings flow with the field's own ---------------- */
.fd-app-settings { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; min-width: 0; }
.fd-prop > .fd-app-settings { font-size: 13px; color: var(--fd-muted); }
`;
