import type { FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { pageChanges } from './page-checks';
import { mount, openTab } from './test-editor';

/**
 * A field scanned with the camera (`options.scan`), on its Content tab: a switch for a box of words or a link, and for a
 * link the field of its records holding their codes — set as a person sets them, said in what changed, in Arabic too;
 * none for a kind no code is written into.
 */

function screen(locale?: 'ar') {
  const page = blankPage('screen', 'Treatment');
  page.fields = {
    lot: { type: 'char', label: 'Lot' },
    product_id: { type: 'many2one', label: 'Product', relation: 'clinic.product' },
    done: { type: 'boolean', label: 'Done' },
  } as Page['fields'];
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = [
    { type: 'field', id: 'f-lot', field: 'lot' },
    { type: 'field', id: 'f-product', field: 'product_id' },
    { type: 'field', id: 'f-done', field: 'done' },
  ] as SectionNode['children'];
  const designer = createDesigner({ page, ...(locale ? { locale } : {}) });
  const { host } = mount(designer, { mode: 'advanced' });
  const node = (id: string) => (designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;
  const row = (name: string) => host.querySelector(`[data-setting="${name}"]`) as HTMLElement;
  return { designer, host, node, row };
}

describe('a field scanned with the camera, in the panel', () => {
  it('turns on and off for a box of words, with no code field', () => {
    const { designer, host, node, row } = screen();
    designer.select('f-lot');
    openTab(host, 'Content');
    const toggle = row('Scan with the camera').querySelector<HTMLButtonElement>('[role="switch"]');
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
    expect(row('Code kept in').closest('[hidden]')).not.toBeNull();
    toggle?.click();
    expect(node('f-lot').options).toEqual({ scan: true });
    expect(row('Scan with the camera').querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
    expect(row('Code kept in').closest('[hidden]')).not.toBeNull();
    row('Scan with the camera').querySelector<HTMLButtonElement>('[role="switch"]')?.click();
    expect(node('f-lot').options).toBeUndefined();
  });

  it("finds a link's record by the field of its records that holds their codes, once scanned", () => {
    const { designer, host, node, row } = screen();
    designer.select('f-product');
    openTab(host, 'Content');
    row('Scan with the camera').querySelector<HTMLButtonElement>('[role="switch"]')?.click();
    const code = row('Code kept in').querySelector<HTMLInputElement>('input');
    expect(row('Code kept in').closest('[hidden]')).toBeNull();
    if (!code) throw new Error('no code field');
    code.value = 'barcode';
    code.dispatchEvent(new Event('input', { bubbles: true }));
    expect(node('f-product').options).toEqual({ scan: { by: 'barcode' } });
    code.value = '';
    code.dispatchEvent(new Event('input', { bubbles: true }));
    expect(node('f-product').options).toEqual({ scan: true });
  });

  it('offers none for a kind no code is written into, and keeps settings the JSON gave', () => {
    const { designer, host, node, row } = screen();
    designer.select('f-done');
    openTab(host, 'Content');
    expect(row('Scan with the camera').closest('[hidden]')).not.toBeNull();
    designer.setWidgetOptions('f-product', { scan: { formats: ['ean_13'], by: 'barcode' } });
    designer.select('f-product');
    const code = row('Code kept in').querySelector<HTMLInputElement>('input');
    expect(code?.value).toBe('barcode');
    if (!code) throw new Error('no code field');
    code.value = 'ean';
    code.dispatchEvent(new Event('input', { bubbles: true }));
    expect(node('f-product').options).toEqual({ scan: { formats: ['ean_13'], by: 'ean' } });
  });

  it('says what changed, and speaks Arabic', () => {
    const { designer } = screen();
    const before = designer.getPage();
    designer.setWidgetOptions('f-lot', { scan: true });
    designer.setWidgetOptions('f-product', { scan: { by: 'barcode' } });
    expect(pageChanges(before, designer.getPage())).toEqual(['“Lot”: scanned with the camera', '“Product”: scanned with the camera, a record found by its “barcode”']);
    const after = designer.getPage();
    designer.setWidgetOptions('f-lot', { scan: null });
    expect(pageChanges(after, designer.getPage())).toEqual(['“Lot”: no longer scanned with the camera']);
    const ar = screen('ar');
    ar.designer.select('f-lot');
    openTab(ar.host, 'المحتوى');
    expect(ar.row('Scan with the camera').querySelector('.fd-prop-name')?.textContent).toBe('المسح بالكاميرا');
  });
});
