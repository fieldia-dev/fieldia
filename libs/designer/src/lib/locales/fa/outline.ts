import type { DesignerWords } from '../../designer-words';
import { ltr, plural, quoteAr } from '../speak';

/** Farsi takes the singular noun after a number, and says `one` for 0 and 1: both forms carry the number. */
const parts = (n: number) => plural('fa', n, { one: '# جزء', other: '# جزء' });
const SCREENS = { desktop: 'رایانهٔ رومیزی', tablet: 'تبلت', phone: 'تلفن همراه' };
/** "At the top of …", with the ezafe written where Persian writes it. */
const where = { top: 'بالای', bottom: 'پایین' } as const;
const is = (one: boolean) => (one ? 'است' : 'هستند');

/**
 * The designer's words in Farsi: the outline — the page's parts as a tree, each row named with its kind, and what
 * moving rows by drag or by key says — and copying, cutting and pasting parts.
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const outline: DesignerWords['outline'] = {
  label: 'ساختار',
  tree: 'اجزای صفحه',
  empty: 'هنوز چیزی در صفحه نیست.',
  help: (survey) =>
    `${survey ? 'صفحه‌ها و پرسش‌هایشان. برای جابه‌جا کردن یک ردیف، آن را بکشید.' : 'برای جابه‌جا کردن یک ردیف، آن را بکشید؛ رها کردن روی میانهٔ یک گروه آن را به درون گروه می‌برد.'} {⇧} و کلیک چند ردیف را انتخاب می‌کند؛ {Alt} با یک پیکان موارد انتخاب‌شده را جابه‌جا می‌کند؛ {?} همهٔ کلیدها را فهرست می‌کند.`,
  ruled: (survey) => (survey ? 'فقط برای برخی پاسخ‌ها نمایش داده می‌شود' : 'فقط برای برخی رکوردها نمایش داده می‌شود'),
  ruledTitle: (survey) => (survey ? 'فقط برای برخی پاسخ‌ها نمایش داده می‌شود' : 'فقط برای برخی رکوردها نمایش داده می‌شود'),
  required: 'الزامی',
  requiredTitle: 'الزامی',
  rowWords: (items) => items.join('، '),
  kinds: {
    custom: 'سفارشی',
    sideBySide: 'کنار هم',
    group: 'گروه',
    tabs: 'زبانه‌ها',
    tabCount: (n) => plural('fa', n, { one: '# زبانه', other: '# زبانه' }),
    tab: 'زبانه',
    untitledTab: 'زبانهٔ بی‌عنوان',
    page: 'صفحه',
    untitledPage: 'صفحهٔ بی‌عنوان',
    column: 'ستون',
    statusSteps: 'مراحل وضعیت',
    status: 'وضعیت',
    button: 'دکمه',
    counter: 'شمارنده',
    badge: 'نشان',
    heading: 'سرعنوان',
    note: 'یادداشت',
    words: 'متن',
    divider: 'خط',
    spacer: 'فاصله',
    image: 'تصویر',
    map: 'نقشه',
    related: 'فهرست مرتبط',
    slot: 'جزء ویژهٔ برنامه',
    form: 'فرم ذخیره‌شده',
    part: 'جزء',
  },
  columnsStacked: (n) =>
    `${plural('fa', n, { one: '# ستون', other: '# ستون' })}، که در صفحه‌نمایش‌های کوچک‌تر همان‌گونه که پوسته می‌چیند روی هم قرار می‌گیرند`,
  columnsAt: (desktop, tablet, phone) => {
    const at = (n: number | undefined, screen: string) => (n === undefined ? `${screen}: همان‌گونه که پوسته روی هم می‌چیند` : `${screen}: ${n}`);
    return `ستون‌ها — ${at(desktop, SCREENS.desktop)}، ${at(tablet, SCREENS.tablet)}، ${at(phone, SCREENS.phone)}`;
  },
  it: 'این جزء',
  part: 'جزء',
  parts,
  tookOff: (what) => `${typeof what === 'number' ? parts(what) : quoteAr(what)} از صفحه برداشته شد`,
  notTakenOff: 'برداشته نشد',
  notMoved: 'جابه‌جا نشد',
  notHere: 'اینجا ممکن نیست',
  stays: (_one) => 'در جای کنونی خود',
  before: (name) => `پیش از ${name}`,
  after: (name) => `پس از ${name}`,
  into: (into, before) => `${into === null ? 'روی خود صفحه' : `به درون ${into}`}، ${before === null ? 'در انتها' : `پیش از ${before}`}`,
  pickToMove: 'جزئی را برای جابه‌جا کردن انتخاب کنید',
  tabNotInTab: 'زبانه اجزا را در خود نگه می‌دارد، نه زبانه‌های دیگر را',
  tabAmongItsTabs: 'زبانه فقط میان زبانه‌های هم‌گروه خود جابه‌جا می‌شود',
  tabAmongTabs: 'زبانه میان زبانه‌ها قرار می‌گیرد: زبانه‌ای را انتخاب کنید تا پس از آن چسبانده شود',
  inOneOfTheTabs: 'آن را در یکی از زبانه‌ها بگذارید',
  pageNotInPage: 'صفحه پرسش‌ها را در خود نگه می‌دارد، نه صفحه‌های دیگر را',
  questionOnPage: 'پرسش باید در یک صفحه قرار گیرد',
  notInsideItself: 'یک جزء نمی‌تواند درون خودش قرار گیرد',
  holdsNoParts: (name) => `${name} جزئی در خود نگه نمی‌دارد`,
  sameGroup: 'برای جابه‌جا کردن هم‌زمان، اجزایی را انتخاب کنید که در یک گروه هستند',
  atEdgeOfPage: (one, end) => `هم‌اکنون در ${where[end]} صفحه ${is(one)}`,
  atEdgeOfSurvey: (one, end) => `هم‌اکنون در ${end === 'bottom' ? 'پایین آخرین' : 'بالای نخستین'} صفحه ${is(one)}`,
  atEdgeOf: (one, end, name, arrow) => `هم‌اکنون در ${where[end]} ${name} ${is(one)}: ${ltr(`Alt+${arrow}`)} ${one ? 'آن را' : 'آن‌ها را'} بیرون می‌برد`,
  onPageItself: (one) => `روی خود صفحه ${is(one)}، بیرون از هر گروهی`,
  noGroupBefore: (one) => (one ? 'گروهی پیش از آن نیست که در آن گذاشته شود' : 'گروهی پیش از آن‌ها نیست که در آن گذاشته شوند'),
  keys: [
    ['↑ / ↓', 'رفتن به ردیف پیشین یا پسین'],
    ['← / →', 'جمع یا باز کردن ردیف، یا رفتن به ردیفی که در آن است یا به نخستین جزء آن'],
    ['Home / End', 'رفتن به نخستین یا آخرین ردیف'],
    ['یک حرف', 'رفتن به ردیف بعدی‌ای که نامش با آن حرف آغاز می‌شود'],
    ['Enter', 'انتخاب آن و نمایش آن در صفحه'],
    ['فاصله', 'انتخاب آن (⌘ یا Ctrl آن را به موارد انتخاب‌شده می‌افزاید)'],
    ['Shift+↑ / ↓', 'انتخاب ردیف‌های سر راه نیز'],
    ['Shift + کلیک', 'انتخاب همهٔ ردیف‌ها از ردیف انتخاب‌شده تا این ردیف'],
    ['⌘ + کلیک', 'افزودن یک ردیف دیگر به موارد انتخاب‌شده، یا رها کردن آن (Ctrl + کلیک در ویندوز)'],
    ['Alt+↑ / Alt+↓', 'جابه‌جا کردن موارد انتخاب‌شده به پیش از ردیف بالایی یا پس از ردیف پایینی'],
    ['Alt+← / Alt+→', 'بیرون بردن موارد انتخاب‌شده از گروهشان، یا گذاشتن آن‌ها در گروه پیش از آن‌ها'],
    ['Delete', 'برداشتن موارد انتخاب‌شده از صفحه'],
  ],
};

export const clipboard: DesignerWords['clipboard'] = {
  keys: [
    ['⌘C', 'کپی موارد انتخاب‌شده، برای چسباندن در اینجا یا در طراح دیگری'],
    ['⌘X', 'برش موارد انتخاب‌شده'],
    ['⌘V', 'چسباندن پس از موارد انتخاب‌شده، یا درون گروه انتخاب‌شده'],
  ],
  part: 'جزء',
  parts,
  copied: (what) => `${what} کپی شد`,
  cut: (what) => `${what} برش داده شد`,
  copiedNotCut: 'کپی شد، اما از صفحه برداشته نشد',
  nothingPasted: 'چیزی چسبانده نشد',
  pasted: (what, dropped) =>
    `${what} چسبانده شد${dropped ? `؛ ${plural('fa', dropped, { one: '# قاعده کنار گذاشته شد: فیلدی را می‌خواند که این صفحه ندارد', other: '# قاعده کنار گذاشته شد: فیلدی را می‌خوانند که این صفحه ندارد' })}` : ''}`,
  nothingToPaste: 'هیچ جزء Fieldia برای چسباندن نیست: نخست اجزایی را در یک طراح Fieldia کپی کنید',
  listTakesColumns: 'فهرست ستون می‌پذیرد، نه جزء: آن‌ها را در یک نما یا یک نظرسنجی بچسبانید',
  pagesOrQuestions: 'صفحه یا پرسش بچسبانید، نه هر دو را با هم',
  surveyPages: 'صفحه‌های نظرسنجی در یک نظرسنجی قرار می‌گیرند',
};
