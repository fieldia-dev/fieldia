import { validatePage, type Field, type ListNode, type SheetNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { listProperties } from './list-properties';
import { pageChanges } from './page-checks';
import { pageProperties } from './panel-page';
import { stepsLines } from './steps-words';

/**
 * On paper, as the designer sets it: the screen's printout words and logo
 * beside its other settings, a list's Print beside its Export, the gear
 * menu's built-in Print apart from a report under Print, and the `print`
 * step among a button's steps.
 */

const model: Record<string, Field> = { name: { type: 'char', label: 'Name' }, amount: { type: 'monetary', label: 'Amount', currency: 'EGP' } };
const sheet = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as SheetNode;

afterEach(() => document.body.replaceChildren());

describe('the printout’s words and logo', () => {
  it('sets the header, the footer and the logo, each taken away when emptied, the setting with the last', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Invoice'), model });
    expect(designer.setPrint({ header: 'Zamalek Office Supplies\nCairo', logo: 'https://example.com/logo.svg' })).toBe(true);
    expect(designer.setPrint({ footer: 'Quote {name}' })).toBe(true);
    expect(designer.getPage().print).toEqual({ header: 'Zamalek Office Supplies\nCairo', logo: 'https://example.com/logo.svg', footer: 'Quote {name}' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setPrint({ header: '', footer: '  ' })).toBe(true);
    expect(designer.getPage().print).toEqual({ logo: 'https://example.com/logo.svg' });
    expect(designer.setPrint({ logo: null })).toBe(true);
    expect(designer.getPage().print).toBeUndefined();
  });

  it('refuses a logo that is no image’s address, in words', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Invoice'), model });
    expect(designer.setPrint({ logo: 'javascript:alert(1)' })).toBe(false);
    expect(designer.getState().issues).toEqual(['A logo is an image’s address: https://…, a path on your app, or data:image/…']);
    expect(designer.getPage().print).toBeUndefined();
  });

  it('are offered where the screen’s settings are, filled from the page, and said as a change', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Invoice'), model });
    const before = designer.getPage();
    const view = pageProperties(elementFactory(document), designer);
    document.body.append(view.element);
    const header = view.element.querySelector('textarea[aria-label="Printout’s header"]') as HTMLTextAreaElement;
    header.value = 'Zamalek Office Supplies';
    header.dispatchEvent(new Event('input'));
    const logo = view.element.querySelector('input[aria-label="Logo’s address"]') as HTMLInputElement;
    logo.value = '/logo.svg';
    logo.dispatchEvent(new Event('change'));
    expect(designer.getPage().print).toEqual({ header: 'Zamalek Office Supplies', logo: '/logo.svg' });
    view.update(designer.getPage());
    expect((view.element.querySelector('textarea[aria-label="Printout’s footer"]') as HTMLTextAreaElement).value).toBe('');
    expect(pageChanges(before, designer.getPage())).toContain('The printout’s header, footer or logo changed');
  });
});

describe('a list’s Print', () => {
  const invoices = () => {
    const designer = createDesigner({ page: blankPage('list', 'Invoices'), model });
    designer.addColumn('name');
    return designer;
  };

  it('is off unless asked, and taken away leaves the page as it was', () => {
    const designer = invoices();
    const list = () => designer.getPage().layout as ListNode;
    expect(list().print).toBeUndefined();
    expect(designer.setListOptions({ print: true })).toBe(true);
    expect(list().print).toBe(true);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ print: false })).toBe(true);
    expect(list().print).toBeUndefined();
  });

  it('is a box in the list’s panel beside Export', () => {
    const designer = invoices();
    const view = listProperties(elementFactory(document), designer);
    document.body.append(view.element);
    view.update(designer.getPage());
    const parts = [...view.element.querySelectorAll('[data-part]')].map((row) => row.getAttribute('data-part'));
    expect(parts.indexOf('print')).toBe(parts.indexOf('bulk-edit') + 1);
    const box = view.element.querySelector('[data-part="print"] input') as HTMLInputElement;
    expect(box.checked).toBe(false);
    box.click();
    expect((designer.getPage().layout as ListNode).print).toBe(true);
  });
});

describe('the gear menu’s built-in Print and the print step', () => {
  it('adds the built-in Print apart from a report, under Print unless moved', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Invoice'), model });
    const own = designer.addMenuItem('printPage') as string;
    const report = designer.addMenuItem('print', 'Invoice PDF') as string;
    expect(sheet(designer).toolbar?.menu).toEqual([
      { id: own, builtin: 'print' },
      { id: report, label: 'Invoice PDF', group: 'print', action: 'invoice_pdf' },
    ]);
    // Among the actions: written, as Print is its own place; back under Print: its own again, nothing written.
    expect(designer.updateHeaderPart(own, { group: 'actions' })).toBe(true);
    expect(sheet(designer).toolbar?.menu?.[0]).toEqual({ id: own, builtin: 'print', group: 'actions' });
    expect(designer.updateHeaderPart(own, { group: 'print' })).toBe(true);
    expect(sheet(designer).toolbar?.menu?.[0]).toEqual({ id: own, builtin: 'print' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('says a print step in words', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Invoice'), model });
    expect(stepsLines(designer.getPage(), [{ do: 'print' }])).toEqual(['Print the page, every tab and step of it']);
  });
});
