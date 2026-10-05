/**
 * Pictures for the Advanced toolbox's layout tiles — a group, two side by
 * side, tabs, a heading, words, a line, room, a picture, a button — drawn as
 * the approved mockup draws them, as line icons in the text's colour.
 */

const SHAPES: Record<string, string> = {
  group: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
  side: '<rect x="3" y="5" width="8" height="14" rx="1.5"/><rect x="13" y="5" width="8" height="14" rx="1.5"/>',
  tabs: '<path d="M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 9V5h7v4M10 5h5v4"/>',
  heading: '<path d="M6 5v14M18 5v14M6 12h12"/>',
  text: '<path d="M5 7h14M5 12h14M5 17h9"/>',
  divider: '<path d="M3 12h18"/><path d="M7 7h10M7 17h10" opacity=".35"/>',
  spacer: '<path d="M12 4v5m0 6v5M9 7l3-3 3 3M9 17l3 3 3-3"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/>',
  button: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M9 12h6"/>',
  form: '<rect x="3" y="3" width="13" height="16" rx="2"/><path d="M7 8h5M7 12h5M20 7v12a2 2 0 0 1-2 2H8"/>',
};

export function blockIcon(doc: Document, name: string): SVGSVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'fd-dicon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  // Constant drawings from the table above, never text from a page.
  svg.innerHTML = SHAPES[name] ?? SHAPES['group'];
  return svg;
}
