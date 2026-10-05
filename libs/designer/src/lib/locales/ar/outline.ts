import type { DesignerWords } from '../../designer-words';
import { ltr, plural, quoteAr } from '../speak';

const parts = (n: number) => plural('ar', n, { zero: 'لا أجزاء', one: 'جزء واحد', two: 'جزآن', few: '# أجزاء', many: '# جزءًا', other: '# جزء' });
/** After a word it belongs to ("تم نسخ جزأين"). */
const partsAfter = (n: number) => plural('ar', n, { zero: 'لا أجزاء', one: 'جزء واحد', two: 'جزأين', few: '# أجزاء', many: '# جزءًا', other: '# جزء' });
const rules = (n: number) => plural('ar', n, { one: 'قاعدة واحدة', two: 'قاعدتان', few: '# قواعد', many: '# قاعدة', other: '# قاعدة' });
const SCREENS = { desktop: 'سطح المكتب', tablet: 'الجهاز اللوحي', phone: 'الهاتف' };
const where = { top: 'أعلى', bottom: 'أسفل' } as const;

export const outline: DesignerWords['outline'] = {
  label: 'المخطط',
  tree: 'أجزاء الصفحة',
  empty: 'لا شيء في الصفحة بعد.',
  help: (survey) =>
    `${survey ? 'الصفحات وأسئلتها. اسحب صفًا لنقله.' : 'اسحب صفًا لنقله، أو إلى داخل مجموعة من منتصفها.'} {⇧} مع النقر يختار عدة صفوف، و{Alt} مع سهم ينقل المختار، و{?} يعرض كل المفاتيح.`,
  ruled: (survey) => (survey ? 'يظهر لبعض الإجابات فقط' : 'يظهر لبعض السجلات فقط'),
  ruledTitle: (survey) => (survey ? 'يظهر لبعض الإجابات فقط' : 'يظهر لبعض السجلات فقط'),
  required: 'مطلوب',
  requiredTitle: 'مطلوب',
  rowWords: (items) => items.join('، '),
  kinds: {
    custom: 'مخصص',
    sideBySide: 'جنبًا إلى جنب',
    group: 'مجموعة',
    tabs: 'علامات تبويب',
    tabCount: (n) => plural('ar', n, { one: 'علامة تبويب واحدة', two: 'علامتا تبويب', few: '# علامات تبويب', many: '# علامة تبويب', other: '# علامة تبويب' }),
    tab: 'علامة تبويب',
    untitledTab: 'علامة تبويب بلا عنوان',
    page: 'صفحة',
    untitledPage: 'صفحة بلا عنوان',
    column: 'عمود',
    statusSteps: 'مراحل الحالة',
    status: 'الحالة',
    button: 'زر',
    counter: 'عدّاد',
    badge: 'شارة',
    heading: 'عنوان',
    note: 'ملاحظة',
    words: 'نص',
    divider: 'خط فاصل',
    spacer: 'مسافة',
    image: 'صورة',
    slot: 'جزء خاص بالتطبيق',
    part: 'جزء',
  },
  columnsStacked: (n) => `${plural('ar', n, { two: 'عمودان', few: '# أعمدة', many: '# عمودًا', other: '# عمود' })}، وتُرصّ في الشاشات الأصغر كما يرصّها المظهر`,
  columnsAt: (desktop, tablet, phone) => {
    const at = (n: number | undefined, screen: string) => (n === undefined ? `${screen}: كما يرصّها المظهر` : `${screen}: ${n}`);
    return `الأعمدة — ${at(desktop, SCREENS.desktop)}، ${at(tablet, SCREENS.tablet)}، ${at(phone, SCREENS.phone)}`;
  },
  it: 'الجزء',
  part: 'جزء',
  parts,
  tookOff: (what) => `تمت إزالة ${typeof what === 'number' ? partsAfter(what) : quoteAr(what)} من الصفحة`,
  notTakenOff: 'لم تتم الإزالة',
  notMoved: 'لم يتم النقل',
  notHere: 'ليس هنا',
  stays: (one) => (one ? 'في مكانه الحالي' : 'في مكانها الحالي'),
  before: (name) => `قبل ${name}`,
  after: (name) => `بعد ${name}`,
  into: (into, before) => `${into === null ? 'إلى الصفحة' : `إلى داخل ${into}`}، ${before === null ? 'في النهاية' : `قبل ${before}`}`,
  pickToMove: 'اختر جزءًا لنقله',
  tabNotInTab: 'علامة التبويب تحمل أجزاء، لا علامات تبويب أخرى',
  tabAmongItsTabs: 'تنتقل علامة التبويب بين علامات تبويبها فقط',
  tabAmongTabs: 'توضع علامة التبويب بين علامات التبويب: اختر علامة تبويب للصقها بعدها',
  inOneOfTheTabs: 'ضعه في إحدى علامات التبويب',
  pageNotInPage: 'الصفحة تحمل أسئلة، لا صفحات أخرى',
  questionOnPage: 'يوضع السؤال في صفحة',
  notInsideItself: 'لا يمكن وضع الجزء داخل نفسه',
  holdsNoParts: (name) => `${name} لا يحمل أجزاء`,
  sameGroup: 'اختر أجزاء في المجموعة نفسها لنقلها معًا',
  atEdgeOfPage: (_one, end) => `في ${where[end]} الصفحة بالفعل`,
  atEdgeOfSurvey: (_one, end) => (end === 'bottom' ? 'في أسفل الصفحة الأخيرة بالفعل' : 'في أعلى الصفحة الأولى بالفعل'),
  atEdgeOf: (one, end, name, arrow) => `في ${where[end]} ${name} بالفعل: اضغط ${ltr(`Alt+${arrow}`)} ${one ? 'لإخراجه' : 'لإخراجها'}`,
  onPageItself: (_one) => 'على الصفحة نفسها، خارج أي مجموعة',
  noGroupBefore: (one) => (one ? 'لا مجموعة قبله لوضعه فيها' : 'لا مجموعة قبلها لوضعها فيها'),
  keys: [
    ['↑ / ↓', 'الانتقال إلى الصف السابق أو التالي'],
    ['← / →', 'طي الصف أو فتحه، أو الانتقال إلى الصف الذي يحتويه أو إلى أول جزء فيه'],
    ['Home / End', 'الانتقال إلى الصف الأول أو الأخير'],
    ['حرف', 'الانتقال إلى الصف التالي الذي يبدأ اسمه بهذا الحرف'],
    ['Enter', 'اختياره وإظهاره في الصفحة'],
    ['المسافة', 'اختياره (مع ⌘ أو Ctrl يُضاف إلى المختار)'],
    ['Shift+↑ / ↓', 'اختيار الصفوف التي في الطريق أيضًا'],
    ['Shift + نقر', 'اختيار كل الصفوف من الصف المختار إلى هذا الصف'],
    ['⌘ + نقر', 'إضافة صف إلى المختار أو إزالته منه (Ctrl + نقر في ويندوز)'],
    ['Alt+↑ / Alt+↓', 'نقل المختار قبل الصف الذي فوقه أو بعد الصف الذي تحته'],
    ['Alt+← / Alt+→', 'إخراج المختار من مجموعته، أو وضعه في المجموعة التي قبله'],
    ['Delete', 'إزالة المختار من الصفحة'],
  ],
};

