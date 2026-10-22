import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

/** A count of parts: Turkish keeps the noun singular after a number ("3 öğe"). */
const parts = (n: number) => plural('tr', n, { one: '# öğe', other: '# öğe' });
const rules = (n: number) => plural('tr', n, { one: '# kural', other: '# kural' });
/** Where a part already is, said of one part or of several (the verb takes -ler / -lar for several). */
const at = (one: boolean, place: string, top: boolean) => `Zaten ${place} en ${top ? (one ? 'üstünde' : 'üstündeler') : one ? 'altında' : 'altındalar'}`;

/** The designer's words in Turkish: the outline — the page's parts as a tree, each row named with its kind, and what moving rows by drag or by key says. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker. */
export const outline: DesignerWords['outline'] = {
  label: 'Ana hat',
  tree: 'Sayfanın öğeleri',
  empty: 'Sayfada henüz bir şey yok.',
  help: (survey) =>
    `${survey ? 'Sayfalar ve soruları. Taşımak için bir satırı sürükleyin.' : 'Taşımak için bir satırı sürükleyin; bir grubun içine bırakmak için ortasına sürükleyin.'} {⇧} ile tıklamak birkaç satır seçer; {Alt} ve bir ok tuşu seçili olanı taşır; {?} tüm tuşları listeler.`,
  ruled: (survey) => (survey ? 'yalnızca bazı yanıtlar için gösterilir' : 'yalnızca bazı kayıtlar için gösterilir'),
  ruledTitle: (survey) => (survey ? 'Yalnızca bazı yanıtlar için gösterilir' : 'Yalnızca bazı kayıtlar için gösterilir'),
  required: 'zorunlu',
  requiredTitle: 'Zorunlu',
  rowWords: (items) => items.join(', '),
  kinds: {
    custom: 'Özel',
    sideBySide: 'Yan yana',
    group: 'Grup',
    tabs: 'Sekmeler',
    tabCount: (n) => plural('tr', n, { one: '# sekme', other: '# sekme' }),
    tab: 'Sekme',
    untitledTab: 'Adsız sekme',
    page: 'Sayfa',
    untitledPage: 'Adsız sayfa',
    column: 'Sütun',
    statusSteps: 'Durum adımları',
    status: 'Durum',
    button: 'Düğme',
    counter: 'Sayaç',
    badge: 'Rozet',
    heading: 'Başlık',
    note: 'Not',
    words: 'Metin',
    divider: 'Çizgi',
    spacer: 'Boşluk',
    image: 'Görsel',
    map: 'Harita',
    related: 'İlişkili liste',
    slot: 'Uygulama yuvası',
    form: 'Kayıtlı form',
    part: 'Öğe',
  },
  columnsStacked: (n) => `${plural('tr', n, { one: '# sütun', other: '# sütun' })}; küçük ekranlarda kaplamanın yaptığı gibi alt alta dizilir`,
  columnsAt: (desktop, tablet, phone) => {
    const on = (n: number | undefined, screen: string) => (n === undefined ? `${screen}: kaplamanın dizdiği gibi` : `${screen}: ${n}`);
    return `Sütunlar — ${on(desktop, 'masaüstü')}, ${on(tablet, 'tablet')}, ${on(phone, 'telefon')}`;
  },
  it: 'Bu öğe',
  part: 'Öğe',
  parts,
  tookOff: (what) => `${typeof what === 'number' ? parts(what) : what} sayfadan kaldırıldı`,
  notTakenOff: 'Kaldırılmadı',
  notMoved: 'Taşınmadı',
  notHere: 'Buraya olmaz',
  stays: (one) => (one ? 'olduğu yerde' : 'oldukları yerde'),
  before: (name) => `${name} öğesinden önce`,
  after: (name) => `${name} öğesinden sonra`,
  into: (into, before) => `${into === null ? 'sayfaya' : `${into} öğesinin içine`}, ${before === null ? 'sona' : `${before} öğesinden önce`}`,
  pickToMove: 'Taşımak için bir öğe seçin',
  tabNotInTab: 'Bir sekme öğeleri içerir, başka sekmeleri değil',
  tabAmongItsTabs: 'Bir sekme yalnızca kendi sekmeleri arasında taşınır',
  tabAmongTabs: 'Bir sekme sekmelerin arasına konur: arkasına yapıştırmak için bir sekme seçin',
  inOneOfTheTabs: 'Sekmelerden birine koyun',
  pageNotInPage: 'Bir sayfa soruları içerir, başka sayfaları değil',
  questionOnPage: 'Bir soru bir sayfaya konur',
  notInsideItself: 'Bir öğe kendi içine konamaz',
  holdsNoParts: (name) => `${name} öğe içermez`,
  sameGroup: 'Birlikte taşımak için aynı gruptaki öğeleri seçin',
  atEdgeOfPage: (one, end) => at(one, 'sayfanın', end === 'top'),
  atEdgeOfSurvey: (one, end) => at(one, end === 'bottom' ? 'son sayfanın' : 'ilk sayfanın', end === 'top'),
  atEdgeOf: (one, end, name, arrow) => `${at(one, `${name} öğesinin`, end === 'top')}: Alt+${arrow} ${one ? 'onu' : 'onları'} dışarı çıkarır`,
  onPageItself: (one) => (one ? 'Sayfanın kendisinde, hiçbir grupta değil' : 'Sayfanın kendisindeler, hiçbir grupta değiller'),
  noGroupBefore: (one) => (one ? 'Önünde içine konabileceği bir grup yok' : 'Önlerinde içine konabilecekleri bir grup yok'),
  keys: [
    ['↑ / ↓', 'Önceki ya da sonraki satıra git'],
    ['← / →', 'Bir satırı katla ya da aç, ya da içinde bulunduğu satıra veya ilk öğesine git'],
    ['Home / End', 'İlk ya da son satıra git'],
    ['Bir harf', 'Adı o harfle başlayan sonraki satıra git'],
    ['Enter', 'Seç ve sayfada göster'],
    ['Boşluk', 'Seç (⌘ ya da Ctrl ile seçili olanlara ekler)'],
    ['Shift+↑ / ↓', 'Aradaki satırları da seç'],
    ['Shift + tıklama', 'Seçili satırdan bu satıra kadar tüm satırları seç'],
    ['⌘ + tıklama', 'Bir satır daha seç ya da seçimini kaldır (Windows’ta Ctrl + tıklama)'],
    ['Alt+↑ / Alt+↓', 'Seçili olanı üstündeki satırın önüne ya da altındaki satırın arkasına taşı'],
    ['Alt+← / Alt+→', 'Seçili olanı grubundan çıkar ya da önündeki gruba koy'],
    ['Delete', 'Seçili olanı sayfadan kaldır'],
  ],
};

