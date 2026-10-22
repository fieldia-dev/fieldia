import { elementFactory } from './chrome';
import { growingBox } from './growing-box';

/** A title's box that wraps its words, never cutting them, and keeps to one line of text. */
describe('a growing box', () => {
  const make = () => {
    const box = growingBox(elementFactory(document), { class: 'fd-step-title', 'aria-label': 'Page title' });
    document.body.append(box);
    return box;
  };
  const key = (box: HTMLElement, init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    box.dispatchEvent(event);
    return event.defaultPrevented;
  };

  afterEach(() => document.body.replaceChildren());

  it('is a box of one row that wraps, named as it was asked', () => {
    const box = make();
    expect(box.tagName).toBe('TEXTAREA');
    expect(box.rows).toBe(1);
    expect(box.classList.contains('fd-step-title')).toBe(true);
    expect(box.classList.contains('fd-growing')).toBe(true);
    expect(box.getAttribute('aria-label')).toBe('Page title');
  });

  it('never breaks its line on Enter, or Shift+Enter; with Ctrl, ⌘ or Alt, Enter is the editor’s', () => {
    const box = make();
    expect(key(box, { key: 'Enter' })).toBe(true);
    expect(key(box, { key: 'Enter', shiftKey: true })).toBe(true);
    expect(key(box, { key: 'Enter', ctrlKey: true, shiftKey: true })).toBe(false);
    expect(key(box, { key: 'Enter', metaKey: true })).toBe(false);
    expect(key(box, { key: 'Enter', altKey: true })).toBe(false);
    expect(key(box, { key: 'a' })).toBe(false);
  });

  it('takes lines pasted as one, joined by spaces, and says it changed', () => {
    const box = make();
    box.value = 'Your ';
    box.setSelectionRange(5, 5);
    const said: string[] = [];
    box.addEventListener('input', () => said.push(box.value));
    const paste = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: { getData: () => string } };
    paste.clipboardData = { getData: () => 'experience\r\n  of it \nso far' };
    box.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    expect(box.value).toBe('Your experience of it so far');
    expect(said).toEqual(['Your experience of it so far']);
  });

  it('turns a line break come in some other way into a space, the caret kept', () => {
    const box = make();
    box.value = 'Your\nexperience';
    box.setSelectionRange(5, 5);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    expect(box.value).toBe('Your experience');
    expect(box.selectionStart).toBe(5);
  });

  it('grows to its words when they are set as the page changes', () => {
    const box = make();
    box.value = 'Your experience';
    // jsdom lays nothing out: the height is its scrolled height, written as the value is set.
    expect(box.style.height).toMatch(/px$/);
    expect(box.value).toBe('Your experience');
  });
});
