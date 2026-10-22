import { tableInChunks, wordsInChunks, type Locale } from '@fieldia/core';
import { LANGUAGES } from './locales/all';
import { LATER } from './locales/later';

/** Every word a widget shows on its own. `{label}` and `{name}` are filled in. */
export interface WidgetLabels {
  search: string;
  noResults: string;
  /**
   * The box drawn where a part could not be shown, its error kept to it (contain.ts): a field's widget (`{label}`, the
   * field's label), or another part of the page, without a name and with one (`{label}`, its title). A field that failed
   * on the person's change says it went back to what it held (`{value}`), or that it is empty again.
   */
  brokenField: string;
  brokenKept: string;
  brokenKeptEmpty: string;
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
  /**
   * A formatted text's tables: the tool, its picker's sizes (`{rows}` by `{columns}`, each counted), a Markdown
   * table's column (`{n}`), what may be done where the caret is, the keys a table takes, and what is said once done.
   */
  tableTool: string;
  tableInsert: string;
  tableSize: string;
  tableRows: string;
  tableRowsOne: string;
  tableColumns: string;
  tableColumnsOne: string;
  tableColumn: string;
  tableRowAbove: string;
  tableRowBelow: string;
  tableColumnLeft: string;
  tableColumnRight: string;
  tableDeleteRow: string;
  tableDeleteColumn: string;
  tableHeaderRow: string;
  tableDelete: string;
  tableKeys: string;
  tableRowAdded: string;
  tableColumnAdded: string;
  tableRowDeleted: string;
  tableColumnDeleted: string;
  tableDeleted: string;
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
  /**
   * A film or a sound the browser cannot play (its format is not one it reads): said where its player would be.
   */
  cannotPlay: string;
  /**
   * A file field that records (`options.record`): its buttons, how long a recording may be (`{time}`, "2:00"), and the
   * recorder that could not be loaded. Then the recorder: the browser asked for the microphone (and the camera); ready,
   * recording, Start and Stop; stopped at the limit (`{time}`) or at the largest file the field takes; recorded (`{time}`)
   * with Use and Record again; a recording asked about before it is let go; why the devices could not be had, with Try
   * again; a browser that cannot record; and a recording's name (`{when}`, "2026-10-21 11.42.05").
   */
  recordVoice: string;
  recordVideo: string;
  recordVoiceUpTo: string;
  recordVideoUpTo: string;
  recorderNoPart: string;
  recordAskMic: string;
  recordAskCamera: string;
  recordReady: string;
  recordStart: string;
  recordStop: string;
  recordingNow: string;
  recordStoppedAt: string;
  recordStoppedSize: string;
  recordDone: string;
  recordUse: string;
  recordAgain: string;
  recordDiscardAsk: string;
  recordDiscard: string;
  recordGoBack: string;
  recordMicRefused: string;
  recordCameraRefused: string;
  recordNoMic: string;
  recordNoCamera: string;
  recordBusy: string;
  recordCannot: string;
  recordTryAgain: string;
  recordingNameVoice: string;
  recordingNameVideo: string;
  /**
   * A value shown as a code (`"widget": "qrcode"`, `"barcode"`): the code's name for a screen reader (`{value}`); words too
   * long for a QR code; a character a barcode cannot hold (`{character}`).
   */
  qrCodeOf: string;
  barcodeOf: string;
  qrTooLong: string;
  barcodeRefused: string;
  /**
   * Pins with notes on a picture (`"widget": "pins"`): how they are put and moved; the picture's group (`{label}`), none
   * yet, no pins yet; where a pin is (`{area}`, one of the nine, `{x}` and `{y}` per cent across and down); a pin's name
   * (`{n}`, `{at}`, `{note}`), its note's box and Remove; what is said as one is added, moved, removed; the most it takes.
   */
  pinsHelp: string;
  pinsOn: string;
  pinsNoPicture: string;
  pinsNone: string;
  pinAt: string;
  pinTopLeft: string;
  pinTop: string;
  pinTopRight: string;
  pinLeft: string;
  pinCentre: string;
  pinRight: string;
  pinBottomLeft: string;
  pinBottom: string;
  pinBottomRight: string;
  pinNamed: string;
  pinNamedNote: string;
  pinNote: string;
  pinNotePlaceholder: string;
  pinRemove: string;
  pinAdded: string;
  pinMoved: string;
  pinRemoved: string;
  pinsFull: string;
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
  /**
   * A signature that signs answers (`options.signs`): who signed and when (`{name}`, `{when}`), or when alone; whether
   * the answers are still as signed; its way to change them — taken away, asked first — and what is said once it is;
   * why it was not taken (`{fields}`, the answers to put right, by label).
   */
  signedByName: string;
  signedAt: string;
  answersAsSigned: string;
  answersChanged: string;
  changeAnswers: string;
  changeAnswersAsk: string;
  signatureTakenAway: string;
  notSignedYet: string;
  /** A drawing refused for answers to put right, once none is left: said, with Sign now, which signs that drawing. */
  readyToSign: string;
  signNow: string;
  /**
   * The signing's own part that could not come (offline, its script blocked): a picture not signed for want of it, a
   * signature kept whose evidence it cannot show, and Try again, which asks for it again.
   */
  notSignedNoPart: string;
  signingNoPart: string;
  signingRetry: string;
  /** The same where asking again cannot bring it (an app's modules, kept failed by the browser): a reload can. */
  notSignedReload: string;
  signingNoPartReload: string;
  /**
   * A file on its way to the app's store, where the data source stores files:
   * the words under its name as it waits, is made smaller, goes (`{n}` per
   * cent) or did not get there; its bar's name and Cancel's (`{name}`); Retry;
   * and what is said once files are in (`{n}`), or one is not.
   */
  uploading: string;
  uploadPercent: string;
  uploadWaiting: string;
  uploadPreparing: string;
  uploadFailed: string;
  uploadRefused: string;
  uploadingNamed: string;
  cancelUpload: string;
  retryUpload: string;
  retryUploadNamed: string;
  fileUploaded: string;
  filesUploaded: string;
  notUploadedNamed: string;
  /**
   * A photo set (`"widget": "photos"`): how a photo is moved, by a mouse and keys or by a finger, with or without the
   * cover's words; the cover's mark; Make
   * cover, a photo's crop and its caption's box by its `{name}`, and the caption's words while it is empty; a photo by
   * its words and place (`{n}` of `{total}`); a photo moved first, said; how many photos (`{n}`, of `{max}`), the most
   * said before anyone tries, and how many were uploaded; a photo changed, its original kept or not; its original put
   * back.
   */
  photosMove: string;
  photosMoveCover: string;
  photosMoveTouch: string;
  photosMoveTouchCover: string;
  photoCover: string;
  makeCover: string;
  coverNow: string;
  editPhoto: string;
  photoCaption: string;
  captionPlaceholder: string;
  photoNamed: string;
  photoNamedCover: string;
  photoCount: string;
  photoCountOne: string;
  photoCountOf: string;
  upToPhotos: string;
  photoUploaded: string;
  photosUploaded: string;
  photoChanged: string;
  photoChangedKept: string;
  originalBack: string;
  /**
   * A photo cropped and turned, in its dialog: its turns, the shapes to pick (any, or one), the part kept and how it
   * moves, Apply and Put back the original; while the photo is read, and why it cannot be cropped, or was not made.
   */
  turnLeft: string;
  turnRight: string;
  cropShape: string;
  cropAny: string;
  cropArea: string;
  cropKeys: string;
  applyEdit: string;
  putBackOriginal: string;
  photoLoading: string;
  photoUnreadable: string;
  photoNotMade: string;
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
  /**
   * The input rules' words (FIELDIA INPUT RULES): hints said under a box as a keystroke or a paste is refused,
   * text left that does not read, a table's totals and pastes, a list's filters. `{label}` is the field's.
   */
  /** Typing that can never be part of a number, said under the box: `{label}` is the field's. */
  numbersOnly: string;
  /** A minus typed after the number has begun. */
  minusFirst: string;
  /** A second decimal mark typed. */
  oneDecimalMark: string;
  /** Grouping marks where groups of three cannot be: `{example}` is the page's own 1234567. */
  groupsOfThree: string;
  /** Text left in a number box that does not read: `{text}` is what was typed. */
  notANumber: string;
  /** Text with a tab or a line break pasted into one box. */
  severalValues: string;
  /** An amount pasted in another currency: the box's `{currency}`, and the one pasted. */
  otherCurrency: string;
  /** A paste that is no number, quoted. */
  notPastedNumber: string;
  /** A box emptied and left that goes back to what the field holds (`{value}`). */
  stillHolds: string;
  /** Hours with minutes past 59. */
  minutes: string;
  /** A time or hours whose minutes have one digit, `{text}` as typed, which could be any of `{times}` ("6:03 or 6:30", joined in the page's language): never one of them in silence. */
  minuteDigits: string;
  /** Hours that do not read: `{decimal}` is 6.5 or 6,5, as the page writes it. */
  duration: string;
  /** A text over its most, under its counter: `{n}` characters; `…One`, the words for one, in the languages that say it apart. */
  /** A phone number's box, refusing a letter. */
  phoneChars: string;
  /** An email address's box, refusing a space. */
  emailNoSpaces: string;
  /** An email address's box, refusing a `{char}` no address has before its @ (a pasted link's "mailto:"). */
  emailChar: string;
  /** A mark typed after an email's @ that no domain has (`{char}`): "ali@example.com;" reaches no one. */
  emailDomainChar: string;
  /** The box that adds a tag. */
  addTag: string;
  /** A tag added twice: `{tag}`. */
  tagThere: string;
  /** Tags past the most: `{tags}` are those not added. */
  tagsAtMost: string;
  /** JSON that does not read, where it goes wrong (`{line}`, `{column}`) and why (`{reason}`, one of the four below or the parser's). */
  json: string;
  jsonComma: string;
  jsonQuotes: string;
  jsonDigits: string;
  jsonChar: string;
  /** A number JSON.parse would not keep as written (`{number}`), and where it is. */
  jsonNumber: string;
  /** A colour's code box: what it takes, its name, and an empty colour. */
  colourCode: string;
  colourCodeBox: string;
  noColour: string;
  /** A date box's placeholder, in the page's order (day/month/year, month/day/year, year-month-day), with a time, and a time alone. */
  dateShape: string;
  dateShapeMdy: string;
  dateShapeYmd: string;
  dateTimeShape: string;
  timeShape: string;
  /** A typed date that is no day: `{month}` by its name, `{year}`, and the `{days}` it has. */
  noSuchDay: string;
  noSuchMonth: string;
  yearDigits: string;
  /** A year of two digits, `{short}`, which could be `{early}` or `{late}`: never given a century in silence. */
  yearInFull: string;
  /** A date or time not whole when left: `{text}` as typed, `{example}` a date in the page's order. */
  /** A date written in another order than the page's (`{text}`): `{example}` in its order. */
  dateOrder: string;
  dateUnfinished: string;
  timeUnfinished: string;
  /** A paste that is no date, quoted. */
  notPastedDate: string;
  /** A date and time pasted where a day alone is kept: the day is taken, and its `{time}` (HH:MM, here) was left out. */
  timeLeftOut: string;
  /** A month's and a year's placeholders (a date with `precision`): month and year in the page's order, the year first, a year alone. */
  monthShape: string;
  monthShapeYmd: string;
  yearShape: string;
  /** The button beside a month or a year that opens its months or its years, and the buttons that turn them. */
  chooseMonth: string;
  chooseYear: string;
  previousYear: string;
  nextYear: string;
  earlierYears: string;
  laterYears: string;
  /** A month or a year not whole when left: `{text}` as typed, `{example}` one written as the box writes it. */
  monthUnfinished: string;
  yearUnfinished: string;
  /** A whole day typed or pasted where a month (or a year) alone is kept: the month is taken, and the `{day}` it leaves out said. */
  dayLeftOut: string;
  monthLeftOut: string;
  /** A date's Hijri box beside its Gregorian (`hijri`): its name, its placeholder (`{shape}`, the page's order), a Hijri date not whole. */
  hijriLabel: string;
  hijriShape: string;
  hijriUnfinished: string;
  /**
   * A box typed to a mask: what a place wants where a character does not fit there (`{char}`), a mask full (`{n}`
   * characters), and how many are still to type where it is left before it is whole (one, and `{n}`).
   */
  maskDigit: string;
  maskLetter: string;
  maskEither: string;
  maskFull: string;
  maskShort: string;
  maskShortOne: string;
  /** A one-time code's boxes: how many it has (`{n}`), said with its label; a character no code has; a code full. */
  codeDigits: string;
  codeCharacters: string;
  codeDigitOnly: string;
  codeLetterOrDigit: string;
  codeFull: string;
  codeFullCharacters: string;
  /** An amount typed in shorthand (`{typed}`, "3.5m"), said as it reads (`{amount}`); a key no number or shorthand has (`{example}`, "3.5M"). */
  shorthandIs: string;
  shorthandOnly: string;
  /** A checkbox tree's search box, named by its field (`{label}`), and how many are chosen under it. */
  treeSearch: string;
  treeChosen: string;
  treeChosenOne: string;
  /** Hours typed with a decimal mark and two digits (`{text}`), read as hours with a decimal: `{time}` in hours and minutes. */
  hoursDecimal: string;
  /** Typed words no choice is called (`{text}`), with a way to create one where the field can. */
  noMatch: string;
  noMatchCreate: string;
  /** Typed words several choices are called (`{text}`): which one is meant is for the person to pick. */
  severalCalled: string;
  /** Typed words (`{text}`) still being looked up among the records as a check is made: it waits for them. */
  lookingUp: string;
  /** An own answer that is one of the choices: it is ticked. */
  isAnOption: string;
  /** A press past the most choices (`{max}`), and past the most ranked. */
  chooseUpTo: string;
  /** An option's places left (`{n}`), beside its words — `…One`, the words for one — and one whose places are all taken. */
  seatsLeft: string;
  seatsLeftOne: string;
  seatsFull: string;
  /**
   * A text kept in several languages (`translate`): its switch between them, named for its field (`{label}`), and what
   * a language's tab says to a screen reader while nothing is typed in it, and while it must be.
   */
  languageSwitch: string;
  languageEmpty: string;
  languageNeeded: string;
  /** A list's cell or card showing a text in another language than the reader's: `{language}`, its name in the page's. */
  inLanguage: string;
  /** A repeat field (`"widget": "repeat"`, the schedule part): its choices, its boxes' names, and the rule in words. */
  repeatLabel: string;
  repeatNever: string;
  /** The choices after Does not repeat, by `|`: daily, weekly, monthly, yearly. */
  repeatKinds: string;
  repeatEveryLabel: string;
  /** What one of them is, by `|`, and many: day, week, month, year. */
  repeatUnits: string;
  repeatUnitsMany: string;
  repeatOnDays: string;
  /** A month's day, by `|`: a day of the month, its last, or a weekday's place in it. */
  repeatMonthHow: string;
  repeatMonthDay: string;
  /** A weekday's place in its month, by `|`: first, second, third, fourth, last. */
  repeatNth: string;
  repeatWeekday: string;
  repeatEndsLabel: string;
  /** How it ends, by `|`: never, on a day, after a number of times. */
  repeatEnds: string;
  repeatUntilDay: string;
  repeatCount: string;
  /** The rule in words: every `{n}` `{units}` (every one, its kind's own words: `repeatKinds`); `{every}` that, with `{days}`, `{day}` (a month's, "15th"; a weekday) and `{nth}`; then its end, `{rule}` with `{n}` times or until `{date}`. */
  repeatSaidEveryN: string;
  repeatSaidDays: string;
  repeatSaidMonthDay: string;
  repeatSaidLastDay: string;
  repeatSaidNth: string;
  repeatSaidTimes: string;
  repeatSaidOnce: string;
  repeatSaidUntil: string;
  /** A month's day's endings by the language's ordinal kinds — one, two, few, other — `-` for none: 1st, 2nd, 3rd, 4th. */
  repeatOrdinals: string;
  /** A rule this box cannot change, kept as it is: `{rule}` as written. */
  repeatKept: string;
  /** Every how many, or how many times: a whole number, 1 or more. */
  repeatAtLeastOne: string;
  /** A week's opening hours (`"widget": "hours"`, the schedule part): a day's switch, its shifts' boxes and tools, what is wrong with them, and the week in words. `{day}` a weekday's name; `{from}`, `{to}` times. */
  hoursOpenOn: string;
  hoursOpen: string;
  hoursClosed: string;
  hoursOpens: string;
  hoursCloses: string;
  hoursAddBreak: string;
  hoursRemove: string;
  hoursCopyAll: string;
  hoursCopied: string;
  hoursEndsFirst: string;
  hoursOverlap: string;
  hoursNoTime: string;
  hoursAllClosed: string;
  /** Days in a row with the same hours: `{first}` to `{last}`. */
  hoursDays: string;
  rankTop: string;
  /** A total that cannot be added up while line `{n}` holds text that does not read. */
  totalWaits: string;
  /** A number a line works out (`{own}`, a subtotal) while a cell of that line holds text that does not read: `{column}` is that cell's. */
  cellWaits: string;
  /**
   * A block pasted on a table: how many cells took it, those that did not (`{cells}`, each a `cellName`), and lines
   * past the last; `…One`, the words for one cell or line, in the languages that say it apart (inPlural).
   */
  pastedCells: string;
  pastedCellsOne: string;
  notPastedCells: string;
  cellName: string;
  /** A pasted cell on a section's or a note's row, named by its words (`{heading}`). */
  cellOfHeading: string;
  /** A cell named in a paste's note, with why it did not take what was pasted: its box's own words. */
  notPastedWhy: string;
  pasteBeyondLines: string;
  pasteBeyondLinesOne: string;
  /** A block pasted on a table of lines past its last line: the lines added for its rows. */
  pasteAddedLines: string;
  pasteAddedLinesOne: string;
  /**
   * A pasted row not pasted at all, a name in it read as no record (`{start}`: the words the row starts with): with
   * `notPastedWhy`, why — nothing called so (`pasteNoMatch`), more than one (`pasteSeveralCalled`), or the source
   * could not be asked (`pasteNotLookedUp`).
   */
  pasteRowRefused: string;
  pasteNoMatch: string;
  pasteSeveralCalled: string;
  pasteNotLookedUp: string;
  /** A list's filter box waiting for its value. */
  enterNumber: string;
  enterDate: string;
  enterValue: string;
  /**
   * A phone number read the world over (the phone part): its country's list, named by the field's `{label}`, and its
   * choice of none; a call and a WhatsApp link to the `{number}` shown; and why a number typed does not read — no
   * country to read it in, a `{code}` that is no country's, too short or too long for a number of its dialling code
   * (`{dial}`, "+20") in its `{country}`, or a `{start}` no number there has.
   */
  phoneCountry: string;
  phoneNoCountry: string;
  phoneCall: string;
  phoneCallNamed: string;
  phoneWhatsApp: string;
  phoneWhatsAppNamed: string;
  phoneLetters: string;
  phoneNeedsCountry: string;
  phoneNoCode: string;
  phoneShort: string;
  phoneLong: string;
  phoneStart: string;
  /**
   * A date and time typed on a time zone's clock (`{zone}`, its name in words) at a time (`{time}`) the clocks skip on
   * `{day}` (from `{from}` to `{to}`), or repeat (`{first}` or `{second}`: the time with each of its offsets from UTC,
   * either of which, or the zone's short name, takes it); a zone's
   * name after a time (`{mark}`) that names another zone, the zone's own then being `{right}`.
   */
  timeSkipped: string;
  timeTwice: string;
  notThisZone: string;
  /**
   * Booking slots: the free times being found, or not found, and Try again; a day's state as a person is told of it
   * (`{n}` free times, `…One` for one; `slotsOpen`, a day with free times, in the legend), the free times on a day
   * (`{day}`) or none, and a day to pick first; a time as a chip's name (`{from}` to `{to}`), the booking chosen
   * (`{day}`, `{from}`, `{to}`), a time picked being checked (`{time}`) or taken meanwhile; the zone the times are on
   * (`{zone}`, its name all year; `{mark}`, its short name on the day held or shown — CEST, or CET after the clocks go
   * back — which the booking chosen says beside its times).
   */
  slotsFinding: string;
  slotsFailed: string;
  slotsRetry: string;
  slotsFree: string;
  slotsFreeOne: string;
  slotsOpen: string;
  slotsFull: string;
  slotsClosed: string;
  slotsHoliday: string;
  slotsOn: string;
  slotsNoneOn: string;
  slotsPickDay: string;
  slotSpan: string;
  slotChosen: string;
  slotChecking: string;
  slotTaken: string;
  slotsZone: string;
  /**
   * A code scanned with the camera (the scan part): the Scan button, named by the field's `{label}` it scans into (or the
   * table it counts by scanning); the
   * camera's sheet — its title, the camera starting, where to hold the code (or, counting a table's lines, that each
   * code read counts one), Type it instead and Done; a code (`{code}`) looked up, naming nothing, or several, or not
   * looked up; a GS1 code holding no part for the field; what was read (`{value}`) and what a table counted (`{name}`
   * and `{n}`); and why the camera did not open: not allowed, none found, in use, none on this page, or no reader of
   * codes here — each saying to type the code.
   */
  scanButton: string;
  scanInto: string;
  scanCountInto: string;
  scanTitle: string;
  scanStarting: string;
  scanAim: string;
  scanAimCount: string;
  scanTypeInstead: string;
  scanDone: string;
  scanLookingUp: string;
  scanNoneFound: string;
  scanSeveral: string;
  scanLookUpFailed: string;
  scanNoPart: string;
  scanRead: string;
  scanCounted: string;
  scanRefused: string;
  scanNoCamera: string;
  scanCameraBusy: string;
  scanUnavailable: string;
  scanNoReader: string;
}

