import { LATER } from './locales/later';
import { tableInChunks, wordsInChunks } from './words-chunks';
import { labelAt } from './record-words';
import type { DateOrder } from './input-rules';

/**
 * Validation messages, by language. `{label}` is the field's label; the other
 * placeholders are named in each English message. English keeps the React
 * engine's wording; Arabic, German and French build on its translations.
 */
export interface Messages {
  required: string;
  /** Required, of a label that is a question (`isQuestion`): `{label}` is quoted already ("Please answer “How was it?”"). */
  requiredQuestion: string;
  maxLength: string;
  pattern: string;
  text: string;
  number: string;
  integer: string;
  min: string;
  max: string;
  /**
   * More decimal places than a field keeps: `{digits}` of them. By the number's plural form in the language —
   * one, two (Arabic), 3 to 10 (`decimals`), 11 and more (`decimalsMany`, Arabic) — chosen with Intl.PluralRules.
   */
  decimals: string;
  decimalsOne: string;
  decimalsTwo: string;
  decimalsMany: string;
  /** More digits than a field keeps, or than a number keeps exactly (15): `{n}`. */
  digits: string;
  /** More digits before the decimal mark than a field keeps there: `{n}`, its precision less its scale. */
  wholeDigits: string;
  boolean: string;
  dateFormat: string;
  dateInvalid: string;
  datetimeFormat: string;
  datetimeInvalid: string;
  choice: string;
  /** A choice of a field with an "Other" answer. */
  choiceOrOther: string;
  /** A matrix: the value is not an answer per row; a row it does not have; rows left unanswered. */
  matrix: string;
  matrixRow: string;
  matrixRows: string;
  choices: string;
  record: string;
  records: string;
  reference: string;
  file: string;
  fileSize: string;
  fileType: string;
  /** Several files: fewer than the fewest (never under two: one is what required asks), more than the most. */
  minFiles: string;
  maxFiles: string;
  /** A file that did not reach the data source's store, under its field — Retry or remove it: by its name, how many, or the store's reason. */
  notUploaded: string;
  notUploadedMany: string;
  fileRefused: string;
  /**
   * Answer rules, besides the messages above they share (maxLength, pattern,
   * min, max): a shortest length, an ending, how many may be ticked, a day
   * in the past or the future.
   */
  minLength: string;
  endsWith: string;
  atLeast: string;
  atMost: string;
  datePast: string;
  dateFuture: string;
  /** A rule across fields that does not hold, when it says nothing of its own. */
  holds: string;
  /** A column of a table's lines with one value on two lines: `{column}` its label, `{value}` the value. */
  distinct: string;
  /** Joins the last two items of a list: "PDF or image". */
  or: string;
  /** A tick box that must be ticked to go on, as an "I agree" box. */
  tick: string;
  /** What to type in an email, a web address, a phone number and a time of day, by example. */
  email: string;
  url: string;
  phone: string;
  time: string;
  /** A date or a time outside its earliest (`{min}`) or latest (`{max}`), and a day of the week it may not fall on (`{days}`). */
  before: string;
  after: string;
  weekday: string;
  /** A table's or a repeating group's lines: fewer than its least, more than its most. */
  minLines: string;
  maxLines: string;
  /** An address's parts, as its boxes name them, for one that must be filled: street, line 2, city, region, postcode, country. */
  addressParts: string;
  /** What a record's gear menu asks before its built-in Archive and Delete run. */
  archiveConfirm: string;
  deleteConfirm: string;
  /** Their Yes, saying what it does. */
  archiveYes: string;
  deleteYes: string;
  /**
   * What the record's source does not let this person do, when it gives no
   * reason of its own: change the record, archive it, copy it, delete it.
   */
  mayNotEdit: string;
  mayNotArchive: string;
  mayNotDuplicate: string;
  mayNotDelete: string;
  /**
   * Keep mine, after a conflict whose record as they left it was not told and
   * could not be read again: nothing is saved over work the person never saw.
   */
  theirsUnread: string;
  /** Told as the source pushes that the record shown was deleted elsewhere (`subscribe`); by whom, where it says. */
  deletedElsewhere: string;
  deletedBy: string;
  /** Told as a change made elsewhere is laid on the record shown, the person having changed nothing: `{fields}`, their labels; by whom, where it says. */
  changedElsewhere: string;
  changedBy: string;
  /** Asked before a step leaves the record while work of the person's is not saved: a copy shown, another record. */
  discardChanges: string;
  /** Why a run of steps stopped: the record it ran on was replaced by another while it went on, and its steps are not for that one. */
  recordReplaced: string;
  /** Why an `openUrl` step opened nothing: its address was none a page may open — a script, a page written as data. */
  addressRefused: string;
  /** Said with Undo after a one-tap press that offers it and said nothing of its own: `{label}`, the button's. */
  pressDone: string;
  /** The same, for the menu's own Archive and Unarchive. */
  pressArchived: string;
  pressUnarchived: string;
  /**
   * The same sentences in the words a page names its records by (`Page.records`): `{record}` for one, `{records}` for
   * more, `{aRecord}` for one with its article. Where a language leaves one out, it says its own sentence above.
   */
  archiveConfirmNoun?: string;
  deleteConfirmNoun?: string;
  mayNotEditNoun?: string;
  mayNotArchiveNoun?: string;
  mayNotDuplicateNoun?: string;
  mayNotDeleteNoun?: string;
  discardChangesNoun?: string;
  recordReplacedNoun?: string;
  loadFailedNoun?: string;
  openFailedNoun?: string;
  notLoadedNoun?: string;
  /** A text longer than its most, pasted whole: `{over}` characters too long for its `{max}`; one over (`overByOne`). The one message: its count stays a count. */
  overBy: string;
  overByOne: string;
  /** A postcode not of its country's shape: `{country}`, its `{n}` digits, and `{example}`. */
  postcode: string;
  /** A web address that is no web address: javascript:, data:, vbscript:, file:. */
  urlScheme: string;
  /** A range whose end (`{end}`, its label) comes before its start (`{start}`). */
  endBeforeStart: string;
  /** A time between a field's steps (`{step}` minutes): `{example}` and `{next}` are the steps either side. */
  timeStep: string;
  /** A field's pattern that is no pattern, as checkPage says it: `{problem}` is the browser's words. */
  patternBroken: string;
  /** A value worked out from an app's function that asks its server: still asked, and its answer not come (`{problem}`, the app's words). */
  stillWorkedOut: string;
  notWorkedOut: string;
  /**
   * Why a value worked out by one of Fieldia's functions in the functions part was not (`{problem}` of `notWorkedOut`):
   * the part could not come — offline, or not the file its fieldia.js was built with.
   */
  partNotLoaded: string;
  /** A choice taken out of an answer because a change of other answers no longer offers it: `{name}`, its label; several (`notOfferedNowMany`), their labels joined. */
  notOfferedNow: string;
  notOfferedNowMany: string;
  /**
   * Why a page takes no answers now (`limits`): before it opens and after it closed (`{when}`, its day, or its day and
   * time), all its responses taken, this person's one sent already.
   */
  formOpens: string;
  formClosed: string;
  formFull: string;
  formSent: string;
  /** A choice whose places are all taken (an option's `seats`): picked now (`choiceFull`), or held as it filled up. */
  choiceFull: string;
  choiceFilled: string;
  /**
   * A record's approvals (`approval`): a field's lock while the record waits for approval, a rejection with no reason
   * given, and a decision at a level (`{level}`, its name) this person may not decide now.
   */
  approvalLocked: string;
  approvalReasonNeeded: string;
  approvalNotYours: string;
  /**
   * A text kept in several languages (`translate`) typed in some, not in all those a required answer is typed in:
   * `{languages}`, their names in the page's language ("Arabic", "Arabic and French"); of a label that is a question,
   * `languagesNeededQuestion`.
   */
  languagesNeeded: string;
  languagesNeededQuestion: string;
  /** An email or a phone that asks for a code (`options.verify`) sent before the person confirmed it with one. */
  notVerified: string;
  /**
   * A send stopped because a part that guards it could not load (fail closed): `{part}`, the part's name below, and
   * `{again}`, what to do — try again where the part can be asked for anew, else reload the page. Nothing went.
   */
  guardNotSent: string;
  guardNotSaved: string;
  guardTryAgain: string;
  guardReload: string;
  /** The parts that guard a send, as those sentences name them. */
  guardPay: string;
  guardVerify: string;
  guardTimeLimit: string;
  guardPrefill: string;
  guardApprovals: string;
  guardOptions: string;
  guardLanguages: string;
  guardLimits: string;
  /**
   * A record that could not be loaded (`{problem}`, the source's words), said with its own Retry; a save of a record
   * that never loaded, refused; a value the source holds that the page cannot show, kept as it is stored.
   */
  loadFailed: string;
  /**
   * A record opened that could not be loaded — none of it shown yet, another's values never in its place — named by its
   * id (`{id}`), the source's words after (`{problem}`), with its own Retry.
   */
  openFailed: string;
  notLoaded: string;
  unreadableValue: string;
  /** A save or a send that broke on the way (`{problem}`, what broke): nothing went. */
  saveBroken: string;
  sendBroken: string;
  /** A new record its source answered without an id: Save again sends the same save (its key), never a second record. */
  saveNoId: string;
  /** A request past its deadline (`timeout`): the network's problem, said as the banner says it, with Retry. */
  noAnswer: string;
  /** The language the days in these messages are written in, as Intl reads it. */
  locale: string;
  /**
   * A field's label written small where a message puts it inside its sentence — "Choose at least 2 for interests" — as
   * a form's page asks (`lowerLabels`): set on the form's own messages, never in a language's table.
   */
  lowerLabels?: boolean;
  /**
   * The order the page writes its days in (`look.dateOrder`), as a message names a day ("can't be after 20 Oct 2026",
   * `dayWords`): set on the form's own messages, never in a language's table. Day first without it.
   */
  dateOrder?: DateOrder;
}

