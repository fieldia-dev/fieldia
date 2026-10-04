import { DESIGNER_CSS, installDesignerStyles } from './styles';
import { DESIGNER_PANEL_CSS } from './styles-panel';

/** The panel's stylesheet: installed with the designer's own, after it, so the panel's look wins where it speaks. */

describe('the panel’s stylesheet', () => {
  it('is installed with the designer’s own, after it', () => {
    document.head.replaceChildren();
    installDesignerStyles(document);
    const installed = document.getElementById('fieldia-designer-styles')?.textContent ?? '';
    // After the designer's own: other parts' stylesheets may follow it, each speaking of its own classes.
    expect(installed.startsWith(DESIGNER_CSS)).toBe(true);
    expect(installed.indexOf(DESIGNER_PANEL_CSS)).toBeGreaterThanOrEqual(DESIGNER_CSS.length);
  });

  it('can sit in a template literal once minified', () => {
    expect(DESIGNER_PANEL_CSS).not.toMatch(/[`\\]|\$\{/);
  });

  it('writes sides logically, so right to left mirrors on its own', () => {
    expect(DESIGNER_PANEL_CSS).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/);
  });
});
