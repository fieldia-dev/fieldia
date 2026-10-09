import { localizePage, type Field, type Page } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore, mountScreenEditor } from '@fieldia/designer';
import type { Skin } from '@fieldia/viewer';
import { APP_LISTS, APP_LISTS_AR, pages, sampleDataSource } from '../shared/sample-data';
import { APP_KINDS, APP_WIDGETS } from '../shared/app-kinds';
import { demoAssistant } from '../shared/assistant';
import { timeFirstPaint } from '../shared/timing';
import layoutPage from '../../examples/pages/layout.page.json';
import addressPage from '../../examples/pages/address.page.json';

/**
 * The screen editor on its own page, opened on a small site-visit screen,
 * its photos several to a field.
 * `?start=blank` opens an empty one, `?start=sheet` an empty customer sheet
 * with the customer's model behind it, its fields first in the toolbox, and
 * `?start=list` the customers' list, on the same model, and `?start=layout`
 * the "New employee" page: groups side by side, arrangements, tabs and blocks,
 * `?start=big` a supplier's file of 500 fields, for timing, and
 * `?start=template-<id>` a page of the template library, to change.
 * `?assistant-delay=` sets how long the demo assistant takes, in ms.
 * `?locale=ar` shows the designer in Arabic, its sample pages written in
 * Arabic too, and `?dir=rtl` puts it on a page written right to left, in
 * Arabic: the screen drawn and Try it run that way.
 *
 * The store holds the app's saved forms, to place from the toolbox's “A saved
 * form”: Address, in two versions, and a Visit follow-up that places the site
 * visit itself — placing it in the site visit is refused. “Open it” opens a
 * saved form in the editor. A Customer page is there too, for a step to open.
 */
const params = new URLSearchParams(location.search);
const locale = params.get('locale') ?? undefined;
const arabic = !!locale?.startsWith('ar');
// The page the designer sits on: right to left, and in Arabic, as an Arabic app's page is.
if (params.get('dir') === 'rtl') Object.assign(document.documentElement, { dir: 'rtl', lang: 'ar' });
/** The demo's words, in English or in Arabic. */
const say = (english: string, arabicWords: string) => (arabic ? arabicWords : english);
const customer: Record<string, Field> = {
  name: { type: 'char', label: say('Name', 'الاسم'), required: true },
  email: { type: 'char', label: say('Email', 'البريد الإلكتروني') },
  phone: { type: 'char', label: say('Phone', 'الهاتف') },
  website: { type: 'char', label: say('Website', 'الموقع الإلكتروني') },
  vat: { type: 'char', label: say('VAT number', 'الرقم الضريبي') },
  country_id: { type: 'many2one', label: say('Country', 'الدولة'), relation: 'country' },
  tag_ids: { type: 'many2many', label: say('Tags', 'الوسوم'), relation: 'customer.tag' },
  credit_limit: { type: 'monetary', label: say('Credit limit', 'حد الائتمان'), currency: 'EGP' },
  payment_terms: {
    type: 'selection',
    label: say('Payment terms', 'شروط الدفع'),
    options: [
      { value: 'now', label: say('Immediate', 'فوري') },
      { value: '30', label: say('30 days', '30 يومًا') },
      { value: '60', label: say('60 days', '60 يومًا') },
    ],
  },
  visits: { type: 'integer', label: say('Visits a year', 'الزيارات في السنة') },
  state: {
    type: 'selection',
    label: say('Status', 'الحالة'),
    options: [
      { value: 'draft', label: say('Draft', 'مسودة') },
      { value: 'active', label: say('Active', 'نشط') },
      { value: 'blocked', label: say('Blocked', 'موقوف') },
    ],
  },
  invoice_count: { type: 'integer', label: say('Invoices', 'الفواتير') },
};
function siteVisit() {
  const draft = createDesigner({ page: blankPage('screen', say('Site visit', 'زيارة موقع'), { locale }), locale });
  const visit = 'section-1';
  draft.renameContainer(visit, say('Visit', 'الزيارة'));
  const add = (kind: string, label: string, parent: string) => {
    const id = draft.addQuestion(kind, { parent }) as string;
    draft.updateQuestion(id, { label });
    return id;
  };
  add('short-answer', say('Customer', 'العميل'), visit);
  add('date', say('Visit date', 'تاريخ الزيارة'), visit);
  draft.setColspan(add('paragraph', say('Notes', 'ملاحظات'), visit), 2);
  // Photos of the site: several, up to six, as thumbnails, a phone offering its camera.
  const photos = add('image', say('Photos', 'الصور'), visit);
  draft.setFileRules(photos, { multiple: true, maxFiles: 6 });
  draft.setWidgetOptions(photos, { files: 'thumbnails', camera: true });
  draft.setColspan(photos, 2);
  const followUp = draft.addContainer(say('Follow-up', 'المتابعة')) as string;
  draft.setOptions(add('dropdown', say('Next step', 'الخطوة التالية'), followUp), arabic ? ['إرسال عرض سعر', 'حجز زيارة ثانية', 'إغلاق'] : ['Send a quote', 'Book a second visit', 'Close']);
  add('date', say('Due by', 'الموعد النهائي'), followUp);
  add('yes-no', say('Manager to call?', 'هل يتصل المدير؟'), followUp);
  // Under the same id in either language: the visit follow-up places it by that id.
  return { ...draft.getPage(), id: 'site-visit' };
}

