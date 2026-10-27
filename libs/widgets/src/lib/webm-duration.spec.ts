import { withDuration, withDurationHead } from './webm-duration';

/**
 * A WebM recording's length written into its header (webm-duration.ts): a browser's MediaRecorder writes none, so its
 * player says Infinity and cannot be scrubbed. Held on WebM built here as Chrome's and Firefox's recorders write it.
 */

// jsdom's Blob reads no bytes of itself (no arrayBuffer): a browser's does, as its FileReader reads them.
beforeAll(() => {
  if (typeof Blob.prototype.arrayBuffer !== 'function')
    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      configurable: true,
      value(this: Blob) {
        return new Promise<ArrayBuffer>((done, fail) => {
          const reader = new FileReader();
          reader.onload = () => done(reader.result as ArrayBuffer);
          reader.onerror = () => fail(reader.error);
          reader.readAsArrayBuffer(this);
        });
      },
    });
});

/** An element: its id's bytes, its size in one byte (or `size` as given), its data. */
const el = (id: number[], data: number[], size?: number[]) => [...id, ...(size ?? [0x80 | data.length]), ...data];
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const EBML = el([0x1a, 0x45, 0xdf, 0xa3], [...el([0x42, 0x86], [1]), ...el([0x42, 0x82], ascii('webm'))]);
const UNKNOWN = [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
const SCALE = el([0x2a, 0xd7, 0xb1], [0x0f, 0x42, 0x40]);
const MUXER = el([0x4d, 0x80], ascii('Chrome'));
const TRACKS = el([0x16, 0x54, 0xae, 0x6b], [0xae, 0x83, 0xd7, 0x81, 0x01]);
const CLUSTER = [0x1f, 0x43, 0xb6, 0x75, ...UNKNOWN, 0xe7, 0x81, 0x00, 0xa3, 0x84, 0x81, 0x00, 0x00, 0x80];
/** A recorder's WebM: the Segment of unknown size, its Info with no Duration, its tracks and a cluster. */
function recorded(info: number[] = [...SCALE, ...MUXER], segmentSize: number[] = UNKNOWN): Uint8Array<ArrayBuffer> {
  const body = [...el([0x15, 0x49, 0xa9, 0x66], info), ...TRACKS, ...CLUSTER];
  return new Uint8Array([...EBML, 0x18, 0x53, 0x80, 0x67, ...segmentSize, ...body]);
}
/** The whole file once written: the new header, then the rest as it was. */
function written(bytes: Uint8Array, ms: number): Uint8Array {
  const out = withDurationHead(bytes, ms);
  if (!out) throw new Error('not written');
  return new Uint8Array([...out.head, ...bytes.subarray(out.restAt)]);
}
/** The Info's data in a file, by its id: the bytes after its size. */
function infoOf(bytes: Uint8Array): { size: number; data: Uint8Array } {
  const at = bytes.findIndex((_, i) => bytes[i] === 0x15 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0xa9 && bytes[i + 3] === 0x66);
  const first = bytes[at + 4];
  const length = Math.clz32(first) - 23;
  let size = first & (0xff >> length);
  for (let i = 1; i < length; i++) size = size * 256 + bytes[at + 4 + i];
  return { size, data: bytes.subarray(at + 4 + length, at + 4 + length + size) };
}
const durationIn = (info: Uint8Array) => {
  const at = info.findIndex((_, i) => info[i] === 0x44 && info[i + 1] === 0x89);
  return at < 0 ? null : info[at + 2] === 0x88 ? new DataView(info.buffer, info.byteOffset + at + 3, 8).getFloat64(0) : new DataView(info.buffer, info.byteOffset + at + 3, 4).getFloat32(0);
};

describe('a WebM recording’s length, written into it', () => {
  it('adds a Duration to the Info a recorder wrote without one, in its timecode scale, the rest of the file as it was', () => {
    const bytes = recorded();
    const out = written(bytes, 3200);
    const info = infoOf(out);
    expect(durationIn(info.data)).toBe(3200);
    // The Info grew by the Duration alone: its scale and muxer kept, in their order.
    expect([...info.data.subarray(0, SCALE.length + MUXER.length)]).toEqual([...SCALE, ...MUXER]);
    expect(info.size).toBe(SCALE.length + MUXER.length + 11);
    // Tracks and clusters after it, byte for byte.
    expect([...out.subarray(out.length - TRACKS.length - CLUSTER.length)]).toEqual([...TRACKS, ...CLUSTER]);
    expect(out.length).toBe(bytes.length + 11 + 7);
  });

  it('writes it in the file’s own timecode scale: a microsecond scale holds a thousand times the number', () => {
    const micro = recorded([...el([0x2a, 0xd7, 0xb1], [0x03, 0xe8]), ...MUXER]);
    expect(durationIn(infoOf(written(micro, 2500)).data)).toBe(2_500_000);
  });

  it('writes over a Duration of 0 in place, and leaves one that has a length', () => {
    const zero = recorded([...SCALE, ...el([0x44, 0x89], [0, 0, 0, 0, 0, 0, 0, 0]), ...MUXER]);
    const out = written(zero, 1500);
    expect(out.length).toBe(zero.length);
    expect(durationIn(infoOf(out).data)).toBe(1500);
    const zero4 = recorded([...SCALE, ...el([0x44, 0x89], [0, 0, 0, 0]), ...MUXER]);
    expect(durationIn(infoOf(written(zero4, 1500)).data)).toBe(1500);
    const known = recorded([...SCALE, ...el([0x44, 0x89], [0x40, 0xa7, 0x70, 0, 0, 0, 0, 0]), ...MUXER]);
    expect(withDurationHead(known, 1500)).toBeNull();
  });

  it('writes into Firefox’s: an empty SeekHead before an Info whose Duration is 0, written over in place', () => {
    // As Firefox 157 writes it (libwebm): an empty SeekHead (size 0), then the Info with a Duration of 0 and its muxer.
    const firefox = new Uint8Array([...EBML, 0x18, 0x53, 0x80, 0x67, ...UNKNOWN, 0x11, 0x4d, 0x9b, 0x74, 0x01, 0, 0, 0, 0, 0, 0, 0, ...el([0x15, 0x49, 0xa9, 0x66], [...SCALE, ...el([0x44, 0x89], [0, 0, 0, 0, 0, 0, 0, 0]), ...MUXER]), ...TRACKS]);
    const out = written(firefox, 2750);
    expect(out.length).toBe(firefox.length);
    expect(durationIn(infoOf(out).data)).toBe(2750);
    // One with no Duration, after an empty SeekHead, grows its Info as Chrome's does.
    const empty = new Uint8Array([...EBML, 0x18, 0x53, 0x80, 0x67, ...UNKNOWN, 0x11, 0x4d, 0x9b, 0x74, 0x80, ...el([0x15, 0x49, 0xa9, 0x66], [...SCALE]), ...TRACKS]);
    expect(durationIn(infoOf(written(empty, 600)).data)).toBe(600);
  });

  it('grows a Segment of known size by what the Info grew', () => {
    const body = recorded().length - EBML.length - 12;
    const sized = recorded(undefined, [0x01, 0, 0, 0, 0, 0, 0, body]);
    const out = written(sized, 900);
    const size = out.subarray(EBML.length + 4, EBML.length + 12);
    expect(size[0]).toBe(0x01);
    expect(size[7] + size[6] * 256).toBe(body + 11 + 7);
    expect(out.length - EBML.length - 12).toBe(body + 11 + 7);
  });

  it('hands back what it cannot write into: not WebM, a SeekHead with entries before an Info that must grow, a cluster first, no length', () => {
    expect(withDurationHead(new Uint8Array([0, 0, 0, 0x24, ...ascii('ftypiso6')]), 1000)).toBeNull();
    const seek = new Uint8Array([...EBML, 0x18, 0x53, 0x80, 0x67, ...UNKNOWN, ...el([0x11, 0x4d, 0x9b, 0x74], [0xec, 0x80]), ...el([0x15, 0x49, 0xa9, 0x66], [...SCALE]), ...TRACKS]);
    expect(withDurationHead(seek, 1000)).toBeNull();
    expect(withDurationHead(new Uint8Array([...EBML, 0x18, 0x53, 0x80, 0x67, ...UNKNOWN, ...CLUSTER]), 1000)).toBeNull();
    expect(withDurationHead(recorded(), 0)).toBeNull();
    expect(withDurationHead(recorded().subarray(0, 30), 1000)).toBeNull();
  });

  it('as a Blob: a WebM recording comes back with its length, anything else as it came', async () => {
    const webm = new Blob([recorded()], { type: 'audio/webm' });
    const out = await withDuration(webm, 4000);
    expect(out.type).toBe('audio/webm');
    expect(durationIn(infoOf(new Uint8Array(await out.arrayBuffer())).data)).toBe(4000);
    const mp4 = new Blob([new Uint8Array([0, 0, 0, 0x24])], { type: 'audio/mp4' });
    expect(await withDuration(mp4, 4000)).toBe(mp4);
    const broken = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/webm' });
    expect(await withDuration(broken, 4000)).toBe(broken);
  });
});
