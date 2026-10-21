import type { FieldNode } from './layout';
import type { FieldTools } from './part-checks';

/** Whether a record holds a key of its own. */
const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

/**
 * A signature, on a binary field, that signs answers: the answers it signs fields of this page — never itself — and
 * the signer's name in a field that holds words (a text, or a link's name).
 */
export function checkSignature(node: FieldNode, path: string, tools: FieldTools): void {
  const options = node.options ?? {};
  const signs = options['signs'];
  if (Array.isArray(signs)) {
    signs.forEach((name, i) => {
      if (typeof name !== 'string') return;
      if (name === node.field) tools.report(`${path}.options.signs[${i}]`, 'a signature signs other answers than its own');
      else tools.need(name, `${path}.options.signs[${i}]`);
    });
  }
  const signer = options['signerField'];
  if (typeof signer === 'string' && has(tools.page.fields, signer)) {
    const type = tools.page.fields[signer].type;
    if (type !== 'char' && type !== 'many2one') tools.report(`${path}.options.signerField`, `"${signer}" is a ${type}; the signer's name is kept in a char field, or is a many2one's record`);
  }
  if (signer !== undefined && signs === undefined) tools.report(`${path}.options.signerField`, 'signerField names who signs the answers in signs: say which it signs');
}

/**
 * The media types a recording of each kind is written in by the browsers that record (WebM, Ogg, MP4): a field's
 * `accept` must take one of them, by its kind (`audio/*`) or itself — a file field checks a file by its media type.
 */
const RECORDED_AS = { audio: /^audio\/(\*|webm|ogg|mp4)$/i, video: /^video\/(\*|webm|mp4)$/i } as const;

/**
 * A file field that records (`options.record`, its type the reference check's): what it records a kind its `accept`
 * takes — a voice note is a sound, a film a video — and `maxSeconds` the length of something it records.
 */
export function checkRecording(node: FieldNode, def: { type: string; accept?: readonly string[] }, path: string, tools: FieldTools): void {
  const record = node.options?.['record'];
  const kinds = (Array.isArray(record) ? record : [record]).filter((kind): kind is 'audio' | 'video' => kind === 'audio' || kind === 'video');
  if (record === undefined) tools.report(`${path}.options.maxSeconds`, 'maxSeconds is how long a recording may be: say what the field records (record: "audio" or "video")');
  for (const kind of kinds) {
    if (!def.accept?.length || def.accept.some((type) => RECORDED_AS[kind].test(type.trim()))) continue;
    tools.report(`${path}.options.record`, `"${node.field}" accepts ${def.accept.join(', ')}: a ${kind === 'audio' ? 'voice note is audio (audio/*)' : 'film is video (video/*)'}, which it would refuse`);
  }
}
