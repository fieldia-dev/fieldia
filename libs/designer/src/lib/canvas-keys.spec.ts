import type { LayoutNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { createDesigner } from './designer';
import { canvasKeys, keyMove } from './canvas-keys';
import { press, mount } from './test-editor';
import { employeeDesigner, employeePage, watched, where } from './test-layout';

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
    expect(keyMove(page, 'f-email', alt('ArrowUp', true), false)).toBeNull();
    expect(keyMove(page, 'f-email', alt('a'), false)).toBeNull();
  });

  it('one step from the edge, one step still inside', () => {
    expect(keyMove(page, 'f-birthday', alt('ArrowDown'), false)).toEqual({ drop: { how: 'at', container: 'who', index: 5 } });
    expect(keyMove(page, 'f-last_name', alt('ArrowUp'), false)).toEqual({ drop: { how: 'at', container: 'who', index: 0 } });
  });
});

describe('canvasKeys: the keys it takes', () => {
  function setup() {
    const designer = employeeDesigner();
    const keys = canvasKeys({ el: elementFactory(document), designer, rtl: () => false });
    const take = (key: string, init: KeyboardEventInit = {}) => keys.handle(new KeyboardEvent('keydown', { key, cancelable: true, ...init }));
    return { designer, keys, take };
  }

  it('with nothing picked, only its help', () => {
    const { take } = setup();
    expect([take('g', { metaKey: true }), take('d', { ctrlKey: true }), take('Delete'), take('ArrowUp', { altKey: true })]).toEqual([false, false, false, false]);
    expect(take('?')).toBe(true);
  });

  it('with one part picked, its moves and nothing else', () => {
    const { designer, take } = setup();
    designer.select('f-email');
    expect([take('x'), take('g'), take('ArrowUp'), take('?', { metaKey: true })]).toEqual([false, false, false, false]);
    expect(take('ArrowUp', { altKey: true })).toBe(true);
  });

  it('with several picked, no moves', () => {
    const { designer, take } = setup();
    designer.pick('f-email');
    designer.pick('f-mobile', { add: true });
    expect(take('ArrowUp', { altKey: true })).toBe(false);
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

  it('in a group in twelfths, says a width as a fraction of the row, and a drop as where in it', () => {
    const { designer, said } = setup();
    designer.setColumns('address', 12);
    designer.select('f-city');
    press('ArrowRight', { altKey: true, shiftKey: true }, document.body);
    expect(said()).toBe('City: 58% of the row');
    press('ArrowLeft', { altKey: true, shiftKey: true }, document.body);
    expect(said()).toBe('City: half the row');
    press('ArrowRight', { altKey: true }, document.body);
    expect(said()).toBe('City: at the end of the row, after “Postcode”');
    designer.select('f-country');
    press('ArrowLeft', { altKey: true }, document.body);
    expect(said()).toBe('Country: between “Postcode” and “City” — the row in thirds');
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

  it('says what it did to what is picked', () => {
    const { designer, said } = setup();
    designer.pick('h-send');
    designer.pick('t-note', { add: true });
    press('g', { metaKey: true }, document.body);
    expect(said()).toBe('Grouped 2');
    // With Shift, the key comes as a capital.
    press('G', { metaKey: true, shiftKey: true }, document.body);
    expect(said()).toBe('Ungrouped');
    const before = designer.getState().picked;
    press('d', { ctrlKey: true }, document.body);
    expect(said()).toBe('Copied 2');
    const copies = designer.getState().picked;
    expect(copies).toHaveLength(2);
    expect(copies.filter((id) => before.includes(id))).toEqual([]);
    press('Backspace', {}, document.body);
    expect(said()).toBe('Took 2 off the page');
  });

  it('says why what is picked cannot go in a group', () => {
    const { designer, said } = setup();
    designer.pick('f-email');
    designer.pick('h-send', { add: true });
    press('g', { metaKey: true }, document.body);
    expect(said()).toBe('Pick parts that sit in the same group');
  });

  it('says why a move it would make is refused', () => {
    localStorage.setItem('fieldia.designer.mode', 'advanced');
    const page = employeePage();
    const text = (id: string): LayoutNode => ({ type: 'text', id, style: 'paragraph', text: id });
    const row = { type: 'section', id: 'four', style: 'plain', columns: 4, children: ['a', 'b', 'c', 'd'].map(text) } as LayoutNode;
    const own = (page.layout as { children: LayoutNode[] }).children;
    own.splice(own.findIndex((c) => c.id === 'f-confirm'), 0, row);
    const designer = watched(createDesigner({ page }));
    const { host } = mount(designer);
    designer.select('f-confirm');
    press('ArrowLeft', { altKey: true }, document.body);
    expect(host.querySelector('.fd-canvas-said')?.textContent).toBe('A row holds four');
  });

  it('lists its keys in the canvas’s help', () => {
    const { host } = setup();
    const help = host.querySelector('.fd-canvas-help button') as HTMLButtonElement;
    expect(help.getAttribute('aria-label')).toBe('Keys for moving parts');
    const list = host.querySelector('.fd-canvas-keys') as HTMLElement;
    expect([list.hidden, help.getAttribute('aria-expanded'), help.getAttribute('aria-controls')]).toEqual([true, 'false', list.id]);
    help.click();
    expect([list.hidden, help.getAttribute('aria-expanded')]).toEqual([false, 'true']);
    expect([...list.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Alt+↑ / Alt+↓', 'Alt+← / Alt+→', 'Alt+Shift+← / →', 'Shift-click', '⌘G / ⌘⇧G', '⌘D', 'Delete', 'Escape']);
    // “?” opens the sheet of every key, the canvas's among them (shortcuts-sheet.ts).
    press('?', { shiftKey: true }, document.body);
    expect(document.querySelector('.fd-keys[role="dialog"]')?.textContent).toContain('Put it beside the part before or after it');
  });
});
