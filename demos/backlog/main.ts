import { chatterSlot, historySlot } from '@fieldia/chatter';
import { isRightToLeft, localizePage, type ActionRequest, type ActionResult, type Facet, type JsonValue, type Locale, type Page, type RecordId } from '@fieldia/core';
import { mountViewer, openFormDialog, type FormDialogOptions, type FormDialogResult, type Tokens } from '@fieldia/viewer';
import backlogJson from '../../examples/pages/backlog.page.json';
import bugJson from '../../examples/pages/work-item-bug.page.json';
import { BACKLOG, backlogChatter, backlogData, me, recentPicks } from './data';
import { keptPreferences } from '../shared/kept';

/**
 * A work tracker's backlog, drawn by the app's own HTML and CSS round a
 * Fieldia list; a bug opened from it in a large popup over the backlog, the
 * page dimmed by nothing. The address keeps the bug open (`?workitem=4127`),
 * so a reload opens it again, and closing gives the focus back to its row.
 * `?locale=ar|de|fr|tr|fa|ur|es` and `?scheme=dark|light` say the language and the scheme.
 * Sample data, all of it invented.
 */

const params = new URLSearchParams(location.search);
const LOCALES = ['en', 'ar', 'de', 'fr', 'tr', 'fa', 'ur', 'es'] as const;
type Language = (typeof LOCALES)[number];
const locale: Language = (LOCALES as readonly string[]).includes(params.get('locale') ?? '') ? (params.get('locale') as Language) : 'en';
const dir = isRightToLeft(locale) ? 'rtl' : 'ltr';
const scheme: 'light' | 'dark' = params.get('scheme') === 'dark' || (params.get('scheme') !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';

// ---- the look: the tracker's own colours, light and dark, worn by the list and the popup ---------------------------------

/** The tracker's own name, in bold before the organisation's: a product's name, the same in every language. */
const PRODUCT = 'Trackline';
const FONT = '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Helvetica, Ubuntu, Arial, sans-serif';
/**
 * Measured from the tracker's screens; the dark set worked out from them. Muted words are a shade darker than
 * the screens' #7e7e7e, so they read at 4.5:1 on white and on the band (WCAG AA).
 */
const TOKENS: Record<'light' | 'dark', Tokens> = {
  light: {
    text: '#1a1a1a', muted: '#707070', page: '#ffffff', surface: '#ffffff', fill: '#f2f2f2', border: '#eaeaea', 'border-strong': '#7e7e7e',
    accent: '#0078d4', 'accent-text': '#ffffff', 'accent-soft': '#deecf9', focus: '#0078d4', 'focus-ring': 'none',
    link: '#005a9e', band: '#f8f8f8', help: '#f4f4f4', radius: '4px', 'control-radius': '2px', font: FONT,
  },
  dark: {
    text: '#f3f2f1', muted: '#a19f9d', page: '#252423', surface: '#252423', fill: '#3b3a39', border: '#3b3a39', 'border-strong': '#8a8886',
    accent: '#2899f5', 'accent-text': '#111111', 'accent-soft': '#0e2d4a', focus: '#2899f5', 'focus-ring': 'none',
    link: '#6cb8f6', band: '#2d2c2b', help: '#2d2c2b', radius: '4px', 'control-radius': '2px', font: FONT,
  },
};
/** The backlog's list sits on the page's grey; the popup is white. */
const LIST_PAGE = { light: '#f8f8f8', dark: '#1b1a19' };
const tokens = TOKENS[scheme];
const listTokens: Tokens = { ...tokens, page: LIST_PAGE[scheme] };
/** Each page in the reader's scheme, so the parts no token reaches follow it too. */
const inScheme = (page: Page): Page => ({ ...page, look: { ...page.look, scheme } });
const backlogPage = inScheme(backlogJson as unknown as Page);
const bugPage = inScheme(bugJson as unknown as Page);

// ---- the app's words: its chrome, in the four languages ----------------------------------------------------------------

const WORDS = {
  en: {
    org: 'Harbor Supply', project: 'Portal', boards: 'Boards', backlogs: 'Backlogs', search: 'Search', language: 'Language', path: 'Where you are', menu: 'Project',
    overview: 'Overview', workItems: 'Work items', sprints: 'Sprints', queries: 'Queries', plans: 'Delivery Plans', analyticsViews: 'Analytics views', code: 'Code', builds: 'Builds', tests: 'Tests', packages: 'Packages', settings: 'Project settings', collapse: 'Collapse the menu',
    team: 'Portal Team', teams: 'Other teams', favourite: 'Add to favourites', members: 'Team members', newItem: 'New Work Item', asBoard: 'View as Board', columns: 'Column Options', more: 'More actions',
    backlog: 'Backlog', analytics: 'Analytics', views: 'Backlog views', level: 'Stories', viewOptions: 'View options', filter: 'Filter', backlogSettings: 'Settings', fullScreen: 'Full screen',
    notHere: 'Only the backlog and its bugs are in this demo.', me: 'Salma Nabil', bug: 'Bug',
    create: 'Create', myWork: 'My work items', extensions: 'Extensions', help: 'Help', userSettings: 'User settings', loading: 'Loading…',
    applied: (name: string) => `${name}: applied.`,
  },
  ar: {
    org: 'Harbor Supply', project: 'Portal', boards: 'اللوحات', backlogs: 'قوائم الأعمال', search: 'بحث', language: 'اللغة', path: 'موقعك', menu: 'المشروع',
    overview: 'نظرة عامة', workItems: 'بنود العمل', sprints: 'الدورات', queries: 'الاستعلامات', plans: 'خطط التسليم', analyticsViews: 'طرق عرض التحليلات', code: 'الشيفرة', builds: 'البنايات', tests: 'الاختبارات', packages: 'الحزم', settings: 'إعدادات المشروع', collapse: 'طي القائمة',
    team: 'فريق Portal', teams: 'فرق أخرى', favourite: 'إضافة إلى المفضلة', members: 'أعضاء الفريق', newItem: 'بند عمل جديد', asBoard: 'عرض كلوحة', columns: 'خيارات الأعمدة', more: 'إجراءات أخرى',
    backlog: 'قائمة الأعمال', analytics: 'التحليلات', views: 'طرق عرض قائمة الأعمال', level: 'القصص', viewOptions: 'خيارات العرض', filter: 'تصفية', backlogSettings: 'الإعدادات', fullScreen: 'ملء الشاشة',
    notHere: 'لا يضم هذا العرض إلا قائمة الأعمال وأخطاءها.', me: 'سلمى نبيل', bug: 'خلل',
    create: 'إنشاء', myWork: 'بنود عملي', extensions: 'الإضافات', help: 'المساعدة', userSettings: 'إعدادات المستخدم', loading: 'جارٍ التحميل…',
    applied: (name: string) => `طُبّق القالب: ${name}.`,
  },
  de: {
    org: 'Harbor Supply', project: 'Portal', boards: 'Boards', backlogs: 'Backlogs', search: 'Suchen', language: 'Sprache', path: 'Wo Sie sind', menu: 'Projekt',
    overview: 'Übersicht', workItems: 'Arbeitselemente', sprints: 'Sprints', queries: 'Abfragen', plans: 'Lieferpläne', analyticsViews: 'Analyseansichten', code: 'Code', builds: 'Builds', tests: 'Tests', packages: 'Pakete', settings: 'Projekteinstellungen', collapse: 'Menü einklappen',
    team: 'Portal-Team', teams: 'Andere Teams', favourite: 'Zu Favoriten hinzufügen', members: 'Teammitglieder', newItem: 'Neues Arbeitselement', asBoard: 'Als Board anzeigen', columns: 'Spaltenoptionen', more: 'Weitere Aktionen',
    backlog: 'Backlog', analytics: 'Analyse', views: 'Backlog-Ansichten', level: 'Storys', viewOptions: 'Ansichtsoptionen', filter: 'Filter', backlogSettings: 'Einstellungen', fullScreen: 'Vollbild',
    notHere: 'In dieser Demo gibt es nur das Backlog und seine Fehler.', me: 'Salma Nabil', bug: 'Fehler',
    create: 'Erstellen', myWork: 'Meine Arbeitselemente', extensions: 'Erweiterungen', help: 'Hilfe', userSettings: 'Benutzereinstellungen', loading: 'Wird geladen…',
    applied: (name: string) => `Vorlage angewendet: ${name}.`,
  },
  fr: {
    org: 'Harbor Supply', project: 'Portal', boards: 'Tableaux', backlogs: 'Backlogs', search: 'Rechercher', language: 'Langue', path: 'Où vous êtes', menu: 'Projet',
    overview: 'Vue d’ensemble', workItems: 'Éléments de travail', sprints: 'Sprints', queries: 'Requêtes', plans: 'Plans de livraison', analyticsViews: 'Vues d’analyse', code: 'Code', builds: 'Builds', tests: 'Tests', packages: 'Packages', settings: 'Paramètres du projet', collapse: 'Replier le menu',
    team: 'Équipe Portal', teams: 'Autres équipes', favourite: 'Ajouter aux favoris', members: 'Membres de l’équipe', newItem: 'Nouvel élément de travail', asBoard: 'Afficher en tableau', columns: 'Options des colonnes', more: 'Autres actions',
    backlog: 'Backlog', analytics: 'Analyse', views: 'Vues du backlog', level: 'Récits', viewOptions: 'Options d’affichage', filter: 'Filtrer', backlogSettings: 'Paramètres', fullScreen: 'Plein écran',
    notHere: 'Cette démo ne contient que le backlog et ses bogues.', me: 'Salma Nabil', bug: 'Bogue',
    create: 'Créer', myWork: 'Mes éléments de travail', extensions: 'Extensions', help: 'Aide', userSettings: 'Paramètres utilisateur', loading: 'Chargement…',
    applied: (name: string) => `Modèle appliqué : ${name}.`,
  },
  // Turkish, Persian, Urdu and Spanish: machine-assisted, not yet reviewed by a native speaker, as Fieldia's own words in them are.
  tr: {
    org: 'Harbor Supply', project: 'Portal', boards: 'Panolar', backlogs: 'Biriktirme listeleri', search: 'Ara', language: 'Dil', path: 'Bulunduğunuz yer', menu: 'Proje', overview: 'Genel bakış', workItems: 'İş öğeleri', sprints: 'Sprintler', queries: 'Sorgular', plans: 'Teslim planları', analyticsViews: 'Analiz görünümleri', code: 'Kod', builds: 'Derlemeler', tests: 'Testler', packages: 'Paketler', settings: 'Proje ayarları', collapse: 'Menüyü daralt', team: 'Portal Ekibi', teams: 'Diğer ekipler', favourite: 'Sık kullanılanlara ekle', members: 'Ekip üyeleri', newItem: 'Yeni iş öğesi', asBoard: 'Pano olarak görüntüle', columns: 'Sütun seçenekleri', more: 'Diğer eylemler', backlog: 'Biriktirme listesi', analytics: 'Analiz', views: 'Biriktirme listesi görünümleri', level: 'Hikayeler', viewOptions: 'Görünüm seçenekleri', filter: 'Filtrele', backlogSettings: 'Ayarlar', fullScreen: 'Tam ekran', notHere: 'Bu demoda yalnızca biriktirme listesi ve hataları bulunur.', me: 'Salma Nabil', bug: 'Hata', create: 'Oluştur', myWork: 'İş öğelerim', extensions: 'Uzantılar', help: 'Yardım', userSettings: 'Kullanıcı ayarları', loading: 'Yükleniyor…',
    applied: (name: string) => `Şablon uygulandı: ${name}.`,
  },
  fa: {
    org: 'Harbor Supply', project: 'Portal', boards: 'تابلوها', backlogs: 'بک‌لاگ‌ها', search: 'جستجو', language: 'زبان', path: 'موقعیت شما', menu: 'پروژه', overview: 'نمای کلی', workItems: 'موارد کاری', sprints: 'اسپرینت‌ها', queries: 'پرس‌وجوها', plans: 'برنامه‌های تحویل', analyticsViews: 'نماهای تحلیل', code: 'کد', builds: 'ساخت‌ها', tests: 'آزمون‌ها', packages: 'بسته‌ها', settings: 'تنظیمات پروژه', collapse: 'جمع کردن منو', team: 'تیم Portal', teams: 'تیم‌های دیگر', favourite: 'افزودن به علاقه‌مندی‌ها', members: 'اعضای تیم', newItem: 'مورد کاری جدید', asBoard: 'نمایش به‌صورت تابلو', columns: 'گزینه‌های ستون', more: 'اقدامات بیشتر', backlog: 'بک‌لاگ', analytics: 'تحلیل', views: 'نماهای بک‌لاگ', level: 'داستان‌ها', viewOptions: 'گزینه‌های نما', filter: 'فیلتر', backlogSettings: 'تنظیمات', fullScreen: 'تمام‌صفحه', notHere: 'در این نسخهٔ نمایشی فقط بک‌لاگ و باگ‌های آن وجود دارد.', me: 'Salma Nabil', bug: 'باگ', create: 'ایجاد', myWork: 'موارد کاری من', extensions: 'افزونه‌ها', help: 'راهنما', userSettings: 'تنظیمات کاربر', loading: 'در حال بارگیری…',
    applied: (name: string) => `الگوی «${name}» اعمال شد.`,
  },
  ur: {
    org: 'Harbor Supply', project: 'Portal', boards: 'بورڈز', backlogs: 'بیک لاگز', search: 'تلاش کریں', language: 'زبان', path: 'آپ کا مقام', menu: 'پروجیکٹ', overview: 'جائزہ', workItems: 'ورک آئٹمز', sprints: 'اسپرنٹس', queries: 'کوئریز', plans: 'ڈیلیوری پلانز', analyticsViews: 'تجزیاتی مناظر', code: 'کوڈ', builds: 'بلڈز', tests: 'ٹیسٹس', packages: 'پیکجز', settings: 'پروجیکٹ کی ترتیبات', collapse: 'مینو سمیٹیں', team: 'Portal ٹیم', teams: 'دیگر ٹیمیں', favourite: 'پسندیدہ میں شامل کریں', members: 'ٹیم کے اراکین', newItem: 'نیا ورک آئٹم', asBoard: 'بورڈ کے طور پر دیکھیں', columns: 'کالم کے اختیارات', more: 'مزید کارروائیاں', backlog: 'بیک لاگ', analytics: 'تجزیات', views: 'بیک لاگ کے مناظر', level: 'اسٹوریز', viewOptions: 'منظر کے اختیارات', filter: 'فلٹر', backlogSettings: 'ترتیبات', fullScreen: 'پوری اسکرین', notHere: 'اس ڈیمو میں صرف بیک لاگ اور اس کے بگز شامل ہیں۔', me: 'Salma Nabil', bug: 'بگ', create: 'بنائیں', myWork: 'میرے ورک آئٹمز', extensions: 'ایکسٹینشنز', help: 'مدد', userSettings: 'صارف کی ترتیبات', loading: 'لوڈ ہو رہا ہے…',
    applied: (name: string) => `سانچہ لاگو ہو گیا: ${name}۔`,
  },
  es: {
    org: 'Harbor Supply', project: 'Portal', boards: 'Paneles', backlogs: 'Trabajos pendientes', search: 'Buscar', language: 'Idioma', path: 'Dónde se encuentra', menu: 'Proyecto', overview: 'Información general', workItems: 'Elementos de trabajo', sprints: 'Sprints', queries: 'Consultas', plans: 'Planes de entrega', analyticsViews: 'Vistas de análisis', code: 'Código', builds: 'Compilaciones', tests: 'Pruebas', packages: 'Paquetes', settings: 'Configuración del proyecto', collapse: 'Contraer el menú', team: 'Equipo de Portal', teams: 'Otros equipos', favourite: 'Añadir a favoritos', members: 'Miembros del equipo', newItem: 'Nuevo elemento de trabajo', asBoard: 'Ver como panel', columns: 'Opciones de columna', more: 'Más acciones', backlog: 'Trabajo pendiente', analytics: 'Análisis', views: 'Vistas del trabajo pendiente', level: 'Historias', viewOptions: 'Opciones de vista', filter: 'Filtrar', backlogSettings: 'Configuración', fullScreen: 'Pantalla completa', notHere: 'Esta demostración solo incluye el trabajo pendiente y sus errores.', me: 'Salma Nabil', bug: 'Error', create: 'Crear', myWork: 'Mis elementos de trabajo', extensions: 'Extensiones', help: 'Ayuda', userSettings: 'Configuración de usuario', loading: 'Cargando…',
    applied: (name: string) => `Plantilla aplicada: ${name}.`,
  },
}[locale];

// ---- the app's chrome -------------------------------------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, ...children: (Node | string)[]) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== undefined) element.setAttribute(key, value);
  element.append(...children);
  return element;
}
/** The app's own icons: lines in the words' colour, 16px. */
const ICON: Record<string, string> = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  code: '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5"/>',
  build: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  test: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  tasks: '<path d="M10 6h11M10 12h11M10 18h11M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
  bag: '<rect x="6" y="8" width="12" height="13" rx="1.5"/><path d="M9 8V6a3 3 0 0 1 6 0v2M12 8v13"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.01"/>',
  user: '<circle cx="10" cy="7.5" r="3.5"/><path d="M3 20c0-4 3-6.5 7-6.5 1.2 0 2.3.2 3.2.6"/><circle cx="17.5" cy="17.5" r="2.2"/><path d="M17.5 13.5v1.8M17.5 19.7v1.8M21.5 17.5h-1.8M15.3 17.5h-1.8M20.3 14.7l-1.2 1.2M15.9 19.1l-1.2 1.2M20.3 20.3l-1.2-1.2M15.9 15.9l-1.2-1.2"/>',
  collapse: '<path d="M11 6l-6 6 6 6M19 6l-6 6 6 6"/>',
  star: '<path d="M12 3l2.8 6 6.2.6-4.7 4.2 1.4 6.2L12 16.8 6.3 20l1.4-6.2L3 9.6 9.2 9z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.5c3 0 5.5 1.6 5.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<circle cx="12" cy="12" r="9"/><path d="M10 8l4 4-4 4"/>',
  more: '<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  expand: '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
};
/**
 * The project's parts, each a tile of its own colour with a white drawing, 24px, as a tracker marks its top-level parts;
 * the app's own drawings and colours, of no product's mark.
 */
