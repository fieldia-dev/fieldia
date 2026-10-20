import { drawIcon, type IconSet } from './icons';
import type { WidgetLabels } from './labels';
import type { TextTool } from './text-tool-names';

/**
 * A formatted text's tools: what each is called, how it is drawn, and in
 * which order a page lists them. Icons are 16px lines in the words' colour;
 * a list's marks and an indent's arrow take the accent, a highlight and a
 * text colour show the colour they give, as an editor's toolbar draws them.
 */

export { MARKDOWN_TOOLS, RICH_TOOLS, TEXT_TOOLS, type TextTool } from './text-tool-names';

/** Tools that open a list of choices: a colour, a size, a heading's level, an emoji; a table's size, or what to do to one. */
export const CHOOSING: ReadonlySet<TextTool> = new Set(['highlight', 'colour', 'size', 'heading', 'emoji', 'table']);
/** Tools whose button says whether the selection already has their format. */
export const TOGGLES: ReadonlySet<TextTool> = new Set(['bold', 'italic', 'underline', 'strike']);

/** Each tool's name, in the page's language. */
export function toolLabel(tool: TextTool, labels: WidgetLabels): string {
  const key: Record<TextTool, keyof WidgetLabels> = {
    bold: 'bold', italic: 'italic', underline: 'underline', bulletList: 'bulletList', numberList: 'numberList', highlight: 'highlight', colour: 'textColour',
    emoji: 'emoji', outdent: 'outdent', indent: 'indent', strike: 'strike', size: 'textSize', code: 'code', mention: 'mention', reference: 'linkRecordNamed',
    clearFormatting: 'clearFormatting', image: 'image', link: 'link', unlink: 'removeLink', taskList: 'taskList', heading: 'heading', attach: 'attachFile',
    table: 'tableTool',
  };
  return labels[key[tool]];
}

const PATHS: Partial<Record<TextTool, string>> = {
  italic: '<path d="M7 2.5h5.5M3.5 13.5H9M9.8 2.5l-3.6 11"/>',
  underline: '<path d="M4.5 2v5.5a3.5 3.5 0 0 0 7 0V2M3.5 14.5h9"/>',
  // Four thin lines, a dotted column of markers before them; three lines and tiny numbers (20.22.28). They run a little past
  // the box's end, as the tracker's do.
  bulletList: '<path d="M5 4.5h13M5 7.5h13M5 10.5h13M5 13.5h13" stroke-width="1" stroke-linecap="butt"/><g class="fd-text-accent"><rect x="2" y="4" width="1" height="1"/><rect x="2" y="7" width="1" height="1"/><rect x="2" y="10" width="1" height="1"/><rect x="2" y="13" width="1" height="1"/></g>',
  numberList: '<path d="M5 4.5h12M5 8.5h12M5 12.5h12" stroke-width="1" stroke-linecap="butt"/><path class="fd-text-accent-line" stroke-width=".8" d="M1.6 3.6l1-.6v3M1.4 7.4c.3-.5 1.6-.4 1.4.4-.1.5-1.4 1-1.4 1.7h1.6M1.4 11.1h1.4l-.7.9c.5 0 .8.3.8.7s-.4.7-.8.7c-.3 0-.6-.1-.7-.3"/>',
  highlight: '<path d="M1.6 2.6c.3-.4.8-.6 1.3-.6.8 0 1.3.5 1.3 1.3V6.6M4.2 4.4c-1.9-.1-2.9.4-2.9 1.2 0 .6.4 1 1 1 1 0 1.9-.6 1.9-1.6M5.9 .9v5.7M5.9 4.3c.2-.9.8-1.4 1.5-1.4.9 0 1.4.8 1.4 1.9s-.5 1.9-1.4 1.9c-.7 0-1.3-.5-1.5-1.4"/><path d="M5.4 13.4l.7-2.6 6.6-6.6 1.9 1.9-6.6 6.6z"/><rect class="fd-text-swatch" x="1.2" y="13" width="9.6" height="2.2" rx=".3"/>',
  // A thin A over a bar of the colour, the bar on whole pixels at the box's foot (20.22.28).
  colour: '<path d="M1.8 13.5L6.5 1.2l4.7 12.3M3.3 9.5h6.4" stroke-width="1"/><rect class="fd-text-swatch" x="1" y="15" width="11" height="2"/>',
  // A round face lit from above, light yellow to orange at its foot, no outline; its eyes and smile in brown (20.22.28).
  emoji: '<defs><radialGradient id="fd-face" cy=".22" r=".85"><stop stop-color="#fffbd2"/><stop offset=".3" stop-color="#fde24f"/><stop offset=".62" stop-color="#fbc12b"/><stop offset="1" stop-color="#ea8a0b"/></radialGradient></defs><circle class="fd-text-face" cx="8" cy="8" r="7.4" fill="url(#fd-face)"/><path class="fd-text-smile" d="M5.2 10.4q2.8 1.7 5.6 0"/><ellipse class="fd-text-dot" cx="5.8" cy="6.7" rx=".6" ry="1.1"/><ellipse class="fd-text-dot" cx="10.2" cy="6.7" rx=".6" ry="1.1"/>',
  outdent: '<path d="M8 3.5h6.5M8 6.5h6.5M8 9.5h6.5M8 12.5h6.5"/><path class="fd-text-accent-line" d="M6 8H1.5M3.5 6L1.5 8l2 2"/>',
  indent: '<path d="M8 3.5h6.5M8 6.5h6.5M8 9.5h6.5M8 12.5h6.5"/><path class="fd-text-accent-line" d="M1.5 8H6M4 6l2 2-2 2"/>',
  size: '<path d="M2 14l2.8-7.4L7.6 14M3 11.6h3.6M10 14l3.7-12.6L17.4 14M11.2 10h5"/>',
  code: '<path d="M4 4L.5 7.5 4 11M12 4l3.5 3.5L12 11M9.8 2.5L6.6 13.5" stroke-width="1"/>',
  // A thin A and a pink eraser on the slant, its tip parted from it (20.22.28).
  clearFormatting: '<path d="M4.6 9.8L7.5 1.2l2.9 8.6M5.4 7.5h4.2" stroke-width="1"/><g class="fd-text-eraser" transform="rotate(-45 10.5 11)"><rect x="5.5" y="8.9" width="2.7" height="4.2" rx=".8"/><rect x="9" y="8.9" width="6.5" height="4.2" rx=".8"/></g>',
  image: '<rect x="1.5" y="3" width="13" height="10" rx=".6"/><path class="fd-text-accent-fill" d="M2 12.5l3.6-4 2.6 2.6 2-1.8 3.8 3.2z"/><circle cx="11" cy="6" r="1"/>',
  // Two rings linked, as a rich editor draws a link; Remove link, the same rings with a red cross.
  link: '<g stroke-width="1"><rect x="2.3" y="3.5" width="9.4" height="6" rx="3"/><rect x="7.6" y="6.5" width="9.3" height="6" rx="3"/></g>',
  unlink: '<g stroke-width="1"><rect x="2.3" y="3.5" width="9.4" height="6" rx="3"/><path d="M11.7 6.5h2.2a3 3 0 0 1 0 6h-3.3"/></g><path class="fd-text-cross" d="M13.5 12.5l4 4M17.5 12.5l-4 4"/>',
  taskList: '<path d="M7 3.5h7.5M7 8h7.5M7 12.5h7.5"/><path class="fd-text-accent-line" d="M1.5 3.5l1.2 1.2L5 2.2M1.5 8l1.2 1.2L5 6.7"/><rect x="1.6" y="11" width="3" height="3" rx=".4"/>',
  // A heading's level: a letter and a pen, its list of levels beside it.
  heading: '<path d="M1.4 8.2L3.9 1.6l2.5 6.6M2.3 5.9h3.2"/><path d="M5.4 13.4l.7-2.6 6.6-6.6 1.9 1.9-6.6 6.6z"/>',
  // A table: its header row in the accent, three columns and rows of cells under it.
  table: '<rect class="fd-text-accent-fill" x="1.5" y="2.5" width="13" height="3.5"/><rect x="1.5" y="2.5" width="13" height="11" rx=".6"/><path d="M1.5 6h13M1.5 9.75h13M5.83 2.5v11M10.17 2.5v11" stroke-width="1"/>',
};