export const clipboard: DesignerWords['clipboard'] = {
  keys: [
    ['⌘C', 'Seçili olanı buraya ya da başka bir tasarımcıya yapıştırmak için kopyala'],
    ['⌘X', 'Seçili olanı kes'],
    ['⌘V', 'Seçili olanın arkasına ya da seçili grubun içine yapıştır'],
  ],
  part: 'öğe',
  parts,
  copied: (what) => `Kopyalandı: ${what}`,
  cut: (what) => `Kesildi: ${what}`,
  copiedNotCut: 'Kopyalandı, ancak sayfadan kaldırılmadı',
  nothingPasted: 'Hiçbir şey yapıştırılmadı',
  pasted: (what, dropped) =>
    `Yapıştırıldı: ${what}${dropped ? `; ${rules(dropped)} dışarıda bırakıldı: bu sayfada olmayan bir alanı okuyor` : ''}`,
  nothingToPaste: 'Yapıştırılacak Fieldia öğesi yok: önce bir Fieldia tasarımcısında öğeleri kopyalayın',
  listTakesColumns: 'Bir liste öğe değil, sütun alır: bunları bir ekrana ya da ankete yapıştırın',
  pagesOrQuestions: 'Sayfaları ya da soruları yapıştırın, ikisini birden değil',
  surveyPages: 'Bir anketin sayfaları bir ankete konur',
};
