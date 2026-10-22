import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

/**
 * The designer's words in Turkish: the page as JSON — its view, the state of the text, what each problem is, and the
 * mistakes a person makes typing JSON. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const json: DesignerWords['json'] = {
  pageAsJson: 'JSON biçiminde sayfa',
  copyJson: 'JSON’u kopyala',
  apply: 'Uygula',
  discard: 'Değişiklikleri at',
  keepEditing: 'Düzenlemeye devam et',
  notApplied: 'Burada yazılan değişiklikler henüz uygulanmadı.',
  problems: 'Sorunlar',
  hint: (chord) => `Tab girinti ekler. Kutudan çıkmak için Esc’ye, ardından Tab’a basın. ${chord}Enter değişiklikleri uygular.`,
  severity: { error: 'Uygulanamaz', must: 'Düzeltilmesi gerekir', should: 'Düzeltilmesi önerilir' },
  goToLine: (line, column) => `Şuraya git: satır ${line}, sütun ${column}`,
  line: (line) => `Satır ${line}`,
  toPutRight: (n) => `Uygulanabilmesi için önce düzeltilmesi gereken ${plural('tr', n, { one: '# sorun', other: '# sorun' })} var.`,
  changed: (chord) => `Burada değişti, henüz uygulanmadı: “Uygula” düğmesine ya da ${chord}Enter tuşlarına basın.`,
  nothingToApply: 'Uygulanacak bir şey yok: metin, sayfanın şu anki hâli.',
  cannotFix: 'Bu düzeltme, metnin şu anki hâlinde yapılamaz.',
  fixed: 'Metinde düzeltildi. Korumak için uygulayın.',
  applied: 'Uygulandı. “Geri al” ile geri dönebilirsiniz.',
  copied: 'Kopyalandı.',
  selected: (chord) => `Seçildi: kopyalamak için ${chord}C tuşlarına basın.`,
  // The format's own words (from @fieldia/core) are English and technical, as its keys are: kept as written, said so.
  formatProblem: (message) => `Sayfa biçimi bunu kabul etmiyor: ${message}`,
  editAsJson: 'Sayfayı JSON olarak düzenle',
  backToDesigning: 'Tasarlamaya dön',
  mistakes: {
    anyValue: 'Bu, JSON’un tanıdığı bir değer değil: çift tırnak içinde metin, bir sayı, true, false, null, [ … ] ya da { … }',
    endsTooSoon: (wanted) => `Metin erken bitiyor: ${wanted}`,
    valueMissing: 'bir değer eksik',
    closingMissing: (close) => `kapatan bir ${close} eksik`,
    noComments: 'JSON yorum satırı kabul etmez',
    doubleQuotes: 'Metin çift tırnak içine yazılır',
    noClosingQuote: 'Bu metni kapatan çift tırnak yok',
    lineBreak: 'Metnin içinde satır sonu olamaz: \\n yazın',
    controlCharacter: 'Metnin içinde kontrol karakteri olamaz',
    escape: (escape) => `"\\${escape}" JSON’un tanıdığı bir şey değil: ters eğik çizgi için \\\\ yazın`,
    extraZeros: 'Bir sayı fazladan sıfırlarla başlayamaz',
    nothingAfterComma: 'Bu virgülden sonra bir şey gelmiyor: virgülü kaldırın',
    commaMissing: 'Bundan önce bir virgül eksik',
    commaOrClosing: (close) => `Burada bir virgül ya da kapatan bir ${close} eksik`,
    keyQuotes: (word) => `Anahtar çift tırnak içine yazılır, örneğin "${word}"`,
    colonMissing: 'Anahtardan sonra iki nokta üst üste eksik',
    empty: 'Kutu boş: sayfa bir JSON nesnesidir, { … }',
    moreAfterEnd: 'Sonun ardından devam eden metin var: sayfanın tamamı tek bir { … } olmalıdır',
  },
};
