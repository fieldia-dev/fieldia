import { ConflictError, createMemoryDataSource, loadedRecordOf, type DataSource, type Page, type Field, type RecordPermissions, type Values } from '@fieldia/core';
import { mountViewer, openFormDialog, openFormPanel, type FormDialogResult, type ViewerHandle } from '@fieldia/viewer';
import leadPage from '../../examples/pages/lead.page.json';

/**
 * One lead, open in two tabs on one data source: Sara's (yours) and Mona's.
 * "Someone else edits this" has Mona move the lead on in her tab and save;
 * when Sara saves next, the source refuses it as a conflict and the form says
 * who changed the record and when, with Reload and Keep mine. Sara's tab has
 * a pager over her two leads, which asks before her changes set aside by
 * Reload are left behind. With
 * `?role=viewer` the lead is opened by Omar, whom the source lets only read
 * it. `?locale=ar` and `?scheme=dark|light` say the language and the scheme.
 * Sample data.
 */

const params = new URLSearchParams(location.search);
const locale = params.get('locale') === 'ar' ? 'ar' : 'en';
const dir = locale === 'ar' ? 'rtl' : 'ltr';
const viewer = params.get('role') === 'viewer';
const scheme = params.get('scheme') === 'dark' ? 'dark' : params.get('scheme') === 'light' ? 'light' : 'auto';
const page: Page = { ...(leadPage as unknown as Page), look: { scheme } };

const WORDS = {
  en: {
    what: 'Lead #1, open in two tabs at once.',
    whatViewer: 'Lead #1, opened by Omar, a viewer.',
    someone: 'Someone else edits this',
    you: 'Your tab',
    sara: 'Sara, the agent',
    mona: 'Mona’s tab',
    monaWho: 'another agent',
    omar: 'Omar’s tab',
    omarWho: 'a viewer',
    as: 'Open as',
    agent: 'Agent',
    viewer: 'Viewer',
    monaSaved: (stage: string, budget: string) => `Mona saved in her tab: ${stage}, budget ${budget}. Now save yours.`,
    agentReason: 'Only a manager sets the commission or deletes a lead.',
    viewerReason: 'Omar is a viewer: he can read leads, but not change them.',
    other: 'العربية',
    notes: 'Wants three bedrooms near a school. Call after 6pm.',
    saveClose: 'Save and close',
  },
  ar: {
    what: 'العميل المحتمل رقم 1، مفتوح في تبويبين معًا.',
    whatViewer: 'العميل المحتمل رقم 1، فتحه عمر، وهو مُطّلع فقط.',
    someone: 'شخص آخر يعدّل هذا',
    you: 'تبويبك',
    sara: 'سارة، الوكيلة',
    mona: 'تبويب منى',
    monaWho: 'وكيلة أخرى',
    omar: 'تبويب عمر',
    omarWho: 'مُطّلع فقط',
    as: 'الفتح بصفة',
    agent: 'وكيل',
    viewer: 'مُطّلع',
    monaSaved: (stage: string, budget: string) => `حفظت منى في تبويبها: ${stage}، الميزانية ${budget}؛ احفظ تبويبك الآن.`,
    agentReason: 'وحده المدير يحدّد العمولة أو يحذف عميلًا محتملًا.',
    viewerReason: 'عمر مُطّلع فقط: يمكنه قراءة العملاء المحتملين، لا تغييرهم.',
    other: 'English',
    notes: 'يريد ثلاث غرف نوم قرب مدرسة. الاتصال بعد السادسة مساءً.',
    saveClose: 'حفظ وإغلاق',
  },
}[locale];

// ---- one data source for both tabs --------------------------------------------------------------------------

/**
 * Versions, and what each person may do. Every save moves the lead's version on; a save from a page that opened an
 * older one is refused as a conflict. An agent may not delete a lead nor change its commission; a viewer may only read
 * it, and does not see the commission at all.
 */
const can = (): RecordPermissions =>
  viewer
    ? { edit: false, archive: false, duplicate: false, delete: false, hiddenFields: ['commission'], reason: WORDS.viewerReason }
    : { delete: false, readonlyFields: ['commission'], reason: WORDS.agentReason };
const dataSource = createMemoryDataSource({
  records: {
    lead: {
      1: { name: locale === 'ar' ? 'فيلا في الشيخ زايد' : 'Villa in Sheikh Zayed', phone: '+20 100 123 4567', email: 'karim.f@example.com', stage: 'new', agent: locale === 'ar' ? 'سارة' : 'Sara', budget: 4000000, commission: 2.5, notes: WORDS.notes, active: true },
      2: { name: locale === 'ar' ? 'شقة في المعادي' : 'Flat in Maadi', phone: '+20 111 222 3334', email: 'nadia.s@example.com', stage: 'visit', agent: locale === 'ar' ? 'سارة' : 'Sara', budget: 2500000, commission: 2, notes: '', active: true },
    },
  },
  versions: { by: locale === 'ar' ? 'سارة' : 'Sara' },
  can: { lead: can },
  delayMs: 200,
});

/**
 * Mona's tab saves through the same records, in her name. A server does this for every save: it compares the version
 * the page opened with the record's own and, when someone saved in between, refuses with a ConflictError naming them.
 */
