import type { Locale } from '@fieldia/core';
import { LANGUAGES } from './locales/all';

/** Every word the viewer shows, so a page can be translated. `{n}`, `{total}` and `{time}` are filled in. */
export interface ViewerLabels {
  save: string;
  /** Switching a read-only form to editing, and back. */
  edit: string;
  done: string;
  discard: string;
  saving: string;
  saved: string;
  /** Saved, or sent, but not a change made since it started — while it was on its way, or after: still to save. */
  savedNotLatest: string;
  sentNotLatest: string;
  /** A save or a send waiting for files still on their way to the store: one, or `{n}`. */
  savingAfterFile: string;
  savingAfterFiles: string;
  sendingAfterFile: string;
  sendingAfterFiles: string;
  submit: string;
  next: string;
  back: string;
  /** Passing over an optional step. */
  skip: string;
  /** The list of a wizard's steps, for screen readers. */
  steps: string;
  stepOf: string;
  submitted: string;
  submitAnother: string;
  draftFound: string;
  restore: string;
  discardDraft: string;
  ok: string;
  cancel: string;
  loading: string;
  /** A form in a dialog: the button that saves it and closes the dialog, and the × that closes it. */
  saveClose: string;
  close: string;
  /**
   * A record's head and the dialog round it: the dialog's ⤢ and its Restore,
   * its grip, the title's copy button and what it says once copied, the ⋮ of
   * the record's menu, "Updated by" (`{name}`, `{date}`), what Undo says with
   * nothing to put back, and a tab's name with its count (`{label}`, `{count}`).
   */
  maximise: string;
  restoreSize: string;
  resize: string;
  copyTitle: string;
  titleCopied: string;
  moreActions: string;
  /** A split button's chevron, named for the button it opens more of (`{label}`), unless it has a name of its own. */
  optionsFor: string;
  updatedBy: string;
  nothingChanged: string;
  countOf: string;
  /** A form in a side panel: what it asks before Escape or × drops the changes made in it. */
  discardChanges: string;
  /** The × on an alert that may be dismissed. */
  dismiss: string;
  /** The (?) beside a label that shows its help: its name, as a screen reader says it. */
  helpFor: string;
  /**
   * The quiet look: the words in an empty field that say what to add
   * (`{label}`, the field's label), or in an empty question's, and the name of
   * the lock by a field a rule keeps read-only.
   */
  quietHint: string;
  quietAnswer: string;
  locked: string;
  /** Saving again after a save failed. */
  retry: string;
  notSaved: string;
  notSent: string;
  /** What was not saved or sent, and the fields to look at. */
  checkFields: string;
  /** The banner when the server cannot be reached. */
  offline: string;
  /** A list: its pages (`{from}`, `{to}`, `{total}`), what is chosen in it, and an empty one. */
  previousPage: string;
  nextPage: string;
  range: string;
  selected: string;
  clearSelection: string;
  selectAll: string;
  /** A list that is also a map: the switch between them, and its name. */
  showAs: string;
  viewList: string;
  viewMap: string;
  viewBoth: string;
  selectRecord: string;
  noRecords: string;
  loadFailed: string;
  /**
   * A list's search bar: the box (`{field}` and `{text}` in a suggestion), its
   * chips (`{label}`), the Filters, Group By and Favourites menu (`{name}`),
   * and the conditions a custom filter offers.
   */
  search: string;
  searchLabel: string;
  searchFor: string;
  searchOptions: string;
  filters: string;
  groupBy: string;
  favourites: string;
  or: string;
  removeFacet: string;
  addCustomFilter: string;
  field: string;
  condition: string;
  value: string;
  apply: string;
  saveSearch: string;
  searchName: string;
  useByDefault: string;
  deleteFavourite: string;
  noFavourites: string;
  opIs: string;
  opIsNot: string;
  opContains: string;
  opGreater: string;
  opLess: string;
  opSet: string;
  opNotSet: string;
  yes: string;
  no: string;
  /** A list's groups: the one of records with no value, and the rest of a group's records (`{n}`). */
  none: string;
  loadMore: string;
  /**
   * A list's filter bar (`search: "fields"`): its keyword box, the button that
   * clears every filter, each field's list of values (`{label}`, the field's),
   * and the gear that chooses which fields it offers. A list of nested rows:
   * the header's buttons that open and close every parent.
   */
  filterByKeyword: string;
  clearFilters: string;
  expandAll: string;
  collapseAll: string;
  filterNamed: string;
  filterSettings: string;
  /**
   * A saved form placed in another, in its place when it cannot be shown
   * (`{page}`, its title or id): not found, placed inside itself (`{chain}`,
   * the forms round it), laid out as no form can hold, or with problems of its
   * own (said in the console).
   */
  formMissing: string;
  formInItself: string;
  formNotPlaceable: string;
  formBroken: string;
  /** A page a step opens that the app has none of (`{page}`, its id). */
  pageMissing: string;
  /**
   * Over a record: the gear menu (`actions`, its `print` group and its
   * built-in items), the trail to it (`breadcrumbs`, a new record's crumb
   * `newRecord`), and the pager (`records`, `recordAt` with `{n}` and
   * `{total}`, its buttons).
   */
  actions: string;
  print: string;
  archive: string;
  unarchive: string;
  duplicate: string;
  delete: string;
  breadcrumbs: string;
  newRecord: string;
  records: string;
  recordAt: string;
  previousRecord: string;
  nextRecord: string;
  /** The record's main attachment beside it (`{name}`, the file's): its name, Open, and the buttons through several. */
  attachment: string;
  openAttachment: string;
  previousAttachment: string;
  nextAttachment: string;
  /**
   * Save safety. A save over someone else's: who changed the record and when
   * (`{name}`, `{time}`) or since it was opened, `someoneElse` when the source
   * did not say who, the fields they changed and those both changed
   * (`{fields}`), what the two buttons do, and the buttons. After Reload: the
   * changes set aside, each with Put back (`{label}`, the field's) and what it
   * holds now (`{value}`), and Put all back. A record the person may only
   * read, a field they may see but not change, and the gear menu's items not
   * open to them (`{actions}`).
   */
  conflictAt: string;
  conflictSince: string;
  someoneElse: string;
  conflictChanged: string;
  conflictBoth: string;
  conflictChoice: string;
  reload: string;
  keepMine: string;
  reloaded: string;
  setAside: string;
  putBack: string;
  putBackField: string;
  putAllBack: string;
  nowIs: string;
  readOnlyRecord: string;
  fieldNotYours: string;
  notOffered: string;
}

