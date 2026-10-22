/**
 * The designer's words in Farsi: a choice's options, typed in place — adding, «سایر», «هیچ‌کدام از این‌ها», moving and
 * removing them. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
import type { DesignerWords } from '../../designer-words';
import { quoteAr } from '../speak';

export const options: DesignerWords['options'] = {
  addOption: 'افزودن گزینه',
  addOther: 'افزودن «سایر»',
  or: 'یا',
  removeOther: 'برداشتن «سایر»',
  other: 'سایر…',
  addNone: 'افزودن «هیچ‌کدام از این‌ها»',
  removeOption: 'برداشتن گزینه',
  removeNamed: (label) => `برداشتن گزینهٔ ${quoteAr(label)}`,
  option: (n) => `گزینهٔ ${n}`,
  grip: 'برای جابه‌جا کردن بکشید · Alt+↑ یا ↓ نیز آن را جابه‌جا می‌کند',
  alone: 'به‌تنهایی انتخاب می‌شود',
  showWhen: 'نمایش در صورتی که…',
  shownWhen: 'نمایش در صورتی که',
  showOptionWhen: 'نمایش این گزینه',
  whenOptionShows: 'زمان نمایش این گزینه',
};
