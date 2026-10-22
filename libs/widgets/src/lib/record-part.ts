/**
 * The record part (parts.ts): a voice note or a short film recorded on the page for a file field whose node says
 * `options.record` — the recorder's dialog over the form, the microphone and the camera asked for, the time against
 * its limit, the recording played back, and what is kept handed to the field as a file picked is (recorder.ts) — and
 * its sheet (styles-record.ts). Loaded the first time a person presses Record (`recordPart`, asked for by the files
 * part): a page that records nothing never loads it.
 */
export { openRecorder, recordingType, clock, type Recorder, type RecorderContext } from './recorder';
export { installRecordStyles } from './styles-record';
