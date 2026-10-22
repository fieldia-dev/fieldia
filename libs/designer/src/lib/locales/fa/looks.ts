import type { DesignerWords } from '../../designer-words';
import { quoteAr } from '../speak';

const q = quoteAr;

/**
 * The designer's words in Farsi: looks to start from, and looks of one's own — saving, renaming, removing, and what
 * failed.
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const looks: DesignerWords['looks'] = {
  presets: { fieldia: 'Fieldia', calm: 'آرام', compact: 'فشرده', rounded: 'گرد', night: 'شب' },
  sample: 'آب',
  needsName: 'ظاهر به یک نام نیاز دارد',
  tooLong: (most) => `نام حداکثر ${most} نویسه است`,
  taken: (name) => `ظاهری با نام ${q(name)} از قبل وجود دارد`,
  yourLooks: 'ظاهرهای شما',
  saveThisLook: 'ذخیرهٔ این ظاهر…',
  cancel: 'لغو',
  undo: 'واگرد',
  tryAgain: 'تلاش دوباره',
  lookPresets: 'ظاهرهای آماده',
  startFrom: 'شروع از',
  presetsHint:
    'رنگ تأکید، قلم، فاصله‌گذاری، گوشه‌ها و رنگ‌ها را یک‌جا تنظیم می‌کند. هر کدام همچنان برای تغییر در اختیار شماست، و ظاهری از آنِ خودتان را می‌توان برای استفادهٔ دوباره ذخیره کرد.',
  failed: (what, reason) => (reason ? `${what}: ${reason}` : `${what}. لحظه‌ای دیگر دوباره تلاش کنید.`),
  renameOrRemoveNamed: (name) => `تغییر نام یا برداشتن ${q(name)}`,
  renameOrRemove: 'تغییر نام یا برداشتن',
  rename: 'تغییر نام…',
  remove: 'برداشتن',
  newNameFor: (name) => `نام جدید برای ${q(name)}`,
  nameThisLook: 'برای این ظاهر نامی بگذارید',
  renameButton: 'تغییر نام',
  save: 'ذخیره',
  couldNotRename: (name) => `تغییر نام ${q(name)} ممکن نشد`,
  couldNotSave: (name) => `ذخیرهٔ ${q(name)} ممکن نشد`,
  couldNotRemove: (name) => `برداشتن ${q(name)} ممکن نشد`,
  removed: (name) => `${q(name)} برداشته شد.`,
  couldNotBringBack: (name) => `بازگرداندن ${q(name)} ممکن نشد`,
  yourOwn: 'ظاهر خودتان',
  asTheSkin: 'مانند پوسته',
  couldNotLoad: 'ظاهرهای شما بارگیری نشد',
};
