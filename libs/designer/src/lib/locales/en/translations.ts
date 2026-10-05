import { plural } from '../speak';

const count = (n: number, one: string, other: string) => plural('en', n, { one: `# ${one}`, other: `# ${other}` });

/** The Translations view: its bar, the grid of words and their translations, CSV in and out, and what a language refused says. */
export const translations = {
  title: 'Translations',
  modes: 'Design, try or translate the page',
  ownLanguage: 'The page’s own language',
  /** The line under the title: `{language}` is where the page's own language is picked. */
  note: (words: number, languages: number) => `${count(words, 'word', 'words')}, written in {language}.${languages ? '' : ' Add a language to translate them into it.'}`,
  onlyMissing: 'Only words not translated',
  addLanguage: 'Add a language',
  addExample: 'Arabic, es, pt-BR…',
  add: 'Add',
  copyCsv: 'Copy as CSV',
  pasteCsv: 'Paste CSV',
  removeALanguage: 'Remove a language',
  askRemove: (name: string, n: number) => `Remove ${name}? ${n === 1 ? 'Its 1 translation goes' : `Its ${n} translations go`} with it.`,
  remove: (name: string) => `Remove ${name}`,
  keepIt: 'Keep it',
  removed: (name: string) => `Removed ${name}.`,
  removedUndo: (name: string) => `Removed ${name}. Undo brings it back.`,
  added: (name: string) => `Added ${name}.`,
  pasteLabel: 'Paste a CSV: its first row names each column’s language (ar or Arabic), its first column holds the page’s words.',
  copyLabel: 'Copy this CSV (Ctrl+C or ⌘C), for a spreadsheet or a translator.',
  fill: 'Fill the translations',
  cancel: 'Cancel',
  done: 'Done',
  copied: (words: number, languages: number) => `Copied ${count(words, 'word', 'words')}${languages ? ` in ${count(languages, 'language', 'languages')}` : ''} as CSV.`,
  nothingFilled: 'Nothing could be filled',
  filled: (filled: number, notOnPage: number) =>
    `Filled ${count(filled, 'translation', 'translations')}.${notOnPage ? ` ${count(notOnPage, 'word', 'words')} no longer on the page ${notOnPage === 1 ? 'was' : 'were'} left out.` : ''}`,
  // ---- Find anything
  pageWordsElsewhere: 'the page’s words in other languages',
  tryIn: (name: string) => `Try it in ${name}`,
  // ---- the grid
  allTranslated: 'Every word is translated in every language.',
  grid: 'Words and their translations',
  cell: (name: string, word: string) => `${name} for “${word}”`,
  ownWordsHead: (name: string) => `${name}, the page’s own words`,
  ownWords: 'The page’s own words',
  progress: (name: string, done: number, total: number) => `${name}, ${done} of ${total} translated`,
  progressCount: (done: number, total: number) => `${done} of ${total}`,
  staleTitle: 'No longer on the page',
  staleNote: 'Translations kept for words the page no longer shows.',
  staleGrid: 'Translations no longer on the page',
  removeAll: 'Remove all',
  words: 'Words',
  removeWord: (word: string) => `Remove the translations of “${word}”`,
  removeItsTranslations: 'Remove its translations',
  removeColumn: 'Remove',
  // ---- a CSV read
  nothingToRead: 'There is nothing to read: paste the CSV, its first row naming the languages',
  notALanguage: (name: string) => `“${name}” in the first row is not a language: name it by its tag or name, such as ar or Arabic`,
  noLanguageColumn: 'The first row names no language to fill: put a language’s tag or name over each column after the first, such as ar or Arabic',
  // ---- refused
  notATag: (typed: string) => `“${typed}” is not a language tag, such as ar, es or pt-BR`,
  writtenIn: (name: string) => `The page is written in ${name}: its words are the ${name} already`,
  addFirst: (name: string) => `Add ${name} first`,
  hasAlready: (name: string) => `The page has ${name} already`,
  hasNo: (name: string) => `The page has no ${name}`,
  notOnPage: (word: string) => `“${word}” is not on the page`,
  noneOnPage: 'None of these words is on the page',
  keepsTranslation: (name: string) => `The page keeps a translation into ${name}: remove ${name} first to write the page in it`,
  noLanguageHas: 'No language has those words',
};
