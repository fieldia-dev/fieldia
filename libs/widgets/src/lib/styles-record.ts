import { installPartStyles, PART_RANK } from './styles';

/**
 * The recorder (recorder.ts): its dialog over the form — a film's live picture or a voice's level, what is said, the
 * time against the limit, the buttons, the recording played back, and the question before one is let go. The record
 * part's sheet, put in its place among Fieldia's the first time a person presses Record (installPartStyles,
 * PART_RANK.record): before the themes', so a theme reshapes its dialog and its buttons; the dialog, its head and its
 * buttons are the main sheet's. A recording's red is the error's token, so dark follows; motion stops where a person
 * asked for less.
 */
export const RECORD_CSS = /* css */ `
.fd-recorder { max-width: 560px; }
.fd-recorder-body { display: grid; gap: 12px; padding: 16px 20px 20px; }
.fd-recorder-stage { display: grid; place-items: center; min-height: 120px; border-radius: var(--fd-control-radius); background: var(--fd-page); overflow: hidden; }
.fd-recorder-video { aspect-ratio: 16 / 9; background: #14181d; }
.fd-recorder-live { width: 100%; height: 100%; object-fit: cover; }
/* A voice's level: five bars that rise with it. */
.fd-recorder-level { display: flex; align-items: center; gap: 6px; height: 64px; }
.fd-recorder-level > span { width: 8px; height: calc(10px + var(--fd-level, 0) * 54px); border-radius: 4px; background: var(--fd-accent); transition: height 0.08s linear; }
.fd-recorder-review > * { width: 100%; }
.fd-recorder-review video { max-height: 50vh; background: #000; border-radius: var(--fd-control-radius); }
.fd-recorder-said { margin: 0; min-height: 1.4em; }
.fd-recorder-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
/* The time beside the buttons: digits that keep their width as they count. */
.fd-recorder-time { font-variant-numeric: tabular-nums; font-size: 15px; color: var(--fd-muted); direction: ltr; unicode-bidi: isolate; }
.fd-recording .fd-recorder-time { color: var(--fd-error); font-weight: 600; }
.fd-recorder-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-inline-start: auto; }
.fd-recorder-buttons .fd-button { display: inline-flex; align-items: center; gap: 8px; }
.fd-recorder-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--fd-error); }
.fd-recorder-square { width: 10px; height: 10px; border-radius: 2px; background: currentColor; }
.fd-recording .fd-recorder-stage { box-shadow: inset 0 0 0 2px var(--fd-error); }
@media (prefers-reduced-motion: no-preference) {
  .fd-recording .fd-recorder-time::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-inline-end: 6px; border-radius: 50%; background: var(--fd-error); animation: fd-recorder-blink 1s steps(2, start) infinite; }
}
@keyframes fd-recorder-blink { to { visibility: hidden; } }
`;

/** The recorder's sheet in a document, once, in its place among Fieldia's (PART_RANK.record). */
export function installRecordStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-record-styles', RECORD_CSS, PART_RANK.record);
}
