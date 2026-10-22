import type { DesignerWords } from '../../designer-words';
import { quoteAr } from '../speak';

/** The designer's words in Urdu: a choice's options, typed in place: adding, “Other”, “None of these”, moving and removing them. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker. */
export const options: DesignerWords['options'] = {
  addOption: 'اختیار شامل کریں',
  addOther: '«دیگر» شامل کریں',
  or: 'یا',
  removeOther: '«دیگر» ہٹائیں',
  other: 'دیگر…',
  addNone: '«ان میں سے کوئی نہیں» شامل کریں',
  removeOption: 'اختیار ہٹائیں',
  removeNamed: (label) => `اختیار ${quoteAr(label)} ہٹائیں`,
  option: (n) => `اختیار ${n}`,
  grip: 'منتقل کرنے کے لیے گھسیٹیں · Alt+↑ یا ↓ سے بھی منتقل ہوتا ہے',
  alone: 'اکیلا منتخب ہوتا ہے',
  showWhen: 'تب دکھائیں جب…',
  shownWhen: 'تب دکھایا جاتا ہے جب',
  showOptionWhen: 'یہ اختیار دکھائیں',
  whenOptionShows: 'یہ اختیار کب دکھایا جائے',
};
