/**
 * A picture from the person's computer, made fit to keep in a page as a
 * data: address: one wider than 1200 px is drawn again 1200 px wide, in its
 * own kind — a photo stays a JPEG, a WebP a WebP, anything else a PNG — so a
 * phone's 4000 px photo does not weigh down every form that shows it. A
 * drawing (SVG) is kept as it is, and so is a picture already narrow enough.
 */

export const WIDEST_PICTURE = 1200;

const read = (file: Blob) =>
  new Promise<string>((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => done(String(reader.result ?? ''));
    reader.onerror = () => fail(reader.error);
    reader.readAsDataURL(file);
  });

export async function pictureForPage(file: File, doc: Document): Promise<string> {
  const original = await read(file);
  if (file.type === 'image/svg+xml') return original;
  const image = doc.createElement('img');
  await new Promise((done, fail) => {
    image.onload = done;
    image.onerror = fail;
    image.src = original;
  });
  if (image.naturalWidth <= WIDEST_PICTURE) return original;
  const canvas = doc.createElement('canvas');
  canvas.width = WIDEST_PICTURE;
  canvas.height = Math.round((image.naturalHeight * WIDEST_PICTURE) / image.naturalWidth);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  const kind = file.type === 'image/jpeg' || file.type === 'image/webp' ? file.type : 'image/png';
  return canvas.toDataURL(kind, 0.85);
}
