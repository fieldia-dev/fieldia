import { FIELDIA_CSS } from './styles';
import { BUSINESS_CSS } from './styles-business';

describe('the business widgets’ stylesheet', () => {
  it('is part of Fieldia’s, every rule scoped to Fieldia’s own parts', () => {
    expect(FIELDIA_CSS).toContain(BUSINESS_CSS);
    const unscoped = BUSINESS_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map((rule) => rule.split('{').slice(-2)[0].trim())
      .filter((selector) => selector && !selector.startsWith('@') && !selector.includes('.fd-'))
      // A keyframe's step, inside its own @keyframes fd-….
      .filter((selector) => !/^(from|to|\d+%)$/.test(selector));
    expect(unscoped).toEqual([]);
  });

  it('can sit in a template literal once minified', () => {
    expect(BUSINESS_CSS).not.toMatch(/[`\\]|\$\{/);
  });
});
