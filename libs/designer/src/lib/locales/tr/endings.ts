import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

/**
 * The designer's words in Turkish: a form's endings — what people see once they send it, the first whose condition
 * holds — and the button beside a box of words that puts an answer in them (`{name}`). An ending is named by its
 * ordinal ("2. bitiş ekranı") wherever a suffix would follow its number. UNREVIEWED: machine-assisted, not yet
 * reviewed by a native speaker.
 */
export const endings: DesignerWords['endings'] = {
  heading: 'Gönderildikten sonra',
  hint: 'Kişilerin yanıtlarını gönderdikten sonra gördüğü: koşulu sağlanan ilk bitiş ekranı, yoksa diğer durumlarda gösterilen. {name} bir yanıtı kişilerin okuduğu gibi gösterir; {id} ise uygulamanızın yanıta verdiği referansı.',
  ending: (n) => `Bitiş ekranı ${n}`,
  otherwise: 'Diğer durumlarda gösterilir',
  lead: 'Bu bitiş ekranını göster',
  conditionFor: (n) => `${n}. bitiş ekranı ne zaman gösterilir`,
  title: 'Başlık',
  titleFor: (n) => `${n}. bitiş ekranının başlığı`,
  text: 'Metin',
  textFor: (n) => `${n}. bitiş ekranının metni`,
  textHint: 'Ayrı bir satır bir paragraftır; [metin](https://…) bir bağlantıdır.',
  again: 'Yeniden başlatma düğmesi',
  againFor: (n) => `${n}. bitiş ekranının düğmesi`,
  againHint: 'Boş: “Başka bir yanıt gönder”.',
  noAgain: 'Düğme yok',
  noAgainFor: (n) => `${n}. bitiş ekranında düğme yok`,
  add: 'Bitiş ekranı ekle',
  addNeedsQuestion: 'Başka bir bitiş ekranı, onu seçtirecek bir soru gerektirir: bir seçim sorusu ya da evet/hayır sorusu.',
  remove: (n) => `${n}. bitiş ekranını kaldır`,
  moveUp: (n) => `${n}. bitiş ekranını yukarı taşı`,
  moveDown: (n) => `${n}. bitiş ekranını aşağı taşı`,
  newTitle: 'Teşekkürler',
  plainThanks: 'Hiç yoksa kişiler “Teşekkür ederiz. Yanıtlarınız gönderildi.” mesajını görür.',
  forResponses: 'Bitiş ekranları yanıt toplayan bir form içindir: bir kaydın ekranı, kaydedildikten sonra kendi kaydında kalır',
  changed: (n) =>
    n
      ? `Gönderildikten sonra gösterilen değişti: ${plural('tr', n, { one: '# bitiş ekranı', other: '# bitiş ekranı' })}`
      : 'Gönderildikten sonra olağan teşekkür mesajını gösterir',
  insertAnswer: 'Yanıt yerleştir',
  insertAnswerIn: (box) => `Yanıt yerleştir: ${box}`,
  answersTitle: 'Yanıtı yerleştirilecek soru',
  reference: 'Uygulamanızın verdiği referans',
  noAnswers: 'Henüz yerleştirilecek bir yanıt veren soru yok.',
  whenEmpty: 'Boşken',
  whenEmptyHint: 'İsteğe bağlı: yanıtlanmamışken gösterilecek metin, örneğin “bu şube”',
};
