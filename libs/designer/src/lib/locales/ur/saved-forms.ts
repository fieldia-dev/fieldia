import type { DesignerWords } from '../../designer-words';
import { ltr, quoteAr } from '../speak';

const q = quoteAr;
const DATE = new Intl.DateTimeFormat('ur-u-nu-latn', { dateStyle: 'medium' });

/**
 * The designer's words in Urdu: a saved form placed in another — the toolbox's tile and its menu, the frame on the
 * canvas, its panel, what the Checks list and the edits say of it. UNREVIEWED: machine-assisted, not yet reviewed by
 * a native speaker.
 */
export const savedForms: DesignerWords['savedForms'] = {
  savedForm: 'محفوظ فارم',
  copy: (n) => (n === 1 ? 'محفوظ فارم' : `محفوظ فارم ${n}`),
  tile: 'ایک محفوظ فارم',
  tileTip: 'محفوظ فارم: ایپ کے محفوظ فارموں میں سے کوئی ایک رکھیں، جیسے پتہ',
  menuNote: (any) =>
    any ? 'پورا رکھا جاتا ہے، اور اس کے جوابات الگ رکھے جاتے ہیں؛ اس میں تبدیلی اس کے اپنے صفحے پر ہوتی ہے۔' : 'ایپ میں ابھی رکھنے کے لیے کوئی محفوظ فارم نہیں: پہلے کوئی فارم شائع کریں۔',
  add: 'محفوظ فارم شامل کریں',
  hint: 'محفوظ فارم',
  tag: (name, version) => `محفوظ فارم ${q(name)} · ${version === undefined ? 'تازہ ترین ورژن' : `ورژن ${version}`}`,
  openIt: 'اسے کھولیں',
  openTitle: (name) => `${q(name)} کو تبدیل کرنے کے لیے اس کے اپنے صفحے پر کھولیں`,
  loading: (id) => `${q(id)} لوڈ ہو رہا ہے…`,
  cannotShow: (name, why) => `${q(name)} نہیں دکھایا جا سکتا: ${ltr(why)}`,
  version: 'ورژن',
  title: 'عنوان',
  showTitle: 'عنوان دکھائیں',
  answersGoUnder: 'جوابات اس نام کے تحت',
  latest: 'تازہ ترین ورژن',
  versionOn: (version, publishedAt) => `ورژن ${version} · ${DATE.format(new Date(publishedAt))}`,
  versionOnly: (version) => `ورژن ${version}`,
  notFound: (id) => `${id} (نہیں ملا)`,
  openHint: 'محفوظ فارم اپنے ہی صفحے پر تبدیل کیا جاتا ہے: اسے رکھنے والا ہر فارم اس کی پیروی کرتا ہے، الا یہ کہ وہ کسی ایک ورژن پر قائم رہے۔',
  versionHint: 'تازہ ترین: ہر ورژن شائع ہوتے ہی یہاں دکھائی دیتا ہے۔ جس ورژن پر قائم رہا جائے وہ ویسا ہی رہتا ہے۔',
  titleHint: 'اس کا اپنا عنوان، جب تک یہاں کچھ نہ لکھا جائے۔',
  answersHint: `اس کے جوابات اس نام کے تحت رکھے جاتے ہیں، دوسری نقل کے جوابات سے الگ: ${ltr('{ "home": { "street": … } }')}۔`,
  noForm: (id) => `اس صفحے پر کوئی محفوظ فارم ${q(id)} نہیں`,
  pickForm: 'رکھنے کے لیے محفوظ فارم منتخب کریں',
  versionWhole: 'ورژن 1 سے شروع ہونے والا مکمل عدد ہوتا ہے',
  answersName: (hint) => `جوابات کی جگہ کا نام حروف، ہندسوں اور ${ltr('_')} سے بنتا ہے، اور کسی حرف سے شروع ہوتا ہے: مثلاً ${q(hint)}`,
  insideItself: 'کوئی صفحہ اپنے ہی اندر نہیں رکھا جا سکتا',
  way: (titles) => titles.map(q).join(' ← '),
  holdsThisPage: (name, way) => `${q(name)} میں یہ صفحہ موجود ہے: یہ اپنے ہی اندر رکھا جائے گا (${way})`,
  mixWithField: (name) =>
    `ایک محفوظ فارم اپنے جوابات ${q(name)} کے تحت رکھتا ہے، جو ایک فیلڈ کا نام ہے: دونوں کے جوابات آپس میں مل جائیں گے۔ اسے اس کا اپنا نام دیں۔`,
  mixWithCopy: (name) => `دو محفوظ فارم اپنے جوابات ${q(name)} کے تحت رکھتے ہیں: ان کے جوابات آپس میں مل جائیں گے۔ ہر نقل کو اس کا اپنا نام دیں۔`,
  placedInItself: 'یہ صفحہ اپنے ہی اندر رکھا گیا ہے: فارم اسے نہیں دکھا سکتا۔',
  cannotBeFound: (id) => `محفوظ فارم ${q(id)} نہیں مل سکا: فارم اس کی جگہ یہی بتائے گا۔`,
  noVersion: (title, version) => `${q(title)} کا کوئی ورژن ${version} نہیں: فارم بتائے گا کہ یہ نہیں مل سکا۔`,
  notSections: (title) => `${q(title)} حصوں یا ٹیبز والا فارم نہیں: اسے کسی دوسرے فارم میں نہیں رکھا جا سکتا۔`,
  holdsThisPageCheck: (name, way) => `${q(name)} میں یہ صفحہ موجود ہے: یہ اپنے ہی اندر رکھا جائے گا (${way})۔`,
  takeItOff: 'اسے صفحے سے ہٹائیں',
};
