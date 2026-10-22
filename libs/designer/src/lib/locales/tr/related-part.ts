import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Turkish: a related list on a record's page, in the designer — its tile, its panel (its
 * title, the records it lists and their link to this one, its columns, its cards on a phone, rows a page, New and
 * View all) and the words its new one starts with. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const relatedPart: DesignerWords['relatedPart'] = {
  tile: 'İlişkili liste',
  tileTip: 'Bu kayda işaret eden başka türden kayıtlar, bunun içinde listelenir: bir müşterinin faturaları, bir mülkün gösterimleri',
  newTitle: 'İlişkili kayıtlar',
  name: 'Ad',
  title: 'Başlık',
  model: 'Kayıtların veri modeli',
  modelHint: 'Veri kaynağınızın adlandırdığı şekliyle veri modelleri: invoice, sale.order.',
  field: 'Bu kayda bağlantıları',
  fieldHint: (model) => `Onların ${model} kaydına işaret eden bir alanı: partner_id. Liste, bağlantısı bu kayıt olanları gösterir.`,
  columns: 'Sütunlar',
  columnName: (n) => `Sütun ${n}: alanı`,
  columnLabel: (n) => `Sütun ${n}: metni`,
  columnKind: (n) => `Sütun ${n}: türü`,
  kinds: { char: 'Metin', integer: 'Tam sayı', float: 'Sayı', monetary: 'Tutar', date: 'Tarih', datetime: 'Tarih ve saat', boolean: 'Evet veya hayır', selection: 'Seçim', many2one: 'Bağlantı', text: 'Uzun metin' },
  removeColumn: (label) => `${label} sütununu kaldır`,
  addColumn: 'Sütun ekle',
  newColumn: (n) => `Sütun ${n}`,
  lastColumn: 'İlişkili liste en az bir sütun gösterir.',
  rows: 'Sayfa başına satır',
  rowsHint: 'Belirtilmedikçe 5: bu sayı aşılınca sayfalama ve arama görünür.',
  newWord: 'Yeni',
  create: 'Bu kayda bağlantısı doldurulmuş bir kayıt oluşturan “Yeni” düğmesini sun',
  createHint: 'Uygulamanızın onların veri modeli için verdiği sayfanın bir iletişim kutusunda; hiç sayfa vermediği yerde “Yeni” sunulmaz.',
  viewAll: '“Tümünü gör” şu sayfayı açar',
  viewAllHint: 'Uygulamanızın onlara ait listesi, kimliğiyle; yalnızca bu kaydınkileri gösterir. Boş: “Tümünü gör” yok.',
  opensIn: '“Tümünü gör” şurada açılır',
  opens: { dialog: 'İletişim kutusu', panel: 'Yan panel', page: 'Yerinde' },
  rowsOpen: 'Satırlar ve “Yeni” şurada açılır',
  rowsOpenHint: 'Uygulamanızın kendi yolu: önce onun onOpen işlevine, kaydın sayfası ve kimliğiyle ya da yeni kaydın bu kayda bağlantısıyla sorulur; bunu üstlenmediği yerde bir iletişim kutusu.',
  rowsOpenIn: { dialog: 'İletişim kutusu', app: 'Uygulamanızın yolu' },
  onlyOnRecords: 'İlişkili liste bir kayıt sayfasına aittir: bu sayfa yanıt topluyor.',
  noModel: 'Listelediği kayıtların veri modelini, veri kaynağınızın adlandırdığı gibi yazın.',
  notAName: (name) => `“${name}” bir alan adı değil: harf, rakam ve _ içerir, rakamla başlamaz`,
  columnTwice: (name) => `“${name}” zaten bir sütun`,
  cards: 'Telefonda kartlar',
  notTheirs: (name) => `“${name}”, kayıtlarının alanlarından biri değil: önce sütun olarak ekleyin`,
  previewNote: 'Kayıtları, kayıt kaydedildikten sonra “Dene” modunda görünür.',
  more: (n) => `Kendi JSON’unda ${n} ayar daha: bir filtre, bir sıralama, hücreleri`,
};
