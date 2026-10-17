import { blankPage, createDesigner } from './designer';
import { fixCheck, pageChecks } from './page-checks';
import { printablePart } from './print-setting';
import { field, mount, openTab } from './test-editor';

/**
 * On paper: a field, a group, a tab or a related list a page leaves off its printout (`"print": false`), as an invoice
 * leaves out its journal items — ticked in the panel's Rules, a check where nothing would be left to print.
 */

function invoice() {
  const page = blankPage('screen', 'Invoice');
  page.fields = { total: { type: 'monetary', label: 'Total', currency: 'EGP' }, to_check: { type: 'boolean', label: 'To Check' } };
  (page.layout as { children: unknown[] }).children = [
    {
      type: 'tabs',
      id: 'notebook',
      children: [
        { type: 'tab', id: 'tab-lines', label: 'Invoice Lines', children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-total', field: 'total' }] }] },
        { type: 'tab', id: 'tab-journal', label: 'Journal Items', children: [{ type: 'field', id: 'f-to-check', field: 'to_check' }] },
      ],
    },
  ];
  return createDesigner({ page });
}

describe('a part on paper or not', () => {
  it('leaves a tab, a group or a field off paper and back, one undo step each; any other part refused', () => {
    const designer = invoice();
    expect(designer.setPrinted('tab-journal', false)).toBe(true);
    expect(designer.setPrinted('main', false)).toBe(true);
    expect(designer.setPrinted('f-to-check', false)).toBe(true);
    expect(printablePart(designer.getPage(), 'tab-journal')?.print).toBe(false);
    expect(printablePart(designer.getPage(), 'main')?.print).toBe(false);
    expect(printablePart(designer.getPage(), 'f-to-check')?.print).toBe(false);
    expect(designer.setPrinted('main', true)).toBe(true);
    expect('print' in (printablePart(designer.getPage(), 'main') as object)).toBe(false);
    designer.undo();
    expect(printablePart(designer.getPage(), 'main')?.print).toBe(false);
    expect(designer.setPrinted('notebook', false)).toBe(false);
  });

  it('is ticked in the panel’s Rules, ticked unless the page leaves the part off', () => {
    const designer = invoice();
    designer.select('f-total');
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Rules');
    const box = field(host, 'On paper') as HTMLInputElement;
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(printablePart(designer.getPage(), 'f-total')?.print).toBe(false);
  });

  it('says when every part is left off paper, and its fix prints them all again', () => {
    const designer = invoice();
    designer.setPrinted('tab-lines', false);
    expect(pageChecks(designer.getPage()).map((check) => check.text)).not.toContain('Every part of this page is left off paper: its printout would be its title alone.');
    designer.setPrinted('tab-journal', false);
    const check = pageChecks(designer.getPage()).find((one) => one.text.startsWith('Every part of this page is left off paper'));
    expect(check?.severity).toBe('should');
    expect(fixCheck(designer, check!)).toBe(true);
    expect(printablePart(designer.getPage(), 'tab-lines')?.print).toBeUndefined();
    expect(printablePart(designer.getPage(), 'tab-journal')?.print).toBeUndefined();
  });
});
