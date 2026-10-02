/** The chatter's look, on the same tokens as the form beside it. */
export const CHATTER_STYLES = `
.fd-chatter { display: grid; gap: 14px; font-family: var(--fd-font); color: var(--fd-text); font-size: 14px; min-width: 0; }
.fd-chatter [hidden] { display: none !important; }
.fd-chatter-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.fd-chatter-bar .fd-spacer { flex: 1; }
.fd-chatter-waiting, .fd-chatter-empty { margin: 0; color: var(--fd-muted); }
.fd-composer { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); background: var(--fd-surface); }
.fd-composer textarea { resize: vertical; min-height: 64px; font: inherit; }
.fd-composer-note { background: var(--fd-warning-soft); }
.fd-composer-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.fd-chatter-problem { margin: 0; color: var(--fd-error); font-size: 13px; }
.fd-chatter-messages { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.fd-message { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 10px; padding: 8px; border-radius: var(--fd-radius); }
.fd-message-note { background: var(--fd-warning-soft); }
.fd-message-event { color: var(--fd-muted); font-size: 13px; }
.fd-avatar-image, .fd-avatar-initials { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
.fd-avatar-initials { display: grid; place-items: center; background: var(--fd-accent-soft); color: var(--fd-accent); font-weight: 650; font-size: 13px; }
.fd-message-content { display: grid; gap: 4px; min-width: 0; }
.fd-message-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.fd-message-author { font-weight: 650; }
.fd-message-head time { color: var(--fd-muted); font-size: 12.5px; }
.fd-message-kind { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--fd-warning); }
.fd-message-body { overflow-wrap: anywhere; line-height: 1.5; }
.fd-message-body p { margin: 0 0 6px; }
.fd-message-body p:last-child { margin-bottom: 0; }
.fd-message-body img { max-width: 100%; height: auto; }
.fd-tracking { margin: 0; padding-inline-start: 18px; color: var(--fd-text); }
`;

/** Puts the chatter's look in the document once. */
export function installChatterStyles(doc: Document): void {
  if (doc.getElementById('fd-chatter-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fd-chatter-styles';
  style.textContent = CHATTER_STYLES;
  doc.head.append(style);
}
