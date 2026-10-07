import { hotkeyWords } from '@fieldia/core';

/**
 * A button's key, said where it is: to a screen reader, in its tooltip, and
 * on the button itself while Alt is held — ⇧ for Shift, as a keyboard marks it.
 */
export function hotkeyOn(button: HTMLElement, hotkey: string, label: string): void {
  const said = hotkeyWords(hotkey);
  button.setAttribute('data-hotkey', hotkey);
  button.setAttribute('aria-keyshortcuts', said);
  button.title = `${label} (${said})`;
  const mark = button.ownerDocument.createElement('kbd');
  mark.className = 'fd-hotkey';
  mark.setAttribute('aria-hidden', 'true');
  // A key reads the same way round on a page read right to left: ⇧G.
  mark.dir = 'ltr';
  mark.textContent = `${hotkey.startsWith('shift+') ? '⇧' : ''}${hotkey.slice(-1).toUpperCase()}`;
  button.append(mark);
}

/**
 * The key a press with Alt names, as a page writes it — "v", "shift+g" — or
 * null for any other press. By the key's place, not its letter: Alt+V on a
 * Mac types √, and a keyboard in Arabic types another letter there.
 */
export function hotkeyOf(event: KeyboardEvent): string | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return null;
  const pressed = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(event.code);
  return pressed ? `${event.shiftKey ? 'shift+' : ''}${(pressed[1] ?? pressed[2]).toLowerCase()}` : null;
}
