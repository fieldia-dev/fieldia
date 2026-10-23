import type { GanttLabels } from '../labels';

/**
 * The Gantt timeline's words in Urdu. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 *
 * A bar's sentences name its start and its end ("{name} کا آغاز", "{name} کا اختتام") or mark it with کو, so that no
 * verb agrees with a record's title, whose gender is not known.
 */
export const ur: GanttLabels = {
  timeline: 'ٹائم لائن',
  today: 'آج',
  zooms: { day: 'دن', week: 'ہفتے', month: 'مہینے' },
  showAs: 'ٹائم لائن کو اس لحاظ سے دکھائیں',
  noGroup: 'کوئی نہیں',
  collapse: '{name} چھپائیں',
  expand: '{name} دکھائیں',
  holds: '{n} ریکارڈ',
  holdsOne: '1 ریکارڈ',
  holdsNoun: '{n} {records}',
  holdsNounOne: '1 {record}',
  loadFailed: 'ٹائم لائن لوڈ نہیں ہو سکی۔',
  retry: 'دوبارہ کوشش کریں',
  nothing: 'ٹائم لائن پر دکھانے کے لیے کچھ نہیں۔',
  tooMany: 'کل {total} میں سے پہلے {shown} دکھائے جا رہے ہیں: سب دیکھنے کے لیے تلاش کو محدود کریں۔',
  notPlanned: 'آغاز ابھی طے نہیں',
  fromTo: '{from} سے {to} تک',
  on: '{day} کو',
  days: '{n} دن',
  dayOne: '1 دن',
  waitsFor: '{names} کا انتظار',
  late: 'آغاز {name} کے ختم ہونے سے پہلے',
  keysOpen: 'Enter سے کھولیں۔',
  keysMove: 'بائیں اور دائیں تیر والی کلیدوں سے ایک دن منتقل کریں؛ Shift کے ساتھ، اس کا اختتام۔',
  keysRows: 'اوپر اور نیچے تیر والی کلیدوں سے اوپر یا نیچے والی پٹی پر جائیں۔',
  moved: '{name} کو {from} سے {to} پر منتقل کر دیا گیا۔',
  stretched: '{name} کا اختتام اب {when} کو ہے۔',
  started: '{name} کا آغاز اب {when} کو ہے۔',
  undo: 'کالعدم کریں',
  undone: 'پہلے جیسا کر دیا گیا۔',
  close: 'بند کریں',
  notMoved: 'منتقلی نہیں ہو سکی: {why}',
  cannotMove: 'آپ اسے تبدیل نہیں کر سکتے۔',
  edgeBefore: 'دکھائے گئے دنوں سے پہلے: {n}',
  edgeAfter: 'دکھائے گئے دنوں کے بعد: {n}',
};
