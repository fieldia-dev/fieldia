import { elementFactory } from './chrome';
import { openMenu } from './menu';

function setup() {
  const form = document.createElement('div');
  form.className = 'fd-form';
  const anchor = document.createElement('button');
  form.append(anchor);
  document.body.append(form);
  const picked: string[] = [];
  const menu = openMenu({
    el: elementFactory(document),
    anchor,
    title: 'Show Email as',
    items: [
      { id: 'short-answer', label: 'Short answer', icon: 'short-answer' },
      { id: 'email', label: 'Email', icon: 'email', checked: true },
      { id: 'phone', label: 'Phone', icon: 'phone' },
    ],
    note: 'Email is stored as text in the model.',
    onPick: (id) => picked.push(id),
  });
  const items = () => [...document.querySelectorAll<HTMLElement>('.fd-menu [role="menuitemradio"]')];
  return { anchor, menu, picked, items };
}

afterEach(() => document.body.replaceChildren());

describe('a menu of choices', () => {
  it('lists its items with icons, marks the current one, and says why', () => {
    const { items } = setup();
    const menu = document.querySelector('.fd-menu') as HTMLElement;
    expect(menu.getAttribute('role')).toBe('menu');
    expect(menu.getAttribute('aria-label')).toBe('Show Email as');
    expect(items().map((i) => i.textContent)).toEqual(['Short answer', 'Email', 'Phone']);
    expect(items().map((i) => i.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(items()[0].querySelector('svg')).not.toBeNull();
    expect(menu.querySelector('.fd-menu-note')?.textContent).toBe('Email is stored as text in the model.');
    // The current choice takes the keyboard first.
    expect(document.activeElement).toBe(items()[1]);
  });

  it('picks by click, and closes', () => {
    const { items, picked } = setup();
    items()[2].click();
    expect(picked).toEqual(['phone']);
    expect(document.querySelector('.fd-menu')).toBeNull();
  });

  const key = (k: string) => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

  it('moves with the arrows and picks with Enter', () => {
    const { items, picked } = setup();
    key('ArrowDown');
    expect(document.activeElement).toBe(items()[2]);
    key('ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    key('ArrowUp');
    key('Enter');
    expect(picked).toEqual(['phone']);
  });

  it('closes on Escape, giving focus back to what opened it', () => {
    const { picked, anchor } = setup();
    key('Escape');
    expect(document.querySelector('.fd-menu')).toBeNull();
    expect(document.activeElement).toBe(anchor);
    expect(picked).toEqual([]);
  });

  // ARIA's menu must hold items; with none, the note is what there is to read.
  it('with nothing to pick, is a note in a small dialog that takes focus, and Escape gives it back', () => {
    const anchor = document.createElement('button');
    document.body.append(anchor);
    openMenu({ el: elementFactory(document), anchor, title: 'Versions', actions: true, items: [], note: 'Nothing published yet.', onPick: () => undefined });
    const popup = document.querySelector('.fd-menu') as HTMLElement;
    expect(popup.getAttribute('role')).toBe('dialog');
    expect(popup.getAttribute('aria-label')).toBe('Versions');
    expect(document.getElementById(popup.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Nothing published yet.');
    expect(document.activeElement).toBe(popup);
    // Nothing to move through: the arrows and Enter are left to the page (Alt+↓ still moves the part picked).
    const arrow = new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true });
    popup.dispatchEvent(arrow);
    expect(arrow.defaultPrevented).toBe(false);
    key('Escape');
    expect(document.querySelector('.fd-menu')).toBeNull();
    expect(document.activeElement).toBe(anchor);
  });

  it('closes when the pointer goes down elsewhere, and only one is open at a time', () => {
    const { anchor } = setup();
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(document.querySelector('.fd-menu')).toBeNull();
    setup();
    openMenu({ el: elementFactory(document), anchor, items: [{ id: 'a', label: 'A' }], onPick: () => undefined });
    expect(document.querySelectorAll('.fd-menu')).toHaveLength(1);
  });
});
