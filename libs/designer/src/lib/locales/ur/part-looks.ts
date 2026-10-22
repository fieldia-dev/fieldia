import type { DesignerWords } from '../../designer-words';
import { ltr, quoteAr } from '../speak';

const VALUES: Record<string, string> = { square: 'چوکور', soft: 'ہلکے گول', round: 'گول', small: 'چھوٹا', large: 'بڑا' };

/**
 * The designer's words in Urdu: each kind of part's look, on the Look tab — the kinds as people think of them, each
 * setting by what it draws on that kind, and what is said of them. UNREVIEWED: machine-assisted, not yet reviewed by
 * a native speaker.
 */
export const partLooks: DesignerWords['partLooks'] = {
  setting: 'جز کی ہر قسم',
  hint: 'ہر ایک صفحے کے انداز کے اوپر۔ جس رنگ پر متن پڑھنا مشکل ہو وہ ہلکا یا گہرا کر کے بنایا جاتا ہے، بس اتنا جتنا ضروری ہو۔',
  kindOfPart: 'جز کی قسم',
  kinds: { inputs: 'متن کے خانے', choices: 'اختیارات', groups: 'گروپس', buttons: 'بٹن', tables: 'جدول' },
  hints: {
    inputs: 'متن، عدد اور تاریخ کے خانے، اور ڈراپ ڈاؤن۔ نمایاں رنگ اس خانے کا کنارہ ہے جس میں لکھا جا رہا ہو، اور منتخب دن۔',
    choices: 'دائرے اور ٹک نمایاں رنگ لیتے ہیں؛ پیمانے کے نقاط، «ہاں» اور «نہیں»، تصاویر اور ترجیحی ترتیب کی سطریں باقی رنگ لیتی ہیں۔',
    groups: 'حصے اور کارڈز۔ «زیریں لکیر» والے بنیادی انداز میں، جس گروپ کو پس منظر یا حاشیہ دیا جائے وہ کارڈ کی صورت میں بنتا ہے۔',
    buttons: 'بھیجیں، اگلا، محفوظ کریں، ایک اور شامل کریں۔',
    tables: 'سطروں کے جدول، اور میٹرکس کے سوالات کا گرڈ۔',
  },
  settings: { background: 'پس منظر', border: 'حاشیہ', corners: 'کونے', textSize: 'متن کا سائز', accent: 'نمایاں رنگ' },
  own: { buttons: { accent: 'رنگ' }, tables: { background: 'سرخیوں کی قطار', border: 'لکیریں' } },
  values: VALUES,
  named: (kind, setting) => `${kind}: ${setting}`,
  asThePage: 'صفحے کی طرح',
  namedAsThePage: (named) => `${named} صفحے کی طرح`,
  ownLook: (kind) => `${kind}: ان کا اپنا انداز`,
  pageLook: (kind) => `${kind}: صفحے کی طرح`,
  said: (value) => (value === undefined ? 'صفحے کی طرح' : (VALUES[value] ?? ltr(value))),
  change: (kind, setting, was, now) => `${kind}، ${setting}: ${was} ← ${now}`,
  noKind: (kind) => `جز کی کوئی قسم ${quoteAr(kind)} نہیں`,
  noSetting: (kind, setting) => `${kind} کے لیے ${quoteAr(setting)} کی اپنی سیٹنگ نہیں`,
  corners: 'کونے چوکور، ہلکے گول یا گول ہوتے ہیں',
  textSize: 'متن چھوٹا یا بڑا ہوتا ہے',
  colour: `رنگ ${ltr('#rrggbb')} کی صورت میں لکھا جاتا ہے، جیسے ${ltr('#1f7a4d')}`,
};
