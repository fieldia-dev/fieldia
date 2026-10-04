import { FIELDIA_CSS } from '@fieldia/widgets';
import { DESIGNER_CSS, installDesignerStyles } from './styles';
import { DESIGNER_JSON_CSS } from './styles-json';
import { DESIGNER_KINDS_CSS } from './styles-kinds';

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

describe('the JSON view’s stylesheet', () => {
  it('is installed with the designer’s own', () => {
    document.head.replaceChildren();
    installDesignerStyles(document);
    expect(document.getElementById('fieldia-designer-styles')?.textContent).toContain(DESIGNER_JSON_CSS);
  });

  it('names a class of its own in every rule, so the designer and the form look as they did', () => {
    expect(foreignRules(DESIGNER_JSON_CSS, DESIGNER_CSS + DESIGNER_KINDS_CSS + FIELDIA_CSS)).toEqual([]);
  });

  it('can sit in a template literal once minified', () => {
    expect(DESIGNER_JSON_CSS).not.toMatch(/[`\\]|\$\{/);
  });
});