/** English: always here, and the words a language leaves out. */
const en: ViewerLabels = {
  save: 'Save',
  edit: 'Edit',
  done: 'Done',
  discard: 'Discard',
  saving: 'Saving…',
  saved: 'Saved',
  savedNotLatest: 'Saved, but not your latest changes.',
  sentNotLatest: 'Sent, but not your latest changes.',
  savingAfterFile: '1 file still uploading. Saving when it is done.',
  savingAfterFiles: '{n} files still uploading. Saving when they are done.',
  sendingAfterFile: '1 file still uploading. Sending when it is done.',
  sendingAfterFiles: '{n} files still uploading. Sending when they are done.',
  submit: 'Submit',
  next: 'Next',
  back: 'Back',
  skip: 'Skip',
  steps: 'Steps',
  stepOf: 'Step {n} of {total}',
  submitted: 'Thank you. Your answers were sent.',
  submitAnother: 'Submit another response',
  draftFound: 'You have unsaved answers from {time}.',
  restore: 'Restore',
  discardDraft: 'Discard',
  ok: 'OK',
  cancel: 'Cancel',
  loading: 'Loading…',
  saveClose: 'Save & Close',
  close: 'Close',
  maximise: 'Maximise',
  restoreSize: 'Restore',
  resize: 'Resize',
  copyTitle: 'Copy title',
  titleCopied: 'Title copied',
  moreActions: 'More actions',
  optionsFor: '{label} options',
  updatedBy: 'Updated by {name}: {date}',
  nothingChanged: 'Nothing has changed.',
  countOf: '{label}, {count}',
  discardChanges: 'Discard your changes?',
  dismiss: 'Dismiss',
  helpFor: 'Help for {label}',
  quietHint: 'Add {label}',
  quietAnswer: 'Your answer',
  locked: 'Locked: {label}',
  retry: 'Retry',
  notSaved: 'Not saved',
  notSent: 'Not sent',
  checkFields: '{what}. Check: {fields}',
  offline: 'Could not reach the server. Your changes are still here.',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  range: '{from}–{to} / {total}',
  selected: '{n} selected',
  clearSelection: 'Clear',
  selectAll: 'Select all',
  showAs: 'Show as',
  viewList: 'List',
  viewMap: 'Map',
  viewBoth: 'List and map',
  selectRecord: 'Select {name}',
  noRecords: 'No records match.',
  loadFailed: 'Could not load the records.',
  search: 'Search…',
  searchLabel: 'Search',
  searchFor: 'Search {field} for: {text}',
  searchOptions: 'Search options',
  filters: 'Filters',
  groupBy: 'Group By',
  favourites: 'Favourites',
  or: 'or',
  removeFacet: 'Remove {label}',
  addCustomFilter: 'Add a custom filter',
  field: 'Field',
  condition: 'Condition',
  value: 'Value',
  apply: 'Apply',
  saveSearch: 'Save current search',
  searchName: 'Name of the search',
  useByDefault: 'Use by default',
  deleteFavourite: 'Delete {name}',
  noFavourites: 'No saved searches yet.',
  opIs: 'is',
  opIsNot: 'is not',
  opContains: 'contains',
  opGreater: 'greater than',
  opLess: 'less than',
  opSet: 'is set',
  opNotSet: 'is not set',
  yes: 'Yes',
  no: 'No',
  none: 'None',
  loadMore: 'Show {n} more',
  filterByKeyword: 'Filter by keyword',
  clearFilters: 'Clear filters',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  filterNamed: 'Filter by {label}',
  filterSettings: 'Filter settings',
  formMissing: 'The saved form “{page}” cannot be found.',
  formInItself: 'The saved form “{page}” is not shown here: it would be placed inside itself ({chain}).',
  formNotPlaceable: 'The saved form “{page}” cannot be placed here: only a form of sections or tabs can.',
  formBroken: 'The saved form “{page}” cannot be shown.',
  pageMissing: 'The page “{page}” cannot be found.',
  actions: 'Actions',
  print: 'Print',
  archive: 'Archive',
  unarchive: 'Unarchive',
  duplicate: 'Duplicate',
  delete: 'Delete',
  breadcrumbs: 'Breadcrumbs',
  newRecord: 'New',
  records: 'Records',
  recordAt: '{n} / {total}',
  previousRecord: 'Previous record',
  nextRecord: 'Next record',
  attachment: 'Attachment: {name}',
  openAttachment: 'Open',
  previousAttachment: 'Previous attachment',
  nextAttachment: 'Next attachment',
  conflictAt: '{name} changed this record at {time}.',
  conflictSince: '{name} changed this record after you opened it.',
  someoneElse: 'Someone else',
  conflictChanged: 'They changed: {fields}.',
  conflictBoth: 'You both changed: {fields}.',
  conflictChoice: 'Reload shows their version and lists your changes to put back. Keep mine saves yours over theirs.',
  reload: 'Reload',
  keepMine: 'Keep mine',
  reloaded: 'Reloaded: this is the record as it is now.',
  setAside: 'Your changes were not saved. Put back the ones you still want:',
  putBack: 'Put back',
  putBackField: 'Put back {label}',
  putAllBack: 'Put all back',
  nowIs: 'now {value}',
  readOnlyRecord: 'You can read this record, but not change it.',
  fieldNotYours: 'You can see this field, but not change it.',
  notOffered: 'Not open to you here: {actions}.',
};

