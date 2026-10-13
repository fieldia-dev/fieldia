import type { Locale } from '@fieldia/core';

/**
 * What is known of the regions and cities of Egypt, Saudi Arabia, the UAE
 * and Jordan, for reading Azure's addresses there, where each of its services
 * names one place its own way: a region by its code ("RIY", "SH") or by a
 * name ("Sharjah Emirate", "Ash Shāriqah", "منطقة الرياض", "مكة"), a city as
 * a locality in another script ("Cairo" in an Arabic answer) or another
 * spelling ("Ad Dammām", "الأسكندرية"). Each place here has one name in each
 * language, which Fieldia writes, and every other name Azure was seen to give
 * it (12–13 Oct 2026; each region's capital asked for in English and
 * Arabic on 13 Oct). Loaded with the providers' address parts.
 *
 * A place is one of these only by its code or one of its names, the same
 * words (without accents, vowel marks or tatweel, in lower case): never by
 * a name that only sounds like one.
 */

/** A place's names: in English, in Arabic, in French and German where they differ from English. */
export interface Known {
  names: Partial<Record<Locale, string>> & { en: string; ar: string };
  code?: string;
}

/**
 * One place a line: its code (Azure's, where it gives one), its English
 * and Arabic names, then its other names, comma-separated; `fr=`/`de=` give
 * its French or German name.
 */