/** The Markdown editor's own drawings, where they differ: its marks on words, not a colour; a link across; ticks for a task list. */
const MARKDOWN_PATHS: Partial<Record<TextTool, string>> = {
  highlight: '<path d="M1.6 2.6c.3-.4.8-.6 1.3-.6.8 0 1.3.5 1.3 1.3V6.6M4.2 4.4c-1.9-.1-2.9.4-2.9 1.2 0 .6.4 1 1 1 1 0 1.9-.6 1.9-1.6M5.9 .9v5.7M5.9 4.3c.2-.9.8-1.4 1.5-1.4.9 0 1.4.8 1.4 1.9s-.5 1.9-1.4 1.9c-.7 0-1.3-.5-1.5-1.4"/><path d="M5.4 13.4l.7-2.6 6.6-6.6 1.9 1.9-6.6 6.6z"/>',
  link: '<path d="M6.5 5H4.8a3 3 0 0 0 0 6h1.7M9.5 5h1.7a3 3 0 0 1 0 6H9.5M5.5 8h5"/>',
  // Its code a smaller </>, thin (20.21.54).
  code: '<path d="M5.2 5.2L2.8 7.7l2.4 2.4M11.8 5.2l2.4 2.5-2.4 2.4M10.4 3.2L7 12.6" stroke-width="1"/>',
  bulletList: '<path d="M5.5 3.5h9M5.5 8h9M5.5 12.5h9"/><g class="fd-text-ink"><circle cx="2.2" cy="3.5" r=".9"/><circle cx="2.2" cy="8" r=".9"/><circle cx="2.2" cy="12.5" r=".9"/></g>',
  taskList: '<path d="M7 3.5h7.5M7 8h7.5M7 12.5h7.5M1.5 3.5l1.1 1.1L4.8 2.4M1.5 8l1.1 1.1 2.2-2.2M1.5 12.5l1.1 1.1 2.2-2.2"/>',
};

const SVG = 'http://www.w3.org/2000/svg';
/** Emoji faces drawn so far: each its own gradient's id. */
let faces = 0;

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
  // The face's light is a gradient of its own in each drawing: an id is the whole document's, and a toolbar may be hidden.
  const drawing = (editor === 'markdown' ? MARKDOWN_PATHS[tool] : undefined) ?? PATHS[tool] ?? '';
  svg.innerHTML = tool === 'emoji' ? drawing.replace(/fd-face/g, `fd-face${++faces}`) : drawing;
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
  svg.innerHTML = '<circle cx="1.5" cy="8" r="0.5"/><circle cx="8" cy="8" r="0.5"/><circle cx="14.5" cy="8" r="0.5"/>';
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