const TILE: Record<string, { colour: string; drawing: string }> = {
  overview: { colour: '#2f7dd1', drawing: '<path d="M8 7.5h8M8 11h8M8 14.5h5"/><path d="M6.5 4.5h11v15h-11z"/>' },
  boards: { colour: '#1e9a5a', drawing: '<path d="M5.5 5.5h3.5v13H5.5zM10.25 5.5h3.5v9h-3.5zM15 5.5h3.5v6H15z"/>' },
  code: { colour: '#e2552d', drawing: '<circle cx="8" cy="6.5" r="1.8"/><circle cx="8" cy="17.5" r="1.8"/><circle cx="16" cy="9" r="1.8"/><path d="M8 8.3v7.4M16 10.8c0 3-3 3.6-7.4 5.4"/>' },
  builds: { colour: '#2a62d6', drawing: '<path d="M9 6.5l8 5.5-8 5.5z"/>' },
  tests: { colour: '#7d3fc8', drawing: '<path d="M10 5h4M10.7 5v5.2L6.6 17.4a1.2 1.2 0 0 0 1 1.8h8.8a1.2 1.2 0 0 0 1-1.8l-4.1-7.2V5M8.6 14.5h6.8"/>' },
  packages: { colour: '#d23a5c', drawing: '<path d="M12 4.8l6.5 3.6v7.2L12 19.2l-6.5-3.6V8.4z"/><path d="M5.5 8.4L12 12l6.5-3.6M12 12v7.2"/>' },
};
const tile = (name: string) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `bl-tile-icon bl-tile-${name}`);
  svg.innerHTML = `<rect width="24" height="24" rx="4" fill="${TILE[name].colour}"/><g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${TILE[name].drawing}</g>`;
  return svg;
};

