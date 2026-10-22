import type { DesignerWords } from '../../designer-words';
import { quoteAr } from '../speak';

const q = quoteAr;

/**
 * The designer's words in Urdu: looks to start from, and looks of one's own — saving, renaming, removing, and what
 * failed. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const looks: DesignerWords['looks'] = {
  presets: { fieldia: 'Fieldia', calm: 'پُرسکون', compact: 'گنجان', rounded: 'گول', night: 'رات' },
  sample: 'اب',
  needsName: 'انداز کو نام درکار ہے',
  tooLong: (most) => `نام زیادہ سے زیادہ ${most} حروف کا ہو سکتا ہے`,
  taken: (name) => `${q(name)} نام کا انداز پہلے سے موجود ہے`,
  yourLooks: 'آپ کے انداز',
  saveThisLook: 'یہ انداز محفوظ کریں…',
  cancel: 'منسوخ کریں',
  undo: 'کالعدم کریں',
  tryAgain: 'دوبارہ کوشش کریں',
  lookPresets: 'تیار انداز',
  startFrom: 'اس سے شروع کریں',
  presetsHint: 'نمایاں رنگ، فونٹ، فاصلے، کونے اور رنگ ایک ساتھ طے کرتا ہے۔ ہر ایک کو آپ بعد میں بدل سکتے ہیں، اور اپنا انداز دوبارہ استعمال کے لیے محفوظ کیا جا سکتا ہے۔',
  failed: (what, reason) => (reason ? `${what}: ${reason}` : `${what}۔ تھوڑی دیر میں دوبارہ کوشش کریں۔`),
  renameOrRemoveNamed: (name) => `${q(name)} کا نام بدلیں یا ہٹائیں`,
  renameOrRemove: 'نام بدلیں یا ہٹائیں',
  rename: 'نام بدلیں…',
  remove: 'ہٹائیں',
  newNameFor: (name) => `${q(name)} کا نیا نام`,
  nameThisLook: 'اس انداز کا نام رکھیں',
  renameButton: 'نام بدلیں',
  save: 'محفوظ کریں',
  couldNotRename: (name) => `${q(name)} کا نام نہیں بدلا جا سکا`,
  couldNotSave: (name) => `${q(name)} محفوظ نہیں کیا جا سکا`,
  couldNotRemove: (name) => `${q(name)} ہٹایا نہیں جا سکا`,
  removed: (name) => `${q(name)} ہٹا دیا گیا۔`,
  couldNotBringBack: (name) => `${q(name)} واپس نہیں لایا جا سکا`,
  yourOwn: 'آپ کا اپنا',
  asTheSkin: 'بنیادی انداز کے مطابق',
  couldNotLoad: 'آپ کے انداز لوڈ نہیں ہو سکے',
};
