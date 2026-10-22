import { tableInChunks, wordsInChunks, wordsNotYet, type Locale } from '@fieldia/core';
import { LANGUAGES } from './locales/all';
import { LATER } from './locales/later';

/**
 * Every word the viewer shows, so a page can be translated. `{n}`, `{total}` and `{time}` are filled in.
 *
 * A key ending in `Noun` (`importDoneNoun`, and `…NounOne` for a count of one) is the sentence before it in the words
 * a page names its records by (`Page.records`): `{record}` for one ("customer"), `{records}` for more, `{aRecord}` for
 * one with its article ("a customer"). Said only on a page that names its records; where a language, or an app's own
 * `labels`, gives the sentence before it and not this one, its own sentence is said instead.
 */
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
  /** Record templates (`templates` on the page, the templates part): its menu, its dialogs and what they say. `{name}` a template's; `{n}` how many. */
  templatesButton: string;
  templatesStart: string;
  templateSave: string;
  templateName: string;
  templateKeeps: string;
  templateKeep: string;
  templateSaved: string;
  templateReplaced: string;
  templateUsed: string;
  templatesDelete: string;
  templatesChosen: string;
  templatesDeleteNow: string;
  templatesDeleted: string;
  /** A split button's chevron, named for the button it opens more of (`{label}`), unless it has a name of its own. */
  optionsFor: string;
  updatedBy: string;
  nothingChanged: string;
  countOf: string;
  /** A form in a side panel: what it asks before Escape or × drops the changes made in it. */
  discardChanges: string;
  discardChangesNoun?: string;
  /** The × on an alert that may be dismissed. */
  dismiss: string;
  /** Beside the words a one-tap press said, for a few seconds (a button's `undo`, or the app answering with one): pressed, it takes the press back. */
  undoPress: string;
  /** What the toast says once its Undo has taken the press back. */
  pressUndone: string;
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
  rangeNoun?: string;
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
  noRecordsNoun?: string;
  loadFailed: string;
  loadFailedNoun?: string;
  /**
   * A list's selection of every record that matches (`{n}` written as the page writes numbers), and what it says when
   * the source gave fewer than match (`{n}` of `{total}`) or none.
   */
  selectAllMatching: string;
  selectAllMatchingNoun?: string;
  selectingAll: string;
  selectedOf: string;
  selectAllFailed: string;
  selectAllFailedNoun?: string;
  /**
   * A list's Export: its button, its two files, what goes (`{n}` selected, or all that match: one, or more), how far it
   * has got (`{done}` of `{n}`), and how it ended.
   */
  export: string;
  exportExcel: string;
  exportCsv: string;
  exportAll: string;
  exportAllNoun?: string;
  exportAllOne: string;
  exportAllNounOne?: string;
  exporting: string;
  exportCut: string;
  exportCutNoun?: string;
  exportFailed: string;
  exportFailedNoun?: string;
  exported: string;
  exportedNoun?: string;
  exportedOne: string;
  exportedNounOne?: string;
  /**
   * On paper: a list's Print (`printList`), how far it has got (`{done}` of `{n}`), how it ended; a printout's words
   * over its rows — the filters (`{filters}`), the groups (`{groups}`), how many (`{n}`: more, or one) — and the day it
   * was printed (`{date}`), over a record too; the gear menu's built-in Print (`printRecord`), under its Print heading.
   */
  printList: string;
  printing: string;
  printCut: string;
  printCutNoun?: string;
  printFailed: string;
  printFailedNoun?: string;
  printFilters: string;
  printGroups: string;
  printCount: string;
  printCountNoun?: string;
  printCountOne: string;
  printCountNounOne?: string;
  printedOn: string;
  printRecord: string;
  printRecordNoun?: string;
  /**
   * A list's Edit of many records: its button, its dialog (`{n}` records: one, or more), its question, how far it has
   * got, and what was not changed and why (`{name}`: `{why}`).
   */
  bulkEdit: string;
  bulkTitle: string;
  bulkTitleNoun?: string;
  bulkTitleOne: string;
  bulkTitleNounOne?: string;
  bulkField: string;
  bulkApply: string;
  bulkAsk: string;
  bulkAskNoun?: string;
  bulkAskOne: string;
  bulkAskNounOne?: string;
  bulkSet: string;
  bulkClear: string;
  bulkProgress: string;
  bulkDone: string;
  bulkDoneNoun?: string;
  bulkDoneOne: string;
  bulkDoneNounOne?: string;
  bulkSome: string;
  bulkSomeNoun?: string;
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
  /** A file of a header and nothing under it: no rows to check. */
  importNoRowsUnder: string;
  /** A CSV file read in an encoding its bytes say it is not in (`{chosen}`), and the one that reads it (`{encoding}`). */
  importMisread: string;
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
  importStartNoun?: string;
  importStartOne: string;
  importStartNounOne?: string;
  importWhy: string;
  importFixName: string;
  importing: string;
  importStop: string;
  /** The import's dialog, a file chosen, left by × or Escape: asked first — its answer to stay. */
  importKeepEditing: string;
  importDone: string;
  importDoneNoun?: string;
  importDoneOne: string;
  importDoneNounOne?: string;
  importStopped: string;
  importStoppedNoun?: string;
  importSome: string;
  importSomeNoun?: string;
  importFailed: string;
  importFailedNoun?: string;
  importNotMade: string;
  importNotMadeNoun?: string;
  importUndo: string;
  importUndoAsk: string;
  importUndoAskNoun?: string;
  importUndoAskOne: string;
  importUndoAskNounOne?: string;
  importUndoing: string;
  importUndone: string;
  importUndoneNoun?: string;
  importUndoneOne: string;
  importUndoneNounOne?: string;
  importUndoSome: string;
  importUndoSomeNoun?: string;
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
  /** A person's own filter of a number or a date between two (`rangeFrom`, `rangeTo`): one chip, "Price: 1,000 – 3,000". */
  opBetween: string;
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
  /** The same, in the total's cell itself, in sight on a phone too: a few words, the sentence above as its title. */
  totalMixedShort: string;
  /**
   * A value worked out from others while one of them holds text that does not read: a dash, and why — the field to
   * fix (`{field}`), or the line of a table (`{n}`, `{lines}`) — to see it (`{own}`).
   */
  valueWaits: string;
  valueWaitsLine: string;
  /**
   * A value worked out from an app's function that asks its server (`functions`): while its answer comes, and why it
   * did not (`{why}`, the app's words) — a save asks again.
   */
  valueAsking: string;
  valueNotWorkedOut: string;
  /** A CSV file's column of the currency each amount of a column (`{column}`) is in. */
  exportCurrency: string;
  yes: string;
  no: string;
  /** A list's groups: the one of records with no value, and the rest of a group's records (`{n}`). */
  none: string;
  loadMore: string;
  /**
   * A list ordered by several of its headers (Shift and a header's press): what a screen reader hears after a key's
   * header, its place among them (`{n}` of `{total}`) and its way — its number shows beside its words.
   */
  sortKeyUp: string;
  sortKeyDown: string;
  /**
   * What a list's row opens to in place (`detail`): its toggle's name and its table's (`{title}`, the lines' label or
   * the page's own; `{name}`, the row's record's), and its title where neither names one (`detailTitle`).
   */
  detailOf: string;
  detailTitle: string;
  /**
   * A list's rows re-ranked by hand (`sequenceField`): where a row moved (`{name}`, `{n}` of `{total}`), its grip's hint,
   * and why the new order was not kept (`{why}`, the source's words).
   */
  rowMovedTo: string;
  rowMoveHint: string;
  rankNotKept: string;
  /** A tree's match under a search, its parent named after it (`{name}`), where its children load as a parent opens. */
  treeIn: string;
  /**
   * A list's views kept on the app's server (its source's `views`), in the search bar's menu: a view shared with the
   * team, the person's own (`viewShared`) or another's (`{name}`, who made it); Save current search's Share with the
   * team; why the views could not be asked, a view not saved (`{why}`) or not deleted (`{name}`, `{why}`); and the
   * question before one shared with the team is deleted for everyone.
   */
  viewShared: string;
  viewSharedBy: string;
  shareView: string;
  viewsFailed: string;
  viewNotSaved: string;
  viewNotDeleted: string;
  viewDeleteAsk: string;
  /**
   * How many records a list's group holds, in words (`{n}`: more, or one), said with its name by its heading's button:
   * "Cairo, 12 records" where the heading shows "Cairo (12)".
   */
  groupCount: string;
  groupCountNoun?: string;
  groupCountOne: string;
  groupCountNounOne?: string;
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
   * A filter of a number's or a date's range (`filterRanges`, and a custom filter's "is between"): its boxes, the press
   * that takes it away, and the range in words on its chip — both ends (`{from}`, `{to}`), a number from one up
   * ("2+"), a number up to one, a date from one or until one — and why it is not taken: its first end past its last.
   */
  rangeFrom: string;
  rangeTo: string;
  rangeAny: string;
  rangeBetween: string;
  rangeOrMore: string;
  rangeUpTo: string;
  rangeSince: string;
  rangeUntil: string;
  rangeOrder: string;
  rangeOrderDate: string;
  /**
   * A filter bar on a phone (`filterSheet`): its Filters button with how many are on (`{n}`), and the sheet's buttons —
   * Clear all, and Show with how many records the filters find (`{n}`: more, or one; `{records}`, `{record}` the page's
   * own words for them), or without a number where the source cannot count.
   */
  filtersOn: string;
  filtersClearAll: string;
  showResults: string;
  showResultsNoun?: string;
  showResultsOne: string;
  showResultsNounOne?: string;
  showResultsSome: string;
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
   * what it says before the record's first save, and with no records yet; on paper, how many of how many it shows
   * where they run past a page (`{n}` of `{total}`).
   */
  relatedAll: string;
  relatedAllNoun?: string;
  relatedAllOf: string;
  relatedNew: string;
  relatedNewNoun?: string;
  relatedNewOf: string;
  relatedUnsaved: string;
  relatedUnsavedNoun?: string;
  relatedNone: string;
  relatedNoneNoun?: string;
  relatedShown: string;
  /** The key over a list's rows: what their tones and their bold mean, where the page says (`rowTones` labels, `rowBoldLabel`). */
  rowsKey: string;
  relatedShownNoun?: string;
  /**
   * A list whose cells are changed in place (`editable`): what a screen reader is told of a cell that takes a change,
   * Add a line (`rowAddNoun`: "Add a service"), a row added taken away, why a row was not saved (`{why}`, its
   * problems), a row saved (`{name}`, the record's name), a row's Open and a card's sheet's title (`{name}`), and a
   * cell named in what a paste did (`{column}`, its header; `{name}`).
   */
  rowEditHint: string;
  rowAdd: string;
  rowAddNoun?: string;
  rowDrop: string;
  rowNotSaved: string;
  rowSaved: string;
  rowOpen: string;
  rowChange: string;
  rowCell: string;
  /** A row its record lets no one change here, where its source says no why (`can.reason`): its lock and a press on it. */
  rowLocked: string;
  rowLockedNoun?: string;
  /**
   * A paste that changes or adds more than one row, asked first (`{n}` rows, `{changed}`, `{added}`); its Undo, and
   * what Undo says; rows it left refused for the same reason, said once (`{n}`, `{why}`), and their button — Remove
   * them where they were all added, Put them back otherwise.
   */
  pasteAsk: string;
  pasteAskChange: string;
  pasteAskAdd: string;
  /** Its Yes: what answering it does. */
  pasteYes: string;
  pasteUndo: string;
  pasteUndone: string;
  rowsNotSaved: string;
  rowsNotSavedOne: string;
  rowsDrop: string;
  rowsPutBack: string;
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
  newRecordNoun?: string;
  records: string;
  recordsNoun?: string;
  recordAt: string;
  previousRecord: string;
  previousRecordNoun?: string;
  nextRecord: string;
  nextRecordNoun?: string;
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
  conflictAtNoun?: string;
  conflictSince: string;
  conflictSinceNoun?: string;
  someoneElse: string;
  conflictChanged: string;
  conflictBoth: string;
  conflictChoice: string;
  reload: string;
  keepMine: string;
  reloaded: string;
  reloadedNoun?: string;
  setAside: string;
  putBack: string;
  putBackField: string;
  putAllBack: string;
  /** Said politely as Ctrl+Z takes back a change to a field: `{field}`, its label. */
  undoneField: string;
  /** Said as Ctrl+Shift+Z makes it again. */
  redoneField: string;
  nowIs: string;
  readOnlyRecord: string;
  readOnlyRecordNoun?: string;
  fieldNotYours: string;
  /** Who else has the record open (the source's `presence`): `{names}`, each one's name, `presentEditing` round whoever is changing it. */
  presentHere: string;
  presentEditing: string;
  /** Said by the lock of an answer a signature signed (`options.signs`): how to change it. */
  signedAnswer: string;
  notOffered: string;
  /**
   * Possible duplicates (`duplicates`): a record like the one typed, said under the field it matched on — by those
   * fields' labels (`{fields}`, the last two joined by `duplicateAnd`'s `{a}` and `{b}`), by a name like this one, or
   * both; `{name}` its name — and `{n}` more like it; and its ways: Open it, It's someone new, Merge.
   */
  duplicateWith: string;
  duplicateWithNoun?: string;
  duplicateNamed: string;
  duplicateNamedNoun?: string;
  duplicateNamedWith: string;
  duplicateNamedWithNoun?: string;
  duplicateAnd: string;
  duplicatesMore: string;
  openDuplicate: string;
  notDuplicate: string;
  notDuplicateNoun?: string;
  mergeDuplicate: string;
  /**
   * The merge's screen: its title, what to do, a record's column (`{name}`) and the one shown, a value neither holds,
   * the fields both hold the same (`{fields}`) or every one, what will happen (`{kept}`, `{gone}`), its button, while
   * it merges, once merged (`{name}`), and a record it could not read (`{name}`, `{why}`).
   */
  mergeTitle: string;
  mergeTitleNoun?: string;
  mergeIntro: string;
  mergeIntroNoun?: string;
  mergeKeep: string;
  mergeShown: string;
  mergeShownNoun?: string;
  mergeEmpty: string;
  mergeSame: string;
  mergeAllSame: string;
  mergeWhat: string;
  merge: string;
  merging: string;
  merged: string;
  mergeUnread: string;
  /**
   * A page that takes no answers now (`limits`), said as it opens: why is the form's (its core messages), and these
   * after it — answers typed when it closed can no longer be sent (`closedTyped`).
   */
  closedTyped: string;
  /**
   * "Continue later" (`continueLater`): its button, while the answers are kept, once kept — the link to continue from,
   * its box's name, Copy and once copied, the words where the app gave no link — back to the form, why they could not
   * be kept (`{why}`), and a draft opened by its key that names none.
   */
  laterButton: string;
  laterSaving: string;
  laterSaved: string;
  laterLink: string;
  laterLinkName: string;
  laterCopy: string;
  laterCopied: string;
  laterAgain: string;
  laterBack: string;
  laterFailed: string;
  resumeMissing: string;
  /**
   * A record's approvals (`approval`): where it stands — waiting for those still to decide at each level waiting
   * (`{who}`, each `approvalWho`: its `{level}` and `{names}`), needing approval from its levels before it is sent
   * (`{levels}`, in turn joined by `approvalThen`), approved, rejected (by `{name}`, at `{level}`), or not read
   * (`{why}`) — what stays open while it waits (`{fields}`) or that nothing does, each level's state (`{names}`, who
   * decided there), Approve and Reject (for a `{level}` where there are several), while each goes and once done, why
   * not (`{why}`), Reject's question (its title, what it asks for a `{level}`, its box's name), and its history
   * (`{n}` entries: who asked, who approved, who rejected).
   */
  approvalWaiting: string;
  approvalWho: string;
  approvalNeeded: string;
  approvalThen: string;
  approvalApproved: string;
  approvalRejectedBy: string;
  approvalRejected: string;
  approvalFailed: string;
  approvalOpen: string;
  approvalLockedAll: string;
  approvalLevelApproved: string;
  approvalLevelRejected: string;
  approvalLevelWaiting: string;
  approvalLevelWaitingSome: string;
  approvalLevelLater: string;
  approvalLevelSkipped: string;
  approvalApprove: string;
  approvalReject: string;
  approvalApproveFor: string;
  approvalRejectFor: string;
  approvalApproving: string;
  approvalRejecting: string;
  approvalApprovedFor: string;
  approvalRejectedFor: string;
  approvalApproveFailed: string;
  approvalRejectFailed: string;
  approvalRejectTitle: string;
  approvalRejectTitleNoun?: string;
  approvalRejectAsk: string;
  approvalRejectReason: string;
  /** Reject's question left with a reason typed: asked first — its answer to stay. */
  approvalKeepEditing: string;
  approvalHistoryCount: string;
  approvalAskedEntry: string;
  approvalApprovedEntry: string;
  approvalRejectedEntry: string;
  /** A record sent whose rules asked no level of it, moved on at once: where it stands, and that moment of its history. */
  approvalNotNeeded: string;
  /**
   * AI help (the assist part), through the app's own model: a page's Fill from text (`suggest`) — its dialog's words,
   * its box, its files, its button, while it reads, why nothing came (`{why}`) — the proposals' review over the page
   * (`{n}` values, Accept all, Reject all, the fields left as typed, the values not used and why, those out of sight)
   * and on each field (Proposed, the value it would take the place of, a table's lines to add), Undo once kept; a text
   * field's tools (Draft, Polish) and why no words came; a list's words read as filters.
   */
  assistFill: string;
  assistFillHint: string;
  assistFillBox: string;
  assistFillPlaceholder: string;
  assistFiles: string;
  assistFillGo: string;
  /** Propose values pressed with nothing pasted or added: said beside it — the text and files, the text, or files alone offered. */
  assistFillEmpty: string;
  assistFillEmptyText: string;
  assistFillEmptyFiles: string;
  /** Fill from text left with words pasted or files added: asked first — its answer to stay. */
  assistKeepEditing: string;
  assistReading: string;
  assistFailed: string;
  assistNothing: string;
  assistProposed: string;
  assistProposedOne: string;
  assistReview: string;
  assistAcceptAll: string;
  assistRejectAll: string;
  assistAccept: string;
  assistReject: string;
  assistProposal: string;
  assistProposedText: string;
  /** A proposal for a text kept in several languages: the one language it fills, by its name (`{language}`). */
  assistProposedIn: string;
  assistInPlaceOf: string;
  assistEmpty: string;
  assistLines: string;
  assistLinesOne: string;
  assistKept: string;
  assistKeptAll: string;
  assistKeptAllOne: string;
  assistUndo: string;
  assistUndone: string;
  assistLeftTyped: string;
  assistNotUsed: string;
  assistOutOfSight: string;
  assistNoneCalled: string;
  assistSeveralCalled: string;
  assistNotOffered: string;
  assistNotRead: string;
  assistDraft: string;
  assistPolish: string;
  assistWriting: string;
  assistRewriteFailed: string;
  assistWords: string;
  assistWordsTitle: string;
  assistWordsReading: string;
  assistWordsMade: string;
  assistWordsNone: string;
  assistWordsFailed: string;
  /**
   * A quiz's results once its answers are sent (`quiz`): their heading, the score (`{score}` of `{max}`, `{percent}`),
   * each question marked right, wrong or not answered with its points (`{points}` of `{max}`), the person's answer and
   * the right one (`{answer}`) — or, with results given later, that they come once the answers are reviewed.
   */
  quizTitle: string;
  quizScore: string;
  quizRight: string;
  quizWrong: string;
  quizNotAnswered: string;
  quizPoints: string;
  quizYourAnswer: string;
  quizRightAnswer: string;
  quizLater: string;
  /**
   * A review before sending (`review`): the last step's button, or the page's Submit, while it is still to come; its
   * heading where the page gives none; each answer's Edit (the question named after it, for a screen reader) and an
   * answer not given; and, on a step before the last after an Edit, the way back to it.
   */
  reviewAnswers: string;
  reviewTitle: string;
  reviewEdit: string;
  reviewNotAnswered: string;
  backToReview: string;
  /**
   * One question at a time (`flow: "one"`): how far ({n} of {total}), the bar's buttons back and on, the button that
   * goes on, and what it says of Enter.
   */
  flowQuestionOf: string;
  flowPrevious: string;
  flowNext: string;
  flowOk: string;
  flowEnterHint: string;
  /**
   * A time limit (`timeLimit`): a page's said before its questions with Start ({time}: "20 minutes"), the countdown
   * over them — the page's, or a step's — its warning said once ({time} left), and what happened as it ran out: the
   * answers sent as they stood, locked for the person to send ({send}: the page's own words to send), or a step's kept.
   */
  timeLimitTitle: string;
  timeLimitIntro: string;
  timeStart: string;
  timeLeft: string;
  stepTimeLeft: string;
  timeWarn: string;
  timeUpSent: string;
  timeUpLocked: string;
  stepTimeUp: string;
  /**
   * Proof of an email or a phone by a code (`options.verify`, the verify part): Send a code, by a way (`{by}`: SMS,
   * WhatsApp, a call, email), while it is sent and once sent (`{value}`), how long it works, the code's box's name,
   * Confirm and while it is checked, a code not typed, wrong (the tries left), too late, Send again and its wait
   * (`{time}`, 0:25), Confirmed, and a code that could not be sent or checked.
   */
  verifySend: string;
  verifySendBy: string;
  verifyBySms: string;
  verifyByWhatsapp: string;
  verifyByCall: string;
  verifyByEmail: string;
  verifySending: string;
  verifySent: string;
  verifySentBy: string;
  verifyWorksFor: string;
  verifyWorksForOne: string;
  verifyCodeName: string;
  verifyCheck: string;
  verifyChecking: string;
  verifyTypeCode: string;
  verifyWrong: string;
  verifyWrongOne: string;
  verifyWrongSome: string;
  verifyWrongNone: string;
  verifyExpired: string;
  verifyAgain: string;
  verifyAgainIn: string;
  verifyDone: string;
  verifyNotSent: string;
  verifyNotChecked: string;
  /**
   * A payment the answers wait for (`payment`, the pay part): Pay and its amount, back to the answers, Cancel while it
   * waits, that nothing is sent until it is paid, while it waits, paid (with the provider's reference), Pay again, and a
   * payment cancelled, failed (with the provider's `{why}`) or not started.
   */
  payAmount: string;
  payBack: string;
  payCancel: string;
  payCancelling: string;
  payNothingSent: string;
  payWaiting: string;
  payPaid: string;
  payPaidReference: string;
  payAgain: string;
  payCancelled: string;
  payFailed: string;
  payFailedWhy: string;
  payNotStarted: string;
  /** A `<fieldia-form>` whose page could not be read: its address answered nothing, or no page. */
  formNotLoaded: string;
  /**
   * An offline outbox (`outbox`, the outbox part): how many sends wait on this device (`{count}`), no signal, while they
   * are sent, all sent, Send now, a send refused once it went (`{why}`) with Try again and Discard (asked first), and a
   * response kept without signal's ending.
   */
  outboxWaiting: string;
  outboxWaitingOne: string;
  outboxOffline: string;
  outboxSending: string;
  outboxSent: string;
  outboxSendNow: string;
  outboxRefused: string;
  outboxRetry: string;
  outboxDiscard: string;
  outboxDiscardAsk: string;
  outboxKeptTitle: string;
  outboxKeptWords: string;
}

