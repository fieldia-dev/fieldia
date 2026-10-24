import type { DesignerWords } from '../../designer-words';
import { intlFormat } from '@fieldia/core';

const q = (name: string) => `“${name}”`;
const DATE = intlFormat('DateTimeFormat', 'tr-u-nu-latn', { dateStyle: 'medium' });

/** The designer's words in Turkish: a saved form placed in another — the toolbox's tile and its menu, the frame on the canvas, its panel, what the Checks list and the edits say of it. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker. */
export const savedForms: DesignerWords['savedForms'] = {
  savedForm: 'Kayıtlı form',
  copy: (n) => (n === 1 ? 'Kayıtlı form' : `Kayıtlı form ${n}`),
  tile: 'Kayıtlı form',
  tileTip: 'Kayıtlı form: uygulamanın kayıtlı formlarından birini yerleştirin, örneğin bir adres',
  menuNote: (any) =>
    any ? 'Bütün olarak yerleştirilir, yanıtları ayrı tutulur; kendi sayfasında değiştirilir.' : 'Uygulamada yerleştirilecek kayıtlı form henüz yok: önce bir form yayımlayın.',
  add: 'Kayıtlı form ekle',
  hint: 'kayıtlı form',
  tag: (name, version) => `Kayıtlı form ${q(name)} · ${version === undefined ? 'en son sürüm' : `sürüm ${version}`}`,
  openIt: 'Formu aç',
  openTitle: (name) => `Değiştirmek için ${q(name)} formunu kendi sayfasında açın`,
  loading: (id) => `${q(id)} yükleniyor…`,
  cannotShow: (name, why) => `${q(name)} gösterilemiyor: ${why}`,
  version: 'Sürüm',
  title: 'Başlık',
  showTitle: 'Başlık göster',
  answersGoUnder: 'Yanıtların saklandığı ad',
  latest: 'En son sürüm',
  versionOn: (version, publishedAt) => `Sürüm ${version} · ${DATE.format(new Date(publishedAt))}`,
  versionOnly: (version) => `Sürüm ${version}`,
  notFound: (id) => `${id} (bulunamadı)`,
  openHint: 'Kayıtlı form kendi sayfasında değiştirilir: bir sürüme bağlı kalmadıkça, onu yerleştiren her form değişikliği izler.',
  versionHint: 'En son sürüm: yayımlanan her sürüm, yayımlanır yayımlanmaz burada görünür. Bağlı kalınan sürüm olduğu gibi kalır.',
  titleHint: 'Buraya metin yazılmadıkça kendi başlığı kullanılır.',
  answersHint: 'Yanıtları, ikinci bir kopyanınkilerden ayrı olarak bu adın altında saklanır: { "home": { "street": … } }.',
  noForm: (id) => `Bu sayfada ${q(id)} adlı kayıtlı form yok`,
  pickForm: 'Yerleştirilecek kayıtlı formu seçin',
  versionWhole: 'Sürüm, 1 ya da daha büyük bir tam sayıdır',
  answersName: (hint) => `Yanıtların saklandığı ad harf, rakam ve _ içerir ve bir harfle başlar: örneğin ${q(hint)}`,
  insideItself: 'Bir sayfa kendi içine yerleştirilemez',
  way: (titles) => titles.join(' → '),
  holdsThisPage: (name, way) => `${q(name)} bu sayfayı içeriyor: sayfa kendi içine yerleştirilmiş olur (${way})`,
  mixWithField: (name) => `Bir kayıtlı form yanıtlarını, bir alanın adı olan ${q(name)} altında saklıyor: yanıtlar karışır. Ona kendine ait bir ad verin.`,
  mixWithCopy: (name) => `İki kayıtlı form yanıtlarını ${q(name)} altında saklıyor: yanıtlar karışır. Her kopyaya kendine ait bir ad verin.`,
  placedInItself: 'Bu sayfa kendi içine yerleştirilmiş: form onu gösteremez.',
  cannotBeFound: (id) => `${q(id)} kayıtlı formu bulunamıyor: form, yerinde bunu belirtir.`,
  noVersion: (title, version) => `${q(title)} formunun ${version}. sürümü yok: form, bulunamadığını belirtir.`,
  notSections: (title) => `${q(title)} bölümlerden ya da sekmelerden oluşan bir form değil: başka bir forma yerleştirilemez.`,
  holdsThisPageCheck: (name, way) => `${q(name)} bu sayfayı içeriyor: sayfa kendi içine yerleştirilmiş olur (${way}).`,
  takeItOff: 'Sayfadan kaldır',
};
