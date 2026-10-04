import { columnsAt, readSize } from './canvas-size';
import { mount } from './test-editor';
import { employeeDesigner } from './test-layout';

/**
 * The size of screen the canvas shows: a desktop, a tablet or a phone, as the
 * mockup's switch on the stage. Each group shows the columns it has on that
 * size, whatever the canvas's own width, as the form would at that size.
 */

describe('columnsAt: a group’s columns on a size of screen, as the form lays them out', () => {
  it('a desktop shows the wide count', () => {
    expect(columnsAt(3, 'desktop', 'outlined')).toBe(3);
    expect(columnsAt({ wide: 3, medium: 2, narrow: 1 }, 'desktop', 'outlined')).toBe(3);
    expect(columnsAt(undefined, 'desktop', 'outlined')).toBe(1);
  });

  it('a tablet its own, or as the skin stacks by itself: the outlined skin keeps its columns, the underline skin one', () => {
    expect(columnsAt({ wide: 3, medium: 2 }, 'tablet', 'outlined')).toBe(2);
    expect(columnsAt({ wide: 3, medium: 2 }, 'tablet', 'underline')).toBe(2);
    expect(columnsAt(3, 'tablet', 'outlined')).toBe(3);
    expect(columnsAt(3, 'tablet', 'underline')).toBe(1);
    expect(columnsAt({ wide: 3, narrow: 1 }, 'tablet', 'outlined')).toBe(3);
  });

  it('a phone its narrow count, or one', () => {
    expect(columnsAt({ wide: 3, medium: 2, narrow: 2 }, 'phone', 'outlined')).toBe(2);
    expect(columnsAt({ wide: 3, medium: 2 }, 'phone', 'outlined')).toBe(1);
    expect(columnsAt(3, 'phone', 'outlined')).toBe(1);
  });
});

describe('the screen-size switch', () => {
  afterEach(() => localStorage.clear());
  const setup = (mode: 'simple' | 'advanced') => {
    localStorage.setItem('fieldia.designer.mode', mode);
    const designer = employeeDesigner();
    const { host, handle } = mount(designer);
    const sizes = host.querySelector('.fd-canvas-sizes') as HTMLElement;
    const button = (name: string) => sizes.querySelector(`button[data-size="${name}"]`) as HTMLButtonElement;
    const cols = (id: string) => (host.querySelector(`.fd-canvas-body [data-node="${id}"] > .fd-grid`) as HTMLElement).style.getPropertyValue('--fd-cols');
    const canvas = host.querySelector('.fd-canvas') as HTMLElement;
    return { designer, host, handle, sizes, button, cols, canvas };
  };

  it('starts on a desktop, each group showing its wide columns', () => {
    const { sizes, button, cols, canvas } = setup('advanced');
    expect(sizes.getAttribute('role')).toBe('group');
    expect(sizes.getAttribute('aria-label')).toBe('Screen size');
    expect(['desktop', 'tablet', 'phone'].map((s) => button(s).getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(canvas.dataset['size']).toBe('desktop');
    expect([cols('personal'), cols('side-1'), cols('address')]).toEqual(['3', '2', '2']);
    // An arrangement on its grid's tracks keeps what it covers there.
    expect(cols('who')).toBe('');
  });

  it('on a tablet and a phone, their columns; the choice kept in this browser', () => {
    const { handle, button, cols, canvas, designer } = setup('advanced');
    button('tablet').click();
    expect(canvas.dataset['size']).toBe('tablet');
    expect([cols('personal'), cols('side-1'), cols('address')]).toEqual(['3', '1', '2']);
    button('phone').click();
    expect([cols('personal'), cols('side-1'), cols('address')]).toEqual(['1', '1', '1']);
    expect(localStorage.getItem('fieldia.designer.size')).toBe('phone');
    handle.destroy();
    document.body.replaceChildren();
    const { host } = mount(designer);
    expect((host.querySelector('.fd-canvas') as HTMLElement).dataset['size']).toBe('phone');
  });

  it('Simple shows a desktop, whatever was chosen in Advanced', () => {
    localStorage.setItem('fieldia.designer.size', 'phone');
    const { cols, canvas } = setup('simple');
    expect(canvas.dataset['size']).toBe('desktop');
    expect(cols('personal')).toBe('3');
  });

  it('works when the browser keeps nothing', () => {
    expect(readSize({ get localStorage(): Storage { throw new Error('blocked'); } } as unknown as Window)).toBe('desktop');
    expect(readSize({ localStorage: { getItem: () => 'tv' } } as unknown as Window)).toBe('desktop');
  });
});