export const clipboard: DesignerWords['clipboard'] = {
  keys: [
    ['⌘C', 'نسخ المختار، للصقه هنا أو في مصمم آخر'],
    ['⌘X', 'قص المختار'],
    ['⌘V', 'اللصق بعد المختار، أو داخل المجموعة المختارة'],
  ],
  part: 'جزء',
  parts: partsAfter,
  copied: (what) => `تم نسخ ${what}`,
  cut: (what) => `تم قص ${what}`,
  copiedNotCut: 'تم النسخ، لكن لم تتم الإزالة من الصفحة',
  nothingPasted: 'لم يُلصق شيء',
  pasted: (what, dropped) => `تم لصق ${what}${dropped ? `؛ وتُركت ${rules(dropped)}: ${dropped === 2 ? 'تقرآن' : 'تقرأ'} حقلًا ليس في هذه الصفحة` : ''}`,
  nothingToPaste: 'لا أجزاء من Fieldia للصق: انسخ أجزاء في مصمم Fieldia أولًا',
  listTakesColumns: 'القائمة تأخذ أعمدة لا أجزاء: الصقها في شاشة أو استبيان',
  pagesOrQuestions: 'الصق صفحات أو أسئلة، لا الاثنين معًا',
  surveyPages: 'صفحات الاستبيان توضع في استبيان',
};
