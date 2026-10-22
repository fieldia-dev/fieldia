import type { DesignerWords } from '../../designer-words';
import { ltr, quoteAr } from '../speak';

const q = quoteAr;

/**
 * The designer's words in Farsi: a related list on a record's page, in the designer — its tile, its panel (its title,
 * the records it lists and their link to this one, its columns, its cards on a phone, rows a page, New and View all)
 * and the words its new one starts with.
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const relatedPart: DesignerWords['relatedPart'] = {
  tile: 'فهرست مرتبط',
  tileTip: 'رکوردهایی از نوعی دیگر که به این رکورد اشاره می‌کنند، فهرست‌شده درون آن: فاکتورهای یک مشتری، بازدیدهای یک ملک',
  newTitle: 'رکوردهای مرتبط',
  name: 'نام',
  title: 'عنوان',
  model: 'مدل دادهٔ رکوردها',
  modelHint: `مدل داده‌شان، همان‌گونه که منبع داده‌هایتان آن را می‌نامد: ${ltr('invoice')}، ${ltr('sale.order')}.`,
  field: 'پیوند آن‌ها به این رکورد',
  fieldHint: (model) => `فیلدی از آن‌ها که به یک ${model} اشاره می‌کند: ${ltr('partner_id')}. فهرست، آن‌هایی را نشان می‌دهد که پیوندشان این رکورد است.`,
  columns: 'ستون‌ها',
  columnName: (n) => `ستون ${n}: فیلد آن`,
  columnLabel: (n) => `ستون ${n}: متن آن`,
  columnKind: (n) => `ستون ${n}: نوع آن`,
  kinds: {
    char: 'متن',
    integer: 'عدد صحیح',
    float: 'عدد',
    monetary: 'مبلغ',
    date: 'تاریخ',
    datetime: 'تاریخ و ساعت',
    boolean: 'بله یا خیر',
    selection: 'گزینه',
    many2one: 'پیوند',
    text: 'متن بلند',
  },
  removeColumn: (label) => `برداشتن ستون ${label}`,
  addColumn: 'افزودن ستون',
  newColumn: (n) => `ستون ${n}`,
  lastColumn: 'فهرست مرتبط دست‌کم یک ستون نشان می‌دهد.',
  rows: 'ردیف در هر صفحه',
  rowsHint: '5، مگر آنکه چیز دیگری گفته شود: بیش از آن، صفحه‌بندی و جستجو نمایش داده می‌شود.',
  newWord: 'جدید',
  create: 'نمایش «جدید»، که رکوردی می‌سازد با پیوندی به این رکورد که از پیش پر شده است',
  createHint: 'در پنجرهٔ محاوره‌ای با صفحه‌ای که برنامهٔ شما برای مدل داده‌شان می‌دهد؛ اگر صفحه‌ای ندهد، «جدید» نمایش داده نمی‌شود.',
  viewAll: '«مشاهدهٔ همه» این صفحه را باز می‌کند',
  viewAllHint: 'فهرست آن‌ها در برنامهٔ شما، با شناسه‌اش، که فقط رکوردهای همین رکورد را نشان می‌دهد. خالی: بدون «مشاهدهٔ همه».',
  opensIn: '«مشاهدهٔ همه» باز می‌شود در',
  opens: { dialog: 'پنجرهٔ محاوره‌ای', panel: 'پنل کناری', page: 'در همان‌جا' },
  rowsOpen: 'ردیف‌ها و «جدید» باز می‌شوند در',
  rowsOpenHint: `به روش خود برنامهٔ شما: نخست از ${ltr('onOpen')} آن پرسیده می‌شود، با صفحه و شناسهٔ رکورد، یا با پیوند رکورد جدید به این رکورد؛ اگر آن را نپذیرد، در یک پنجرهٔ محاوره‌ای.`,
  rowsOpenIn: { dialog: 'پنجرهٔ محاوره‌ای', app: 'روش برنامهٔ شما' },
  onlyOnRecords: 'فهرست مرتبط به صفحهٔ یک رکورد تعلق دارد: این صفحه پاسخ جمع‌آوری می‌کند.',
  noModel: 'مدل داده رکوردهایی را که فهرست می‌کند نام ببرید، همان‌گونه که منبع داده‌هایتان آن را می‌نامد.',
  notAName: (name) => `${q(name)} نام یک فیلد نیست: حروف، رقم‌ها و ${ltr('_')}، بدون آغاز با رقم`,
  columnTwice: (name) => `${q(name)} هم‌اکنون یک ستون است`,
  cards: 'کارت‌ها در تلفن همراه',
  notTheirs: (name) => `${q(name)} از فیلدهای رکوردهای آن نیست: نخست آن را به‌عنوان ستون بیفزایید`,
  previewNote: 'رکوردهای آن پس از ذخیرهٔ رکورد، در «امتحان» نمایش داده می‌شوند.',
  more: (n) => `${n} مورد دیگر در JSON خودش: یک فیلتر، یک ترتیب، خانه‌هایش`,
};
