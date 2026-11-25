import { ENCODE_CAP_MS, encodeNow, encodeSoon } from './encode-now';

/**
 * A picture encoded never waiting long: the browser's toBlob, or at once (toDataURL) where it has not answered within the
 * cap — Chromium's toBlob, encoded in idle time, answered a busy machine's crop 1 s or 6.7 s late. Each answer held by
 * the test, the clock jest's own.
 */
const fromBlob = new Blob(['toBlob'], { type: 'image/jpeg' });
/** A canvas whose toBlob answers when the test says (or never), and whose toDataURL encodes at once, each call noted. */
function canvas(toBlobAfter: number | null) {
  const toDataURL = jest.fn((type: string) => `data:${type};base64,${btoa('at once')}`);
  const toBlob = jest.fn((done: BlobCallback) => {
    if (toBlobAfter !== null) setTimeout(() => done(fromBlob), toBlobAfter);
  });
  return { toBlob, toDataURL, element: { toBlob, toDataURL } as unknown as HTMLCanvasElement };
}
/** Which encoder made it: toBlob's own answer, or the 7 bytes "at once" toDataURL wrote (jsdom's Blob reads no text). */
const atOnce = (blob: Blob | null | undefined) => !!blob && blob !== fromBlob && blob.size === 'at once'.length;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('encodeSoon', () => {
  it('takes toBlob’s answer where it comes within the cap — at 50 ms — and never encodes at once', async () => {
    const { toBlob, toDataURL, element } = canvas(50);
    let made: Blob | null | undefined;
    void encodeSoon(element, 'image/jpeg', 0.92).then((blob) => (made = blob));
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92);
    await jest.advanceTimersByTimeAsync(49);
    expect(made).toBeUndefined();
    await jest.advanceTimersByTimeAsync(1);
    expect(made).toBe(fromBlob);
    // The cap passes with nothing more done.
    await jest.advanceTimersByTimeAsync(ENCODE_CAP_MS);
    expect(toDataURL).not.toHaveBeenCalled();
  });

  it('encodes at once when toBlob has not answered within the cap — 200 ms — and drops its late answer', async () => {
    expect(ENCODE_CAP_MS).toBe(200);
    const { toDataURL, element } = canvas(6700);
    const answers: (Blob | null)[] = [];
    const made = encodeSoon(element, 'image/jpeg', 0.92).then((blob) => (answers.push(blob), blob));
    await jest.advanceTimersByTimeAsync(ENCODE_CAP_MS - 1);
    expect(answers).toEqual([]);
    expect(toDataURL).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.92);
    expect(atOnce(await made)).toBe(true);
    expect((await made)?.type).toBe('image/jpeg');
    // toBlob's answer, 6.7 s on, changes nothing.
    await jest.advanceTimersByTimeAsync(6700);
    expect(answers).toHaveLength(1);
    expect(atOnce(answers[0])).toBe(true);
  });

  it('encodes at once when toBlob never answers, or throws', async () => {
    const never = canvas(null);
    const made = encodeSoon(never.element, 'image/png', 1);
    await jest.advanceTimersByTimeAsync(ENCODE_CAP_MS);
    expect(atOnce(await made)).toBe(true);
    const throwing = canvas(null);
    throwing.toBlob.mockImplementation(() => {
      throw new Error('not here');
    });
    expect(atOnce(await encodeSoon(throwing.element, 'image/png', 1))).toBe(true);
  });
});

describe('encodeNow', () => {
  it('makes the bytes of the type the browser wrote, or none', () => {
    const png = { toDataURL: () => `data:image/png;base64,${btoa('png bytes')}` } as unknown as HTMLCanvasElement;
    // Asked for a WebP the browser cannot write: what it wrote, a PNG.
    expect(encodeNow(png, 'image/webp', 0.92)?.type).toBe('image/png');
    expect(encodeNow({ toDataURL: () => 'data:,' } as unknown as HTMLCanvasElement, 'image/jpeg', 0.92)).toBeNull();
    expect(encodeNow({ toDataURL: () => { throw new Error('tainted'); } } as unknown as HTMLCanvasElement, 'image/jpeg', 0.92)).toBeNull();
  });
});
