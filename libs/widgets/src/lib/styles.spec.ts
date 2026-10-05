import { FIELDIA_CSS, FORM_WIDTHS } from './styles';

/**
 * The widths at which a form's groups take their medium and narrow columns
 * are the stylesheet's: a designer that shows the form at a width asks
 * FORM_WIDTHS, so the two must never say different things.
 */

/** What the stylesheet does to a grid's columns up to a width of the form. */
const rulesUpTo = (width: number) => FIELDIA_CSS.split(`@container (max-width: ${width}px) {`).slice(1).map((after) => after.slice(0, after.indexOf('\n}')));

describe('the form’s widths', () => {
  it('a group takes its medium columns up to FORM_WIDTHS.medium of the form’s own width, and its narrow ones up to FORM_WIDTHS.narrow', () => {
    expect(FORM_WIDTHS.narrow).toBeLessThan(FORM_WIDTHS.medium);
    expect(rulesUpTo(FORM_WIDTHS.medium).some((rules) => rules.includes('.fd-grid[data-columns-medium] { --fd-cols: var(--fd-columns-medium); }'))).toBe(true);
    expect(rulesUpTo(FORM_WIDTHS.narrow).some((rules) => rules.includes('--fd-cols: var(--fd-columns-narrow, 1);'))).toBe(true);
  });

  it('no other width gives a grid its medium or narrow columns', () => {
    const widths = [...FIELDIA_CSS.matchAll(/@container \(max-width: (\d+)px\) \{([\s\S]*?)\n\}/g)].filter(([, , rules]) => /--fd-columns-(medium|narrow)/.test(rules)).map(([, width]) => Number(width));
    expect([...new Set(widths)].sort()).toEqual([FORM_WIDTHS.narrow, FORM_WIDTHS.medium].sort());
  });
});
