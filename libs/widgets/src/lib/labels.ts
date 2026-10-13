import type { Locale } from '@fieldia/core';
import { LANGUAGES } from './locales/all';

/** Every word a widget shows on its own. `{label}` and `{name}` are filled in. */
export interface WidgetLabels {
  search: string;
  noResults: string;
  /**
   * The box drawn where a part could not be shown, its error kept to it (contain.ts): a field's widget (`{label}`, the
   * field's label), or another part of the page, without a name and with one (`{label}`, its title).
   */
  brokenField: string;
  brokenPart: string;
  brokenPartNamed: string;
  remove: string;
  clear: string;
  addLine: string;
  addSection: string;
  addNote: string;
  deleteLine: string;
  /** A line of a table, as a person is told of it: `{n}` counts from 1. */
  lineN: string;
  /** Said in a table with no lines yet, unless the page has words of its own (`emptyLabel`). */
  noLines: string;
  /** Heads the row that adds up a table's number columns. */
  total: string;
  /** A problem on one line of a table, under the table. `{n}` counts from 1. */
  lineProblem: string;
  /** Problems beyond the first few. */
  moreProblems: string;
  /** The choice that makes a new record from what was typed. `{name}` is filled in. */
  createNamed: string;
  /** Choices at the end of a link's list, and the button that opens the linked record (`{name}`). */
  createAndEdit: string;
  searchMore: string;
  /** A path picker's list: the heading of its suggestions, and the names of a branch's chevron (`{name}`). */
  suggestions: string;
  expandNamed: string;
  collapseNamed: string;
  /** The button that adds to tags, when the page gives it no words of its own: `{label}` is the field's. */
  addNamed: string;
  openNamed: string;
  /** The button that opens a line of a table in a dialog. */
  openLine: string;
  /** A table's lines chosen for its buttons: the tick on a line (`{name}`), the tick choosing every line, and how many are chosen (`{n}`). */
  chooseLine: string;
  chooseAllLines: string;
  linesChosen: string;
  /** The button at a statusbar's end that holds its folded steps, and what it says of the time spent in a step (`{time}`). */
  moreSteps: string;
  timeInStep: string;
  /** The button that lets a person hide or show a table's optional columns. */
  chooseColumns: string;
  /** The button beside a date that opens its calendar. */
  chooseDate: string;
  /** The choice after the options for an answer of one's own, and its box. */
  other: string;
  otherAnswer: string;
  /** Under a single choice that need not be answered, once one is picked: takes the pick back. */
  clearSelection: string;
  previousMonth: string;
  nextMonth: string;
  /** Heads the column of week numbers: short, and in full. */
  weekShort: string;
  week: string;
  /** The formatted-text toolbar and its buttons. */
  formatting: string;
  bold: string;
  italic: string;
  underline: string;
  textStyle: string;
  paragraph: string;
  heading: string;
  subheading: string;
  bulletList: string;
  numberList: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  link: string;
  linkAddress: string;
  applyLink: string;
  removeLink: string;
  /**
   * A formatted text's own tools and words: strikethrough to a checklist, each a
   * named button; a kind of record linked (`{kind}`), a group named in its
   * heading's tools (`{name}`), a heading's level (`{n}`); the Markdown editor's
   * hint and switch, what switching would lose, and a links box's Add link menu.
   */
  strike: string;
  highlight: string;
  textColour: string;
  emoji: string;
  indent: string;
  outdent: string;
  textSize: string;
  code: string;
  mention: string;
  linkRecordNamed: string;
  clearFormatting: string;
  image: string;
  moreTools: string;
  switchToMarkdown: string;
  switchToRich: string;
  markdownSupported: string;
  pasteOrSelect: string;
  preview: string;
  editNamed: string;
  doneEditing: string;
  maximiseNamed: string;
  foldNamed: string;
  unfoldNamed: string;
  addLink: string;
  existingItem: string;
  newItem: string;
  formattingLost: string;
  taskList: string;
  cursorInLink: string;
  attachFile: string;
  switchAnyway: string;
  headingLevel: string;
  upload: string;
  uploadImage: string;
  replace: string;
  removeFile: string;
  dropHere: string;
  /**
   * Several files: the picker's words, an image field's, and the drop zone's;
   * the limits said before anyone tries (`{size}`, `{max}`); how many there are
   * (`{n}`); why some were not added (`{name}`); removing one, asked first.
   */
  addFiles: string;
  addPhotos: string;
  dropThem: string;
  upToSize: string;
  upToEach: string;
  upToFiles: string;
  fileCount: string;
  oneFile: string;
  fileCountOf: string;
  tooMany: string;
  alreadyAdded: string;
  removeAsk: string;
  keep: string;
  /** A file opened to look at: going through them, which one of how many (`{n}` of `{total}`), and what has no preview. */
  previous: string;
  next: string;
  download: string;
  close: string;
  fileAt: string;
  noPreview: string;
  /** The switch over the files, when the page offers one: the files as a list, as cards, or as thumbnails. */
  showFilesAs: string;
  asList: string;
  asCards: string;
  asThumbnails: string;
  invalidJson: string;
  /** Where JSON goes wrong, as a person finds it: `{line}` and `{column}` count from 1. */
  invalidJsonAt: string;
  /** A signature: the pad, the words on it while it is blank, the box to type a name in instead, and wiping it. */
  signaturePad: string;
  signHere: string;
  typeSignature: string;
  clearDrawing: string;
  /** Takes the last stroke away; a picture of a signature, uploaded instead. */
  undo: string;
  uploadSignature: string;
  /** A slider not slid yet, as a screen reader reads it. */
  notAnswered: string;
  /** A ranking's buttons for a line (`{label}`), and where it went, said aloud: `{n}` of `{total}`, counted from 1. */
  moveUp: string;
  moveDown: string;
  movedTo: string;
  /** An address's parts. */
  addressStreet: string;
  addressCity: string;
  addressLine2: string;
  addressRegion: string;
  addressPostcode: string;
  addressCountry: string;
  /** A repeating group: a card's title (`{n}` counts from 1), the button that adds one, and a card gone, said aloud. */
  entry: string;
  addAnother: string;
  /** A repeating group's card copied right after it: `{name}` is its title. */
  copy: string;
  removed: string;
  /** Choices from the app's list: while they load, a button to load them again, and a value the list no longer has (`{name}`). */
  loadingChoices: string;
  choicesFailed: string;
  notOffered: string;
  /** A yes or no as two buttons. */
  yes: string;
  no: string;
  /** Said once as many boxes are ticked as a question takes (`{n}`). */
  upTo: string;
  /** A ranking: taking the order shown as the answer. */
  keepOrder: string;
  /** A rating's point, as a screen reader names it: `{n}` of `{max}`. */
  ofMax: string;
  /** How many more characters a box with a most takes, said to a screen reader once typing pauses. */
  charactersLeft: string;
  /** Flectra's twelve tag colours, kept by their number from 0 (none) to 11, split by |. */
  colourNames: string;
  /** The button that copies a value, and what it says once it has. */
  copyValue: string;
  copied: string;
  /** A document shown inline, while there is none; a page shown inline, opened in a tab of its own. */
  noDocument: string;
  openInNewTab: string;
  /** An analytic distribution: a line's account, its share, adding an account, and shares that do not add up to 100 % ({n}). */
  account: string;
  share: string;
  addAccount: string;
  sharesOff: string;
  /** Tax totals: the amount before tax. */
  untaxed: string;
  /** A list of payments: each one's date ({date}), the amount still due, a payment's details ({amount}), and opening it. */
  paidOn: string;
  amountDue: string;
  paymentOf: string;
  journal: string;
  memo: string;
  openPayment: string;
  /** Properties: adding one in place — its name, its kind (the kinds split by |: text, long text, whole number, number, yes or no, date), Add and Cancel — and while their definitions load. */
  addProperty: string;
  propertyName: string;
  propertyType: string;
  propertyTypes: string;
  add: string;
  cancel: string;
  loading: string;
  /** What an amount is for, after it: a rent's "/month" (a money look's `per`). */
  perDay: string;
  perNight: string;
  perWeek: string;
  perMonth: string;
  perYear: string;
}

