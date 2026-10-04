import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { mountScreenEditor } from './screen-editor';
import { shortcutKeys } from './shortcuts-sheet';
import { mountSurveyEditor } from './survey-editor';

/**
 * The sheet of shortcuts: “?” outside a box, or “Keyboard shortcuts” in
 * Find anything, opens every key in groups, to search; ⌘ on a Mac and Ctrl
 * elsewhere; Escape closes it and the keyboard goes back where it was.
 */

let root: HTMLElement;
let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
  document.body.replaceChildren();
});
const press = (key: string, target: Element = document.activeElement ?? document.body, more: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...more }));
const sheet = () => document.querySelector('.fd-keys[role="dialog"]') as HTMLElement | null;
const groups = () => [...(sheet()?.querySelectorAll<HTMLElement>('.fd-keys-group') ?? [])].filter((g) => !g.hidden).map((g) => g.querySelector('h3')?.textContent);

function mount(survey = false) {
  root = document.createElement('div');
  document.body.append(root);
  const keys = shortcutKeys({ el: elementFactory(document), root, survey, active: () => true });
  stop = keys.destroy;
  return keys;
}

describe('the sheet of shortcuts', () => {
  it('opens on “?” outside a box, listing every key in its groups, the search box ready', () => {
    mount();
    press('?', document.body, { shiftKey: true });
    expect(sheet()?.getAttribute('aria-modal')).toBe('true');
    expect(sheet()?.getAttribute('aria-labelledby') && document.getElementById(sheet()?.getAttribute('aria-labelledby') as string)?.textContent).toBe('Keyboard shortcuts');
    expect(groups()).toEqual(['Anywhere', 'Canvas', 'Outline', 'Typing']);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Find a key');
    expect(sheet()?.textContent).toContain('Put it beside the part before or after it');
  });

  it('does not open while typing in a box', () => {
    mount();
    const box = document.createElement('input');
    root.append(box);
    box.focus();
    press('?', box);
    expect(sheet()).toBeNull();
  });

  it('finds keys by their words, hiding the groups with none', () => {
    mount();
    press('?', document.body);
    const find = document.activeElement as HTMLInputElement;
    find.value = 'paste';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    expect(groups()).toEqual(['Anywhere', 'Typing']);
    find.value = 'nothing does this';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    expect(groups()).toEqual([]);
    expect((sheet()?.querySelector('.fd-keys-none') as HTMLElement).hidden).toBe(false);
  });

  it('Escape closes it, and the keyboard goes back where it was', () => {
    mount();
    const before = document.createElement('button');
    root.append(before);
    before.focus();
    press('?', before);
    expect(sheet()).not.toBeNull();
    press('Escape');
    expect(sheet()).toBeNull();
    expect(document.activeElement).toBe(before);
  });

  it('closes from its button and from the room round it', () => {
    mount();
    press('?', document.body);
    (sheet()?.querySelector('[aria-label="Close"]') as HTMLButtonElement).click();
    expect(sheet()).toBeNull();
    press('?', document.body);
    const backdrop = sheet()?.parentElement as HTMLElement;
    backdrop.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(sheet()).toBeNull();
  });

  it('is in Find anything as “Keyboard shortcuts”', () => {
    const keys = mount();
    const item = keys.items().find((i) => i.label === 'Keyboard shortcuts');
    item?.run();
    expect(sheet()).not.toBeNull();
  });

  it('a survey’s sheet has no canvas group', () => {
    mount(true);
    press('?', document.body);
    expect(groups()).toEqual(['Anywhere', 'Outline', 'Typing']);
  });
});

describe('the sheet in the editors', () => {
  it('opens from “?” in the screen editor, before the canvas takes the key', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = mountScreenEditor(host, { designer: createDesigner({ page: blankPage('screen', 'Visit') }) });
    press('?', document.body);
    expect(sheet()).not.toBeNull();
    expect((host.querySelector('.fd-canvas-keys') as HTMLElement).hidden).toBe(true);
    handle.destroy();
  });

  it('opens from Find anything in the survey editor', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = mountSurveyEditor(host, { designer: createDesigner({ page: blankPage('survey', 'Feedback') }) });
    press('k', document.body, { metaKey: true });
    const find = document.querySelector('.fd-find-input') as HTMLInputElement;
    find.value = 'keyboard';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    press('Enter', find);
    expect(groups()).toEqual(['Anywhere', 'Outline', 'Typing']);
    handle.destroy();
  });
});
