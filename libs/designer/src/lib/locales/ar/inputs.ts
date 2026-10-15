import type { DesignerWords } from '../../designer-words';
import { ltr, quoteAr } from '../speak';

export const inputs: DesignerWords['inputs'] = {
  settingRange: (setting, min, max) => `${setting}: عدد صحيح من ${min} إلى ${max}`,
  settingNumberRange: (setting, min, max) => `${setting}: رقم من ${min} إلى ${max}`,
  settingAtLeast: (setting, min) => `${setting}: عدد صحيح، ${min} أو أكثر`,
  settingMoreThan: (setting, min) => `${setting}: أكبر من ${min}`,
  settingFewer: (setting, n) => `${setting}: أقل من عدد الخيارات (${n})`,
  settingNeedsNumber: (setting) => `${setting}: يلزم رقم`,
  settingDateRefused: (setting) => `${setting}: لا يقبل هذا التاريخ في هذه الصفحة`,
  settingStays: (value) => `تبقى القيمة ${value}.`,
  settingSetTo: (setting, min, max, value) => `${setting}: من ${min} إلى ${max}، فضُبط على ${value}`,
  formulaKept: (problem, formula) => `لم تُعتمد بعد: ${problem}. تبقى الصفحة على ${ltr(formula)}.`,
  formulaNone: (problem) => `لم تُعتمد بعد: ${problem}. لا صيغة في الصفحة حتى تصح هذه.`,
  formulaPoint: 'في الصيغة تُكتب الفاصلة العشرية نقطةً أو ٫، مثل 1.5',
  trackRange: (track, min, max) => `${quoteAr(track)}: عرض العمود من ${min} إلى ${max} بكسل`,
};
