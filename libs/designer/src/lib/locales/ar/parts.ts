import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

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
};
