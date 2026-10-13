import type { IconSet } from './icons';

/**
 * Icons a work item's screen needs, drawn as Fieldia draws icons: the inside
 * of a 24×24 SVG in lines of the text colour.
 */
export const WORK_ICONS: IconSet = {
  attach: '<path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 4-5 4-11 8.5"/>',
  bug: '<path d="M9 7.5a3 3 0 0 1 6 0"/><rect x="6.5" y="7.5" width="11" height="13" rx="5.5"/><path d="M12 11v9.5M6.5 12.5H3M21 12.5h-3.5M6.8 17l-2.8 2M17.2 17l2.8 2M8 8.5L5.5 6M16 8.5L18.5 6"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  'chevron-up': '<path d="M6 15l6-6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  code: '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  emoji: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.01M15 9.5v.01"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  hash: '<path d="M10 3L8 21M16 3l-2 18M4 8.5h16M3.5 15.5h16"/>',
  history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5V9H9M12 8v4.5l3 2"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 16l5-5 4.5 4.5 3-3L21 18"/><circle cx="15.5" cy="9.5" r="1.5"/>',
  maximise: '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>',
  mention: '<circle cx="12" cy="12" r="3.5"/><path d="M15.5 8.5V13a2.5 2.5 0 0 0 5 0v-1a8.5 8.5 0 1 0-3.4 6.8"/>',
  more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  'pull-request': '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v10M18 17v-8a3 3 0 0 0-3-3h-3.5M13.5 3.5L11 6l2.5 2.5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/>',
  restore: '<path d="M19 5l-5 5M14 6v4h4M5 19l5-5M10 18v-4H6"/>',
  save: '<path d="M5 4h11.5L20 7.5V20H5z"/><path d="M8 4v5h8V4M8 20v-6h8v6"/>',
  story: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v14H6.5A1.5 1.5 0 0 0 5 18.5z"/><path d="M5 18.5A1.5 1.5 0 0 0 6.5 20H19"/>',
  task: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 12.5l2 2 4-4"/>',
  undo: '<path d="M9 6L4.5 10.5 9 15"/><path d="M4.5 10.5H15a5 5 0 0 1 0 10h-3"/>',
};
