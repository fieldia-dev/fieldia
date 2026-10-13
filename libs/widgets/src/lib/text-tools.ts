import { drawIcon, type IconSet } from './icons';
import type { WidgetLabels } from './labels';

/**
 * A formatted text's tools: what each is called, how it is drawn, and in
 * which order a page lists them. Icons are 16px lines in the words' colour;
 * a list's marks and an indent's arrow take the accent, a highlight and a
 * text colour show the colour they give, as an editor's toolbar draws them.
 */

export type TextTool =
  | 'bold' | 'italic' | 'underline' | 'bulletList' | 'numberList' | 'highlight' | 'colour' | 'emoji' | 'outdent' | 'indent'
  | 'strike' | 'size' | 'code' | 'mention' | 'reference' | 'clearFormatting' | 'image' | 'link' | 'unlink' | 'taskList' | 'heading' | 'attach';

export const TEXT_TOOLS: readonly TextTool[] = [
  'bold', 'italic', 'underline', 'bulletList', 'numberList', 'highlight', 'colour', 'emoji', 'outdent', 'indent',
  'strike', 'size', 'code', 'mention', 'reference', 'clearFormatting', 'image', 'link', 'unlink', 'taskList', 'heading', 'attach',
];

/** The rich editor's tools when a page names none: bold to Remove link, as a work item's System Info has them. */
export const RICH_TOOLS: readonly TextTool[] = ['bold', 'italic', 'underline', 'bulletList', 'numberList', 'highlight', 'colour', 'emoji', 'outdent', 'indent', 'strike', 'size', 'code', 'mention', 'reference', 'clearFormatting', 'image', 'link', 'unlink'];
/** The Markdown editor's: a mention and links to records first, then the marks, the lists last. */
export const MARKDOWN_TOOLS: readonly TextTool[] = ['mention', 'reference', 'attach', 'highlight', 'heading', 'bold', 'italic', 'code', 'link', 'bulletList', 'numberList', 'taskList'];

/** Tools that open a list of choices: a colour, a size, a heading's level, an emoji. */
export const CHOOSING: ReadonlySet<TextTool> = new Set(['highlight', 'colour', 'size', 'heading', 'emoji']);
/** Tools whose button says whether the selection already has their format. */
export const TOGGLES: ReadonlySet<TextTool> = new Set(['bold', 'italic', 'underline', 'strike']);

/** Each tool's name, in the page's language. */
export function toolLabel(tool: TextTool, labels: WidgetLabels): string {
  const key: Record<TextTool, keyof WidgetLabels> = {
    bold: 'bold', italic: 'italic', underline: 'underline', bulletList: 'bulletList', numberList: 'numberList', highlight: 'highlight', colour: 'textColour',
    emoji: 'emoji', outdent: 'outdent', indent: 'indent', strike: 'strike', size: 'textSize', code: 'code', mention: 'mention', reference: 'linkRecordNamed',
    clearFormatting: 'clearFormatting', image: 'image', link: 'link', unlink: 'removeLink', taskList: 'taskList', heading: 'heading', attach: 'attachFile',
  };
  return labels[key[tool]];
}

