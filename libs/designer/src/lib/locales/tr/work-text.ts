import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

/**
 * The designer's words in Turkish: a work item's body in the designer — a group's own column widths and gap, its fold
 * control at the heading's end and its ⤢; help in a light box with an icon; a formatted text's toolbar, tools and
 * editors; a links box. Widths keep the forms people type (274px, 50%, 1fr). UNREVIEWED: machine-assisted, not yet
 * reviewed by a native speaker.
 */
export const workText: DesignerWords['workText'] = {
  columnWidths: 'Sütun genişlikleri',
  columnWidthsHint: 'Her sütun için bir tane, aralarında boşluk bırakarak: piksel (274px), satırın bir payı (50%) ya da kalanın bir payı (1fr). Boşsa sütunlar eşit olur.',
  gap: 'Sütunlar arası boşluk',
  gapHint: 'Piksel olarak, 0 ile 48 arası; boşsa görünümünki kullanılır.',
  foldControl: 'Katlama düğmesi',
  beforeTitle: 'Başlıktan önce',
  atHeadingEnd: 'Başlığın sonunda',
  maximise: 'Büyüt',
  maximiseHint: 'Başlığın sonundaki ⤢, grubu kaydın gövdesinin üzerinde tek başına gösterir.',
  tracksCount: (columns, widths) =>
    `Grubun ${plural('tr', columns, { one: '# sütunu', other: '# sütunu' })} ve ${plural('tr', widths, { one: '# genişliği', other: '# genişliği' })} var: her sütun için bir genişlik verin.`,
  noWidth: (track) => `“${track}” bir genişlik değil: piksel (274px), satırın bir payı (50%) ya da kalanın bir payı (1fr) yazın.`,
  gapRange: 'Sütunlar arası boşluk, 0 ile 48 arasında tam sayı bir piksel değeridir.',
  foldNeedsFolding: 'Önce katlamayı açın: katlama düğmesinin yeri, katlanan bir gruba aittir.',
  maximiseNeedsTitle: 'Önce gruba bir başlık verin: başlığından büyütülür.',
  noIconHere: 'Yalnızca yardım kutusundaki metnin simgesi olur.',
  helpBox: 'Yardım kutusu',
  helpBoxTitle: 'Bir iş öğesinin yardımı gibi, simgeye yer olan açık renkli bir kutuda; içindeki [metin](https://…) bağlantıdır',
  icon: 'Simge',
  noIcon: 'Simge yok',
  toolbarShown: 'Araç çubuğu',
  always: 'Her zaman',
  whileWorkedIn: 'Üzerinde çalışılırken',
  never: 'Hiçbir zaman',
  toolbarAt: 'Araç çubuğunun yeri',
  atTop: 'Üstte',
  atFoot: 'Altta',
  editor: 'Düzenleyici',
  richText: 'Zengin metin',
  markdown: 'Markdown',
  switchEditor: 'Kişiler düzenleyiciler arasında geçiş yapabilir',
  readFirst: 'Önce okunur, “Düzenle” düğmesiyle değiştirilir',
  tools: 'Araçlar',
  mentions: '@ ile anılan kişilerin kaynağı',
  mentionsPlaceholder: 'res.users',
  references: 'Bir anahtarla bağlanan kayıtlar',
  referenceKey: 'Anahtar',
  referenceModel: 'Veri modeli',
  referenceLabel: 'Ad',
  addReference: 'Kayıt türü ekle',
  removeReference: (key) => `${key} ile bağlanan kayıtları kaldır`,
  shownAs: 'Gösterim',
  tags: 'Çoklu seçim kutusu',
  linksBox: '“Bağlantı ekle” düğmeli bağlantılar',
  addWay: 'Bağlantı ekle',
  addMenu: 'Bir menü: “Mevcut öğe” ya da “Yeni öğe”',
  addSearch: 'Hemen arar',
  addWords: 'Metni',
  helpWords: 'Boşken yardım metni',
  helpIcon: 'Yardımın simgesi',
  helpTiled: 'Kutucuk üzerinde simge',
  helpTile: 'Kutucuğun rengi',
  emptyLink: 'Boş kutuda bir bağlantı',
};
