import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * Every key the designer answers, for the sheet of shortcuts: one list,
 * taken from where each set of keys is documented — the canvas's in
 * canvas-keys.ts, the outline's in outline-keys.ts, the clipboard's in
 * clipboard-keys.ts — and the editors' own here. Written as on a Mac;
 * `forPlatform` turns ⌘ into Ctrl elsewhere.
 */

export type KeyRow = [keys: string, what: string];

export interface KeyGroup {
  name: 'Anywhere' | 'Canvas' | 'Outline' | 'Typing';
  /** Its name as the sheet heads it, in the designer's words. */
  title: string;
  /** When the group's keys work, if not always. */
  when?: string;
  keys: KeyRow[];
}

/** The groups of keys for a survey's editor, or a screen's. */
export function shortcutGroups(options: { survey: boolean; words?: DesignerWords }): KeyGroup[] {
  const words = options.words ?? en;
  const w = words.shortcuts;
  const group = (name: KeyGroup['name'], keys: KeyRow[]): KeyGroup => ({ name, title: w.groups[name], when: w.when[name], keys });
  return [
    group('Anywhere', [...w.anywhere.slice(0, 4), ...words.clipboard.keys, ...w.anywhere.slice(4)]),
    ...(options.survey ? [] : [group('Canvas', words.canvas.keys)]),
    group('Outline', words.outline.keys),
    group('Typing', options.survey ? [...w.typing, ...w.surveyTyping] : w.typing),
  ];
}

/** Keys and words as this computer has them: ⌘ and ⌥ on a Mac, Ctrl and Alt elsewhere; the other's words dropped. */
export function forPlatform(text: string, mac: boolean): string {
  const own = text.replace(/\s*\([^)]*(?:on Windows|في ويندوز)\)/g, '');
  if (mac) return own.replace(/Alt\+/g, '⌥').replace(/Shift\+/g, '⇧');
  return own.replace(/⌘⇧/g, 'Ctrl+Shift+').replace(/⌘-/g, 'Ctrl-').replace(/⌘ \+/g, 'Ctrl +').replace(/⌘/g, 'Ctrl+').replace(/⇧/g, 'Shift+');
}
