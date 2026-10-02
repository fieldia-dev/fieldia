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
.fd-composer-actions .fd-spacer { flex: 1; }
.fd-attach .fd-icon { width: 1.1em; height: 1.1em; margin-inline-end: 0.35em; vertical-align: -0.2em; }
.fd-attachments { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.fd-attachment { position: relative; display: flex; align-items: center; gap: 4px; }
.fd-attachment-image img { display: block; width: 120px; height: 90px; object-fit: cover; border-radius: var(--fd-radius); border: 1px solid var(--fd-border); }
.fd-attachment-file {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--fd-border); border-radius: var(--fd-radius);
  background: var(--fd-surface); color: var(--fd-text); text-decoration: none; max-width: 240px;
}
a.fd-attachment-file:hover { border-color: var(--fd-accent); }
.fd-attachment-file .fd-icon { width: 20px; height: 20px; color: var(--fd-muted); flex: none; }
.fd-attachment-words { display: grid; min-width: 0; }
.fd-attachment-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.fd-attachment-size { color: var(--fd-muted); font-size: 12px; }
.fd-attachment-remove { border: none; background: none; cursor: pointer; color: var(--fd-muted); font-size: 16px; line-height: 1; padding: 2px 4px; border-radius: 4px; }
.fd-attachment-remove:hover { color: var(--fd-text); background: var(--fd-page); }
.fd-replying, .fd-message-parent { margin: 0; color: var(--fd-muted); font-size: 12.5px; }
.fd-message-parent::before, .fd-replying::before { content: "↩ "; }
.fd-message-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.fd-reactions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; position: relative; }
.fd-reaction, .fd-reaction-add, .fd-message-reply, .fd-reaction-picker button {
  font: inherit; font-size: 13px; line-height: 1; padding: 4px 8px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--fd-border); background: var(--fd-surface); color: var(--fd-muted);
}
.fd-reaction[aria-pressed="true"] { border-color: var(--fd-accent); background: var(--fd-accent-soft); color: var(--fd-text); }
.fd-reaction-add, .fd-message-reply { opacity: 0.75; }
.fd-message:hover .fd-reaction-add, .fd-message:hover .fd-message-reply, .fd-reaction-add:focus-visible, .fd-message-reply:focus-visible { opacity: 1; }
.fd-reaction-picker { display: flex; gap: 2px; padding: 4px; border: 1px solid var(--fd-border); border-radius: 999px; background: var(--fd-surface); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.fd-reaction-picker button { border: none; padding: 4px 6px; font-size: 16px; }
.fd-reaction-picker button:hover { background: var(--fd-page); }
.fd-mentions { list-style: none; margin: 0; padding: 4px 0; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); background: var(--fd-surface); max-width: 280px; box-shadow: 0 6px 18px rgba(0,0,0,0.1); }
.fd-mentions [role=option] { padding: 6px 12px; cursor: pointer; }
.fd-mentions [role=option].fd-active, .fd-mentions [role=option]:hover { background: var(--fd-accent-soft); }
.fd-mentions .fd-empty { padding: 6px 12px; color: var(--fd-muted); }
.fd-activities { display: grid; gap: 8px; }
.fd-activity-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.fd-activity { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); background: var(--fd-surface); }
.fd-activity-icon { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; color: #fff; background: var(--fd-success); }
.fd-activity[data-when="overdue"] .fd-activity-icon { background: var(--fd-error); }
.fd-activity[data-when="today"] .fd-activity-icon { background: #d97706; }
.fd-activity-icon .fd-icon { width: 16px; height: 16px; }
.fd-activity-content { display: grid; min-width: 0; }
.fd-activity-summary { font-weight: 600; overflow-wrap: anywhere; }
.fd-activity-meta { color: var(--fd-muted); font-size: 12.5px; }
.fd-activity[data-when="overdue"] .fd-activity-due { color: var(--fd-error); font-weight: 600; }
.fd-activity[data-when="today"] .fd-activity-due { color: #b45309; font-weight: 600; }
.fd-activity-actions { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.fd-activity-finish { grid-column: 1 / -1; display: grid; gap: 6px; }
.fd-activity-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; padding: 12px; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); background: var(--fd-surface); }
.fd-activity-form .fd-composer-actions { grid-column: 1 / -1; }
.fd-activity-field { display: grid; gap: 4px; font-size: 13px; color: var(--fd-muted); }
`;

/** Puts the chatter's look in the document once. */
export function installChatterStyles(doc: Document): void {
  if (doc.getElementById('fd-chatter-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fd-chatter-styles';
  style.textContent = CHATTER_STYLES;
  doc.head.append(style);
}
