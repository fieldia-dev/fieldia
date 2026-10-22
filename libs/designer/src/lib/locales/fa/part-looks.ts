import type { DesignerWords } from '../../designer-words';
import { ltr, quoteAr } from '../speak';

const VALUES: Record<string, string> = { square: 'تیز', soft: 'نرم', round: 'گرد', small: 'کوچک', large: 'بزرگ' };

/**
 * The designer's words in Farsi: each kind of part's look, on the Look tab — the kinds as people think of them, each
 * setting by what it draws on that kind (a table's background is its heading row, a button's accent its colour) and
 * what is said of them.
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const partLooks: DesignerWords['partLooks'] = {
  setting: 'هر نوع جزء',
  hint: 'هر کدام روی ظاهر صفحه. رنگی که خواندن متن روی آن دشوار باشد، روشن‌تر یا تیره‌تر کشیده می‌شود، فقط به اندازه‌ای که لازم است.',
  kindOfPart: 'نوع جزء',
  kinds: { inputs: 'کادرهای متن', choices: 'گزینه‌ها', groups: 'گروه‌ها', buttons: 'دکمه‌ها', tables: 'جدول‌ها' },
  hints: {
    inputs: 'کادرهای متن، عدد و تاریخ، و فهرست‌های کشویی. رنگ تأکید، لبهٔ کادری است که در آن تایپ می‌شود و روز انتخاب‌شده.',
    choices: 'دایره‌ها و تیک‌ها رنگ تأکید را می‌گیرند؛ نقطه‌های مقیاس، «بله» و «خیر»، تصویرها و موارد رتبه‌بندی بقیه را.',
    groups: 'بخش‌ها و کارت‌ها. با پوستهٔ خط زیرین، گروهی که پس‌زمینه یا حاشیه دارد به‌صورت کارت کشیده می‌شود.',
    buttons: 'ارسال، بعدی، ذخیره، افزودن مورد دیگر.',
    tables: 'جدول‌های سطرها، و شبکهٔ پرسش‌های ماتریس.',
  },
  settings: { background: 'پس‌زمینه', border: 'حاشیه', corners: 'گوشه‌ها', textSize: 'اندازهٔ متن', accent: 'رنگ تأکید' },
  own: { buttons: { accent: 'رنگ' }, tables: { background: 'ردیف سرعنوان', border: 'خطوط' } },
  values: VALUES,
  named: (kind, setting) => `${kind}: ${setting}`,
  asThePage: 'مانند صفحه',
  namedAsThePage: (named) => `${named} مانند صفحه`,
  ownLook: (kind) => `${kind}: ظاهری ویژهٔ خود`,
  pageLook: (kind) => `${kind}: مانند صفحه`,
  said: (value) => (value === undefined ? 'مانند صفحه' : (VALUES[value] ?? ltr(value))),
  change: (kind, setting, was, now) => `${kind}، ${setting}: ${was} ← ${now}`,
  noKind: (kind) => `نوع جزئی با نام ${quoteAr(kind)} وجود ندارد`,
  noSetting: (kind, setting) => `${quoteAr(setting)} را نمی‌توان برای ${kind} جداگانه تنظیم کرد`,
  corners: 'گوشه‌ها تیز، نرم یا گرد هستند',
  textSize: 'متن کوچک یا بزرگ است',
  colour: `رنگ به شکل ${ltr('#rrggbb')} نوشته می‌شود، مانند ${ltr('#1f7a4d')}`,
};
