import { fill, type FileValue, type PhotoEdit } from '@fieldia/core';
import { bytesOf } from './file-shown';
import { keepTabIn } from './focus-trap';
import { drawIcon, type IconSet } from './icons';
import { maker, setHidden, setText } from './kind-parts';
import type { WidgetLabels } from './labels';
import type { Picture } from './shrink';
import { installPhotosStyles } from './styles-photos';

/**
 * A photo of a photo set cropped and turned in place (photos.ts): in a dialog over the form, the photo drawn on a
 * canvas — turned a quarter at a time with Turn left and Turn right — and the part kept drawn over it, clear, the rest
 * dimmed: dragged to move it, by a corner to size it, or with the arrow keys (Shift and an arrow to size it), kept to
 * the page's shape, or to one the person picks where it says none. Apply draws the part kept at the photo's own
 * pixels, as a new picture: the photo set keeps it in the photo's place, and the photo as it was beside it — an edit
 * always starts from that original, so cropping again loses nothing. Put back the original makes it the photo again.
 *
 * A photo the page cannot read — at an address of another site that does not let it — is said so, with nothing to
 * apply. The geometry is plain functions (`fitted`, `turnedCrop`, `moved`, `sized`), each in fractions of the turned
 * photo's width and height, so the part kept stays where it was whatever size the dialog draws it at.
 */

/** The part of a photo kept, as fractions (0 to 1) of the turned photo's width and height, from its top left. */
export type Crop = PhotoEdit['crop'];
type Size = { width: number; height: number };
type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** The least a crop keeps of either side: a twentieth. */
const LEAST = 0.05;
const clamp = (value: number, least: number, most: number) => Math.min(most, Math.max(least, value));

/** A photo's size once turned: a quarter turn swaps its sides. */
export const turnedSize = (size: Size, turn: number): Size => (turn % 180 ? { width: size.height, height: size.width } : size);

