import { keyMove } from './canvas-keys';
import { press, mount } from './test-editor';
import { employeeDesigner, employeePage, where } from './test-layout';

/**
 * Moving parts on the Advanced canvas from the keyboard: along the reading
 * order, beside the part before or after, narrower or wider — each move said
 * aloud in the words a drop's chip says.
 */

const alt = (key: string, shiftKey = false) => ({ key, altKey: true, shiftKey });

describe('keyMove: what a key does to a part', () => {
  const page = employeePage();
  it('Alt+↑ and Alt+↓ put it before or after the part next to it, as it is', () => {
    expect(keyMove(page, 'f-email', alt('ArrowUp'), false)).toEqual({ drop: { how: 'at', container: 'who', index: 1 } });
    expect(keyMove(page, 'f-email', alt('ArrowDown'), false)).toEqual({ drop: { how: 'at', container: 'who', index: 3 } });
  });

  it('at the edge of an arrangement, out of it; at the edge of a group, nowhere further', () => {
    expect(keyMove(page, 'f-first_name', alt('ArrowUp'), false)).toEqual({ drop: { how: 'at', container: 'personal', index: 1 } });
    expect(keyMove(page, 'f-nationality', alt('ArrowDown'), false)).toEqual({ drop: { how: 'at', container: 'personal', index: 2 } });
    expect(keyMove(page, 'f-street', alt('ArrowUp'), false)).toEqual({ said: 'It cannot move further' });
  });

  it('Alt+← and Alt+→ put it beside the part before or after it, mirrored right to left', () => {
    expect(keyMove(page, 'f-email', alt('ArrowRight'), false)).toEqual({ drop: { how: 'beside', target: 'f-mobile', after: true } });
    expect(keyMove(page, 'f-email', alt('ArrowLeft'), false)).toEqual({ drop: { how: 'beside', target: 'f-last_name', after: false } });
    expect(keyMove(page, 'f-email', alt('ArrowLeft'), true)).toEqual({ drop: { how: 'beside', target: 'f-mobile', after: true } });
    expect(keyMove(page, 'f-street', alt('ArrowLeft'), false)).toEqual({ said: 'There is nothing that way to put it beside' });
  });

  it('Alt+Shift+← and → narrow and widen it, mirrored right to left', () => {
    expect(keyMove(page, 'f-email', alt('ArrowRight', true), false)).toEqual({ span: 2 });
    expect(keyMove(page, 'f-street', alt('ArrowLeft', true), false)).toEqual({ span: 1 });
    expect(keyMove(page, 'f-street', alt('ArrowLeft', true), true)).toEqual({ span: 3 });
    expect(keyMove(page, 'f-email', alt('ArrowLeft', true), false)).toEqual({ said: 'It is one column wide already' });
  });

  it('nothing for other keys, or a tab', () => {
    expect(keyMove(page, 'f-email', { key: 'ArrowUp', altKey: false, shiftKey: false }, false)).toBeNull();
    expect(keyMove(page, 'tab-pay', alt('ArrowUp'), false)).toBeNull();
  });
});

describe('the keys on the Advanced canvas', () => {
  function setup() {
    localStorage.setItem('fieldia.designer.mode', 'advanced');
    const designer = employeeDesigner();
    const { host } = mount(designer);
    const said = () => (host.querySelector('.fd-canvas-said') as HTMLElement).textContent;
    return { designer, host, said };
  }
  afterEach(() => localStorage.clear());

  it('moves the picked part, says where, and keeps it picked', () => {
    const { designer, said, host } = setup();
    designer.select('f-email');
    press('ArrowUp', { altKey: true }, document.body);
    expect(where(designer.getPage(), 'f-email')?.kids.slice(0, 3)).toEqual(['f-first_name', 'f-email', 'f-last_name']);
    expect(said()).toBe('Work email: before “Last name”');
    expect(host.querySelector('.fd-canvas-said')?.getAttribute('aria-live')).toBe('polite');
    expect(designer.getState().selected).toBe('f-email');
    press('ArrowRight', { altKey: true }, document.body);
    expect(said()).toBe('Work email: beside “Last name”');
    press('ArrowRight', { altKey: true, shiftKey: true }, document.body);
    expect(said()).toBe('Work email: 2 columns wide');
  });

  it('says why a move cannot be made', () => {
    const { designer, said } = setup();
    designer.select('f-street');
    press('ArrowUp', { altKey: true }, document.body);
    expect(said()).toBe('It cannot move further');
    designer.select('f-mobile');
    press('ArrowRight', { altKey: true, shiftKey: true }, document.body);
    press('ArrowRight', { altKey: true, shiftKey: true }, document.body);
    expect(said()).toBe("A field cannot be wider than its section's 2 columns");
  });

  it('groups, ungroups, copies and removes what is picked', () => {
    const { designer } = setup();
    designer.pick('h-send');
    designer.pick('t-note', { add: true });
    press('g', { metaKey: true }, document.body);
    const group = where(designer.getPage(), 'h-send')?.parent as string;
    expect(where(designer.getPage(), 'h-send')?.title).toBe('New group');
    press('g', { metaKey: true, shiftKey: true }, document.body);
    expect(where(designer.getPage(), 'h-send')?.parent).not.toBe(group);
    press('d', { ctrlKey: true }, document.body);
    expect(designer.getState().picked).toHaveLength(2);
    press('Delete', {}, document.body);
    expect(designer.getState().picked).toEqual([]);
  });

  it('lists its keys in the canvas’s help', () => {
    const { host } = setup();
    const help = host.querySelector('.fd-canvas-help button') as HTMLButtonElement;
    expect(help.getAttribute('aria-label')).toBe('Keys for moving parts');
    help.click();
    const list = host.querySelector('.fd-canvas-keys') as HTMLElement;
    expect(list.hidden).toBe(false);
    expect([...list.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Alt+↑ / Alt+↓', 'Alt+← / Alt+→', 'Alt+Shift+← / →', 'Shift-click', '⌘G / ⌘⇧G', '⌘D', 'Delete', 'Escape']);
    // “?” opens the sheet of every key, the canvas's among them (shortcuts-sheet.ts).
    press('?', { shiftKey: true }, document.body);
    expect(document.querySelector('.fd-keys[role="dialog"]')?.textContent).toContain('Put it beside the part before or after it');
  });
});
