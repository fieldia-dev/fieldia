import { KEYS as CANVAS_KEYS } from './canvas-keys';
import { CLIPBOARD_KEYS } from './clipboard-keys';
import { OUTLINE_KEYS } from './outline-keys';

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
  /** When the group's keys work, if not always. */
  when?: string;
  keys: KeyRow[];
}

/** The bar's keys, and the editors' own (chrome.ts, screen-editor.ts, survey-editor.ts). */
const ANYWHERE: KeyRow[] = [
  ['⌘K or /', 'Find anything: a field, a kind, a setting, an action'],
  ['⌘Z', 'Undo'],
  ['⌘⇧Z or ⌘Y', 'Redo'],
  ['?', 'This sheet of keys'],
  ['Escape', 'Put down what is picked'],
];

const TYPING: KeyRow[] = [
  ['Enter', 'From a label to its help, and from the help out'],
  ['Escape', 'Leave the box, and put the part down'],
  ['⌘C / ⌘X / ⌘V', 'Copy, cut and paste words, as ever'],
];

const SURVEY_TYPING: KeyRow[] = [
  ['⌘⇧Enter', 'Add a question after this one'],
  ['⌘⇧D', 'Copy the question'],
  ['⌘⇧K / ⌘⇧J', 'Move the question up or down'],
];

/** The groups of keys for a survey's editor, or a screen's. */
export function shortcutGroups(options: { survey: boolean }): KeyGroup[] {
  return [
    { name: 'Anywhere', when: 'Outside a box being typed in', keys: [...ANYWHERE.slice(0, 4), ...CLIPBOARD_KEYS, ...ANYWHERE.slice(4)] },
    ...(options.survey ? [] : [{ name: 'Canvas' as const, when: 'In Advanced, with a part picked', keys: CANVAS_KEYS }]),
    { name: 'Outline', when: 'With a row of the outline focused', keys: OUTLINE_KEYS },
    { name: 'Typing', when: 'In a label, a help or a title', keys: options.survey ? [...TYPING, ...SURVEY_TYPING] : TYPING },
  ];
}

/** Keys and words as this computer has them: ⌘ and ⌥ on a Mac, Ctrl and Alt elsewhere; the other's words dropped. */
export function forPlatform(text: string, mac: boolean): string {
  const own = text.replace(/\s*\([^)]*on Windows\)/g, '');
  if (mac) return own.replace(/Alt\+/g, '⌥').replace(/Shift\+/g, '⇧');
  return own.replace(/⌘⇧/g, 'Ctrl+Shift+').replace(/⌘-/g, 'Ctrl-').replace(/⌘/g, 'Ctrl+').replace(/⇧/g, 'Shift+');
}