const REGIONS: Record<string, string> = {
  EG: `
|Cairo|القاهرة|Al Qahirah, Al Qāhirah, al-Qahirah, Cairo Governorate, محافظة القاهرة, fr=Le Caire, de=Kairo
|Giza|الجيزة|Al Jizah, Al Jīzah, al-Jeezah, Giza Governorate, محافظة الجيزة, fr=Gizeh, de=Gizeh, Gise
|Alexandria|الإسكندرية|Al Iskandariyah, Alexandria Governorate, الاسكندرية, الأسكندرية, محافظة الإسكندرية, fr=Alexandrie
|Qalyubia|القليوبية|Al Qalyubiyah, Qalyubiyah, Kalyubia
|Beheira|البحيرة|Al Buhayrah, Buhayrah
|Ismailia|الإسماعيلية|Al Isma'iliyah, Al Ismailiyah, الاسماعيلية
|Sharqia|الشرقية|Ash Sharqiyah, Ash Sharqīyah, Sharkia, Al Sharqia
|Dakahlia|الدقهلية|Ad Daqahliyah, Daqahliyah
|Gharbia|الغربية|Al Gharbiyah
|Monufia|المنوفية|Al Minufiyah, Menofia
|Kafr El Sheikh|كفر الشيخ|Kafr ash Shaykh
|Damietta|دمياط|Dumyat, Dumyāţ, Domiat
|Port Said|بورسعيد|Bur Sa'id, Būr Sa‘īd, Bour Sa'eed, بور سعيد
|Suez|السويس|As Suways
|Faiyum|الفيوم|Al Fayyum, Fayoum
|Beni Suef|بني سويف|Bani Suwayf
|Minya|المنيا|Al Minya
|Asyut|أسيوط|Assiut, اسيوط
|Sohag|سوهاج|Suhaj
|Qena|قنا|Qina
|Luxor|الأقصر|Al Uqsur, الاقصر
|Aswan|أسوان|اسوان
|Red Sea|البحر الأحمر|Al Bahr al Ahmar
|New Valley|الوادي الجديد|Al Wadi al Jadid
|Matrouh|مطروح|Matruh
|North Sinai|شمال سيناء|Shamal Sina'
|South Sinai|جنوب سيناء|Janub Sina'`,
  SA: `
RIY|Riyadh|الرياض|Ar Riyad, Ar Riyāḑ, Riyadh Region, Riyadh Province, منطقة الرياض, fr=Riyad, de=Riad
MAK|Makkah|مكة المكرمة|Mecca, Makkah Region, Makkah Province, Makkah Al Mukarramah, مكة, منطقة مكة المكرمة, fr=La Mecque, de=Mekka
MAD|Madinah|المدينة المنورة|Medina, Al Madinah, Al Madinah Al Munawwarah, المدينة, منطقة المدينة المنورة, fr=Médine, de=Medina
EAS|Eastern Province|المنطقة الشرقية|Eastern, Eastern Region, Ash Sharqiyah, الشرقية
QAS|Al Qassim|القصيم|Al Qasim, Qassim, منطقة القصيم
ASI|Asir|عسير|'Asir, ‘Asir, منطقة عسير
TAB|Tabuk|تبوك|منطقة تبوك
HAI|Hail|حائل|Ha'il, Ḩā'il, منطقة حائل
JAZ|Jazan|جازان|Jizan, Gizan, جيزان, منطقة جازان
|Najran|نجران|منطقة نجران
|Al Bahah|الباحة|Al Baha, منطقة الباحة
JOF|Al Jawf|الجوف|منطقة الجوف
|Northern Borders|الحدود الشمالية|Northern Frontier, Al Hudud ash Shamaliyah, منطقة الحدود الشمالية`,
  AE: `
AZ|Abu Dhabi|أبوظبي|Abu Dhabi Emirate, Abu Zabi, أبو ظبي, إمارة أبوظبي, إمارة أبو ظبي, fr=Abou Dabi
DU|Dubai|دبي|Dubai Emirate, إمارة دبي, fr=Dubaï
SH|Sharjah|الشارقة|Sharjah Emirate, Ash Shariqah, Ash Shāriqah, إمارة الشارقة, fr=Charjah, de=Schardscha
AJ|Ajman|عجمان|Ajman Emirate, 'Ajman, إمارة عجمان
UQ|Umm Al Quwain|أم القيوين|Umm al Qaywayn, Umm Al-Quwain, Umm Al Quwain Emirate, Umm al-Quwain Emirate, ام القيوين
RK|Ras Al Khaimah|رأس الخيمة|Ra's al Khaymah, Ras al-Khaimah, Ras Al Khaimah Emirate, Ras al-Khaimah Emirate, راس الخيمة
FU|Fujairah|الفجيرة|Al Fujayrah, Fujairah Emirate`,
  JO: `
|Amman|عمان|Amman Governorate, Capital Governorate, Al Asimah, عمّان, محافظة العاصمة, العاصمة
|Irbid|إربد|اربد
|Zarqa|الزرقاء|Az Zarqa
|Balqa|البلقاء|Al Balqa
|Madaba|مادبا
|Karak|الكرك|Al Karak
|Tafilah|الطفيلة|At Tafilah
|Ma'an|معان|Maan
|Aqaba|العقبة|Al Aqabah
|Mafraq|المفرق|Al Mafraq
|Jerash|جرش|Jarash, محافظة جرش
|Ajloun|عجلون|Ajlun`,
};

