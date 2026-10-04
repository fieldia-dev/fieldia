import { FIELDIA_CSS, installStyles } from './styles';
import { KINDS_CSS } from './styles-kinds';
import { foreignRules } from './test-kinds';

describe('the question kinds’ stylesheet', () => {
  it('is installed with the rest, every rule scoped to Fieldia’s own parts', () => {
    document.head.replaceChildren();
    installStyles(document);
    expect(document.getElementById('fieldia-styles')?.textContent?.endsWith(KINDS_CSS)).toBe(true);
    const unscoped = KINDS_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map((rule) => rule.split('{')[0].trim())
      .filter((selector) => selector && !selector.startsWith('@') && !selector.includes('.fd-'));
    expect(unscoped).toEqual([]);
  });

  it('can sit in a template literal once minified: nothing in it ends or opens one', () => {
    expect(KINDS_CSS).not.toMatch(/[`\\]|\$\{/);
  });

  it('restyles nothing of the rest of Fieldia: every rule names a class of the kinds’ own', () => {
    // A rule on a class the stylesheet already styles — the sheet's .fd-card, say — would change that part everywhere.
    // The rest of Fieldia: the whole stylesheet without the kinds' own part, which it ends with.
    expect(foreignRules(KINDS_CSS, FIELDIA_CSS.slice(0, FIELDIA_CSS.length - KINDS_CSS.length))).toEqual([]);
    expect(FIELDIA_CSS.endsWith(KINDS_CSS)).toBe(true);
  });
});

