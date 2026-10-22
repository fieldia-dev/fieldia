import type { DesignerWords } from '../../designer-words';
import { ltr, plural } from '../speak';

/** The designer's words in Urdu: the page as JSON — its view, the state of the text, what each problem is, and the mistakes a person makes typing JSON. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker. */
export const json: DesignerWords['json'] = {
  pageAsJson: 'صفحہ بطور JSON',
  copyJson: 'JSON کاپی کریں',
  apply: 'لاگو کریں',
  discard: 'تبدیلیاں ترک کریں',
  keepEditing: 'ترمیم جاری رکھیں',
  notApplied: 'یہاں لکھی گئی تبدیلیاں ابھی لاگو نہیں ہوئیں۔',
  problems: 'مسائل',
  hint: (chord) => `Tab سے سطر اندر کی طرف کھسکتی ہے۔ خانے سے باہر جانے کے لیے Esc اور پھر Tab دبائیں۔ ${ltr(`${chord}Enter`)} تبدیلیاں لاگو کرتا ہے۔`,
  severity: { error: 'لاگو نہیں ہو سکتا', must: 'درست کرنا لازمی ہے', should: 'درست کرنا بہتر ہے' },
  goToLine: (line, column) => `سطر ${line}، کالم ${column} پر جائیں`,
  line: (line) => `سطر ${line}`,
  toPutRight: (n) =>
    plural('ur', n, {
      one: 'لاگو کرنے سے پہلے # مسئلہ درست کرنا ہوگا۔',
      other: 'لاگو کرنے سے پہلے # مسائل درست کرنا ہوں گے۔',
    }),
  changed: (chord) => `یہاں تبدیل ہوا، ابھی لاگو نہیں ہوا: «لاگو کریں» یا ${ltr(`${chord}Enter`)}۔`,
  nothingToApply: 'لاگو کرنے کے لیے کچھ نہیں: متن صفحے کی موجودہ حالت ہی ہے۔',
  cannotFix: 'یہ اصلاح متن کی موجودہ حالت میں نہیں کی جا سکتی۔',
  fixed: 'متن میں درست کر دیا گیا۔ اسے برقرار رکھنے کے لیے لاگو کریں۔',
  applied: 'لاگو ہو گیا۔ «کالعدم کریں» اسے واپس لے لیتا ہے۔',
  copied: 'کاپی ہو گیا۔',
  selected: (chord) => `منتخب: کاپی کرنے کے لیے ${ltr(`${chord}C`)} دبائیں۔`,
  // The format's own words (from @fieldia/core) are English and technical, as its keys are: kept as written, said so.
  formatProblem: (message) => `صفحے کا فارمیٹ اسے قبول نہیں کرتا: ${ltr(message)}`,
  editAsJson: 'صفحے میں بطور JSON ترمیم کریں',
  backToDesigning: 'ڈیزائن پر واپس جائیں',
  mistakes: {
    anyValue: `یہ ایسی قدر نہیں جسے JSON پہچانتا ہو: دوہرے واوین میں متن، کوئی عدد، ${ltr('true')}، ${ltr('false')}، ${ltr('null')}، ${ltr('[ … ]')} یا ${ltr('{ … }')}`,
    endsTooSoon: (wanted) => `متن وقت سے پہلے ختم ہو جاتا ہے: ${wanted}`,
    valueMissing: 'ایک قدر موجود نہیں',
    closingMissing: (close) => `بند کرنے والا ${ltr(close)} موجود نہیں`,
    noComments: 'JSON میں تبصرے نہیں ہوتے',
    doubleQuotes: 'متن دوہرے واوین میں لکھا جاتا ہے',
    noClosingQuote: 'اس متن کو بند کرنے والا دوہرا واوین نہیں ہے',
    lineBreak: `متن کے اندر نئی سطر نہیں آ سکتی: ${ltr('\\n')} لکھیں`,
    controlCharacter: 'متن کے اندر کنٹرول کیریکٹر نہیں آ سکتا',
    escape: (escape) => `${ltr(`"\\${escape}"`)} JSON میں معروف نہیں: بیک سلیش کے لیے ${ltr('\\\\')} لکھیں`,
    extraZeros: 'عدد اضافی صفروں سے شروع نہیں ہو سکتا',
    nothingAfterComma: 'اس کوما کے بعد کچھ نہیں: اسے ہٹا دیں',
    commaMissing: 'اس سے پہلے ایک کوما موجود نہیں',
    commaOrClosing: (close) => `یہاں کوما یا بند کرنے والا ${ltr(close)} موجود نہیں`,
    keyQuotes: (word) => `کلید دوہرے واوین میں لکھی جاتی ہے، جیسے ${ltr(`"${word}"`)}`,
    colonMissing: 'کلید کے بعد کولن موجود نہیں',
    empty: `خانہ خالی ہے: صفحہ ایک JSON آبجیکٹ ہوتا ہے، ${ltr('{ … }')}`,
    moreAfterEnd: `اختتام کے بعد مزید متن ہے: ایک ${ltr('{ … }')} ہی پورا صفحہ ہے`,
  },
};
