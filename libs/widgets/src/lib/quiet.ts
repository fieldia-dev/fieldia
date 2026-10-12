import type { Field, FieldNode } from '@fieldia/core';

/**
 * The quiet look (the `quiet` skin, or a quiet section or field): a value
 * reads as plain words until it is pointed at, when a light box and the
 * control's own sign show, and becomes its editor once clicked or tabbed into.
 * These are the widgets that wear it, by type and widget (none for the type's
 * own); every other keeps its own face in it, already as quiet as it can be —
 * a tick box, a switch, stars, a scale, a slider, a progress bar, a status
 * bar, radios and checkboxes, pictures to pick, a table of lines, a file, a
 * signature, a code editor, a map, a badge, a timer, a colour.
 */
const QUIET: Partial<Record<Field['type'], readonly (string | undefined)[]>> = {
  char: [undefined, 'email', 'phone', 'url', 'password', 'time', 'tags', 'copy'],
  text: [undefined, 'copy'],
  integer: [undefined],
  float: [undefined, 'duration', 'percentage'],
  monetary: [undefined],
  selection: [undefined, 'dot', 'tags'],
  date: [undefined, 'daterange'],
  datetime: [undefined, 'daterange'],
  many2one: [undefined],
  many2many: [undefined, 'tags'],
  reference: [undefined],
  html: [undefined],
  json: ['address'],
  properties: [undefined],
};

/** Whether a field wears the quiet look where it is asked for, or keeps its own face. */
export function wearsQuiet(field: Field, node: FieldNode): boolean {
  // Several choices are ticks, and a many2many with columns a table, unless a widget says otherwise.
  if (!node.widget && ((field.type === 'selection' && field.multiple) || (field.type === 'many2many' && node.columns?.length))) return false;
  return QUIET[field.type]?.includes(node.widget) ?? false;
}

/** Whether a part of a field is in the quiet look now: the viewer marks its field. */
export const isQuiet = (element: Element): boolean => !!element.closest('.fd-field[data-quiet]');

/**
 * In the quiet look a click on a date opens its calendar at once, as a choice
 * opens its options: the browser's own, or `open` for a calendar of the
 * widget's. Tabbed into, it is typed in.
 */
export function openOnClick(input: HTMLInputElement, open: () => void = () => input.showPicker?.()): void {
  input.addEventListener('click', () => {
    if (input.readOnly || !isQuiet(input)) return;
    try {
      open();
    } catch {
      // Not allowed here (a frame, an old browser): the box is typed in instead.
    }
  });
}
