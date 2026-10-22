import type { DesignerWords } from '../../designer-words';
import { ltr, plural, quoteAr } from '../speak';

/** The ways a width is written, each kept left to right in the sentence. */
const ways = `پکسل (${ltr('274px')})، قطار کا حصہ (${ltr('50%')}) یا باقی جگہ کا حصہ (${ltr('1fr')})`;

/**
 * The designer's words in Urdu: a work item's body in the designer — a group's own column widths and gap, its fold
 * control at the heading's end and its ⤢; help in a light box with an icon; a formatted text's toolbar, tools and
 * editors; a links box. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const workText: DesignerWords['workText'] = {
  columnWidths: 'کالموں کی چوڑائی',
  columnWidthsHint: `ہر کالم کے لیے ایک، اسپیس سے الگ: ${ways}۔ خالی ہو تو برابر کالم۔`,
  gap: 'کالموں کے درمیان فاصلہ',
  gapHint: 'پکسل میں، 0 سے 48 تک؛ خالی ہو تو انداز کا اپنا۔',
  foldControl: 'سمیٹنے کا بٹن',
  beforeTitle: 'عنوان سے پہلے',
  atHeadingEnd: 'سرخی کے آخر میں',
  maximise: 'بڑا کریں',
  maximiseHint: 'سرخی کے آخر میں ⤢ گروپ کو اکیلا، ریکارڈ کے مرکزی حصے کے اوپر دکھاتا ہے۔',
  tracksCount: (columns, widths) =>
    `گروپ میں ${columns} کالم اور ${plural('ur', widths, { one: '# چوڑائی', other: '# چوڑائیاں' })} ہیں: ہر کالم کے لیے ایک چوڑائی دیں۔`,
  noWidth: (track) => `${quoteAr(track)} چوڑائی نہیں: ${ways} لکھیں۔`,
  gapRange: 'کالموں کے درمیان فاصلہ 0 سے 48 تک پکسل کا مکمل عدد ہوتا ہے۔',
  foldNeedsFolding: 'پہلے «سمٹ سکتا ہے» آن کریں: سمیٹنے کا بٹن صرف سمٹنے والے گروپ میں ہوتا ہے۔',
  maximiseNeedsTitle: 'پہلے گروپ کو عنوان دیں: اسے اس کی سرخی سے بڑا کیا جاتا ہے۔',
  noIconHere: 'آئیکن صرف مدد کے خانے میں موجود متن کا ہوتا ہے۔',
  helpBox: 'مدد کا خانہ',
  helpBoxTitle: 'ہلکے رنگ کے خانے میں، آئیکن کی جگہ کے ساتھ، ورک آئٹم کی مدد کی طرح؛ اس میں ‏[متن](https://…) لنکس ہوتے ہیں',
  icon: 'آئیکن',
  noIcon: 'کوئی آئیکن نہیں',
  toolbarShown: 'ٹول بار',
  always: 'ہمیشہ',
  whileWorkedIn: 'اس میں کام کرتے وقت',
  never: 'کبھی نہیں',
  toolbarAt: 'ٹول بار کی جگہ',
  atTop: 'اوپر',
  atFoot: 'نیچے',
  editor: 'ایڈیٹر',
  richText: 'فارمیٹ شدہ متن',
  markdown: 'Markdown',
  switchEditor: 'لوگ ایڈیٹر بدل سکتے ہیں',
  readFirst: 'پہلے پڑھنے کے لیے، «ترمیم کریں» سے بدلا جاتا ہے',
  tools: 'ٹولز',
  mentions: '@ سے ذکر کیے گئے لوگوں کا ماخذ',
  mentionsPlaceholder: 'res.users',
  references: 'کسی کلید سے منسلک ریکارڈز',
  referenceKey: 'کلید',
  referenceModel: 'ماڈل',
  referenceLabel: 'نام',
  addReference: 'ریکارڈ کی ایک قسم شامل کریں',
  removeReference: (key) => `${key} سے منسلک ریکارڈز ہٹائیں`,
  shownAs: 'دکھانے کا طریقہ',
  tags: 'ٹیگز',
  linksBox: '«لنک شامل کریں» کے ساتھ لنکس',
  addWay: 'لنک شامل کریں',
  addMenu: 'ایک مینو: موجودہ آئٹم یا نیا آئٹم',
  addSearch: 'فوراً تلاش کرتا ہے',
  addWords: 'اس کا متن',
  helpWords: 'خالی ہونے پر مدد',
  helpIcon: 'مدد کا آئیکن',
  helpTiled: 'ٹائل پر آئیکن',
  helpTile: 'ٹائل کا رنگ',
  emptyLink: 'خالی خانے میں ایک لنک',
};
