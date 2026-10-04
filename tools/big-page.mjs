/**
 * Write examples/pages/big.page.json: a supplier's qualification file of 500
 * fields, for timing Fieldia at the size of a real ERP screen. Twenty-five
 * sections of twenty fields, in two or three columns, with every common kind
 * (text, numbers, money, dates, choices, links, two tables of lines), thirty
 * or so "shows when" rules, ten worked-out values, ten answer rules, and an
 * Arabic word for every word.
 *
 * The page is generated so it stays regular and easy to change; the JSON is
 * committed, so tests and demos read it like any other example page.
 *
 *   node tools/big-page.mjs
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);

/** What each section is about, in English and Arabic. */
const TOPICS = [
  ['Company', 'الشركة'],
  ['Head office', 'المكتب الرئيسي'],
  ['Branch', 'الفرع'],
  ['Warehouse', 'المستودع'],
  ['Purchasing', 'المشتريات'],
  ['Sales', 'المبيعات'],
  ['Finance', 'المالية'],
  ['Bank account', 'الحساب البنكي'],
  ['Tax', 'الضرائب'],
  ['Insurance', 'التأمين'],
  ['Quality', 'الجودة'],
  ['Safety', 'السلامة'],
  ['Environment', 'البيئة'],
  ['Logistics', 'الخدمات اللوجستية'],
  ['Fleet', 'الأسطول'],
  ['Production', 'الإنتاج'],
  ['Maintenance', 'الصيانة'],
  ['Contracts', 'العقود'],
  ['Legal', 'الشؤون القانونية'],
  ['IT', 'تقنية المعلومات'],
  ['Data protection', 'حماية البيانات'],
  ['Human resources', 'الموارد البشرية'],
  ['Training', 'التدريب'],
  ['Support', 'الدعم'],
  ['Sign-off', 'الاعتماد'],
];

const ar = {};
/** A word of the page, and its Arabic. */
const say = (en, arabic) => {
  if (ar[en] !== undefined && ar[en] !== arabic) throw new Error(`"${en}" has two Arabic words`);
  ar[en] = arabic;
  return en;
};
const options = (pairs) => pairs.map(([value, en, arabic]) => ({ value, label: say(en, arabic) }));

const STATUS = [
  ['draft', 'Draft', 'مسودة'],
  ['active', 'Active', 'نشط'],
  ['hold', 'On hold', 'معلّق'],
  ['closed', 'Closed', 'مغلق'],
];
const PRIORITY = [
  ['low', 'Low', 'منخفضة'],
  ['medium', 'Medium', 'متوسطة'],
  ['high', 'High', 'عالية'],
];
const CATEGORIES = [
  ['goods', 'Goods', 'سلع'],
  ['services', 'Services', 'خدمات'],
  ['works', 'Works', 'أعمال'],
  ['consulting', 'Consulting', 'استشارات'],
];

/** Sections whose worked-out total, answer rules, links and tables of lines the page has. */
const WORKED_OUT = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const EMAIL_RULE = new Set([1, 2, 3, 4, 5]);
const CODE_RULE = new Set([6, 7, 8, 9, 10]);
const LINKS = new Set([1, 6, 11, 16, 21]);
const TABLES = new Set([5, 18]);
/** The addresses that show only for a foreign supplier: ten fields one choice shows or hides. */
const FOREIGN_ONLY = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
/** Review dates that show only once the section is approved. */
const AFTER_APPROVAL = new Set(Array.from({ length: 20 }, (_, i) => i + 6));

const fields = {};
const sections = [];
const pad = (n) => String(n).padStart(2, '0');

