import type { DesignerWords } from '../../designer-words';
import { listOf, plural, quoteAr } from '../speak';

/** The designer's words in Urdu: what a part is called when it has no words of its own — an arrangement by how its parts fall, a picture with no description. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker. */
export const parts: DesignerWords['parts'] = {
  page: 'صفحہ',
  column: 'کالم',
  columns: (n) => plural('ur', n, { one: '# کالم', other: '# کالم' }),
  sideBySide: 'ساتھ ساتھ',
  tabs: 'ٹیبز',
  image: 'تصویر',
  map: 'نقشہ',
  related: 'متعلقہ فہرست',
  divider: 'تقسیمی لکیر',
  spacer: 'خالی جگہ',
  untitledSection: 'بے عنوان حصہ',
  inTab: (tab, section) => `${tab} ‹ ${section}`,
  quote: (name) => quoteAr(name),
  and: (names) => listOf('ur', names, 'and'),
  commaList: (names) => names.join('، '),
  shares: { whole: 'پوری قطار', threeQuarters: 'قطار کا تین چوتھائی', twoThirds: 'قطار کا دو تہائی', half: 'آدھی قطار', third: 'قطار کا ایک تہائی', quarter: 'قطار کا ایک چوتھائی' },
  percentOfRow: (n) => `قطار کا ${n}%`,
};
