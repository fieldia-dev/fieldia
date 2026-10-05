import type { DesignerWords } from '../../designer-words';
import { quoteAr } from '../speak';

export const options: DesignerWords['options'] = {
  addOption: 'إضافة خيار',
  addOther: 'إضافة «غير ذلك»',
  or: 'أو',
  removeOther: 'إزالة «غير ذلك»',
  other: 'غير ذلك…',
  addNone: 'إضافة «لا شيء مما سبق»',
  removeOption: 'إزالة الخيار',
  removeNamed: (label) => `إزالة الخيار ${quoteAr(label)}`,
  option: (n) => `الخيار ${n}`,
  grip: 'اسحب للنقل · Alt+↑ أو ↓ ينقله أيضًا',
  alone: 'يُختار وحده',
};