/**
 * The app's finer icons, drawn on their own grid in one-pixel lines on the pixels, so they stay crisp at their size: the
 * backlog's levels, the menu's parts, the head's tools (measured on 08_18).
 */
const FINE: Record<string, { box: string; drawing: string }> = {
  levels: { box: '0 0 16 16', drawing: '<path d="M6 2.5h9M3 6.5h12M7 10.5h8"/>' },
  team: { box: '0 0 18 14', drawing: '<path d="M5.25 1.75h12M.75 7h16.5M5.25 12.25h12" stroke-width="1.5"/>' },
  lines: { box: '0 0 16 16', drawing: '<path d="M2 2.5h12M4 6.5h8M6 10.5h4"/>' },
  chevron: { box: '0 0 16 16', drawing: '<path d="M2.5 5.5l5.5 5.5 5.5-5.5"/>' },
  wrench: { box: '0 0 16 16', drawing: '<path d="M10.6 1.5a3.6 3.6 0 0 0-3.4 4.8l-5.4 5.4a1.6 1.6 0 0 0 2.3 2.3l5.4-5.4a3.6 3.6 0 0 0 4.7-3.5l-2.2 2.1-2-.6-.6-2 2.1-2.2a3.6 3.6 0 0 0-.9-.1z"/>' },
  items: { box: '0 0 16 16', drawing: '<path d="M5.5 2.5h-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3.5M10.5 2.5h1a1 1 0 0 1 1 1v3.5"/><rect x="5.5" y="1.5" width="5" height="2" rx=".5"/><circle cx="11.5" cy="12" r="3.5" fill="currentColor" stroke="none"/><path d="M9.9 12.1l1.1 1.1 2.1-2.2" style="stroke: var(--bl-nav-open)"/>' },
  board: { box: '0 0 16 16', drawing: '<path d="M2.5 2.5h4v2h-4zM2.5 7h4v2h-4zM2.5 11.5h4v2h-4zM9.5 2.5h4v2h-4zM9.5 7h4v2h-4z"/>' },
  backlog: { box: '0 0 16 16', drawing: '<path d="M3.5 4.5h10M2.5 8.5h11M6.5 12.5h7"/>' },
  sprint: { box: '0 0 16 16', drawing: '<path d="M1.5 11.5h6a3.5 3.5 0 1 0-3.5-3.5M12 11.5h2.5M13 10l1.5 1.5L13 13"/>' },
  query: { box: '0 0 16 16', drawing: '<path d="M1.5 4.5h4M1.5 8.5h5M1.5 12.5h12.5"/><circle cx="10.5" cy="5.5" r="3"/><path d="M12.6 7.6l2 2"/>' },
  plan: { box: '0 0 16 16', drawing: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M2.5 5.5h11M5 8.5h1M7.5 8.5h1M10 8.5h1M5 11h1M7.5 11h1"/>' },
  chart: { box: '0 0 16 16', drawing: '<path d="M8.5 14.5h-5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v3"/><path d="M10 14.5v-4M12.25 14.5v-6M14.5 14.5v-2.5" stroke-width="1.5"/>' },
  // The team's favourite: a thin five-pointed star, 13px; its people: two heads over flat-topped bodies, 13px by 11 (08_18).
  star: { box: '0 0 16 16', drawing: '<path d="M8 1.9l1.75 3.95 4.3.4-3.25 2.85.95 4.2L8 11.1l-3.75 2.2.95-4.2L1.95 6.25l4.3-.4z" stroke-linejoin="round"/>' },
  people: { box: '0 0 16 16', drawing: '<circle cx="6" cy="5.5" r="2"/><circle cx="12" cy="6" r="1.5"/><path d="M2.5 9.5h7v1.2a3.5 2.6 0 0 1-7 0zM11.5 9.5h3v1.4a2.4 2.2 0 0 1-2.4 2.2h-.6" stroke-linejoin="round"/>' },
};
const icon = (name: string) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  if (FINE[name]) {
    svg.setAttribute('viewBox', FINE[name].box);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', `bl-icon bl-fine bl-icon-${name}`);
    svg.innerHTML = FINE[name].drawing;
    return svg;
  }
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `bl-icon bl-icon-${name}`);
  svg.innerHTML = ICON[name] ?? '';
  return svg;
};

