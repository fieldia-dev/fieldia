import type { DesignerWords } from '../../designer-words';
import { ltr, quoteAr } from '../speak';

/**
 * The designer's words in Urdu: what the designer says of a setting typed into one of its own boxes that it cannot
 * take — out of range, not a number, half-typed — and of a formula that does not read yet.
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const inputs: DesignerWords['inputs'] = {
  settingRange: (setting, min, max) => `${setting}: ${min} سے ${max} تک کا مکمل عدد`,
  settingNumberRange: (setting, min, max) => `${setting}: ${min} سے ${max} تک کا عدد`,
  settingAtLeast: (setting, min) => `${setting}: مکمل عدد، ${min} یا اس سے زیادہ`,
  settingMoreThan: (setting, min) => `${setting}: ${min} سے زیادہ`,
  settingFewer: (setting, n) => `${setting}: اختیارات کی تعداد (${n}) سے کم`,
  settingNeedsNumber: (setting) => `${setting}: ایک عدد درکار ہے`,
  settingDateRefused: (setting) => `${setting}: اس صفحے پر یہ تاریخ نہیں ہو سکتی`,
  settingStays: (value) => `قدر ${value} ہی رہے گی۔`,
  settingSetTo: (setting, min, max, value) => `${setting}: ${min} سے ${max} تک، اس لیے اسے ${value} کر دیا گیا`,
  formulaKept: (problem, formula) => `ابھی نافذ نہیں: ${problem}۔ صفحہ ${ltr(formula)} برقرار رکھتا ہے۔`,
  formulaNone: (problem) => `ابھی نافذ نہیں: ${problem}۔ جب تک یہ فارمولا درست نہ ہو، صفحے پر کوئی فارمولا نہیں۔`,
  formulaPoint: 'فارمولے میں اعشاری علامت نقطہ یا ٫ ہوتی ہے، جیسے 1.5',
  trackRange: (track, min, max) => `${quoteAr(track)}: کالم کی چوڑائی ${min} سے ${max} پکسل تک ہوتی ہے`,
};
