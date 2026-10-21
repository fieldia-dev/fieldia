/**
 * The photos part (parts.ts): a photo set — a picture field of several photos drawn as `"widget": "photos"` — its tiles,
 * their order dragged or moved by keys, the cover, captions (photos.ts), a photo cropped and turned in its dialog
 * (photo-editor.ts), and their sheet (styles-photos.ts). Loaded the first time a page shows one, through `photosPart`,
 * with the files part, whose taking of photos, files on their way, dialog and sheet it draws with; never for a page
 * whose pictures are a plain picture field's. The form's own side — the order, the captions and an edit's original
 * kept in the value, a crop stored for its bytes — is @fieldia/core's, whatever draws it.
 *
 * An app crops a photo its own way with the same geometry: `drawEdited(document, picture, { turn, crop })`.
 */
export { photosWidget } from './photos';
export { editPhoto, drawEdited, fitted, moved, sized, turnedCrop, turnedSize, type Crop, type Edited, type PhotoEditing } from './photo-editor';
export { installPhotosStyles } from './styles-photos';
