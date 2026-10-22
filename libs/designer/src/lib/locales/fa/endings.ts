import type { DesignerWords } from '../../designer-words';
import { ltr, plural } from '../speak';

/**
 * The designer's words in Farsi: a form's endings — what people see once they send it, the first whose condition
 * holds — and the button beside a box of words that puts an answer in them (`{name}`).
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const endings: DesignerWords['endings'] = {
  heading: 'پس از ارسال',
  hint: `آنچه کاربران پس از ارسال پاسخ‌هایشان می‌بینند: نخستین پایانی که شرطش برقرار باشد، وگرنه پایانی که در غیر این صورت نمایش داده می‌شود. ${ltr('{name}')} پاسخی را همان‌گونه که کاربران می‌خوانند نشان می‌دهد؛ ${ltr('{id}')} شناسهٔ مرجعی را که برنامهٔ شما به پاسخ می‌دهد.`,
  ending: (n) => `پایان ${n}`,
  otherwise: 'نمایش در غیر این صورت',
  lead: 'نمایش',
  conditionFor: (n) => `زمان نمایش پایان ${n}`,
  title: 'عنوان',
  titleFor: (n) => `عنوان پایان ${n}`,
  text: 'متن',
  textFor: (n) => `متن پایان ${n}`,
  textHint: `هر خط جداگانه یک پاراگراف است؛ ${ltr('[متن](https://…)')} یک پیوند است.`,
  again: 'دکمهٔ شروع دوباره',
  againFor: (n) => `دکمهٔ پایان ${n}`,
  againHint: 'خالی: «ارسال پاسخی دیگر».',
  noAgain: 'بدون دکمه',
  noAgainFor: (n) => `بدون دکمه در پایان ${n}`,
  add: 'افزودن پایان',
  addNeedsQuestion: 'پایانی دیگر به پرسشی نیاز دارد که بر اساس آن انتخاب شود: یک پرسش گزینه‌ای، یا بله یا خیر.',
  remove: (n) => `برداشتن پایان ${n}`,
  moveUp: (n) => `جابه‌جایی پایان ${n} به بالا`,
  moveDown: (n) => `جابه‌جایی پایان ${n} به پایین`,
  newTitle: 'سپاسگزاریم',
  plainThanks: 'بدون آن، کاربران «سپاسگزاریم. پاسخ‌های شما ارسال شد.» را می‌بینند.',
  forResponses: 'پایان‌ها برای فرمی است که پاسخ جمع‌آوری می‌کند: نمای یک رکورد پس از ذخیره روی همان رکورد می‌ماند',
  changed: (n) => (n ? `آنچه پس از ارسال می‌گوید تغییر کرد: ${plural('fa', n, { one: '# پایان', other: '# پایان' })}` : 'پس از ارسال، سپاس ساده را می‌گوید'),
  insertAnswer: 'درج پاسخ',
  insertAnswerIn: (box) => `درج پاسخ در: ${box}`,
  answersTitle: 'درج پاسخ به',
  reference: 'شناسهٔ مرجعی که برنامهٔ شما به آن می‌دهد',
  noAnswers: 'هنوز هیچ پرسشی پاسخی برای درج نمی‌دهد.',
  whenEmpty: 'هنگام خالی بودن',
  whenEmptyHint: 'اختیاری: متنی برای زمانی که بی‌پاسخ است، «این شاخه»',
};
