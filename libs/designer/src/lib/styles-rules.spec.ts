import { installDesignerStyles } from './styles';
import { DESIGNER_PANEL_CSS } from './styles-panel';
import { DESIGNER_RULES_CSS } from './styles-rules';

/** The rules' stylesheet: installed with the designer's own, before the panel's, so the panel's look still wins where it speaks. */

describe('the rules’ stylesheet', () => {
  it('is installed with the designer’s own', () => {
    document.head.replaceChildren();
    installDesignerStyles(document);
    const text = document.getElementById('fieldia-designer-styles')?.textContent ?? '';
    expect(text).toContain(DESIGNER_RULES_CSS);
    expect(text.indexOf(DESIGNER_RULES_CSS)).toBeLessThan(text.indexOf(DESIGNER_PANEL_CSS));
  });

  it('can sit in a template literal once minified', () => {
    expect(DESIGNER_RULES_CSS).not.toMatch(/[`\\]|\$\{/);
  });

  it('writes sides logically, so right to left mirrors on its own', () => {
    expect(DESIGNER_RULES_CSS).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/);
  });
});
