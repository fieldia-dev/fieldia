import type { DesignerWords } from '../../designer-words';
import { listOf, plural } from '../speak';

/** The designer's words in Turkish: what a part is called when it has no words of its own — an arrangement by how its parts fall, a picture with no description. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker. */
export const parts: DesignerWords['parts'] = {
  page: 'Sayfa',
  column: 'Sütun',
  columns: (n) => plural('tr', n, { one: '# sütun', other: '# sütun' }),
  sideBySide: 'Yan yana',
  tabs: 'Sekmeler',
  image: 'Görsel',
  map: 'Harita',
  related: 'İlişkili liste',
  divider: 'Ayırıcı',
  spacer: 'Boşluk',
  untitledSection: 'Adsız bölüm',
  inTab: (tab, section) => `${tab} › ${section}`,
  quote: (name) => `“${name}”`,
  and: (names) => listOf('tr', names, 'and'),
  commaList: (names) => names.join(', '),
  shares: { whole: 'satırın tamamı', threeQuarters: 'satırın dörtte üçü', twoThirds: 'satırın üçte ikisi', half: 'satırın yarısı', third: 'satırın üçte biri', quarter: 'satırın dörtte biri' },
  percentOfRow: (n) => `satırın %${n} kadarı`,
};
