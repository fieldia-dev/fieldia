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
 * The designer's words in Turkish. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 *
 * Formal "siz" in sentences, short imperatives on buttons (Kaydet, Yayımla); a blank never takes a suffix — a noun
 * after it does ("“Şehir” alanı"), and a number takes the singular ("3 alan"); numbers in Latin digits, a decimal comma.
 *
 * Glossary — one word for one thing, across the whole designer and Fieldia's Turkish tables:
 *   form form · screen ekran · page sayfa · section bölüm · group grup · tab sekme · row satır · column sütun
 *   part öğe · field alan · question soru · option seçenek · answer yanıt · kind tür · label etiket
 *   help yardım metni · placeholder yer tutucu metin · title başlık · description açıklama
 *   required zorunlu · read-only salt okunur · hidden gizli · rule kural · condition koşul · formula formül
 *   worked out hesaplanan · publish yayımla · version sürüm · draft taslak · Checks Denetimler · undo geri al · redo yinele
 *   Simple / Advanced Basit / Gelişmiş · toolbox araç kutusu · panel panel · look görünüm
 *   outline ana hat (never "şema", a JSON Schema) · layout yerleşim (never "ayarlar", the settings)
 *   template şablon · assistant asistan · translation çeviri · language dil · model veri modeli · record kayıt
 *   list liste · survey anket · canvas tasarım alanı · saved form kayıtlı form
 *   sheet (a record's) kayıt sayfası, so it never meets "sayfa", the page
 *   theme (the eight colour themes) tema · skin (underline, outlined, quiet) kaplama: Alt çizgili, Kenarlıklı, Sade
 *   label etiket · tags (the kind) çoklu seçim kutusu · keywords anahtar sözcükler · image görsel · badge, pill rozet
 *   record head kayıt üst bilgisi · breadcrumbs gezinti yolu · pager sayfalama · tokens tasarım belirteçleri
 *   quiz sınav · places (an option's seats) kontenjan · fence coğrafi sınır · discard (changes) değişiklikleri at
 */
export const tr: DesignerWords = { bar, kinds, defaults, toolbox, options, refusals, rules, parts, rulesUi, languages, changes, settingsChanges, checks, questions, layout, canvas, panel, looks, outline, clipboard, list, tryIt, json, translations, shortcuts, templates, assistant, partLooks, savedForms, steps, tables, mapPart, relatedPart, head, workText, inputs, endings };
