import { drawIcon, ICONS } from './icons';

describe('icons', () => {
  it('draws each of Fieldia’s own as an SVG of lines in the text colour, hidden from screen readers', () => {
    for (const name of Object.keys(ICONS)) {
      const svg = drawIcon(document, name) as SVGSVGElement;
      expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('class')).toBe('fd-icon');
      // Its shapes really are SVG shapes, not text.
      expect(svg.children.length).toBeGreaterThan(0);
      for (const shape of svg.children) expect(shape.namespaceURI).toBe('http://www.w3.org/2000/svg');
    }
  });

  it('takes the app’s own icons first, and draws nothing for a name no one has', () => {
    const own = { rocket: '<path d="M12 2v20"/>', user: '<circle cx="12" cy="12" r="2"/>' };
    expect(drawIcon(document, 'rocket', own)?.innerHTML).toBe('<path d="M12 2v20"></path>');
    expect(drawIcon(document, 'user', own)?.querySelector('circle')?.getAttribute('r')).toBe('2');
    expect(drawIcon(document, 'rocket')).toBeNull();
    expect(drawIcon(document, undefined)).toBeNull();
  });
});