/**
 * A language Fieldia has its own words in. Turkish, Persian, Urdu and Spanish are machine-assisted and not yet reviewed
 * by a native speaker (0.31).
 */
export type Locale = 'en' | 'ar' | 'de' | 'fr' | 'tr' | 'fa' | 'ur' | 'es';

/** A message every language has: the sentences in a page's words for its records (`…Noun`) are each language's own to give. */
export type MessageKey = Exclude<keyof Messages, `${string}Noun` | 'lowerLabels' | 'dateOrder'>;

/** English: always here, and the words a language leaves out. */
const en: Messages = {
  required: '{label} is required',
  requiredQuestion: 'Please answer {label}',
  maxLength: '{label} takes at most {max} characters',
  pattern: '{label} is not in the expected format',
  text: '{label} must be text',
  number: '{label} must be a number',
  integer: '{label} must be a whole number',
  min: '{label} must be at least {min}',
  max: '{label} must be at most {max}',
  decimals: '{label} takes at most {digits} decimal places',
  decimalsOne: '{label} takes at most 1 decimal place',
  decimalsTwo: '{label} takes at most {digits} decimal places',
  decimalsMany: '{label} takes at most {digits} decimal places',
  digits: '{label} takes at most {n} digits',
  wholeDigits: '{label} takes at most {n} digits before the decimal point',
  boolean: '{label} must be yes or no',
  dateFormat: 'Invalid date format (expected YYYY-MM-DD)',
  dateInvalid: 'Invalid date (check month/day values)',
  datetimeFormat: 'Invalid date and time format (expected YYYY-MM-DDTHH:MM:SS)',
  datetimeInvalid: 'Invalid date and time (check the values)',
  choice: 'Must be one of: {options}',
  choiceOrOther: 'Must be one of: {options}, or an answer of its own',
  matrix: '{label} takes an answer for each row',
  matrixRow: 'Rows are: {rows}',
  matrixRows: 'Answer every row of {label}',
  choices: '{label} must be a list of choices',
  record: '{label} must be a record',
  records: '{label} must be a list of records',
  reference: '{label} must point to {aModels}',
  file: '{label} must be a file',
  fileSize: '{label} is larger than {size}',
  fileType: '{label} must be {aTypes} file',
  minFiles: 'Add at least {min} files to {label}',
  maxFiles: 'Too many files for {label}: at most {max}',
  notUploaded: '{name} was not uploaded: try again, or remove it',
  notUploadedMany: '{n} files were not uploaded: try again, or remove them',
  fileRefused: '{name} was not taken: {reason}',
  minLength: '{label} must be at least {min} characters',
  endsWith: '{label} must end with {ending}',
  atLeast: 'Choose at least {min} for {label}',
  atMost: 'Choose at most {max} for {label}',
  datePast: '{label} must be in the past',
  dateFuture: '{label} must be in the future',
  holds: '{label} does not agree with the other answers',
  distinct: '{column}: {value} is on more than one line of {label}',
  or: 'or',
  tick: 'Tick this box to go on',
  email: 'Enter an email address, like name@example.com',
  url: 'Enter a web address, like example.com',
  phone: 'Enter a phone number, like +20 100 123 4567',
  time: 'Enter a time, like 14:30',
  before: '{label} can’t be before {min}',
  after: '{label} can’t be after {max}',
  weekday: '{label} can’t be on a {days}',
  minLines: 'Add at least {min} to {label}',
  maxLines: 'Too many in {label}: at most {max}',
  addressParts: 'Street address|Address line 2|City|State or region|Postcode|Country',
  archiveConfirm: 'Are you sure that you want to archive this record?',
  deleteConfirm: 'Are you sure you want to delete this record?',
  archiveYes: 'Archive',
  deleteYes: 'Delete',
  mayNotEdit: 'You can read this record, but not change it.',
  mayNotArchive: 'You cannot archive this record.',
  mayNotDuplicate: 'You cannot duplicate this record.',
  mayNotDelete: 'You cannot delete this record.',
  theirsUnread: 'Their version could not be read, so yours was not saved over it. Try Keep mine again, or Reload.',
  deletedElsewhere: 'This record was deleted elsewhere.',
  deletedBy: '{name} deleted this record.',
  changedElsewhere: 'Changed elsewhere: {fields}.',
  changedBy: '{name} changed {fields}.',
  discardChanges: 'Discard your changes?',
  recordReplaced: 'Another record is shown now: the rest of these steps did not run.',
  addressRefused: 'This address was not opened: a button opens only a web page, an email address or a phone number.',
  pressDone: 'Done: {label}',
  pressArchived: 'Archived.',
  pressUnarchived: 'Brought back from the archive.',
  archiveConfirmNoun: 'Are you sure that you want to archive this {record}?',
  deleteConfirmNoun: 'Are you sure you want to delete this {record}?',
  mayNotEditNoun: 'You can read this {record}, but not change it.',
  mayNotArchiveNoun: 'You cannot archive this {record}.',
  mayNotDuplicateNoun: 'You cannot duplicate this {record}.',
  mayNotDeleteNoun: 'You cannot delete this {record}.',
  discardChangesNoun: 'Discard your changes to this {record}?',
  recordReplacedNoun: 'Another {record} is shown now: the rest of these steps did not run.',
  loadFailedNoun: 'This {record} could not be loaded: {problem}',
  openFailedNoun: 'Couldn’t open {record} {id}: {problem}',
  notLoadedNoun: 'This {record} has not loaded yet, so nothing was saved.',
  overBy: '{label} is {over} characters too long: shorten it to {max}',
  overByOne: '{label} is 1 character too long: shorten it to {max}',
  postcode: '{label}: a postcode in {country} has {n} digits, like {example}',
  urlScheme: 'Only a web address (http or https) can go here',
  endBeforeStart: '{end} can’t be before {start}',
  timeStep: '{label}: times go in steps of {step} minutes, like {example} or {next}',
  patternBroken: 'The pattern of {label} is not a valid pattern: {problem}',
  stillWorkedOut: '{label} is still being worked out',
  notWorkedOut: '{label} could not be worked out: {problem}',
  partNotLoaded: 'part of this page could not load',
  notOfferedNow: '{name} is no longer offered, so it was taken out',
  notOfferedNowMany: '{name} are no longer offered, so they were taken out',
  formOpens: 'This form opens on {when}.',
  formClosed: 'This form closed on {when}.',
  formFull: 'This form has all the responses it takes.',
  formSent: 'You have sent your answers to this form already.',
  choiceFull: '{option} is full',
  choiceFilled: '{option} is full now: choose another',
  approvalLocked: 'Locked while it waits for approval',
  approvalReasonNeeded: 'Say why you reject it',
  approvalNotYours: '{level} is not yours to decide now',
  languagesNeeded: '{label} is required in {languages}',
  languagesNeededQuestion: 'Please answer {label} in {languages}',
  notVerified: '{label} is not confirmed: send a code and type it in',
  guardNotSent: '{part} could not load, so nothing was sent. {again}',
  guardNotSaved: '{part} could not load, so nothing was saved. {again}',
  guardTryAgain: 'Try again.',
  guardReload: 'Reload the page and try again.',
  guardPay: 'The payment step',
  guardVerify: 'The code check',
  guardTimeLimit: 'The time limit',
  guardPrefill: 'The answers from the link',
  guardApprovals: 'The approvals',
  guardOptions: 'The check of the choices',
  guardLanguages: 'The check of each language',
  guardLimits: 'The check of whether this form takes answers',
  loadFailed: 'This record could not be loaded: {problem}',
  openFailed: 'Couldn’t open record {id}: {problem}',
  notLoaded: 'This record has not loaded yet, so nothing was saved.',
  unreadableValue: '{label} is stored in a way this page cannot show: it is kept as it is',
  saveBroken: 'Something went wrong, so nothing was saved: {problem}',
  sendBroken: 'Something went wrong, so nothing was sent: {problem}',
  saveNoId: 'The record went, but its data source gave back no id: save again — it is the same save, never a second record.',
  noAnswer: 'The server did not answer in time',
  locale: 'en',
};

