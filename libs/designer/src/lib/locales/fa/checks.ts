import type { DesignerWords } from '../../designer-words';
import { listOf, ltr, quoteAr } from '../speak';

const q = quoteAr;

/**
 * The designer's words in Farsi: what people would trip over, as Checks lists it before publishing, and each fix's
 * button.
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const checks: DesignerWords['checks'] = {
  noQuestions: 'نظرسنجی هنوز پرسشی ندارد، پس چیزی برای پاسخ دادن نیست.',
  noWords: (question, label) => `${question ? 'یک پرسش' : 'یک فیلد'} هنوز متنی ندارد: کاربران ${q(label)} را خواهند خواند.`,
  typeItsWords: 'نوشتن متن آن',
  defaultOptions: (label, options) => `${q(label)} هنوز ${listOf('fa', options, 'and')} را به‌عنوان گزینه‌هایش ارائه می‌کند.`,
  typeItsOptions: 'نوشتن گزینه‌های آن',
  linkedPicture: 'تصویری که پیوند است توضیحی ندارد: صفحه‌خوان آن را پیوندی بی‌نام خواهد خواند.',
  picture: 'تصویری توضیح ندارد: به کسانی که نمی‌توانند آن را ببینند چیزی دربارهٔ آن گفته نمی‌شود.',
  describeIt: 'افزودن توضیح',
  emptyPage: (name) => `${q(name)} پرسشی ندارد: کاربران صفحه‌ای خالی خواهند دید.`,
  emptySection: (name) => `${q(name)} فیلدی ندارد: به‌صورت یک کادر خالی نمایش داده می‌شود.`,
  nothingOnPaper: 'همهٔ اجزای این صفحه از چاپ کنار گذاشته شده‌اند: نسخهٔ چاپی آن فقط عنوانش خواهد بود.',
  printEveryPart: 'چاپ همهٔ آن‌ها',
  deletePage: 'حذف صفحه',
  deleteSection: 'حذف بخش',
  neverShows: (name, field, value) =>
    `${q(name)} فقط زمانی نمایش داده می‌شود که ${field} برابر ${q(value)} باشد، که ${field} دیگر آن را ارائه نمی‌کند؛ پس هرگز نمایش داده نمی‌شود.`,
  neverHolds: (name, field, value) => `${q(name)}: قاعدهٔ ${q(`${field} برابر ${value} است`)} هرگز برقرار نمی‌شود، چون ${field} دیگر آن را ارائه نمی‌کند.`,
  removeTheRule: 'برداشتن قاعده',
  twoQuestions: (label) => `متن دو پرسش ${q(label)} است: ممکن است کاربران آن‌ها را از هم تشخیص ندهند.`,
  twoFields: (label) => `متن دو فیلد ${q(label)} است: ممکن است کاربران آن‌ها را از هم تشخیص ندهند.`,
  renameSecond: 'تغییر نام دومی',
  invalid: (path, _message) => (path ? `این قسمت از صفحه نامعتبر است: ${ltr(path)}` : 'صفحه چیزی دارد که با فرمت آن سازگار نیست.'),
  readsGone: (name, sentence, gone) =>
    `${q(name)}: ${q(sentence)} ${listOf('fa', gone, 'and')} را می‌خواند، که دیگر در صفحه ${gone.length === 1 ? 'نیست' : 'نیستند'}.`,
  formulaBroken: (name, problem) => `${q(name)}: فرمول آن دیگر خوانده نمی‌شود — ${problem}.`,
  givesNothing: (name, sentence, problem) => `${q(name)}: در ${q(sentence)}، ${problem} — آن قسمت چیزی نمی‌دهد.`,
  removeTheFormula: 'برداشتن فرمول',
  setBroken: (name, sentence, problem) => `${q(name)}: ${q(sentence)} دیگر خوانده نمی‌شود — ${problem}.`,
  setCannotHold: (name, sentence, problem) => `${q(name)}: ${q(sentence)} مقداری را تنظیم می‌کند که نمی‌تواند نگه دارد — ${problem}.`,
  removeIt: 'برداشتن آن',
  patternBroken: (name, pattern) => `${q(name)}: قالب قاعده، ${ltr(pattern)}، خوانده نمی‌شود.`,
  asksNothing: (name) => `${q(name)}: قاعده‌ای چیزی نمی‌خواهد، پس چیزی را بررسی نمی‌کند.`,
  checksNothing: (name, sentence, stored) => `${q(name)}: قاعدهٔ ${q(sentence)} چیزی را بررسی نمی‌کند، چون ${q(name)} ${stored} نگه می‌دارد.`,
};