/** A press on a part of the tracker this demo does not have says so, in a note that goes by itself. */
const note = el('p', { class: 'bl-note', role: 'status' });
let noteTimer = 0;
function notHere() {
  note.textContent = WORDS.notHere;
  note.classList.add('bl-note-on');
  clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => note.classList.remove('bl-note-on'), 3200);
}
/** A button of the chrome: its icon and words, or its icon alone with its name and tooltip. */
function button(iconName: string | null, words: string, options: { iconOnly?: boolean; className?: string; onClick?: () => void } = {}) {
  const made = el('button', { type: 'button', class: options.className ?? 'bl-button', 'aria-label': options.iconOnly ? words : undefined, title: options.iconOnly ? words : undefined }, ...(iconName ? [icon(iconName)] : []), ...(options.iconOnly ? [] : [el('span', {}, words)]));
  made.addEventListener('click', options.onClick ?? notHere);
  return made;
}

const app = document.getElementById('app') as HTMLElement;
app.lang = locale;
app.dir = dir;
app.dataset['scheme'] = scheme;

// The bar across the top: where you are, a search box, the person's tools, and the person.
const LANGUAGES = [['en', 'English'], ['ar', 'العربية'], ['de', 'Deutsch'], ['fr', 'Français'], ['tr', 'Türkçe'], ['fa', 'فارسی'], ['ur', 'اردو'], ['es', 'Español']] as const;
/** The page again in another language. */
function speak(language: string) {
  if (language === locale) return;
  const next = new URLSearchParams(location.search);
  if (language === 'en') next.delete('locale');
  else next.set('locale', language);
  location.search = next.toString();
}
/**
 * User settings: a menu of the languages, the one shown ticked. Its button names it; ↓ or a press opens it on the
 * language ticked, the arrows move, Enter or Space picks, Escape closes it and gives the focus back.
 */
