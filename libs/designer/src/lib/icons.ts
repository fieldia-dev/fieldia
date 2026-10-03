/**
 * The designer's icons: one for each kind of field, as the toolbox shows
 * them, and the few its bars use. Line drawings on a 24-unit grid, drawn in
 * the text's colour, so they follow the skin and the theme.
 */

const SHAPES: Record<string, string> = {
  // Kinds of field.
  'short-answer': '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 10v4"/>',
  paragraph: '<path d="M4 6h16M4 10h16M4 14h16M4 18h10"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  phone: '<path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
  website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  keywords: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
  number: '<path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16"/>',
  amount: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5h.01M17.5 14.5h.01"/>',
  rating: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  scale: '<path d="M3 15h18"/><circle cx="5" cy="15" r="1.6"/><circle cx="12" cy="15" r="1.6"/><circle cx="19" cy="15" r="1.6"/><path d="M5 9v2M12 7v4M19 9v2"/>',
  progress: '<rect x="3" y="9" width="18" height="6" rx="3"/><path d="M6 12h7" stroke-width="3"/>',
  date: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  'date-time': '<rect x="3" y="5" width="13" height="13" rx="2"/><path d="M3 9.5h13M7 3v4M12 3v4"/><circle cx="17.5" cy="17.5" r="4"/><path d="M17.5 15.8v1.9l1.2 1"/>',
  dropdown: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M14 11l2 2 2-2"/>',
  'multiple-choice': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>',
  checkboxes: '<rect x="3.5" y="4" width="7" height="7" rx="1.5"/><path d="M5.3 7.5l1.4 1.4 2.4-2.6"/><rect x="3.5" y="13" width="7" height="7" rx="1.5"/><path d="M14 7.5h6.5M14 16.5h6.5"/>',
  status: '<path d="M2 7h6l3 5-3 5H2l3-5zM12 7h6l3 5-3 5h-6l3-5z"/>',
  'yes-no': '<rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="16" cy="12" r="3" fill="currentColor"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  links: '<path d="M2 11V4h7l9 9-7 7z"/><path d="M12 4h2.5l7 7-6.5 6.5"/><circle cx="6" cy="8" r="1"/>',
  lines: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14.5h18M9 9v11"/>',
  'rich-text': '<path d="M4 16l4-10 4 10M5.6 12.5h4.8M15 8h6M15 12h6M4 20h17"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  // Layout.
  section: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 13h4M13 13h4M7 16h4"/>',
  tabs: '<path d="M3 20V9h18v11zM3 9V5h7v4M10 7h6V5h-6"/>',
  // The bars.
  grip: '<circle cx="9" cy="6" r="1.1" fill="currentColor"/><circle cx="15" cy="6" r="1.1" fill="currentColor"/><circle cx="9" cy="12" r="1.1" fill="currentColor"/><circle cx="15" cy="12" r="1.1" fill="currentColor"/><circle cx="9" cy="18" r="1.1" fill="currentColor"/><circle cx="15" cy="18" r="1.1" fill="currentColor"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  required: '<path d="M12 4v16M5.1 8l13.8 8M18.9 8L5.1 16"/>',
  width: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  when: '<path d="M3 3l18 18M10.6 6.1A9.9 9.9 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-3.2 3.7M6.2 7.6A16 16 0 0 0 3 12s4 6 9 6a9 9 0 0 0 3.9-.9"/>',
  duplicate: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  delete: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  model: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
};

/** The names the designer has an icon for. */
export const ICON_NAMES = Object.keys(SHAPES);

/** An icon as an SVG element, hidden from assistive technology: the button or tile around it carries the words. */
export function designerIcon(doc: Document, name: string): SVGSVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'fd-dicon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  // Constant drawings from the table above, never text from a page.
  svg.innerHTML = SHAPES[name] ?? SHAPES['short-answer'];
  return svg;
}
