import { mount } from './test-editor';
import { employeeDesigner, where } from './test-layout';

/**
 * Several picked on the Advanced canvas: Shift, ⌘ or Ctrl adds a part to what
 * is picked, and a bar says how many and what can be done with them — a
 * group, side by side, tabs, a copy each, gone — and a group or an
 * arrangement picked on its own can be ungrouped.
 */

const KEY = 'fieldia.designer.mode';
function setup(mode: 'simple' | 'advanced' = 'advanced') {
  localStorage.setItem(KEY, mode);
  const designer = employeeDesigner();
  const { host } = mount(designer);
  const part = (id: string) => host.querySelector(`.fd-canvas-body [data-node="${id}"]`) as HTMLElement;
  const click = (id: string, keys: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean } = {}) =>
    part(id).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...keys }));
  const bar = () => host.querySelector('.fd-multi') as HTMLElement;
  const action = (name: string) => [...bar().querySelectorAll<HTMLButtonElement>('button')].find((b) => !b.hidden && (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name);
  const shown = () => [...bar().querySelectorAll<HTMLButtonElement>('button')].filter((b) => !b.hidden).map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim());
  return { designer, host, part, click, bar, action, shown };
}

afterEach(() => localStorage.clear());

describe('picking several on the canvas', () => {
  it('Shift, ⌘ or Ctrl adds to what is picked, and each picked part shows it', () => {
    const { designer, click, part } = setup();
    click('f-first_name');
    click('f-last_name', { shiftKey: true });
    click('f-email', { metaKey: true });
    click('f-mobile', { ctrlKey: true });
    expect(designer.getState().picked).toEqual(['f-first_name', 'f-last_name', 'f-email', 'f-mobile']);
    expect(['f-first_name', 'f-last_name', 'f-email', 'f-mobile'].map((id) => part(id).classList.contains('fd-canvas-picked'))).toEqual([true, true, true, true]);
    click('f-email', { shiftKey: true });
    expect(designer.getState().picked).toEqual(['f-first_name', 'f-last_name', 'f-mobile']);
    click('h-send');
    expect(designer.getState().picked).toEqual(['h-send']);
  });

  it('in Simple, one at a time', () => {
    const { designer, click, bar } = setup('simple');
    click('f-first_name');
    click('f-last_name', { shiftKey: true });
    expect(designer.getState().picked).toEqual(['f-last_name']);
    expect(bar().hidden).toBe(true);
  });
});

describe('the bar for several picked', () => {
  it('says how many, and offers what can be done with them', () => {
    const { click, bar, shown } = setup();
    click('f-first_name');
    expect(bar().hidden).toBe(true);
    click('f-last_name', { shiftKey: true });
    expect(bar().hidden).toBe(false);
    expect(bar().getAttribute('role')).toBe('toolbar');
    expect(bar().querySelector('.fd-multi-count')?.textContent).toBe('2 picked');
    expect(shown()).toEqual(['Group', 'Side by side', 'Tabs', 'Duplicate', 'Remove', 'Put down']);
  });

  it('groups them, puts them side by side, or makes tabs of them', () => {
    const { designer, click, action } = setup();
    click('h-send');
    click('t-note', { shiftKey: true });
    action('Side by side')?.click();
    const row = where(designer.getPage(), 'h-send')?.parent as string;
    expect(where(designer.getPage(), row)?.kids).toContain(row);
    expect(designer.getState().picked).toEqual([row]);
    designer.undo();
    click('h-send');
    click('t-note', { shiftKey: true });
    action('Group')?.click();
    expect(where(designer.getPage(), 'h-send')?.title).toBe('New group');
    designer.undo();
    click('f-confirm');
    click('send', { shiftKey: true });
    action('Tabs')?.click();
    expect(where(designer.getPage(), 'f-confirm')?.title).toBeUndefined();
    expect(JSON.stringify(designer.getPage())).toContain('"label":"I confirm these details are correct"');
  });

  it('copies and removes them, and puts them down', () => {
    const { designer, click, action, bar } = setup();
    click('h-send');
    click('t-note', { shiftKey: true });
    action('Duplicate')?.click();
    expect(designer.getState().picked).toHaveLength(2);
    expect(designer.getState().picked).not.toContain('h-send');
    action('Remove')?.click();
    expect(designer.getState().picked).toEqual([]);
    expect(bar().hidden).toBe(true);
    click('h-send');
    click('t-note', { shiftKey: true });
    action('Put down')?.click();
    expect(designer.getState().picked).toEqual([]);
  });

  it('in different groups: no group to make of them, and says why', () => {
    const { click, shown, bar } = setup();
    click('f-first_name');
    click('f-street', { shiftKey: true });
    expect(shown()).toEqual(['Duplicate', 'Remove', 'Put down']);
    expect(bar().querySelector('.fd-multi-why')?.textContent).toBe('Pick parts in the same group to group them');
  });

  it('a group, an arrangement or tabs picked alone can be ungrouped', () => {
    const { designer, click, shown, action, part } = setup();
    designer.select('side-1');
    expect(shown()).toEqual(['Ungroup']);
    action('Ungroup')?.click();
    expect(where(designer.getPage(), 'address')?.parent).toBe('root');
    expect(designer.getState().picked).toEqual(['address', 'emergency']);
    click('f-email');
    expect(part('f-email')).toBeTruthy();
    expect(shown()).toEqual([]);
  });
});
