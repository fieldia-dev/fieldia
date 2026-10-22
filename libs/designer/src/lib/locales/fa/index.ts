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
import { steps } from './steps';
import { tables } from './tables';
import { mapPart } from './map-part';
import { relatedPart } from './related-part';
import { head } from './head';
import { workText } from './work-text';
import { inputs } from './inputs';
import { endings } from './endings';

/**
 * The designer's words in Persian (Farsi). UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 *
 * Formal, as Persian software says it; ی and ک, the zero-width non-joiner where Persian writes it (می‌شود، فیلدها);
 * numbers in Latin digits. A name in a sentence is quoted «…» and isolated (`quoteAr`), a left-to-right fragment
 * isolated (`ltr`).
 *
 * Glossary — one word for one thing, across the whole designer and Fieldia's Persian tables:
 *   form فرم · screen نما · page صفحه · section بخش · group گروه · tab زبانه · row ردیف · column ستون · part جزء
 *   field فیلد · question پرسش · option گزینه · answer پاسخ · kind نوع · label برچسب · help متن راهنما
 *   placeholder متن نمونه · title عنوان · description توضیح · required الزامی · read-only فقط‌خواندنی · hidden پنهان
 *   rule قاعده · condition شرط · formula فرمول · worked out محاسبه‌شده · publish انتشار · version نسخه · draft پیش‌نویس
 *   Checks بررسی‌ها · undo واگرد · redo ازنو · Simple / Advanced ساده / پیشرفته · toolbox جعبه‌ابزار · outline ساختار
 *   panel پنل · look ظاهر · layout چیدمان · template الگو · assistant دستیار · translation ترجمه · language زبان
 *   model مدل داده · record رکورد · list فهرست · survey نظرسنجی · canvas بوم طراحی · saved form فرم ذخیره‌شده
 *
 * Words the review settled, each kept apart from its neighbour:
 *   a table's line سطر (a layout's row stays ردیف; a visual line, a divider, خط) · heading سرعنوان (title عنوان)
 *   record head سرآیند رکورد · a sheet's header سربرگ · a printout's header / footer سرصفحه / پاصفحه
 *   theme تم · skin پوسته (underline خط زیرین, outlined کادردار, quiet متن‌گونه) · tone رنگ‌مایه (colour رنگ;
 *   a message's tone in steps لحن) · accent رنگ تأکید · label برچسب · tags تگ · chips تراشه · badge نشان
 *   ribbon روبان · alert اعلان (a warning هشدار) · icon نماد · action اقدام · dialog پنجرهٔ محاوره‌ای
 *   pattern قالب · format فرمت · mask ماسک ورودی (template stays الگو) · schema طرح‌واره (outline ساختار)
 *   a value's ending پسوند · a form's ending (once it is sent) پایان · a slider's step گام (a form's step مرحله)
 *   a list's saved view جستجوی ذخیره‌شده (screen نما) · a calendar's views نمایش‌ها · agenda برنامهٔ زمانی
 *   review (before sending) مرور · cell خانه · gaps جای خالی · thumbnails تصویرهای بندانگشتی · cover عکس جلد
 *   caption زیرنویس · offer (a choice, a record, a feature) ارائه کردن · at least دست‌کم · least values کمینه
 *   period بازهٔ زمانی · Hijri هجری قمری · download دانلود · load بارگیری · upload بارگذاری · Done تمام
 */
export const fa: DesignerWords = { bar, kinds, defaults, toolbox, options, refusals, rules, parts, rulesUi, languages, changes, settingsChanges, checks, questions, layout, canvas, panel, looks, outline, clipboard, list, tryIt, json, translations, shortcuts, templates, assistant, partLooks, savedForms, steps, tables, mapPart, relatedPart, head, workText, inputs, endings };
