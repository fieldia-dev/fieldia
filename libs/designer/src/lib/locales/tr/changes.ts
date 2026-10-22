import type { DesignerWords } from '../../designer-words';
import { plural } from '../speak';

/** A count, the noun singular after the number as Turkish has it: "3 sütun". */
const count = (n: number, noun: string) => plural('tr', n, { one: `# ${noun}`, other: `# ${noun}` });
const at = (where: string) => (where ? ` ${where}` : '');
/** A part after its name, in the compound form: “Genel” sekmesi. */
const PART = { page: 'sayfası', tab: 'sekmesi', section: 'bölümü' } as const;
const HEADER = { button: 'düğmesi', counter: 'sayacı', badge: 'rozeti', ribbon: 'şeridi', alert: 'uyarısı' } as const;
const LABELS: Record<string, string> = { above: 'kutularının üstünde', beside: 'kutularının yanında', hidden: 'kutularının içinde' };
/** A block's words at the start of a line: "bir ayırıcı" becomes "Bir ayırıcı". */
const cap = (words: string) => words.charAt(0).toLocaleUpperCase('tr') + words.slice(1);
const TWELFTHS = 'on ikilik ızgara';

/**
 * The designer's words in Turkish: what changed since the last version, line by line, as Publish lists it — a part
 * added, renamed, moved, a setting changed. Each line ends on its verb in the past (eklendi, kaldırıldı), so no name
 * takes a suffix. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const changes: DesignerWords['changes'] = {
  firstList: (columns) => `İlk sürüm: ${count(columns, 'sütun')}`,
  firstSurvey: (questions, pages) => `İlk sürüm: ${count(pages, 'sayfada')} ${count(questions, 'soru')}`,
  firstScreen: (fields, sections) => `İlk sürüm: ${count(sections, 'bölümde')} ${count(fields, 'alan')}`,
  title: (was, now) => `Başlık: “${was}” → “${now}”`,
  description: 'Açıklama değişti',
  addedPart: (kind, name, where) => `“${name}” ${PART[kind]}${at(where)} eklendi`,
  removedPart: (kind, name) => `“${name}” ${PART[kind]} kaldırıldı`,
  renamedPart: (kind, was, now) => `“${was}” ${PART[kind]} “${now}” olarak yeniden adlandırıldı`,
  showsForSome: (name, survey) => `“${name}” artık yalnızca bazı ${survey ? 'yanıtlarda' : 'kayıtlarda'} görünüyor`,
  alwaysShows: (name) => `“${name}” artık her zaman görünüyor`,
  whenShowsChanged: (name) => `“${name}”: ne zaman görüneceği değişti`,
  added: (name, where) => `“${name}”${at(where)} eklendi`,
  removed: (name) => `“${name}” kaldırıldı`,
  renamed: (was, now) => `“${was}”, “${now}” olarak yeniden adlandırıldı`,
  helpChanged: (name) => `“${name}”: yardım metni değişti`,
  nowRequired: (name) => `“${name}” artık zorunlu`,
  noLongerRequired: (name) => `“${name}” artık zorunlu değil`,
  nowKind: (name, kind) => `“${name}”: türü artık ${kind}`,
  nowOwnWay: (name) => `“${name}” artık kendine özgü biçimde gösteriliyor`,
  addedOption: (name, option) => `“${name}”: “${option}” seçeneği eklendi`,
  removedOption: (name, option) => `“${name}”: “${option}” seçeneği kaldırıldı`,
  optionsChanged: (name) => `“${name}”: seçenekleri değişti`,
  takesOther: (name) => `“${name}”: kişinin kendi yazdığı yanıtı kabul ediyor (“Diğer”)`,
  noOther: (name) => `“${name}”: artık kişinin kendi yazdığı yanıtı kabul etmiyor`,
  showsChanged: (name) => `“${name}”: gösterilme biçimi değişti`,
  moved: (name, to) => `“${name}”, “${to}” içine taşındı`,
  reorderedQuestions: (page) => `“${page}” sayfasındaki sorular yeniden sıralandı`,
  reorderedFields: (group) => `“${group}” içindeki alanlar yeniden sıralandı`,
  other: 'Sayfa ayarlarında başka değişiklikler',
  // ---- files
  filesTaken: (name) => `“${name}”: kabul ettiği dosyalar değişti`,
  severalFiles: (name) => `“${name}” artık birden çok dosya kabul ediyor`,
  oneFile: (name) => `“${name}” yeniden tek dosya kabul ediyor`,
  filesFromTo: (name, least, most) => `“${name}”: ${least} ile ${most} arasında dosya`,
  filesUpTo: (name, most) => `“${name}”: en fazla ${most} dosya`,
  filesAtLeast: (name, least) => `“${name}”: en az ${least} dosya`,
  filesAny: (name) => `“${name}”: herhangi bir sayıda dosya`,
  photosFromTo: (name, least, most) => `“${name}”: ${least} ile ${most} arasında fotoğraf`,
  photosUpTo: (name, most) => `“${name}”: en fazla ${most} fotoğraf`,
  photosAtLeast: (name, least) => `“${name}”: en az ${least} fotoğraf`,
  photosAny: (name) => `“${name}”: herhangi bir sayıda fotoğraf`,
  filesShownAs: (name, as) => `“${name}”: seçilen dosyalar ${{ list: 'liste', thumbnails: 'küçük resimler', cards: 'kartlar' }[as]} olarak gösteriliyor`,
  filesSwitch: (name, on) => `“${name}”: kişiler seçilen dosyaların gösterilme biçimini ${on ? 'değiştirebilir' : 'artık değiştiremez'}`,
  camera: (name, front) => `“${name}”: telefonlar ${front ? 'ön' : 'arka'} kamerayı sunuyor`,
  noCamera: (name) => `“${name}”: telefonlar artık kamerayı sunmuyor`,
  recorded: (name, what) => `“${name}”: sayfada ${what} kaydediliyor`,
  notRecorded: (name) => `“${name}”: sayfada artık hiçbir şey kaydedilmiyor`,
  recordingUpTo: (name, seconds) =>
    seconds ? `“${name}”: en fazla ${seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} dakika` : `${seconds} saniye`} uzunluğunda kayıt` : `“${name}”: olağan uzunlukta kayıt`,
  photosSmaller: (name, side, percent) => `“${name}”: fotoğraflar ${side} px boyutuna, %${percent} kaliteyle küçültülüyor`,
  photosAsTaken: (name) => `“${name}”: fotoğraflar çekildiği gibi saklanıyor`,
  photosUsual: (name) => `“${name}”: fotoğraflar olağan şekilde küçültülüyor`,
  photoCover: (name, on) => `“${name}”: ${on ? 'ilk fotoğraf kapak' : 'hiçbir fotoğraf kapak olarak işaretlenmiyor'}`,
  photoCaptions: (name, on) => `“${name}”: ${on ? 'her fotoğrafın altında bir alt yazı' : 'fotoğrafların altında alt yazı yok'}`,
  photoEdit: (name, on) => `“${name}”: fotoğraflar ${on ? 'kırpılıp döndürülebilir' : 'artık kırpılıp döndürülemez'}`,
  photoOriginal: (name, on) => `“${name}”: kırpılan fotoğraf ${on ? 'orijinalini saklıyor' : 'artık orijinalini saklamıyor'}`,
  photoShape: (name, shape) => `“${name}”: fotoğraflar ${shape ? `şu biçimde kırpılıyor: ${shape}` : 'herhangi bir biçimde kırpılıyor'}`,
  // ---- a sheet's header, a list
  addedHeader: (kind, label) => `“${label}” ${HEADER[kind]} eklendi`,
  removedHeader: (kind, label) => `“${label}” ${HEADER[kind]} kaldırıldı`,
  renamedHeader: (kind, was, now) => `“${was}” ${HEADER[kind]} “${now}” olarak yeniden adlandırıldı`,
  statusFrom: (label) => `Durum adımları “${label}” alanından`,
  noStatus: 'Durum adımları kaldırıldı',
  addedColumn: (label) => `“${label}” sütunu eklendi`,
  removedColumn: (label) => `“${label}” sütunu kaldırıldı`,
  reorderedColumns: 'Sütunlar yeniden sıralandı',
  rowsOnPage: (was, now) => `Sayfa başına satır: ${was} → ${now}`,
  listOrder: 'Listenin sıralaması değişti',
  searchLooks: 'Aramanın baktığı yerler değişti',
  addedFilter: (label) => `“${label}” filtresi eklendi`,
  removedFilter: (label) => `“${label}” filtresi kaldırıldı`,
  groupings: 'Gruplamalar değişti',
  addedButton: (label) => `“${label}” düğmesi eklendi`,
  removedButton: (label) => `“${label}” düğmesi kaldırıldı`,
  // ---- the layout
  beside: (name) => `${name} yanına`,
  under: (name) => `${name} altına`,
  above: (name) => `${name} üstüne`,
  grouped: (n, group) => `${count(n, 'öğe')} “${group}” içinde gruplandı`,
  madeTabs: (n, tabs) => `${count(n, 'sekme')} oluşturuldu: ${tabs}`,
  ungrouped: (group) => `“${group}” grubu çözüldü`,
  ungroupedTabs: (tabs) => `Sekmeler çözüldü: ${tabs}`,
  ungroupedArrangement: (parts) => `Grup çözüldü: ${parts}`,
  put: (parts, where) => `${parts} ${where} yerleştirildi`,
  putUnder: (parts) => `${parts} alt alta yerleştirildi`,
  putSide: (parts) => `${parts} yan yana yerleştirildi`,
  movedTo: (parts, to) => `${parts}, “${to}” içine taşındı`,
  block: {
    heading: (text) => `“${text}” başlığı`,
    words: (text) => `“${text}” metni`,
    button: (label) => `“${label}” düğmesi`,
    image: (alt) => `“${alt}” görseli`,
    anImage: 'bir görsel',
    map: (label) => `“${label}” haritası`,
    related: (label) => `“${label}” ilişkili listesi`,
    divider: 'bir ayırıcı',
    spacer: 'bir boşluk',
    form: (name) => `“${name}” kayıtlı formu`,
  },
  addedBlock: (block, where) => `${cap(block)}${at(where)} eklendi`,
  changedBlockTo: (block, text) => `${cap(block)} “${text}” olarak değiştirildi`,
  renamedButton: (was, now) => `“${was}” düğmesi “${now}” olarak yeniden adlandırıldı`,
  changedBlock: (block) => `${cap(block)} değiştirildi`,
  removedBlock: (block) => `${cap(block)} kaldırıldı`,
  twelfths: (name) => `${name}: satırlar on iki parçaya bölündü`,
  columns: (name, wide, medium, narrow) => {
    const n = (c: number) => (c === 12 ? TWELFTHS : count(c, 'sütun'));
    const smaller = [medium ? `tablette ${medium === 12 ? TWELFTHS : medium}` : '', narrow ? `telefonda ${narrow === 12 ? TWELFTHS : narrow}` : ''].filter(Boolean);
    return `${name}: ${smaller.length ? `masaüstünde ${n(wide)}, ${smaller.join(', ')}` : n(wide)}`;
  },
  gaps: (name, gaps) => `${name}: ${gaps ? 'satırlarda boşluk kalabilir' : 'satırlar dolu tutuluyor'}`,
  drawn: (name, style) =>
    `${name}: ${{ card: 'kart olarak çiziliyor', plain: 'kutusuz, düz çiziliyor', line: 'başlığının altında bir çizgiyle çiziliyor', framed: 'çerçeve içinde, başlığı çerçevenin üzerinde çiziliyor', inline: 'tek satırda, başlığı etiketi olarak çiziliyor' }[style]}`,
  folds: (name, fold) => `${name}: ${{ no: 'artık katlanmıyor', open: 'başlığından katlanıyor, açık başlıyor', folded: 'başlığından katlanıyor, katlı başlıyor' }[fold]}`,
  labels: (name, place) => `${name}: etiketler ${LABELS[place] ?? 'sayfanın koyduğu yerde'}`,
  labelWidth: (name, px) => `${name}: etiketler ${px ? `${px} px genişliğinde` : 'sayfadaki genişlikte'}`,
  share: (name, share) => `${name}: ${share}`,
  columnsWide: (name, n) => `${name}: ${count(n, 'sütun')} genişliğinde`,
  itsLabel: (name, place) => `${name}: etiketi ${({ above: 'kutusunun üstünde', beside: 'kutusunun yanında', hidden: 'kutusunun içinde' } as Record<string, string>)[place] ?? 'grubunun koyduğu yerde'}`,
  placeholder: (name) => `${name}: yer tutucu metni değişti`,
  filledIn: (name) => `${name}: tarayıcının otomatik doldurduğu değer değişti`,
  keyboard: (name) => `${name}: telefondaki klavyesi değişti`,
  botCheck: (now) => ({ on: 'Bot denetimi açık', off: 'Bot denetimi kapalı', changed: 'Bot denetimi değişti' })[now],
  printout: 'Çıktının üst bilgisi, alt bilgisi veya logosu değişti',
  duplicates: (now) => ({ on: 'Kayıtlar yazılırken olası yinelenen kayıtlar aranıyor', off: 'Olası yinelenen kayıtlar artık aranmıyor', changed: 'Olası yinelenen kayıtların aranma biçimi değişti' })[now],
  records: (other) => (other ? `Kayıtları Fieldia’nın cümlelerinde “${other}” olarak adlandırılıyor` : 'Kayıtları yeniden “kayıt” olarak adlandırılıyor'),
  smallLabels: (on) => (on ? 'Alan adları Fieldia’nın cümlelerinde küçük harfle yazılıyor' : 'Alan adları Fieldia’nın cümlelerinde olduğu gibi yazılıyor'),
  limits: (now) => ({ on: 'Yanıtları yalnızca belirtilen zamanlarda ve belirtilen sayıda kabul ediyor', off: 'Yanıtları her zaman ve gelen sayıda kabul ediyor', changed: 'Yanıtların kabul edildiği zaman ve sayı değişti' })[now],
  continueLater: (on) => (on ? '“Daha sonra devam et” düğmesini sunuyor' : 'Artık “Daha sonra devam et” düğmesini sunmuyor'),
  approval: (now) => ({ on: 'Kayıtları onay bekliyor', off: 'Kayıtları artık onay beklemiyor', changed: 'Bir kayıt onay beklerken açık kalanlar değişti' })[now],
  suggest: (now) => ({ on: 'Uygulamanızın yapay zekâsıyla “Metinden doldur” düğmesini sunuyor', off: 'Artık “Metinden doldur” düğmesini sunmuyor', changed: '“Metinden doldur” özelliğinin formu doldurma biçimi değişti' })[now],
  quiz: (now) => ({ on: 'Sınav sonuçlarını gösteriyor', off: 'Artık sınav sonuçlarını göstermiyor', changed: 'Sınav sonuçlarının gösterilme biçimi değişti' })[now],
  review: (now) => ({ on: 'Göndermeden önce her yanıtı gösteriyor', off: 'Artık yanıtları göndermeden önce göstermiyor', changed: 'Göndermeden önceki gözden geçirme değişti' })[now],
  flowOne: (on) => (on ? 'Her seferinde bir soru soruyor' : 'Sorularını yeniden birlikte soruyor'),
  questionsDrawn: 'Her kişiye sorulan sorular veya sıraları değişti',
  timeLimit: 'Süre sınırları değişti',
  outbox: (on) => (on ? 'Bağlantı yokken yapılan gönderimleri cihazda saklıyor' : 'Artık bağlantı yokken yapılan gönderimleri saklamıyor'),
  payment: (now) => ({ on: 'Yanıtlar gönderilmeden önce ödeme alıyor', off: 'Artık ödeme almıyor', changed: 'Ödeme ayarları değişti' })[now],
  prefill: (n) => (n ? `Açıldığı bağlantı ${plural('tr', n, { one: 'bir alanı', other: '# alanı' })} dolduruyor` : 'Açıldığı bağlantı hiçbir alanı doldurmuyor'),
  thePage: 'sayfa',
  // ---- the look
  look: {
    accent: 'Vurgu rengi',
    font: 'Yazı tipi',
    density: 'Boşluk',
    corners: 'Köşeler',
    labels: 'Etiketlerin yeri',
    labelWidth: 'Yandaki etiketlerin genişliği',
    scheme: 'Renkler',
  },
  lookValue: (key, value) => {
    if (value === null) return key === 'labelWidth' ? 'kaplamadaki genişlikte' : 'kaplamadaki gibi';
    if (key === 'labelWidth') return `${value} px genişliğinde`;
    const words: Record<string, Record<string, string>> = {
      font: { system: 'sistemin yazı tipi', serif: 'tırnaklı', rounded: 'yuvarlak' },
      density: { compact: 'sıkı', comfortable: 'rahat', roomy: 'geniş' },
      corners: { square: 'köşeli', soft: 'hafif yuvarlak', round: 'yuvarlak' },
      labels: LABELS,
      scheme: { light: 'açık', dark: 'koyu', auto: 'okuyucunun sistemine göre' },
    };
    return words[key]?.[String(value)] ?? String(value);
  },
  lookLine: (setting, was, now) => `${setting}: ${was} → ${now}`,
  // ---- rules
  ruleChanged: (name, must) => `“${name}”: bir kural değişti — ${must}`,
  ruleRemoved: (name, must) => `“${name}”: kural kaldırıldı — ${must}`,
  ruleAdded: (name, must) => `“${name}”: yeni kural — ${must}`,
  workedOut: (name, formula) => `“${name}” şundan hesaplanıyor: ${formula}`,
  noLongerWorkedOut: (name) => `“${name}” artık hesaplanmıyor`,
  setWhen: (name, value, when) => `“${name}”, şu durumda ${value} olarak ayarlanıyor: ${when}`,
  setWhenJoin: (lines) => lines.join('; '),
  noLongerSet: (name) => `“${name}” artık bir kuralla ayarlanmıyor`,
  // ---- translations
  writtenIn: (language) => `Sayfanın dili artık: ${language}`,
  addedLanguage: (language) => `${language} eklendi`,
  removedLanguage: (language) => `${language} kaldırıldı`,
  translated: (language, n) => `${language}: ${count(n, 'sözcük')} çevrildi`,
  translationsChanged: (language, n) => `${language}: ${count(n, 'çeviri')} değişti`,
  translationsTakenOut: (language, n) => `${language}: ${count(n, 'çeviri')} çıkarıldı`,
  // ---- a structure's own
  offersEvery: (name) => `“${name}”: tüm kayıtları sunuyor`,
  offersWhere: (name, field, value) => `“${name}”: yalnızca ${field} değeri ${value} olan kayıtları sunuyor`,
  offersChanged: (name) => `“${name}”: sunduğu kayıtlar değişti`,
  addsUp: (name, columns) => `“${name}”: toplanan sütunlar: ${columns}`,
  addsUpNothing: (name) => `“${name}”: hiçbir şey toplamıyor`,
  optionalColumns: (name) => `“${name}”: kişilerin gizleyebileceği sütunlar değişti`,
};
