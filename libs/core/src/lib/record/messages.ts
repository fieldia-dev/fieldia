/**
 * Validation messages, by language. `{label}` is the field's label; the other
 * placeholders are named in each English message. English keeps the React
 * engine's wording; Arabic, German and French build on its translations.
 */
export interface Messages {
  required: string;
  maxLength: string;
  pattern: string;
  text: string;
  number: string;
  integer: string;
  min: string;
  max: string;
  decimals: string;
  boolean: string;
  dateFormat: string;
  dateInvalid: string;
  datetimeFormat: string;
  datetimeInvalid: string;
  choice: string;
  choices: string;
  record: string;
  records: string;
  reference: string;
  file: string;
  fileSize: string;
  fileType: string;
  /** Joins the last two items of a list: "PDF or image". */
  or: string;
}

export type Locale = 'en' | 'ar' | 'de' | 'fr';

export const MESSAGES: Record<Locale, Messages> = {
  en: {
    required: '{label} is required',
    maxLength: 'Maximum {max} characters allowed',
    pattern: '{label} is not in the expected format',
    text: '{label} must be text',
    number: '{label} must be a number',
    integer: '{label} must be a whole number',
    min: '{label} must be at least {min}',
    max: '{label} must be at most {max}',
    decimals: 'Maximum {digits} decimal places allowed',
    boolean: '{label} must be yes or no',
    dateFormat: 'Invalid date format (expected YYYY-MM-DD)',
    dateInvalid: 'Invalid date (check month/day values)',
    datetimeFormat: 'Invalid date and time format (expected YYYY-MM-DDTHH:MM:SS)',
    datetimeInvalid: 'Invalid date and time (check the values)',
    choice: 'Must be one of: {options}',
    choices: '{label} must be a list of choices',
    record: '{label} must be a record',
    records: '{label} must be a list of records',
    reference: '{label} must point to {aModels}',
    file: '{label} must be a file',
    fileSize: '{label} is larger than {size}',
    fileType: '{label} must be {aTypes} file',
    or: 'or',
  },
  ar: {
    required: '{label} مطلوب',
    maxLength: 'الحد الأقصى {max} حرفًا',
    pattern: 'صيغة {label} غير صحيحة',
    text: 'يجب أن يكون {label} نصًا',
    number: 'يجب أن يكون {label} رقمًا',
    integer: 'يجب أن يكون {label} رقمًا صحيحًا',
    min: 'يجب ألا يقل {label} عن {min}',
    max: 'يجب ألا يزيد {label} عن {max}',
    decimals: 'الحد الأقصى {digits} منازل عشرية',
    boolean: 'يجب أن يكون {label} نعم أو لا',
    dateFormat: 'صيغة التاريخ غير صحيحة (المتوقع YYYY-MM-DD)',
    dateInvalid: 'التاريخ غير صحيح (تحقق من الشهر واليوم)',
    datetimeFormat: 'صيغة التاريخ والوقت غير صحيحة (المتوقع YYYY-MM-DDTHH:MM:SS)',
    datetimeInvalid: 'التاريخ والوقت غير صحيحين',
    choice: 'يجب أن تكون القيمة واحدة من: {options}',
    choices: 'يجب أن يكون {label} قائمة اختيارات',
    record: 'يجب أن يكون {label} سجلًا',
    records: 'يجب أن يكون {label} قائمة سجلات',
    reference: 'يجب أن يشير {label} إلى {models}',
    file: 'يجب أن يكون {label} ملفًا',
    fileSize: 'حجم {label} أكبر من {size}',
    fileType: 'يجب أن يكون {label} ملف {types}',
    or: 'أو',
  },
  de: {
    required: '{label} ist erforderlich',
    maxLength: 'Maximal {max} Zeichen erlaubt',
    pattern: '{label} hat nicht das erwartete Format',
    text: '{label} muss Text sein',
    number: '{label} muss eine Zahl sein',
    integer: '{label} muss eine ganze Zahl sein',
    min: '{label} muss mindestens {min} sein',
    max: '{label} darf höchstens {max} sein',
    decimals: 'Maximal {digits} Nachkommastellen erlaubt',
    boolean: '{label} muss ja oder nein sein',
    dateFormat: 'Ungültiges Datumsformat (erwartet JJJJ-MM-TT)',
    dateInvalid: 'Ungültiges Datum (Monat und Tag prüfen)',
    datetimeFormat: 'Ungültiges Datums- und Zeitformat (erwartet JJJJ-MM-TTTHH:MM:SS)',
    datetimeInvalid: 'Ungültiges Datum oder ungültige Uhrzeit',
    choice: 'Muss eines davon sein: {options}',
    choices: '{label} muss eine Liste von Optionen sein',
    record: '{label} muss ein Datensatz sein',
    records: '{label} muss eine Liste von Datensätzen sein',
    reference: '{label} muss auf {models} verweisen',
    file: '{label} muss eine Datei sein',
    fileSize: '{label} ist größer als {size}',
    fileType: '{label} muss eine {types}-Datei sein',
    or: 'oder',
  },
  fr: {
    required: '{label} est obligatoire',
    maxLength: '{max} caractères au maximum',
    pattern: "{label} n'a pas le format attendu",
    text: '{label} doit être du texte',
    number: '{label} doit être un nombre',
    integer: '{label} doit être un nombre entier',
    min: '{label} doit être au moins {min}',
    max: '{label} doit être au plus {max}',
    decimals: '{digits} décimales au maximum',
    boolean: '{label} doit être oui ou non',
    dateFormat: 'Format de date invalide (attendu AAAA-MM-JJ)',
    dateInvalid: 'Date invalide (vérifiez le mois et le jour)',
    datetimeFormat: 'Format de date et heure invalide (attendu AAAA-MM-JJTHH:MM:SS)',
    datetimeInvalid: 'Date ou heure invalide',
    choice: 'Doit être parmi : {options}',
    choices: '{label} doit être une liste de choix',
    record: '{label} doit être un enregistrement',
    records: "{label} doit être une liste d'enregistrements",
    reference: '{label} doit pointer vers {models}',
    file: '{label} doit être un fichier',
    fileSize: '{label} dépasse {size}',
    fileType: '{label} doit être un fichier {types}',
    or: 'ou',
  },
};

/** Fill `{name}` placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