const mona = locale === 'ar' ? 'منى' : 'Mona';
const asMona: DataSource = {
  ...dataSource,
  async save(request) {
    const id = request.id as number;
    const { version: now } = loadedRecordOf(await dataSource.load({ model: request.model, id, fields: request.fields }));
    if (request.version && now && request.version.token !== now.token) throw new ConflictError({ version: now, theirs: { ...dataSource.records['lead'][id] } });
    const version = dataSource.changeElsewhere(request.model, id, request.changes.values, { by: mona });
    return { id, values: { ...dataSource.records['lead'][id] }, version };
  },
};

// ---- the page round them ----------------------------------------------------------------------------------------

const app = document.getElementById('app') as HTMLElement;
app.lang = locale;
app.dir = dir;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const made = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) made.setAttribute(name, value);
  made.append(...children);
  return made;
}
/** This page with one setting changed. */
const withParam = (key: string, value: string | null) => {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  return `?${next}`;
};

const someone = el('button', { type: 'button', class: 'ss-button' }, WORDS.someone);
const said = el('p', { class: 'ss-said', role: 'status' });
const roles = el(
  'nav',
  { class: 'ss-switch', 'aria-label': WORDS.as },
  el('a', { href: withParam('role', null), ...(viewer ? {} : { 'aria-current': 'page' }) }, WORDS.agent),
  el('a', { href: withParam('role', 'viewer'), ...(viewer ? { 'aria-current': 'page' } : {}) }, WORDS.viewer)
);
const language = el('a', { href: withParam('locale', locale === 'ar' ? null : 'ar'), lang: locale === 'ar' ? 'en' : 'ar', class: 'ss-language' }, WORDS.other);
const bar = el('div', { class: 'ss-bar' }, el('p', { class: 'ss-what' }, el('strong', {}, viewer ? WORDS.whatViewer : WORDS.what)), ...(viewer ? [] : [someone]), roles, language, ...(viewer ? [] : [said]));

/** A tab of the browser, as the page draws it: whose it is, and the lead in it. */
function tab(who: string, name: string, role: string): { box: HTMLElement; place: HTMLElement } {
  const place = el('div');
  const box = el('section', { class: 'ss-tab', 'data-who': who, 'aria-label': name }, el('h2', { class: 'ss-tab-name' }, name, el('span', {}, `· ${role}`)), place);
  return { box, place };
}

const shared = { page, recordId: 1, locale, dir: dir === 'rtl' ? ('rtl' as const) : undefined, onAction: () => undefined };
const yours = tab('you', viewer ? WORDS.omar : WORDS.you, viewer ? WORDS.omarWho : WORDS.sara);
const tabs = el('div', { class: 'ss-tabs' }, yours.box);
app.append(bar, tabs);
// Sara's tab has her leads round this one, with the pager over it.
const handle: ViewerHandle = mountViewer(yours.place, { ...shared, dataSource, records: [1, 2] });

let monaHandle: ViewerHandle | null = null;
if (!viewer) {
  const hers = tab('mona', WORDS.mona, WORDS.monaWho);
  tabs.append(hers.box);
  monaHandle = mountViewer(hers.place, { ...shared, dataSource: asMona });
  // Mona, in her tab: the lead as it is now, moved on a stage and its budget raised, then saved.
  someone.addEventListener('click', async () => {
    const her = monaHandle as ViewerHandle;
    if (someone.getAttribute('aria-busy') === 'true') return;
    someone.setAttribute('aria-busy', 'true');
    try {
      await her.reload();
      const now = her.form.getState().values;
      const next: Record<string, string> = { new: 'visit', visit: 'offer', offer: 'won' };
      her.setValues({ stage: next[String(now['stage'])] ?? now['stage'], budget: Number(now['budget'] ?? 0) + 500000 } as Values);
      if (await her.save()) {
        const after = her.form.getState().values;
        const stage = (her.form.page.fields['stage'] as Extract<Field, { type: 'selection' }>).options.find((option) => option.value === after['stage'])?.label ?? '';
        said.textContent = WORDS.monaSaved(stage, new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(Number(after['budget'])));
      }
    } finally {
      someone.removeAttribute('aria-busy');
    }
  });
}

/**
 * Sara's lead in a side panel or a dialog over her tab, on the same source — as an app opens a related record —
 * for the browser tests of its ways out; `footer` gives it a button of its own that saves, then closes. How each
 * ended is kept in `closed`.
 */
const closed: FormDialogResult[] = [];
function openLead(as: 'panel' | 'dialog' = 'panel', how: { footer?: boolean; recordId?: number } = {}) {
  const footer = [{ type: 'button' as const, id: 'save-close', label: WORDS.saveClose, style: 'primary' as const, steps: [{ do: 'save' as const }, { do: 'close' as const }] }];
  const shown: Page = how.footer && page.layout.type === 'sheet' ? { ...page, layout: { ...page.layout, footer } } : page;
  const options = { ...shared, page: shown, dataSource, recordId: how.recordId ?? 1, title: String(dataSource.records['lead'][how.recordId ?? 1]?.['name'] ?? '') };
  return (as === 'panel' ? openFormPanel(options) : openFormDialog(options)).then((result) => void closed.push(result));
}

Object.assign(window, { fieldiaDemo: { handle, mona: monaHandle, dataSource, page, openLead, closed } });