/** The largest part of a shape (its width over its height, in pixels) in the middle of a photo of `size`; all of it for none. */
export function fitted(size: Size, shape: number | null): Crop {
  if (!shape) return { x: 0, y: 0, width: 1, height: 1 };
  const ratio = size.width / size.height;
  if (ratio > shape) {
    const width = shape / ratio;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = ratio / shape;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

/** The part kept as the photo turns with it, a quarter clockwise (90) or back (-90). */
export function turnedCrop(crop: Crop, by: 90 | -90): Crop {
  return by === 90 ? { x: 1 - crop.y - crop.height, y: crop.x, width: crop.height, height: crop.width } : { x: crop.y, y: 1 - crop.x - crop.width, width: crop.height, height: crop.width };
}

/** The part kept moved by `dx`, `dy` (fractions), never past the photo's edges. */
export const moved = (crop: Crop, dx: number, dy: number): Crop => ({ ...crop, x: clamp(crop.x + dx, 0, 1 - crop.width), y: clamp(crop.y + dy, 0, 1 - crop.height) });

/**
 * The part kept sized by a corner dragged `dx`, `dy` (fractions), the opposite corner staying where it is: within the
 * photo, never less than a twentieth of a side, and of the shape where there is one — following the side the pointer
 * moved the more of.
 */
export function sized(crop: Crop, corner: Corner, dx: number, dy: number, shape: number | null, size: Size): Crop {
  const west = corner[1] === 'w';
  const north = corner[0] === 'n';
  // The corner that stays, and the room from it to the photo's edges.
  const ax = west ? crop.x + crop.width : crop.x;
  const ay = north ? crop.y + crop.height : crop.y;
  const roomX = west ? ax : 1 - ax;
  const roomY = north ? ay : 1 - ay;
  let width = crop.width + (west ? -dx : dx);
  let height = crop.height + (north ? -dy : dy);
  if (shape) {
    // A part's height for its width, in fractions, for the shape to hold in pixels.
    const tall = size.width / (shape * size.height);
    width = Math.abs(dx) / crop.width >= Math.abs(dy) / crop.height ? width : height / tall;
    width = clamp(width, Math.min(Math.max(LEAST, LEAST / tall), roomX, roomY / tall), Math.min(roomX, roomY / tall));
    height = width * tall;
  } else {
    width = clamp(width, Math.min(LEAST, roomX), roomX);
    height = clamp(height, Math.min(LEAST, roomY), roomY);
  }
  return { x: west ? ax - width : ax, y: north ? ay - height : ay, width, height };
}

/** Whether a part kept is of a shape, to within a hundredth. */
const ofShape = (crop: Crop, size: Size, shape: number) => Math.abs((crop.width * size.width) / (crop.height * size.height) / shape - 1) < 0.01;

/** Draw a photo turned (clockwise, in degrees) on a canvas the size of the turned photo, from its top left. */
function drawTurned(c: CanvasRenderingContext2D, picture: Picture, turn: number): void {
  const turned = turnedSize(picture, turn);
  if (turn === 90) c.translate(turned.width, 0);
  else if (turn === 180) c.translate(turned.width, turned.height);
  else if (turn === 270) c.translate(0, turned.height);
  c.rotate((turn * Math.PI) / 180);
  c.drawImage(picture.source, 0, 0, picture.width, picture.height);
}

/** The part kept of a photo turned, drawn at the photo's own pixels on a canvas of its own: null where the browser draws none. */
export function drawEdited(doc: Document, picture: Picture, edit: PhotoEdit): HTMLCanvasElement | null {
  const turned = turnedSize(picture, edit.turn);
  const canvas = doc.createElement('canvas');
  canvas.width = Math.max(1, Math.round(edit.crop.width * turned.width));
  canvas.height = Math.max(1, Math.round(edit.crop.height * turned.height));
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.imageSmoothingQuality = 'high';
  c.translate(-edit.crop.x * turned.width, -edit.crop.y * turned.height);
  drawTurned(c, picture, edit.turn);
  return canvas;
}

/** The bytes of a photo as a set holds it: its own, or fetched from where it is kept — refused where its site does not let the page read it. */
async function bytesOfPhoto(photo: FileValue): Promise<Blob> {
  const bytes = bytesOf(photo);
  if (bytes) return new Blob([bytes], { type: photo.type });
  if (!photo.url) throw new Error(`${photo.name} has no bytes and no address`);
  const answer = await fetch(photo.url, { mode: 'cors', credentials: 'same-origin' });
  if (!answer.ok) throw new Error(`${answer.status}`);
  return answer.blob();
}

/** Shapes a person may pick where the page names none: width over height. */
const SHAPES: [string, number][] = [['1:1', 1], ['4:3', 4 / 3], ['3:2', 3 / 2], ['16:9', 16 / 9], ['3:4', 3 / 4]];

/** The dialog's icons: a quarter turn back and on. */
const TURNS: IconSet = {
  'turn-left': '<path d="M4 4v5h5"/><path d="M4.6 9A8 8 0 1 1 6 16"/>',
  'turn-right': '<path d="M20 4v5h-5"/><path d="M19.4 9A8 8 0 1 0 18 16"/>',
};

/** What a crop and turn is given: the photo, its words, where it opens and how its photo is read. */
export interface PhotoEditing {
  doc: Document;
  words: WidgetLabels;
  /** Its title's id. */
  id: string;
  /** The photo as the set holds it: its original, where it keeps one, is what is cropped. */
  photo: FileValue;
  /** The page's shape, width over height; null lets the person pick one, or none. */
  shape: number | null;
  /** What it opens over: the form round it, whose skin, scheme and direction it wears, else the page's body. */
  home: Element;
  /** Reads a picture's pixels: the files part's (`readPicture`). */
  read(blob: Blob, doc: Document): Promise<Picture>;
}

/** What came of it: the new picture and what was done to the original, the original put back, or nothing (Cancel, Escape, ×). */
export type Edited = { file: File; edit: PhotoEdit } | { original: true } | null;

/** A photo cropped and turned in a dialog: its answer once the dialog is closed. */
export function editPhoto(editing: PhotoEditing): Promise<Edited> {
  const { doc, words, photo } = editing;
  installPhotosStyles(doc);
  const make = maker(doc);
  const from = photo.original ?? photo;
  const view = doc.defaultView;
  let picture: Picture | null = null;
  let turn: PhotoEdit['turn'] = photo.original && photo.edit ? photo.edit.turn : 0;
  let crop: Crop = { x: 0, y: 0, width: 1, height: 1 };
  let shape = editing.shape;

  const title = make('h2', { id: editing.id, class: 'fd-form-dialog-title' }, fill(words.editPhoto, { name: photo.caption || photo.name }));
  const close = make('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': words.close }, '×');
  const canvas = make('canvas', { 'aria-hidden': 'true' });
  const keysId = `${editing.id}-keys`;
  const box = make('div', { class: 'fd-photo-crop', tabindex: '0', role: 'group', 'aria-label': words.cropArea, 'aria-describedby': keysId }, ...(['nw', 'ne', 'sw', 'se'] as const).map((corner) => make('span', { class: 'fd-photo-handle', 'data-corner': corner, 'aria-hidden': 'true' })));
  const pictured = make('div', { class: 'fd-photo-picture', hidden: '' }, canvas, box);
  const waiting = make('p', {}, words.photoLoading);
  const stage = make('div', { class: 'fd-photo-stage' }, waiting, pictured);
  const turnButton = (name: string, label: string) => make('button', { type: 'button', class: 'fd-button' }, drawIcon(doc, name, TURNS) as SVGSVGElement, label);
  const left = turnButton('turn-left', words.turnLeft);
  const right = turnButton('turn-right', words.turnRight);
  const shapes: [HTMLButtonElement, number | null][] = [[make('button', { type: 'button', class: 'fd-button' }, words.cropAny), null], ...SHAPES.map(([label, ratio]): [HTMLButtonElement, number] => [make('button', { type: 'button', class: 'fd-button', dir: 'ltr' }, label), ratio])];
  const shapeGroup = make('div', { class: 'fd-photo-shapes', role: 'group', 'aria-label': words.cropShape }, make('span', { 'aria-hidden': 'true' }, words.cropShape), ...shapes.map(([button]) => button));
  // The page's own shape is no choice of the person's: hidden, never offered.
  shapeGroup.hidden = editing.shape !== null;
  const tools = make('div', { class: 'fd-photo-editor-tools', hidden: '' }, make('div', { class: 'fd-photo-turns' }, left, right), shapeGroup);
  const keys = make('p', { id: keysId, class: 'fd-help', hidden: '' }, words.cropKeys);
  const said = make('p', { class: 'fd-photo-editor-said', role: 'status' });
  const original = make('button', { type: 'button', class: 'fd-button fd-photo-original' }, words.putBackOriginal);
  original.hidden = !photo.original;
  const cancel = make('button', { type: 'button', class: 'fd-button' }, words.cancel);
  const apply = make('button', { type: 'button', class: 'fd-button fd-button-primary', hidden: '' }, words.applyEdit);
  const dialog = make(
    'div',
    { class: 'fd-form-dialog fd-photo-editor', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': editing.id, tabindex: '-1' },
    make('div', { class: 'fd-form-dialog-head' }, title, close),
    make('div', { class: 'fd-photo-editor-body' }, stage, tools, keys, said),
    make('div', { class: 'fd-form-dialog-foot fd-photo-editor-foot' }, original, cancel, apply)
  );
  const backdrop = make('div', { class: 'fd-dialog-backdrop' }, dialog);

  const turned = (): Size => (picture ? turnedSize(picture, turn) : { width: 1, height: 1 });
  /** The part kept, where it is drawn over the photo: in shares of the photo drawn, so it holds whatever size that is. */
  function place() {
    box.style.left = `${crop.x * 100}%`;
    box.style.top = `${crop.y * 100}%`;
    box.style.width = `${crop.width * 100}%`;
    box.style.height = `${crop.height * 100}%`;
    for (const [button, ratio] of shapes) button.setAttribute('aria-pressed', String(ratio === shape));
  }
  /** The photo turned, drawn as large as the dialog has room for. */
  function draw() {
    if (!picture) return;
    const size = turned();
    const room = { width: Math.max(160, Math.min(760, (view?.innerWidth ?? 800) - 96)), height: Math.max(160, Math.min(520, (view?.innerHeight ?? 700) * 0.55)) };
    const scale = Math.min(room.width / size.width, room.height / size.height, 1);
    const shown = { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) };
    pictured.style.width = `${shown.width}px`;
    pictured.style.height = `${shown.height}px`;
    const sharp = Math.min(2, view?.devicePixelRatio ?? 1);
    canvas.width = Math.round(shown.width * sharp);
    canvas.height = Math.round(shown.height * sharp);
    const c = canvas.getContext('2d');
    if (c) {
      c.scale((shown.width * sharp) / size.width, (shown.height * sharp) / size.height);
      drawTurned(c, picture, turn);
    }
    place();
  }
  function turnBy(by: 90 | -90) {
    turn = (((turn + by) % 360) + 360) % 360 as PhotoEdit['turn'];
    crop = shape && picture ? fitted(turned(), shape) : turnedCrop(crop, by);
    draw();
  }
  left.addEventListener('click', () => turnBy(-90));
  right.addEventListener('click', () => turnBy(90));
  for (const [button, ratio] of shapes) {
    button.addEventListener('click', () => {
      shape = ratio;
      crop = fitted(turned(), ratio);
      place();
    });
  }

  // Dragged by the pointer: the part itself moves it, a corner sizes it — a finger alike, the page never scrolled under it.
  box.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !picture) return;
    event.preventDefault();
    const corner = (event.target as Element).closest<HTMLElement>('.fd-photo-handle')?.dataset['corner'] as Corner | undefined;
    const start = { x: event.clientX, y: event.clientY, crop };
    const frame = pictured.getBoundingClientRect();
    box.setPointerCapture?.(event.pointerId);
    box.focus({ preventScroll: true });
    const follow = (e: PointerEvent) => {
      const dx = (e.clientX - start.x) / frame.width;
      const dy = (e.clientY - start.y) / frame.height;
      crop = corner ? sized(start.crop, corner, dx, dy, shape, turned()) : moved(start.crop, dx, dy);
      place();
    };
    const end = () => {
      box.removeEventListener('pointermove', follow);
      box.removeEventListener('pointerup', end);
      box.removeEventListener('pointercancel', end);
    };
    box.addEventListener('pointermove', follow);
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
  });
  // Keys: the arrows move it a hundredth at a time; with Shift, its far corner sizes it.
  box.addEventListener('keydown', (event) => {
    const step = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[event.key];
    if (!step || event.altKey || event.ctrlKey || event.metaKey || !picture) return;
    event.preventDefault();
    const [dx, dy] = [step[0] / 100, step[1] / 100];
    crop = event.shiftKey ? sized(crop, 'se', dx, dy, shape, turned()) : moved(crop, dx, dy);
    place();
  });

  let answered: (result: Edited) => void = () => undefined;
  const done = (result: Edited) => {
    picture?.free();
    picture = null;
    backdrop.remove();
    view?.removeEventListener('resize', draw);
    answered(result);
  };
  close.addEventListener('click', () => done(null));
  cancel.addEventListener('click', () => done(null));
  original.addEventListener('click', () => done({ original: true }));
  backdrop.addEventListener('click', (event) => event.target === backdrop && done(null));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      // The dialog's own: the form's page or dialog behind it hears nothing of it.
      event.stopPropagation();
      done(null);
    } else keepTabIn(dialog, event);
  });
  apply.addEventListener('click', async () => {
    if (!picture) return;
    const edit: PhotoEdit = { turn, crop: { ...crop } };
    const made = drawEdited(doc, picture, edit);
    // A PNG or a WebP stays one, a picture that may be clear in places; the rest are written as a JPEG.
    const type = /^image\/(png|webp)$/.test(from.type) ? from.type : 'image/jpeg';
    const blob = made ? await new Promise<Blob | null>((resolve) => {
      try {
        made.toBlob(resolve, type, 0.92);
      } catch {
        resolve(null);
      }
    }) : null;
    if (!blob) return setText(said, words.photoNotMade);
    const name = blob.type === from.type ? from.name : `${from.name.replace(/\.[^./]*$/, '')}.${blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
    done({ file: new File([blob], name, { type: blob.type }), edit });
  });

  // The photo read: drawn, the part kept as it was cropped last, else as the page's shape has it, else all of it.
  bytesOfPhoto(from)
    .then((blob) => editing.read(blob, doc))
    .then(
      (read) => {
        if (!backdrop.isConnected) return read.free();
        picture = read;
        const size = turned();
        const last = photo.original && photo.edit ? photo.edit.crop : null;
        crop = last && (!shape || ofShape(last, size, shape)) ? { ...last } : fitted(size, shape);
        waiting.remove();
        for (const shown of [pictured, tools, keys, apply]) setHidden(shown, false);
        draw();
        view?.addEventListener('resize', draw);
        box.focus({ preventScroll: true });
      },
      () => setText(waiting, words.photoUnreadable)
    );

  installPhotosStyles(doc);
  (editing.home.closest('.fd-form') ?? doc.body).append(backdrop);
  dialog.focus();
  return new Promise<Edited>((resolve) => (answered = resolve));
}
