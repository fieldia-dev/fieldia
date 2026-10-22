/**
 * The designer's words in Farsi: what the designer says of a setting typed into one of its own boxes that it cannot
 * take — out of range, not a number, half-typed — and of a formula that does not read yet. UNREVIEWED: machine-assisted,
 * not yet reviewed by a native speaker.
 */
import type { DesignerWords } from '../../designer-words';
import { ltr, quoteAr } from '../speak';

export const inputs: DesignerWords['inputs'] = {
  settingRange: (setting, min, max) => `${setting}: عدد صحیحی از ${min} تا ${max}`,
  settingNumberRange: (setting, min, max) => `${setting}: عددی از ${min} تا ${max}`,
  settingAtLeast: (setting, min) => `${setting}: عدد صحیح، ${min} یا بیشتر`,
  settingMoreThan: (setting, min) => `${setting}: بیشتر از ${min}`,
  settingFewer: (setting, n) => `${setting}: کمتر از تعداد گزینه‌ها (${n})`,
  settingNeedsNumber: (setting) => `${setting}: به یک عدد نیاز دارد`,
  settingDateRefused: (setting) => `${setting}: در این صفحه نمی‌تواند این تاریخ باشد`,
  settingStays: (value) => `همان ${value} می‌ماند.`,
  settingSetTo: (setting, min, max, value) => `${setting}: از ${min} تا ${max}، پس روی ${value} تنظیم شد`,
  formulaKept: (problem, formula) => `هنوز اعمال نشده: ${problem}. صفحه ${ltr(formula)} را نگه می‌دارد.`,
  formulaNone: (problem) => `هنوز اعمال نشده: ${problem}. تا این فرمول درست خوانده نشود، صفحه فرمولی ندارد.`,
  formulaPoint: 'در فرمول، ممیز اعشار نقطه یا ٫ است، مانند 1.5',
  trackRange: (track, min, max) => `${quoteAr(track)}: پهنای ستون ${min} تا ${max} پیکسل است`,
};
