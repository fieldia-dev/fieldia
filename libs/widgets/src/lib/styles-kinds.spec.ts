import { FIELDIA_CSS, installStyles } from './styles';
import { KINDS_CSS } from './styles-kinds';
import { CHOICES_CSS } from './styles-choices';
import { PARTS_CSS } from './styles-parts';
import { foreignRules } from './test-kinds';

describe('the question kinds’ stylesheet', () => {
  it('is installed with the rest, every rule scoped to Fieldia’s own parts', () => {
    document.head.replaceChildren();
    installStyles(document);
    expect(document.getElementById('fieldia-styles')?.textContent).toContain(KINDS_CSS);
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
    // The rest of Fieldia: the whole stylesheet before the kinds' own part (the choices' details and each kind of part's look come after it).
    expect(foreignRules(KINDS_CSS, FIELDIA_CSS.slice(0, FIELDIA_CSS.indexOf(KINDS_CSS)))).toEqual([]);
    expect(FIELDIA_CSS.endsWith(KINDS_CSS + CHOICES_CSS + PARTS_CSS)).toBe(true);
  });

  it('ends with the choices’ details, scoped to Fieldia and safe in a template literal', () => {
    const unscoped = CHOICES_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map((rule) => rule.split('{').slice(-2)[0].trim())
      .filter((selector) => selector && !selector.startsWith('@') && !selector.includes('.fd-'));
    expect(unscoped).toEqual([]);
    expect(CHOICES_CSS).not.toMatch(/[`\\]|\$\{/);
  });
});