/** English: always here, and the words a language leaves out. */
const en: WidgetLabels = {
  search: 'Search…',
  noResults: 'No results',
  brokenField: 'This field could not be shown: {label}',
  brokenKept: 'Your change was not kept: it is back to {value}.',
  brokenKeptEmpty: 'Your change was not kept: it is empty again.',
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
  tableTool: 'Table',
  tableInsert: 'Insert a table',
  tableSize: '{rows} by {columns}',
  tableRows: '{n} rows',
  tableRowsOne: '{n} row',
  tableColumns: '{n} columns',
  tableColumnsOne: '{n} column',
  tableColumn: 'Column {n}',
  tableRowAbove: 'Insert row above',
  tableRowBelow: 'Insert row below',
  tableColumnLeft: 'Insert column left',
  tableColumnRight: 'Insert column right',
  tableDeleteRow: 'Delete row',
  tableDeleteColumn: 'Delete column',
  tableHeaderRow: 'Header row',
  tableDelete: 'Delete table',
  tableKeys: 'In a table, Tab goes to the next cell and Escape leaves the table.',
  tableRowAdded: 'Row added.',
  tableColumnAdded: 'Column added.',
  tableRowDeleted: 'Row deleted.',
  tableColumnDeleted: 'Column deleted.',
  tableDeleted: 'Table deleted.',
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
  cannotPlay: 'This browser cannot play it: download it to play it.',
  recordVoice: 'Record a voice note',
  recordVideo: 'Record a video',
  recordVoiceUpTo: 'voice notes up to {time}',
  recordVideoUpTo: 'videos up to {time}',
  recorderNoPart: 'The recorder could not be loaded. Press Record to try again.',
  recordAskMic: 'Allow the microphone when your browser asks.',
  recordAskCamera: 'Allow the camera and the microphone when your browser asks.',
  recordReady: 'Ready. Press Start recording.',
  recordStart: 'Start recording',
  recordStop: 'Stop',
  recordingNow: 'Recording…',
  recordStoppedAt: 'Stopped at {time}, the longest a recording may be here.',
  recordStoppedSize: 'Stopped: the recording reached the largest file this field takes.',
  recordDone: 'Recorded {time}. Play it back, then use it or record again.',
  recordUse: 'Use this recording',
  recordAgain: 'Record again',
  recordDiscardAsk: 'Discard this recording?',
  recordDiscard: 'Discard',
  recordGoBack: 'Go back',
  recordMicRefused: 'The microphone was not allowed. Allow it for this site in your browser’s settings, then press Try again, or add a recording as a file.',
  recordCameraRefused: 'The camera or the microphone was not allowed. Allow them for this site in your browser’s settings, then press Try again, or add a video as a file.',
  recordNoMic: 'No microphone was found. Connect one, then press Try again.',
  recordNoCamera: 'No camera or microphone was found. Connect one, then press Try again.',
  recordBusy: 'The microphone or the camera could not be started: another app may be using it. Close it, then press Try again.',
  recordCannot: 'This browser cannot record here. Add a recording as a file instead.',
  recordTryAgain: 'Try again',
  recordingNameVoice: 'Voice note {when}',
  recordingNameVideo: 'Video {when}',
  qrCodeOf: 'QR code: {value}',
  barcodeOf: 'Barcode: {value}',
  qrTooLong: 'Too long for a QR code: shorten it, or show a link to it instead.',
  barcodeRefused: 'A barcode cannot hold “{character}”: only letters without accents, digits and signs.',
  pinsHelp: 'Click the picture to add a pin, or reach it with Tab, move the cross with the arrow keys and press Enter. Drag a pin, or move it with the arrow keys; Delete takes it away.',
  pinsOn: '{label}: put pins on it',
  pinsNoPicture: 'No picture to put pins on yet.',
  pinsNone: 'No pins yet.',
  pinAt: '{area}, {x}% across, {y}% down',
  pinTopLeft: 'top left',
  pinTop: 'top',
  pinTopRight: 'top right',
  pinLeft: 'left',
  pinCentre: 'centre',
  pinRight: 'right',
  pinBottomLeft: 'bottom left',
  pinBottom: 'bottom',
  pinBottomRight: 'bottom right',
  pinNamed: 'Pin {n}, {at}',
  pinNamedNote: 'Pin {n}, {at}: {note}',
  pinNote: 'Note for pin {n}',
  pinNotePlaceholder: 'What was done here',
  pinRemove: 'Remove pin {n}',
  pinAdded: 'Pin {n} added: {at}.',
  pinMoved: 'Pin {n} moved: {at}.',
  pinRemoved: 'Pin {n} removed.',
  pinsFull: 'No more pins: {max} at most.',
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
  signedByName: 'Signed by {name}, {when}',
  signedAt: 'Signed {when}',
  answersAsSigned: 'The answers are as they were signed.',
  answersChanged: 'An answer has changed since it was signed.',
  changeAnswers: 'Change answers',
  changeAnswersAsk: 'Change your answers? The signature is taken away, and you sign again once they are right.',
  signatureTakenAway: 'Signature taken away: change your answers, then sign again.',
  notSignedYet: 'Not signed yet: first put right {fields}, then sign again.',
  readyToSign: 'Your answers are ready to sign.',
  signNow: 'Sign now',
  notSignedNoPart: 'Not signed yet: the signing could not load.',
  signingNoPart: 'The signing could not load: who signed and when are not shown, and the answers cannot be changed.',
  signingRetry: 'Try again',
  notSignedReload: 'Not signed yet: the signing could not load. Reload the page to sign.',
  signingNoPartReload: 'The signing could not load: who signed and when are not shown, and the answers cannot be changed. Reload the page to see them.',
  uploading: 'Uploading…',
  uploadPercent: '{n}%',
  uploadWaiting: 'Waiting…',
  uploadPreparing: 'Making it smaller…',
  uploadFailed: 'Not uploaded',
  uploadRefused: 'Not taken',
  uploadingNamed: 'Uploading {name}',
  cancelUpload: 'Cancel uploading {name}',
  retryUpload: 'Retry',
  retryUploadNamed: 'Retry {name}',
  fileUploaded: '1 file uploaded',
  filesUploaded: '{n} files uploaded',
  notUploadedNamed: '{name} was not uploaded',
  photosMove: 'Drag a photo to move it, or press Alt and an arrow key.',
  photosMoveCover: 'Drag a photo to move it, or press Alt and an arrow key. The first is the cover.',
  photosMoveTouch: 'Hold a photo a moment, then drag it to move it.',
  photosMoveTouchCover: 'Hold a photo a moment, then drag it to move it. The first is the cover.',
  photoCover: 'Cover',
  makeCover: 'Make {name} the cover',
  coverNow: '{name} is the cover now',
  editPhoto: 'Crop and turn {name}',
  photoCaption: 'Caption for {name}',
  captionPlaceholder: 'Add a caption',
  photoNamed: '{name}, photo {n} of {total}',
  photoNamedCover: '{name}, the cover, photo {n} of {total}',
  photoCount: '{n} photos',
  photoCountOne: '1 photo',
  photoCountOf: '{n} of {max} photos',
  upToPhotos: 'up to {max} photos',
  photoUploaded: '1 photo uploaded',
  photosUploaded: '{n} photos uploaded',
  photoChanged: '{name} changed',
  photoChangedKept: '{name} changed: its original is kept',
  originalBack: 'The original of {name} is back',
  turnLeft: 'Turn left',
  turnRight: 'Turn right',
  cropShape: 'Shape',
  cropAny: 'Any',
  cropArea: 'The part of the photo kept',
  cropKeys: 'Drag the part kept, or one of its corners. Arrow keys move it; Shift and an arrow key size it.',
  applyEdit: 'Apply',
  putBackOriginal: 'Put back the original',
  photoLoading: 'Reading the photo…',
  photoUnreadable: 'This photo cannot be cropped here: the page is not allowed to read it.',
  photoNotMade: 'The photo could not be made. Try again.',
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
  numbersOnly: '{label}: numbers only',
  minusFirst: 'The minus sign goes before the number',
  oneDecimalMark: 'A number has only one decimal mark',
  groupsOfThree: 'Digits are grouped in threes, like {example}',
  notANumber: '{label}: “{text}” is not a number',
  severalValues: '{label} takes one value, and several were pasted',
  otherCurrency: '{label} is in {currency}, and this amount is in {pasted}',
  notPastedNumber: '“{text}” is not a number, so it was not pasted',
  stillHolds: '{label} still holds {value}',
  minutes: '{label}: minutes go from 0 to 59, like 6:30',
  minuteDigits: '{label}: “{text}” could be {times}; write the minutes with two digits',
  duration: '{label}: write hours and minutes, like 6:30, or hours, like {decimal}',
  phoneChars: 'A phone number takes digits, spaces and + ( ) . - only',
  emailNoSpaces: 'An email address has no spaces',
  emailChar: 'An email address has no “{char}” before its @',
  emailDomainChar: 'An email address has no “{char}” after its @',
  addTag: 'Add a tag',
  tagThere: '“{tag}” is already there',
  tagsAtMost: '{label} takes at most {max}. Not added: {tags}',
  json: 'Not valid JSON, so not saved: {reason} (line {line}, column {column})',
  jsonComma: 'a comma with nothing after it',
  jsonQuotes: 'use straight quotes " instead of “ ”',
  jsonDigits: 'numbers in JSON are written 0-9',
  jsonChar: '“{char}” can’t be here',
  jsonNumber: 'Not saved: the number {number} can’t be kept as written (line {line}, column {column}); put it in quotes to keep it as text',
  colourCode: 'Enter a colour code, like #1f2937',
  colourCodeBox: 'Colour code',
  noColour: 'No colour',
  dateShape: 'dd/mm/yyyy',
  dateShapeMdy: 'mm/dd/yyyy',
  dateShapeYmd: 'yyyy-mm-dd',
  dateTimeShape: 'dd/mm/yyyy hh:mm',
  timeShape: 'hh:mm',
  noSuchDay: '{label}: {month} {year} has {days} days',
  noSuchMonth: '{label}: months go from 1 to 12',
  yearDigits: '{label}: the year has 4 digits, like 2026',
  yearInFull: '{label}: “{short}” could be {early} or {late}; write the year in full',
  dateUnfinished: '{label}: “{text}” is not a whole date yet; write it like {example}',
  dateOrder: '{label}: “{text}” is not in this page’s order; write it like {example}',
  timeUnfinished: '{label}: “{text}” is not a time; write it like 14:30',
  notPastedDate: '“{text}” is not a date, so it was not pasted',
  timeLeftOut: '{label} takes a day only: the time {time} was left out',
  monthShape: 'mm/yyyy',
  monthShapeYmd: 'yyyy-mm',
  yearShape: 'yyyy',
  chooseMonth: 'Choose a month',
  chooseYear: 'Choose a year',
  previousYear: 'Previous year',
  nextYear: 'Next year',
  earlierYears: 'Earlier years',
  laterYears: 'Later years',
  monthUnfinished: '{label}: “{text}” is not a month yet; write it like {example}',
  yearUnfinished: '{label}: “{text}” is not a year; write it like {example}',
  dayLeftOut: '{label} takes a month only: the day {day} was left out',
  monthLeftOut: '{label} takes a year only: {day} was left out',
  hijriLabel: '{label} (Hijri)',
  hijriShape: '{shape} AH',
  hijriUnfinished: '{label}: “{text}” is not a whole Hijri date yet; write it like {example}',
  maskDigit: '{label}: a digit goes here, not “{char}”',
  maskLetter: '{label}: a letter goes here, not “{char}”',
  maskEither: '{label}: a letter or a digit goes here, not “{char}”',
  maskFull: '{label} takes {n} characters: there is no room for more',
  maskShort: '{label} is not whole yet: {n} more to type',
  maskShortOne: '{label} is not whole yet: 1 more to type',
  codeDigits: '{n} digits',
  codeCharacters: '{n} characters',
  codeDigitOnly: '{label}: the code is digits only, not “{char}”',
  codeLetterOrDigit: '{label}: the code is letters and digits only, not “{char}”',
  codeFull: '{label} has {n} digits: there is no room for more',
  codeFullCharacters: '{label} has {n} characters: there is no room for more',
  shorthandIs: '{typed} is {amount}',
  shorthandOnly: '{label}: numbers only, or short for thousands and millions, like {example}',
  treeSearch: 'Search {label}',
  treeChosen: '{n} chosen',
  treeChosenOne: '1 chosen',
  hoursDecimal: '{label}: “{text}” is hours with a decimal: {time}',
  noMatch: '{label}: nothing is called “{text}”; pick one from the list',
  noMatchCreate: '{label}: nothing is called “{text}” yet; pick one or create it',
  severalCalled: '{label}: more than one is called “{text}”; pick one from the list',
  lookingUp: '{label}: still looking for “{text}”',
  isAnOption: '“{text}” is one of the choices, so it is ticked',
  chooseUpTo: 'You can choose {max}; untick one to choose another',
  seatsLeft: '{n} left',
  seatsLeftOne: '{n} left',
  seatsFull: 'Full',
  languageSwitch: 'Languages of {label}',
  languageEmpty: 'not typed yet',
  languageNeeded: 'required, not typed yet',
  inLanguage: 'in {language}',
  repeatLabel: 'Repeats',
  repeatNever: 'Does not repeat',
  repeatKinds: 'Every day|Every week|Every month|Every year',
  repeatEveryLabel: 'Every',
  repeatUnits: 'day|week|month|year',
  repeatUnitsMany: 'days|weeks|months|years',
  repeatOnDays: 'On',
  repeatMonthHow: 'On day|On the last day|On the',
  repeatMonthDay: 'Day of the month',
  repeatNth: 'first|second|third|fourth|last',
  repeatWeekday: 'Weekday',
  repeatEndsLabel: 'Ends',
  repeatEnds: 'Never|On a day|After',
  repeatUntilDay: 'Last day',
  repeatCount: 'times',
  repeatSaidEveryN: 'Every {n} {units}',
  repeatSaidDays: '{every} on {days}',
  repeatSaidMonthDay: '{every} on the {day}',
  repeatSaidLastDay: '{every} on the last day',
  repeatSaidNth: '{every} on the {nth} {day}',
  repeatSaidTimes: '{rule}, {n} times',
  repeatSaidOnce: '{rule}, once',
  repeatSaidUntil: '{rule}, until {date}',
  repeatOrdinals: 'st nd rd th',
  repeatKept: 'Kept as it is, which this box cannot change: {rule}',
  repeatAtLeastOne: 'A whole number, 1 or more',
  hoursOpenOn: 'Open on {day}',
  hoursOpen: 'Open',
  hoursClosed: 'Closed',
  hoursOpens: '{day}: opens',
  hoursCloses: '{day}: closes',
  hoursAddBreak: 'Add a break',
  hoursRemove: 'Remove {from}–{to}',
  hoursCopyAll: 'Copy to all days',
  hoursCopied: '{day}’s hours copied to every day',
  hoursEndsFirst: '{day}: {from}–{to} ends before it starts',
  hoursOverlap: '{day}: {one} and {other} overlap',
  hoursNoTime: '{day}: give each shift its start and its end',
  hoursAllClosed: 'Closed every day',
  hoursDays: '{first}–{last}',
  rankTop: 'Only the top {max} are ranked; take one out to rank another',
  totalWaits: 'Fix line {n} to see this total',
  cellWaits: 'Fix {column} to see this line’s {own}',
  pastedCells: 'Pasted into {n} cells.',
  pastedCellsOne: 'Pasted into {n} cell.',
  notPastedCells: 'Not pasted: {cells}',
  cellName: '{column}, line {n}',
  cellOfHeading: '{column}, at “{heading}”',
  notPastedWhy: '{cell} ({why})',
  pasteBeyondLines: 'Only {n} lines are here, so the rest was not pasted',
  pasteBeyondLinesOne: 'Only {n} line is here, so the rest was not pasted',
  pasteAddedLines: '{n} lines added.',
  pasteAddedLinesOne: '{n} line added.',
  pasteRowRefused: 'the row starting “{start}”, none of it',
  pasteNoMatch: '{label}: nothing is called “{text}”',
  pasteSeveralCalled: '{label}: more than one is called “{text}”',
  pasteNotLookedUp: '{label}: “{text}” could not be looked up',
  enterNumber: 'Enter a number',
  enterDate: 'Enter a date, like {example}',
  enterValue: 'Enter a value to filter by',
  phoneCountry: 'Country of {label}',
  phoneNoCountry: 'Country',
  phoneCall: 'Call',
  phoneCallNamed: 'Call {number}',
  phoneWhatsApp: 'WhatsApp',
  phoneWhatsAppNamed: 'Message {number} on WhatsApp',
  phoneLetters: '{label}: letters are not allowed in a phone number',
  phoneNeedsCountry: '{label}: choose its country, or write it with + and the country code',
  phoneNoCode: '{label}: “{code}” is no country’s code',
  phoneShort: '{label}: too short for a {dial} number ({country})',
  phoneLong: '{label}: too long for a {dial} number ({country})',
  phoneStart: '{label}: no {dial} number ({country}) starts with {start}',
  timeSkipped: '{label}: there is no {time} on {day} in {zone}: the clocks go from {from} to {to}',
  timeTwice: '{label}: {time} comes twice on {day} in {zone}, as the clocks go back; write {first} or {second}',
  notThisZone: '{label}: on {day}, {zone} is {right}, not {mark}',
  slotsFinding: 'Finding free times…',
  slotsFailed: 'The free times could not be found.',
  slotsRetry: 'Try again',
  slotsFree: '{n} free times',
  slotsFreeOne: '1 free time',
  slotsOpen: 'Free times',
  slotsFull: 'Fully booked',
  slotsClosed: 'Closed',
  slotsHoliday: 'Holiday',
  slotsOn: 'Free times on {day}',
  slotsNoneOn: 'No free times on {day}',
  slotsPickDay: 'Pick a day to see its free times.',
  slotSpan: '{from} to {to}',
  slotChosen: '{day}, {from} to {to}',
  slotChecking: 'Checking {time}…',
  slotTaken: '{time} was just booked by someone else. Pick another time.',
  slotsZone: 'Times are {zone}',
  scanButton: 'Scan',
  scanInto: 'Scan a code into {label}',
  scanCountInto: 'Count {label} by scanning',
  scanTitle: 'Scan {label}',
  scanStarting: 'Starting the camera…',
  scanAim: 'Hold the code inside the frame.',
  scanAimCount: 'Scan each item: every code read counts one.',
  scanTypeInstead: 'Type it instead',
  scanDone: 'Done',
  scanLookingUp: 'Looking up {code}…',
  scanNoneFound: 'Nothing has the code {code}. Scan another, or type it.',
  scanSeveral: 'More than one record has the code {code}. Type it to choose one.',
  scanLookUpFailed: '{code} could not be looked up just now. Scan it again.',
  scanNoPart: 'This code has no {label} in it. Scan the code on the pack.',
  scanRead: '{label}: {value}',
  scanCounted: '{name}: {n} counted',
  scanRefused: 'The camera is not allowed here. Allow it in the browser’s settings and press Scan again, or type the code.',
  scanNoCamera: 'No camera was found. Type the code instead.',
  scanCameraBusy: 'The camera is in use by another app. Close it and press Scan again, or type the code.',
  scanUnavailable: 'This page cannot use a camera. Type the code instead.',
  scanNoReader: 'Codes cannot be read in this browser just now. Type the code instead.',
};

