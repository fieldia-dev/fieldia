/**
 * The designer's words in Farsi: what a part is called when it has no words of its own — an arrangement by how its
 * parts fall, a picture with no description. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
import type { DesignerWords } from '../../designer-words';
import { listOf, plural, quoteAr } from '../speak';

export const parts: DesignerWords['parts'] = {
  page: 'صفحه',
  column: 'ستون',
  columns: (n) => plural('fa', n, { one: '# ستون', other: '# ستون' }),
  sideBySide: 'کنار هم',
  tabs: 'زبانه‌ها',
  image: 'تصویر',
  map: 'نقشه',
  related: 'فهرست مرتبط',
  divider: 'جداکننده',
  spacer: 'فاصله‌گذار',
  untitledSection: 'بخش بی‌عنوان',
  inTab: (tab, section) => `${tab} ‹ ${section}`,
  quote: (name) => quoteAr(name),
  and: (names) => listOf('fa', names, 'and'),
  commaList: (names) => names.join('، '),
  shares: { whole: 'تمام ردیف', threeQuarters: 'سه‌چهارم ردیف', twoThirds: 'دوسوم ردیف', half: 'نیمی از ردیف', third: 'یک‌سوم ردیف', quarter: 'یک‌چهارم ردیف' },
  percentOfRow: (n) => `${n}% ردیف`,
};
