import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Turkish: the words the designer writes into a page as a part is made — a new question's
 * label, its first option, a new page's or section's name. UNREVIEWED: machine-assisted, not yet reviewed by a native
 * speaker.
 */
export const defaults: DesignerWords['defaults'] = {
  untitledQuestion: 'Adsız soru',
  option: (n) => `Seçenek ${n}`,
  row: (n) => `Satır ${n}`,
  column: (n) => `Sütun ${n}`,
  page: (n) => `Sayfa ${n}`,
  section: (n) => `Bölüm ${n}`,
  tab: (n) => `Sekme ${n}`,
  name: 'Ad',
  description: 'Açıklama',
  quantity: 'Miktar',
  draft: 'Taslak',
  confirmed: 'Onaylandı',
  done: 'Tamamlandı',
  newButton: 'Yeni düğme',
  counter: 'Sayaç',
  newMenuAction: 'Yeni eylem',
  newSubmenu: 'Yeni menü',
  newReport: 'Rapor',
  badge: 'Rozet',
  ribbon: 'Şerit',
  alert: 'Bu kayıtla ilgili bilinmesi gereken bir şey.',
  noneOfThese: 'Hiçbiri',
  newGroup: 'Yeni grup',
  newMap: 'Harita',
  you: 'Siz',
  left: 'Sol',
  right: 'Sağ',
  first: 'Birinci',
  second: 'İkinci',
  newHeading: 'Yeni başlık',
  helpText: 'Bunu doldurmaya yardımcı olacak birkaç söz.',
  button: 'Düğme',
  npsStart: 'Hiç olası değil',
  npsEnd: 'Son derece olası',
  priorityNone: 'Normal',
  priorityLevels: ['Yüksek', 'Çok yüksek'],
  dotStates: ['Devam ediyor', 'Engellendi', 'Hazır'],
};