function customers() {
  const draft = createDesigner({ page: blankPage('list', say('Customers', 'العملاء'), { locale }), model: customer, locale });
  for (const name of ['email', 'country_id', 'state', 'credit_limit']) draft.addColumn(name);
  const active = draft.addListFilter(say('Active', 'نشط'), [{ field: 'state', op: '=', value: 'active' }]) as string;
  draft.updateListFilter(active, { on: true });
  draft.addListFilter(say('Blocked', 'موقوف'), [{ field: 'state', op: '=', value: 'blocked' }]);
  draft.setListOptions({ sort: [{ field: 'name' }], groupBy: ['country_id', 'state'] });
  draft.addListAction(say('Archive', 'أرشفة'));
  return draft.getPage();
}

const store = createMemoryPageStore();
// The saved forms, published: Address once without the building and the country, then whole.
const published = (page: Page, version: number) => ({ version, publishedAt: new Date(2026, 8, version * 7).toISOString(), page });
// In Arabic, the saved Address in the words it keeps for Arabic: as an Arabic app's own saved forms are.
const address = arabic ? { ...localizePage(addressPage as unknown as Page, 'ar'), language: 'ar' } : (addressPage as unknown as Page);
const firstAddress: Page = {
  ...address,
  fields: { street: address.fields['street'], city: address.fields['city'], postcode: address.fields['postcode'] },
  layout: { type: 'sections', id: 'address', children: [{ type: 'section', id: 'address-parts', columns: 2, children: [{ type: 'field', id: 'street', field: 'street', colspan: 2 }, { type: 'field', id: 'city', field: 'city' }, { type: 'field', id: 'postcode', field: 'postcode' }] }] },
};
store.pages.set('address', { draft: null, versions: [published(firstAddress, 1), published(address, 2)] });
const followUp: Page = {
  fieldia: '0.1',
  id: 'follow-up',
  title: say('Visit follow-up', 'متابعة الزيارة'),
  ...(arabic ? { language: 'ar' } : {}),
  data: { kind: 'responses' },
  fields: { outcome: { type: 'text', label: say('What came of it', 'ما نتج عنها') } },
  layout: { type: 'sections', id: 'follow-up', children: [{ type: 'form', id: 'the-visit', page: 'site-visit', name: 'visit' }, { type: 'field', id: 'outcome', field: 'outcome' }] },
};
store.pages.set('follow-up', { draft: null, versions: [published(followUp, 1)] });
// A customer, as a step opens one from a button: “New customer” opens it in a panel, its answer put back into this form.
const customerPage: Page = {
  fieldia: '0.1',
  // Not the customer sheet's own id (`?start=sheet`): a page of its own.
  id: 'customer-card',
  title: say('Customer', 'العميل'),
  ...(arabic ? { language: 'ar' } : {}),
  data: { kind: 'record', model: 'customer' },
  fields: { name: customer['name'], phone: customer['phone'], email: customer['email'] },
  layout: { type: 'sections', id: 'customer-card', children: [{ type: 'section', id: 'customer-parts', columns: 2, children: [{ type: 'field', id: 'name', field: 'name' }, { type: 'field', id: 'phone', field: 'phone' }, { type: 'field', id: 'email', field: 'email' }] }] },
};
store.pages.set('customer-card', { draft: null, versions: [published(customerPage, 1)] });
const start = params.get('start');
const model = start === 'sheet' || start === 'list' ? customer : undefined;
// `?start=template-<id>`: a page of the template library, to change. A survey's steps are the survey editor's (designer/).
const template = start?.startsWith('template-') && pages[start]?.layout.type !== 'wizard' ? pages[start] : undefined;
const first = template
  ? (structuredClone(template) as Page)
  : start === 'blank' ? blankPage('screen', say('New screen', 'شاشة جديدة'), { locale }) : start === 'sheet' ? blankPage('sheet', say('Customer', 'عميل'), { locale }) : start === 'list' ? customers() : start === 'layout' ? (layoutPage as unknown as Page) : start === 'big' ? pages['big'] : siteVisit();
// The app's own kind, an IBAN, and the widget that draws it.
const opened = timeFirstPaint('screen');
// No `looks` given: the looks people save are kept in this browser, and offered by both designer demos.
const lists = arabic ? APP_LISTS_AR : APP_LISTS;
/** “Open it” on a saved form: the editor closes, and opens that form from the store. */
const openForm = (id: string) => void reopen(id);
const designer = createDesigner({ page: first, store, model, lists, kinds: APP_KINDS, openForm, locale });
// The app's lists' choices, for Try it.
const dataSource = sampleDataSource();
const skin = (params.get('skin') as Skin) ?? 'outlined';
// A stand-in for the app's own assistant.
const assistant = demoAssistant({ delay: Number(params.get('assistant-delay') ?? 1200), locale });
const app = document.getElementById('app') as HTMLElement;
const demo = { designer, store, handle: mountScreenEditor(app, { designer, skin, dataSource, widgets: APP_WIDGETS, assistant }), reopen };
opened();
/** Close the editor and open the page again from the store, as an app does the next day — or another page, a saved form opened. */
async function reopen(id = demo.designer.getPage().id) {
  demo.handle.destroy();
  demo.designer = await createDesigner.open(id, store, { model, lists, kinds: APP_KINDS, openForm, locale });
  demo.handle = mountScreenEditor(app, { designer: demo.designer, skin, dataSource, widgets: APP_WIDGETS, assistant });
}
Object.assign(window, { fieldiaDesigner: demo });
