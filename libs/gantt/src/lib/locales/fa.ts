import type { GanttLabels } from '../labels';

/**
 * The Gantt timeline's words in Farsi (Persian). UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const fa: GanttLabels = {
  timeline: 'خط زمانی',
  today: 'امروز',
  zooms: { day: 'روزها', week: 'هفته‌ها', month: 'ماه‌ها' },
  showAs: 'نمایش خط زمانی بر اساس',
  noGroup: 'بدون گروه',
  collapse: 'پنهان کردن {name}',
  expand: 'نمایش {name}',
  // Farsi takes the singular noun after a number.
  holds: '{n} رکورد',
  holdsOne: '1 رکورد',
  holdsNoun: '{n} {record}',
  holdsNounOne: '1 {record}',
  loadFailed: 'خط زمانی بارگیری نشد.',
  retry: 'تلاش دوباره',
  nothing: 'چیزی برای نمایش روی خط زمانی نیست.',
  tooMany: 'نمایش {shown} مورد نخست از {total}: برای دیدن همه، جستجو را محدودتر کنید.',
  notPlanned: 'هنوز تاریخ آغاز ندارد',
  fromTo: '{from} تا {to}',
  on: 'در {day}',
  days: '{n} روز',
  dayOne: '1 روز',
  waitsFor: 'در انتظار {names}',
  late: 'پیش از پایان {name} آغاز می‌شود',
  keysOpen: 'Enter آن را باز می‌کند.',
  keysMove: 'کلیدهای جهت‌نمای چپ و راست آن را یک روز جابه‌جا می‌کنند؛ همراه با Shift، پایان آن را.',
  keysRows: 'کلیدهای جهت‌نمای بالا و پایین به نوار بالایی یا پایینی می‌روند.',
  moved: '{name} جابه‌جا شد: {from} تا {to}.',
  stretched: 'پایان {name} اکنون {when} است.',
  started: 'آغاز {name} اکنون {when} است.',
  undo: 'واگرد',
  undone: 'به حالت قبل برگشت.',
  close: 'بستن',
  notMoved: 'جابه‌جا نشد: {why}',
  cannotMove: 'شما نمی‌توانید این مورد را تغییر دهید.',
};
