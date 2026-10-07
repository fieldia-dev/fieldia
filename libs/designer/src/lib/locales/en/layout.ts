const PARTS_IN: Record<number, string> = { 2: 'halves', 3: 'thirds', 4: 'quarters' };

/**
 * The layout's edits in words: where a drop puts a part, as the drag chip
 * says it ("between “Customer” and “Visit date” — the row in thirds"), why a
 * layout edit is refused, and a row's fractions. A name in one is quoted
 * already (`parts.quote`); one in a refusal is quoted here.
 */
export const layout = {
  // ---- where a drop goes
  columnInside: (group: string, after: boolean) => `new column inside “${group}”, ${after ? 'after' : 'before'} all its rows — in halves`,
  intoThePage: 'into the page',
  into: (name: string) => `into “${name}”`,
  before: (name: string) => `before “${name}”`,
  atEndOf: (name: string) => `at the end of “${name}”`,
  newRowAbove: (name: string) => `new full-width row above “${name}”`,
  newRowAtEnd: (name: string) => `new full-width row at the end of “${name}”`,
  /** Beside, under or above a part (its name quoted already); `whole`, a new column or row of its own. */
  beside: (name: string, whole: boolean) => `${whole ? 'new column ' : ''}beside ${name}`,
  under: (name: string, whole: boolean) => `${whole ? 'new row ' : ''}under ${name}`,
  above: (name: string, whole: boolean) => `${whole ? 'new row ' : ''}above ${name}`,
  inRoomLeft: (name: string) => `beside ${name}, in the room left`,
  between: (a: string, b: string) => `between ${a} and ${b}`,
  atRowEnd: (name: string) => `at the end of the row, after ${name}`,
  atRowStart: (name: string) => `at the start of the row, before ${name}`,
  /** The row divided equally among its parts, one more with the part dropped. */
  divided: (where: string, parts: number) => `${where} — the row in ${PARTS_IN[parts]}`,
  // ---- why a drop or a layout edit cannot be made
  noPart: (id: string) => `There is no part “${id}”`,
  tabMoves: 'A tab moves only among its tabs',
  notInsideItself: 'A part cannot go inside itself',
  columnInGroup: 'A new column goes inside a group',
  putInATab: 'Put it in one of the tabs',
  holdsNoParts: (name: string) => `“${name}” holds no parts`,
  notBesideItself: 'A part cannot go beside or under itself',
  rowHoldsFour: 'A row holds four',
  noKindOfPart: (kind: string) => `There is no kind of part “${kind}”`,
  sameGroup: 'Pick parts that sit in the same group',
  twoOrMore: 'Pick two or more to put side by side',
  onlyUngroup: 'Only a group or tabs can be ungrouped',
  tabAlone: 'A tab cannot be duplicated on its own: duplicate the tabs, or what is in it',
  noGroupOrTab: (id: string) => `There is no group or tab “${id}”`,
  groupColumns: 'A group has one to four columns, or twelfths',
  smallerScreens: 'A tablet or a phone shows no more columns than a desktop',
  phoneScreen: 'A phone shows no more columns than a tablet',
  tabWidth: 'A tab is as wide as its tabs',
  /** A part by what it is, as the refusals name it: "A field", "Words". */
  nouns: { field: 'A field', section: 'A group', tabs: 'Tabs', tab: 'A tab', text: 'Words', button: 'A button', spacer: 'A spacer', divider: 'A divider', image: 'An image', slot: 'The app’s own part' } as Record<string, string>,
  it: 'It',
  /** A part that takes no width, by its type as the page writes it. */
  runsAcross: (type: string) => `A ${type} runs across the whole row`,
  noWiderThanRow: (noun: string) => `${noun} is no wider than its row`,
  noWiderThanSection: (noun: string, columns: number) => `${noun} cannot be wider than its section's ${columns} columns`,
  aloneInRow: 'Alone in its row, it fills it: let the group’s rows leave gaps to make it narrower',
  restNeedsRoom: 'The rest of its row needs room beside it',
  labelWidth: 'Labels set beside are 60 to 320 px wide',
  noGroup: (id: string) => `There is no group “${id}”`,
  onlyGroupRows: 'Only a group keeps its rows full or with gaps',
  noField: (id: string) => `There is no field “${id}”`,
  colour: 'A colour is written #rrggbb, such as #1f7a4d',
  wordsNotLabel: 'Words have text, not a label',
  onlyAlertColour: 'Only words in an alert’s box have a colour',
  buttonNotText: 'A button has a label, not text',
  pictureWords: 'A picture has an address and a description',
  pictureAddress: 'A picture needs its address',
  onlyBlocks: 'Only words, a button or a picture are changed here',
  pictureWidth: 'A picture’s width is 16 to 4000 pixels',
  link: 'A link is a web address, https://…, or a mail address, mailto:…',
  pickFirst: 'Pick the parts to change first',
  notAnswered: (noun: string) => `${noun} is not answered: only fields are required`,
  noLabels: (noun: string) => `${noun} has no labels to place`,
  foldsByTitle: 'A group folds by its title: give it a title first',
  onlyGroupFolds: 'Only a group folds',
  /** The fractions of a row a part in twelfths is offered: a short word, its label, its name in a menu. */
  rowParts: {
    whole: { words: 'Whole', label: 'Whole row', name: 'Whole row' },
    threeQuarters: { words: '¾', label: '¾ of the row', name: 'Three quarters' },
    twoThirds: { words: '⅔', label: '⅔ of the row', name: 'Two thirds' },
    half: { words: '½', label: '½ of the row', name: 'Half' },
    third: { words: '⅓', label: '⅓ of the row', name: 'A third' },
    quarter: { words: '¼', label: '¼ of the row', name: 'A quarter' },
  },
};
