import { validatePage, type FieldNode, type Page, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, kindOfField, pageChanges } from './designer';
import { choose, mount } from './test-editor';

/**
 * Pins on a picture, in the designer: Pins on a picture among a screen's kinds, on a json field; its picture — an
 * address, or a field holding it, one or the other — and what it shows, set on its card and in the side panel, and said
 * in words when the page is published.
 */

const nodes = (page: Page) => (page.layout as unknown as { children: SectionNode[] }).children.flatMap((s) => s.children as FieldNode[]);
const nodeOf = (page: Page, id: string) => nodes(page).find((n) => n.id === id) as FieldNode;

describe('pins on a picture, on the designer', () => {
  it('adds pins on a json field, known again, and sets their picture — an address or a field — and what it shows', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const plan = designer.addQuestion('image', { parent: 'section-1' }) as string;
    designer.updateQuestion(plan, { label: 'Floor plan' });
    const id = designer.addQuestion('pins', { parent: 'section-1' }) as string;
    designer.updateQuestion(id, { label: 'Snags' });
    const page = designer.getPage();
    expect([page.fields[nodeOf(page, id).field].type, nodeOf(page, id).widget, kindOfField(page.fields[nodeOf(page, id).field], nodeOf(page, id))]).toEqual(['json', 'pins', 'pins']);
    expect(validatePage(page).ok).toBe(true);
    const { host } = mount(designer, { mode: 'simple' });
    designer.select(id);
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    const address = panel.querySelector('input[aria-label="Picture"]') as HTMLInputElement;
    const before = designer.getPage();
    address.value = 'https://charts.example/plan.svg';
    address.dispatchEvent(new Event('change'));
    const shows = panel.querySelector('input[aria-label="What it shows"]') as HTMLInputElement;
    shows.value = 'The flat’s floor plan';
    shows.dispatchEvent(new Event('change'));
    expect(nodeOf(designer.getPage(), id).options).toEqual({ image: 'https://charts.example/plan.svg', alt: 'The flat’s floor plan' });
    expect(pageChanges(before, designer.getPage())).toEqual(['“Snags”: its pins on the picture at https://charts.example/plan.svg', '“Snags”: its picture said as “The flat’s floor plan”']);
    // A field's picture instead: the address goes, one picture at a time.
    const from = panel.querySelector('select[aria-label="Picture from"]') as HTMLSelectElement;
    expect([...from.options].map((o) => o.textContent)).toEqual(['None', 'Floor plan']);
    choose(from, nodeOf(designer.getPage(), plan).field);
    expect(nodeOf(designer.getPage(), id).options).toEqual({ imageField: nodeOf(designer.getPage(), plan).field, alt: 'The flat’s floor plan' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });
});
