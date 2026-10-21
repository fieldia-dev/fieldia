import type { FileValue, RecordedKind } from '@fieldia/core';
import { extension, kindOf } from './file-shown';

/**
 * Films and sounds in a file field, and what a field records (the files part): a file's kind with them — by its media
 * type, else, where none is known, its extension — and a field's recordings, by its node's `options.record` and
 * `maxSeconds`. A sheet's attachment preview (the main script's `fileShown`) shows pictures and PDFs alone, so they are
 * the files part's, not the main script's.
 */

/** A film or a sound by its media type — an audio/webm is a sound — else, where none is known, by its extension; '' for any other file. */
export function mediaKind(file: FileValue): '' | 'video' | 'audio' {
  const type = (file.type ?? '').toLowerCase();
  const by = /^(video|audio)\//.exec(type)?.[1];
  if (by) return by as 'video' | 'audio';
  if (type && type !== 'application/octet-stream') return '';
  const ending = extension(file.name).toLowerCase();
  return /^(mp4|m4v|mov|webm|ogv)$/.test(ending) ? 'video' : /^(mp3|m4a|wav|ogg|oga|opus|aac|flac|weba)$/.test(ending) ? 'audio' : '';
}

/** What a file is, for its icon, its picture and how it opens: a film, a sound, or what `kindOf` says. */
export const kindOfFile = (file: FileValue): string => mediaKind(file) || kindOf(file);

/** How long a recording may be unless the page says, in seconds: two minutes of voice, a minute of film. */
export const RECORD_SECONDS: Readonly<Record<RecordedKind, number>> = { audio: 120, video: 60 };

/** What a file field's node records, each kind once, in the page's order — none where it says nothing, or says it wrong. */
export function recordedKinds(options: Record<string, unknown> | undefined): RecordedKind[] {
  const record = options?.['record'];
  const kinds = (Array.isArray(record) ? record : [record]).filter((kind): kind is RecordedKind => kind === 'audio' || kind === 'video');
  return [...new Set(kinds)];
}

/** The longest a recording of `kind` may be on a field, in seconds: its node's `maxSeconds`, else the kind's own. */
export function recordSeconds(options: Record<string, unknown> | undefined, kind: RecordedKind): number {
  const most = options?.['maxSeconds'];
  return typeof most === 'number' && Number.isInteger(most) && most >= 1 && most <= 3600 ? most : RECORD_SECONDS[kind];
}
