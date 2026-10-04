import { KEYS as CANVAS_KEYS } from './canvas-keys';
import { CLIPBOARD_KEYS } from './clipboard-keys';
import { OUTLINE_KEYS } from './outline-keys';
import { forPlatform, shortcutGroups } from './shortcuts-list';

/** Every key the designer answers, in one list from where each is documented, as the sheet of shortcuts shows it. */

describe('shortcutGroups', () => {
  it('groups every key: anywhere, on the canvas, in the outline, and while typing', () => {
    const groups = shortcutGroups({ survey: false });
    expect(groups.map((g) => g.name)).toEqual(['Anywhere', 'Canvas', 'Outline', 'Typing']);
    const keys = (name: string) => groups.find((g) => g.name === name)?.keys ?? [];
    // The canvas's and the outline's own lists, never written out again.
    expect(keys('Canvas')).toEqual(CANVAS_KEYS);
    expect(keys('Outline')).toEqual(OUTLINE_KEYS);
    expect(keys('Anywhere')).toEqual(expect.arrayContaining(CLIPBOARD_KEYS));
    expect(keys('Anywhere').map(([k]) => k)).toEqual(expect.arrayContaining(['⌘K or /', '⌘Z', '?']));
  });

  it('a survey has no Advanced canvas, and its own keys while typing', () => {
    const groups = shortcutGroups({ survey: true });
    expect(groups.map((g) => g.name)).toEqual(['Anywhere', 'Outline', 'Typing']);
    expect(groups.find((g) => g.name === 'Typing')?.keys.map(([k]) => k)).toEqual(expect.arrayContaining(['⌘⇧Enter', '⌘⇧K / ⌘⇧J']));
  });
});

describe('forPlatform', () => {
  it('shows ⌘ and ⌥ on a Mac, Ctrl and Alt elsewhere', () => {
    expect(forPlatform('⌘G / ⌘⇧G', true)).toBe('⌘G / ⌘⇧G');
    expect(forPlatform('⌘G / ⌘⇧G', false)).toBe('Ctrl+G / Ctrl+Shift+G');
    expect(forPlatform('Alt+↑ / Alt+↓', true)).toBe('⌥↑ / ⌥↓');
    expect(forPlatform('Alt+↑ / Alt+↓', false)).toBe('Alt+↑ / Alt+↓');
    expect(forPlatform('⌘-click', false)).toBe('Ctrl-click');
    expect(forPlatform('Shift+↑ / ↓', true)).toBe('⇧↑ / ↓');
  });

  it('drops the words for the other kind of computer', () => {
    expect(forPlatform('Put what is picked in a group, or ungroup it (Ctrl on Windows)', true)).toBe('Put what is picked in a group, or ungroup it');
    expect(forPlatform('Pick one more row, or let it go (Ctrl-click on Windows)', false)).toBe('Pick one more row, or let it go');
  });
});
