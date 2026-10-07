/**
 * A table's own rules and a field's tone, as the panel words them: what each
 * column's cells do line by line, the lines' tones, the table's buttons, how it
 * shows on a phone, and the widths a part is hidden at.
 */
export const tables = {
  // ---- the settings' names, as the panel shows them
  tone: 'Tone',
  lineRules: 'Line rules',
  tableButtons: 'Table buttons',
  table: 'Table',
  hiddenOn: 'Hidden on',
  // ---- tones
  tones: { info: 'Blue', success: 'Green', warning: 'Amber', danger: 'Red', muted: 'Grey' } as Record<'info' | 'success' | 'warning' | 'danger' | 'muted', string>,
  toneOf: 'Tone',
  addTone: 'Add a tone',
  toneHint: 'Its value in a colour while a condition holds: the first that holds.',
  boldWhen: 'Bold when',
  when: 'When',
  whenPlaceholder: 'Quantity > Demand — type a field’s name, or @',
  removeTone: (n: number) => `Remove tone ${n}`,
  // ---- a table's lines and columns
  linesTone: 'Lines’ tones',
  linesHint: 'A line’s condition reads its own fields, and the record as parent: parent.state.',
  column: 'Column',
  hiddenOnLineWhen: 'Blank on a line when',
  readonlyWhen: 'Read-only when',
  requiredWhen: 'Required when',
  columnHiddenWhen: 'Column hidden when',
  columnHiddenHint: 'Read on the record, not a line: the whole column goes.',
  badge: 'As a pill',
  /** A column's cells drawn by a widget: as its type shows them, or one that suits it. */
  shownAs: 'Shown as',
  asItsType: 'As its kind shows it',
  width: 'Width, in characters',
  // ---- buttons
  onEachLine: 'On each line',
  forChosenLines: 'For the lines chosen',
  besideAdd: 'Beside Add a line',
  buttonWords: 'Words',
  action: 'App action',
  hiddenWhen: 'Hidden when',
  addButton: 'Add a button',
  removeButton: (label: string) => `Remove “${label}”`,
  newButton: 'Button',
  // ---- the table's shape
  lineOpens: 'A line opens',
  opensFields: 'Its fields',
  opensRecord: 'Its own page',
  onAPhone: 'On a phone',
  rows: 'Rows',
  cardsOnPhone: 'Cards',
  cardsAlways: 'Cards, always',
  columnWidths: 'Column widths',
  shareWidth: 'Share the width',
  fitContent: 'As wide as they hold',
  copyLine: 'Copy a line',
  // ---- widths a part is hidden at
  widths: { narrow: 'Phone', medium: 'Tablet', wide: 'Wide screen' } as Record<'narrow' | 'medium' | 'wide', string>,
  hiddenOnHint: 'Hidden while the form is that wide: a phone up to 520px, a tablet up to 760px.',
  // ---- refusals
  onlyTables: 'Only a table of lines has rules for its lines, buttons and cards',
  notAColumn: (name: string) => `“${name}” is not a column of this table`,
  widthRange: 'A width is 1 to 200 characters',
  widgetUnsuited: (column: string, widget: string) => `${column} cannot be shown as ${widget}: it does not hold what that shows`,
  buttonNeedsWords: 'A button needs words',
  // ---- what changed, for the Publish dialog
  tableChanged: (name: string) => `“${name}”: its table’s rules changed`,
  toneChanged: (name: string) => `“${name}”: its tone changed`,
};
