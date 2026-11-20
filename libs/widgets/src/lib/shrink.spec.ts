import type { Field } from '@fieldia/core';
import { SHRINK_DEFAULTS, shrinkFor, shrinkPhoto } from './shrink';

/**
 * A photo made smaller before it is kept: drawn again with its longest side
 * at `maxSide`, its EXIF turn applied by the browser's decoder, written at
 * `quality` — or kept as it is when it is small already, cannot be read, is
 * a kind that is never redrawn, or would not get smaller. jsdom draws
 * nothing: the browser's decoder and canvas are stood in for here, and the
 * browser tests (e2e/uploads.spec.ts) shrink real photos.
 */

const drawn: { width: number; height: number; quality?: number; type?: string }[] = [];
let decoded: { width: number; height: number } = { width: 4000, height: 3000 };
let written = 100;
const asked: unknown[] = [];
beforeEach(() => {
  drawn.length = 0;
  asked.length = 0;
  decoded = { width: 4000, height: 3000 };
  written = 100;
  Object.assign(window, {
    createImageBitmap: async (_file: Blob, options: unknown) => (asked.push(options), { ...decoded, close: () => undefined }),
  });
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    return { drawImage: () => drawn.push({ width: this.width, height: this.height }) } as unknown as CanvasRenderingContext2D;
  } as never;
  // Its toBlob never answers, as Chromium's may not for seconds on a busy machine: each photo is encoded at once
  // (toDataURL) once the cap passed, nothing waiting on it (encode-now.ts).
  HTMLCanvasElement.prototype.toDataURL = function (type?: string, quality?: number) {
    Object.assign(drawn[drawn.length - 1], { type, quality });
    return `data:${type};base64,${btoa('\0'.repeat(written))}`;
  };
  HTMLCanvasElement.prototype.toBlob = () => undefined;
});

const photo = (name: string, type: string, size = 5000) => new File([new Uint8Array(size)], name, { type, lastModified: 7 });

describe('shrinkFor: how a field makes its photos smaller', () => {
  const image = { type: 'image', label: 'Photos' } as Field;
  const binary = { type: 'binary', label: 'Files' } as Field;
  it('makes a picture field’s photos smaller where the source stores files, a file field’s when it says so, and none when it says false', () => {
    expect(shrinkFor(image, true)).toEqual(SHRINK_DEFAULTS);
    expect(shrinkFor(image, false)).toBeNull();
    expect(shrinkFor(binary, true)).toBeNull();
    expect(shrinkFor({ ...binary, shrink: { maxSide: 1600 } } as Field, false)).toEqual({ maxSide: 1600, quality: 0.85 });
    expect(shrinkFor({ ...image, shrink: { quality: 0.7 } } as Field, true)).toEqual({ maxSide: 2048, quality: 0.7 });
    expect(shrinkFor({ ...image, shrink: false } as Field, true)).toBeNull();
  });
});

describe('shrinkPhoto', () => {
  it('draws a large photo again with its longest side at maxSide, its EXIF turn applied, written at quality', async () => {
    const small = await shrinkPhoto(photo('IMG_2041.jpg', 'image/jpeg'), { maxSide: 2048, quality: 0.8 });
    expect(asked).toEqual([{ imageOrientation: 'from-image' }]);
    expect(drawn).toEqual([{ width: 2048, height: 1536, type: 'image/jpeg', quality: 0.8 }]);
    expect([small.name, small.type, small.size, small.lastModified]).toEqual(['IMG_2041.jpg', 'image/jpeg', 100, 7]);
  });

  it('keeps a standing photo standing: its turned sides as the decoder gives them', async () => {
    decoded = { width: 3000, height: 4000 };
    await shrinkPhoto(photo('portrait.jpg', 'image/jpeg'), { maxSide: 1000 });
    expect(drawn[0]).toMatchObject({ width: 750, height: 1000 });
  });

  it('keeps a photo already small as it is, and never makes one larger', async () => {
    decoded = { width: 1600, height: 1200 };
    const file = photo('small.jpg', 'image/jpeg');
    expect(await shrinkPhoto(file, { maxSide: 2048 })).toBe(file);
    expect(drawn).toEqual([]);
  });

  it('keeps the photo when the smaller one would not be smaller in bytes', async () => {
    written = 6000;
    const file = photo('tight.jpg', 'image/jpeg');
    expect(await shrinkPhoto(file)).toBe(file);
  });

  it('keeps a PNG a PNG, and writes a HEIC the browser can read as a JPEG, named so', async () => {
    expect((await shrinkPhoto(photo('plan.png', 'image/png'))).type).toBe('image/png');
    const heic = await shrinkPhoto(photo('IMG_0007.HEIC', 'image/heic'));
    expect([heic.name, heic.type]).toEqual(['IMG_0007.jpg', 'image/jpeg']);
  });

  it('never touches a GIF, an SVG or a PDF, nor a picture it cannot read', async () => {
    for (const file of [photo('wave.gif', 'image/gif'), photo('logo.svg', 'image/svg+xml'), photo('plan.pdf', 'application/pdf')]) expect(await shrinkPhoto(file)).toBe(file);
    expect(asked).toEqual([]);
    Object.assign(window, { createImageBitmap: async () => Promise.reject(new Error('cannot decode')) });
    const unreadable = photo('broken.jpg', 'image/jpeg');
    // jsdom cannot decode it as a picture on the page either.
    expect(await shrinkPhoto(unreadable)).toBe(unreadable);
  });
});
