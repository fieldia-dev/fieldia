import type { DesignerWords } from '../../designer-words';
import { listOf } from '../speak';

/** The designer's words in Turkish: what people would trip over, as Checks lists it before publishing, and each fix's button. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker. */
export const checks: DesignerWords['checks'] = {
  noQuestions: 'Ankette henüz soru yok, yani yanıtlanacak bir şey yok.',
  noWords: (question, label) => `Bir ${question ? 'sorunun' : 'alanın'} henüz metni yok: kişiler “${label}” yazısını görecek.`,
  typeItsWords: 'Metnini yazın',
  defaultOptions: (label, options) => `“${label}” seçenek olarak hâlâ ${listOf('tr', options, 'and')} sunuyor.`,
  typeItsOptions: 'Seçeneklerini yazın',
  linkedPicture: 'Bağlantı olan bir görselin açıklaması yok: ekran okuyucu onu adsız bir bağlantı olarak okur.',
  picture: 'Bir görselin açıklaması yok: onu göremeyen kişilere onunla ilgili hiçbir şey söylenmez.',
  describeIt: 'Açıklayın',
  emptyPage: (name) => `“${name}” sayfasında soru yok: kişiler boş bir sayfa görür.`,
  emptySection: (name) => `“${name}” bölümünde alan yok: boş bir kutu olarak görünür.`,
  nothingOnPaper: 'Bu sayfanın tüm öğeleri çıktının dışında bırakılmış: çıktısında yalnızca başlığı olur.',
  printEveryPart: 'Hepsini yazdır',
  deletePage: 'Sayfayı sil',
  deleteSection: 'Bölümü sil',
  neverShows: (name, field, value) =>
    `“${name}” yalnızca ${field} alanı “${value}” olduğunda görünüyor; ${field} artık bu seçeneği sunmadığı için hiç görünmez.`,
  neverHolds: (name, field, value) => `“${name}”: “${field}: ${value}” kuralı hiçbir zaman sağlanamaz, çünkü ${field} artık bu seçeneği sunmuyor.`,
  removeTheRule: 'Kuralı kaldır',
  twoQuestions: (label) => `İki sorunun metni “${label}”: kişiler bunları ayırt edemeyebilir.`,
  twoFields: (label) => `İki alanın metni “${label}”: kişiler bunları ayırt edemeyebilir.`,
  renameSecond: 'İkincisini yeniden adlandır',
  invalid: (path, message) => (path ? `${path}: ${message}` : message),
  readsGone: (name, sentence, gone) =>
    `“${name}”: “${sentence}” ${gone.length === 1 ? 'şunu' : 'şunları'} okuyor: ${listOf('tr', gone, 'and')} — ${gone.length === 1 ? 'bu' : 'bunlar'} artık sayfada değil.`,
  formulaBroken: (name, problem) => `“${name}”: formülü artık okunamıyor — ${problem}.`,
  givesNothing: (name, sentence, problem) => `“${name}”: “${sentence}” içinde ${problem} — bu kısım hiçbir şey vermez.`,
  removeTheFormula: 'Formülü kaldır',
  setBroken: (name, sentence, problem) => `“${name}”: “${sentence}” artık okunamıyor — ${problem}.`,
  setCannotHold: (name, sentence, problem) => `“${name}”: “${sentence}” tutamayacağı bir değer atıyor — ${problem}.`,
  removeIt: 'Kaldır',
  patternBroken: (name, pattern) => `“${name}”: kuralın “${pattern}” kalıbı okunamıyor.`,
  asksNothing: (name) => `“${name}”: bir kural hiçbir şey istemiyor, bu yüzden hiçbir şeyi denetlemiyor.`,
  checksNothing: (name, sentence, stored) => `“${name}”: “${sentence}” kuralı hiçbir şeyi denetlemiyor, çünkü “${name}” alanında ${stored} saklanıyor.`,
};
