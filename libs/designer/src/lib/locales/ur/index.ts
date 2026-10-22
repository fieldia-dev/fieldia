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
 * The designer's words in Urdu. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 *
 * Formal "آپ"; Urdu letters (ی ے ک ہ ٹ ڈ ڑ); a sentence ends with ۔; numbers in Latin digits. Where a verb would agree
 * with a name it cannot see, the sentence puts the name before a colon. A name in a sentence is quoted «…» and isolated
 * (`quoteAr`), a left-to-right fragment isolated (`ltr`). فیلڈ is feminine everywhere (نئی فیلڈ، فیلڈ دکھاتی ہے). "Of"
 * in a bare count is از (مرحلہ 2 از 5); in a sentence, میں سے. A setting's name quoted in a sentence is the panel's
 * own words for it, as `panel`'s NAMES gives them («سمٹ سکتا ہے», «متن سے بھریں», «بعد میں جاری رکھیں»).
 *
 * Glossary — one word for one thing, across the whole designer and Fieldia's Urdu tables:
 *   form فارم · screen اسکرین · page صفحہ · section حصہ · group گروپ · tab ٹیب · row قطار · line (of a table) سطر
 *   column کالم · cell سیل · box خانہ · part جز · field فیلڈ · question سوال · option اختیار · answer جواب · kind قسم
 *   label لیبل · tags ٹیگز · help مدد کا متن · placeholder نمونے کا متن · title عنوان · description تفصیل · value قدر
 *   required لازمی · read-only صرف پڑھنے کے لیے · hidden پوشیدہ · rule قاعدہ · condition شرط · formula فارمولا
 *   worked out حساب شدہ · publish شائع کریں · version ورژن · draft مسودہ · Checks جانچ · undo کالعدم کریں
 *   redo دوبارہ کریں · Simple / Advanced سادہ / اعلیٰ · toolbox ٹول باکس · outline خاکہ · schema اسکیما · panel پینل
 *   settings سیٹنگز (one: سیٹنگ) · layout ترتیب · look انداز · skin بنیادی انداز · theme تھیم · quiet خاموش انداز
 *   accent نمایاں رنگ · tone رنگت · divider تقسیمی لکیر · template سانچہ · assistant معاون · translation ترجمہ
 *   language زبان · model ڈیٹا ماڈل · data source ڈیٹا سورس · record ریکارڈ · list فہرست · a list's saved view منظر
 *   survey سروے · saved form محفوظ فارم · ending اختتامیہ · head (of a record) ہیڈر · fold سمیٹنا (Folds: سمٹ سکتا ہے)
 *   layer پرت · place مقام · area علاقہ · fence حد بندی · pin نشان · step (of a slider) وقفہ · key (on a keyboard) کلید
 *   keyboard shortcuts کی بورڈ شارٹ کٹس · whole number مکمل عدد · "X from" X کا ماخذ · bold / italic / underline /
 *   strikethrough جلی / ترچھا / خط کشیدہ / قلم زد · table (a text's) جدول · address پتہ · crop تراشیں
 */
export const ur: DesignerWords = { bar, kinds, defaults, toolbox, options, refusals, rules, parts, rulesUi, languages, changes, settingsChanges, checks, questions, layout, canvas, panel, looks, outline, clipboard, list, tryIt, json, translations, shortcuts, templates, assistant, partLooks, savedForms, steps, tables, mapPart, relatedPart, head, workText, inputs, endings };
