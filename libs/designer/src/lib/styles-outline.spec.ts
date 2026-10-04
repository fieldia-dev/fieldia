import { FIELDIA_CSS } from '@fieldia/widgets';
import { DESIGNER_CSS, installDesignerStyles } from './styles';
import { DESIGNER_OUTLINE_CSS } from './styles-outline';

/** The rules of `css` that name no class of its own: none that `base` does not use already. */
function foreignRules(css: string, base: string): string[] {
  const taken = new Set(base.match(/\.fd-[\w-]+/g) ?? []);
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((rule) => rule.split('{').slice(-2)[0]?.trim() ?? '')
    .filter((selector) => selector && !selector.startsWith('@'))
    .flatMap((selector) => selector.split(',').map((one) => one.trim()))
    .filter((one) => !(one.match(/\.fd-[\w-]+/g) ?? []).some((name) => !taken.has(name)));
}

describe('the outline’s stylesheet', () => {
  it('is installed with the designer’s own', () => {
    document.head.replaceChildren();
    installDesignerStyles(document);
    expect(document.getElementById('fieldia-designer-styles')?.textContent).toContain(DESIGNER_OUTLINE_CSS);
  });

  it('names a class of its own in every rule, so the rest of the designer looks as it did', () => {
    expect(foreignRules(DESIGNER_OUTLINE_CSS, DESIGNER_CSS.replace(/\.fd-outline[\w-]*/g, '') + FIELDIA_CSS)).toEqual([]);
  });

  it('can sit in a template literal once minified', () => {
    expect(DESIGNER_OUTLINE_CSS).not.toMatch(/[`\\]|\$\{/);
  });
});
