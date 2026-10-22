import type { DesignerWords } from '../../designer-words';
import { ltr, plural, quoteAr } from '../speak';

const q = quoteAr;
/** Farsi takes the singular noun after a number, and says `one` for 0 and 1: both forms carry the number. */
const words = (n: number) => plural('fa', n, { one: '# واژه', other: '# واژه' });
const languagesN = (n: number) => plural('fa', n, { one: '# زبان', other: '# زبان' });
const translationsN = (n: number) => plural('fa', n, { one: '# ترجمه', other: '# ترجمه' });
/** A language named by its tag or its name, as a CSV may name it. */
const tags = `${ltr('ar')} یا ${ltr('عربی')}`;

/**
 * The designer's words in Farsi: the Translations view — its bar, the grid of words and their translations, CSV in
 * and out, and what a language refused says.
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const translations: DesignerWords['translations'] = {
  title: 'ترجمه‌ها',
  modes: 'طراحی، امتحان یا ترجمهٔ صفحه',
  ownLanguage: 'زبان اصلی صفحه',
  note: (n, languages) => `${words(n)}، نوشته‌شده به زبان {language}.${languages ? '' : ' برای ترجمهٔ آن‌ها، زبانی بیفزایید.'}`,
  onlyMissing: 'فقط واژه‌های ترجمه‌نشده',
  addLanguage: 'افزودن زبان',
  addExample: `عربی، ${ltr('es')}، ${ltr('pt-BR')}…`,
  add: 'افزودن',
  copyCsv: 'کپی به‌صورت CSV',
  pasteCsv: 'چسباندن CSV',
  removeALanguage: 'برداشتن یک زبان',
  askRemove: (name, n) =>
    `${name} برداشته شود؟ ${n === 1 ? 'تنها ترجمهٔ آن نیز همراهش برداشته می‌شود.' : plural('fa', n, { one: '# ترجمهٔ آن نیز همراهش برداشته می‌شود.', other: '# ترجمهٔ آن نیز همراهش برداشته می‌شوند.' })}`,
  remove: (name) => `برداشتن ${name}`,
  keepIt: 'نگه داشتن',
  removed: (name) => `${name} برداشته شد.`,
  removedUndo: (name) => `${name} برداشته شد. با واگرد بازمی‌گردد.`,
  added: (name) => `${name} افزوده شد.`,
  pasteLabel: `یک CSV بچسبانید: ردیف نخست آن زبان هر ستون را نام می‌برد (${tags})، و ستون نخست آن واژه‌های صفحه را دارد.`,
  copyLabel: `این CSV را کپی کنید (${ltr('Ctrl+C')} یا ${ltr('⌘C')})، برای یک صفحه‌گسترده یا یک مترجم.`,
  fill: 'پر کردن ترجمه‌ها',
  cancel: 'لغو',
  done: 'تمام',
  copied: (n, languages) => `${words(n)}${languages ? ` در ${languagesN(languages)}` : ''} به‌صورت CSV کپی شد.`,
  nothingFilled: 'چیزی پر نشد',
  filled: (filled, notOnPage) =>
    `${translationsN(filled)} پر شد.${notOnPage ? ` ${plural('fa', notOnPage, { one: '# واژه که دیگر در صفحه نیست کنار گذاشته شد.', other: '# واژه که دیگر در صفحه نیستند کنار گذاشته شدند.' })}` : ''}`,
  pageWordsElsewhere: 'واژه‌های صفحه به زبان‌های دیگر',
  tryIn: (name) => `امتحان به زبان ${name}`,
  allTranslated: 'همهٔ واژه‌ها به همهٔ زبان‌ها ترجمه شده‌اند.',
  grid: 'واژه‌ها و ترجمه‌هایشان',
  cell: (name, word) => `${name} برای ${q(word)}`,
  ownWordsHead: (name) => `${name}، واژه‌های اصلی صفحه`,
  ownWords: 'واژه‌های اصلی صفحه',
  progress: (name, done, total) => `${name}، ${done} از ${total} ترجمه شده`,
  progressCount: (done, total) => `${done} از ${total}`,
  staleTitle: 'دیگر در صفحه نیست',
  staleNote: 'ترجمه‌هایی که برای واژه‌هایی نگه داشته شده‌اند که صفحه دیگر نشانشان نمی‌دهد.',
  staleGrid: 'ترجمه‌هایی که دیگر در صفحه نیستند',
  removeAll: 'برداشتن همه',
  words: 'واژه‌ها',
  removeWord: (word) => `برداشتن ترجمه‌های ${q(word)}`,
  removeItsTranslations: 'برداشتن ترجمه‌های آن',
  removeColumn: 'برداشتن',
  nothingToRead: 'چیزی برای خواندن نیست: CSV را بچسبانید، با ردیف نخستی که زبان‌ها را نام می‌برد',
  notALanguage: (name) => `${q(name)} در ردیف نخست یک زبان نیست: آن را با کد یا نامش بنامید، مانند ${tags}`,
  noLanguageColumn: `ردیف نخست هیچ زبانی را برای پر کردن نام نمی‌برد: بالای هر ستون پس از ستون نخست، کد یا نام یک زبان را بگذارید، مانند ${tags}`,
  notATag: (typed) => `${q(typed)} کد زبان نیست، مانند ${ltr('ar')}، ${ltr('es')} یا ${ltr('pt-BR')}`,
  writtenIn: (name) => `صفحه به زبان ${name} نوشته شده است: واژه‌های آن هم‌اکنون به همین زبان‌اند`,
  addFirst: (name) => `نخست ${name} را بیفزایید`,
  hasAlready: (name) => `صفحه هم‌اکنون ${name} را دارد`,
  hasNo: (name) => `صفحه ${name} ندارد`,
  notOnPage: (word) => `${q(word)} در صفحه نیست`,
  noneOnPage: 'هیچ‌یک از این واژه‌ها در صفحه نیست',
  keepsTranslation: (name) => `صفحه ترجمه‌ای به ${name} نگه می‌دارد: برای نوشتن صفحه به این زبان، نخست ${name} را بردارید`,
  noLanguageHas: 'هیچ زبانی این واژه‌ها را ندارد',
};