/**
 * The viewer's words in every language Fieldia has. This package holds all
 * four; the one-tag script holds English alone, and a page adds another
 * language with that language's script (fieldia.ar.js, …), through
 * `addLanguage`.
 */
export const VIEWER_LABELS: Record<Locale, ViewerLabels> = { en, ...LANGUAGES };

/** English, kept under its old name. */
export const DEFAULT_LABELS: ViewerLabels = VIEWER_LABELS.en;

/** The languages with a script of their own beside the one-tag script, by name. */
const ADD_ONS = new Map([
  ['ar', 'Arabic'],
  ['de', 'German'],
  ['fr', 'French'],
]);
const missing = new Set<string>();

/**
 * The language of the viewer's own words for a language tag: its own, its
 * base language's (`ar` for `ar-EG`), or English. A language the one-tag
 * script was not given is English, and the console says once which script
 * to add.
 */
export function ownLocale(tag = 'en'): Locale {
  const base = tag.split('-')[0];
  if (Object.prototype.hasOwnProperty.call(VIEWER_LABELS, base)) return base as Locale;
  const name = ADD_ONS.get(base);
  if (name && !missing.has(base)) {
    missing.add(base);
    console.warn(
      `Fieldia: this page is in ${name}, but only English words are loaded, so Fieldia's own words show in English. ` +
        `Load the ${name} ones after fieldia.js: <script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.${base}.js"></script>`
    );
  }
  return 'en';
}
