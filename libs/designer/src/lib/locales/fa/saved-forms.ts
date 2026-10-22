import type { DesignerWords } from '../../designer-words';
import { ltr, quoteAr } from '../speak';

const q = quoteAr;
/** Fieldia's dates are Gregorian: Intl's Persian default is the Solar Hijri calendar. */
const DATE = new Intl.DateTimeFormat('fa-u-ca-gregory-nu-latn', { dateStyle: 'medium' });

/**
 * The designer's words in Farsi: a saved form placed in another — the toolbox's tile and its menu, the frame on the
 * canvas, its panel, what the Checks list and the edits say of it.
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const savedForms: DesignerWords['savedForms'] = {
  savedForm: 'فرم ذخیره‌شده',
  copy: (n) => (n === 1 ? 'فرم ذخیره‌شده' : `فرم ذخیره‌شدهٔ ${n}`),
  tile: 'یک فرم ذخیره‌شده',
  tileTip: 'فرم ذخیره‌شده: یکی از فرم‌های ذخیره‌شدهٔ برنامه را جای دهید، مانند یک نشانی',
  menuNote: (any) =>
    any ? 'به‌طور کامل جای داده می‌شود و پاسخ‌هایش جدا نگه داشته می‌شوند؛ در صفحهٔ خودش تغییر داده می‌شود.' : 'برنامه هنوز فرم ذخیره‌شده‌ای برای جای دادن ندارد: نخست یکی را منتشر کنید.',
  add: 'افزودن فرم ذخیره‌شده',
  hint: 'فرم ذخیره‌شده',
  tag: (name, version) => `فرم ذخیره‌شدهٔ ${q(name)} · ${version === undefined ? 'آخرین نسخه' : `نسخهٔ ${version}`}`,
  openIt: 'باز کردن آن',
  openTitle: (name) => `باز کردن ${q(name)} در صفحهٔ خودش، برای تغییر آن`,
  loading: (id) => `در حال بارگیری ${q(id)}…`,
  cannotShow: (name, why) => `${q(name)} را نمی‌توان نمایش داد: ${ltr(why)}`,
  version: 'نسخه',
  title: 'عنوان',
  showTitle: 'نمایش عنوان',
  answersGoUnder: 'محل ذخیرهٔ پاسخ‌ها',
  latest: 'آخرین نسخه',
  versionOn: (version, publishedAt) => `نسخهٔ ${version} · ${DATE.format(new Date(publishedAt))}`,
  versionOnly: (version) => `نسخهٔ ${version}`,
  notFound: (id) => `${id} (یافت نشد)`,
  openHint: 'فرم ذخیره‌شده در صفحهٔ خودش تغییر داده می‌شود: هر فرمی که آن را جای داده از آن پیروی می‌کند، مگر اینکه به یک نسخه پایبند بماند.',
  versionHint: 'آخرین نسخه: هر نسخه‌ای که منتشر شود، همین که منتشر شد اینجا نمایش داده می‌شود. نسخه‌ای که به آن پایبند بمانید همان‌گونه که بود می‌ماند.',
  titleHint: 'عنوان خودش، مگر اینکه اینجا متنی تایپ شود.',
  answersHint: `پاسخ‌هایش زیر این نام نگه داشته می‌شوند، جدا از پاسخ‌های نمونهٔ دوم: ${ltr('{ "home": { "street": … } }')}.`,
  noForm: (id) => `فرم ذخیره‌شده‌ای با نام ${q(id)} در این صفحه نیست`,
  pickForm: 'فرم ذخیره‌شده‌ای را برای جای دادن انتخاب کنید',
  versionWhole: 'نسخه عددی صحیح از 1 به بالا است',
  answersName: (hint) => `جای پاسخ‌ها نامی از حروف، رقم‌ها و ${ltr('_')} است که با یک حرف آغاز می‌شود: برای نمونه ${q(hint)}`,
  insideItself: 'یک صفحه را نمی‌توان درون خودش جای داد',
  way: (titles) => titles.map(q).join(' ← '),
  holdsThisPage: (name, way) => `${q(name)} این صفحه را در خود دارد: درون خودش جای داده می‌شد (${way})`,
  mixWithField: (name) => `یک فرم ذخیره‌شده پاسخ‌هایش را زیر ${q(name)}، که نام یک فیلد است، نگه می‌دارد: پاسخ‌ها با هم مخلوط می‌شوند. به آن نامی جداگانه بدهید.`,
  mixWithCopy: (name) => `دو فرم ذخیره‌شده پاسخ‌هایشان را زیر ${q(name)} نگه می‌دارند: پاسخ‌ها با هم مخلوط می‌شوند. به هر نمونه نامی جداگانه بدهید.`,
  placedInItself: 'این صفحه درون خودش جای داده شده است: فرم نمی‌تواند آن را نمایش دهد.',
  cannotBeFound: (id) => `فرم ذخیره‌شدهٔ ${q(id)} یافت نمی‌شود: فرم این را در جای آن خواهد گفت.`,
  noVersion: (title, version) => `${q(title)} نسخهٔ ${version} ندارد: فرم خواهد گفت که یافت نمی‌شود.`,
  notSections: (title) => `${q(title)} فرمی از بخش‌ها یا زبانه‌ها نیست: نمی‌توان آن را در فرم دیگری جای داد.`,
  holdsThisPageCheck: (name, way) => `${q(name)} این صفحه را در خود دارد: درون خودش جای داده می‌شد (${way}).`,
  takeItOff: 'برداشتن آن از صفحه',
};
