import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

const texts = (n: number) => plural('es', n, { one: '# texto', other: '# textos' });
const languagesCount = (n: number) => plural('es', n, { one: '# idioma', other: '# idiomas' });

/**
 * The designer's words in Spanish: the Translations view — its bar, the grid of the page's words (here "textos") and
 * their translations, CSV in and out, and what a language refused says. UNREVIEWED: machine-assisted, not yet reviewed
 * by a native speaker.
 */
export const translations: DesignerWords['translations'] = {
  title: 'Traducciones',
  modes: 'Diseñar, probar o traducir la página',
  ownLanguage: 'El idioma propio de la página',
  note: (words, languages) =>
    `${plural('es', words, { one: '# texto, escrito', other: '# textos, escritos' })} en {language}.${languages ? '' : ' Añada un idioma para traducirlos a él.'}`,
  onlyMissing: 'Solo los textos sin traducir',
  addLanguage: 'Añadir un idioma',
  addExample: 'Árabe, es, pt-BR…',
  add: 'Añadir',
  copyCsv: 'Copiar como CSV',
  pasteCsv: 'Pegar CSV',
  removeALanguage: 'Quitar un idioma',
  askRemove: (name, n) => `¿Quitar ${name}? ${n === 1 ? 'Con él se quitará su única traducción.' : `Con él se quitarán sus ${n} traducciones.`}`,
  remove: (name) => `Quitar ${name}`,
  keepIt: 'Conservarlo',
  removed: (name) => `Se quitó ${name}.`,
  removedUndo: (name) => `Se quitó ${name}. Deshacer lo recupera.`,
  added: (name) => `Se añadió ${name}.`,
  pasteLabel: 'Pegue un CSV: su primera fila indica el idioma de cada columna (ar o árabe) y su primera columna contiene los textos de la página.',
  copyLabel: 'Copie este CSV (Ctrl+C o ⌘C) para una hoja de cálculo o un traductor.',
  fill: 'Completar las traducciones',
  cancel: 'Cancelar',
  done: 'Listo',
  copied: (words, languages) => `Copiado como CSV: ${texts(words)}${languages ? ` en ${languagesCount(languages)}` : ''}.`,
  nothingFilled: 'No se pudo completar nada',
  filled: (filled, notOnPage) =>
    `${plural('es', filled, { one: 'Se completó # traducción', other: 'Se completaron # traducciones' })}.${
      notOnPage ? ` ${plural('es', notOnPage, { one: 'Se omitió # texto que ya no está en la página', other: 'Se omitieron # textos que ya no están en la página' })}.` : ''
    }`,
  // ---- Find anything
  pageWordsElsewhere: 'los textos de la página en otros idiomas',
  tryIn: (name) => `Probar en ${name}`,
  // ---- the grid
  allTranslated: 'Todos los textos están traducidos a todos los idiomas.',
  grid: 'Textos y sus traducciones',
  cell: (name, word) => `${name} de “${word}”`,
  ownWordsHead: (name) => `${name}, los textos propios de la página`,
  ownWords: 'Los textos propios de la página',
  progress: (name, done, total) => `${name}: ${done} de ${total} traducidos`,
  progressCount: (done, total) => `${done} de ${total}`,
  staleTitle: 'Ya no están en la página',
  staleNote: 'Traducciones guardadas de textos que la página ya no muestra.',
  staleGrid: 'Traducciones que ya no están en la página',
  removeAll: 'Quitar todo',
  words: 'Textos',
  removeWord: (word) => `Quitar las traducciones de “${word}”`,
  removeItsTranslations: 'Quitar sus traducciones',
  removeColumn: 'Quitar',
  // ---- a CSV read
  nothingToRead: 'No hay nada que leer: pegue el CSV, con los idiomas en su primera fila',
  notALanguage: (name) => `“${name}” de la primera fila no es un idioma: indíquelo por su código o su nombre, como ar o árabe`,
  noLanguageColumn:
    'La primera fila no indica ningún idioma que completar: ponga el código o el nombre de un idioma encima de cada columna después de la primera, como ar o árabe',
  // ---- refused
  notATag: (typed) => `“${typed}” no es un código de idioma, como ar, es o pt-BR`,
  writtenIn: (name) => `La página está escrita en ${name}: sus textos ya están en ${name}`,
  addFirst: (name) => `Añada primero ${name}`,
  hasAlready: (name) => `La página ya tiene ${name}`,
  hasNo: (name) => `La página no tiene ${name}`,
  notOnPage: (word) => `“${word}” no está en la página`,
  noneOnPage: 'Ninguno de estos textos está en la página',
  keepsTranslation: (name) => `La página conserva una traducción a ${name}: quite primero ${name} para escribir la página en él`,
  noLanguageHas: 'Ningún idioma tiene esos textos',
};
