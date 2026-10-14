export * from './lib/widgets';
export * from './lib/styles';
export * from './lib/labels';
export * from './lib/relations';
export * from './lib/lines';
export * from './lib/files';
export * from './lib/extras';
export { jsonProblem, type JsonProblem } from './lib/json-problem';
export * from './lib/display';
export * from './lib/preferences';
export * from './lib/numbers';
// The input rules' side of a box — its guard on keystrokes, pastes and drops, and its hint — for every box an app or another
// package draws: a cell's editor, a filter, a designer's setting.
export { guard, refusalHint, numberRules, numberKeyboard, refusalWords, unreadWords, leftWords, numberFits, quoted, type Guard, type InputRules, type NumberBox, type RefusalHint } from './lib/input-rules';
export { moneyReads, shortNumber, writeMoney } from './lib/money';
export { dateExample, dateOrderOf, dateShape, isoWeek, plainDateWidget, readDateText, restingText, typingText, type DateKind, type DateReader, type DateReading } from './lib/date-text';
export * from './lib/progress';
export * from './lib/label';
export * from './lib/statusbar';
export * from './lib/properties';
export * from './lib/icons';
export * from './lib/focus-trap';
export { countriesIn } from './lib/address';
export * from './lib/read-text';
export { distributionIds, distributionModel, distributionWords } from './lib/distribution';
export { wearsQuiet } from './lib/quiet';
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
export { textPart, pathPart, choicePart, datePart, partWidget, partFactory, type TextPart, type PathPart, type ChoicePart, type DatePart, type PartFactory } from './lib/widget-parts';
