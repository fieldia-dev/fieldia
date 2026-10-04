import { findDrop, type DropMark } from './canvas-drop';
import { fakeCanvas } from './test-layout';

/**
 * Where a drop goes, read off the canvas as the mockup reads it: a group's
 * outer edge first, then a boundary between a grid's rows, then the part under
 * the pointer by its nearest edge. The canvas is laid out by hand (see
 * `fakeCanvas`), as a browser would.
 */
function canvas(rtl = false) {
  const { root, page, rectOf, under } = fakeCanvas();
  const at = (x: number, y: number, moving?: string): DropMark | null => findDrop({ root, page, rtl, rectOf }, under(x, y), x, y, moving);
  return { at, root };
}

afterEach(() => document.body.replaceChildren());

describe('findDrop', () => {
  it('beside a part, on its side edges; under or above it, on its lower or upper part', () => {
    const { at } = canvas();
    expect(at(580, 100)?.drop).toEqual({ how: 'beside', target: 'f-first_name', after: true, whole: false });
    expect(at(325, 100)?.drop).toEqual({ how: 'beside', target: 'f-first_name', after: false, whole: false });
    expect(at(450, 118)?.drop).toEqual({ how: 'under', target: 'f-first_name', after: true, whole: false });
    expect(at(450, 82)?.drop).toEqual({ how: 'under', target: 'f-first_name', after: false, whole: false });
    expect(at(580, 100)?.line).toMatchObject({ top: 70, height: 60 });
  });

  it('right to left, the left edge is the side after', () => {
    const { at } = canvas(true);
    expect(at(325, 100)?.drop).toEqual({ how: 'beside', target: 'f-first_name', after: true, whole: false });
  });

  it('on a group’s outer edge: beside or under the whole group, the outermost first', () => {
    const { at } = canvas();
    const bottom = at(450, 396);
    expect(bottom?.drop).toEqual({ how: 'under', target: 'personal', after: true, whole: true });
    expect(bottom?.zone).toMatchObject({ left: 0, top: 0, width: 900, height: 400 });
    expect(at(895, 600)?.drop).toEqual({ how: 'beside', target: 'emergency', after: true, whole: true });
  });

  it('between two rows of a grid, or above its first: a new row there', () => {
    const { at } = canvas();
    const between = at(450, 140);
    expect(between?.drop).toEqual({ how: 'row', container: 'who', index: 2 });
    expect(between?.line).toMatchObject({ left: 310, width: 570 });
    expect(at(450, 55)?.drop).toEqual({ how: 'row', container: 'personal', index: 0 });
    // Within a few pixels of an arrangement's top, its whole edge comes first.
    expect(at(450, 66)?.drop).toEqual({ how: 'under', target: 'who', after: false, whole: true });
    expect(at(450, 296)?.drop).toEqual({ how: 'row', container: 'who', index: 6 });
  });

  it('counts the rows without the part that is moving', () => {
    const { at } = canvas();
    expect(at(450, 140, 'f-first_name')?.drop).toEqual({ how: 'row', container: 'who', index: 1 });
  });

  it('in a group’s padding or its title: the nearest part inside it answers', () => {
    const { at } = canvas();
    expect(at(150, 30)?.drop).toEqual({ how: 'under', target: 'f-photo', after: false, whole: false });
    expect(at(100, 470)?.drop).toEqual({ how: 'under', target: 'f-ec_name', after: false, whole: false });
  });

  it('a one-column list has no rows to drop between: under the part above', () => {
    const { at } = canvas();
    expect(at(450, 545)?.drop).toEqual({ how: 'under', target: 'f-ec_name', after: true, whole: false });
  });

  it('an empty group takes it', () => {
    const { at } = canvas();
    expect(at(450, 800)?.drop).toEqual({ how: 'into', container: 'empty' });
  });

  it('never over the part that is moving: what is round it answers', () => {
    const { at } = canvas();
    expect(at(595, 100, 'f-first_name')?.drop).toEqual({ how: 'beside', target: 'f-last_name', after: false, whole: false });
  });

  it('nothing outside the canvas', () => {
    const { at } = canvas();
    expect(at(2000, 2000)).toBeNull();
  });
});
