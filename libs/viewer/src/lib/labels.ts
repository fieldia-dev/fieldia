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
  /** A form in a side panel: what it asks before Escape or × drops the changes made in it. */
  discardChanges: string;
  /** The × on an alert that may be dismissed. */
  dismiss: string;
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
}

/** English: always here, and the words a language leaves out. */
const en: ViewerLabels = {
  save: 'Save',
  edit: 'Edit',
  done: 'Done',
  discard: 'Discard',
  saving: 'Saving…',
  saved: 'Saved',
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
  discardChanges: 'Discard your changes?',
  dismiss: 'Dismiss',
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
  formMissing: 'The saved form “{page}” cannot be found.',
  formInItself: 'The saved form “{page}” is not shown here: it would be placed inside itself ({chain}).',
  formNotPlaceable: 'The saved form “{page}” cannot be placed here: only a form of sections or tabs can.',
  formBroken: 'The saved form “{page}” cannot be shown.',
  pageMissing: 'The page “{page}” cannot be found.',
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
