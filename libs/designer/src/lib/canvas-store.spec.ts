import { pageChanges } from './page-checks';
import { employeeDesigner, nodeOf } from './test-layout';

/** What the Advanced canvas asks of the store: blocks edited in place, and widths traded across a gutter. */

describe('updateBlock', () => {
  it('changes a heading’s words and how it reads, a typing run one undo step', () => {
    const d = employeeDesigner();
    for (const text of ['L', 'La', 'Last']) expect(d.updateBlock('h-send', { text })).toBe(true);
    expect(nodeOf(d.getPage(), 'h-send')).toMatchObject({ type: 'text', style: 'heading', text: 'Last' });
    d.undo();
    expect(nodeOf(d.getPage(), 'h-send')?.['text']).toBe('Before you send');
    d.updateBlock('t-note', { style: 'paragraph' });
    expect(nodeOf(d.getPage(), 't-note')?.['style']).toBe('paragraph');
  });

  it('changes a button’s words and look, and a picture’s address and description', () => {
    const d = employeeDesigner();
    d.updateBlock('send', { label: 'Send', style: 'secondary' });
    expect(nodeOf(d.getPage(), 'send')).toMatchObject({ label: 'Send', style: 'secondary', action: 'send' });
    const image = d.addBlock('image', { parent: 'root' }) as string;
    d.updateBlock(image, { src: 'https://example.com/logo.png', alt: 'Acme' });
    expect(nodeOf(d.getPage(), image)).toMatchObject({ src: 'https://example.com/logo.png', alt: 'Acme' });
    expect(pageChanges(employeeDesigner().getPage(), d.getPage())).toContain('Renamed the button “Send to HR” to “Send”');
  });

  it('refuses words for a part that has none, and a picture with no address', () => {
    const d = employeeDesigner();
    expect(d.updateBlock('div-1', { text: 'x' })).toBe(false);
    expect(d.getState().issues).toEqual(['Only words, a button or a picture are changed here']);
    expect(d.updateBlock('f-email', { text: 'x' })).toBe(false);
    const image = d.addBlock('image', { parent: 'root' }) as string;
    expect(d.updateBlock(image, { src: ' ' })).toBe(false);
    expect(d.getState().issues).toEqual(['A picture needs its address']);
    expect(d.updateBlock('nothing', { text: 'x' })).toBe(false);
    expect(d.getState().issues).toEqual(['There is no part “nothing”']);
    expect(d.updateBlock('h-send', { label: 'x' })).toBe(false);
    expect(d.getState().issues).toEqual(['Words have text, not a label']);
  });
});

describe('setWidths', () => {
  it('trades width between two parts in one edit', () => {
    const d = employeeDesigner();
    expect(d.setWidths([{ id: 'f-contract', span: 1 }, { id: 'f-start_date', span: 2 }])).toBe(true);
    expect([nodeOf(d.getPage(), 'f-start_date')?.['colspan'], nodeOf(d.getPage(), 'f-contract')?.['colspan']]).toEqual([2, undefined]);
    d.undo();
    expect([nodeOf(d.getPage(), 'f-start_date')?.['colspan'], nodeOf(d.getPage(), 'f-contract')?.['colspan']]).toEqual([undefined, 2]);
  });

  it('refuses all of it when any one cannot be that wide', () => {
    const d = employeeDesigner();
    const before = d.getPage();
    expect(d.setWidths([{ id: 'f-contract', span: 1 }, { id: 'f-start_date', span: 4 }])).toBe(false);
    expect(d.getState().issues).toEqual(["A field cannot be wider than its section's 3 columns"]);
    expect(d.getPage()).toBe(before);
  });
});
