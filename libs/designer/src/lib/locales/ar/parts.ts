import type { DesignerWords } from '../../designer-words';
import { listOf, plural, quoteAr } from '../speak';

export const parts: DesignerWords['parts'] = {
  page: 'الصفحة',
  column: 'عمود',
  columns: (n) => plural('ar', n, { zero: '# أعمدة', one: 'عمود واحد', two: 'عمودان', few: '# أعمدة', many: '# عمودًا', other: '# عمود' }),
  sideBySide: 'جنبًا إلى جنب',
  tabs: 'علامات تبويب',
  image: 'صورة',
  divider: 'خط فاصل',
  spacer: 'مسافة',
  untitledSection: 'قسم بلا عنوان',
  inTab: (tab, section) => `${tab} ‹ ${section}`,
  quote: (name) => quoteAr(name),
  and: (names) => listOf('ar', names, 'and'),
  commaList: (names) => names.join('، '),
  shares: { whole: 'الصف كله', threeQuarters: 'ثلاثة أرباع الصف', twoThirds: 'ثلثا الصف', half: 'نصف الصف', third: 'ثلث الصف', quarter: 'ربع الصف' },
  percentOfRow: (n) => `${n}% من الصف`,
};
