import type { DesignerWords } from '../../designer-words';
import { listOf, ltr, quoteAr } from '../speak';

const q = quoteAr;

/**
 * The designer's words in Urdu: what people would trip over, as Checks lists it before publishing, and each fix's
 * button. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const checks: DesignerWords['checks'] = {
  noQuestions: 'سروے میں ابھی کوئی سوال نہیں، اس لیے جواب دینے کو کچھ نہیں۔',
  noWords: (question, label) => `ایک ${question ? 'سوال' : 'فیلڈ'} کا ابھی کوئی متن نہیں: لوگ ${q(label)} پڑھیں گے۔`,
  typeItsWords: 'اس کا متن لکھیں',
  defaultOptions: (label, options) => `${q(label)} کے اختیارات اب بھی ${listOf('ur', options, 'and')} ہیں۔`,
  typeItsOptions: 'اس کے اختیارات لکھیں',
  linkedPicture: 'لنک والی تصویر کی کوئی تفصیل نہیں: اسکرین ریڈر اسے بغیر نام کے لنک کے طور پر پڑھے گا۔',
  picture: 'تصویر کی کوئی تفصیل نہیں: جو لوگ اسے دیکھ نہیں سکتے انہیں اس کے بارے میں کچھ نہیں بتایا جاتا۔',
  describeIt: 'اس کی تفصیل لکھیں',
  emptyPage: (name) => `${q(name)} میں کوئی سوال نہیں: لوگوں کو خالی صفحہ نظر آئے گا۔`,
  emptySection: (name) => `${q(name)} میں کوئی فیلڈ نہیں: یہ ایک خالی خانے کی طرح دکھائی دے گا۔`,
  nothingOnPaper: 'اس صفحے کا ہر جز پرنٹ سے باہر رکھا گیا ہے: پرنٹ میں صرف اس کا عنوان آئے گا۔',
  printEveryPart: 'سب پرنٹ کریں',
  deletePage: 'صفحہ حذف کریں',
  deleteSection: 'حصہ حذف کریں',
  neverShows: (name, field, value) =>
    `${q(name)} صرف تب دکھایا جاتا ہے جب ${field} ${q(value)} ہو، لیکن ${field} میں اب یہ اختیار نہیں، اس لیے یہ کبھی نظر نہیں آتا۔`,
  neverHolds: (name, field, value) =>
    `${q(name)}: قاعدہ ${q(`${field} ${value} کے برابر ہے`)} کبھی پورا نہیں ہو سکتا، کیونکہ ${field} میں اب یہ اختیار نہیں۔`,
  removeTheRule: 'قاعدہ ہٹائیں',
  twoQuestions: (label) => `دو سوالوں کا متن ${q(label)} ہے: لوگ شاید ان میں فرق نہ کر سکیں۔`,
  twoFields: (label) => `دو فیلڈز کا متن ${q(label)} ہے: لوگ شاید ان میں فرق نہ کر سکیں۔`,
  renameSecond: 'دوسرے کا نام بدلیں',
  invalid: (path, _message) => (path ? `صفحے کا یہ حصہ درست نہیں: ${ltr(path)}` : 'صفحے میں کچھ ایسا ہے جو اس کے فارمیٹ کے مطابق نہیں۔'),
  showBracesAsWritten: 'قوسین ویسے ہی دکھائیں جیسے لکھے گئے',
  readsGone: (name, sentence, gone) =>
    `${q(name)}: ${q(sentence)} ${listOf('ur', gone, 'and')} کو پڑھتا ہے، جو اب صفحے پر ${gone.length === 1 ? 'نہیں ہے' : 'نہیں ہیں'}۔`,
  formulaBroken: (name, problem) => `${q(name)}: اس کا فارمولا اب پڑھا نہیں جا سکتا — ${problem}۔`,
  givesNothing: (name, sentence, problem) => `${q(name)}: ${q(sentence)} میں، ${problem} — یہ حصہ کچھ نہیں دیتا۔`,
  removeTheFormula: 'فارمولا ہٹائیں',
  setBroken: (name, sentence, problem) => `${q(name)}: ${q(sentence)} اب پڑھا نہیں جا سکتا — ${problem}۔`,
  setCannotHold: (name, sentence, problem) => `${q(name)}: ${q(sentence)} ایسی قدر مقرر کرتا ہے جو اس میں نہیں آ سکتی — ${problem}۔`,
  removeIt: 'اسے ہٹائیں',
  patternBroken: (name, pattern) => `${q(name)}: قاعدے کا پیٹرن ${ltr(pattern)} پڑھا نہیں جا سکتا۔`,
  asksNothing: (name) => `${q(name)}: ایک قاعدہ کچھ نہیں مانگتا، اس لیے کچھ نہیں جانچتا۔`,
  checksNothing: (name, sentence, stored) => `${q(name)}: قاعدہ ${q(sentence)} کچھ نہیں جانچتا، کیونکہ ${q(name)} کے ڈیٹا کی قسم ہے: ${stored}۔`,
};