const PATHS: Partial<Record<TextTool, string>> = {
  italic: '<path d="M7 2.5h5.5M3.5 13.5H9M9.8 2.5l-3.6 11"/>',
  underline: '<path d="M4.5 2v5.5a3.5 3.5 0 0 0 7 0V2M3.5 14.5h9"/>',
  bulletList: '<path d="M5.5 3.5h9M5.5 8h9M5.5 12.5h9"/><g class="fd-text-accent"><circle cx="2.2" cy="3.5" r="1"/><circle cx="2.2" cy="8" r="1"/><circle cx="2.2" cy="12.5" r="1"/></g>',
  numberList: '<path d="M6 3.5h8.5M6 8h8.5M6 12.5h8.5"/><path class="fd-text-accent-line" d="M1.8 1.8l1-.6v3.6M1.5 6.6c.4-.6 2-.6 2 .4 0 .8-2 1.4-2 2.3h2.1M1.6 11.2h1.9l-1 1.3c.8 0 1.2.4 1.2 1s-.6 1-1.2 1c-.4 0-.8-.2-1-.5"/>',
  highlight: '<path d="M1.6 2.6c.3-.4.8-.6 1.3-.6.8 0 1.3.5 1.3 1.3V6.6M4.2 4.4c-1.9-.1-2.9.4-2.9 1.2 0 .6.4 1 1 1 1 0 1.9-.6 1.9-1.6M5.9 .9v5.7M5.9 4.3c.2-.9.8-1.4 1.5-1.4.9 0 1.4.8 1.4 1.9s-.5 1.9-1.4 1.9c-.7 0-1.3-.5-1.5-1.4"/><path d="M5.4 13.4l.7-2.6 6.6-6.6 1.9 1.9-6.6 6.6z"/><rect class="fd-text-swatch" x="1.2" y="13" width="9.6" height="2.2" rx=".3"/>',
  colour: '<path d="M3.5 11L8 1.8 12.5 11M5.1 7.6h5.8"/><rect class="fd-text-swatch" x="2" y="12.4" width="12" height="2.2" rx=".3"/>',
  emoji: '<circle class="fd-text-face" cx="8" cy="8" r="6.6"/><path d="M5.4 9.6c1.4 1.6 3.8 1.6 5.2 0"/><circle class="fd-text-dot" cx="5.8" cy="6.3" r=".8"/><circle class="fd-text-dot" cx="10.2" cy="6.3" r=".8"/>',
  outdent: '<path d="M8 3.5h6.5M8 6.5h6.5M8 9.5h6.5M8 12.5h6.5"/><path class="fd-text-accent-line" d="M6 8H1.5M3.5 6L1.5 8l2 2"/>',
  indent: '<path d="M8 3.5h6.5M8 6.5h6.5M8 9.5h6.5M8 12.5h6.5"/><path class="fd-text-accent-line" d="M1.5 8H6M4 6l2 2-2 2"/>',
  size: '<path d="M1.5 13L4.6 5.8 7.7 13M2.6 10.6h4M9.5 13l4.2-10.5 4.2 10.5M11 9.6h5.4"/>',
  code: '<path d="M5 4.5L1.5 8 5 11.5M11 4.5l3.5 3.5-3.5 3.5M9.3 3l-2.6 10"/>',
  clearFormatting: '<path d="M2.5 10L5.5 2l3 8M3.6 7.3h3.8"/><path class="fd-text-eraser" d="M9.3 12.6l3.6-3.6 2 2-3 3H10z"/>',
  image: '<rect x="1.5" y="3" width="13" height="10" rx=".6"/><path class="fd-text-accent-fill" d="M2 12.5l3.6-4 2.6 2.6 2-1.8 3.8 3.2z"/><circle cx="11" cy="6" r="1"/>',
  // Two rings linked, as a rich editor draws a link; Remove link, the same rings with a red cross.
  link: '<rect x="1.2" y="5.6" width="8.4" height="5.6" rx="2.8" transform="rotate(-18 5.4 8.4)"/><rect x="6.4" y="4.4" width="8.4" height="5.6" rx="2.8" transform="rotate(-18 10.6 7.2)"/>',
  unlink: '<rect x="1.2" y="5.6" width="8.4" height="5.6" rx="2.8" transform="rotate(-18 5.4 8.4)"/><path d="M8.6 5.2a2.8 2.8 0 0 1 5.6-.4"/><path class="fd-text-cross" d="M11.2 10.6l3 3M14.2 10.6l-3 3"/>',
  taskList: '<path d="M7 3.5h7.5M7 8h7.5M7 12.5h7.5"/><path class="fd-text-accent-line" d="M1.5 3.5l1.2 1.2L5 2.2M1.5 8l1.2 1.2L5 6.7"/><rect x="1.6" y="11" width="3" height="3" rx=".4"/>',
  // A heading's level: a letter and a pen, its list of levels beside it.
  heading: '<path d="M1.4 8.2L3.9 1.6l2.5 6.6M2.3 5.9h3.2"/><path d="M5.4 13.4l.7-2.6 6.6-6.6 1.9 1.9-6.6 6.6z"/>',
};

