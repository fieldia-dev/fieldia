export * from './lib/widgets';
export * from './lib/styles';
export * from './lib/labels';
export * from './lib/relations';
export * from './lib/lines';
export { stillShown, whileShown } from './lib/shown';
// File and picture fields, files on their way, photos made smaller and a signature's pad come in the files part, loaded
// the first time a page shows one: `(await filesPart.load()).goingItem(…)`. Their types are here; their code is not. A
// file shown as its dialog shows it (a sheet's attachment preview) is here, and so is shrinkPhoto, which asks for the part.
export { fileShown, readFile, INLINE_FILE_WARNING, SHRINK_DEFAULTS } from './lib/file-shown';
export type { Going, GoingItem } from './lib/files-going';
export type { ShrinkOptions } from './lib/shrink';
export * from './lib/extras';
export { jsonProblem, keptExactly, readJson, type JsonProblem } from './lib/json-problem';
export * from './lib/display';
export * from './lib/preferences';
export * from './lib/numbers';
// The input rules' side of a box — its guard on keystrokes, pastes and drops, and its hint — for every box an app or another
// package draws: a cell's editor, a filter, a designer's setting.
export { guard, refusalHint, numberRules, numberKeyboard, refusalWords, unreadWords, leftWords, numberFits, quoted, type Guard, type InputRules, type NumberBox, type RefusalHint } from './lib/input-rules';
// What the browser fills a box in with and the keyboard a phone shows, the page's over the kind's own: for an app's own widget.
export { boxPurpose } from './lib/kind-parts';
export { moneyReads, shortNumber, writeMoney } from './lib/money';
export { currencySymbol } from './lib/units';
export { dateExample, dateOrderOf, dateShape, isoWeek, plainDateWidget, readDateText, restingText, typingText, zoneName, zoneOf, type DateKind, type DateReader, type DateReading } from './lib/date-text';
export * from './lib/label';

export * from './lib/icons';
export * from './lib/focus-trap';
export { afterPress, watchPresses } from './lib/press';
export { countriesIn } from './lib/countries';
export * from './lib/read-text';
export { distributionIds, distributionModel, distributionWords } from './lib/distribution';
export { wearsQuiet } from './lib/quiet';
export { brokenBox, focusHeld, reportFailure, describeFailure, type ErrorHandler, type FailureStage, type PartFailure } from './lib/contain';
// A work item's text editor, its Markdown, its menus and its links box come in the text part, loaded the first time a
// page shows one: `(await textPart.load()).formattedText(…)`. Their types are here; their code is not.
export type { FormattedText, FormattedTextOptions, TextEditor, TextReference, TextSuggestion } from './lib/formatted-text';
export type { MenuChoice, TextMenu } from './lib/text-menu';
export { linkedWords } from './lib/linked-words';
export { TEXT_TOOLS, RICH_TOOLS, MARKDOWN_TOOLS, type TextTool } from './lib/text-tool-names';
export { lazyPart, settleParts, type Part } from './lib/parts';
// Fieldia's own date box, its calendar and a range of dates come in the date part, loaded the first time a page shows
// one: `(await datePart.load()).withCalendar(…)`. Their types are here; their code is not. The reader they type with is.
export type { CalendarOptions } from './lib/calendar';
export type { DateBox, DateBoxOptions } from './lib/date-box';
// A table of lines (a one2many's) and a many2many's table of records come in the lines part, loaded the first time a page
// shows one: `linesWidget` draws from it, its lines as plain words until it has come. What a line is edited through —
// `lineForm`, `columnTotal`, `openLineDialog`, which the grid and the cards draw with too — is here (lib/lines).
// Flectra's business widgets — a statusbar, priority stars, hours and a per cent's boxes, an analytic distribution, tax
// totals, payments — come in the business part, loaded the first time a page shows one:
// `(await businessPart.load()).statusbarWidget`. Their words in a cell (cellText, distributionWords) are here.
// File, picture, signature and PDF fields come in the files part, loaded the first time a page shows one; `shrinkPhoto`
// asks for it first.
// The survey kinds — a ranking, a matrix, a slider, pictures to choose from, a colour, properties, an address and a
// progress bar — come in the survey part, loaded the first time a page shows one; `progressbarWidget` and
// `propertiesWidget` draw from it, each value shown plainly until it comes.
// A phone read the world over (a page's `phone`, a field's `country` or `shown`) comes in the phone part, with every
// country's numbers: `(await phonePart.load()).readPhone(…)`, `.writePhone(…)`. Whether a field reads so is here.
// Booking slots (`"widget": "slots"`) come in the slots part, with the date part.
export type { PhoneCountry, PhoneProblem, PhoneReading } from './lib/phone-numbers';
export { textPart, pathPart, choicePart, datePart, linesPart, loadLinesPart, loadPhonePart, businessPart, filesPart, surveyPart, phonePart, slotsPart, shrinkPhoto, partWidget, partFactory, type TextPart, type PathPart, type ChoicePart, type DatePart, type LinesPart, type BusinessPart, type FilesPart, type SurveyPart, type PhonePart, type SlotsPart, type PartFactory } from './lib/widget-parts';
export { phoneLinksOf, phoneSettings, phoneWritten, type PhoneSettings } from './lib/phone-settings';
// The eight themes and the quiet look come in parts of their own, loaded the first time a form wears them: `wearTheme`
// puts a theme on as its part comes, `wearQuiet` the quiet look's sheet.
export { themesPart, quietPart, wearTheme, wearQuiet, type ThemesPart, type QuietPart } from './lib/look-parts';
