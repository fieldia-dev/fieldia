import type { DesignerWords } from '../../designer-words';
import { ltr, plural } from '../speak';

/**
 * The designer's words in Urdu: a form's endings — what people see once they send it, the first whose condition
 * holds — and the button beside a box of words that puts an answer in them (`{name}`).
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const endings: DesignerWords['endings'] = {
  heading: 'بھیجنے کے بعد',
  hint: `لوگ اپنے جوابات بھیجنے کے بعد کیا دیکھتے ہیں: پہلا اختتامیہ جس کی شرط پوری ہو، ورنہ وہ جو باقی صورتوں میں دکھایا جاتا ہے۔ ${ltr('{name}')} کوئی جواب اسی طرح دکھاتا ہے جیسے لوگ اسے پڑھتے ہیں؛ ${ltr('{id}')} وہ حوالہ دکھاتا ہے جو آپ کی ایپ جواب کو دیتی ہے۔`,
  ending: (n) => `اختتامیہ ${n}`,
  otherwise: 'باقی صورتوں میں دکھایا جاتا ہے',
  lead: 'دکھایا جاتا ہے',
  conditionFor: (n) => `اختتامیہ ${n} کب دکھایا جائے`,
  title: 'عنوان',
  titleFor: (n) => `اختتامیہ ${n} کا عنوان`,
  text: 'متن',
  textFor: (n) => `اختتامیہ ${n} کا متن`,
  textHint: `الگ سطر ایک پیراگراف ہوتی ہے؛ ${ltr('[متن](https://…)')} ایک لنک ہے۔`,
  again: 'دوبارہ شروع کرنے کا بٹن',
  againFor: (n) => `اختتامیہ ${n} کا بٹن`,
  againHint: 'خالی: «ایک اور جواب بھیجیں»۔',
  noAgain: 'کوئی بٹن نہیں',
  noAgainFor: (n) => `اختتامیہ ${n} پر کوئی بٹن نہیں`,
  add: 'اختتامیہ شامل کریں',
  addNeedsQuestion: 'ایک اور اختتامیے کے لیے ایسا سوال درکار ہے جس سے اسے چنا جائے: انتخاب والا سوال، یا ہاں یا نہیں۔',
  remove: (n) => `اختتامیہ ${n} ہٹائیں`,
  moveUp: (n) => `اختتامیہ ${n} کو اوپر منتقل کریں`,
  moveDown: (n) => `اختتامیہ ${n} کو نیچے منتقل کریں`,
  newTitle: 'شکریہ',
  plainThanks: 'اس کے بغیر لوگ دیکھتے ہیں: «شکریہ۔ آپ کے جوابات بھیج دیے گئے۔»',
  forResponses: 'اختتامیے جوابات جمع کرنے والے فارم کے لیے ہیں: ریکارڈ کی اسکرین محفوظ کرنے کے بعد اپنے ریکارڈ پر ہی رہتی ہے',
  changed: (n) => (n ? `بھیجنے کے بعد کا پیغام بدل گیا: ${plural('ur', n, { one: '# اختتامیہ', other: '# اختتامیے' })}` : 'بھیجنے کے بعد سادہ شکریہ دکھاتا ہے'),
  insertAnswer: 'جواب داخل کریں',
  insertAnswerIn: (box) => `جواب داخل کریں: ${box}`,
  answersTitle: 'اس سوال کا جواب داخل کریں',
  reference: 'وہ حوالہ جو آپ کی ایپ اسے دیتی ہے',
  noAnswers: 'ابھی کوئی سوال ایسا جواب نہیں دیتا جسے داخل کیا جا سکے۔',
  whenEmpty: 'خالی ہونے پر',
  whenEmptyHint: 'اختیاری: جواب نہ دیا گیا ہو تو یہ متن، مثلاً «یہ شاخ»',
};
