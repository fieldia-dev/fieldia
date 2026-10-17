import { FORM_WIDTHS } from './styles';
import { LEFT_OUT, PRINT_CSS, PRINT_GRIDS_CSS } from './styles-print';

/**
 * A form on paper: what no browser test can read off a sheet — which width's rules lay a grid's parts side by side —
 * checked against the screen's own widths, and the few declarations each engine needs to repeat a footer.
 */

const paper = PRINT_CSS.slice(PRINT_CSS.indexOf('@media print {'));

describe('a grid on paper', () => {
  it('lays its parts side by side at the widths the screen gives it more than one column: FORM_WIDTHS’', () => {
    const bands = [...PRINT_GRIDS_CSS.matchAll(/@container ([^{]+)\{/g)].map(([, query]) => query.trim());
    expect(bands).toEqual(
      expect.arrayContaining([
        `(min-width:${FORM_WIDTHS.medium + 1}px)`,
        `(min-width:${FORM_WIDTHS.narrow + 1}px) and (max-width:${FORM_WIDTHS.medium}px)`,
        `(max-width:${FORM_WIDTHS.narrow}px)`,
      ])
    );
    // A grid of one column at every width, and one with tracks or a cell of its own, never.
    for (const band of PRINT_GRIDS_CSS.split('@container ').slice(1)) expect(band).toMatch(/:not\(\[data-columns(-medium|-narrow)?="1"\]/);
    expect(PRINT_GRIDS_CSS.startsWith('.fd-form[data-fd-measure]')).toBe(true);
    expect(PRINT_GRIDS_CSS.indexOf('@media print{')).toBeLessThan(PRINT_GRIDS_CSS.indexOf('@container'));
  });

  it('is a block, its parts boxes in lines that a sheet breaks between, one line enough at its foot', () => {
    expect(paper).toContain('.fd-form :is(.fd-card, .fd-grid:not([data-tracks])) { display: block !important; }');
    expect(PRINT_GRIDS_CSS).toMatch(/display:inline-block;vertical-align:top;/);
    expect(PRINT_GRIDS_CSS).toMatch(/orphans:1;widows:1/);
  });

  it('leaves out what paper leaves out while a heading’s room is measured too: the same list', () => {
    const listed = (text: string) => text.replace(/\s+/g, '');
    expect(listed(paper)).toContain(listed(`.fd-form :is(${LEFT_OUT}) { display: none !important; }`));
  });
});

describe('a record’s footer on paper', () => {
  it('is the footer group of the table its content is, which Chromium repeats only where it may not break', () => {
    // Where a table's cell breaks between sheets: Chromium's and Firefox's (Safari's, which does not, keeps it once).
    expect(paper).toMatch(/@supports \(box-decoration-break: clone\) \{\s*\.fd-form > \.fd-content:has\(> \.fd-print-end\)/);
    // Not where a part of it prints alone: a list's printout, with its own.
    expect(paper).toContain('.fd-form > .fd-content:has(> .fd-print-end):not(:has(.fd-print-this)) { display: table !important;');
    expect(paper).toContain('.fd-form > .fd-content > .fd-print-end { display: table-footer-group !important; break-inside: avoid; }');
  });

  it('is shown nowhere on the screen', () => {
    expect(PRINT_CSS.slice(0, PRINT_CSS.indexOf('@media print {'))).toContain('.fd-print-head, .fd-print-end, .fd-print-foot, .fd-print-box { display: none; }');
  });
});
