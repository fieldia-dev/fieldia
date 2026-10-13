import type { IconSet } from './icons';

/** A drawing on a 16px grid in lines one pixel wide at 16px, whatever stroke the box is given, in the 24×24 box. */
export const fine = (drawing: string): string => `<g transform="scale(1.5)" stroke-width="1">${drawing}</g>`;

/**
 * Icons a work item's screen needs, drawn as Fieldia draws icons: the inside
 * of a 24×24 SVG in lines of the text colour.
 */
export const WORK_ICONS: IconSet = {
  // The finer ones are drawn on a 16px grid in one-pixel lines (scaled to the 24 of the box), as a tracker's head has them.
  // A paperclip in one line, on the slant: its free end, the wide loop at the top, back down to the small one, up again.
  attach: fine('<path d="M4 7.5l4.7-4.3a3 3 0 0 1 4.2 4.2L6.6 13a1.4 1.4 0 0 1-2-2L10 5.4"/>'),
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 4-5 4-11 8.5"/>',
  // A ladybird, filled in the kind's colour: its head a ring, four spots and the seam between its wings cut out of it.
  bug: '<g fill="currentColor" stroke="none" fill-rule="evenodd"><path d="M7.4 3.2h9.2v6.4H7.4zM9.6 5.2v2.6h4.8V5.2z"/><path d="M3.1 15.5a8.9 7.1 0 1 0 17.8 0a8.9 7.1 0 1 0-17.8 0zM7.6 11.6h3v3h-3zM13.4 11.6h3v3h-3zM5.4 16.4h3v3h-3zM15.6 16.4h3v3h-3zM11.55 16.2h.9v6h-.9z"/></g><path d="M7.9 3.6L6.8 1.8M16.1 3.6l1.1-1.8M8.4 21.6l-.8 1.6M15.6 21.6l.8 1.6" stroke-width="1.6"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  'chevron-up': '<path d="M6 15l6-6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  code: '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5"/>',
  // Two tall pages: the front one up and to the end, the one behind it showing at its start and foot.
  copy: fine('<rect x="5.5" y="2.5" width="7" height="9" rx="1"/><path d="M3.5 4.5v7a2 2 0 0 0 2 2h5"/>'),
  emoji: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.01M15 9.5v.01"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  // An eye under its lid: the lid's arc and the pupil below it, no lower lid.
  eye: fine('<path d="M1.5 7.5a6 4 0 0 1 12 0"/><circle cx="7.5" cy="8.5" r="2"/>'),
  // A filter as a work tracker draws one: three lines, each shorter than the one over it.
  'filter-lines': '<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  hash: '<path d="M10 3L8 21M16 3l-2 18M4 8.5h16M3.5 15.5h16"/>',
  history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5V9H9M12 8v4.5l3 2"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 16l5-5 4.5 4.5 3-3L21 18"/><circle cx="15.5" cy="9.5" r="1.5"/>',
  maximise: '<path d="M3.5 20.5l17-17M13.5 3.5h7v7M10.5 20.5h-7v-7"/>',
  mention: '<circle cx="12" cy="12" r="3.5"/><path d="M15.5 8.5V13a2.5 2.5 0 0 0 5 0v-1a8.5 8.5 0 1 0-3.4 6.8"/>',
  more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  'pull-request': '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v10M18 17v-8a3 3 0 0 0-3-3h-3.5M13.5 3.5L11 6l2.5 2.5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/>',
  restore: '<path d="M19 5l-5 5M14 6v4h4M5 19l5-5M10 18v-4H6"/>',
  save: '<path d="M5 4h11.5L20 7.5V20H5z"/><path d="M8 4v5h8V4M8 20v-6h8v6"/>',
  story: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v14H6.5A1.5 1.5 0 0 0 5 18.5z"/><path d="M5 18.5A1.5 1.5 0 0 0 6.5 20H19"/>',
  task: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 12.5l2 2 4-4"/>',
  // Back: an L-shaped arrowhead at the top start, its tail going up and over and down to the foot.
  undo: fine('<path d="M3.5 1.5v5h5M4 6l3.6-3.6a3.3 3.3 0 0 1 4.8 4.6L8.5 12.5"/>'),
};