TOPICS.forEach(([topic, topicAr], i) => {
  const n = i + 1;
  const s = `s${pad(n)}`;
  const label = (base, baseAr) => say(`${topic} ${base}`, `${baseAr} (${topicAr})`);
  const nodes = [];
  /** A field, and the part of the layout that shows it. */
  const add = (name, field, node = {}) => {
    fields[name] = field;
    nodes.push({ type: 'field', id: `f-${name.replace(/_/g, '-')}`, field: name, ...node });
  };
  const columns = n % 2 ? 2 : 3;

  add(`${s}_name`, { type: 'char', label: label('name', 'الاسم'), required: true });
  add(`${s}_code`, { type: 'char', label: label('code', 'الرمز') }, CODE_RULE.has(n) ? { validate: [{ pattern: '[A-Z]{2}-\\d{4}', message: say('A code is two letters and four digits, such as AB-1234.', 'الرمز حرفان وأربعة أرقام، مثل AB-1234.') }] } : {});
  add(`${s}_phone`, { type: 'char', label: label('phone', 'الهاتف') }, { widget: 'phone' });
  add(
    `${s}_email`,
    { type: 'char', label: label('email', 'البريد الإلكتروني') },
    { widget: 'email', ...(EMAIL_RULE.has(n) ? { validate: [{ endsWith: '.example', level: 'warning', message: say('Use the company’s own address if you can.', 'استخدم عنوان بريد الشركة نفسها إن أمكن.') }] } : {}) }
  );
  add(`${s}_website`, { type: 'char', label: label('website', 'الموقع الإلكتروني') }, { widget: 'url' });
  add(`${s}_start`, { type: 'date', label: label('start date', 'تاريخ البدء') });
  add(`${s}_review`, { type: 'date', label: label('review date', 'تاريخ المراجعة') }, AFTER_APPROVAL.has(n) ? { invisible: `not ${s}_approved` } : {});
  if (n === 1) {
    // The one choice that shows or hides ten addresses across the page.
    add('supplier_type', { type: 'selection', label: say('Supplier type', 'نوع المورد'), default: 'local', options: options([['local', 'Local', 'محلي'], ['foreign', 'Foreign', 'أجنبي']]) }, { widget: 'radio' });
  } else {
    add(`${s}_status`, { type: 'selection', label: label('status', 'الحالة'), options: options(STATUS) });
  }
  add(`${s}_priority`, { type: 'selection', label: label('priority', 'الأولوية'), options: options(PRIORITY) }, { widget: 'radio' });
  add(`${s}_headcount`, { type: 'integer', label: label('headcount', 'عدد الموظفين'), min: 0 }, n === 11 ? { validate: [{ max: 10000, message: say('No more than 10,000 people.', 'لا يزيد على 10,000 شخص.') }] } : {});
  add(`${s}_budget`, { type: 'monetary', label: label('budget', 'الميزانية'), currency: 'EGP', digits: [12, 2] });
  if (WORKED_OUT.has(n)) add(`${s}_total`, { type: 'monetary', label: label('total cost', 'التكلفة الإجمالية'), currency: 'EGP', digits: [12, 2], compute: `${s}_headcount * ${s}_budget` });
  else add(`${s}_share`, { type: 'float', label: label('share (%)', 'النسبة (%)'), min: 0, max: 100 });
  add(`${s}_approved`, { type: 'boolean', label: label('approved', 'معتمد') }, { widget: 'toggle' });
  add(`${s}_notes`, { type: 'text', label: label('notes', 'ملاحظات'), help: say('Anything a reviewer should know.', 'أي شيء يجب أن يعرفه المراجع.') }, { colspan: 2 });
  if (LINKS.has(n)) add(`${s}_manager`, { type: 'many2one', label: label('account manager', 'مدير الحساب'), relation: 'employee' });
  else add(`${s}_contact`, { type: 'char', label: label('contact', 'جهة الاتصال') });
  add(`${s}_categories`, { type: 'selection', label: label('categories', 'الفئات'), multiple: true, options: options(CATEGORIES) });
  add(`${s}_rating`, { type: 'integer', label: label('rating', 'التقييم'), min: 1, max: 5 }, { widget: 'rating' });
  add(`${s}_deadline`, { type: 'datetime', label: label('deadline', 'الموعد النهائي') });
  add(`${s}_address`, { type: 'char', label: label('address', 'العنوان') }, FOREIGN_ONLY.has(n) ? { invisible: "supplier_type != 'foreign'" } : {});
  if (TABLES.has(n)) {
    add(
      `${s}_items`,
      {
        type: 'one2many',
        label: label('items', 'الأصناف'),
        relation: 'supplier.line',
        fields: {
          item: { type: 'char', label: say('Item', 'الصنف') },
          qty: { type: 'integer', label: say('Quantity', 'الكمية'), min: 0 },
          price: { type: 'monetary', label: say('Unit price', 'سعر الوحدة'), currency: 'EGP', digits: [12, 2] },
          subtotal: { type: 'monetary', label: say('Subtotal', 'المجموع الفرعي'), currency: 'EGP', digits: [12, 2], compute: 'qty * price' },
        },
      },
      { colspan: columns }
    );
  } else if (n === 1) {
    // A field a rule reads as it is typed: the reference shows once the company has a name.
    add(`${s}_reference`, { type: 'char', label: label('reference', 'المرجع') }, { invisible: `not ${s}_name` });
  } else {
    add(`${s}_reference`, { type: 'char', label: label('reference', 'المرجع') });
  }

  sections.push({ type: 'section', id: `section-${pad(n)}`, title: say(topic, topicAr), columns, children: nodes });
});

const page = {
  fieldia: '0.1',
  id: 'supplier-file',
  title: say('Supplier qualification file', 'ملف تأهيل المورد'),
  description: say(
    'Every section a buyer checks before a supplier is approved: 500 fields, for timing Fieldia at size.',
    'كل قسم يراجعه المشتري قبل اعتماد المورد: 500 حقل، لقياس سرعة Fieldia في الصفحات الكبيرة.'
  ),
  data: { kind: 'responses' },
  fields,
  layout: { type: 'sections', id: 'supplier', children: sections },
  translations: { ar },
};

const count = Object.keys(fields).length;
if (count !== 500) throw new Error(`The big page has ${count} fields, not 500`);
const out = join(WORKSPACE, 'examples/pages/big.page.json');
writeFileSync(out, `${JSON.stringify(page, null, 2)}\n`);
console.log(`${out}: ${count} fields, ${Object.keys(ar).length} words in Arabic`);
