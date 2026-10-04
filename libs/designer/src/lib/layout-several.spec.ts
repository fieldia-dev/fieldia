import { employeeDesigner, nodeOf } from './test-layout';

/** Several parts changed at once, as one edit: how wide each is, and where each one's labels sit. */

describe('several parts at once', () => {
  it('sets the width of every part picked, as one undo step', () => {
    const designer = employeeDesigner();
    expect(designer.setEach(['f-email', 'f-mobile'], { span: 2 })).toBe(true);
    const page = () => designer.getPage();
    expect([nodeOf(page(), 'f-email')?.['colspan'], nodeOf(page(), 'f-mobile')?.['colspan']]).toEqual([2, 2]);
    designer.undo();
    expect([nodeOf(page(), 'f-email')?.['colspan'], nodeOf(page(), 'f-mobile')?.['colspan']]).toEqual([undefined, undefined]);
  });

  it('sets where the labels of fields and groups sit, or gives them back to what is round them', () => {
    const designer = employeeDesigner();
    designer.setEach(['f-email', 'address'], { labels: 'beside' });
    const page = () => designer.getPage();
    expect([nodeOf(page(), 'f-email')?.['labels'], nodeOf(page(), 'address')?.['labels']]).toEqual(['beside', 'beside']);
    designer.setEach(['f-email', 'address'], { labels: null });
    expect([nodeOf(page(), 'f-email')?.['labels'], nodeOf(page(), 'address')?.['labels']]).toEqual([undefined, undefined]);
  });

  it('changes none of them when one cannot take it, and says why', () => {
    const designer = employeeDesigner();
    // Home address has two columns; Emergency contact one.
    expect(designer.setEach(['f-city', 'f-ec_name'], { span: 2 })).toBe(false);
    expect(designer.getState().issues[0]).toMatch(/cannot be wider than its section's 1 column/);
    expect(nodeOf(designer.getPage(), 'f-city')?.['colspan']).toBeUndefined();
    expect(designer.setEach(['f-email', 'div-1'], { labels: 'above' })).toBe(false);
    expect(designer.getState().issues[0]).toBe('A divider has no labels to place');
    expect(nodeOf(designer.getPage(), 'f-email')?.['labels']).toBeUndefined();
    expect(designer.setEach([], { span: 1 })).toBe(false);
    expect(designer.setEach(['gone'], { span: 1 })).toBe(false);
  });
});
