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
  /** A choice of a field with an "Other" answer. */
  choiceOrOther: string;
  /** A matrix: the value is not an answer per row; a row it does not have; rows left unanswered. */
  matrix: string;
  matrixRow: string;
  matrixRows: string;
  choices: string;
  record: string;
  records: string;
  reference: string;
  file: string;
  fileSize: string;
  fileType: string;
  /** Several files: fewer than the fewest (never under two: one is what required asks), more than the most. */
  minFiles: string;
  maxFiles: string;
  /**
   * Answer rules, besides the messages above they share (maxLength, pattern,
   * min, max): a shortest length, an ending, how many may be ticked, a day
   * in the past or the future.
   */
  minLength: string;
  endsWith: string;
  atLeast: string;
  atMost: string;
  datePast: string;
  dateFuture: string;
  /** A rule across fields that does not hold, when it says nothing of its own. */
  holds: string;
  /** Joins the last two items of a list: "PDF or image". */
  or: string;
  /** A tick box that must be ticked to go on, as an "I agree" box. */
  tick: string;
  /** What to type in an email, a web address, a phone number and a time of day, by example. */
  email: string;
  url: string;
  phone: string;
  time: string;
  /** A date or a time outside its earliest (`{min}`) or latest (`{max}`), and a day of the week it may not fall on (`{days}`). */
  before: string;
  after: string;
  weekday: string;
  /** The language the days in these messages are written in, as Intl reads it. */
  locale: string;
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
    choiceOrOther: 'Must be one of: {options}, or an answer of its own',
    matrix: '{label} takes an answer for each row',
    matrixRow: 'Rows are: {rows}',
    matrixRows: 'Answer every row of {label}',
    choices: '{label} must be a list of choices',
    record: '{label} must be a record',
    records: '{label} must be a list of records',
    reference: '{label} must point to {aModels}',
    file: '{label} must be a file',
    fileSize: '{label} is larger than {size}',
    fileType: '{label} must be {aTypes} file',
    minFiles: 'Add at least {min} files to {label}',
    maxFiles: 'Too many files for {label}: at most {max}',
    minLength: '{label} must be at least {min} characters',
    endsWith: '{label} must end with {ending}',
    atLeast: 'Choose at least {min} for {label}',
    atMost: 'Choose at most {max} for {label}',
    datePast: '{label} must be in the past',
    dateFuture: '{label} must be in the future',
    holds: '{label} does not agree with the other answers',
    or: 'or',
    tick: 'Tick this box to go on',
    email: 'Enter an email address, like name@example.com',
    url: 'Enter a web address, like example.com',
    phone: 'Enter a phone number, like +20 100 123 4567',
    time: 'Enter a time, like 14:30',
    before: '{label} can’t be before {min}',
    after: '{label} can’t be after {max}',
    weekday: '{label} can’t be on a {days}',
    locale: 'en',
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
    choiceOrOther: 'يجب أن تكون القيمة واحدة من: {options}، أو إجابة أخرى',
    matrix: 'يأخذ {label} إجابة لكل صف',
    matrixRow: 'الصفوف هي: {rows}',
    matrixRows: 'أجب عن كل صفوف {label}',
    choices: 'يجب أن يكون {label} قائمة اختيارات',
    record: 'يجب أن يكون {label} سجلًا',
    records: 'يجب أن يكون {label} قائمة سجلات',
    reference: 'يجب أن يشير {label} إلى {models}',
    file: 'يجب أن يكون {label} ملفًا',
    fileSize: 'حجم {label} أكبر من {size}',
    fileType: 'يجب أن يكون {label} ملف {types}',
    minFiles: 'أضف إلى {label} ملفات لا يقل عددها عن {min}',
    maxFiles: 'عدد الملفات في {label} أكثر من {max}',
    minLength: 'يجب ألا يقل {label} عن {min} حرفًا',
    endsWith: 'يجب أن ينتهي {label} بـ {ending}',
    atLeast: 'اختر {min} على الأقل في {label}',
    atMost: 'اختر {max} على الأكثر في {label}',
    datePast: 'يجب أن يكون {label} في الماضي',
    dateFuture: 'يجب أن يكون {label} في المستقبل',
    holds: 'لا يتفق {label} مع الإجابات الأخرى',
    or: 'أو',
    tick: 'ضع علامة في هذا المربع للمتابعة',
    email: 'أدخل بريدًا إلكترونيًا، مثل name@example.com',
    url: 'أدخل عنوان موقع، مثل example.com',
    phone: 'أدخل رقم هاتف، مثل \u2066+20 100 123 4567\u2069',
    time: 'أدخل وقتًا، مثل 14:30',
    before: 'لا يمكن أن يكون {label} قبل {min}',
    after: 'لا يمكن أن يكون {label} بعد {max}',
    weekday: 'لا يمكن أن يكون {label} يوم {days}',
    locale: 'ar',
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
    choiceOrOther: 'Muss eines davon sein: {options} – oder eine eigene Antwort',
    matrix: '{label} braucht eine Antwort je Zeile',
    matrixRow: 'Die Zeilen sind: {rows}',
    matrixRows: 'Beantworten Sie jede Zeile von {label}',
    choices: '{label} muss eine Liste von Optionen sein',
    record: '{label} muss ein Datensatz sein',
    records: '{label} muss eine Liste von Datensätzen sein',
    reference: '{label} muss auf {models} verweisen',
    file: '{label} muss eine Datei sein',
    fileSize: '{label} ist größer als {size}',
    fileType: '{label} muss eine {types}-Datei sein',
    minFiles: 'Fügen Sie {label} mindestens {min} Dateien hinzu',
    maxFiles: 'Zu viele Dateien für {label}: höchstens {max}',
    minLength: '{label} muss mindestens {min} Zeichen haben',
    endsWith: '{label} muss auf {ending} enden',
    atLeast: 'Wählen Sie bei {label} mindestens {min} aus',
    atMost: 'Wählen Sie bei {label} höchstens {max} aus',
    datePast: '{label} muss in der Vergangenheit liegen',
    dateFuture: '{label} muss in der Zukunft liegen',
    holds: '{label} passt nicht zu den anderen Antworten',
    or: 'oder',
    tick: 'Kreuzen Sie dieses Kästchen an, um fortzufahren',
    email: 'Geben Sie eine E-Mail-Adresse ein, z. B. name@example.com',
    url: 'Geben Sie eine Webadresse ein, z. B. example.com',
    phone: 'Geben Sie eine Telefonnummer ein, z. B. +49 30 1234 5678',
    time: 'Geben Sie eine Uhrzeit ein, z. B. 14:30',
    before: '{label}: frühestens {min}',
    after: '{label}: spätestens {max}',
    weekday: '{label} darf nicht auf einen {days} fallen',
    locale: 'de',
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
    choiceOrOther: 'Doit être parmi : {options}, ou une réponse libre',
    matrix: '{label} attend une réponse par ligne',
    matrixRow: 'Les lignes sont : {rows}',
    matrixRows: 'Répondez à chaque ligne de {label}',
    choices: '{label} doit être une liste de choix',
    record: '{label} doit être un enregistrement',
    records: "{label} doit être une liste d'enregistrements",
    reference: '{label} doit pointer vers {models}',
    file: '{label} doit être un fichier',
    fileSize: '{label} dépasse {size}',
    fileType: '{label} doit être un fichier {types}',
    minFiles: 'Ajoutez au moins {min} fichiers à {label}',
    maxFiles: 'Trop de fichiers pour {label} : {max} au plus',
    minLength: '{label} doit comporter au moins {min} caractères',
    endsWith: '{label} doit se terminer par {ending}',
    atLeast: 'Choisissez au moins {min} pour {label}',
    atMost: 'Choisissez au plus {max} pour {label}',
    datePast: '{label} doit être dans le passé',
    dateFuture: '{label} doit être dans le futur',
    holds: '{label} ne concorde pas avec les autres réponses',
    or: 'ou',
    tick: 'Cochez cette case pour continuer',
    email: 'Saisissez une adresse e-mail, par exemple nom@exemple.com',
    url: 'Saisissez une adresse web, par exemple exemple.com',
    phone: 'Saisissez un numéro de téléphone, par exemple +33 1 23 45 67 89',
    time: 'Saisissez une heure, par exemple 14:30',
    before: '{label} : au plus tôt {min}',
    after: '{label} : au plus tard {max}',
    weekday: '{label} ne peut pas tomber un {days}',
    locale: 'fr',
  },
};

/** Fill `{name}` placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