/** English: always here, and the words a language leaves out. */
const en: WidgetLabels = {
  search: 'Search…',
  noResults: 'No results',
  brokenField: 'This field could not be shown: {label}',
  brokenPart: 'This part could not be shown',
  brokenPartNamed: 'This part could not be shown: {label}',
  remove: 'Remove {name}',
  clear: 'Clear {label}',
  addLine: 'Add a line',
  addSection: 'Add a section',
  addNote: 'Add a note',
  deleteLine: 'Delete line',
  lineN: 'line {n}',
  noLines: 'No lines yet',
  total: 'Total',
  lineProblem: 'Line {n}: {message}',
  moreProblems: 'and {n} more',
  chooseColumns: 'Choose columns',
  createNamed: 'Create “{name}”',
  createAndEdit: 'Create and edit…',
  searchMore: 'Search more…',
  suggestions: 'Suggestions',
  expandNamed: 'Expand {name}',
  collapseNamed: 'Collapse {name}',
  addNamed: 'Add {label}',
  openNamed: 'Open {name}',
  openLine: 'Open line',
  chooseLine: 'Choose {name}',
  chooseAllLines: 'Choose every line',
  linesChosen: '{n} chosen',
  moreSteps: 'More',
  timeInStep: '{time} in this step',
  chooseDate: 'Choose a date',
  other: 'Other:',
  otherAnswer: 'Your own answer',
  clearSelection: 'Clear selection',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  weekShort: 'Wk',
  week: 'Week',
  formatting: 'Formatting',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  textStyle: 'Text style',
  paragraph: 'Paragraph',
  heading: 'Heading',
  subheading: 'Subheading',
  bulletList: 'Bulleted list',
  numberList: 'Numbered list',
  alignLeft: 'Align left',
  alignCenter: 'Align centre',
  alignRight: 'Align right',
  link: 'Link',
  linkAddress: 'Link address',
  applyLink: 'Apply',
  removeLink: 'Remove link',
  strike: 'Strikethrough',
  highlight: 'Highlight',
  textColour: 'Text colour',
  emoji: 'Emoji',
  indent: 'Increase indent',
  outdent: 'Decrease indent',
  textSize: 'Text size',
  code: 'Code',
  mention: 'Mention someone',
  linkRecordNamed: 'Link {kind}',
  clearFormatting: 'Clear formatting',
  image: 'Insert image',
  moreTools: 'More',
  switchToMarkdown: 'switch to Markdown editor',
  switchToRich: 'switch to rich text editor',
  markdownSupported: 'Markdown supported.',
  pasteOrSelect: 'Paste or select files to insert.',
  preview: 'Preview',
  editNamed: 'Edit {name}',
  doneEditing: 'Done',
  maximiseNamed: 'Maximise {name}',
  foldNamed: 'Collapse {name}',
  unfoldNamed: 'Expand {name}',
  addLink: 'Add link',
  existingItem: 'Existing item',
  newItem: 'New item',
  formattingLost: 'Some formatting cannot be written in Markdown and will be lost. Switch anyway?',
  taskList: 'Checklist',
  cursorInLink: 'Put the cursor in a link first.',
  attachFile: 'Attach a file',
  switchAnyway: 'Switch',
  headingLevel: 'Heading {n}',
  upload: 'Upload a file',
  uploadImage: 'Add a photo',
  replace: 'Replace',
  removeFile: 'Remove',
  dropHere: 'or drop it here',
  addFiles: 'Add files',
  addPhotos: 'Add photos',
  dropThem: 'or drop them here',
  upToSize: 'up to {size}',
  upToEach: 'up to {size} each',
  upToFiles: 'up to {max} files',
  fileCount: '{n} files',
  oneFile: '1 file',
  fileCountOf: '{n} of {max} files',
  tooMany: 'Up to {max} files: {n} not added',
  alreadyAdded: '{name}: already added',
  removeAsk: 'Remove {name}?',
  keep: 'Keep',
  previous: 'Previous',
  next: 'Next',
  download: 'Download',
  close: 'Close',
  fileAt: '{n} of {total}',
  noPreview: 'No preview for this kind of file',
  showFilesAs: 'Show files as',
  asList: 'List',
  asCards: 'Cards',
  asThumbnails: 'Thumbnails',
  invalidJson: 'Not valid JSON',
  invalidJsonAt: 'Not valid JSON: line {line}, column {column}',
  signaturePad: 'Signature pad: draw your signature',
  signHere: 'Sign here',
  typeSignature: 'Or type your name',
  clearDrawing: 'Clear',
  undo: 'Undo',
  uploadSignature: 'Upload a picture',
  notAnswered: 'Not answered',
  moveUp: 'Move {label} up',
  moveDown: 'Move {label} down',
  movedTo: '{label} moved to place {n} of {total}',
  addressStreet: 'Street address',
  addressCity: 'City',
  addressLine2: 'Address line 2',
  addressRegion: 'State or region',
  addressPostcode: 'Postcode',
  addressCountry: 'Country',
  entry: 'Entry {n}',
  addAnother: 'Add another',
  copy: 'Copy {name}',
  removed: '{name} removed',
  loadingChoices: 'Loading choices…',
  choicesFailed: 'Load the choices again',
  notOffered: '{name}: no longer offered',
  yes: 'Yes',
  no: 'No',
  upTo: 'Up to {n}',
  keepOrder: 'Keep this order',
  ofMax: '{n} of {max}',
  charactersLeft: 'Characters left: {n}',
  colourNames: 'No colour|Red|Orange|Yellow|Cyan|Purple|Almond|Teal|Blue|Raspberry|Green|Violet',
  copyValue: 'Copy',
  copied: 'Copied',
  noDocument: 'No document yet',
  openInNewTab: 'Open in a new tab',
  account: 'Account',
  share: 'Percentage',
  addAccount: 'Add an account',
  sharesOff: 'The shares add up to {n}, not 100%',
  untaxed: 'Untaxed amount',
  paidOn: 'Paid on {date}',
  amountDue: 'Amount due',
  paymentOf: 'Payment of {amount}',
  journal: 'Journal',
  memo: 'Memo',
  openPayment: 'Open',
  addProperty: 'Add a property',
  propertyName: 'Property name',
  propertyType: 'Kind',
  propertyTypes: 'Text|Long text|Whole number|Number|Yes or no|Date',
  add: 'Add',
  cancel: 'Cancel',
  loading: 'Loading…',
  perDay: '/day',
  perNight: '/night',
  perWeek: '/week',
  perMonth: '/month',
  perYear: '/year',
};

/**
 * The widgets' words in every language Fieldia has. This package holds all
 * four; the one-tag script holds English alone, and a page adds another
 * language with that language's script (fieldia.ar.js, …), through the
 * viewer's `addLanguage`.
 */
export const WIDGET_LABELS: Record<Locale, WidgetLabels> = { en, ...LANGUAGES };