const CITIES: Record<string, string> = {
  EG: `
|Cairo|القاهرة|Al Qahirah, Al Qāhirah, fr=Le Caire, de=Kairo
|Giza|الجيزة|Al Jizah, Al Jīzah, fr=Gizeh, de=Gizeh
|Alexandria|الإسكندرية|Al Iskandariyah, الاسكندرية, الأسكندرية, fr=Alexandrie
|New Cairo|القاهرة الجديدة|New Cairo City, Al Qahirah al Jadidah, مدينة القاهرة الجديدة
|6th of October|6 أكتوبر|6 October, 6th October, 6th of October City, Sixth of October, أكتوبر 6, السادس من أكتوبر, مدينة 6 أكتوبر, مدينة السادس من أكتوبر
|Sheikh Zayed|الشيخ زايد|El Sheikh Zaid, El Sheikh Zayed, Sheikh Zayed City, Sheikh Zaid, مدينة الشيخ زايد
|Helwan|حلوان
|Shubra El Kheima|شبرا الخيمة|Shubra al Khaymah, Shubrā al Khaymah
|Port Said|بورسعيد|Bur Sa'id, بور سعيد
|Suez|السويس|As Suways
|Ismailia|الإسماعيلية|El Ismailia, Al Isma'iliyah, الاسماعيلية
|Mansoura|المنصورة|El Mansoura, Al Mansurah
|Tanta|طنطا
|Zagazig|الزقازيق|El Zaqaziq, Az Zaqaziq
|Damietta|دمياط|Dumyat
|Banha|بنها|Benha
|Damanhur|دمنهور|Damanhour
|Shibin El Kom|شبين الكوم|Shibin al Kawm, Shebin El Kom
|Kafr El Sheikh|كفر الشيخ|Kafr ash Shaykh
|Faiyum|الفيوم|El Faiyum, Al Fayyum, Fayoum
|Beni Suef|بني سويف|Bani Suwayf
|Minya|المنيا|El Minya, El Menia, Al Minya
|Asyut|أسيوط|Assiut, اسيوط
|Sohag|سوهاج|Sawhaj, Suhaj
|Qena|قنا|Qina
|Luxor|الأقصر|Al Uqsur, الاقصر
|Aswan|أسوان|اسوان
|Hurghada|الغردقة|Al Ghardaqah
|Kharga|الخارجة|El Kharga, Al Kharijah
|Marsa Matruh|مرسى مطروح|Marsa Matrouh
|Arish|العريش|El Arish, Al Arish
|El Tor|الطور|At Tur, مدينة الطور, مدينه الطور
|Sharm El Sheikh|شرم الشيخ|Sharm ash Shaykh`,
  SA: `
|Riyadh|الرياض|Ar Riyad, fr=Riyad, de=Riad
|Jeddah|جدة|Jiddah, Jedda, جده, fr=Djeddah, de=Dschidda
|Makkah|مكة المكرمة|Mecca, Makkah Al Mukarramah, مكة, fr=La Mecque, de=Mekka
|Madinah|المدينة المنورة|Medina, Al Madinah, Al Madinah Al Munawwarah, المدينة, fr=Médine
|Dammam|الدمام|Ad Dammam, Ad Dammām
|Al Khobar|الخبر|Al Khubar, Khobar
|Dhahran|الظهران|Az Zahran
|Taif|الطائف|At Taif, At Ta’if, Ta'if
|Abha|أبها
|Khamis Mushait|خميس مشيط
|Tabuk|تبوك
|Buraydah|بريدة|Al Buraydah, Buraidah
|Hail|حائل|Ha'il
|Al Kharj|الخرج
|Al Hofuf|الهفوف|Al Hufuf, Hofuf
|Jubail|الجبيل|Al Jubayl, Al Jubail
|Yanbu|ينبع
|Najran|نجران
|Jazan|جازان|Jizan, جيزان
|Al Bahah|الباحة|Al Baha
|Sakaka|سكاكا|Sakakah
|Arar|عرعر|Arar & Wardat Nuaman, عرعر ورده نعمان`,
  AE: `
|Dubai|دبي|fr=Dubaï
|Abu Dhabi|أبوظبي|أبو ظبي, Abu Zabi, fr=Abou Dabi
|Sharjah|الشارقة|Sharjah City, مدينة الشارقة, Ash Shariqah, fr=Charjah, de=Schardscha
|Al Ain|العين|Al Ayn
|Ajman|عجمان|'Ajman
|Ras Al Khaimah|رأس الخيمة|Ra's al Khaymah, راس الخيمة
|Fujairah|الفجيرة|Al Fujayrah
|Umm Al Quwain|أم القيوين|Umm al Qaywayn, ام القيوين
|Khor Fakkan|خورفكان|Khawr Fakkan, خور فكان
|Kalba|كلباء`,
  JO: `
|Amman|عمان|عمّان
|Zarqa|الزرقاء|Az Zarqa, Zerka
|Irbid|إربد|اربد
|Aqaba|العقبة|Al Aqabah
|Salt|السلط|As Salt, Al Salt
|Tafilah|الطفيلة|At Tafila, At Tafilah
|Ma'an|معان|Maan
|Ajloun|عجلون|Ajlun
|Madaba|مادبا
|Jerash|جرش
|Mafraq|المفرق|Al Mafraq
|Karak|الكرك|Al Karak`,
};

