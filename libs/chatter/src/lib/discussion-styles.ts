/**
 * A discussion's look: the comment box on a card, its picture at the start,
 * then a card for each comment, 16px apart, on the same tokens as the form
 * round it (the work item's `link` and `fill` falling back to Fieldia's own).
 */
export const DISCUSSION_STYLES = /* css */ `
.fd-discussion {
  display: grid; gap: 16px; min-width: 0; margin-inline: calc(-1 * var(--fd-group-inset, 0px)); padding-block-start: 12px;
  font-family: var(--fd-font); font-size: 14px; line-height: 20px; color: var(--fd-text);
}
.fd-discussion [hidden] { display: none !important; }
.fd-comment-card {
  position: relative; display: block; min-width: 0; margin: 0; padding: 28px 20px 26px 60px; padding-inline: 60px 20px;
  border-radius: 4px; background: var(--fd-surface); box-shadow: 0 1.6px 3.6px rgb(0 0 0 / 0.132), 0 0.3px 0.9px rgb(0 0 0 / 0.108);
}
.fd-comment-card:focus { outline: none; }
.fd-comment-card:focus-visible { outline: 1px solid var(--fd-focus); }
:is(.fd-form[data-scheme="dark"], .fd-theme[data-scheme="dark"]) .fd-comment-card { box-shadow: 0 0 0 1px var(--fd-border), 0 1.6px 3.6px rgb(0 0 0 / 0.4); }
@media (prefers-color-scheme: dark) { .fd-form[data-scheme="auto"] .fd-comment-card { box-shadow: 0 0 0 1px var(--fd-border), 0 1.6px 3.6px rgb(0 0 0 / 0.4); } }
.fd-composer-card { padding-block: 30px 19px; }
.fd-discussion-avatar { position: absolute; inset-block-start: 28px; inset-inline-start: 24px; width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
.fd-discussion-initials { display: grid; place-items: center; background: var(--fd-accent); color: var(--fd-accent-text, #fff); font-size: 10px; font-weight: 600; line-height: 1; }
.fd-discussion-write { display: grid; min-width: 0; }
.fd-discussion .fd-text { --fd-text-pad-x: 8px; padding-block-end: 0; }
.fd-discussion .fd-text > .fd-text-box, .fd-discussion .fd-text[data-toolbar="focus"] > .fd-text-box { border-color: var(--fd-border); background: var(--fd-surface); }
.fd-discussion .fd-text[data-toolbar="focus"]:focus-within > .fd-text-box { border-color: var(--fd-focus); }
.fd-discussion .fd-text-area { min-height: 55px; }
.fd-discussion .fd-text[data-toolbar="focus"]:not(:focus-within) .fd-text-area { min-height: 92px; }
.fd-discussion .fd-text-under { margin-block-start: 0; }
.fd-discussion-actions { display: none; align-items: center; justify-content: flex-end; gap: 8px; margin-block: 7px 12px; }
.fd-composer-card[data-open] .fd-discussion-actions { display: flex; }
.fd-discussion-problem { flex: 1 1 auto; margin: 0; color: var(--fd-muted); font-size: 12px; line-height: 16px; }
.fd-discussion-button {
  height: 31px; padding: 0 13px; border: 0; border-radius: 2px; background: var(--fd-fill, color-mix(in srgb, var(--fd-text) 6%, var(--fd-surface)));
  color: var(--fd-text); font: 600 14px/20px var(--fd-font); cursor: pointer;
}
.fd-discussion-button:hover { background: color-mix(in srgb, var(--fd-text) 10%, var(--fd-surface)); }
.fd-discussion-button:active { background: color-mix(in srgb, var(--fd-text) 20%, var(--fd-surface)); }
.fd-discussion-button:focus-visible, .fd-comment-date:focus-visible { outline: 1px solid var(--fd-focus); outline-offset: 1px; }
.fd-discussion-button[aria-busy="true"] { cursor: progress; }
.fd-discussion-ask { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin-block-start: 6px; padding: 8px 10px; border-radius: 2px; background: var(--fd-warning-soft); font-size: 13px; }
.fd-discussion-waiting { margin: 0; color: var(--fd-muted); }
.fd-discussion-comments { display: grid; gap: 16px; margin: 0; padding: 0; list-style: none; }
.fd-comment-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0 6px; min-height: 24px; }
.fd-comment-author { color: var(--fd-muted); font-weight: 600; }
.fd-comment-date { color: var(--fd-muted); font-size: 12px; line-height: 16px; text-decoration: underline; }
.fd-comment-body { margin-block-start: 12px; overflow-wrap: anywhere; }
.fd-comment-body > :is(p, ul, ol) { margin: 0 0 6px; }
/* Each paragraph runs the way its words are written: English on an Arabic page keeps its full stop at its end. */
.fd-comment-body > * { unicode-bidi: plaintext; }
.fd-comment-body > :last-child { margin-block-end: 0; }
.fd-comment-body a { color: var(--fd-link, var(--fd-accent)); }
.fd-comment-body img { max-width: 100%; height: auto; }
.fd-comment-body :is([data-mention], [data-record]) { color: var(--fd-link, var(--fd-accent)); font-weight: 600; }
.fd-comment-body .fd-external { width: 12px; height: 12px; margin-inline-start: 4px; vertical-align: -1px; color: var(--fd-muted); }
`;

const STYLE_ID = 'fieldia-discussion-styles';

export function installDiscussionStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = DISCUSSION_STYLES;
  (doc.head ?? doc.documentElement).append(style);
}
