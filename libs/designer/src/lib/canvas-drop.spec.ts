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
    expect(at(898, 600)?.drop).toEqual({ how: 'beside', target: 'emergency', after: true, whole: true });
  });

  it('a group’s padding is its rows’: past a row’s last part, the end of that row; before its first, the start', () => {
    const { at } = canvas();
    // Personal details’ border is at 900; its padding runs from 880. Its one row: the photo, then the fields.
    expect(at(892, 100)?.drop).toEqual({ how: 'beside', target: 'who', after: true, whole: false });
    expect(at(892, 100)?.line).toEqual({ left: 883, top: 60, width: 4, height: 320 });
    expect(at(896, 100)?.drop).toEqual({ how: 'beside', target: 'personal', after: true, whole: true });
    expect(at(8, 100)?.drop).toEqual({ how: 'beside', target: 'f-photo', after: false, whole: false });
    // Right to left, the padding at the left is after the row's last part.
    expect(canvas(true).at(8, 100)?.drop).toEqual({ how: 'beside', target: 'f-photo', after: true, whole: false });
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

  it('draws the line 5px off the edge it marks, 4px thick, along the whole edge', () => {
    const { at } = canvas();
    // First name is 310,70 → 590,130.
    expect(at(580, 100)?.line).toEqual({ left: 593, top: 70, width: 4, height: 60 });
    expect(at(325, 100)?.line).toEqual({ left: 303, top: 70, width: 4, height: 60 });
    expect(at(450, 118)?.line).toEqual({ left: 310, top: 133, width: 280, height: 4 });
    expect(at(450, 82)?.line).toEqual({ left: 310, top: 63, width: 280, height: 4 });
    expect(at(580, 100)?.zone).toBeNull();
  });

  it('draws a new row’s line across the grid: midway in the gap, or 5px off the first or last row', () => {
    const { at } = canvas();
    expect(at(450, 140)?.line).toEqual({ left: 310, top: 138, width: 570, height: 4 });
    expect(at(450, 55)?.line).toEqual({ left: 20, top: 53, width: 860, height: 4 });
    expect(at(450, 296)?.line).toEqual({ left: 310, top: 293, width: 570, height: 4 });
  });

  it('an empty group: a line inside its top, and the group tinted', () => {
    const { at } = canvas();
    const mark = at(450, 800);
    expect(mark?.line).toEqual({ left: 28, top: 788, width: 844, height: 4 });
    expect(mark?.zone).toMatchObject({ left: 0, top: 740, width: 900, height: 100 });
  });

  it('a row ends at its tallest part', () => {
    const { at } = canvas();
    // Personal details’ one row: the photo ends at 180, the arrangement beside it at 380.
    const mark = at(150, 385);
    expect(mark?.drop).toEqual({ how: 'row', container: 'personal', index: 2 });
    expect(mark?.line).toEqual({ left: 20, top: 383, width: 860, height: 4 });
  });

  it('a boundary counts 8px into a row, 16px past the first or last, and a group’s edge 4px in', () => {
    const { at } = canvas();
    // Between rows 1 (70–130) and 2 (150–210) of the arrangement.
    expect(at(450, 122)?.drop).toEqual({ how: 'row', container: 'who', index: 2 });
    expect(at(450, 121)?.drop).toEqual({ how: 'under', target: 'f-first_name', after: true, whole: false });
    expect(at(450, 158)?.drop).toEqual({ how: 'row', container: 'who', index: 2 });
    expect(at(450, 159)?.drop).toEqual({ how: 'under', target: 'f-email', after: false, whole: false });
    // Into its first row (70), and above Personal details’ first (60).
    expect(at(450, 78)?.drop).toEqual({ how: 'row', container: 'who', index: 0 });
    expect(at(450, 79)?.drop).toEqual({ how: 'under', target: 'f-first_name', after: false, whole: false });
    expect(at(450, 44)?.drop).toEqual({ how: 'row', container: 'personal', index: 0 });
    expect(at(450, 43)?.drop).toEqual({ how: 'under', target: 'who', after: false, whole: false });
    // Past its last row (290).
    expect(at(450, 306)?.drop).toEqual({ how: 'row', container: 'who', index: 6 });
    expect(at(450, 307)?.drop).toEqual({ how: 'under', target: 'f-birthday', after: true, whole: false });
    // Personal details ends at 400: its edge is the last 4px, the edge itself too; above them, its padding is its last row's.
    expect(at(450, 395)?.drop).toEqual({ how: 'row', container: 'personal', index: 2 });
    expect(at(450, 396)?.drop).toEqual({ how: 'under', target: 'personal', after: true, whole: true });
    expect(at(450, 400)?.drop).toEqual({ how: 'under', target: 'personal', after: true, whole: true });
  });

  it('a tab’s button is not a part: over it, the open tab’s parts answer', () => {
    const { root, page, rectOf, under, place } = fakeCanvas();
    const add = (tag: string, parent: HTMLElement, data: Record<string, string>, box: [number, number, number, number]) => {
      const element = document.createElement(tag);
      Object.assign(element.dataset, data);
      parent.append(element);
      place(element, ...box);
      return element;
    };
    const tabs = add('div', root, { node: 'job-tabs' }, [0, 860, 900, 1100]);
    add('button', tabs, { node: 'tab-job' }, [20, 870, 120, 900]).setAttribute('role', 'tab');
    const open = add('div', tabs, { container: 'tab-job' }, [20, 910, 880, 1090]);
    add('div', open, { node: 'role' }, [20, 910, 880, 1090]);
    expect(findDrop({ root, page, rtl: false, rectOf }, under(60, 885), 60, 885)?.drop).toEqual({ how: 'under', target: 'role', after: false, whole: false });
  });

  it('a group moving over its own parts: they are not there to drop by', () => {
    const { at } = canvas();
    // Over First name, inside the arrangement being moved: the photo, left in the row, answers.
    expect(at(450, 100, 'who')?.drop).toEqual({ how: 'beside', target: 'f-photo', after: true, whole: false });
  });
});
