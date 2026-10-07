import { plural } from '../speak';

const count = (n: number, one: string) => plural('en', n, { one: `# ${one}`, other: `# ${one}s` });
const at = (where: string) => (where ? ` ${where}` : '');
type Kind = 'page' | 'tab' | 'section';
type HeaderKind = 'button' | 'counter' | 'badge' | 'ribbon' | 'alert';
const LABELS: Record<string, string> = { above: 'above their boxes', beside: 'beside their boxes', hidden: 'inside their boxes' };

/**
 * What changed since the last version, line by line, as Publish lists it:
 * a part added, renamed, moved, a setting changed. Names are the page's
 * own, quoted; `where` says where a new part went ("beside “First name”").
 */
export const changes = {
  firstList: (columns: number) => `The first version: ${count(columns, 'column')}`,
  firstSurvey: (questions: number, pages: number) => `The first version: ${count(questions, 'question')} on ${count(pages, 'page')}`,
  firstScreen: (fields: number, sections: number) => `The first version: ${count(fields, 'field')} in ${count(sections, 'section')}`,
  title: (was: string, now: string) => `Title: “${was}” → “${now}”`,
  description: 'The description changed',
  addedPart: (kind: Kind, name: string, where: string) => `Added the ${kind} “${name}”${at(where)}`,
  removedPart: (kind: Kind, name: string) => `Removed the ${kind} “${name}”`,
  renamedPart: (kind: Kind, was: string, now: string) => `Renamed the ${kind} “${was}” to “${now}”`,
  showsForSome: (name: string, survey: boolean) => `“${name}” now shows only for some ${survey ? 'answers' : 'records'}`,
  alwaysShows: (name: string) => `“${name}” now always shows`,
  whenShowsChanged: (name: string) => `“${name}”: when it shows changed`,
  added: (name: string, where: string) => `Added “${name}”${at(where)}`,
  removed: (name: string) => `Removed “${name}”`,
  renamed: (was: string, now: string) => `Renamed “${was}” to “${now}”`,
  helpChanged: (name: string) => `“${name}”: its help changed`,
  nowRequired: (name: string) => `“${name}” is now required`,
  noLongerRequired: (name: string) => `“${name}” is no longer required`,
  nowKind: (name: string, kind: string) => `“${name}” is now ${kind}`,
  nowOwnWay: (name: string) => `“${name}” is now shown its own way`,
  addedOption: (name: string, option: string) => `“${name}”: added the option “${option}”`,
  removedOption: (name: string, option: string) => `“${name}”: removed the option “${option}”`,
  optionsChanged: (name: string) => `“${name}”: its options changed`,
  takesOther: (name: string) => `“${name}”: takes an answer of its own (“Other”)`,
  noOther: (name: string) => `“${name}”: no longer takes an answer of its own`,
  showsChanged: (name: string) => `“${name}”: how it shows changed`,
  moved: (name: string, to: string) => `Moved “${name}” to “${to}”`,
  reorderedQuestions: (page: string) => `Reordered the questions on “${page}”`,
  reorderedFields: (group: string) => `Reordered the fields in “${group}”`,
  other: 'Other changes to the page’s settings',
  // ---- files
  filesTaken: (name: string) => `“${name}”: the files it takes changed`,
  severalFiles: (name: string) => `“${name}” now takes several files`,
  oneFile: (name: string) => `“${name}” takes one file again`,
  filesFromTo: (name: string, least: number, most: number) => `“${name}”: from ${least} to ${most} files`,
  filesUpTo: (name: string, most: number) => `“${name}”: up to ${most} files`,
  filesAtLeast: (name: string, least: number) => `“${name}”: at least ${least} files`,
  filesAny: (name: string) => `“${name}”: any number of files`,
  filesShownAs: (name: string, as: 'list' | 'thumbnails' | 'cards') => `“${name}”: chosen files shown as ${as === 'list' ? 'a list' : as}`,
  filesSwitch: (name: string, on: boolean) => `“${name}”: people can ${on ? '' : 'no longer '}switch how chosen files show`,
  camera: (name: string, front: boolean) => `“${name}”: phones offer the ${front ? 'front' : 'rear'} camera`,
  noCamera: (name: string) => `“${name}”: phones no longer offer the camera`,
  // ---- a sheet's header, a list
  addedHeader: (kind: HeaderKind, label: string) => `Added the ${kind} “${label}”`,
  removedHeader: (kind: HeaderKind, label: string) => `Removed the ${kind} “${label}”`,
  renamedHeader: (kind: HeaderKind, was: string, now: string) => `Renamed the ${kind} “${was}” to “${now}”`,
  statusFrom: (label: string) => `Status steps from “${label}”`,
  noStatus: 'Removed the status steps',
  addedColumn: (label: string) => `Added the column “${label}”`,
  removedColumn: (label: string) => `Removed the column “${label}”`,
  reorderedColumns: 'Reordered the columns',
  rowsOnPage: (was: number, now: number) => `Rows on a page: ${was} → ${now}`,
  listOrder: 'The order of the list changed',
  searchLooks: 'Where the search looks changed',
  addedFilter: (label: string) => `Added the filter “${label}”`,
  removedFilter: (label: string) => `Removed the filter “${label}”`,
  groupings: 'The groupings changed',
  addedButton: (label: string) => `Added the button “${label}”`,
  removedButton: (label: string) => `Removed the button “${label}”`,
  // ---- the layout
  beside: (name: string) => `beside ${name}`,
  under: (name: string) => `under ${name}`,
  above: (name: string) => `above ${name}`,
  grouped: (n: number, group: string) => `Grouped ${n} into “${group}”`,
  madeTabs: (n: number, tabs: string) => `Made ${n} tabs: ${tabs}`,
  ungrouped: (group: string) => `Ungrouped “${group}”`,
  ungroupedTabs: (tabs: string) => `Ungrouped the tabs ${tabs}`,
  ungroupedArrangement: (parts: string) => `Ungrouped ${parts}`,
  put: (parts: string, where: string) => `Put ${parts} ${where}`,
  putUnder: (parts: string) => `Put ${parts} one under the other`,
  putSide: (parts: string) => `Put ${parts} side by side`,
  movedTo: (parts: string, to: string) => `Moved ${parts} to “${to}”`,
  /** A block, as the lines name it: "the heading “Contact”". */
  block: {
    heading: (text: string) => `the heading “${text}”`,
    words: (text: string) => `the words “${text}”`,
    button: (label: string) => `the button “${label}”`,
    image: (alt: string) => `the image “${alt}”`,
    anImage: 'an image',
    divider: 'a divider',
    spacer: 'a spacer',
    form: (name: string) => `the saved form “${name}”`,
  },
  addedBlock: (block: string, where: string) => `Added ${block}${at(where)}`,
  changedBlockTo: (block: string, text: string) => `Changed ${block} to “${text}”`,
  renamedButton: (was: string, now: string) => `Renamed the button “${was}” to “${now}”`,
  changedBlock: (block: string) => `Changed ${block}`,
  removedBlock: (block: string) => `Removed ${block}`,
  twelfths: (name: string) => `${name}: rows divided in twelfths`,
  /** A group's columns: on every screen, or on a desktop and then the smaller ones; 12 is twelfths. */
  columns: (name: string, wide: number, medium?: number, narrow?: number) => {
    const n = (c: number) => (c === 12 ? 'twelfths' : count(c, 'column'));
    const smaller = [medium ? `${medium === 12 ? 'twelfths' : medium} on a tablet` : '', narrow ? `${narrow === 12 ? 'twelfths' : narrow} on a phone` : ''].filter(Boolean);
    return `${name}: ${smaller.length ? `${n(wide)} on a desktop, ${smaller.join(', ')}` : n(wide)}`;
  },
  gaps: (name: string, gaps: boolean) => `${name}: ${gaps ? 'rows may leave gaps' : 'rows kept full'}`,
  drawn: (name: string, style: 'card' | 'plain' | 'line' | 'framed') =>
    `${name}: drawn ${{ card: 'as a card', plain: 'plain, with no box', line: 'with a line under its title', framed: 'in a frame, its title on it' }[style]}`,
  folds: (name: string, fold: 'no' | 'open' | 'folded') => `${name}: ${{ no: 'no longer folds', open: 'folds by its title, starting open', folded: 'folds by its title, starting folded' }[fold]}`,
  labels: (name: string, place: string) => `${name}: labels ${LABELS[place] ?? 'where the page puts them'}`,
  labelWidth: (name: string, px: number) => `${name}: labels ${px ? `${px} px wide` : 'as wide as the page has them'}`,
  share: (name: string, share: string) => `${name}: ${share}`,
  columnsWide: (name: string, n: number) => `${name}: ${count(n, 'column')} wide`,
  itsLabel: (name: string, place: string) => `${name}: its label ${({ above: 'above its box', beside: 'beside its box', hidden: 'inside its box' } as Record<string, string>)[place] ?? 'where its group puts it'}`,
  placeholder: (name: string) => `${name}: its placeholder changed`,
  thePage: 'the page',
  // ---- the look
  look: {
    accent: 'The accent colour',
    font: 'The font',
    density: 'The spacing',
    corners: 'The corners',
    labels: 'Where labels sit',
    labelWidth: 'Labels set beside',
    scheme: 'The colours',
  },
  /** A setting of the look as it was or is now; null for none, as the skin has it. */
  lookValue: (key: string, value: string | number | null) => {
    if (value === null) return key === 'labelWidth' ? 'as wide as the skin has them' : ['corners', 'labels', 'scheme'].includes(key) ? 'as the skin has them' : 'as the skin has it';
    if (key === 'labelWidth') return `${value} px wide`;
    const words: Record<string, Record<string, string>> = { font: { system: 'the system’s' }, labels: LABELS, scheme: { auto: 'as the reader’s system has them' } };
    return words[key]?.[String(value)] ?? String(value);
  },
  lookLine: (setting: string, was: string, now: string) => `${setting}: ${was} → ${now}`,
  // ---- rules
  ruleChanged: (name: string, must: string) => `“${name}”: a rule changed — ${must}`,
  ruleRemoved: (name: string, must: string) => `“${name}”: removed the rule — ${must}`,
  ruleAdded: (name: string, must: string) => `“${name}”: a rule — ${must}`,
  workedOut: (name: string, formula: string) => `“${name}” is worked out from ${formula}`,
  noLongerWorkedOut: (name: string) => `“${name}” is no longer worked out`,
  setWhen: (name: string, value: string, when: string) => `“${name}” is set to ${value} when ${when}`,
  setWhenJoin: (lines: readonly string[]) => lines.join('; '),
  noLongerSet: (name: string) => `“${name}” is no longer set by a rule`,
  // ---- translations
  writtenIn: (language: string) => `The page is now written in ${language}`,
  addedLanguage: (language: string) => `Added ${language}`,
  removedLanguage: (language: string) => `Removed ${language}`,
  translated: (language: string, n: number) => `${language}: ${count(n, 'word')} translated`,
  translationsChanged: (language: string, n: number) => `${language}: ${count(n, 'translation')} changed`,
  translationsTakenOut: (language: string, n: number) => `${language}: ${count(n, 'translation')} taken out`,
  // ---- a structure's own
  offersEvery: (name: string) => `“${name}”: offers every record`,
  offersWhere: (name: string, field: string, value: string) => `“${name}”: offers only records where ${field} is ${value}`,
  offersChanged: (name: string) => `“${name}”: the records it offers changed`,
  addsUp: (name: string, columns: string) => `“${name}”: adds up ${columns}`,
  addsUpNothing: (name: string) => `“${name}”: adds up nothing`,
  optionalColumns: (name: string) => `“${name}”: the columns people may hide changed`,
};
