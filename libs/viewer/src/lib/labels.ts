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
  /** Saved, but a change is still to save: made while it was on its way or since, a file on its way, a change set aside. Sent, but an answer changed since. */
  savedNotAll: string;
  sentNotLatest: string;
  /** A save or a send waiting for files still on their way to the store: one, or `{n}`. */
  savingAfterFile: string;
  savingAfterFiles: string;
  sendingAfterFile: string;
  sendingAfterFiles: string;
  /**
   * A way out — another record, a close, a reload — waiting before it checks the person's work: for the save on its
   * way, or for files still on theirs (one, or `{n}`).
   */
  leaveAfterSave: string;
  leaveAfterFile: string;
  leaveAfterFiles: string;
  /** Done pressed with work of the person's not saved — a change set aside, a file no save sent: the form stays editable, and says so. */
  notAllSaved: string;
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
  /** A public page's hidden box (`botCheck`), which no person sees: what it says to one who does, its look gone. */
  leaveEmpty: string;
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
  /** A list's gallery on its switcher: its records as cards in a grid. */
  viewGallery: string;
  /**
   * A list whose columns people shape: the Columns menu, its Move up and Move down (`{label}`, the column's), its
   * Reset, a column's grip that sizes it, and the header of each row's own buttons.
   */
  columns: string;
  moveColumnUp: string;
  moveColumnDown: string;
  resetColumns: string;
  resizeColumn: string;
  rowActions: string;
  selectRecord: string;
  noRecords: string;
  loadFailed: string;
  /**
   * A list's selection of every record that matches (`{n}` written as the page writes numbers), and what it says when
   * the source gave fewer than match (`{n}` of `{total}`) or none.
   */
  selectAllMatching: string;
  selectingAll: string;
  selectedOf: string;
  selectAllFailed: string;
  /**
   * A list's Export: its button, its two files, what goes (`{n}` selected, or all that match: one, or more), how far it
   * has got (`{done}` of `{n}`), and how it ended.
   */
  export: string;
  exportExcel: string;
  exportCsv: string;
  exportAll: string;
  exportAllOne: string;
  exporting: string;
  exportCut: string;
  exportFailed: string;
  exported: string;
  exportedOne: string;
  /**
   * A list's Edit of many records: its button, its dialog (`{n}` records: one, or more), its question, how far it has
   * got, and what was not changed and why (`{name}`: `{why}`).
   */
  bulkEdit: string;
  bulkTitle: string;
  bulkTitleOne: string;
  bulkField: string;
  bulkApply: string;
  bulkAsk: string;
  bulkAskOne: string;
  bulkSet: string;
  bulkClear: string;
  bulkProgress: string;
  bulkDone: string;
  bulkDoneOne: string;
  bulkSome: string;
  bulkWhy: string;
  bulkChangedSince: string;
  /**
   * A list's Import: its button and dialog (`{title}`, the list's); a file dropped or chosen (`{most}` rows at most),
   * read (`{name}`), or why it cannot be (`{why}`: one of the reasons after it); its rows and columns (`{n}`); a CSV
   * file's characters and separator; each column matched to the field it goes into, those left out (`{columns}`) and a
   * required field none fills (`{field}`); the rows checked (`{done}` of `{n}`), those ready and those refused (`Row
   * {n}: {why}`), the file to fix them in; the rows written, stopped, done or not (`{n}` of `{total}`); Undo; and why a
   * cell does not read: a link's name (`{label}`, `{text}`) or a yes or no. `…One` for a count the language says apart.
   */
  import: string;
  importTitle: string;
  importDrop: string;
  importChoose: string;
  importHint: string;
  importReading: string;
  importCannotRead: string;
  importNotSheet: string;
  importOldExcel: string;
  importLocked: string;
  importDamaged: string;
  importNoRows: string;
  importNoUnzip: string;
  importTooMany: string;
  importColumnLetter: string;
  importFileRows: string;
  importFileRowsOne: string;
  importSheet: string;
  importEncoding: string;
  importUnicode: string;
  importSeparator: string;
  importComma: string;
  importSemicolon: string;
  importTab: string;
  importBar: string;
  importColumn: string;
  importExample: string;
  importField: string;
  importLeaveOut: string;
  importLeftOut: string;
  importNeeded: string;
  importMoved: string;
  importCheck: string;
  importCheckOne: string;
  importChecking: string;
  importReady: string;
  importReadyOne: string;
  importRefused: string;
  importRefusedOne: string;
  importRow: string;
  importMore: string;
  importMoreOne: string;
  importDownload: string;
  importPreview: string;
  importNone: string;
  importStart: string;
  importStartOne: string;
  importWhy: string;
  importFixName: string;
  importing: string;
  importStop: string;
  importDone: string;
  importDoneOne: string;
  importStopped: string;
  importSome: string;
  importFailed: string;
  importNotMade: string;
  importUndo: string;
  importUndoAsk: string;
  importUndoAskOne: string;
  importUndoing: string;
  importUndone: string;
  importUndoneOne: string;
  importUndoSome: string;
  importNoneCalled: string;
  importSeveralCalled: string;
  importNotYesNo: string;
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
  /**
   * A person's own filter of a date by a period (`opPeriod`), and its chip: `{field}` and `{period}`, "Invoice date: This
   * month" — as a date grouped by a span says it too, "Invoice date: Month".
   */
  opPeriod: string;
  periodChip: string;
  /** The periods a date's filter can name, counted from today; a week from the language's first day, the last 7 and 30 days ending today. */
  periodToday: string;
  periodYesterday: string;
  periodThisWeek: string;
  periodLastWeek: string;
  periodThisMonth: string;
  periodLastMonth: string;
  periodThisYear: string;
  periodLast7Days: string;
  periodLast30Days: string;
  /** Any day before today, for a due date. */
  periodOverdue: string;
  /** Group By a date by the span it falls in, in the search menu; and a week's and a quarter's heading (`{week}`, `{quarter}`, `{year}`). */
  groupByYear: string;
  groupByQuarter: string;
  groupByMonth: string;
  groupByWeek: string;
  groupByDay: string;
  groupWeek: string;
  groupQuarter: string;
  /**
   * A list's totals: the row under it, the words before a total that is not a sum, and why an amount over records in
   * more than one currency has none (said to whoever points at it).
   */
  total: string;
  totalAvg: string;
  totalMin: string;
  totalMax: string;
  totalCount: string;
  totalMixed: string;
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
   * A related list inside a record (`related`): View all and New, named with its title where it has one (`{title}`),
   * what it says before the record's first save, and with no records yet.
   */
  relatedAll: string;
  relatedAllOf: string;
  relatedNew: string;
  relatedNewOf: string;
  relatedUnsaved: string;
  relatedNone: string;
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
  savedNotAll: 'Saved, but not all your changes.',
  sentNotLatest: 'Sent, but not your latest changes.',
  savingAfterFile: '1 file still uploading. Saving when it is done.',
  savingAfterFiles: '{n} files still uploading. Saving when they are done.',
  sendingAfterFile: '1 file still uploading. Sending when it is done.',
  sendingAfterFiles: '{n} files still uploading. Sending when they are done.',
  leaveAfterSave: 'Waiting for the save to finish…',
  leaveAfterFile: '1 file still uploading. Waiting for it to finish.',
  leaveAfterFiles: '{n} files still uploading. Waiting for them to finish.',
  notAllSaved: 'Not all your changes are saved.',
  submit: 'Submit',
  next: 'Next',
  back: 'Back',
  skip: 'Skip',
  steps: 'Steps',
  stepOf: 'Step {n} of {total}',
  submitted: 'Thank you. Your answers were sent.',
  submitAnother: 'Submit another response',
  leaveEmpty: 'Leave this box empty',
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
  viewGallery: 'Gallery',
  columns: 'Columns',
  moveColumnUp: 'Move {label} up',
  moveColumnDown: 'Move {label} down',
  resetColumns: 'Reset columns',
  resizeColumn: 'Resize {label}',
  rowActions: 'Actions',
  selectRecord: 'Select {name}',
  noRecords: 'No records match.',
  loadFailed: 'Could not load the records.',
  selectAllMatching: 'Select all {n} that match',
  selectingAll: 'Selecting all that match…',
  selectedOf: '{n} of {total} could be selected',
  selectAllFailed: 'Could not select every record that matches.',
  export: 'Export',
  exportExcel: 'Excel (.xlsx)',
  exportCsv: 'CSV (.csv)',
  exportAll: 'All {n} that match',
  exportAllOne: 'The {n} that matches',
  exporting: 'Exporting {done} of {n}…',
  exportCut: 'Only the first {n} of {total} were exported.',
  exportFailed: 'Could not export the records.',
  exported: '{n} records exported.',
  exportedOne: '{n} record exported.',
  bulkEdit: 'Edit',
  bulkTitle: 'Edit {n} records',
  bulkTitleOne: 'Edit {n} record',
  bulkField: 'Field',
  bulkApply: 'Update',
  bulkAsk: 'Update {n} records?',
  bulkAskOne: 'Update {n} record?',
  bulkSet: '{field} becomes “{value}”.',
  bulkClear: '{field} is cleared.',
  bulkProgress: 'Updating {done} of {n}…',
  bulkDone: '{n} records updated.',
  bulkDoneOne: '{n} record updated.',
  bulkSome: '{done} of {n} updated. Not changed:',
  bulkWhy: '{name}: {why}',
  bulkChangedSince: '{name} changed it after it was listed.',
  import: 'Import',
  importTitle: 'Import into {title}',
  importDrop: 'Drop an Excel or CSV file here',
  importChoose: 'Choose a file',
  importHint: 'Its first row names the columns. Up to {most} rows at a time.',
  importReading: 'Reading {name}…',
  importCannotRead: '{name} cannot be read: {why}.',
  importNotSheet: 'it is not an Excel workbook (.xlsx) or a CSV file',
  importOldExcel: 'it is an older Excel file (.xls), or one locked with a password: save it as .xlsx without a password, or as CSV',
  importLocked: 'it is locked with a password: save it without one',
  importDamaged: 'it is damaged',
  importNoRows: 'it holds no rows',
  importNoUnzip: 'this browser cannot open Excel workbooks: save it as CSV',
  importTooMany: '{name} has {n} rows: at most {most} can be imported here at once. Split it into files of {most} rows or fewer.',
  importColumnLetter: 'Column {letter}',
  importFileRows: '{name}: {n} rows',
  importFileRowsOne: '{name}: {n} row',
  importSheet: 'Sheet',
  importEncoding: 'Characters',
  importUnicode: 'Unicode ({name})',
  importSeparator: 'Values separated by',
  importComma: 'Commas',
  importSemicolon: 'Semicolons',
  importTab: 'Tabs',
  importBar: 'Vertical bars',
  importColumn: 'Column in the file',
  importExample: 'First value',
  importField: 'Goes into',
  importLeaveOut: 'Leave out',
  importLeftOut: 'Left out: {columns}',
  importNeeded: '{field} is required, and no column fills it: every row would be refused.',
  importMoved: '{field} comes from “{column}” now; “{other}” is left out.',
  importCheck: 'Check {n} rows',
  importCheckOne: 'Check {n} row',
  importChecking: 'Checking {done} of {n}…',
  importReady: '{n} rows can be imported.',
  importReadyOne: '{n} row can be imported.',
  importRefused: '{n} rows cannot be imported:',
  importRefusedOne: '{n} row cannot be imported:',
  importRow: 'Row {n}: {why}',
  importMore: 'And {n} more, in the file to fix.',
  importMoreOne: 'And {n} more, in the file to fix.',
  importDownload: 'Download the rows to fix',
  importPreview: 'The first rows, as they will be saved',
  importNone: 'None of the rows can be imported.',
  importStart: 'Import {n} records',
  importStartOne: 'Import {n} record',
  importWhy: 'Why it was not imported',
  importFixName: '{name} – not imported',
  importing: 'Importing {done} of {n}…',
  importStop: 'Stop',
  importDone: '{n} records imported.',
  importDoneOne: '{n} record imported.',
  importStopped: 'Stopped: {n} of {total} records imported.',
  importSome: '{n} of {total} records imported. Not imported:',
  importFailed: 'Could not import the records.',
  importNotMade: 'the data source made no record of it',
  importUndo: 'Undo the import',
  importUndoAsk: 'Delete the {n} records this import made?',
  importUndoAskOne: 'Delete the {n} record this import made?',
  importUndoing: 'Deleting {done} of {n}…',
  importUndone: 'Import undone: {n} records deleted.',
  importUndoneOne: 'Import undone: {n} record deleted.',
  importUndoSome: '{done} of {n} records deleted. Not deleted:',
  importNoneCalled: '{label}: nothing is called “{text}”',
  importSeveralCalled: '{label}: more than one is called “{text}”',
  importNotYesNo: '{label}: “{text}” is neither yes nor no',
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
  opPeriod: 'in the period',
  periodChip: '{field}: {period}',
  periodToday: 'Today',
  periodYesterday: 'Yesterday',
  periodThisWeek: 'This week',
  periodLastWeek: 'Last week',
  periodThisMonth: 'This month',
  periodLastMonth: 'Last month',
  periodThisYear: 'This year',
  periodLast7Days: 'Last 7 days',
  periodLast30Days: 'Last 30 days',
  periodOverdue: 'Overdue',
  groupByYear: 'Year',
  groupByQuarter: 'Quarter',
  groupByMonth: 'Month',
  groupByWeek: 'Week',
  groupByDay: 'Day',
  groupWeek: 'Week {week}, {year}',
  groupQuarter: 'Q{quarter} {year}',
  total: 'Total',
  totalAvg: 'Average',
  totalMin: 'Lowest',
  totalMax: 'Highest',
  totalCount: 'Count',
  totalMixed: 'In more than one currency: no total',
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
  relatedAll: 'View all',
  relatedAllOf: 'View all {title}',
  relatedNew: 'New',
  relatedNewOf: 'New in {title}',
  relatedUnsaved: 'Nothing here until this record is saved.',
  relatedNone: 'None yet.',
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