/** A word every language has: the sentences in a page's words for its records (`…Noun`) are each language's own to give. */
export type WordKey = Exclude<keyof ViewerLabels, `${string}Noun` | `${string}NounOne`>;

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
  templatesButton: 'Templates',
  templatesStart: 'Start from',
  templateSave: 'Save as template…',
  templateName: 'Template name',
  templateKeeps: 'Keeps this record’s values, except its name and files, to start new ones from.',
  templateKeep: 'Save template',
  templateSaved: 'Template “{name}” saved.',
  templateReplaced: 'Template “{name}” replaced.',
  templateUsed: 'Started from “{name}”.',
  templatesDelete: 'Delete templates…',
  templatesChosen: 'Templates to delete',
  templatesDeleteNow: 'Delete',
  templatesDeleted: 'Templates deleted: {n}',
  optionsFor: '{label} options',
  updatedBy: 'Updated by {name}: {date}',
  nothingChanged: 'Nothing has changed.',
  countOf: '{label}, {count}',
  discardChanges: 'Discard your changes?',
  discardChangesNoun: 'Discard your changes to this {record}?',
  dismiss: 'Dismiss',
  undoPress: 'Undo',
  pressUndone: 'Undone.',
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
  rangeNoun: '{from}–{to} of {total} {records}',
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
  noRecordsNoun: 'No {records} match.',
  loadFailed: 'Could not load the records.',
  loadFailedNoun: 'Could not load the {records}.',
  selectAllMatching: 'Select all {n} that match',
  selectAllMatchingNoun: 'Select all {n} {records} that match',
  selectingAll: 'Selecting all that match…',
  selectedOf: '{n} of {total} could be selected',
  selectAllFailed: 'Could not select every record that matches.',
  selectAllFailedNoun: 'Could not select every {record} that matches.',
  export: 'Export',
  exportExcel: 'Excel (.xlsx)',
  exportCsv: 'CSV (.csv)',
  exportAll: 'All {n} that match',
  exportAllNoun: 'All {n} {records} that match',
  exportAllOne: 'The {n} that matches',
  exportAllNounOne: 'The {n} {record} that matches',
  exporting: 'Exporting {done} of {n}…',
  exportCut: 'Only the first {n} of {total} were exported.',
  exportCutNoun: 'Only the first {n} of {total} {records} were exported.',
  exportFailed: 'Could not export the records.',
  exportFailedNoun: 'Could not export the {records}.',
  exported: '{n} records exported.',
  exportedNoun: '{n} {records} exported.',
  exportedOne: '{n} record exported.',
  exportedNounOne: '{n} {record} exported.',
  printList: 'Print',
  printing: 'Getting {done} of {n} to print…',
  printCut: 'Only the first {n} of {total} were printed.',
  printCutNoun: 'Only the first {n} of {total} {records} were printed.',
  printFailed: 'Could not get the records to print.',
  printFailedNoun: 'Could not get the {records} to print.',
  printFilters: 'Filters: {filters}',
  printGroups: 'Grouped by {groups}',
  printCount: '{n} records',
  printCountNoun: '{n} {records}',
  printCountOne: '{n} record',
  printCountNounOne: '{n} {record}',
  printedOn: 'Printed {date}',
  printRecord: 'This record',
  printRecordNoun: 'This {record}',
  bulkEdit: 'Edit',
  bulkTitle: 'Edit {n} records',
  bulkTitleNoun: 'Edit {n} {records}',
  bulkTitleOne: 'Edit {n} record',
  bulkTitleNounOne: 'Edit {n} {record}',
  bulkField: 'Field',
  bulkApply: 'Update',
  bulkAsk: 'Update {n} records?',
  bulkAskNoun: 'Update {n} {records}?',
  bulkAskOne: 'Update {n} record?',
  bulkAskNounOne: 'Update {n} {record}?',
  bulkSet: '{field} becomes “{value}”.',
  bulkClear: '{field} is cleared.',
  bulkProgress: 'Updating {done} of {n}…',
  bulkDone: '{n} records updated.',
  bulkDoneNoun: '{n} {records} updated.',
  bulkDoneOne: '{n} record updated.',
  bulkDoneNounOne: '{n} {record} updated.',
  bulkSome: '{done} of {n} updated. Not changed:',
  bulkSomeNoun: '{done} of {n} {records} updated. Not changed:',
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
  importNoRowsUnder: '{name}: no rows under the header',
  importMisread: 'Its characters look wrong read as {chosen}: this file reads as {encoding}.',
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
  importStartNoun: 'Import {n} {records}',
  importStartOne: 'Import {n} record',
  importStartNounOne: 'Import {n} {record}',
  importWhy: 'Why it was not imported',
  importFixName: '{name} – not imported',
  importing: 'Importing {done} of {n}…',
  importStop: 'Stop',
  importKeepEditing: 'Keep editing',
  importDone: '{n} records imported.',
  importDoneNoun: '{n} {records} imported.',
  importDoneOne: '{n} record imported.',
  importDoneNounOne: '{n} {record} imported.',
  importStopped: 'Stopped: {n} of {total} records imported.',
  importStoppedNoun: 'Stopped: {n} of {total} {records} imported.',
  importSome: '{n} of {total} records imported. Not imported:',
  importSomeNoun: '{n} of {total} {records} imported. Not imported:',
  importFailed: 'Could not import the records.',
  importFailedNoun: 'Could not import the {records}.',
  importNotMade: 'the data source made no record of it',
  importNotMadeNoun: 'the data source made no {record} of it',
  importUndo: 'Undo the import',
  importUndoAsk: 'Delete the {n} records this import made?',
  importUndoAskNoun: 'Delete the {n} {records} this import made?',
  importUndoAskOne: 'Delete the {n} record this import made?',
  importUndoAskNounOne: 'Delete the {n} {record} this import made?',
  importUndoing: 'Deleting {done} of {n}…',
  importUndone: 'Import undone: {n} records deleted.',
  importUndoneNoun: 'Import undone: {n} {records} deleted.',
  importUndoneOne: 'Import undone: {n} record deleted.',
  importUndoneNounOne: 'Import undone: {n} {record} deleted.',
  importUndoSome: '{done} of {n} records deleted. Not deleted:',
  importUndoSomeNoun: '{done} of {n} {records} deleted. Not deleted:',
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
  opBetween: 'is between',
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
  totalMixedShort: 'Several currencies',
  valueWaits: 'Fix {field} to see {own}',
  valueWaitsLine: 'Fix line {n} of {lines} to see {own}',
  valueAsking: 'Working out {own}…',
  valueNotWorkedOut: '{own} could not be worked out: {why}. Saving tries again.',
  exportCurrency: '{column} currency',
  yes: 'Yes',
  no: 'No',
  none: 'None',
  loadMore: 'Show {n} more',
  sortKeyUp: 'sorted {n} of {total}, ascending',
  sortKeyDown: 'sorted {n} of {total}, descending',
  detailOf: '{title} of {name}',
  detailTitle: 'Details',
  rowMovedTo: '{name} moved to place {n} of {total}',
  rowMoveHint: 'Drag to move it; Alt+↑ or Alt+↓ from the keyboard',
  rankNotKept: 'The new order was not kept: {why}.',
  treeIn: 'in {name}',
  viewShared: 'Shared with the team',
  viewSharedBy: 'Shared by {name}',
  shareView: 'Share with the team',
  viewsFailed: 'Saved views could not be loaded.',
  viewNotSaved: 'The view was not saved: {why}.',
  viewNotDeleted: '{name} was not deleted: {why}.',
  viewDeleteAsk: 'Delete “{name}” for everyone on the team?',
  groupCount: '{n} records',
  groupCountNoun: '{n} {records}',
  groupCountOne: '{n} record',
  groupCountNounOne: '{n} {record}',
  filterByKeyword: 'Filter by keyword',
  clearFilters: 'Clear filters',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  filterNamed: 'Filter by {label}',
  filterSettings: 'Filter settings',
  rangeFrom: 'From',
  rangeTo: 'To',
  rangeAny: 'Any',
  rangeBetween: '{from} – {to}',
  rangeOrMore: '{from}+',
  rangeUpTo: 'up to {to}',
  rangeSince: 'from {from}',
  rangeUntil: 'until {to}',
  rangeOrder: 'From is more than To',
  rangeOrderDate: 'From is after To',
  filtersOn: 'Filters, {n} on',
  filtersClearAll: 'Clear all',
  showResults: 'Show {n} results',
  showResultsNoun: 'Show {n} {records}',
  showResultsOne: 'Show {n} result',
  showResultsNounOne: 'Show {n} {record}',
  showResultsSome: 'Show results',
  formMissing: 'The saved form “{page}” cannot be found.',
  formInItself: 'The saved form “{page}” is not shown here: it would be placed inside itself ({chain}).',
  formNotPlaceable: 'The saved form “{page}” cannot be placed here: only a form of sections or tabs can.',
  formBroken: 'The saved form “{page}” cannot be shown.',
  pageMissing: 'The page “{page}” cannot be found.',
  relatedAll: 'View all',
  relatedAllNoun: 'View all {records}',
  relatedAllOf: 'View all {title}',
  relatedNew: 'New',
  relatedNewNoun: 'New {record}',
  relatedNewOf: 'New in {title}',
  relatedUnsaved: 'Nothing here until this record is saved.',
  relatedUnsavedNoun: 'Nothing here until this {record} is saved.',
  relatedNone: 'None yet.',
  relatedNoneNoun: 'No {records} yet.',
  relatedShown: '{n} of {total}',
  rowsKey: 'Key to the rows',
  relatedShownNoun: '{n} of {total} {records}',
  rowEditHint: 'Enter or typing replaces the cell’s value, F2 changes within it, Tab moves on, Escape puts it back; a row is saved as you leave it.',
  rowAdd: 'Add a line',
  rowAddNoun: 'Add {aRecord}',
  rowDrop: 'Remove',
  rowNotSaved: 'Not saved: {why}.',
  rowSaved: '{name} saved',
  rowOpen: 'Open {name}',
  rowChange: 'Change {name}',
  rowCell: '{column} of {name}',
  rowLocked: 'This row can’t be changed here',
  rowLockedNoun: 'This {record} can’t be changed here',
  pasteAsk: 'Paste {n} rows: change {changed} and add {added}?',
  pasteAskChange: 'Change {n} rows with what you pasted?',
  pasteAskAdd: 'Add {n} rows from what you pasted?',
  pasteYes: 'Paste {n} rows',
  pasteUndo: 'Undo',
  pasteUndone: 'Paste undone.',
  rowsNotSaved: '{n} rows not saved: {why}.',
  rowsNotSavedOne: '1 row not saved: {why}.',
  rowsDrop: 'Remove them',
  rowsPutBack: 'Put them back',
  actions: 'Actions',
  print: 'Print',
  archive: 'Archive',
  unarchive: 'Unarchive',
  duplicate: 'Duplicate',
  delete: 'Delete',
  breadcrumbs: 'Breadcrumbs',
  newRecord: 'New',
  newRecordNoun: 'New {record}',
  records: 'Records',
  recordsNoun: '{records}',
  recordAt: '{n} / {total}',
  previousRecord: 'Previous record',
  previousRecordNoun: 'Previous {record}',
  nextRecord: 'Next record',
  nextRecordNoun: 'Next {record}',
  attachment: 'Attachment: {name}',
  openAttachment: 'Open',
  previousAttachment: 'Previous attachment',
  nextAttachment: 'Next attachment',
  conflictAt: '{name} changed this record at {time}.',
  conflictAtNoun: '{name} changed this {record} at {time}.',
  conflictSince: '{name} changed this record after you opened it.',
  conflictSinceNoun: '{name} changed this {record} after you opened it.',
  someoneElse: 'Someone else',
  conflictChanged: 'They changed: {fields}.',
  conflictBoth: 'You both changed: {fields}.',
  conflictChoice: 'Reload shows their version and lists your changes to put back. Keep mine saves yours over theirs.',
  reload: 'Reload',
  keepMine: 'Keep mine',
  reloaded: 'Reloaded: this is the record as it is now.',
  reloadedNoun: 'Reloaded: this is the {record} as it is now.',
  setAside: 'Your changes were not saved. Put back the ones you still want:',
  putBack: 'Put back',
  putBackField: 'Put back {label}',
  putAllBack: 'Put all back',
  undoneField: 'Undone: {field}',
  redoneField: 'Redone: {field}',
  nowIs: 'now {value}',
  readOnlyRecord: 'You can read this record, but not change it.',
  readOnlyRecordNoun: 'You can read this {record}, but not change it.',
  fieldNotYours: 'You can see this field, but not change it.',
  presentHere: 'Also here: {names}',
  presentEditing: '{name} (editing)',
  signedAnswer: 'Signed. To change it, press Change answers under the signature.',
  notOffered: 'Not open to you here: {actions}.',
  duplicateWith: 'A record with this {fields} already exists: {name}',
  duplicateWithNoun: '{aRecord} with this {fields} already exists: {name}',
  duplicateNamed: 'A record with a name like this already exists: {name}',
  duplicateNamedNoun: '{aRecord} with a name like this already exists: {name}',
  duplicateNamedWith: 'A record with this {fields} and a name like this already exists: {name}',
  duplicateNamedWithNoun: '{aRecord} with this {fields} and a name like this already exists: {name}',
  duplicateAnd: '{a} and {b}',
  duplicatesMore: '{n} more like it',
  openDuplicate: 'Open it',
  notDuplicate: 'It’s someone new',
  notDuplicateNoun: 'It’s a new {record}',
  mergeDuplicate: 'Merge…',
  mergeTitle: 'Merge two records',
  mergeTitleNoun: 'Merge two {records}',
  mergeIntro: 'Pick the record to keep, then the value it keeps for each field.',
  mergeIntroNoun: 'Pick the {record} to keep, then the value it keeps for each field.',
  mergeKeep: 'Keep {name}',
  mergeShown: 'This record',
  mergeShownNoun: 'This {record}',
  mergeEmpty: 'Empty',
  mergeSame: 'The same in both: {fields}.',
  mergeAllSame: 'Every field shown here holds the same in both.',
  mergeWhat: '{kept} keeps the values picked and the rest of its own. The messages, activities and links of {gone} move to {kept}, and {gone} is taken away. This cannot be undone.',
  merge: 'Merge',
  merging: 'Merging…',
  merged: 'Merged into {name}.',
  mergeUnread: 'Could not read {name}: {why}',
  closedTyped: 'Your answers can no longer be sent.',
  laterButton: 'Continue later',
  laterSaving: 'Saving your answers…',
  laterSaved: 'Your answers are saved',
  laterLink: 'To continue, open this link on this device or another:',
  laterLinkName: 'Link to continue',
  laterCopy: 'Copy link',
  laterCopied: 'Link copied',
  laterAgain: 'Open this form again to continue where you stopped.',
  laterBack: 'Keep going',
  laterFailed: 'Your answers could not be saved: {why}',
  resumeMissing: 'These saved answers could not be found: they may have been sent already. The form starts empty.',
  approvalWaiting: 'Waiting for {who}',
  approvalWho: '{level}: {names}',
  approvalNeeded: 'Needs approval from {levels}',
  approvalThen: '{first}, then {next}',
  approvalApproved: 'Approved',
  approvalRejectedBy: 'Rejected by {name} ({level})',
  approvalRejected: 'Rejected ({level})',
  approvalFailed: 'The approvals could not be read: {why}',
  approvalOpen: 'While it waits, only {fields} can be changed.',
  approvalLockedAll: 'Nothing can be changed while it waits.',
  approvalLevelApproved: 'Approved by {names}',
  approvalLevelRejected: 'Rejected by {names}',
  approvalLevelWaiting: 'Waiting',
  approvalLevelWaitingSome: 'Waiting · approved by {names}',
  approvalLevelLater: 'Later',
  approvalLevelSkipped: 'Not needed',
  approvalApprove: 'Approve',
  approvalReject: 'Reject',
  approvalApproveFor: 'Approve for {level}',
  approvalRejectFor: 'Reject for {level}',
  approvalApproving: 'Approving…',
  approvalRejecting: 'Rejecting…',
  approvalApprovedFor: 'Approved ({level})',
  approvalRejectedFor: 'Rejected ({level})',
  approvalApproveFailed: 'Not approved: {why}',
  approvalRejectFailed: 'Not rejected: {why}',
  approvalRejectTitle: 'Reject this record?',
  approvalRejectTitleNoun: 'Reject this {record}?',
  approvalRejectAsk: 'Say why you reject it ({level}). The reason is kept in its history.',
  approvalRejectReason: 'Reason',
  approvalKeepEditing: 'Keep editing',
  approvalHistoryCount: 'Approval history ({n})',
  approvalAskedEntry: '{name} asked for approval',
  approvalApprovedEntry: '{name} approved ({level})',
  approvalRejectedEntry: '{name} rejected it ({level})',
  approvalNotNeeded: 'No approval needed',
  assistFill: 'Fill from text',
  assistFillHint: 'Paste an e-mail, a signature or a message. What is found in it is shown on each field for you to accept or reject: nothing is kept until you do.',
  assistFillBox: 'Text to fill the form from',
  assistFillPlaceholder: 'Paste the text here',
  assistFiles: 'Add files',
  assistFillGo: 'Propose values',
  assistFillEmpty: 'Paste or add what to fill from',
  assistFillEmptyText: 'Paste what to fill from',
  assistFillEmptyFiles: 'Add what to fill from',
  assistKeepEditing: 'Keep editing',
  assistReading: 'Reading…',
  assistFailed: 'Nothing could be proposed: {why}',
  assistNothing: 'Nothing in it fills this form.',
  assistProposed: '{n} values proposed',
  assistProposedOne: '1 value proposed',
  assistReview: 'Review each on its field, or accept them all. Nothing is kept until you accept it.',
  assistAcceptAll: 'Accept all',
  assistRejectAll: 'Reject all',
  assistAccept: 'Accept',
  assistReject: 'Reject',
  assistProposal: 'Proposed',
  assistProposedText: 'Proposed text',
  assistProposedIn: 'Proposed in {language}',
  assistInPlaceOf: 'in place of {value}',
  assistEmpty: 'empty',
  assistLines: '{n} lines to add',
  assistLinesOne: '1 line to add',
  assistKept: 'Proposal kept',
  assistKeptAll: 'Kept {n} values',
  assistKeptAllOne: 'Kept 1 value',
  assistUndo: 'Undo',
  assistUndone: 'Put back as it was.',
  assistLeftTyped: 'Left as you typed: {fields}',
  assistNotUsed: 'Not used: {items}',
  assistOutOfSight: 'Also proposed, out of sight: {fields}',
  assistNoneCalled: 'nothing is called “{name}”',
  assistSeveralCalled: 'more than one is called “{name}”',
  assistNotOffered: '“{name}” is not one of its choices',
  assistNotRead: 'not a value it holds',
  assistDraft: 'Draft',
  assistPolish: 'Polish',
  assistWriting: 'Writing…',
  assistRewriteFailed: 'No words came back: {why}',
  assistWords: 'Read as filters',
  assistWordsTitle: 'Turn these words into filters',
  assistWordsReading: 'Reading your words…',
  assistWordsMade: 'Read as filters: {filters}',
  assistWordsNone: 'No filter was found in these words.',
  assistWordsFailed: 'Your words could not be read: {why}',
  quizTitle: 'Your results',
  quizScore: 'You scored {score} of {max} ({percent})',
  quizRight: 'Right',
  quizWrong: 'Wrong',
  quizNotAnswered: 'Not answered',
  quizPoints: '{points} of {max}',
  quizYourAnswer: 'Your answer: {answer}',
  quizRightAnswer: 'Right answer: {answer}',
  quizLater: 'Your results will be shown once your answers have been reviewed.',
  reviewAnswers: 'Review your answers',
  reviewTitle: 'Check your answers',
  reviewEdit: 'Edit',
  reviewNotAnswered: 'Not answered',
  backToReview: 'Back to review',
  flowQuestionOf: 'Question {n} of {total}',
  flowPrevious: 'Previous question',
  flowNext: 'Next question',
  flowOk: 'OK',
  flowEnterHint: 'or press Enter',
  timeLimitTitle: 'This form has a time limit',
  timeLimitIntro: 'You have {time} to answer, from when you press Start.',
  timeStart: 'Start',
  timeLeft: 'Time left: {time}',
  stepTimeLeft: 'Time left for this step: {time}',
  timeWarn: '{time} left.',
  timeUpSent: 'Time is up: your answers were sent as they were.',
  timeUpLocked: 'Time is up: your answers are locked. Press {send} to send them.',
  stepTimeUp: 'Time is up for this step: its answers are kept as they are.',
  verifySend: 'Send a code',
  verifySendBy: 'Send a code by {by}',
  verifyBySms: 'SMS',
  verifyByWhatsapp: 'WhatsApp',
  verifyByCall: 'phone call',
  verifyByEmail: 'email',
  verifySending: 'Sending a code…',
  verifySent: 'We sent a code to {value}.',
  verifySentBy: 'We sent a code to {value} by {by}.',
  verifyWorksFor: 'It works for {minutes} minutes.',
  verifyWorksForOne: 'It works for 1 minute.',
  verifyCodeName: 'Code sent to {value}',
  verifyCheck: 'Confirm',
  verifyChecking: 'Checking the code…',
  verifyTypeCode: 'Type the code you were sent.',
  verifyWrong: 'That code is not right.',
  verifyWrongOne: 'That code is not right: 1 try left.',
  verifyWrongSome: 'That code is not right: {tries} tries left.',
  verifyWrongNone: 'That code is not right, and no tries are left: send a new one.',
  verifyExpired: 'The code has expired: send a new one.',
  verifyAgain: 'Send again',
  verifyAgainIn: 'Send again in {time}',
  verifyDone: 'Confirmed',
  verifyNotSent: 'The code could not be sent: try again.',
  verifyNotChecked: 'The code could not be checked: try again.',
  payAmount: 'Pay {amount}',
  payBack: 'Back to the answers',
  payCancel: 'Cancel',
  payCancelling: 'Cancelling…',
  payNothingSent: 'Nothing is sent until it is paid.',
  payWaiting: 'Waiting for the payment…',
  payPaid: 'Paid',
  payPaidReference: 'Paid: reference {reference}',
  payAgain: 'Pay again',
  payCancelled: 'The payment was cancelled: nothing was sent.',
  payFailed: 'The payment did not go through: nothing was sent.',
  payFailedWhy: 'The payment did not go through: {why} Nothing was sent.',
  payNotStarted: 'The payment could not be started: try again.',
  formNotLoaded: 'This form could not be loaded.',
  outboxWaiting: '{count} sends wait on this device.',
  outboxWaitingOne: '1 send waits on this device.',
  outboxOffline: 'No signal:',
  outboxSending: 'Sending what waited…',
  outboxSent: 'Everything that waited was sent.',
  outboxSendNow: 'Send now',
  outboxRefused: 'Not sent: {why}',
  outboxRetry: 'Try again',
  outboxDiscard: 'Discard',
  outboxDiscardAsk: 'Discard this send? Its answers will be lost.',
  outboxKeptTitle: 'Kept on this device',
  outboxKeptWords: 'There is no signal: your answers are kept here and sent as soon as it comes back, even if you close this page.',
};

