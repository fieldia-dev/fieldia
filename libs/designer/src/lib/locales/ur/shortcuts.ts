import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Urdu: the sheet of shortcuts — its groups, when each works, and the keys of the bar and of
 * typing (the canvas's, the outline's and the clipboard's are theirs). UNREVIEWED: machine-assisted, not yet reviewed
 * by a native speaker.
 */
export const shortcuts: DesignerWords['shortcuts'] = {
  title: 'کی بورڈ شارٹ کٹس',
  findKey: 'شارٹ کٹ تلاش کریں',
  findPlaceholder: 'کوئی شارٹ کٹ، یا اس کا کام تلاش کریں',
  close: 'بند کریں',
  keys: 'کلیدیں',
  none: 'کوئی شارٹ کٹ یہ کام نہیں کرتا۔',
  groups: { Anywhere: 'کہیں بھی', Canvas: 'ڈیزائن کی جگہ', Outline: 'خاکہ', Typing: 'لکھتے وقت' },
  when: {
    Anywhere: 'لکھنے کے خانے سے باہر',
    Canvas: 'اعلیٰ موڈ میں، جب کوئی جز منتخب ہو',
    Outline: 'جب خاکے کی کسی قطار پر فوکس ہو',
    Typing: 'لیبل، مدد کے متن یا عنوان میں',
  },
  anywhere: [
    ['⌘K یا /', 'کچھ بھی تلاش کریں: فیلڈ، قسم، سیٹنگ، کارروائی'],
    ['⌘Z', 'کالعدم کریں'],
    ['⌘⇧Z یا ⌘Y', 'دوبارہ کریں'],
    ['?', 'شارٹ کٹس کی یہ فہرست'],
    ['Esc', 'منتخب شدہ کا انتخاب ختم کریں'],
  ],
  typing: [
    ['Enter', 'لیبل سے اس کے مدد کے متن پر، اور مدد کے متن سے باہر'],
    ['Esc', 'خانے سے نکلیں، اور جز کا انتخاب ختم کریں'],
    ['⌘C / ⌘X / ⌘V', 'متن کو حسبِ معمول کاپی کریں، کاٹیں اور چسپاں کریں'],
  ],
  surveyTyping: [
    ['⌘⇧Enter', 'اس سوال کے بعد ایک سوال شامل کریں'],
    ['⌘⇧D', 'سوال کی نقل بنائیں'],
    ['⌘⇧K / ⌘⇧J', 'سوال کو اوپر یا نیچے منتقل کریں'],
  ],
};
