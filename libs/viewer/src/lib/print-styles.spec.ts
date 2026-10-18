import { FIELDIA_CSS, FORM_WIDTHS, PART_RANK } from '@fieldia/widgets';
import { installPrintStyles, LEFT_OUT, PRINT_GRIDS_CSS, PRINT_PART_CSS } from './print-styles';

/**
 * A form on paper (the print part's sheet): what no browser test can read off a sheet — which width's rules lay a
 * grid's parts side by side — checked against the screen's own widths, and the few declarations each engine needs to
 * repeat a footer; and where the sheet stands, and what the main sheet keeps for a print before the part came.
 */

const paper = PRINT_PART_CSS.slice(PRINT_PART_CSS.indexOf('@media print {'));

describe('a grid on paper', () => {
  it('lays its parts side by side at the sheet’s widths the screen gives it more than one column: FORM_WIDTHS’', () => {
    // By the sheet's width, a media query's: a box made another kind by a container query is never drawn in Firefox's print.
    const bands = [...PRINT_GRIDS_CSS.matchAll(/@media (\([^{]+)\{/g)].map(([, query]) => query.trim());
    expect(bands).toEqual([
      `(min-width:${FORM_WIDTHS.medium + 1}px)`,
      `(min-width:${FORM_WIDTHS.narrow + 1}px) and (max-width:${FORM_WIDTHS.medium}px)`,
      `(max-width:${FORM_WIDTHS.narrow}px)`,
    ]);
    expect(PRINT_GRIDS_CSS).not.toContain('@container');
    // A grid of one column at every width, and one with tracks or a cell of its own, never.
    for (const band of PRINT_GRIDS_CSS.split('@media (').slice(1)) expect(band).toMatch(/:not\(\[data-columns(-medium|-narrow)?="1"\]/);
    // A part sharing a cell: its own grid side by side at every width, its columns counted by its own (screen) width.
    expect(PRINT_GRIDS_CSS).toContain('.fd-form [data-place="shared"] > .fd-grid[data-columns]:not([data-columns="1"],[data-tracks]){display:flow-root!important');
    expect(PRINT_GRIDS_CSS.startsWith('.fd-form[data-fd-measure]')).toBe(true);
    expect(PRINT_GRIDS_CSS.indexOf('@media print{')).toBeLessThan(PRINT_GRIDS_CSS.indexOf('@media ('));
  });

  it('is a block, its parts boxes in lines that a sheet breaks between, one line enough at its foot', () => {
    expect(paper).toContain('.fd-form :is(.fd-card, .fd-grid:not([data-tracks])) { display: block !important; }');
    expect(PRINT_GRIDS_CSS).toMatch(/display:inline-block;vertical-align:top;/);
    expect(PRINT_GRIDS_CSS).toMatch(/orphans:1;widows:1/);
    // Every grid's lines too, side by side or not: a sheet breaks between any two of its parts (its words keep two).
    expect(paper).toContain('.fd-form .fd-grid { orphans: 1; widows: 1; }');
    expect(paper).toContain('.fd-form .fd-grid > * { orphans: 2; widows: 2; }');
  });

  it('leaves no required star, and leaves out what its page marks not for paper', () => {
    expect(paper).toContain('.fd-form .fd-required > :is(.fd-label, .fd-address-label)::before, .fd-form .fd-required > :is(.fd-label, .fd-address-label)::after { content: none !important; }');
    expect(LEFT_OUT).toContain('[data-print="off"]');
    expect(paper).toContain('.fd-form .fd-tabpanel[hidden]:not([data-off], [data-print="off"]) { display: block !important; }');
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

  it('is shown nowhere on the screen: the main sheet keeps it out of sight, before the part came too', () => {
    expect(FIELDIA_CSS).toContain('.fd-print-head, .fd-print-end, .fd-print-foot, .fd-print-box { display: none; }');
  });
});

describe('the print part’s sheet', () => {
  afterEach(() => document.head.replaceChildren());

  it('lays nothing out on the screen but a form measured for paper', () => {
    const screen = PRINT_PART_CSS.slice(0, PRINT_PART_CSS.indexOf('@media print {')).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const rule of screen.split('}').map((one) => one.trim()).filter(Boolean)) expect(rule.startsWith('.fd-form[data-fd-measure]')).toBe(true);
    expect(PRINT_GRIDS_CSS.slice(0, PRINT_GRIDS_CSS.indexOf('@media print{'))).toMatch(/^\.fd-form\[data-fd-measure\][^{]*\{[^}]*\}$/);
  });

  it('goes right after the main sheet, before every other part’s: where its rules stood in it', () => {
    expect(PART_RANK.print).toBe(0);
    expect(Math.min(...Object.values(PART_RANK).filter((rank) => rank !== PART_RANK.print))).toBeGreaterThan(PART_RANK.print);
    const lines = document.createElement('style');
    lines.id = 'fieldia-lines-styles';
    lines.setAttribute('data-fd-rank', String(PART_RANK.lines));
    const base = document.createElement('style');
    base.id = 'fieldia-styles';
    const looks = document.createElement('style');
    looks.id = 'fieldia-styles-looks';
    document.head.append(base, lines, looks);
    installPrintStyles(document);
    installPrintStyles(document);
    expect([...document.head.querySelectorAll('style')].map((style) => style.id)).toEqual(['fieldia-styles', 'fieldia-print-styles', 'fieldia-lines-styles', 'fieldia-styles-looks']);
  });

  it('is what the whole look needs; the main sheet keeps only a plain look for paper: buttons, bars and hints left out, light', () => {
    const main = FIELDIA_CSS.slice(FIELDIA_CSS.indexOf('.fd-print-head, .fd-print-end'));
    const plain = main.slice(main.indexOf('@media print {'));
    expect(plain).toContain('--fd-text: #1d2024 !important');
    expect(plain).toContain('.fd-form :is(.fd-record-bar, .fd-actions, .fd-wizard-nav, .fd-stats, .fd-side, .fd-button,');
    // Each it leaves out, the part's leaves out too: the part's sheet over it changes none of it.
    const left = /\.fd-form :is\(([^)]*)\) \{ display: none !important; \}/.exec(plain)?.[1].split(',').map((one) => one.trim()) ?? [];
    expect(left.length).toBeGreaterThan(5);
    for (const one of left) expect(LEFT_OUT.split(',').map((it) => it.trim())).toContain(one);
    // The whole look's own rules are the part's alone.
    expect(FIELDIA_CSS).not.toContain('fd-print-keep');
    expect(FIELDIA_CSS).not.toContain('table-footer-group');
  });
});