/**
 * The viewer's words in every language Fieldia has. This package holds all
 * eight (Turkish, Persian, Urdu and Spanish machine-assisted, not yet reviewed
 * by a native speaker); the one-tag script holds English alone, and a page adds another
 * language with that language's script (fieldia.ar.js, …), through
 * `addLanguage`.
 */
export const VIEWER_LABELS = { en, ...LANGUAGES } as Record<Locale, ViewerLabels>;
// Turkish, Persian, Urdu and Spanish: each in a chunk of its own, there once asked for (`wordsReady`), English till it came.
wordsInChunks(tableInChunks(VIEWER_LABELS, LATER));

/** English, kept under its old name. */
export const DEFAULT_LABELS: ViewerLabels = VIEWER_LABELS.en;

/** The languages with a script of their own beside the one-tag script, by name. */
const ADD_ONS = new Map([
  ['ar', 'Arabic'],
  ['de', 'German'],
  ['fr', 'French'],
  ['tr', 'Turkish'],
  ['fa', 'Persian'],
  ['ur', 'Urdu'],
  ['es', 'Spanish'],
]);
const missing = new Set<string>();

/**
 * The language of the viewer's own words for a language tag: its own, its
 * base language's (`ar` for `ar-EG`), or English. A language the one-tag
 * script was not given is English, and the console says once which script
 * to add. A language whose words come in a chunk of their own (the
 * packages' Turkish, Persian, Urdu and Spanish), asked for by what does not
 * wait for them as `mountViewer` does: its own, English's words till they
 * come, and the console says once what to await.
 */
