import { validatePage, type Field, type FieldNode, type Page, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, kindOfField, pageChanges } from './designer';
import { kindsFor } from './kinds';
import { choose, mount } from './test-editor';

/**
 * A value shown as a code on a screen, in the designer: QR code and Barcode among the kinds — a QR code of words, a
 * barcode of words or a whole number, a model's field shown so where it holds one — a QR code's error correction and its
 * words under it set on its card and in the side panel, said in words when the page is published.
 */

const nodes = (page: Page) => (page.layout as unknown as { children: SectionNode[] }).children.flatMap((s) => s.children as FieldNode[]);
const nodeOf = (page: Page, id: string) => nodes(page).find((n) => n.id === id) as FieldNode;

describe('a value shown as a code, on the designer', () => {
  it('adds a QR code and a barcode, each known again from its field, and offers them for a field that holds words or a number', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Ticket') });
    const qr = designer.addQuestion('qr-code', { parent: 'section-1' }) as string;
    const bar = designer.addQuestion('barcode', { parent: 'section-1' }) as string;
    const page = designer.getPage();
    expect([nodeOf(page, qr).widget, nodeOf(page, bar).widget]).toEqual(['qrcode', 'barcode']);
    expect(kindOfField(page.fields[nodeOf(page, qr).field], nodeOf(page, qr))).toBe('qr-code');
    expect(validatePage(page).ok).toBe(true);
    const offered = (field: Field) => kindsFor(field, { fromModel: true, survey: false }).map((kind) => kind.id).filter((id) => id === 'qr-code' || id === 'barcode');
    expect(offered({ type: 'char', label: 'Link' })).toEqual(['qr-code', 'barcode']);
    expect(offered({ type: 'text', label: 'Notes' })).toEqual(['qr-code']);
    expect(offered({ type: 'integer', label: 'Number' })).toEqual(['barcode']);
    expect(offered({ type: 'float', label: 'Weight' })).toEqual([]);
    expect(kindOfField({ type: 'integer', label: 'Number' }, { type: 'field', id: 'n', field: 'n', widget: 'barcode' })).toBe('barcode');
  });

  it('sets a QR code’s error correction and its words under it, and says so when published', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Ticket') });
    const id = designer.addQuestion('qr-code', { parent: 'section-1' }) as string;
    designer.updateQuestion(id, { label: 'Open on your phone' });
    const { host } = mount(designer, { mode: 'simple' });
    designer.select(id);
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    const level = panel.querySelector('select[aria-label="Error correction"]') as HTMLSelectElement;
    expect([...level.options].map((o) => o.textContent)).toEqual(['Low (7%)', 'Medium (15%)', 'Quartile (25%)', 'High (30%)']);
    expect(level.value).toBe('M');
    const before = designer.getPage();
    choose(level, 'H');
    (panel.querySelector('[role="switch"][aria-label="Its words under it"]') as HTMLButtonElement).click();
    expect(nodeOf(designer.getPage(), id).options).toEqual({ level: 'H', showValue: true });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(pageChanges(before, designer.getPage())).toEqual(['“Open on your phone”: error correction high', '“Open on your phone”: its words under its code']);
    // Medium again is the usual: nothing kept for it.
    choose(panel.querySelector('select[aria-label="Error correction"]') as HTMLSelectElement, 'M');
    expect(nodeOf(designer.getPage(), id).options).toEqual({ showValue: true });
  });
});