/** The Markdown editor's own drawings, where they differ: its marks on words, not a colour; a link across; ticks for a task list. */
const MARKDOWN_PATHS: Partial<Record<TextTool, string>> = {
  highlight: '<path d="M1.6 2.6c.3-.4.8-.6 1.3-.6.8 0 1.3.5 1.3 1.3V6.6M4.2 4.4c-1.9-.1-2.9.4-2.9 1.2 0 .6.4 1 1 1 1 0 1.9-.6 1.9-1.6M5.9 .9v5.7M5.9 4.3c.2-.9.8-1.4 1.5-1.4.9 0 1.4.8 1.4 1.9s-.5 1.9-1.4 1.9c-.7 0-1.3-.5-1.5-1.4"/><path d="M5.4 13.4l.7-2.6 6.6-6.6 1.9 1.9-6.6 6.6z"/>',
  link: '<path d="M6.5 5H4.8a3 3 0 0 0 0 6h1.7M9.5 5h1.7a3 3 0 0 1 0 6H9.5M5.5 8h5"/>',
  bulletList: '<path d="M5.5 3.5h9M5.5 8h9M5.5 12.5h9"/><g class="fd-text-ink"><circle cx="2.2" cy="3.5" r=".9"/><circle cx="2.2" cy="8" r=".9"/><circle cx="2.2" cy="12.5" r=".9"/></g>',
  taskList: '<path d="M7 3.5h7.5M7 8h7.5M7 12.5h7.5M1.5 3.5l1.1 1.1L4.8 2.4M1.5 8l1.1 1.1 2.2-2.2M1.5 12.5l1.1 1.1 2.2-2.2"/>',
};

const SVG = 'http://www.w3.org/2000/svg';

/** A tool's icon: its own drawing, a letter, or one of Fieldia's icons by name (an @, a #, a link to a pull request). */
export function toolIcon(doc: Document, tool: TextTool, icons?: IconSet, iconName?: string, editor: 'rich' | 'markdown' = 'rich'): Element {
  // Bold and struck words, as letters.
  if (tool === 'bold' || tool === 'strike') {
    const letters = doc.createElement('span');
    letters.className = `fd-text-glyph fd-text-glyph-${tool}`;
    letters.setAttribute('aria-hidden', 'true');
    letters.textContent = tool === 'bold' ? 'B' : 'ab';
    return letters;
  }
  const shared: Partial<Record<TextTool, string>> = { mention: 'mention', reference: iconName ?? 'hash', attach: 'attach' };
  const named = shared[tool] ? drawIcon(doc, shared[tool], icons) : null;
  if (named) {
    named.classList.add('fd-text-icon');
    return named;
  }
  const svg = doc.createElementNS(SVG, 'svg');
  // The size's two letters, small and large, take a wider box.
  svg.setAttribute('viewBox', tool === 'size' ? '0 0 20 16' : '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `fd-text-icon fd-text-icon-${tool}`);
  svg.innerHTML = (editor === 'markdown' ? MARKDOWN_PATHS[tool] : undefined) ?? PATHS[tool] ?? '';
  return svg;
}

/** The chevron of a tool that opens a list. */
export function chevron(doc: Document): Element {
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'fd-text-chevron');
  // Across the whole box, 11 by 5.5: as wide as the tracker's list chevrons.
  svg.innerHTML = '<path d="M.5 3.5L6 9l5.5-5.5"/>';
  return svg;
}

/** "…": the tools with no room, in a menu. */
export function moreIcon(doc: Document): Element {
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'fd-text-icon');
  svg.innerHTML = '<circle cx="3" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="13" cy="8" r="1.1"/>';
  return svg;
}

/** Highlights by Flectra's colour numbers (their names are the widgets' `colourNames`): yellow first, none last. */
export const HIGHLIGHTS: readonly [number, string | null][] = [[3, '#ffff00'], [10, '#b4f0a8'], [4, '#9eecf2'], [9, '#ffb3d0'], [2, '#ffd08a'], [0, null]];
/** Words' colours: the words' own colour last. */
export const TEXT_COLOURS: readonly [number, string | null][] = [[1, '#d13438'], [2, '#ca5010'], [10, '#107c10'], [8, '#0078d4'], [5, '#8764b8'], [7, '#038387'], [0, null]];
/** Sizes of words, in pixels: the sizes a stored text keeps. */
export const TEXT_SIZES: readonly number[] = [12, 14, 16, 20, 28];
export const EMOJI: readonly string[] = ['😀', '🙂', '😉', '😍', '😎', '🤔', '😢', '😠', '👍', '👎', '👏', '🙏', '🎉', '✅', '❌', '⚠️', '🔥', '🐛', '💡', '🚀'];

/** A colour's swatch, for a menu of colours. */
export function swatch(doc: Document, colour: string | null): HTMLElement {
  const box = doc.createElement('span');
  box.className = 'fd-text-colour';
  box.setAttribute('aria-hidden', 'true');
  if (colour) box.style.background = colour;
  else box.classList.add('fd-text-colour-none');
  return box;
}
