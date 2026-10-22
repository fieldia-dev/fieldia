import type { DesignerWords } from '../../designer-words';

/**
 * The designer's words in Farsi: the sheet of shortcuts — its groups, when each works, and the keys of the bar and of
 * typing (the canvas's, the outline's and the clipboard's are theirs).
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const shortcuts: DesignerWords['shortcuts'] = {
  title: 'میان‌برهای صفحه‌کلید',
  findKey: 'یافتن کلید',
  findPlaceholder: 'یافتن یک کلید، یا کاری که انجام می‌دهد',
  close: 'بستن',
  keys: 'کلیدها',
  none: 'هیچ کلیدی این کار را نمی‌کند.',
  groups: { Anywhere: 'همه‌جا', Canvas: 'بوم طراحی', Outline: 'ساختار', Typing: 'هنگام تایپ' },
  when: {
    Anywhere: 'بیرون از کادری که در آن تایپ می‌شود',
    Canvas: 'در حالت پیشرفته، با یک جزء انتخاب‌شده',
    Outline: 'با تمرکز روی یک ردیف از ساختار',
    Typing: 'در یک برچسب، یک متن راهنما یا یک عنوان',
  },
  anywhere: [
    ['⌘K یا /', 'یافتن هر چیز: یک فیلد، یک نوع، یک تنظیم، یک اقدام'],
    ['⌘Z', 'واگرد'],
    ['⌘⇧Z یا ⌘Y', 'ازنو'],
    ['?', 'همین فهرست کلیدها'],
    ['Esc', 'لغو انتخاب موارد انتخاب‌شده'],
  ],
  typing: [
    ['Enter', 'از برچسب به متن راهنمای آن، و از متن راهنما به بیرون'],
    ['Esc', 'ترک کادر و لغو انتخاب جزء'],
    ['⌘C / ⌘X / ⌘V', 'کپی، برش و چسباندن متن، مثل همیشه'],
  ],
  surveyTyping: [
    ['⌘⇧Enter', 'افزودن پرسشی پس از این پرسش'],
    ['⌘⇧D', 'تکثیر پرسش'],
    ['⌘⇧K / ⌘⇧J', 'جابه‌جایی پرسش به بالا یا پایین'],
  ],
};
