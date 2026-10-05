import type { DesignerWords } from '../../designer-words';
import { bar } from './bar';
import { kinds } from './kinds';
import { defaults } from './defaults';
import { toolbox } from './toolbox';
import { options } from './options';
import { refusals } from './refusals';
import { rules } from './rules';
import { parts } from './parts';
import { rulesUi } from './rules-ui';
import { languages } from './languages';
import { changes } from './changes';
import { settingsChanges } from './settings-changes';
import { checks } from './checks';
import { questions } from './questions';
import { layout } from './layout';
import { canvas } from './canvas';
import { panel } from './panel';
import { looks } from './looks';
import { outline, clipboard } from './outline';
import { list } from './list';
import { tryIt } from './try-it';
import { json } from './json';
import { translations } from './translations';
import { shortcuts } from './shortcuts';
import { templates, assistant } from './templates';
import { partLooks } from './part-looks';
import { savedForms } from './saved-forms';

/**
 * The designer's words in Arabic: Modern Standard Arabic as Arabic software
 * says it (Google Forms and Microsoft Forms in Arabic), numbers in Latin
 * digits. A name in a sentence is quoted «…» and isolated (`quoteAr`).
 *
 * Glossary — one word for one thing, across the whole designer:
 *   form (a survey) نموذج · screen شاشة · page (what is designed; a survey's page) صفحة
 *   section قسم · group مجموعة · tab علامة تبويب · row صف · column عمود · part جزء
 *   field حقل · question سؤال · option خيار · answer إجابة · kind (of field) نوع
 *   label التسمية · help نص المساعدة · placeholder النص الإرشادي · title العنوان · description الوصف
 *   required مطلوب · read-only للقراءة فقط · hidden مخفي · shows when يظهر عندما
 *   rule قاعدة · condition شرط · formula صيغة · worked out (computed) محسوب
 *   publish نشر · version إصدار · draft مسودة · Checks التحقق · undo تراجع · redo إعادة
 *   design / try it تصميم / تجربة · Simple / Advanced بسيط / متقدم
 *   toolbox الأدوات · outline المخطط · panel اللوحة · look المظهر · layout التخطيط
 *   template قالب · assistant المساعد · translation ترجمة · language لغة
 *   duplicate تكرار · delete حذف · remove إزالة · move نقل · copy نسخ · paste لصق
 *   model (the backend's) نموذج البيانات · record سجل · list قائمة · sheet ورقة
 *   desktop / tablet / phone سطح المكتب / جهاز لوحي / هاتف · width العرض
 *   survey استبيان · canvas مساحة التصميم · filter عامل التصفية · grouping تجميع
 *   cut قص · keyboard shortcuts اختصارات لوحة المفاتيح · pick (select) اختيار / المختار
 *   saved form نموذج محفوظ · each kind of part كل نوع من الأجزاء · text boxes مربعات النص · as the page كما في الصفحة
 */
export const ar: DesignerWords = { bar, kinds, defaults, toolbox, options, refusals, rules, parts, rulesUi, languages, changes, settingsChanges, checks, questions, layout, canvas, panel, looks, outline, clipboard, list, tryIt, json, translations, shortcuts, templates, assistant, partLooks, savedForms };
