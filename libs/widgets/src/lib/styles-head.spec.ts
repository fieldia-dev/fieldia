import { FIELDIA_CSS } from './styles';
import { HEAD_CSS } from './styles-head';
import { QUIET_CSS } from './styles-quiet';

/**
 * A record's head and its dialog in the stylesheet: part of Fieldia's, after
 * the quiet look it draws its own way, every rule on Fieldia's own parts, and
 * every colour from the form's tokens — so a theme, a host's colours and the
 * dark scheme follow. How it looks is the browser gates' (e2e/wi-header.spec.ts).
 */

const rules = (css: string) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((rule) => rule.split('{').slice(-2))
    .filter(([selector]) => selector?.trim());

describe('the record head’s stylesheet', () => {
  it('is part of Fieldia’s, after the quiet look', () => {
    expect(FIELDIA_CSS.indexOf(HEAD_CSS)).toBeGreaterThan(FIELDIA_CSS.indexOf(QUIET_CSS));
  });

  it('styles only Fieldia’s own parts, and can sit in a template literal', () => {
    const unscoped = rules(HEAD_CSS)
      .map(([selector]) => selector.trim())
      .filter((selector) => !selector.startsWith('@') && !selector.includes('.fd-'));
    expect(unscoped).toEqual([]);
    expect(HEAD_CSS).not.toMatch(/[`\\]|\$\{/);
  });

  it('draws in the form’s tokens: no colour of its own but the shadow’s and the strip’s fallbacks', () => {
    const colours = [...HEAD_CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => match[0]);
    // Black, mixed into the number's words a shade deeper than the text, is the only colour written out.
    expect([...new Set(colours)]).toEqual(['#000']);
  });

  it('measures the dialog of the inset size and the head as a work item’s window has them', () => {
    expect(HEAD_CSS).toContain('inset: 46px 96px');
    expect(HEAD_CSS).toContain('0 25.6px 57.6px rgba(0, 0, 0, 0.22), 0 4.8px 14.4px rgba(0, 0, 0, 0.18);');
    expect(HEAD_CSS).toMatch(/\.fd-head-strip \{[^}]*width: 10px/);
    expect(HEAD_CSS).toMatch(/\.fd-head-badge-row \{[^}]*height: 42px/);
    expect(HEAD_CSS).toMatch(/\.fd-head-band \{[^}]*min-height: 78px/);
    expect(HEAD_CSS).toMatch(/\.fd-head-fields \{[^}]*--fd-head-label: 76px/);
    expect(HEAD_CSS).toMatch(/\.fd-head-tabs \.fd-tab \{[^}]*height: 36px/);
  });
});
