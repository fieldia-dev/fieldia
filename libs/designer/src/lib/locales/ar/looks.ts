import type { DesignerWords } from '../../designer-words';
import { quoteAr } from '../speak';

const q = quoteAr;

export const looks: DesignerWords['looks'] = {
  presets: { fieldia: 'Fieldia', calm: 'هادئ', compact: 'متقارب', rounded: 'مستدير', night: 'ليلي' },
  sample: 'أب',
  needsName: 'يحتاج المظهر إلى اسم',
  tooLong: (most) => `الاسم ${most} حرفًا على الأكثر`,
  taken: (name) => `يوجد مظهر باسم ${q(name)} بالفعل`,
  yourLooks: 'مظاهرك',
  saveThisLook: 'حفظ هذا المظهر…',
  cancel: 'إلغاء',
  undo: 'تراجع',
  tryAgain: 'أعد المحاولة',
  lookPresets: 'مظاهر جاهزة',
  startFrom: 'ابدأ من',
  presetsHint: 'يضبط لون التمييز والخط والتباعد والزوايا والألوان دفعة واحدة. ويبقى كلٌّ منها لك لتغيّره، ويمكن حفظ مظهر خاص بك لاستخدامه مرة أخرى.',
  failed: (what, reason) => (reason ? `${what}: ${reason}` : `${what}. أعد المحاولة بعد قليل.`),
  renameOrRemoveNamed: (name) => `إعادة تسمية ${q(name)} أو إزالته`,
  renameOrRemove: 'إعادة التسمية أو الإزالة',
  rename: 'إعادة التسمية…',
  remove: 'إزالة',
  newNameFor: (name) => `اسم جديد لـ${q(name)}`,
  nameThisLook: 'سمِّ هذا المظهر',
  renameButton: 'إعادة التسمية',
  save: 'حفظ',
  couldNotRename: (name) => `تعذّرت إعادة تسمية ${q(name)}`,
  couldNotSave: (name) => `تعذّر حفظ ${q(name)}`,
  couldNotRemove: (name) => `تعذّرت إزالة ${q(name)}`,
  removed: (name) => `أُزيل ${q(name)}.`,
  couldNotBringBack: (name) => `تعذّرت استعادة ${q(name)}`,
  yourOwn: 'مظهرك',
  asTheSkin: 'كما في النمط',
  couldNotLoad: 'تعذّر تحميل مظاهرك',
};