/**
 * The widgets' words in every language Fieldia has. This package holds all
 * eight (Turkish, Persian, Urdu and Spanish machine-assisted, not yet reviewed
 * by a native speaker); the one-tag script holds English alone, and a page adds another
 * language with that language's script (fieldia.ar.js, …), through the
 * viewer's `addLanguage`.
 */
export const WIDGET_LABELS = { en, ...LANGUAGES } as Record<Locale, WidgetLabels>;
// Turkish, Persian, Urdu and Spanish: each in a chunk of its own, there once asked for (`wordsReady`), English till it came.
wordsInChunks(tableInChunks(WIDGET_LABELS, LATER));

const plurals = new Map<string, Intl.PluralRules>();
/**
 * Words for a count, `{n}` filled in: `one` where the page's language says that count apart — 1 in English, German
 * and Arabic, 0 and 1 in French — else `other`. "Pasted into 1 cell.", never "1 cells".
 */
export function inPlural(other: string, one: string, n: number, locale: string | undefined): string {
  const language = locale ?? 'en';
  let rules = plurals.get(language);
  if (!rules) {
    try {
      rules = new Intl.PluralRules(language);
    } catch {
      rules = new Intl.PluralRules('en');
    }
    plurals.set(language, rules);
  }
  return (rules.select(n) === 'one' ? one : other).replace(/\{n\}/g, String(n));
}