/**
 * A name as two of Azure's answers write one place's: its words, without
 * accents, tatweel, vowel marks or the direction marks Arabic carries, in
 * lower case ("Ash Shāriqah" is "ash shariqah", "الشيـخ زايد" "الشيخ زايد").
 */
export const nameKey = (name: unknown) =>
  (typeof name === 'string' ? name : '')
    .replace(/[‎‏؜‪-‮⁦-⁩]/g, '')
    .normalize('NFD')
    .replace(/[\p{M}ـ]/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

interface Table {
  places: Known[];
  byName: Map<string, Known[]>;
  byCode: Map<string, Known>;
}

const tables = new Map<string, Table>();

function table(of: Record<string, string>, country: string): Table | undefined {
  const id = `${of === REGIONS ? 'r' : 'c'}${country}`;
  if (!tables.has(id) && of[country]) {
    const places: Known[] = [];
    const byName = new Map<string, Known[]>();
    const byCode = new Map<string, Known>();
    for (const line of of[country].trim().split('\n')) {
      const [code, en, ar, others = ''] = line.split('|');
      const names: Known['names'] = { en, ar };
      const all = [en, ar];
      for (const other of others.split(',').map((one) => one.trim()).filter(Boolean)) {
        const [, locale, name] = other.match(/^(fr|de)=(.*)$/) ?? [];
        if (locale) names[locale as 'fr' | 'de'] = name;
        all.push(name ?? other);
      }
      const known: Known = { names, ...(code ? { code } : {}) };
      places.push(known);
      if (code) byCode.set(code, known);
      for (const name of all) {
        const of = byName.get(nameKey(name)) ?? [];
        if (!of.includes(known)) byName.set(nameKey(name), [...of, known]);
      }
    }
    tables.set(id, { places, byName, byCode });
  }
  return tables.get(id);
}

/** A region (a governorate, a province, an emirate) of these countries, by Azure's code for it or by one of its names. */
export function knownRegion(country: string, ...names: string[]): Known | undefined {
  const regions = table(REGIONS, country);
  if (!regions) return undefined;
  for (const name of names) if (/^[A-Z]{2,3}$/.test(name) && regions.byCode.has(name)) return regions.byCode.get(name);
  for (const name of names) {
    const found = regions.byName.get(nameKey(name));
    if (found?.length === 1) return found[0];
  }
  return undefined;
}

/** A city of these countries, by one of its names. */
export function knownCity(country: string, name: string): Known | undefined {
  const found = table(CITIES, country)?.byName.get(nameKey(name));
  return found?.length === 1 ? found[0] : undefined;
}

/** A known place's name in a page's language: its own in French or German where it has one, its English one otherwise. */
export const nameIn = (known: Known, locale: Locale) => known.names[locale] ?? known.names.en;

/** Whether two names are one known city's or region's in a country ("Cairo" and "القاهرة"; "Al Jizah" and "Giza"). */
export function sameKnown(country: string, one: string, other: string): boolean {
  const [a, b] = [nameKey(one), nameKey(other)];
  if (!a || !b) return false;
  if (a === b) return true;
  return [REGIONS, CITIES].some((of) => {
    const byName = table(of, country)?.byName;
    const mine = byName?.get(a) ?? [];
    return mine.length > 0 && (byName?.get(b) ?? []).some((known) => mine.includes(known));
  });
}
