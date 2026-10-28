import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Urdu: Try it — the page working as people will use it, its bar, Find anything's ways in,
 * and the drawer of data and problems under it. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const tryIt: DesignerWords['tryIt'] = {
  design: 'ڈیزائن',
  tryIt: 'آزمائیں',
  modes: 'صفحہ ڈیزائن کریں یا آزمائیں',
  tryThePage: 'صفحہ آزمائیں',
  width: 'چوڑائی',
  sizes: { desktop: 'ڈیسک ٹاپ', tablet: 'ٹیبلیٹ', phone: 'فون' },
  note: 'صفحہ یہاں ویسے ہی کام کرتا ہے جیسے لوگ اسے استعمال کریں گے۔ یہاں لکھی گئی کوئی چیز محفوظ نہیں ہوتی۔',
  lastPassed: (why) => `«آزمائیں» صفحہ ویسا دکھاتا ہے جیسا آپ کی آخری تبدیلی سے پہلے تھا، جسے صفحہ قبول نہیں کرتا: ${why}`,
  language: 'زبان',
  wordsIn: 'متن کی زبان',
  backToDesigning: 'ڈیزائن پر واپس جائیں',
  asPeopleWillUseIt: 'جیسے لوگ اسے استعمال کریں گے',
  atPhoneWidth: 'فون کی چوڑائی پر آزمائیں',
  inArabic: 'عربی میں آزمائیں، دائیں سے بائیں',
  drawer: 'ڈیٹا اور مسائل',
  data: 'ڈیٹا',
  problems: 'مسائل',
  toAnswer: '{n} کا جواب باقی',
  copyData: 'ڈیٹا کاپی کریں',
  answersAsJson: 'جوابات JSON کی صورت میں',
  nothingInTheWay: 'اسے بھیجنے میں کوئی رکاوٹ نہیں۔',
  show: 'دکھائیں',
  hide: 'چھپائیں',
  copied: 'کاپی ہو گیا۔',
  selected: 'منتخب ہو گیا: اسے کی بورڈ سے کاپی کریں۔',
};
