/**
 * A work item's body in the designer: a group's own column widths and gap, its
 * fold control at the heading's end and its ⤢; help in a light box with an
 * icon; a formatted text's toolbar, tools and editors; a links box.
 */
export const workText = {
  // ---- a group's columns and heading
  columnWidths: 'Column widths',
  columnWidthsHint: 'One for each column, apart by spaces: pixels (274px), a share of the row (50%) or of what is left (1fr). Even columns when empty.',
  gap: 'Gap between columns',
  gapHint: 'In pixels, 0 to 48; the look’s when empty.',
  foldControl: 'Fold control',
  beforeTitle: 'Before the title',
  atHeadingEnd: 'At the heading’s end',
  maximise: 'Maximise',
  maximiseHint: 'A ⤢ at the heading’s end shows the group alone over the record’s body.',
  // ---- refusals
  tracksCount: (columns: number, widths: number) => `The group has ${columns} column${columns === 1 ? '' : 's'} and ${widths} width${widths === 1 ? '' : 's'}: give one width for each column.`,
  noWidth: (track: string) => `“${track}” is no width: write pixels (274px), a share of the row (50%) or of what is left (1fr).`,
  gapRange: 'The gap between columns is a whole number of pixels from 0 to 48.',
  foldNeedsFolding: 'Turn on folding first: the fold control’s place is a folding group’s.',
  maximiseNeedsTitle: 'Give the group a title first: it is maximised from its heading.',
  noIconHere: 'Only words in a help box have an icon.',
  // ---- help in a light box
  helpBox: 'Help box',
  helpBoxTitle: 'In a light box with room for an icon, as a work item’s help; [words](https://…) in it are links',
  icon: 'Icon',
  noIcon: 'No icon',
  // ---- formatted text
  toolbarShown: 'Toolbar',
  always: 'Always',
  whileWorkedIn: 'While worked in',
  never: 'Never',
  toolbarAt: 'Toolbar at',
  atTop: 'The top',
  atFoot: 'The foot',
  editor: 'Editor',
  richText: 'Rich text',
  markdown: 'Markdown',
  switchEditor: 'People can switch editors',
  tools: 'Tools',
  mentions: 'People mentioned with @ are of',
  mentionsPlaceholder: 'res.users',
  references: 'Records linked by a key',
  referenceKey: 'Key',
  referenceModel: 'Model',
  referenceLabel: 'Name',
  addReference: 'Add a kind of record',
  removeReference: (key: string) => `Remove the records linked by ${key}`,
  // ---- a links box
  shownAs: 'Shown as',
  tags: 'Tags',
  linksBox: 'Links with Add link',
  addWay: 'Add link',
  addMenu: 'A menu: Existing item or New item',
  addSearch: 'Searches at once',
  addWords: 'Its words',
  helpWords: 'Help while empty',
  helpIcon: 'Help’s icon',
  helpTiled: 'Icon on a tile',
  helpTile: 'Tile’s colour',
  emptyLink: 'A link in the empty box',
};
