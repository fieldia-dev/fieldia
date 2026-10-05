import { PART_LOOKS } from '@fieldia/core';
import { FIELDIA_CSS } from './styles';
import { PARTS_CSS } from './styles-parts';

/**
 * Each kind of part's own look: every setting the format lets a kind have is
 * drawn by the stylesheet, from that kind's own token, and only where the
 * page set it. How each looks in either skin, light and dark, right to left,
 * is the browser gates' (e2e/look-parts.spec.ts).
 */

/** What each setting is called on the form and in its tokens, as the viewer names it. */
const NAMES = { background: 'bg', border: 'border', corners: 'radius', textSize: 'size', accent: 'accent' } as const;
const rules = (css: string) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((rule) => rule.split('{'))
    .filter(([selector]) => selector?.trim());

describe('each kind of part’s own look in the stylesheet', () => {
  it('draws every setting a kind may have, from its own token, only on a form that set it', () => {
    for (const [kind, settings] of Object.entries(PART_LOOKS)) {
      for (const setting of settings) {
        const name = NAMES[setting];
        const drawn = rules(PARTS_CSS).filter(([selector]) => selector.includes(`[data-${kind}~=${name}]`));
        expect([kind, setting, drawn.length > 0]).toEqual([kind, setting, true]);
        expect([kind, setting, drawn.some(([, body]) => body.includes(`var(--fd-${kind}-${name})`))]).toEqual([kind, setting, true]);
      }
    }
  });

  it('uses no token of a kind on a form that did not set it: every rule is gated by what the page set', () => {
    for (const [selector, body] of rules(PARTS_CSS)) {
      for (const [, kind, name] of body.matchAll(/var\(--fd-([a-z]+)-(bg|border|radius|size|accent)\b(?!,)/g)) {
        expect([selector.trim(), selector.includes(`[data-${kind}~=${name}]`)]).toEqual([selector.trim(), true]);
      }
    }
  });

  it('comes last, so it wins where it speaks; scoped to Fieldia, safe in a template literal', () => {
    expect(FIELDIA_CSS.endsWith(PARTS_CSS)).toBe(true);
    expect(rules(PARTS_CSS).filter(([selector]) => !selector.includes('.fd-form'))).toEqual([]);
    expect(PARTS_CSS).not.toMatch(/[`\\]|\$\{/);
  });
});
