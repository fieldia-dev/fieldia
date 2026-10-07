import { BROWSER_HOTKEYS, HOTKEY, hotkeyWords } from '@fieldia/core';
import { Refusal } from './refusal';

/**
 * A button's key as a person types it — "v", "Shift+G", "Alt+V" — written as
 * a page keeps it ("v", "shift+g"), or a refusal in words: one letter or
 * digit, and not one the browser keeps for itself. Empty takes the key away.
 */
export function hotkeyFrom(typed: string): string | null {
  const key = typed.trim().toLowerCase().replace(/\s+/g, '').replace(/^alt\+/, '');
  if (!key) return null;
  if (!HOTKEY.test(key)) throw new Refusal((w) => w.refusals.hotkeyShape);
  if (BROWSER_HOTKEYS.includes(key.replace('shift+', ''))) throw new Refusal((w) => w.refusals.hotkeyBrowser(hotkeyWords(key)));
  return key;
}

/** A page's key as the designer shows it in its box: "Shift+G". */
export const hotkeyShown = (hotkey: string | undefined) => (hotkey ? hotkeyWords(hotkey).replace(/^Alt\+/, '') : '');
