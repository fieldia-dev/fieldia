import type { DesignerWords } from '../../designer-words';
import { ltr, plural, quoteAr } from '../speak';

const q = quoteAr;
const words = (n: number) => plural('ur', n, { one: '# لفظ', other: '# الفاظ' });
/** Before a postposition: "3 زبانوں میں". */
const languagesIn = (n: number) => plural('ur', n, { one: '# زبان', other: '# زبانوں' });
/** A language tag, such as ar or pt-BR, written as it is typed, and a language's name in Urdu. */
const tags = `${ltr('ar')} یا عربی`;

/**
 * The designer's words in Urdu: the Translations view — its bar, the grid of words and their translations, CSV in and
 * out, and what a language refused says. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const translations: DesignerWords['translations'] = {
  title: 'تراجم',
  modes: 'صفحہ ڈیزائن کریں، آزمائیں یا ترجمہ کریں',
  ownLanguage: 'صفحے کی اپنی زبان',
  note: (n, languages) =>
    `${plural('ur', n, { one: '# لفظ، {language} میں لکھا گیا', other: '# الفاظ، {language} میں لکھے گئے' })}۔${languages ? '' : ' ان کا ترجمہ کرنے کے لیے کوئی زبان شامل کریں۔'}`,
  onlyMissing: 'صرف غیر ترجمہ شدہ الفاظ',
  addLanguage: 'زبان شامل کریں',
  addExample: `عربی، ${ltr('es')}، ${ltr('pt-BR')}…`,
  add: 'شامل کریں',
  copyCsv: 'CSV کے طور پر کاپی کریں',
  pasteCsv: 'CSV چسپاں کریں',
  removeALanguage: 'کوئی زبان ہٹائیں',
  askRemove: (name, n) => `${name} ہٹائیں؟ ${n === 1 ? 'اس کا 1 ترجمہ بھی ساتھ ہٹ جائے گا۔' : `اس کے ${n} تراجم بھی ساتھ ہٹ جائیں گے۔`}`,
  remove: (name) => `${name} ہٹائیں`,
  keepIt: 'رہنے دیں',
  removed: (name) => `${name} ہٹا دی گئی۔`,
  removedUndo: (name) => `${name} ہٹا دی گئی۔ «کالعدم کریں» اسے واپس لے آتا ہے۔`,
  added: (name) => `${name} شامل کر دی گئی۔`,
  pasteLabel: `CSV چسپاں کریں: اس کی پہلی قطار ہر کالم کی زبان بتاتی ہے (${tags})، اور اس کے پہلے کالم میں صفحے کے الفاظ ہوتے ہیں۔`,
  copyLabel: `یہ CSV کاپی کریں (${ltr('Ctrl+C')} یا ${ltr('⌘C')})، کسی اسپریڈ شیٹ یا مترجم کے لیے۔`,
  fill: 'تراجم بھریں',
  cancel: 'منسوخ کریں',
  done: 'ہو گیا',
  copied: (n, languages) => `CSV کے طور پر کاپی کیا گیا: ${words(n)}${languages ? `، ${languagesIn(languages)} میں` : ''}۔`,
  nothingFilled: 'کچھ بھی نہیں بھرا جا سکا',
  filled: (filled, notOnPage) =>
    `${plural('ur', filled, { one: '# ترجمہ بھرا گیا۔', other: '# تراجم بھرے گئے۔' })}${
      notOnPage ? ` ${plural('ur', notOnPage, { one: '# لفظ جو اب صفحے پر نہیں، چھوڑ دیا گیا۔', other: '# الفاظ جو اب صفحے پر نہیں، چھوڑ دیے گئے۔' })}` : ''
    }`,
  pageWordsElsewhere: 'صفحے کے الفاظ دوسری زبانوں میں',
  tryIn: (name) => `${name} میں آزمائیں`,
  allTranslated: 'ہر لفظ کا ہر زبان میں ترجمہ ہو چکا ہے۔',
  grid: 'الفاظ اور ان کے تراجم',
  cell: (name, word) => `${q(word)} کا ${name} ترجمہ`,
  ownWordsHead: (name) => `${name}، صفحے کے اپنے الفاظ`,
  ownWords: 'صفحے کے اپنے الفاظ',
  progress: (name, done, total) => `${name}: ${total} میں سے ${done} کا ترجمہ ہو چکا`,
  progressCount: (done, total) => `${done} از ${total}`,
  staleTitle: 'اب صفحے پر نہیں',
  staleNote: 'ان الفاظ کے تراجم محفوظ رکھے گئے ہیں جو صفحہ اب نہیں دکھاتا۔',
  staleGrid: 'وہ تراجم جو اب صفحے پر نہیں',
  removeAll: 'سب ہٹائیں',
  words: 'الفاظ',
  removeWord: (word) => `${q(word)} کے تراجم ہٹائیں`,
  removeItsTranslations: 'اس کے تراجم ہٹائیں',
  removeColumn: 'ہٹائیں',
  nothingToRead: 'پڑھنے کے لیے کچھ نہیں: CSV چسپاں کریں، جس کی پہلی قطار زبانوں کے نام بتائے',
  notALanguage: (name) => `پہلی قطار میں ${q(name)} کوئی زبان نہیں: اسے اس کے ٹیگ یا نام سے لکھیں، جیسے ${tags}`,
  noLanguageColumn: `پہلی قطار میں بھرنے کے لیے کسی زبان کا نام نہیں: پہلے کالم کے بعد ہر کالم کے اوپر کسی زبان کا ٹیگ یا نام لکھیں، جیسے ${tags}`,
  notATag: (typed) => `${q(typed)} زبان کا ٹیگ نہیں، جیسے ${ltr('ar')}، ${ltr('es')} یا ${ltr('pt-BR')}`,
  writtenIn: (name) => `صفحہ ${name} میں لکھا گیا ہے: اس کے الفاظ پہلے ہی ${name} میں ہیں`,
  addFirst: (name) => `پہلے ${name} شامل کریں`,
  hasAlready: (name) => `صفحے میں ${name} پہلے سے موجود ہے`,
  hasNo: (name) => `صفحے میں ${name} نہیں ہے`,
  notOnPage: (word) => `${q(word)} صفحے پر نہیں`,
  noneOnPage: 'ان میں سے کوئی لفظ صفحے پر نہیں',
  keepsTranslation: (name) => `صفحے میں ${name} کا ترجمہ محفوظ ہے: صفحہ اس زبان میں لکھنے کے لیے پہلے ${name} ہٹائیں`,
  noLanguageHas: 'کسی زبان میں یہ الفاظ نہیں',
};
