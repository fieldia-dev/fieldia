/** A button's key: a letter or a digit, with `shift+` before it or not — pressed with Alt. */
export const HOTKEY = /^(shift\+)?[a-z0-9]$/;

/** Keys a browser keeps for itself with Alt: the address bar (D), its menus (E, F). */
export const BROWSER_HOTKEYS: readonly string[] = ['d', 'e', 'f'];

/** A key as a person presses it: "shift+g" is Alt+Shift+G. */
export const hotkeyWords = (hotkey: string) => `Alt+${hotkey.startsWith('shift+') ? 'Shift+' : ''}${hotkey.slice(-1).toUpperCase()}`;