export function ownLocale(tag = 'en'): Locale {
  const base = tag.split('-')[0].toLowerCase();
  if (Object.prototype.hasOwnProperty.call(VIEWER_LABELS, base)) return base as Locale;
  if (wordsNotYet(base)) return base as Locale;
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

const own = (words: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(words, key);

/** A sentence in the words a page names its records by: `exportedNoun`, `exportedNounOne`. */
const NOUN = /Noun(One|Two|Many)?$/;

/**
 * The sentence a sentence in the words for a page's records stands for — `exportedNounOne`'s is `exportedOne` — or
 * null for any other word. A language, or an app's `labels`, that gives that one and not this says its own instead.
 */
export const plainOf = (key: string): string | null => (NOUN.test(key) ? key.replace(NOUN, '$1') : null);

/**
 * The viewer's words for a page in `locale`: the app's own (`labels`) over that language's, each read as it is drawn —
 * not copied as the page is mounted, so the words a part brings as it comes (the one-tag script's: add-language.ts) are
 * there for what is drawn once it has. It reads as the words it holds: spread, keyed and listed alike. A sentence the
 * app gives, without its sentence for a page's records (`…Noun`), is said for that one too.
 */
export function viewerWords(locale: Locale, labels: Partial<ViewerLabels> = {}): ViewerLabels {
  const mine: Record<string, unknown> = { ...labels };
  const table = () => (own(VIEWER_LABELS, locale) ? VIEWER_LABELS[locale] : VIEWER_LABELS.en) as unknown as Record<string, unknown>;
  const has = (key: PropertyKey) => typeof key === 'string' && (own(mine, key) || own(table(), key));
  const word = (key: PropertyKey) => {
    if (typeof key !== 'string') return undefined;
    if (own(mine, key)) return mine[key];
    // The app's own sentence, given without one for the page's records: its own, said on that page too.
    const plain = plainOf(key);
    return plain !== null && own(mine, plain) ? mine[plain] : table()[key];
  };
  return new Proxy({} as ViewerLabels, {
    get: (_, key) => word(key),
    set: (_, key, value) => {
      if (typeof key === 'string') mine[key] = value;
      return true;
    },
    has: (_, key) => has(key),
    ownKeys: () => [...new Set([...Object.keys(table()), ...Object.keys(mine)])],
    getOwnPropertyDescriptor: (_, key) => (has(key) ? { value: word(key), writable: true, enumerable: true, configurable: true } : undefined),
  });
}
