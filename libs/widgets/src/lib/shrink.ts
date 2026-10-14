import type { Field, LineField, Shrink } from '@fieldia/core';

/**
 * Photos made smaller before they are kept. A phone's photo is 3 to 12 MB:
 * twenty of them on a listing are more than a save on mobile data can carry,
 * and more than a page needs to show. A JPEG, PNG or WebP picture — a HEIC
 * one too, where the browser can read it — whose longest side is over
 * `maxSide` is drawn again that size, its EXIF turn applied so it stands as
 * it was taken, and written at `quality`. One already that small is kept as
 * it is, none is made larger, and the smaller one is taken only when it is
 * smaller in bytes. A GIF (it may move) and an SVG (it has no pixels) are
 * never touched; a picture the browser cannot read is kept as it is.
 */

export interface ShrinkOptions {
  /** The longest side, in pixels: 2048 unless said. */
  maxSide?: number;
  /** How a JPEG or a WebP is written, from 0 to 1: 0.85 unless said. */
  quality?: number;
}

/** What a picture field makes its photos, where the data source stores files and the page says nothing. */
export const SHRINK_DEFAULTS: Required<ShrinkOptions> = { maxSide: 2048, quality: 0.85 };

const SHRINKABLE = /^image\/(jpeg|pjpeg|png|webp|heic|heif|avif)$/i;
/** Whether a file is a photo this can make smaller. */
export const shrinkable = (file: { type: string }) => SHRINKABLE.test(file.type);

/**
 * How a field makes its photos smaller, or null when it keeps them as they
 * are: its own `shrink`, else — for a picture field whose files the data
 * source stores — the usual, else nothing. `false` keeps them always.
 */
export function shrinkFor(field: Field | LineField, storing: boolean): Required<ShrinkOptions> | null {
  const own = (field as { shrink?: Shrink }).shrink;
  if (own === false) return null;
  if (own) return { maxSide: own.maxSide ?? SHRINK_DEFAULTS.maxSide, quality: own.quality ?? SHRINK_DEFAULTS.quality };
  return storing && field.type === 'image' ? SHRINK_DEFAULTS : null;
}

type Picture = { width: number; height: number; source: CanvasImageSource; free(): void };

/** The picture as it stands: its EXIF turn applied, by the browser's own decoder. */
async function read(file: File, doc: Document): Promise<Picture> {
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  if (typeof view?.createImageBitmap === 'function') {
    try {
      const bitmap = await view.createImageBitmap(file, { imageOrientation: 'from-image' });
      return { width: bitmap.width, height: bitmap.height, source: bitmap, free: () => bitmap.close() };
    } catch {
      // Read below, as a picture on the page reads it.
    }
  }
  const url = URL.createObjectURL(file);
  const image = doc.createElement('img');
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  // A picture on the page stands as its EXIF says (image-orientation: from-image), and is drawn so.
  return { width: image.naturalWidth, height: image.naturalHeight, source: image, free: () => URL.revokeObjectURL(url) };
}

/** A photo made smaller, as `ShrinkOptions` say, or the file itself when it is small already, cannot be read, or would not get smaller. */
export async function shrinkPhoto(file: File, options: ShrinkOptions = {}, doc: Document = document): Promise<File> {
  if (!shrinkable(file)) return file;
  const maxSide = options.maxSide ?? SHRINK_DEFAULTS.maxSide;
  const quality = options.quality ?? SHRINK_DEFAULTS.quality;
  let picture: Picture;
  try {
    picture = await read(file, doc);
  } catch {
    return file;
  }
  try {
    const longest = Math.max(picture.width, picture.height);
    if (!longest || longest <= maxSide) return file;
    const scale = maxSide / longest;
    const canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(picture.width * scale));
    canvas.height = Math.max(1, Math.round(picture.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(picture.source, 0, 0, canvas.width, canvas.height);
    // A PNG may be clear in places: it stays a PNG. The rest are written as a JPEG, which every browser and store reads.
    const type = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (!blob || blob.size >= file.size || blob.type !== type) return file;
    const name = type === 'image/jpeg' && !/\.jpe?g$/i.test(file.name) ? `${file.name.replace(/\.[^./]*$/, '')}.jpg` : file.name;
    return new File([blob], name, { type, lastModified: file.lastModified });
  } finally {
    picture.free();
  }
}
