import { advancedDrag, type AdvancedDrag } from './canvas-advanced';
import { createDesigner } from './designer';
import { employeePage, fakeCanvas, watched, where } from './test-layout';

/**
 * Dragging on the Advanced canvas, as the mockup does it: what is carried
 * stays where it is, a line shows where it would go and a chip says it in
 * words — or why not — and it goes there, as one edit, when let go.
 */

let drag: AdvancedDrag | null = null;

function setup() {
  const page = employeePage();
  (page.layout as { children: unknown[] }).children.push({ type: 'section', id: 'empty', title: 'New group', columns: 2, children: [] });
  const designer = watched(createDesigner({ page }));
  const fake = fakeCanvas(page);
  const canvas = document.createElement('div');
  document.body.append(canvas);
  canvas.append(fake.root);
  drag = advancedDrag({ canvas, root: fake.root, designer, rtl: () => false, rectOf: fake.rectOf, elementAt: fake.under });
  const pointer = (type: string, target: EventTarget, x: number, y: number) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }) as unknown as PointerEvent);
  const element = (id: string) => fake.root.querySelector(`[data-node="${id}"]`) as HTMLElement;
  /** Press on a part, and move to a point at hand speed, in a few steps. */
  const carry = (id: string, from: [number, number], to: [number, number]) => {
    pointer('pointerdown', element(id), ...from);
    for (let i = 1; i <= 4; i++) pointer('pointermove', document, from[0] + ((to[0] - from[0]) * i) / 4, from[1] + ((to[1] - from[1]) * i) / 4);
  };
  const chip = () => canvas.querySelector('.fd-drop-chip') as HTMLElement | null;
  const bar = () => canvas.querySelector('.fd-drop-bar') as HTMLElement | null;
  return { designer, canvas, pointer, element, carry, chip, bar };
}

afterEach(() => {
  drag?.destroy();
  drag = null;
  document.body.replaceChildren();
});

describe('dragging a part on the Advanced canvas', () => {
  it('shows where it would go, says so, and puts it there when let go', () => {
    const { designer, carry, chip, bar, pointer, element } = setup();
    carry('f-mobile', [700, 180], [580, 100]);
    expect(chip()?.textContent).toBe('Mobilebeside “First name”');
    expect(chip()?.querySelector('.fd-drop-where')?.textContent).toBe('beside “First name”');
    expect(bar()?.hidden).toBe(false);
    expect(bar()?.style.height).toBe('60px');
    expect(element('f-mobile').classList.contains('fd-drag-carried')).toBe(true);
    pointer('pointerup', document, 580, 100);
    expect(where(designer.getPage(), 'f-mobile')?.kids).toEqual(['f-first_name', 'f-mobile']);
    expect(designer.getState().picked).toEqual(['f-mobile']);
    expect(chip()).toBeNull();
    expect(element('f-mobile').classList.contains('fd-drag-carried')).toBe(false);
  });

  it('the chip goes to the pointer’s other side near the canvas’s end, never squeezed or past it', () => {
    const { carry, chip, canvas } = setup();
    const real = Element.prototype.getBoundingClientRect;
    const at = (left: number, width: number) => ({ left, right: left + width, top: 0, bottom: 40, width, height: 40, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
    // The canvas is 900 wide; the chip, 220.
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return this === canvas ? at(0, 900) : this.classList.contains('fd-drop-chip') ? at(0, 220) : real.call(this);
    });
    carry('f-mobile', [700, 180], [580, 100]);
    expect(chip()?.style.left).toBe('596px');
    carry('f-ec_name', [400, 500], [870, 600]);
    expect(chip()?.style.left).toBe(`${870 - 16 - 220}px`);
  });

  it('a whole group: the group tinted, the words for the whole', () => {
    const { designer, carry, chip, canvas, pointer } = setup();
    carry('f-mobile', [700, 180], [450, 396]);
    expect(chip()?.querySelector('.fd-drop-where')?.textContent).toBe('new row under “Personal details”');
    expect((canvas.querySelector('.fd-drop-zone') as HTMLElement).hidden).toBe(false);
    pointer('pointerup', document, 450, 396);
    expect(where(designer.getPage(), 'f-mobile')?.kids.slice(0, 2)).toEqual(['personal', 'f-mobile']);
  });

  it('a drop the page refuses: the chip says why, and nothing moves', () => {
    const { designer, carry, chip, bar, pointer } = setup();
    jest.spyOn(designer, 'dropRefusal').mockReturnValue('A row holds four');
    const place = jest.spyOn(designer, 'place');
    const before = designer.getPage();
    carry('f-mobile', [700, 180], [580, 100]);
    expect(chip()?.classList.contains('fd-drop-refused')).toBe(true);
    expect(chip()?.querySelector('.fd-drop-where')?.textContent).toBe('A row holds four');
    expect(bar()?.hidden).toBe(true);
    pointer('pointerup', document, 580, 100);
    expect(place).not.toHaveBeenCalled();
    expect(designer.getPage()).toBe(before);
  });

  it('a tile from the toolbox lands as a new part, the same way', () => {
    const { designer, pointer, chip } = setup();
    const tile = document.createElement('button');
    tile.innerHTML = '<span class="fd-tool-name">Divider</span>';
    document.body.append(tile);
    drag?.press({ tool: 'block:divider' }, new MouseEvent('pointerdown', { clientX: 10, clientY: 10, button: 0 }) as unknown as PointerEvent, tile);
    for (const [x, y] of [[100, 200], [300, 400], [450, 545]]) pointer('pointermove', document, x, y);
    expect(chip()?.textContent).toBe('Dividerunder “Name”');
    pointer('pointerup', document, 450, 545);
    const kids = where(designer.getPage(), 'f-ec_name')?.kids ?? [];
    expect(kids[0]).toBe('f-ec_name');
    expect(designer.getPage().layout.type === 'sections' && JSON.stringify(designer.getPage())).toContain('"type":"divider","id":"divider-1"');
    expect(kids[1]).toBe('divider-1');
  });

  it('Escape puts it back where it was, and a press that does not move is a click', () => {
    const { designer, carry, pointer, chip } = setup();
    const before = designer.getPage();
    carry('f-mobile', [700, 180], [580, 100]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(chip()).toBeNull();
    pointer('pointerup', document, 580, 100);
    expect(designer.getPage()).toBe(before);
    const place = jest.spyOn(designer, 'place');
    const { element } = { element: (id: string) => document.querySelector(`[data-node="${id}"]`) as HTMLElement };
    pointer('pointerdown', element('f-email'), 400, 180);
    pointer('pointerup', document, 401, 181);
    expect(place).not.toHaveBeenCalled();
  });

  it('in Simple mode nothing on the canvas is carried this way', () => {
    const { designer, carry, chip, pointer } = setup();
    drag?.setEnabled(false);
    const place = jest.spyOn(designer, 'place');
    carry('f-mobile', [700, 180], [580, 100]);
    expect(chip()).toBeNull();
    pointer('pointerup', document, 580, 100);
    expect(place).not.toHaveBeenCalled();
  });
});
