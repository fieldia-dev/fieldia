import type { DesignerWords } from '../../designer-words';
import { ltr, plural, quoteAr } from '../speak';

const q = quoteAr;
const words = (n: number) => plural('ar', n, { zero: 'لا كلمات', one: 'كلمة واحدة', two: 'كلمتان', few: '# كلمات', many: '# كلمة', other: '# كلمة' });
/** After a word it belongs to ("تم نسخ كلمتين"). */
const wordsAfter = (n: number) => plural('ar', n, { zero: 'لا كلمات', one: 'كلمة واحدة', two: 'كلمتين', few: '# كلمات', many: '# كلمة', other: '# كلمة' });
const languagesAfter = (n: number) => plural('ar', n, { one: 'لغة واحدة', two: 'لغتين', few: '# لغات', many: '# لغة', other: '# لغة' });
const translationsAfter = (n: number) => plural('ar', n, { one: 'ترجمة واحدة', two: 'ترجمتين', few: '# ترجمات', many: '# ترجمة', other: '# ترجمة' });
/** A language tag, such as ar or pt-BR, written as it is typed. */
const tags = `${ltr('ar')} أو ${ltr('العربية')}`;

export const translations: DesignerWords['translations'] = {
  title: 'الترجمات',
  modes: 'تصميم الصفحة أو تجربتها أو ترجمتها',
  ownLanguage: 'لغة الصفحة الأصلية',
  note: (n, languages) => `${words(n)}، مكتوبة باللغة {language}.${languages ? '' : ' أضف لغة لترجمتها إليها.'}`,
  onlyMissing: 'الكلمات غير المترجمة فقط',
  addLanguage: 'إضافة لغة',
  addExample: `الفرنسية، ${ltr('es')}، ${ltr('pt-BR')}…`,
  add: 'إضافة',
  copyCsv: 'نسخ بصيغة CSV',
  pasteCsv: 'لصق CSV',
  removeALanguage: 'إزالة لغة',
  askRemove: (name, n) => `هل تريد إزالة ${name}؟ ${n === 1 ? 'ستُزال معها ترجمتها الوحيدة.' : `ستُزال معها ترجماتها (${n}).`}`,
  remove: (name) => `إزالة ${name}`,
  keepIt: 'الإبقاء عليها',
  removed: (name) => `تمت إزالة ${name}.`,
  removedUndo: (name) => `تمت إزالة ${name}. يمكن التراجع عن ذلك.`,
  added: (name) => `تمت إضافة ${name}.`,
  pasteLabel: `الصق ملف CSV: يسمّي صفه الأول لغة كل عمود (${tags})، ويحمل عموده الأول كلمات الصفحة.`,
  copyLabel: `انسخ ملف CSV هذا (${ltr('Ctrl+C')} أو ${ltr('⌘C')}) لجدول بيانات أو لمترجم.`,
  fill: 'ملء الترجمات',
  cancel: 'إلغاء',
  done: 'تم',
  copied: (n, languages) => `تم نسخ ${wordsAfter(n)}${languages ? ` في ${languagesAfter(languages)}` : ''} بصيغة CSV.`,
  nothingFilled: 'لم يُملأ شيء',
  filled: (filled, notOnPage) =>
    `تم ملء ${translationsAfter(filled)}.${notOnPage ? ` وتُرك ما لم يعد في الصفحة: ${words(notOnPage)}.` : ''}`,
  pageWordsElsewhere: 'كلمات الصفحة بلغات أخرى',
  tryIn: (name) => `التجربة باللغة ${name}`,
  allTranslated: 'كل كلمة مترجمة في كل لغة.',
  grid: 'الكلمات وترجماتها',
  cell: (name, word) => `${name} لـ${q(word)}`,
  ownWordsHead: (name) => `${name}، كلمات الصفحة الأصلية`,
  ownWords: 'كلمات الصفحة الأصلية',
  progress: (name, done, total) => `${name}: تُرجم ${done} من ${total}`,
  progressCount: (done, total) => `${done} من ${total}`,
  staleTitle: 'لم تعد في الصفحة',
  staleNote: 'ترجمات محفوظة لكلمات لم تعد الصفحة تعرضها.',
  staleGrid: 'ترجمات لم تعد في الصفحة',
  removeAll: 'إزالة الكل',
  words: 'الكلمات',
  removeWord: (word) => `إزالة ترجمات ${q(word)}`,
  removeItsTranslations: 'إزالة ترجماتها',
  removeColumn: 'إزالة',
  nothingToRead: 'لا شيء للقراءة: الصق ملف CSV يسمّي صفه الأول اللغات',
  notALanguage: (name) => `${q(name)} في الصف الأول ليست لغة: سمّها برمزها أو باسمها، مثل ${tags}`,
  noLanguageColumn: `لا يسمّي الصف الأول لغة لملئها: ضع رمز لغة أو اسمها فوق كل عمود بعد الأول، مثل ${tags}`,
  notATag: (typed) => `${q(typed)} ليس رمز لغة، مثل ${ltr('ar')} أو ${ltr('es')} أو ${ltr('pt-BR')}`,
  writtenIn: (name) => `الصفحة مكتوبة باللغة ${name}: كلماتها بهذه اللغة بالفعل`,
  addFirst: (name) => `أضف اللغة ${name} أولًا`,
  hasAlready: (name) => `اللغة ${name} في الصفحة بالفعل`,
  hasNo: (name) => `اللغة ${name} ليست في الصفحة`,
  notOnPage: (word) => `${q(word)} ليست في الصفحة`,
  noneOnPage: 'لا كلمة من هذه الكلمات في الصفحة',
  keepsTranslation: (name) => `تحفظ الصفحة ترجمة إلى ${name}: أزل ${name} أولًا لكتابة الصفحة بها`,
  noLanguageHas: 'لا لغة فيها هذه الكلمات',
};
