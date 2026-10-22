import type { DesignerWords } from '../../designer-words';

const VALUES: Record<string, string> = { square: 'Köşeli', soft: 'Hafif yuvarlak', round: 'Yuvarlak', small: 'Küçük', large: 'Büyük' };
const lower = (words: string) => words.toLocaleLowerCase('tr');

/**
 * The designer's words in Turkish: each kind of part's look, on the Look tab — the kinds as people think of them, each
 * setting by what it draws on that kind (a table's background is its heading row, a button's accent its colour) and
 * what is said of them. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const partLooks: DesignerWords['partLooks'] = {
  setting: 'Her öğe türü',
  hint: 'Her biri sayfanın görünümünün üzerine uygulanır. Üzerindeki metnin zor okunacağı bir renk, yalnızca gerektiği kadar açık ya da koyu çizilir.',
  kindOfPart: 'Öğe türü',
  kinds: { inputs: 'Metin kutuları', choices: 'Seçimler', groups: 'Gruplar', buttons: 'Düğmeler', tables: 'Tablolar' },
  hints: {
    inputs: 'Metin, sayı ve tarih kutuları ile açılır listeler. Vurgu rengi, içine yazılan kutunun kenarı ve seçilen gündür.',
    choices: 'Halkalar ve onay işaretleri vurgu rengini alır; ölçeğin noktaları, Evet ve Hayır, görseller ve sıralamanın satırları geri kalanını alır.',
    groups: 'Bölümler ve kartlar. Alt çizgili kaplamada, arka planı ya da kenarlığı verilen bir grup kart olarak çizilir.',
    buttons: 'Gönder, İleri, Kaydet, Bir tane daha ekle.',
    tables: 'Satır tabloları ve bir matrisin soru ızgarası.',
  },
  settings: { background: 'Arka plan', border: 'Kenarlık', corners: 'Köşeler', textSize: 'Metin boyutu', accent: 'Vurgu rengi' },
  own: { buttons: { accent: 'Renk' }, tables: { background: 'Başlık satırı', border: 'Çizgiler' } },
  values: VALUES,
  named: (kind, setting) => `${kind}: ${lower(setting)}`,
  asThePage: 'Sayfadaki gibi',
  namedAsThePage: (named) => `${named}, sayfadaki gibi`,
  ownLook: (kind) => `${kind}: kendine özgü görünüm`,
  pageLook: (kind) => `${kind}: sayfadaki gibi`,
  said: (value) => (value === undefined ? 'sayfadaki gibi' : VALUES[value] ? lower(VALUES[value]) : value),
  change: (kind, setting, was, now) => `${kind}, ${lower(setting)}: ${was} → ${now}`,
  noKind: (kind) => `“${kind}” diye bir öğe türü yok`,
  noSetting: (kind, setting) => `${kind} için kendine ait bir ${lower(setting)} ayarı yok`,
  corners: 'Köşeler köşeli, hafif yuvarlak ya da yuvarlak olur',
  textSize: 'Metin küçük ya da büyük olur',
  colour: 'Renk #rrggbb biçiminde yazılır, örneğin #1f7a4d',
};
