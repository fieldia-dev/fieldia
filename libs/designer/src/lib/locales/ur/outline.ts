import type { DesignerWords } from '../../designer-words';
import { ltr, plural, quoteAr } from '../speak';

const parts = (n: number) => plural('ur', n, { one: '# جز', other: '# اجزا' });
const SCREENS = { desktop: 'ڈیسک ٹاپ', tablet: 'ٹیبلیٹ', phone: 'فون' };
const where = { top: 'سب سے اوپر', bottom: 'سب سے نیچے' } as const;
/** "It is" / "They are", said before where the parts stand. */
const they = (one: boolean) => (one ? 'یہ' : 'یہ سب');
const are = (one: boolean) => (one ? 'ہے' : 'ہیں');

/**
 * The designer's words in Urdu: the outline — the page's parts as a tree, each row named with its kind, and what
 * moving rows by drag or by key says. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const outline: DesignerWords['outline'] = {
  label: 'خاکہ',
  tree: 'صفحے کے اجزا',
  empty: 'صفحے پر ابھی کچھ نہیں۔',
  help: (survey) =>
    `${survey ? 'صفحات اور ان کے سوالات۔ قطار منتقل کرنے کے لیے اسے گھسیٹیں۔' : 'قطار منتقل کرنے کے لیے اسے گھسیٹیں؛ گروپ کے اندر رکھنے کے لیے اسے گروپ کے درمیان میں چھوڑیں۔'} {⇧} کے ساتھ کلک کئی منتخب کرتا ہے؛ {Alt} کے ساتھ تیر منتخب شدہ کو منتقل کرتا ہے؛ {?} تمام شارٹ کٹس دکھاتا ہے۔`,
  ruled: (survey) => (survey ? 'صرف کچھ جوابات کے لیے دکھایا جاتا ہے' : 'صرف کچھ ریکارڈز کے لیے دکھایا جاتا ہے'),
  ruledTitle: (survey) => (survey ? 'صرف کچھ جوابات کے لیے دکھایا جاتا ہے' : 'صرف کچھ ریکارڈز کے لیے دکھایا جاتا ہے'),
  required: 'لازمی',
  requiredTitle: 'لازمی',
  rowWords: (items) => items.join('، '),
  kinds: {
    custom: 'حسب ضرورت',
    sideBySide: 'ساتھ ساتھ',
    group: 'گروپ',
    tabs: 'ٹیبز',
    tabCount: (n) => plural('ur', n, { one: '# ٹیب', other: '# ٹیب' }),
    tab: 'ٹیب',
    untitledTab: 'بے عنوان ٹیب',
    page: 'صفحہ',
    untitledPage: 'بے عنوان صفحہ',
    column: 'کالم',
    statusSteps: 'حالت کے مراحل',
    status: 'حالت',
    button: 'بٹن',
    counter: 'کاؤنٹر',
    badge: 'بیج',
    heading: 'سرخی',
    note: 'نوٹ',
    words: 'متن',
    divider: 'لکیر',
    spacer: 'خالی جگہ',
    image: 'تصویر',
    map: 'نقشہ',
    related: 'متعلقہ فہرست',
    slot: 'ایپ کا اپنا جز',
    form: 'محفوظ فارم',
    part: 'جز',
  },
  columnsStacked: (n) => `${n} کالم، چھوٹی اسکرینوں پر بنیادی انداز کے مطابق ایک کے نیچے ایک`,
  columnsAt: (desktop, tablet, phone) => {
    const at = (n: number | undefined, screen: string) => (n === undefined ? `${screen}: بنیادی انداز کے مطابق` : `${screen}: ${n}`);
    return `کالم — ${at(desktop, SCREENS.desktop)}، ${at(tablet, SCREENS.tablet)}، ${at(phone, SCREENS.phone)}`;
  },
  it: 'جز',
  part: 'جز',
  parts,
  tookOff: (what) =>
    `${typeof what === 'number' ? parts(what) : quoteAr(what)} صفحے سے ${typeof what === 'number' && what !== 1 ? 'ہٹا دیے گئے' : 'ہٹا دیا گیا'}`,
  notTakenOff: 'نہیں ہٹایا گیا',
  notMoved: 'منتقل نہیں کیا گیا',
  notHere: 'یہاں نہیں',
  stays: (_one) => 'اپنی جگہ پر',
  before: (name) => `${name} سے پہلے`,
  after: (name) => `${name} کے بعد`,
  into: (into, before) => `${into === null ? 'صفحے پر' : `${into} کے اندر`}، ${before === null ? 'آخر میں' : `${before} سے پہلے`}`,
  pickToMove: 'منتقل کرنے کے لیے کوئی جز منتخب کریں',
  tabNotInTab: 'ٹیب میں اجزا ہوتے ہیں، دوسرے ٹیب نہیں',
  tabAmongItsTabs: 'ٹیب صرف اپنے ٹیبز کے درمیان منتقل ہوتا ہے',
  tabAmongTabs: 'ٹیب، ٹیبز کے درمیان جاتا ہے: جس ٹیب کے بعد چسپاں کرنا ہو اسے منتخب کریں',
  inOneOfTheTabs: 'اسے کسی ایک ٹیب میں رکھیں',
  pageNotInPage: 'صفحے میں سوالات ہوتے ہیں، دوسرے صفحات نہیں',
  questionOnPage: 'سوال کسی صفحے پر جاتا ہے',
  notInsideItself: 'کوئی جز اپنے ہی اندر نہیں جا سکتا',
  holdsNoParts: (name) => `${name} میں کوئی جز نہیں رکھا جا سکتا`,
  sameGroup: 'ایک ساتھ منتقل کرنے کے لیے ایک ہی گروپ کے اجزا منتخب کریں',
  atEdgeOfPage: (one, end) => `${they(one)} پہلے ہی صفحے میں ${where[end]} ${are(one)}`,
  atEdgeOfSurvey: (one, end) => `${they(one)} پہلے ہی ${end === 'bottom' ? 'آخری صفحے میں سب سے نیچے' : 'پہلے صفحے میں سب سے اوپر'} ${are(one)}`,
  atEdgeOf: (one, end, name, arrow) =>
    `${they(one)} پہلے ہی ${name} میں ${where[end]} ${are(one)}: ${one ? 'اسے' : 'انہیں'} باہر نکالنے کے لیے ${ltr(`Alt+${arrow}`)} دبائیں`,
  onPageItself: (one) => `${they(one)} براہِ راست صفحے پر ${are(one)}، کسی گروپ میں نہیں`,
  noGroupBefore: (one) => (one ? 'اس سے پہلے کوئی گروپ نہیں جس میں اسے رکھا جائے' : 'ان سے پہلے کوئی گروپ نہیں جس میں انہیں رکھا جائے'),
  keys: [
    ['↑ / ↓', 'پچھلی یا اگلی قطار پر جائیں'],
    ['← / →', 'قطار کو سمیٹیں یا کھولیں، یا اس قطار پر جائیں جس میں یہ ہے، یا اس کے پہلے جز پر'],
    ['Home / End', 'پہلی یا آخری قطار پر جائیں'],
    ['کوئی حرف', 'اگلی ایسی قطار پر جائیں جس کا نام اس حرف سے شروع ہوتا ہے'],
    ['Enter', 'اسے منتخب کریں اور صفحے پر دکھائیں'],
    ['اسپیس', 'اسے منتخب کریں (⌘ یا Ctrl کے ساتھ یہ منتخب شدہ میں شامل ہو جاتی ہے)'],
    ['Shift+↑ / ↓', 'راستے کی قطاریں بھی منتخب کریں'],
    ['Shift + کلک', 'منتخب قطار سے اس قطار تک ہر قطار منتخب کریں'],
    ['⌘ + کلک', 'ایک اور قطار منتخب کریں، یا اسے انتخاب سے نکالیں (ونڈوز پر Ctrl + کلک)'],
    ['Alt+↑ / Alt+↓', 'منتخب شدہ کو اوپر والی قطار سے پہلے یا نیچے والی قطار کے بعد منتقل کریں'],
    ['Alt+← / Alt+→', 'منتخب شدہ کو اس کے گروپ سے باہر نکالیں، یا اس سے پہلے والے گروپ میں رکھیں'],
    ['Delete', 'منتخب شدہ کو صفحے سے ہٹائیں'],
  ],
};

/**
 * The designer's words in Urdu: copying, cutting and pasting parts, and what each says it did.
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const clipboard: DesignerWords['clipboard'] = {
  keys: [
    ['⌘C', 'منتخب شدہ کو کاپی کریں، یہاں یا کسی دوسرے ڈیزائنر میں چسپاں کرنے کے لیے'],
    ['⌘X', 'منتخب شدہ کو کاٹیں'],
    ['⌘V', 'منتخب شدہ کے بعد چسپاں کریں، یا منتخب گروپ کے اندر'],
  ],
  part: 'جز',
  parts,
  copied: (what) => `کاپی کیا گیا: ${what}`,
  cut: (what) => `کاٹا گیا: ${what}`,
  copiedNotCut: 'کاپی ہو گیا، لیکن صفحے سے نہیں ہٹایا گیا',
  nothingPasted: 'کچھ بھی چسپاں نہیں کیا گیا',
  pasted: (what, dropped) =>
    `چسپاں کیا گیا: ${what}${
      dropped
        ? `؛ ${plural('ur', dropped, {
            one: '# قاعدہ چھوڑ دیا گیا: یہ ایسی فیلڈ پڑھتا ہے جو اس صفحے پر نہیں ہے',
            other: '# قواعد چھوڑ دیے گئے: یہ ایسی فیلڈ پڑھتے ہیں جو اس صفحے پر نہیں ہے',
          })}`
        : ''
    }`,
  nothingToPaste: 'چسپاں کرنے کے لیے Fieldia کے کوئی اجزا نہیں: پہلے کسی Fieldia ڈیزائنر میں اجزا کاپی کریں',
  listTakesColumns: 'فہرست میں کالم آتے ہیں، اجزا نہیں: انہیں کسی اسکرین یا سروے پر چسپاں کریں',
  pagesOrQuestions: 'صفحات یا سوالات چسپاں کریں، دونوں ایک ساتھ نہیں',
  surveyPages: 'سروے کے صفحات سروے ہی میں جاتے ہیں',
};