const userButton = el('button', { type: 'button', class: 'bl-tool', 'aria-label': WORDS.userSettings, title: WORDS.userSettings, 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': 'bl-user-menu' }, icon('user'));
const userMenu = el(
  'div',
  { class: 'bl-menu', role: 'menu', id: 'bl-user-menu', 'aria-label': WORDS.language, hidden: '' },
  el('p', { class: 'bl-menu-heading', 'aria-hidden': 'true' }, WORDS.language),
  ...LANGUAGES.map(([value, name]) => {
    const item = el('button', { type: 'button', class: 'bl-menu-item', role: 'menuitemradio', 'aria-checked': String(value === locale), lang: value, tabindex: '-1' }, name);
    item.addEventListener('click', () => {
      closeUserMenu(true);
      speak(value);
    });
    return item;
  })
);
const menuItems = () => [...userMenu.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
function openUserMenu(at: 'checked' | 'first' | 'last' = 'checked') {
  userMenu.hidden = false;
  userButton.setAttribute('aria-expanded', 'true');
  const items = menuItems();
  (at === 'first' ? items[0] : at === 'last' ? items[items.length - 1] : (items.find((item) => item.getAttribute('aria-checked') === 'true') ?? items[0])).focus();
}
function closeUserMenu(focusBack = false) {
  if (userMenu.hidden) return;
  userMenu.hidden = true;
  userButton.setAttribute('aria-expanded', 'false');
  if (focusBack) userButton.focus();
}
userButton.addEventListener('click', () => (userMenu.hidden ? openUserMenu() : closeUserMenu()));
userButton.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  openUserMenu(event.key === 'ArrowDown' ? 'first' : 'last');
});
userMenu.addEventListener('keydown', (event) => {
  const items = menuItems();
  const at = items.indexOf(document.activeElement as HTMLElement);
  const to = ({ ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 } as Record<string, number>)[event.key];
  if (to !== undefined) {
    event.preventDefault();
    items[(to + items.length) % items.length]?.focus();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeUserMenu(true);
  } else if (event.key === 'Tab') closeUserMenu();
});
document.addEventListener('pointerdown', (event) => {
  if (!userButton.parentElement?.contains(event.target as Node)) closeUserMenu();
});

const crumbs = [WORDS.org, WORDS.project, WORDS.boards, WORDS.backlogs];
const product = el('a', { href: '#', class: 'bl-product' }, PRODUCT);
product.addEventListener('click', (event) => (event.preventDefault(), notHere()));
const top = el(
  'div',
  { class: 'bl-top' },
  el('span', { class: 'bl-mark', 'aria-hidden': 'true' }),
  product,
  el('nav', { class: 'bl-crumbs', 'aria-label': WORDS.path }, el('ol', {}, ...crumbs.map((words, at) => el('li', {}, at === crumbs.length - 1 ? el('a', { href: '#', 'aria-current': 'page' }, words) : el('a', { href: '#' }, words))))),
  el('label', { class: 'bl-search' }, icon('search'), el('input', { type: 'search', placeholder: WORDS.search, 'aria-label': WORDS.search })),
  el(
    'div',
    { class: 'bl-top-tools' },
    button('tasks', WORDS.myWork, { iconOnly: true, className: 'bl-tool' }),
    button('bag', WORDS.extensions, { iconOnly: true, className: 'bl-tool' }),
    button('help', WORDS.help, { iconOnly: true, className: 'bl-tool' }),
    el('span', { class: 'bl-user' }, userButton, userMenu)
  ),
  me.avatar ? el('img', { class: 'bl-me', src: me.avatar, alt: WORDS.me }) : el('span', { class: 'bl-me', role: 'img', 'aria-label': WORDS.me }, 'SN')
);
for (const a of top.querySelectorAll('.bl-crumbs a')) a.addEventListener('click', (event) => (event.preventDefault(), notHere()));

// The project's menu: its tile and a press to create, then its parts — each top one a tile of its colour — Boards open
// with Backlogs the page shown.
const navLink = (lead: Element, words: string, className: string, current = false) => {
  const link = el('a', { href: '#', class: className, 'aria-current': current ? 'page' : undefined }, el('span', { class: 'bl-nav-glyph' }, lead), el('span', {}, words));
  link.addEventListener('click', (event) => (event.preventDefault(), current ? undefined : notHere()));
  return link;
};
const topItem = (tileName: string, words: string, open = false) => el('li', { class: open ? 'bl-nav-group' : undefined }, navLink(tile(tileName), words, `bl-nav-item bl-nav-top${open ? ' bl-nav-open' : ''}`));
const subItem = (iconName: string, words: string, current = false) => el('li', { class: 'bl-nav-in' }, navLink(icon(iconName), words, 'bl-nav-item bl-nav-sub', current));
const settingsLink = navLink(icon('gear'), WORDS.settings, 'bl-nav-item');
const nav = el(
  'nav',
  { class: 'bl-nav', 'aria-label': WORDS.menu },
  el('div', { class: 'bl-project' }, el('span', { class: 'bl-tile', 'aria-hidden': 'true' }, 'P'), el('span', {}, WORDS.project), button('plus', WORDS.create, { iconOnly: true, className: 'bl-tool' })),
  el(
    'ul',
    {},
    topItem('overview', WORDS.overview),
    topItem('boards', WORDS.boards, true),
    subItem('items', WORDS.workItems),
    subItem('board', WORDS.boards),
    subItem('backlog', WORDS.backlogs, true),
    subItem('sprint', WORDS.sprints),
    subItem('query', WORDS.queries),
    subItem('plan', WORDS.plans),
    subItem('chart', WORDS.analyticsViews),
    topItem('code', WORDS.code),
    topItem('builds', WORDS.builds),
    topItem('tests', WORDS.tests),
    topItem('packages', WORDS.packages)
  ),
  el('div', { class: 'bl-nav-foot' }, settingsLink, button('collapse', WORDS.collapse, { iconOnly: true, className: 'bl-tool' }))
);

// The page's head: the team, its buttons, and the backlog's pivots with its tools at the end.
const newItem = button('plus', WORDS.newItem, { onClick: () => void openBug(null) });
const head = el(
  'div',
  { class: 'bl-head' },
  el(
    'div',
    { class: 'bl-head-row' },
    el('span', { class: 'bl-head-icon', 'aria-hidden': 'true' }, icon('team')),
    el('h1', { class: 'bl-team' }, WORDS.team),
    button('chevron', WORDS.teams, { iconOnly: true, className: 'bl-tool' }),
    button('star', WORDS.favourite, { iconOnly: true, className: 'bl-tool bl-star' }),
    button('people', WORDS.members, { iconOnly: true, className: 'bl-tool' }),
    el('div', { class: 'bl-actions' }, newItem, button('arrow', WORDS.asBoard), button('wrench', WORDS.columns), button('more', WORDS.more, { iconOnly: true, className: 'bl-tool' }))
  ),
  el(
    'div',
    { class: 'bl-pivots-row' },
    el('nav', { class: 'bl-pivots', 'aria-label': WORDS.views }, el('a', { href: '#', 'aria-current': 'page' }, WORDS.backlog), el('a', { href: '#' }, WORDS.analytics)),
    el(
      'div',
      { class: 'bl-tools' },
      el('button', { type: 'button', class: 'bl-level' }, icon('levels'), el('span', {}, WORDS.level), icon('chevron')),
      button('sliders', WORDS.viewOptions, { iconOnly: true, className: 'bl-tool' }),
      button('lines', WORDS.filter, { iconOnly: true, className: 'bl-tool' }),
      button('gear', WORDS.backlogSettings, { iconOnly: true, className: 'bl-tool' }),
      button('expand', WORDS.fullScreen, { iconOnly: true, className: 'bl-tool' })
    )
  )
);
head.querySelector('.bl-level')?.addEventListener('click', notHere);
for (const a of head.querySelectorAll('.bl-pivots a')) a.addEventListener('click', (event) => (event.preventDefault(), a.getAttribute('aria-current') ? undefined : notHere()));

const listHost = el('div', { class: 'bl-list' });
/**
 * The list's own stand-in, in its place at once: the list screen comes in a part of its own (a chunk the page asks for
 * the first time it draws a list), and until it has come the list's place would be blank under the page's head. Its
 * "Loading…" and the shape of its rows, gone the moment the list is drawn.
 */
const standIn = el(
  'div',
  { class: 'bl-waiting', role: 'status', 'aria-busy': 'true' },
  el('p', { class: 'fd-list-waiting' }, WORDS.loading),
  ...Array.from({ length: 8 }, () => el('i', { 'aria-hidden': 'true' }))
);
listHost.append(standIn);
app.append(top, el('div', { class: 'bl-frame' }, nav, el('main', { class: 'bl-page' }, head, listHost)), note);

// ---- what the person keeps: the backlog's default filter, and their latest Area and Iteration picks ----------------------

/** A choice of the backlog picked in its filter bar, in the reader's language. */
const shownBacklog = localizePage(backlogPage, locale);
const picked = (field: string, value: string): Facet => {
  const def = shownBacklog.fields[field];
  const label = def.type === 'selection' ? (def.options.find((option) => option.value === value)?.label ?? value) : value;
  return { kind: 'field', field, label: def.label, values: [{ op: '=', value, label }] };
};
// The backlog opens on the active bugs, as the team keeps it: the person's default search. What they change of it, and
// their picks, kept while the tab is open, as every demo's (shared/kept.ts).
const preferences = keptPreferences(
  { 'favourites:backlog': [{ name: 'Active bugs', isDefault: true, facets: [picked('work_type', 'bug'), picked('state', 'active')] }] as unknown as JsonValue, ...(recentPicks as unknown as Record<string, JsonValue>) },
  BACKLOG
);

// ---- the list --------------------------------------------------------------------------------------------------------------

const dataSource = backlogData();
const chatter = backlogChatter();
const list = mountViewer(listHost, {
  page: backlogPage,
  dataSource,
  locale: locale as Locale,
  dir,
  tokens: listTokens,
  preferences,
  // A row opens its bug in the popup; the list asks again once it closes, and its row takes the focus back.
  onOpenRecord: (id) => openBug(id),
});

void list.drawn.then(() => standIn.remove());

// ---- the bug, in a large popup over the backlog --------------------------------------------------------------------------

/** The person following each bug, as the server keeps it. */
const following = new Set<RecordId>();

/**
 * The bug's templates, by its kind, as the tracker lists them under ⋮ › Templates: each fills what it says when picked.
 * The app's own, given as the menu opens (`menuFrom`); invented.
 */
const TEMPLATES: Record<string, { id: string; label: string; values: Record<string, JsonValue> }[]> = {
  bug: [
    { id: 'crash', label: 'Crash report', values: { severity: '1', priority: '1', system_info: '<p><strong>Browser:</strong> Edge 141 on Windows 11</p><p><strong>Build:</strong> see <a href="https://example.com/builds/latest">the latest build</a></p>' } },
    { id: 'data', label: 'Wrong figures', values: { severity: '2', priority: '2', category: 'business', system_info: '<p><strong>Report:</strong> the figure on screen, and the one expected</p>' } },
  ],
  task: [{ id: 'chore', label: 'Housekeeping', values: { priority: '3', activity: 'development' } }],
};

/** The tracker's actions this demo does not have: said in the popup, as the chrome's are beside it. */
const ELSEWHERE = new Set(['new-linked', 'change-type', 'move-project', 'email', 'new-branch', 'customize', 'capture-template']);

/** The app's answers to the bug's buttons: Follow and its notification settings, Copy link, and the ⋮ menu's Templates. */
async function answer(request: ActionRequest): Promise<ActionResult | void> {
  // Templates: the kind's own, asked for as ⋮ opens; one picked fills its fields.
  if (request.action === 'templates') {
    const kind = String(request.values['work_type'] ?? 'bug');
    return { menu: (TEMPLATES[kind] ?? []).map((one) => ({ id: `tpl-${one.id}`, label: one.label, icon: 'file', action: 'apply-template', params: { kind, template: one.id } })) };
  }
  if (request.action === 'apply-template') {
    const found = TEMPLATES[String(request.params?.['kind'])]?.find((one) => one.id === request.params?.['template']);
    return found ? { values: found.values as ActionResult['values'], say: WORDS.applied(found.label) } : undefined;
  }
  if (ELSEWHERE.has(request.action)) return { say: WORDS.notHere };
  const id = request.recordId;
  if (id === null) return;
  if (request.action === 'follow' || request.action === 'follow-all' || request.action === 'follow-state') {
    // Follow toggles; a notification setting follows the bug. Kept by the server, so the record has no change to save.
    if (request.action === 'follow' && following.has(id)) following.delete(id);
    else following.add(id);
    return { stored: { following: following.has(id) } };
  }
  if (request.action === 'copy-link') {
    const address = new URL(location.href);
    address.searchParams.set('workitem', String(id));
    await navigator.clipboard?.writeText(address.href).catch(() => undefined);
    return { say: address.href };
  }
}

/** The words in the empty comment box, and what # and ! link, in the reader's language. */
const COMMENTING = {
  en: { hint: 'Add a comment. Use # to link a work item, @ to mention a person, or ! to link a pull request.', item: 'work item', pull: 'pull request' },
  ar: { hint: 'أضف تعليقًا. استخدم # لربط بند عمل، و@ للإشارة إلى شخص، و! لربط طلب سحب.', item: 'بند عمل', pull: 'طلب سحب' },
  de: { hint: 'Kommentar hinzufügen. Mit # verknüpfen Sie ein Arbeitselement, mit @ erwähnen Sie eine Person, mit ! verknüpfen Sie einen Pull Request.', item: 'Arbeitselement', pull: 'Pull Request' },
  fr: { hint: 'Ajoutez un commentaire. Utilisez # pour lier un élément de travail, @ pour mentionner une personne ou ! pour lier une demande de tirage.', item: 'un élément de travail', pull: 'une demande de tirage' },
  // Turkish, Persian, Urdu and Spanish: machine-assisted, not yet reviewed by a native speaker.
  tr: { hint: 'Yorum ekleyin. Bir iş öğesini bağlamak için #, bir kişiden bahsetmek için @, bir çekme isteğini bağlamak için ! kullanın.', item: 'İş öğesi', pull: 'Çekme isteği' },
  fa: { hint: 'نظری اضافه کنید. برای پیوند دادن یک مورد کاری از #، برای اشاره به کسی از @ و برای پیوند دادن یک درخواست ادغام از ! استفاده کنید.', item: 'مورد کاری', pull: 'درخواست ادغام' },
  ur: { hint: 'تبصرہ شامل کریں۔ کسی ورک آئٹم کو لنک کرنے کے لیے #، کسی شخص کا ذکر کرنے کے لیے @، یا کسی پل ریکویسٹ کو لنک کرنے کے لیے ! استعمال کریں۔', item: 'ورک آئٹم', pull: 'پل ریکویسٹ' },
  es: { hint: 'Añada un comentario. Use # para vincular un elemento de trabajo, @ para mencionar a una persona o ! para vincular una solicitud de incorporación de cambios.', item: 'un elemento de trabajo', pull: 'una solicitud de incorporación de cambios' },
}[locale];

/** Records a comment links by their key, found in the demo's data. */
const find = (model: string) => async (query: string) => (await dataSource.search?.({ model, query, limit: 8 })) ?? [];

/** The popup's slots: the bug's discussion, and its history. */
function slots() {
  return {
    discussion: chatterSlot({
      look: 'discussion',
      source: chatter,
      me,
      placeholder: COMMENTING.hint,
      references: [
        { key: '#', model: 'work.item', label: COMMENTING.item, icon: 'hash', search: find('work.item') },
        { key: '!', model: 'pull.request', label: COMMENTING.pull, icon: 'pull-request', search: find('pull.request') },
      ],
      locale: locale as Locale,
      dir,
      // The comment count in the head follows the comments, kept as the server has it: no change to save.
      onCount: (count, form) => form.setValues({ comment_count: count }, { stored: true }),
    }),
    history: historySlot({ source: chatter, stateField: 'state', reasonField: 'reason', kind: 'work item', locale: locale as Locale, dir }),
  };
}

/** The ⋮ menu's drawings Fieldia has none of, in its own lines: add, change, move, delete, a template, a brush. */
const MENU_ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  move: '<path d="M4 12h11M11 8l4 4-4 4"/><path d="M15 4h5v16h-5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  template: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 9h16M10 9v12"/>',
  brush: '<path d="M14 4l6 6-8 8-6-6z"/><path d="M6 12l-2 6 6-2"/>',
};

