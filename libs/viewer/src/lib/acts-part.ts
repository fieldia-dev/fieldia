/**
 * The acts part's viewer half (viewer-parts.ts, `actsPart`): what no page draws from as it is first drawn — a page in a
 * dialog or a side panel and "Search more…" (dialog-box.ts), a linked record's and a line's (link-dialogs.ts), a page
 * opened by a step (open.ts), the viewer's own
 * question (ask-box.ts), a save over someone else's and the changes Reload set aside (conflict-banner.ts). With the
 * form's half (@fieldia/core's `formActsPart`: the engine that runs steps), asked for right after the whole check; in
 * the one-tag script, one script with it (fieldia.acts.js).
 */
export { openFormDialog, openFormPanel, openSearchDialog } from './dialog-box';
export { openPage } from './open';
export { linkDialogs } from './link-dialogs';
export { askBox } from './ask-box';
export { conflictBanners } from './conflict-banner';
