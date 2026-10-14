import { sanitizeHtml } from './sanitize';

/**
 * A block's alignment written the old way, as an `align` attribute: what Firefox's toolbar writes when it centres a
 * line (justifyCenter), and what text pasted from older editors carries. It is kept as the one style a block keeps, so
 * a line centred in Firefox stays centred, as in Chromium and Safari.
 */
describe('a block aligned by its align attribute', () => {
  it('keeps its alignment as a style', () => {
    expect(sanitizeHtml('<h2 align="center">Calm</h2><p align="right">x</p><div align="Justify">y</div>')).toBe(
      '<h2 style="text-align: center;">Calm</h2><p style="text-align: right;">x</p><div style="text-align: justify;">y</div>'
    );
  });

  it('a style wins over the attribute, and anything else the attribute says is dropped', () => {
    expect(sanitizeHtml('<p align="right" style="text-align: left">x</p>')).toBe('<p style="text-align: left;">x</p>');
    expect(sanitizeHtml('<p align="url(evil)">x</p><span align="center">y</span>')).toBe('<p>x</p><span>y</span>');
  });
});