/**
 * The messages in every language Fieldia has. This package holds all eight — English at once, each other in a chunk
 * of its own, there once asked for (`wordsReady`), English till it came (Turkish, Persian, Urdu and Spanish
 * machine-assisted, not yet reviewed by a native speaker); the one-tag script holds English alone, and a page adds
 * another language with that language's script (fieldia.ar.js, …), through the viewer's `addLanguage`.
 */
export const MESSAGES = { en } as Record<Locale, Messages>;
wordsInChunks(tableInChunks(MESSAGES, LATER));

/** The blanks of a message a field's label fills: its own, a table's column, a range's start and end. */
const LABELS = ['label', 'column', 'start', 'end'];

/**
 * A message filled in (`fill`), each field's label as its sentence puts it (`labelAt`): small inside the sentence where
 * the form's page asks (`messages.lowerLabels`), a question quoted, else as written.
 */
export function fillMessage(messages: Messages, template: string, values: Record<string, string | number>): string {
  const own = { ...values };
  for (const key of LABELS) if (typeof own[key] === 'string') own[key] = labelAt(template, key, messages.lowerLabels, messages.locale)(own[key] as string);
  return fill(template, own);
}

/** Fill `{name}` placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  // A value given, never one every object has: "{constructor}" stays as it is written.
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match));
}
