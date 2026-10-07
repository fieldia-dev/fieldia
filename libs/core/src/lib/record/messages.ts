import { LANGUAGES } from './locales/all';

/**
 * Validation messages, by language. `{label}` is the field's label; the other
 * placeholders are named in each English message. English keeps the React
 * engine's wording; Arabic, German and French build on its translations.
 */
export interface Messages {
  required: string;
  maxLength: string;
  pattern: string;
  text: string;
  number: string;
  integer: string;
  min: string;
  max: string;
  decimals: string;
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
  /** The language the days in these messages are written in, as Intl reads it. */
  locale: string;
}

export type Locale = 'en' | 'ar' | 'de' | 'fr';

/** English: always here, and the words a language leaves out. */
const en: Messages = {
  required: '{label} is required',
  maxLength: 'Maximum {max} characters allowed',
  pattern: '{label} is not in the expected format',
  text: '{label} must be text',
  number: '{label} must be a number',
  integer: '{label} must be a whole number',
  min: '{label} must be at least {min}',
  max: '{label} must be at most {max}',
  decimals: 'Maximum {digits} decimal places allowed',
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
  locale: 'en',
};

/**
 * The messages in every language Fieldia has. This package holds all four;
 * the one-tag script holds English alone, and a page adds another language
 * with that language's script (fieldia.ar.js, …), through the viewer's
 * `addLanguage`.
 */
export const MESSAGES: Record<Locale, Messages> = { en, ...LANGUAGES };

/** Fill `{name}` placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
