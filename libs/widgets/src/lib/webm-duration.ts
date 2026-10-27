/**
 * A WebM recording's length written into it. A browser's MediaRecorder writes WebM as it records, so it never knows
 * the length and leaves the Segment's Info without a Duration: a player then says "Infinity" (or 0:00), cannot be
 * scrubbed, and some read past the file's end looking for one. Once a recording has stopped its length is known, and
 * this writes it where a file written whole has it — a Duration element (0x4489, a float of the Segment's timecode
 * scale) at the end of the Info element, whose size grows by it — by hand, reading only the header's bytes.
 *
 * Anything that is not the WebM a recorder writes — another format, a Duration with a length already there, a header
 * past what is read, a SeekHead with entries before an Info that would have to grow (what it points at would move) — is
 * handed back as it came. A Duration written as 0 (Firefox's) is written over in place.
 */

/** The ids read here, as the bytes that name them. */
const EBML = 0x1a45dfa3;
const SEGMENT = 0x18538067;
const INFO = 0x1549a966;
const SEEK_HEAD = 0x114d9b74;
const CLUSTER = 0x1f43b675;
const DURATION = 0x4489;
const TIMECODE_SCALE = 0x2ad7b1;

/** How much of the file's start is read for its header: a recorder's is a few hundred bytes. */
const HEAD = 64 * 1024;

/** An element's id (its marker bits kept) or size (its marker taken off) at `at`: its value, and where it ends. */
function vint(bytes: Uint8Array, at: number, id: boolean): { value: number; end: number; unknown: boolean } | null {
  const first = bytes[at];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (!(first & (0x80 >> (length - 1)))) length++;
  if (at + length > bytes.length || (id && length > 4)) return null;
  let value = id ? first : first & (0xff >> length);
  let ones = value === 0xff >> length;
  for (let i = 1; i < length; i++) {
    value = value * 256 + bytes[at + i];
    if (bytes[at + i] !== 0xff) ones = false;
  }
  return { value, end: at + length, unknown: !id && ones };
}

/** An element at `at`: its id, where its data starts and ends (Infinity where its size is unknown). */
function element(bytes: Uint8Array, at: number) {
  const id = vint(bytes, at, true);
  const size = id && vint(bytes, id.end, false);
  if (!id || !size) return null;
  return { id: id.value, start: at, sizeAt: id.end, data: size.end, end: size.unknown ? Infinity : size.end + size.value };
}

/** A size written in 8 bytes, as EBML allows any size to be: 0x01 then the value. */
function size8(value: number): Uint8Array {
  const out = new Uint8Array(8);
  out[0] = 0x01;
  for (let i = 7, rest = value; i >= 1; i--, rest = Math.floor(rest / 256)) out[i] = rest % 256;
  return out;
}

/**
 * The header bytes with the Duration in it, and where in the file the rest goes on from; null where the header is not
 * a recorder's WebM that lacks one. `milliseconds` is the recording's length.
 */
export function withDurationHead(bytes: Uint8Array, milliseconds: number): { head: Uint8Array<ArrayBuffer>; restAt: number } | null {
  if (!(milliseconds > 0)) return null;
  const ebml = element(bytes, 0);
  if (!ebml || ebml.id !== EBML || ebml.end === Infinity) return null;
  const segment = element(bytes, ebml.end);
  if (!segment || segment.id !== SEGMENT) return null;
  // The Segment's children up to its Info: a Cluster first, and nothing is changed. A SeekHead with entries before it
  // (Firefox writes one empty) points past it, where an Info that grew would move what it points at.
  let at = segment.data;
  let info: NonNullable<ReturnType<typeof element>> | null = null;
  let pointed = false;
  while (at < bytes.length) {
    const child = element(bytes, at);
    if (!child || child.id === CLUSTER || child.end === Infinity || child.end > bytes.length) return null;
    if (child.id === SEEK_HEAD && child.end > child.data) pointed = true;
    if (child.id === INFO) {
      info = child;
      break;
    }
    at = child.end;
  }
  if (!info) return null;
  // Its children: the timecode scale its durations are in (a millisecond unless it says), and a Duration already there —
  // one with a length is left as it is; one written as nothing (0), as some recorders do, is written over in place.
  let scale = 1_000_000;
  let empty: { data: number; end: number } | null = null;
  for (let inner = info.data; inner < info.end; ) {
    const child = element(bytes, inner);
    if (!child || child.end > info.end) return null;
    if (child.id === DURATION) {
      const length = child.end - child.data;
      if (length !== 4 && length !== 8) return null;
      const view = new DataView(bytes.buffer, bytes.byteOffset + child.data, length);
      const now = length === 8 ? view.getFloat64(0) : view.getFloat32(0);
      if (now > 0) return null;
      empty = { data: child.data, end: child.end };
    }
    if (child.id === TIMECODE_SCALE) {
      let value = 0;
      for (let i = child.data; i < child.end; i++) value = value * 256 + bytes[i];
      if (value > 0) scale = value;
    }
    inner = child.end;
  }
  const value = (milliseconds * 1_000_000) / scale;
  if (empty) {
    const head = new Uint8Array(bytes.subarray(0, info.end));
    const view = new DataView(head.buffer, empty.data, empty.end - empty.data);
    if (empty.end - empty.data === 8) view.setFloat64(0, value);
    else view.setFloat32(0, value);
    return { head, restAt: info.end };
  }
  if (pointed) return null;
  const duration = new Uint8Array(11);
  duration.set([0x44, 0x89, 0x88]);
  new DataView(duration.buffer).setFloat64(3, value);
  const infoData = bytes.subarray(info.data, info.end);
  // The Segment's own size, where it is known (a recorder's is not), grows as the Info does.
  const segmentSize = segment.end === Infinity ? bytes.subarray(segment.sizeAt, segment.data) : size8(segment.end - segment.data + 11 + 8 - (info.data - info.sizeAt));
  const parts = [
    bytes.subarray(0, segment.sizeAt),
    segmentSize,
    bytes.subarray(segment.data, info.start),
    bytes.subarray(info.start, info.sizeAt),
    size8(infoData.length + duration.length),
    infoData,
    duration,
  ];
  const head = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let put = 0;
  for (const part of parts) {
    head.set(part, put);
    put += part.length;
  }
  return { head, restAt: info.end };
}

/** A WebM recording with its length written in; anything else, or a WebM that cannot be read so, as it came. */
export async function withDuration(blob: Blob, milliseconds: number): Promise<Blob> {
  if (!/^(audio|video)\/webm\b/i.test(blob.type)) return blob;
  try {
    const bytes = new Uint8Array(await blob.slice(0, HEAD).arrayBuffer());
    const written = withDurationHead(bytes, milliseconds);
    return written ? new Blob([written.head, blob.slice(written.restAt)], { type: blob.type }) : blob;
  } catch {
    return blob;
  }
}
