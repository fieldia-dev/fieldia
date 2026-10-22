import type { DesignerWords } from '../../designer-words';
import { ltr, quoteAr } from '../speak';

const q = quoteAr;

/**
 * The designer's words in Urdu: a related list on a record's page, in the designer — its tile, its panel (its title,
 * the records it lists and their link to this one, its columns, its cards on a phone, rows a page, New and View all)
 * and the words its new one starts with. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const relatedPart: DesignerWords['relatedPart'] = {
  tile: 'متعلقہ فہرست',
  tileTip: 'کسی دوسری قسم کے ریکارڈز جو اس ریکارڈ کی طرف اشارہ کرتے ہیں، اسی کے اندر فہرست کی صورت میں: کسی گاہک کی انوائسز، کسی جائیداد کے معائنے',
  newTitle: 'متعلقہ ریکارڈز',
  name: 'نام',
  title: 'عنوان',
  model: 'ریکارڈز کا ڈیٹا ماڈل',
  modelHint: `ان کا ڈیٹا ماڈل، جیسا آپ کا ڈیٹا سورس اسے نام دیتا ہے: ${ltr('invoice')}، ${ltr('sale.order')}۔`,
  field: 'اس ریکارڈ سے ان کا لنک',
  fieldHint: (model) => `ان کی ایک فیلڈ جو ${model} کی طرف اشارہ کرتی ہے: ${ltr('partner_id')}۔ فہرست وہ ریکارڈز دکھاتی ہے جن کا لنک یہ ریکارڈ ہو۔`,
  columns: 'کالم',
  columnName: (n) => `کالم ${n}: اس کی فیلڈ`,
  columnLabel: (n) => `کالم ${n}: اس کا متن`,
  columnKind: (n) => `کالم ${n}: اس کی قسم`,
  kinds: { char: 'متن', integer: 'مکمل عدد', float: 'عدد', monetary: 'رقم', date: 'تاریخ', datetime: 'تاریخ اور وقت', boolean: 'ہاں یا نہیں', selection: 'انتخاب', many2one: 'لنک', text: 'طویل متن' },
  removeColumn: (label) => `کالم ${label} ہٹائیں`,
  addColumn: 'کالم شامل کریں',
  newColumn: (n) => `کالم ${n}`,
  lastColumn: 'متعلقہ فہرست کم از کم ایک کالم دکھاتی ہے۔',
  rows: 'فی صفحہ قطاریں',
  rowsHint: 'جب تک کچھ اور نہ بتایا جائے 5: اس سے زیادہ ہوں تو صفحہ بندی اور تلاش دکھائی دیتی ہے۔',
  newWord: 'نیا',
  create: '«نیا» پیش کریں، جو اس ریکارڈ سے لنک بھرا ہوا ایک نیا ریکارڈ بناتا ہے',
  createHint: 'اس صفحے کے ڈائیلاگ میں جو آپ کی ایپ ان کے ماڈل کے لیے دیتی ہے؛ جہاں کوئی صفحہ نہ ہو وہاں «نیا» پیش نہیں کیا جاتا۔',
  viewAll: '«سب دیکھیں» یہ صفحہ کھولتا ہے',
  viewAllHint: 'آپ کی ایپ میں ان کی فہرست، اس کی id سے، جو صرف اس ریکارڈ کے ریکارڈز دکھاتی ہے۔ خالی: کوئی «سب دیکھیں» نہیں۔',
  opensIn: '«سب دیکھیں» کہاں کھلے',
  opens: { dialog: 'ڈائیلاگ', panel: 'سائیڈ پینل', page: 'اسی جگہ' },
  rowsOpen: 'قطاریں اور «نیا» کہاں کھلیں',
  rowsOpenHint: `آپ کی ایپ کا اپنا طریقہ: پہلے اس کے ${ltr('onOpen')} سے پوچھا جاتا ہے، ریکارڈ کے صفحے اور id کے ساتھ، یا نئے ریکارڈ کے اس ریکارڈ سے لنک کے ساتھ؛ اگر وہ اسے نہ لے تو ڈائیلاگ۔`,
  rowsOpenIn: { dialog: 'ڈائیلاگ', app: 'آپ کی ایپ کا طریقہ' },
  onlyOnRecords: 'متعلقہ فہرست ریکارڈ کے صفحے پر ہوتی ہے: یہ صفحہ جوابات جمع کرتا ہے۔',
  noModel: 'جن ریکارڈز کی یہ فہرست بناتی ہے ان کے ماڈل کا نام لکھیں، جیسا آپ کا ڈیٹا سورس اسے نام دیتا ہے۔',
  notAName: (name) => `${q(name)} کسی فیلڈ کا نام نہیں: حروف، ہندسے اور ${ltr('_')}، اور ہندسے سے شروع نہ ہو`,
  columnTwice: (name) => `${q(name)} پہلے سے ایک کالم ہے`,
  cards: 'فون پر کارڈز',
  notTheirs: (name) => `${q(name)} اس کے ریکارڈز کی فیلڈز میں سے نہیں: پہلے اسے کالم کے طور پر شامل کریں`,
  previewNote: 'ریکارڈ محفوظ ہونے کے بعد اس کے ریکارڈز «آزمائیں» میں دکھائی دیتے ہیں۔',
  more: (n) => `اس کے اپنے JSON میں ${n} مزید: ایک فلٹر، چھانٹنے کی ترتیب، اس کے سیل`,
};
