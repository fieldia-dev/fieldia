import { plural } from '../speak';

const count = (n: number, one: string) => plural('en', n, { one: `# ${one}`, other: `# ${one}s` });
type End = 'top' | 'bottom';

/** The outline: the page's parts as a tree, each row named with its kind, and what moving rows by drag or by key says. */
export const outline = {
  label: 'Outline',
  tree: 'The page’s parts',
  empty: 'Nothing on the page yet.',
  /** The line under the tree; `{…}` is a key, drawn as one. */
  help: (survey: boolean) =>
    `${survey ? 'Pages and their questions. Drag a row to move it.' : 'Drag a row to move it, into a group by its middle.'} {⇧}-click picks several; {Alt} with an arrow moves what is picked; {?} lists every key.`,
  // ---- a row, as it is drawn and read aloud
  ruled: (survey: boolean): string => (survey ? 'shown only for some answers' : 'shown only for some records'),
  ruledTitle: (survey: boolean): string => (survey ? 'Shown only for some answers' : 'Shown only for some records'),
  required: 'required',
  requiredTitle: 'Required',
  /** A row's name, its kind and what is true of it, as a screen reader reads the row. */
  rowWords: (parts: readonly string[]) => parts.join(', '),
  /** What kind of part each row is. */
  kinds: {
    custom: 'Custom',
    sideBySide: 'Side by side',
    group: 'Group',
    tabs: 'Tabs',
    tabCount: (n: number) => count(n, 'tab'),
    tab: 'Tab',
    untitledTab: 'Untitled tab',
    page: 'Page',
    untitledPage: 'Untitled page',
    column: 'Column',
    statusSteps: 'Status steps',
    status: 'Status',
    button: 'Button',
    counter: 'Counter',
    badge: 'Badge',
    heading: 'Heading',
    note: 'Note',
    words: 'Words',
    divider: 'Line',
    spacer: 'Room',
    image: 'Picture',
    slot: 'Slot',
    part: 'Part',
  },
  /** A group's columns, in the words its badge stands for. */
  columnsStacked: (n: number) => `${n} columns, stacked on smaller screens as the skin does`,
  columnsAt: (desktop: number | undefined, tablet: number | undefined, phone: number | undefined) => {
    const at = (count: number | undefined, screen: string) => (count === undefined ? `${screen} as the skin stacks them` : `${screen} ${count}`);
    return `Columns: ${at(desktop, 'desktop')}, ${at(tablet, 'tablet')}, ${at(phone, 'phone')}`;
  },
  // ---- moving rows
  /** What is moved, said before where it went: a row's name, or how many. */
  it: 'It',
  part: 'Part',
  parts: (n: number) => count(n, 'part'),
  tookOff: (what: string | number) => `Took ${what} off the page`,
  notTakenOff: 'Not taken off',
  notMoved: 'Not moved',
  notHere: 'Not here',
  stays: (one: boolean): string => (one ? 'where it is' : 'where they are'),
  before: (name: string) => `before ${name}`,
  after: (name: string) => `after ${name}`,
  /** Into a part (or onto the page itself, `into` null), before a part there (or at its end, `before` null). */
  into: (into: string | null, before: string | null) => `${into === null ? 'onto the page' : `into ${into}`}, ${before === null ? 'at the end' : `before ${before}`}`,
  // ---- refused
  pickToMove: 'Pick a part to move',
  tabNotInTab: 'A tab holds parts, not other tabs',
  tabAmongItsTabs: 'A tab moves only among its tabs',
  tabAmongTabs: 'A tab goes among tabs: pick a tab to paste it after',
  inOneOfTheTabs: 'Put it in one of the tabs',
  pageNotInPage: 'A page holds questions, not other pages',
  questionOnPage: 'A question goes on a page',
  notInsideItself: 'A part cannot go inside itself',
  holdsNoParts: (name: string) => `${name} holds no parts`,
  // ---- what Alt and an arrow cannot do
  sameGroup: 'Pick parts in the same group to move them together',
  atEdgeOfPage: (one: boolean, end: End) => `${one ? 'It is' : 'They are'} at the ${end} of the page`,
  atEdgeOfSurvey: (one: boolean, end: End) => `${one ? 'It is' : 'They are'} at the ${end === 'bottom' ? 'bottom of the last' : 'top of the first'} page`,
  atEdgeOf: (one: boolean, end: End, name: string, arrow: string) => `${one ? 'It is' : 'They are'} at the ${end} of ${name}: Alt+${arrow} takes ${one ? 'it' : 'them'} out`,
  onPageItself: (one: boolean) => `${one ? 'It is' : 'They are'} on the page itself, in no group`,
  noGroupBefore: (one: boolean): string => (one ? 'There is no group before it to put it in' : 'There is no group before them to put them in'),
  /** The outline's keys, as the sheet of shortcuts lists them. */
  keys: [
    ['↑ / ↓', 'Go to the row before or after'],
    ['← / →', 'Fold or unfold a row, or go to the row it sits in or its first part'],
    ['Home / End', 'Go to the first or the last row'],
    ['A letter', 'Go to the next row whose name starts with it'],
    ['Enter', 'Pick it and show it on the page'],
    ['Space', 'Pick it (⌘ or Ctrl adds it to what is picked)'],
    ['Shift+↑ / ↓', 'Pick the rows on the way too'],
    ['Shift-click', 'Pick every row from the one picked to this one'],
    ['⌘-click', 'Pick one more row, or let it go (Ctrl-click on Windows)'],
    ['Alt+↑ / Alt+↓', 'Move what is picked before the row above it or after the row below'],
    ['Alt+← / Alt+→', 'Take what is picked out of its group, or put it in the group before it'],
    ['Delete', 'Take what is picked off the page'],
  ] as [string, string][],
};

/** Copying, cutting and pasting parts, and what each says it did. */
export const clipboard = {
  keys: [
    ['⌘C', 'Copy what is picked, to paste here or in another designer'],
    ['⌘X', 'Cut what is picked'],
    ['⌘V', 'Paste after what is picked, or into the group picked'],
  ] as [string, string][],
  part: 'part',
  parts: (n: number) => count(n, 'part'),
  copied: (what: string) => `Copied ${what}`,
  cut: (what: string) => `Cut ${what}`,
  copiedNotCut: 'Copied, but not taken off the page',
  nothingPasted: 'Nothing was pasted',
  pasted: (what: string, dropped: number) =>
    `Pasted ${what}${dropped ? `; ${count(dropped, 'rule')} left off: ${dropped === 1 ? 'it' : 'they'} read a field this page has not got` : ''}`,
  // ---- refused
  nothingToPaste: 'There are no Fieldia parts to paste: copy parts in a Fieldia designer first',
  listTakesColumns: 'A list takes columns, not parts: paste them on a screen or a survey',
  pagesOrQuestions: 'Paste pages or questions, not both at once',
  surveyPages: 'A survey’s pages go in a survey',
};
