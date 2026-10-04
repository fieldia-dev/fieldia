import { installDesignerStyles } from './styles';
import { DESIGNER_PANEL_CSS } from './styles-panel';

/** The panel's stylesheet: installed with the designer's own, after it, so the panel's look wins where it speaks. */

describe('the panel’s stylesheet', () => {
  it('is installed with the designer’s own, after it', () => {
    document.head.replaceChildren();
    installDesignerStyles(document);
    expect(document.getElementById('fieldia-designer-styles')?.textContent?.endsWith(DESIGNER_PANEL_CSS)).toBe(true);
  });

  it('can sit in a template literal once minified', () => {
    expect(DESIGNER_PANEL_CSS).not.toMatch(/[`\\]|\$\{/);
  });

  it('writes sides logically, so right to left mirrors on its own', () => {
    expect(DESIGNER_PANEL_CSS).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/);
  });
});