/** The popup's shape: a large window over the backlog, nothing dimmed, that can fill the window and be resized. */
const POPUP: Pick<FormDialogOptions, 'size' | 'backdrop' | 'maximise' | 'resizable'> = { size: 'inset', backdrop: 'clear', maximise: true, resizable: true };

/** The bug in the address while it is open, so a reload opens it again. */
function remember(id: RecordId | null) {
  const next = new URLSearchParams(location.search);
  if (id === null) next.delete('workitem');
  else next.set('workitem', String(id));
  const query = next.toString();
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
}

let opened: Promise<FormDialogResult> | null = null;
/** Open a bug in the popup, or a new one for null; the list asks again once a new one is saved. */
async function openBug(id: RecordId | null): Promise<FormDialogResult | null> {
  if (opened) return null;
  remember(id);
  const title = localizePage(bugPage, locale).title ?? WORDS.bug;
  opened = openFormDialog({
    ...POPUP,
    page: bugPage,
    recordId: id,
    title: id === null ? title : `${title} ${id}`,
    dataSource,
    locale: locale as Locale,
    dir,
    tokens,
    preferences,
    slots: slots(),
    // Related Work's New item opens a new work item on the bug's own page.
    relatedPages: { 'work.item': bugPage },
    onAction: answer,
    // The ⋮ menu's own drawings, beside Fieldia's.
    icons: MENU_ICONS,
  });
  try {
    const result = await opened;
    if (id === null && result.saved) await list.reload();
    return result;
  } finally {
    opened = null;
    remember(null);
  }
}

// A bug in the address opens as the page does, through the list as a row's press would — but with no row lit, as none was
// pressed: the backlog asked again and the focus on its row once it closes.
const asked = Number(params.get('workitem'));
if (Number.isInteger(asked) && asked > 0) void list.openRecord(asked, { lit: false });

Object.assign(window, { fieldiaDemo: { handle: list, page: backlogPage, bugPage, dataSource, chatter, preferences, following } });
