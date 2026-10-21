import { installPartStyles, PART_RANK } from './styles';

/**
 * A photo set (photos.ts) and its crop and turn dialog (photo-editor.ts): the photos part's sheet, put in its place
 * among Fieldia's (installPartStyles, PART_RANK.photos) the first time a page draws one. Its file on its way, its add
 * tile and the dialog a photo opens in are the files part's, whose sheet comes with it.
 *
 * The photos are tiles in a grid, as many to a row as fit — two on a phone — each its photo filling a frame of the
 * page's shape (`--fd-photo-shape`, 4:3 unless it says), the first marked Cover; its tools over its corner, seen as
 * the pointer rests on it or a key reaches it, always on a screen with no pointer to rest; its caption under it. A tile
 * lifted to be moved stands out from the rest, which make room for it as it passes them. A photo cropped on its way to
 * the store has its bar over its foot, as a tile's file on its way does. The dialog draws the photo on a dark ground,
 * the part kept clear and the rest dimmed, a handle at each corner. Colours are the form's tokens, so dark follows.
 */
export const PHOTOS_CSS = /* css */ `
/* ---- a photo set: the photos as tiles, the first the cover ---------------------------------------------------- */
.fd-photos { --fd-photo-shape: 4 / 3; justify-items: stretch; }
.fd-photos-bar { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 12px; }
.fd-photos-bar .fd-help { margin: 0; }
/* How a photo is moved: a finger's way where the screen is touched, the mouse's and the keys' elsewhere. */
.fd-photos-how-touch { display: none; }
@media (hover: none), (pointer: coarse) {
  .fd-photos-how-keys { display: none; }
  .fd-photos-how-touch { display: inline; }
}
.fd-photos-list {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr)); gap: 12px;
  list-style: none; margin: 0; padding: 0; min-width: 0;
}
@container (max-width: 520px) { .fd-photos-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } }
.fd-photo { position: relative; display: grid; align-content: start; gap: 6px; min-width: 0; }
.fd-photo-frame {
  position: relative; aspect-ratio: var(--fd-photo-shape); overflow: hidden; border-radius: var(--fd-control-radius);
  background: var(--fd-page); box-shadow: 0 0 0 1px var(--fd-border);
}
.fd-photo-frame:has(.fd-photo-open:focus-visible) { box-shadow: 0 0 0 2px var(--fd-focus); }
.fd-photo-open {
  position: absolute; inset: 0; display: block; width: 100%; height: 100%; padding: 0; border: 0; background: none;
  font: inherit; color: inherit; cursor: grab; touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
}
.fd-photo-open:focus-visible { outline: none; }
.fd-photos[data-readonly] .fd-photo-open { cursor: zoom-in; }
.fd-photo-open img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; -webkit-user-drag: none; }
/* A photo the browser cannot draw: its kind's page, on the frame's ground. */
.fd-photo-open .fd-file-icon { position: absolute; inset: 0; margin: auto; width: 44px; height: 56px; padding-block-end: 8px; font-size: 12px; }
.fd-photo-cover {
  position: absolute; inset-block-start: 6px; inset-inline-start: 6px; display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 9px 2px 6px; border-radius: 999px; background: var(--fd-accent); color: var(--fd-accent-text);
  font-size: 12px; font-weight: 600; line-height: 18px; pointer-events: none; box-shadow: 0 1px 3px rgba(15, 20, 25, 0.3);
}
.fd-photo-cover svg { width: 13px; height: 13px; }
.fd-photo-tools { position: absolute; inset-block-start: 6px; inset-inline-end: 6px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.12s; }
.fd-photo:is(:hover, :focus-within) .fd-photo-tools, .fd-photos[data-readonly] .fd-photo-tools { opacity: 1; }
/* A screen touched shows each photo's tools, as large as a finger presses. */
@media (hover: none), (pointer: coarse) {
  .fd-photo-tools { opacity: 1; }
  .fd-photo-tool { width: 36px; height: 36px; }
}
.fd-photo-tool {
  display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 999px;
  background: rgba(15, 20, 25, 0.62); color: #fff; font: inherit; font-size: 19px; line-height: 1; cursor: pointer;
}
.fd-photo-tool:hover { background: rgba(15, 20, 25, 0.85); }
.fd-photo-tool:focus-visible { outline: 2px solid #fff; outline-offset: 0; box-shadow: 0 0 0 4px var(--fd-focus); }
.fd-photo-tool svg { width: 17px; height: 17px; }
.fd-photo-caption { width: 100%; min-width: 0; }
.fd-photo-words { margin: 0; font-size: 13px; overflow-wrap: anywhere; }
.fd-photo-words:empty { display: none; }
/* Lifted to be moved: it stands out, and the rest make room for it as it passes them. */
.fd-photo[data-lifted] { z-index: 2; }
.fd-photo[data-lifted] .fd-photo-frame { box-shadow: 0 0 0 2px var(--fd-accent), 0 14px 30px rgba(15, 20, 25, 0.3); transform: scale(1.03); }
.fd-photo[data-lifted] .fd-photo-tools { opacity: 0; }
.fd-photos[data-moving], .fd-photos[data-moving] * { cursor: grabbing !important; }
@media (prefers-reduced-motion: no-preference) { .fd-photo-frame { transition: transform 0.12s, box-shadow 0.12s; } }
/* A photo cropped, on its way to the store: its bar over its foot. */
.fd-photo-going {
  position: absolute; inset-inline: 6px; inset-block-end: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px;
  padding: 4px 8px; border-radius: 4px; background: var(--fd-surface); box-shadow: 0 0 0 1px var(--fd-border); color: var(--fd-muted); font-size: 12px;
}
.fd-photo-going .fd-file-progress { flex: 1 1 100%; }
.fd-photo-going[data-status="failed"] .fd-file-state { color: var(--fd-error); }
/* A photo picked, on its way: a tile as the rest, its bar under its picture. */
.fd-photos-list .fd-file-going { align-items: stretch; }
.fd-photos-list .fd-file-going > .fd-file-open { flex-direction: column; align-items: stretch; flex-wrap: nowrap; gap: 2px; padding: 0 0 8px; overflow: hidden; }
.fd-photos-list .fd-file-going .fd-file-picture { aspect-ratio: var(--fd-photo-shape); margin-block-end: 6px; }
.fd-photos-list .fd-file-going .fd-file-thumb { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 0; }
.fd-photos-list .fd-file-going :is(.fd-file-name, .fd-file-size) { padding-inline: 8px; }
.fd-photos-list .fd-file-going .fd-file-name { flex: none; font-size: 13px; }
.fd-photos-list .fd-file-going .fd-file-progress-box { flex: none; padding: 4px 8px 0; }
.fd-photos-list .fd-file-going .fd-file-progress { flex-basis: 100%; }
.fd-photos-list .fd-file-going .fd-file-cancel {
  position: absolute; inset-block-start: 4px; inset-inline-end: 4px; width: 28px; height: 28px; font-size: 18px; background: rgba(15, 20, 25, 0.62); color: #fff;
}
/* The tile that adds photos, last of them: a photo's frame, its caption's room left empty. */
.fd-photos-add { display: grid; align-content: start; }
.fd-photos-add .fd-image-pick { width: 100%; height: auto; min-height: 96px; aspect-ratio: var(--fd-photo-shape); }
.fd-photos.fd-dragging .fd-photos-add .fd-image-pick { border-color: var(--fd-accent); }

/* ---- a photo cropped and turned: its dialog ------------------------------------------------------------------- */
.fd-photo-editor { max-width: 820px; }
.fd-photo-editor-body { display: grid; gap: 12px; padding: 14px 16px; overflow: auto; background: var(--fd-surface); }
.fd-photo-stage { display: grid; place-items: center; min-height: 220px; padding: 14px; border-radius: var(--fd-control-radius); background: #1b2026; color: #e9edf2; }
.fd-photo-stage > p { margin: 0; text-align: center; }
/* The picture and the part kept, in the picture's own directions, right to left too. */
.fd-photo-picture { position: relative; direction: ltr; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; }
.fd-photo-picture canvas { display: block; width: 100%; height: 100%; }
.fd-photo-crop {
  position: absolute; cursor: move; touch-action: none; outline: 1px solid rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 9999px rgba(10, 12, 15, 0.58);
  background-image: linear-gradient(rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.35)), linear-gradient(rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.35)),
    linear-gradient(90deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.35)), linear-gradient(90deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.35));
  background-size: 100% 1px, 100% 1px, 1px 100%, 1px 100%;
  background-position: 0 33.33%, 0 66.67%, 33.33% 0, 66.67% 0;
  background-repeat: no-repeat;
}
.fd-photo-crop:focus-visible { outline: 3px solid var(--fd-focus); outline-offset: 2px; }
.fd-photo-handle { position: absolute; width: 24px; height: 24px; border: 0 solid #fff; touch-action: none; }
.fd-photo-handle[data-corner="nw"] { left: -5px; top: -5px; border-left-width: 4px; border-top-width: 4px; cursor: nwse-resize; }
.fd-photo-handle[data-corner="ne"] { right: -5px; top: -5px; border-right-width: 4px; border-top-width: 4px; cursor: nesw-resize; }
.fd-photo-handle[data-corner="sw"] { left: -5px; bottom: -5px; border-left-width: 4px; border-bottom-width: 4px; cursor: nesw-resize; }
.fd-photo-handle[data-corner="se"] { right: -5px; bottom: -5px; border-right-width: 4px; border-bottom-width: 4px; cursor: nwse-resize; }
.fd-photo-editor-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.fd-photo-turns, .fd-photo-shapes { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.fd-photo-turns .fd-button { display: inline-flex; align-items: center; gap: 6px; }
.fd-photo-turns svg { width: 17px; height: 17px; }
.fd-photo-shapes > span { margin-inline-end: 4px; color: var(--fd-muted); font-size: 13px; }
.fd-photo-shapes button { min-height: 30px; padding: 2px 10px; font-variant-numeric: tabular-nums; }
.fd-photo-shapes [aria-pressed="true"] { border-color: var(--fd-accent); background: var(--fd-accent-soft); color: var(--fd-text); }
.fd-photo-editor-said { margin: 0; color: var(--fd-error); }
.fd-photo-editor-said:empty { display: none; }
.fd-photo-editor-foot { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.fd-photo-editor-foot .fd-photo-original { margin-inline-end: auto; }
`;

/** Put the photo set's sheet in a document, once, in its place among Fieldia's. */
export function installPhotosStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-photos-styles', PHOTOS_CSS, PART_RANK.photos);
}
