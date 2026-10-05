import type { DesignerWords } from '../../designer-words';
import { ltr, quoteAr } from '../speak';

const VALUES: Record<string, string> = { square: 'حادة', soft: 'ناعمة', round: 'مستديرة', small: 'صغير', large: 'كبير' };

export const partLooks: DesignerWords['partLooks'] = {
  setting: 'كل نوع من الأجزاء',
  hint: 'كلٌّ فوق مظهر الصفحة. اللون الذي يصعب قراءة الكلمات عليه يُرسم أفتح أو أغمق، بالقدر اللازم فقط.',
  kindOfPart: 'نوع الجزء',
  kinds: { inputs: 'مربعات النص', choices: 'الاختيارات', groups: 'المجموعات', buttons: 'الأزرار', tables: 'الجداول' },
  hints: {
    inputs: 'مربعات النص والأرقام والتواريخ، والقوائم المنسدلة. لون التمييز هو حافة المربع أثناء الكتابة فيه، واليوم المختار.',
    choices: 'تأخذ الدوائر وعلامات الاختيار لون التمييز؛ وتأخذ نقاط المقياس و«نعم» و«لا» والصور وأسطر الترتيب الباقي.',
    groups: 'الأقسام والبطاقات. مع نمط الخط السفلي، تُرسم المجموعة التي لها خلفية أو حد على هيئة بطاقة.',
    buttons: 'إرسال، التالي، حفظ، إضافة آخر.',
    tables: 'جداول البنود، وشبكة أسئلة المصفوفة.',
  },
  settings: { background: 'الخلفية', border: 'الحد', corners: 'الزوايا', textSize: 'حجم النص', accent: 'لون التمييز' },
  own: { buttons: { accent: 'اللون' }, tables: { background: 'صف العناوين', border: 'الخطوط' } },
  values: VALUES,
  named: (kind, setting) => `${kind}: ${setting}`,
  asThePage: 'كما في الصفحة',
  namedAsThePage: (named) => `${named} كما في الصفحة`,
  ownLook: (kind) => `${kind}: مظهر خاص بها`,
  pageLook: (kind) => `${kind}: كما في الصفحة`,
  said: (value) => (value === undefined ? 'كما في الصفحة' : (VALUES[value] ?? ltr(value))),
  change: (kind, setting, was, now) => `${kind}، ${setting}: ${was} ← ${now}`,
  noKind: (kind) => `لا يوجد نوع جزء ${quoteAr(kind)}`,
  noSetting: (kind, setting) => `لا يمكن ضبط ${quoteAr(setting)} في ${kind}`,
  corners: 'الزوايا حادة أو ناعمة أو مستديرة',
  textSize: 'النص صغير أو كبير',
  colour: `يُكتب اللون بالصيغة ${ltr('#rrggbb')}، مثل ${ltr('#1f7a4d')}`,
};
